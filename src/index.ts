/**
 * Archive Cleanup, Host half. Builds on DSH's Archive: tracks when each Session
 * was archived, permanently deletes archived Sessions on request or after the
 * chosen retention period, and turns a Workspace deletion into archiving its
 * Sessions so the Workspace can be restored later. Only DSH's own Session files
 * are ever removed; project folders are never touched.
 */

import { readdir, realpath, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import { workspaceRecord } from '@deepseek-ai/dsh-workspace'
// Type-only: the Context merges this service reads and the forwarded Session-removal event.
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import { sessionDir, unsafeReason } from './paths.ts'
import type { ArchiveCleanupState, DeleteFailure, DeleteResult, RestoreResult } from './types.ts'
import {
  deletesAt, emptyState, expiredIds, loadState, RETENTION_DAYS, saveState, syncArchived,
  type DeletedWorkspace, type StoreState,
} from './store.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    archiveCleanup: ArchiveCleanup
  }
}

/** How often expired archived Sessions are looked for. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000

/** Host service backing the `ctx.remote.archiveCleanup` namespace. */
export default class ArchiveCleanup extends TypertRemoteService {
  static inject = ['workspaceRegistry', 'sessionPersistence', 'sessions']

  private readonly logger = this.ctx.logger('archive-cleanup')
  private readonly home = resolveDshHome()
  private readonly stateFile = join(this.home, 'storages', 'archive-cleanup.json')
  private store: StoreState = emptyState()
  /** Last known shape of every Workspace, so a deletion can still be described afterwards. */
  private readonly workspaces = new Map<string, Omit<DeletedWorkspace, 'deletedAt'>>()
  /** Serializes every state-changing operation. */
  private chain: Promise<unknown> = Promise.resolve()
  /** Pending deferred archive-set sync, coalescing bursts of registry writes. */
  private syncTimer: ReturnType<typeof setTimeout> | undefined

  constructor(ctx: Context) {
    super(ctx, 'archiveCleanup')
    this.rememberWorkspaces()
    ctx.on('domain/changed', (change: DomainChanged) => { this.changed(change) })
    ctx.effect(() => {
      void this.enqueue(async () => {
        this.store = await loadState(this.stateFile) ?? emptyState()
        await this.sync()
        if (this.store.pendingDelete.length > 0) await this.deleteNow([...this.store.pendingDelete])
        await this.sweep()
      })
      const timer = setInterval(() => { void this.enqueue(() => this.sweep()) }, SWEEP_INTERVAL_MS)
      timer.unref()
      return () => {
        clearInterval(timer)
        clearTimeout(this.syncTimer)
      }
    }, 'archive-cleanup.sweep')
  }

  /**
   * Read the archive as the settings page shows it.
   * @returns the retention choice, archived Sessions, and deleted Workspaces.
   */
  @Remote
  state(): Promise<ArchiveCleanupState> {
    return this.enqueue(() => {
      const { retentionDays, archived, deletedWorkspaces, pendingDelete } = this.store
      return Promise.resolve({
        retentionDays,
        items: Object.entries(archived).map(([sessionId, entry]) => ({
          sessionId, ...entry, deletesAt: deletesAt(entry, retentionDays), pendingDelete: pendingDelete.includes(sessionId),
        })),
        deletedWorkspaces,
      })
    })
  }

  /**
   * Choose how long archived Sessions are kept. Sessions already past the new
   * period are deleted right away.
   * @param days - one of the offered periods, or `null` to keep them until deleted by hand.
   * @returns the Sessions deleted because they were already past the new period.
   */
  @Remote
  setRetention(days: number | null): Promise<DeleteResult> {
    if (days !== null && !(RETENTION_DAYS as readonly number[]).includes(days)) {
      throw new Error(`retention must be one of ${RETENTION_DAYS.join(', ')} days, or null`)
    }
    return this.enqueue(async () => {
      this.store = { ...this.store, retentionDays: days }
      await this.save()
      return await this.sweep()
    })
  }

  /**
   * Permanently delete archived Sessions: their stored history, cached summary,
   * and subagent children. A Session still loaded in this run cannot be removed
   * safely, so it is deleted at the next start instead. Project folders are never touched.
   * @param sessionIds - archived Sessions to delete.
   * @returns which were deleted and why the others were not.
   */
  @Remote
  deleteSessions(sessionIds: readonly string[]): Promise<DeleteResult> {
    return this.enqueue(() => this.deleteNow(sessionIds))
  }

  /**
   * Bring archived Sessions back. A Session from a deleted Workspace re-creates
   * that Workspace for the same folder first, with all its Sessions in their
   * original order; the ones not restored stay archived inside it.
   * @param sessionIds - archived Sessions to restore.
   * @returns restored Sessions and folders that no longer exist.
   */
  @Remote
  restoreSessions(sessionIds: readonly string[]): Promise<RestoreResult> {
    return this.enqueue(() => this.restoreNow(sessionIds))
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.chain.then(operation)
    this.chain = run.catch((error: unknown) => { this.logger.warn(error) })
    return run
  }

