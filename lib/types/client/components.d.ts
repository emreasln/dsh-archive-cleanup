import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CleanupSnapshot } from './model.ts';
/** What the plugin hands every component. */
export interface CleanupInjected {
    hooks: {
        cleanup: ObservableSnapshot<CleanupSnapshot>;
    };
    requestDeleteSession(sessionId: string, title: string | null): void;
    requestDeleteGroup(sessionIds: readonly string[], title: string): void;
    requestDeleteAll(): void;
    requestRetention(days: number | null): void;
    restore(sessionIds: readonly string[]): void;
    refresh(): void;
    dismiss(): void;
    clearNotice(): void;
}
type Face = InjectFace<CleanupInjected> & PropsLocale<'archiveCleanup'>;
/**
 * Session ⋯ menu row: "Delete permanently", shown only for archived Sessions.
 * @param props - owner share, menu state, archive set, and plugin face.
 * @returns the row, or nothing for a Session that is not archived.
 */
export declare function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useWorkspaces, requestDeleteSession, t, }: PropsRuntime<'sidebar.workspaces.session.menu.item'> & Face): import("react").JSX.Element | null;
/**
 * The `shell.overlay` entry: the pending confirmation and the latest notice.
 * @param props - plugin face.
 * @returns the dialog and toast, or nothing.
 */
export declare function CleanupOverlay({ useCleanup, dismiss, clearNotice, t }: PropsRuntime<'shell.overlay'> & Face): import("react").JSX.Element;
/**
 * Settings → Archived sessions: the retention choice, Delete all, and archived
 * Sessions grouped by Workspace like the sidebar.
 * @param props - archive view, Workspace and Session lists, and plugin face.
 * @returns the page.
 */
export declare function ArchivedSessionsPage({ useCleanup, useWorkspaces, useSessions, requestDeleteSession, requestDeleteGroup, requestDeleteAll, requestRetention, restore, refresh, t, }: PropsRuntime<'settings.section'> & Face): import("react").JSX.Element;
export {};
//# sourceMappingURL=components.d.ts.map