/** Browser-side state: the Host archive view, the pending confirmation, and the last notice. */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ArchiveCleanupState, DeleteResult, RestoreResult } from '../types.ts';
/** A destructive action waiting for the user's confirmation. */
export interface Confirmation {
    readonly title: string;
    readonly description: string;
    readonly action: string;
    readonly run: () => Promise<void>;
}
/** A short message shown after an action. */
export interface Notice {
    readonly text: string;
    readonly success: boolean;
    readonly sequence: number;
}
/** Everything the page, menu item, and dialogs read. */
export interface CleanupSnapshot {
    state: ArchiveCleanupState | null;
    confirmation: Confirmation | null;
    notice: Notice | null;
}
/** The Host calls this model needs. */
export interface CleanupRemote {
    state(): Promise<ArchiveCleanupState>;
    setRetention(days: number | null): Promise<DeleteResult>;
    deleteSessions(sessionIds: readonly string[]): Promise<DeleteResult>;
    restoreSessions(sessionIds: readonly string[]): Promise<RestoreResult>;
}
/** Owns the snapshot and turns Host results into notices. */
export declare class CleanupModel {
    private readonly remote;
    private readonly t;
    readonly store: SnapshotStore<CleanupSnapshot>;
    private sequence;
    constructor(remote: CleanupRemote, t: (key: string, vars?: Record<string, unknown>) => string);
    /** Re-read the archive view from the Host. */
    refresh(): Promise<void>;
    /**
     * Show a confirmation; nothing happens until the user confirms.
     * @param confirmation - copy and the action to run on confirm.
     */
    ask(confirmation: Confirmation): void;
    /** Close the confirmation without acting. */
    dismiss(): void;
    /** Clear the notice. */
    clearNotice(): void;
    /**
     * Permanently delete archived Sessions and report the outcome.
     * @param sessionIds - archived Sessions.
     */
    delete(sessionIds: readonly string[]): Promise<void>;
    /**
     * Change the retention period (which may delete expired Sessions) and report the outcome.
     * @param days - new period, or `null` for never.
     */
    setRetention(days: number | null): Promise<void>;
    /**
     * Restore archived Sessions and report the outcome.
     * @param sessionIds - archived Sessions.
     */
    restore(sessionIds: readonly string[]): Promise<void>;
    /**
     * Show a notice.
     * @param text - message.
     * @param success - whether to use the success tone.
     */
    notify(text: string, success: boolean): void;
    private report;
}
//# sourceMappingURL=model.d.ts.map