  private changed(change: DomainChanged): void {
    if (change.domain !== 'workspace') return
    if (change.table === 'workspaces' && change.operation === 'deleted') {
      const workspace = this.workspaces.get(change.key)
      this.workspaces.delete(change.key)
      if (workspace !== undefined) void this.enqueue(() => this.workspaceDeleted(workspace))
      return
    }
    if (change.table === 'workspaces' && change.operation === 'put') {
      // The event carries the committed record; the registry's in-memory copy may not have caught up yet.
      const record = workspaceRecord.parse(change.value)
      this.workspaces.set(change.key, { key: change.key, path: record.path, title: record.title, sessionIds: record.sessionIds.map(String) })
    }
    if (change.table === '') this.scheduleSync()
  }

  /**
   * Re-read the archive set once the registry has applied its write. The event
   * fires just before the registry updates its own copy, and a burst of writes
   * (such as a Workspace deletion) can carry snapshots older than work this
   * plugin queues in between, so the sync reads the live set on a later tick
   * instead of trusting any one event's snapshot.
   */
  private scheduleSync(): void {
    if (this.syncTimer !== undefined) return
    this.syncTimer = setTimeout(() => {
      this.syncTimer = undefined
      void this.enqueue(() => this.sync())
    }, 0)
  }

  private rememberWorkspaces(): void {
    for (const workspace of this.ctx.workspaceRegistry.list()) {
      this.workspaces.set(String(workspace.id), {
        key: String(workspace.id), path: workspace.path, title: workspace.title, sessionIds: workspace.sessionIds.map(String),
      })
    }
  }

  /** Align tracked entries with the registry's current archive set. */
  private async sync(): Promise<void> {
    const result = syncArchived(this.store, this.ctx.workspaceRegistry.archivedSessionIds.map(String), Date.now())
    this.store = result.state
    if (result.changed) await this.save()
  }

  private async save(): Promise<void> {
    await saveState(this.stateFile, this.store)
  }

  private async sweep(): Promise<DeleteResult> {
    const due = expiredIds(this.store, Date.now())
    if (due.length === 0) return { deleted: [], scheduled: [], failed: [] }
    const result = await this.deleteNow(due)
    if (result.deleted.length > 0) this.logger.info('auto-deleted %d archived session(s)', result.deleted.length)
    if (result.scheduled.length > 0) this.logger.info('%d expired session(s) are loaded and will be deleted at the next start', result.scheduled.length)
    for (const failure of result.failed) this.logger.warn('could not auto-delete %s: %s', failure.sessionId, failure.message)
    return result
  }

  /** Archive every Session of a deleted Workspace and remember the Workspace for a later restore. */
  private async workspaceDeleted(workspace: Omit<DeletedWorkspace, 'deletedAt'>): Promise<void> {
    const kept: string[] = []
    const now = Date.now()
    for (const id of workspace.sessionIds) {
      if (id in this.store.archived) {
        kept.push(id)
        continue
      }
      this.store.archived[id] = { archivedAt: now, archivedBy: 'workspace-delete' }
      try {
        await this.ctx.workspaceRegistry.archiveSession(id as SessionId, { stopActivity: true })
        kept.push(id)
      } catch (error) {
        // A blank Session that was never saved has nothing to archive.
        delete this.store.archived[id]
        this.logger.debug('skipped %s while archiving deleted workspace: %s', id, String(error))
      }
    }
    if (kept.length > 0) {
      this.store.deletedWorkspaces = [
        ...this.store.deletedWorkspaces.filter(entry => entry.key !== workspace.key),
        { ...workspace, sessionIds: kept, deletedAt: now },
      ]
    }
    await this.save()
  }

