/**
 * Archive Cleanup, Host half. Builds on DSH's Archive: tracks when each Session
 * was archived, permanently deletes archived Sessions on request or after the
 * chosen retention period, and turns a Workspace deletion into archiving its
 * Sessions so the Workspace can be restored later. Only DSH's own Session files
 * are ever removed; project folders are never touched.
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ArchiveCleanupState, DeleteResult, RestoreResult } from './types.ts';
export type * from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        archiveCleanup: ArchiveCleanup;
    }
}
/** Host service backing the `ctx.remote.archiveCleanup` namespace. */
export default class ArchiveCleanup extends TypertRemoteService {
    static inject: string[];
    private readonly logger;
    private readonly home;
    private readonly stateFile;
    private store;
    /** Last known shape of every Workspace, so a deletion can still be described afterwards. */
    private readonly workspaces;
    /** Serializes every state-changing operation. */
    private chain;
    /** Pending deferred archive-set sync, coalescing bursts of registry writes. */
    private syncTimer;
    constructor(ctx: Context);
    /**
     * Read the archive as the settings page shows it.
     * @returns the retention choice, archived Sessions, and deleted Workspaces.
     */
    state(): Promise<ArchiveCleanupState>;
    /**
     * Choose how long archived Sessions are kept. Sessions already past the new
     * period are deleted right away.
     * @param days - one of the offered periods, or `null` to keep them until deleted by hand.
     * @returns the Sessions deleted because they were already past the new period.
     */
    setRetention(days: number | null): Promise<DeleteResult>;
    /**
     * Permanently delete archived Sessions: their stored history, cached summary,
     * and subagent children. A Session still loaded in this run cannot be removed
     * safely, so it is deleted at the next start instead. Project folders are never touched.
     * @param sessionIds - archived Sessions to delete.
     * @returns which were deleted and why the others were not.
     */
    deleteSessions(sessionIds: readonly string[]): Promise<DeleteResult>;
    /**
     * Bring archived Sessions back. A Session from a deleted Workspace re-creates
     * that Workspace for the same folder first, with all its Sessions in their
     * original order; the ones not restored stay archived inside it.
     * @param sessionIds - archived Sessions to restore.
     * @returns restored Sessions and folders that no longer exist.
     */
    restoreSessions(sessionIds: readonly string[]): Promise<RestoreResult>;
    private enqueue;
    private changed;
    /**
     * Re-read the archive set once the registry has applied its write. The event
     * fires just before the registry updates its own copy, and a burst of writes
     * (such as a Workspace deletion) can carry snapshots older than work this
     * plugin queues in between, so the sync reads the live set on a later tick
     * instead of trusting any one event's snapshot.
     */
    private scheduleSync;
    private rememberWorkspaces;
    /** Align tracked entries with the registry's current archive set. */
    private sync;
    private save;
    private sweep;
    /** Archive every Session of a deleted Workspace and remember the Workspace for a later restore. */
    private workspaceDeleted;
    private deleteNow;
    /** Remove one Session's files (its checked folder, if it has one) and every reference to it. */
    private erase;
    private restoreNow;
    /**
     * Re-register a deleted Workspace for its folder and put its Sessions back in order.
     * @returns false when the folder no longer exists.
     */
    private recreate;
}
//# sourceMappingURL=index.d.ts.map