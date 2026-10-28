/** Plugin state: when each Session was archived, deleted-Workspace snapshots, and the retention choice. */

import { readFile, rename, writeFile } from 'node:fs/promises'

export { RETENTION_DAYS } from './types.ts'

/** One archived Session as this plugin tracks it. */
export interface ArchivedEntry {
  /** Unix epoch milliseconds when the Session entered the archive. */
  archivedAt: number
  /** Whether the user archived it or it was archived because its Workspace was deleted. */
  archivedBy: 'user' | 'workspace-delete'
}

/** The last known shape of a Workspace the user deleted. */
export interface DeletedWorkspace {
  /** The deleted Workspace's id. */
  key: string
  /** Project folder; never touched, only used to re-register the Workspace. */
  path: string
  title: string
  /** Sessions in the Workspace's own order. */
  sessionIds: string[]
  deletedAt: number
}

/** Everything the plugin persists. */
export interface StoreState {
  version: 1
  retentionDays: number | null
  archived: Record<string, ArchivedEntry>
  deletedWorkspaces: DeletedWorkspace[]
  /** Archived Sessions to delete at the next start because they were still loaded when deletion was requested. */
  pendingDelete: string[]
}

/** @returns a fresh, empty state. */
export function emptyState(): StoreState {
  return { version: 1, retentionDays: null, archived: {}, deletedWorkspaces: [], pendingDelete: [] }
}

/**
 * Read the state file.
 * @param file - absolute path of the JSON file.
 * @returns the stored state, or `undefined` when the file does not exist yet.
 */
export async function loadState(file: string): Promise<StoreState | undefined> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const parsed = JSON.parse(text) as Partial<StoreState>
  return { ...emptyState(), ...parsed, version: 1 }
}

/**
 * Write the state file atomically (temporary file, then rename).
 * @param file - absolute path of the JSON file.
 * @param state - state to store.
 */
export async function saveState(file: string, state: StoreState): Promise<void> {
  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', 'utf8')
  await rename(temporary, file)
}

/**
 * Align tracked entries with the Host archive set: newly archived ids get `now`,
 * unarchived ids are forgotten (which also cancels a pending delete), and
 * deleted-Workspace snapshots drop Sessions that are no longer archived (an
 * emptied snapshot is dropped).
 * @param state - current state; not mutated.
 * @param archivedIds - the Host's complete archive set.
 * @param now - current time in epoch milliseconds.
 * @returns the aligned state, and whether anything changed.
 */
export function syncArchived(state: StoreState, archivedIds: readonly string[], now: number): { state: StoreState, changed: boolean } {
  const ids = new Set(archivedIds)
  const archived: Record<string, ArchivedEntry> = {}
  let changed = false
  for (const id of ids) {
    const entry = state.archived[id]
    if (entry === undefined) changed = true
    archived[id] = entry ?? { archivedAt: now, archivedBy: 'user' }
  }
  if (Object.keys(state.archived).some(id => !ids.has(id))) changed = true
  const deletedWorkspaces = state.deletedWorkspaces
    .map(workspace => ({ ...workspace, sessionIds: workspace.sessionIds.filter(id => ids.has(id)) }))
    .filter(workspace => workspace.sessionIds.length > 0)
  if (deletedWorkspaces.some((workspace, i) => workspace.sessionIds.length !== state.deletedWorkspaces[i]?.sessionIds.length)
    || deletedWorkspaces.length !== state.deletedWorkspaces.length) changed = true
  const pendingDelete = state.pendingDelete.filter(id => ids.has(id))
  if (pendingDelete.length !== state.pendingDelete.length) changed = true
  return { state: { ...state, archived, deletedWorkspaces, pendingDelete }, changed }
}

/**
 * When an archived Session will be deleted automatically.
 * @param entry - the tracked entry.
 * @param retentionDays - the retention choice, `null` for never.
 * @returns epoch milliseconds, or `null` when it is kept until deleted by hand.
 */
export function deletesAt(entry: ArchivedEntry, retentionDays: number | null): number | null {
  return retentionDays === null ? null : entry.archivedAt + retentionDays * 86_400_000
}

/**
 * Sessions whose own retention period has fully elapsed.
 * @param state - current state.
 * @param now - current time in epoch milliseconds.
 * @returns ids to delete, oldest first.
 */
export function expiredIds(state: StoreState, now: number): string[] {
  return Object.entries(state.archived)
    .filter(([, entry]) => {
      const at = deletesAt(entry, state.retentionDays)
      return at !== null && at <= now
    })
    .sort(([, a], [, b]) => a.archivedAt - b.archivedAt)
    .map(([id]) => id)
}
