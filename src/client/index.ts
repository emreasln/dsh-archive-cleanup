/**
 * Archive Cleanup, browser half: a "Delete permanently" row in an archived
 * Session's ⋯ menu, the Settings → Archived sessions page, and the confirmation
 * dialog every destructive action goes through.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import contribution from '../../lib/typert.remote-client.js'
import { ArchivedSessionsPage, CleanupOverlay, DeleteSessionMenuItem, type CleanupInjected } from './components.tsx'
import { en, type CleanupKey } from './locales.ts'
import { CleanupModel } from './model.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Archive Cleanup copy. */
    'archiveCleanup': keyof typeof en
  }
}

const LOCALE = 'archiveCleanup'
const DAY_MS = 86_400_000

/** Services used by the browser half. */
export const inject = ['slots', 'locale', 'remote', 'workspaces']

/**
 * Mount this plugin's Remote namespace, then activate the UI once it is available.
 * @param ctx - browser plugin context.
 * @returns the namespace disposer.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  // English is the only shipped copy; the locale service requires a zh baseline.
  ctx.effect(() => ctx.locale.register(LOCALE, { en, zh: en }))
  const unmount = await ctx.remote.$mount(contribution)
  ctx.inject(['remote.archiveCleanup'], activate)
  return unmount
}

/**
 * Register the menu row, the settings page, and the overlay.
 * @param ctx - context that may read `ctx.remote.archiveCleanup`.
 */
function activate(ctx: Context): void {
  const t = ctx.locale.bind(LOCALE)
  const remote = () => ctx.remote.archiveCleanup
  const model = new CleanupModel({
    state: async () => unwrap(await remote().state()),
    setRetention: async days => unwrap(await remote().setRetention(days)),
    deleteSessions: async ids => unwrap(await remote().deleteSessions(ids)),
    restoreSessions: async ids => unwrap(await remote().restoreSessions(ids)),
  }, (key, vars) => t(key as CleanupKey, vars))

  const manyTitle = (n: number) => n === 1 ? t('confirm.one.title') : t('confirm.many.title', { n })
  const face = (): CleanupInjected => ({
    hooks: { cleanup: model.store },
    requestDeleteSession: (sessionId, title) => {
      model.ask({
        title: t('confirm.one.title'),
        description: t('confirm.one.desc', { title: title ?? t('row.untitled') }),
        action: t('confirm.delete'),
        run: () => model.delete([sessionId]),
      })
    },
    requestDeleteGroup: (sessionIds, title) => {
      model.ask({
        title: manyTitle(sessionIds.length),
        description: t('confirm.group.desc', { title }),
        action: t('confirm.delete'),
        run: () => model.delete(sessionIds),
      })
    },
    requestDeleteAll: () => {
      const ids = model.store.getSnapshot().state?.items.map(item => item.sessionId) ?? []
      model.ask({
        title: manyTitle(ids.length),
        description: t('confirm.all.desc'),
        action: t('confirm.delete'),
        run: () => model.delete(ids),
      })
    },
    requestRetention: (days) => {
      const items = model.store.getSnapshot().state?.items ?? []
      const due = days === null ? 0 : items.filter(item => item.archivedAt + days * DAY_MS <= Date.now()).length
      if (due === 0) {
        void model.setRetention(days).catch(report)
        return
      }
      model.ask({
        title: t('confirm.retention.title'),
        description: t(due === 1 ? 'confirm.retention.desc.one' : 'confirm.retention.desc.other', { n: due }),
        action: t('confirm.apply'),
        run: () => model.setRetention(days),
      })
    },
    restore: (sessionIds) => { void model.restore(sessionIds).catch(report) },
    refresh: () => { void model.refresh().catch(report) },
    dismiss: () => { model.dismiss() },
    clearNotice: () => { model.clearNotice() },
  })

  ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
    name: 'sidebar.workspaces.session.menu.item', id: 'archive-cleanup-delete', order: 410, locale: LOCALE, inject: face,
  }, DeleteSessionMenuItem))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'archived-sessions', order: 60, label: () => t('nav'), locale: LOCALE, inject: face,
  }, ArchivedSessionsPage))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'archive-cleanup-overlay', locale: LOCALE, inject: face,
  }, CleanupOverlay))

  ctx.effect(() => followWorkspaces(ctx, model, t), 'archive-cleanup.follow')
  // The first page load may race the session cookie; every (re)connection re-reads the archive.
  ctx.on('connection/reset', () => { void model.refresh().catch(report) })
  void model.refresh().catch(report)
}

/**
 * Re-read the archive view whenever the archive set or the Workspace list
 * changes, and announce Workspaces whose deletion archived their Sessions.
 * @returns unsubscribe function.
 */
function followWorkspaces(ctx: Context, model: CleanupModel, t: (key: 'notice.workspaceArchived.one' | 'notice.workspaceArchived.other', vars: Record<string, unknown>) => string): () => void {
  let last = ctx.workspaces.list.getSnapshot()
  return ctx.workspaces.list.subscribe(() => {
    const next = ctx.workspaces.list.getSnapshot()
    if (next.archivedSessionIds === last.archivedSessionIds && next.items === last.items) return
    last = next
    const known = new Set(model.store.getSnapshot().state?.deletedWorkspaces.map(workspace => workspace.key))
    void model.refresh().then(() => {
      for (const workspace of model.store.getSnapshot().state?.deletedWorkspaces ?? []) {
        if (known.has(workspace.key)) continue
        const n = workspace.sessionIds.length
        model.notify(t(n === 1 ? 'notice.workspaceArchived.one' : 'notice.workspaceArchived.other', { n, title: workspace.title }), true)
      }
    }).catch(report)
  })
}

/** Surface an unexpected failure in the browser console. */
function report(error: unknown): void {
  console.error('[archive-cleanup]', error)
}

/** @returns the value of a successful Remote call; a failure is thrown as its Error. */
function unwrap<T>(result: RemoteResult<T>): T {
  if (!result.ok) throw result.error
  return result.value
}