  private async deleteNow(sessionIds: readonly string[]): Promise<DeleteResult> {
    const deleted: string[] = []
    const scheduled: string[] = []
    const failed: DeleteFailure[] = []
    const sessionsRoot = await realpath(join(this.home, 'sessions')).catch(() => join(this.home, 'sessions'))
    const workspacePaths = await Promise.all(this.ctx.workspaceRegistry.list().map(
      workspace => realpath(workspace.path).catch(() => workspace.path),
    ))
    let stored: readonly SessionPersistenceSnapshot[] | undefined
    for (const id of sessionIds) {
      if (!(id in this.store.archived)) {
        failed.push({ sessionId: id, reason: 'not-archived', message: 'Only archived sessions can be deleted permanently.' })
        continue
      }
      try {
        stored ??= await this.ctx.sessionPersistence.list()
        const tree = [...descendants(id, stored), id]
        if (tree.some(member => this.ctx.sessions.get(member as SessionId) !== undefined)) {
          // A loaded Session may still write to its folder; delete it before anything loads it next time.
          if (!this.store.pendingDelete.includes(id)) this.store.pendingDelete.push(id)
          scheduled.push(id)
          continue
        }
        const folders = await sessionFolders(tree, stored, sessionsRoot)
        const unsafe = await checkFolders(folders, sessionsRoot, workspacePaths)
        if (unsafe !== null) {
          failed.push({ sessionId: id, reason: 'unsafe-path', message: unsafe })
          continue
        }
        for (const member of tree) await this.erase(member, folders.get(member))
        deleted.push(id)
      } catch (error) {
        failed.push({ sessionId: id, reason: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    }
    this.store.pendingDelete = this.store.pendingDelete.filter(id => !deleted.includes(id))
    await this.save()
    return { deleted, scheduled, failed }
  }

  /** Remove one Session's files (its checked folder, if it has one) and every reference to it. */
  private async erase(sessionId: string, folder: string | undefined): Promise<void> {
    const id = sessionId as SessionId
    if (folder !== undefined) await rm(folder, { recursive: true })
    if (/^[A-Za-z0-9._-]+$/.test(sessionId)) {
      await rm(join(this.home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`), { force: true })
    }
    for (const workspace of this.ctx.workspaceRegistry.list()) {
      if (workspace.sessionIds.includes(id)) await workspace.detachSession(id)
    }
    await this.ctx.workspaceRegistry.unarchiveSession(id)
    delete this.store.archived[sessionId]
    this.ctx.emit('api-session/removed', id)
    this.logger.info('deleted session %s', sessionId)
  }

  private async restoreNow(sessionIds: readonly string[]): Promise<RestoreResult> {
    const restored: string[] = []
    const missingFolders: string[] = []
    for (const id of sessionIds) {
      const workspace = this.store.deletedWorkspaces.find(entry => entry.sessionIds.includes(id))
      if (workspace !== undefined && !await this.recreate(workspace)) missingFolders.push(workspace.path)
      await this.ctx.workspaceRegistry.unarchiveSession(id as SessionId)
      restored.push(id)
    }
    await this.save()
    return { restored, missingFolders: [...new Set(missingFolders)] }
  }

  /**
   * Re-register a deleted Workspace for its folder and put its Sessions back in order.
   * @returns false when the folder no longer exists.
   */
  private async recreate(workspace: DeletedWorkspace): Promise<boolean> {
    this.store.deletedWorkspaces = this.store.deletedWorkspaces.filter(entry => entry.key !== workspace.key)
    let target
    try {
      target = await this.ctx.workspaceRegistry.resolveByPath(workspace.path)
        ?? await this.ctx.workspaceRegistry.create(workspace.path, workspace.title)
    } catch (error) {
      this.logger.warn('cannot re-create workspace %s: %s', workspace.path, String(error))
      return false
    }
    // attachSession prepends, so attach in reverse to keep the original order.
    for (const id of [...workspace.sessionIds].reverse()) {
      try {
        await target.attachSession(id as SessionId)
      } catch (error) {
        this.logger.warn('cannot put %s back into %s: %s', id, workspace.path, String(error))
      }
    }
    return true
  }
}

/** Every subagent Session created, directly or indirectly, by `parent`. */
function descendants(parent: string, stored: readonly SessionPersistenceSnapshot[]): string[] {
  const children = stored
    .filter(snapshot => snapshot.header.parentSession === parent && snapshot.header.origin === 'subagent')
    .map(snapshot => String(snapshot.header.id))
  return children.flatMap(child => [...descendants(child, stored), child])
}

/**
 * The real folder of each Session in `tree` that exists on disk. DSH 0.2.2 and
 * later report the stored file's location; earlier versions use the JSONL layout.
 */
async function sessionFolders(
  tree: readonly string[],
  stored: readonly SessionPersistenceSnapshot[],
  sessionsRoot: string,
): Promise<Map<string, string>> {
  const folders = new Map<string, string>()
  for (const member of tree) {
    const snapshot = stored.find(entry => entry.header.id === member)
    if (snapshot === undefined) continue
    const reported = (snapshot as { readonly location?: { readonly path: string } }).location?.path
    const folder = reported === undefined ? sessionDir(sessionsRoot, snapshot.header.cwd, member) : dirname(reported)
    const real = await realpath(folder).catch(() => undefined)
    if (real !== undefined) folders.set(member, real)
  }
  return folders
}

/** @returns the first reason one of `folders` may not be removed, or `null`. */
async function checkFolders(
  folders: ReadonlyMap<string, string>,
  sessionsRoot: string,
  workspacePaths: readonly string[],
): Promise<string | null> {
  for (const [member, dir] of folders) {
    const reason = unsafeReason(dir, member, sessionsRoot, workspacePaths)
    if (reason !== null) return reason
    const entries = await readdir(dir)
    if (!entries.some(name => name.startsWith('session.') && name.includes('.jsonl'))) {
      return `"${dir}" does not look like a session folder`
    }
  }
  return null
}
