/** Values shared by the Host and the settings page. */

/** Auto-delete choices in days; `null` keeps archived Sessions until deleted by hand. */
export const RETENTION_DAYS = [1, 3, 7, 14, 30, 60, 90] as const

/** One archived Session as the settings page shows it. */
export interface ArchivedItem {
  readonly sessionId: string
  readonly archivedAt: number
  readonly archivedBy: 'user' | 'workspace-delete'
  /** When it will be deleted automatically, or `null` for never. */
  readonly deletesAt: number | null
  /** Deletion was requested while the Session was loaded; it is deleted at the next start. */
  readonly pendingDelete: boolean
}

/** A deleted Workspace whose Sessions are still in the archive. */
export interface DeletedWorkspaceItem {
  readonly key: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly string[]
  readonly deletedAt: number
}

/** The complete state the settings page renders. */
export interface ArchiveCleanupState {
  /** `null` keeps archived Sessions until deleted by hand. */
  readonly retentionDays: number | null
  readonly items: readonly ArchivedItem[]
  readonly deletedWorkspaces: readonly DeletedWorkspaceItem[]
}

/** Why one Session could not be deleted. */
export interface DeleteFailure {
  readonly sessionId: string
  readonly reason: 'not-archived' | 'unsafe-path' | 'error'
  readonly message: string
}

/** Outcome of a delete request. */
export interface DeleteResult {
  readonly deleted: readonly string[]
  /** Still loaded in this run, so deleted at the next start instead. */
  readonly scheduled: readonly string[]
  readonly failed: readonly DeleteFailure[]
}

/** Outcome of a restore request. */
export interface RestoreResult {
  readonly restored: readonly string[]
  /** Deleted-Workspace folders that no longer exist, so their Sessions came back ungrouped. */
  readonly missingFolders: readonly string[]
}
