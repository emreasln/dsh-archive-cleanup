/** The safety rule for what a permanent delete may remove from disk. */
/**
 * Mirror of the JSONL backend's path-segment encoding
 * (`packages/session/session-persistence-jsonl/src/format.ts`): the folder name a
 * Session id is stored under.
 * @param raw - the Session id.
 * @returns the encoded folder name.
 */
export declare function encodeSegment(raw: string): string;
/**
 * Mirror of the JSONL backend's project folder name for a working directory.
 * @param cwd - the Session's project directory.
 * @returns a single filesystem-safe folder name.
 */
export declare function projectKey(cwd: string): string;
/**
 * Mirror of the JSONL backend's folder for one Session, for DSH versions whose
 * `stat()` does not report the stored file's location.
 * @param root - the Session storage root.
 * @param cwd - the Session's project directory, if any.
 * @param id - the Session id.
 * @returns the Session's folder.
 */
export declare function sessionDir(root: string, cwd: string | undefined, id: string): string;
/**
 * Whether `child` is `parent` itself or lies inside it.
 * @param parent - absolute directory.
 * @param child - absolute path.
 * @returns true when `child` is within `parent`.
 */
export declare function isWithin(parent: string, child: string): boolean;
/**
 * Decide whether a Session folder may be removed. All paths must already be
 * resolved real paths. The folder must sit exactly at
 * `<sessionsRoot>/<project>/<encoded id>`, and no Workspace folder may be the
 * Session folder or lie inside it, so a project folder can never be removed.
 * @param dir - the Session's folder.
 * @param sessionId - the Session id the folder must belong to.
 * @param sessionsRoot - the Session storage root.
 * @param workspacePaths - every registered Workspace folder.
 * @returns `null` when safe, otherwise the reason it is not.
 */
export declare function unsafeReason(dir: string, sessionId: string, sessionsRoot: string, workspacePaths: readonly string[]): string | null;
//# sourceMappingURL=paths.d.ts.map