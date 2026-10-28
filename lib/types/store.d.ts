/** Plugin state: when each Session was archived, deleted-Workspace snapshots, and the retention choice. */
export { RETENTION_DAYS } from './types.ts';
/** One archived Session as this plugin tracks it. */
export interface ArchivedEntry {
    /** Unix epoch milliseconds when the Session entered the archive. */
    archivedAt: number;
    /** Whether the user archived it or it was archived because its Workspace was deleted. */
    archivedBy: 'user' | 'workspace-delete';
}
/** The last known shape of a Workspace the user deleted. */
export interface DeletedWorkspace {
    /** The deleted Workspace's id. */
    key: string;
    /** Project folder; never touched, only used to re-register the Workspace. */
    path: string;
    title: string;
    /** Sessions in the Workspace's own order. */
    sessionIds: string[];
    deletedAt: number;
}
/** Everything the plugin persists. */
export interface StoreState {
    version: 1;
    retentionDays: number | null;
    archived: Record<string, ArchivedEntry>;
    deletedWorkspaces: DeletedWorkspace[];
    /** Archived Sessions to delete at the next start because they were still loaded when deletion was requested. */
    pendingDelete: string[];
}
/** @returns a fresh, empty state. */
export declare function emptyState(): StoreState;
/**
 * Read the state file.
 * @param file - absolute path of the JSON file.
 * @returns the stored state, or `undefined` when the file does not exist yet.
 */
export declare function loadState(file: string): Promise<StoreState | undefined>;
/**
 * Write the state file atomically (temporary file, then rename).
 * @param file - absolute path of the JSON file.
 * @param state - state to store.
 */
export declare function saveState(file: string, state: StoreState): Promise<void>;
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
export declare function syncArchived(state: StoreState, archivedIds: readonly string[], now: number): {
    state: StoreState;
    changed: boolean;
};
/**
 * When an archived Session will be deleted automatically.
 * @param entry - the tracked entry.
 * @param retentionDays - the retention choice, `null` for never.
 * @returns epoch milliseconds, or `null` when it is kept until deleted by hand.
 */
export declare function deletesAt(entry: ArchivedEntry, retentionDays: number | null): number | null;
/**
 * Sessions whose own retention period has fully elapsed.
 * @param state - current state.
 * @param now - current time in epoch milliseconds.
 * @returns ids to delete, oldest first.
 */
export declare function expiredIds(state: StoreState, now: number): string[];
//# sourceMappingURL=store.d.ts.map