/**
 * Archive Cleanup, browser half: a "Delete permanently" row in an archived
 * Session's ⋯ menu, the Settings → Archived sessions page, and the confirmation
 * dialog every destructive action goes through.
 */
import type { Context } from '@deepseek-ai/cordis';
import { en } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Archive Cleanup copy. */
        'archiveCleanup': keyof typeof en;
    }
}
/** Services used by the browser half. */
export declare const inject: string[];
/**
 * Mount this plugin's Remote namespace, then activate the UI once it is available.
 * @param ctx - browser plugin context.
 * @returns the namespace disposer.
 */
export declare function apply(ctx: Context): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map