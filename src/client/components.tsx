/**
 * The archived-Session menu row, the confirmation dialog with the action
 * notice, and the Settings → Archived sessions page.
 */
import { useEffect, useState } from 'react'
import {
  Button, IconFolderCloseRegular, IconTrashOutlineRegular, IconUnarchiveOutlineRegular, MenuItemButton, Modal, Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { RETENTION_DAYS, type ArchivedItem } from '../types.ts'
import type { CleanupSnapshot, Confirmation } from './model.ts'
import css from './components.module.css'

/** What the plugin hands every component. */
export interface CleanupInjected {
  hooks: { cleanup: ObservableSnapshot<CleanupSnapshot> }
  requestDeleteSession(sessionId: string, title: string | null): void
  requestDeleteGroup(sessionIds: readonly string[], title: string): void
  requestDeleteAll(): void
  requestRetention(days: number | null): void
  restore(sessionIds: readonly string[]): void
  refresh(): void
  dismiss(): void
  clearNotice(): void
}

type Face = InjectFace<CleanupInjected> & PropsLocale<'archiveCleanup'>

/**
 * Session ⋯ menu row: "Delete permanently", shown only for archived Sessions.
 * @param props - owner share, menu state, archive set, and plugin face.
 * @returns the row, or nothing for a Session that is not archived.
 */
export function DeleteSessionMenuItem({
  sessionId, displayTitle, useMenuOpenState, useWorkspaces, requestDeleteSession, t,
}: PropsRuntime<'sidebar.workspaces.session.menu.item'> & Face) {
  const [, setMenuOpen] = useMenuOpenState()
  const archived = useWorkspaces(snapshot => snapshot.archivedSessionIds.includes(sessionId))
  if (!archived) return null
  return (
    <MenuItemButton
      danger
      separatorBefore
      icon={<IconTrashOutlineRegular size={14} />}
      onSelect={() => {
        setMenuOpen(false)
        requestDeleteSession(sessionId, displayTitle)
      }}
    >
      {t('menu.delete')}
    </MenuItemButton>
  )
}

/**
 * The `shell.overlay` entry: the pending confirmation and the latest notice.
 * @param props - plugin face.
 * @returns the dialog and toast, or nothing.
 */
export function CleanupOverlay({ useCleanup, dismiss, clearNotice, t }: PropsRuntime<'shell.overlay'> & Face) {
  const confirmation = useCleanup(snapshot => snapshot.confirmation)
  const notice = useCleanup(snapshot => snapshot.notice)
  return (
    <>
      {confirmation !== null && <ConfirmForm key={confirmation.title + confirmation.description} confirmation={confirmation} onClose={dismiss} t={t} />}
      {notice !== null && (
        <Toast key={notice.sequence} text={notice.text} onDone={clearNotice} {...notice.success ? { tone: 'success' as const } : {}} />
      )}
    </>
  )
}

/** One confirmation's dialog; its pending and error state die with it. */
function ConfirmForm({ confirmation, onClose, t }: { confirmation: Confirmation, onClose: () => void, t: Face['t'] }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    if (!pending) onClose()
  }
  const confirm = () => {
    setPending(true)
    setError(null)
    confirmation.run().then(onClose, (reason: unknown) => {
      setPending(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('confirm.close')}
      title={confirmation.title}
      description={confirmation.description}
      footer={(
        <>
          <Button variant="outline" disabled={pending} onClick={close}>{t('confirm.cancel')}</Button>
          <Button variant="outline" className={css.danger} disabled={pending} onClick={confirm}>{confirmation.action}</Button>
        </>
      )}
    >
      <p className={css.safe}>{t('confirm.safe')}</p>
      {pending && <div className={css.status} role="status">{t('confirm.pending')}</div>}
      {error !== null && <div className={css.error} role="alert">{error}</div>}
    </Modal>
  )
}

/** One rendered group: a live Workspace, a deleted one, or the ungrouped rest. */
interface Group {
  key: string
  title: string
  deletedAt?: number
  items: ArchivedItem[]
}

/**
 * Settings → Archived sessions: the retention choice, Delete all, and archived
 * Sessions grouped by Workspace like the sidebar.
 * @param props - archive view, Workspace and Session lists, and plugin face.
 * @returns the page.
 */
export function ArchivedSessionsPage({
  useCleanup, useWorkspaces, useSessions, requestDeleteSession, requestDeleteGroup, requestDeleteAll, requestRetention, restore, refresh, t,
}: PropsRuntime<'settings.section'> & Face) {
  // Re-read once each time the page opens.
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const state = useCleanup(snapshot => snapshot.state)
  const workspaces = useWorkspaces(snapshot => snapshot.items)
  const sessions = useSessions(snapshot => snapshot.byId)
  if (state === null) return <div className={css.page} />
  const title = (id: string) => sessions[id as keyof typeof sessions]?.title?.trim() || t('row.untitled')
  const groups = groupItems(state.items, state.deletedWorkspaces, workspaces, t('group.ungrouped'))
  return (
    <div className={css.page}>
      <div className={css.setting}>
        <div>
          <div className={css.settingTitle}>{t('retention.title')}</div>
          <div className={css.settingDescription}>{t('retention.description')}</div>
        </div>
        <select
          className={css.select}
          aria-label={t('retention.title')}
          value={state.retentionDays ?? 'never'}
          onChange={(event) => { requestRetention(event.target.value === 'never' ? null : Number(event.target.value)) }}
        >
          <option value="never">{t('retention.never')}</option>
          {RETENTION_DAYS.map(days => (
            <option key={days} value={days}>{t(days === 1 ? 'retention.days.one' : 'retention.days.other', { n: days })}</option>
          ))}
        </select>
      </div>
      <div className={css.toolbar}>
        <Button variant="outline" className={css.danger} disabled={state.items.length === 0} onClick={requestDeleteAll}>
          {t('deleteAll')}
        </Button>
      </div>
      {groups.length === 0 && <p className={css.empty}>{t('empty')}</p>}
      {groups.map(group => (
        <section key={group.key} className={css.group}>
          <header className={css.groupHeader}>
            <IconFolderCloseRegular size={16} />
            <span className={css.groupTitle}>{group.title}</span>
            {group.deletedAt !== undefined && <span className={css.badge}>{t('group.deleted', { date: formatDate(group.deletedAt) })}</span>}
            <span className={css.spacer} />
            {group.deletedAt !== undefined && (
              <button type="button" className={css.textButton} onClick={() => { restore(group.items.map(item => item.sessionId)) }}>
                {t('group.restore')}
              </button>
            )}
            {group.key !== '' && (
              <button
                type="button"
                className={`${css.textButton} ${css.danger}`}
                onClick={() => { requestDeleteGroup(group.items.map(item => item.sessionId), group.title) }}
              >
                {t('group.delete')}
              </button>
            )}
          </header>
          <ul className={css.rows}>
            {group.items.map(item => (
              <li key={item.sessionId} className={css.row}>
                <div className={css.rowText}>
                  <div className={css.rowTitle}>{title(item.sessionId)}</div>
                  <div className={css.rowMeta}>
                    {t(item.archivedBy === 'workspace-delete' ? 'row.archivedWithWorkspace' : 'row.archived', { date: formatDate(item.archivedAt) })}
                    {' · '}
                    {item.pendingDelete ? t('row.pending') : deletesLabel(item.deletesAt, t)}
                  </div>
                </div>
                <button type="button" className={css.iconButton} aria-label={t('row.restore')} title={t('row.restore')} onClick={() => { restore([item.sessionId]) }}>
                  <IconUnarchiveOutlineRegular size={14} />
                </button>
                <button
                  type="button"
                  className={`${css.iconButton} ${css.danger}`}
                  aria-label={t('row.delete')}
                  title={t('row.delete')}
                  onClick={() => { requestDeleteSession(item.sessionId, title(item.sessionId)) }}
                >
                  <IconTrashOutlineRegular size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Live Workspaces in sidebar order, then deleted ones (newest first), then ungrouped. */
function groupItems(
  items: readonly ArchivedItem[],
  deleted: readonly { key: string, title: string, sessionIds: readonly string[], deletedAt: number }[],
  live: readonly { workspaceId: string, title: string, sessionIds: readonly string[] }[],
  ungroupedTitle: string,
): Group[] {
  const groups: Group[] = [
    ...live.map(workspace => ({ key: workspace.workspaceId, title: workspace.title, members: workspace.sessionIds })),
    ...[...deleted].sort((a, b) => b.deletedAt - a.deletedAt)
      .map(workspace => ({ key: workspace.key, title: workspace.title, deletedAt: workspace.deletedAt, members: workspace.sessionIds })),
  ].map(({ members, ...group }) => ({ ...group, items: items.filter(item => members.includes(item.sessionId)) }))
  const placed = new Set(groups.flatMap(group => group.items.map(item => item.sessionId)))
  groups.push({ key: '', title: ungroupedTitle, items: items.filter(item => !placed.has(item.sessionId)) })
  for (const group of groups) group.items.sort((a, b) => b.archivedAt - a.archivedAt)
  return groups.filter(group => group.items.length > 0)
}

function deletesLabel(at: number | null, t: Face['t']): string {
  if (at === null) return t('row.kept')
  const days = Math.ceil((at - Date.now()) / 86_400_000)
  if (days <= 0) return t('row.deletesToday')
  return t(days === 1 ? 'row.deletesIn.one' : 'row.deletesIn.other', { n: days })
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
