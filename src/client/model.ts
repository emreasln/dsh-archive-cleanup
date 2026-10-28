/** Browser-side state: the Host archive view, the pending confirmation, and the last notice. */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ArchiveCleanupState, DeleteResult, RestoreResult } from '../types.ts'

/** A destructive action waiting for the user's confirmation. */
export interface Confirmation {
  readonly title: string
  readonly description: string
  readonly action: string
  readonly run: () => Promise<void>
}

/** A short message shown after an action. */
export interface Notice {
  readonly text: string
  readonly success: boolean
  readonly sequence: number
}

/** Everything the page, menu item, and dialogs read. */
export interface CleanupSnapshot {
  state: ArchiveCleanupState | null
  confirmation: Confirmation | null
  notice: Notice | null
}

/** The Host calls this model needs. */
export interface CleanupRemote {
  state(): Promise<ArchiveCleanupState>
  setRetention(days: number | null): Promise<DeleteResult>
  deleteSessions(sessionIds: readonly string[]): Promise<DeleteResult>
  restoreSessions(sessionIds: readonly string[]): Promise<RestoreResult>
}

/** Owns the snapshot and turns Host results into notices. */
export class CleanupModel {
  readonly store: SnapshotStore<CleanupSnapshot> = createSnapshotStore<CleanupSnapshot>({ state: null, confirmation: null, notice: null })
  private sequence = 0

  constructor(private readonly remote: CleanupRemote, private readonly t: (key: string, vars?: Record<string, unknown>) => string) {}

  /** Re-read the archive view from the Host. */
  async refresh(): Promise<void> {
    const state = await this.remote.state()
    this.store.update((draft) => { draft.state = state })
  }

  /**
   * Show a confirmation; nothing happens until the user confirms.
   * @param confirmation - copy and the action to run on confirm.
   */
  ask(confirmation: Confirmation): void {
    this.store.update((draft) => { draft.confirmation = confirmation })
  }

  /** Close the confirmation without acting. */
  dismiss(): void {
    this.store.update((draft) => { draft.confirmation = null })
  }

  /** Clear the notice. */
  clearNotice(): void {
    this.store.update((draft) => { draft.notice = null })
  }

  /**
   * Permanently delete archived Sessions and report the outcome.
   * @param sessionIds - archived Sessions.
   */
  async delete(sessionIds: readonly string[]): Promise<void> {
    this.report(await this.remote.deleteSessions(sessionIds))
    await this.refresh()
  }

  /**
   * Change the retention period (which may delete expired Sessions) and report the outcome.
   * @param days - new period, or `null` for never.
   */
  async setRetention(days: number | null): Promise<void> {
    const result = await this.remote.setRetention(days)
    if (result.deleted.length + result.scheduled.length + result.failed.length > 0) this.report(result)
    await this.refresh()
  }

  /**
   * Restore archived Sessions and report the outcome.
   * @param sessionIds - archived Sessions.
   */
  async restore(sessionIds: readonly string[]): Promise<void> {
    const result = await this.remote.restoreSessions(sessionIds)
    const missing = result.missingFolders[0]
    this.notify(missing === undefined ? this.t('notice.restored') : this.t('notice.missingFolder', { path: missing }), missing === undefined)
    await this.refresh()
  }

  /**
   * Show a notice.
   * @param text - message.
   * @param success - whether to use the success tone.
   */
  notify(text: string, success: boolean): void {
    this.sequence += 1
    const notice = { text, success, sequence: this.sequence }
    this.store.update((draft) => { draft.notice = notice })
  }

  private report(result: DeleteResult): void {
    const failure = result.failed[0]
    if (failure !== undefined) {
      this.notify(this.t('notice.failed', { message: failure.message }), false)
      return
    }
    const n = result.deleted.length
    const later = result.scheduled.length
    const text = [
      n > 0 ? this.t(n === 1 ? 'notice.deleted.one' : 'notice.deleted.other', { n }) : '',
      later > 0 ? this.t(later === 1 ? 'notice.scheduled.one' : 'notice.scheduled.other', { n: later }) : '',
    ].filter(Boolean).join(' ')
    this.notify(text, true)
  }
}
