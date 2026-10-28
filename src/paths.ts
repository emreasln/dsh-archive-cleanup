/** The safety rule for what a permanent delete may remove from disk. */

import { basename, dirname, isAbsolute, join, relative } from 'node:path'

/**
 * Mirror of the JSONL backend's path-segment encoding
 * (`packages/session/session-persistence-jsonl/src/format.ts`): the folder name a
 * Session id is stored under.
 * @param raw - the Session id.
 * @returns the encoded folder name.
 */
export function encodeSegment(raw: string): string {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

/**
 * Mirror of the JSONL backend's project folder name for a working directory.
 * @param cwd - the Session's project directory.
 * @returns a single filesystem-safe folder name.
 */
export function projectKey(cwd: string): string {
  if (cwd.length === 0) throw new Error('cannot encode an empty project path')
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const code = cwd.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

/**
 * Mirror of the JSONL backend's folder for one Session, for DSH versions whose
 * `stat()` does not report the stored file's location.
 * @param root - the Session storage root.
 * @param cwd - the Session's project directory, if any.
 * @param id - the Session id.
 * @returns the Session's folder.
 */
export function sessionDir(root: string, cwd: string | undefined, id: string): string {
  return join(root, cwd === undefined ? '_no-cwd' : projectKey(cwd), encodeSegment(id))
}

/**
 * Whether `child` is `parent` itself or lies inside it.
 * @param parent - absolute directory.
 * @param child - absolute path.
 * @returns true when `child` is within `parent`.
 */
export function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

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
export function unsafeReason(dir: string, sessionId: string, sessionsRoot: string, workspacePaths: readonly string[]): string | null {
  if (relative(dirname(dirname(dir)), sessionsRoot) !== '') return `"${dir}" is not inside the Session storage folder "${sessionsRoot}"`
  if (basename(dir) !== encodeSegment(sessionId)) return `"${dir}" does not belong to Session ${sessionId}`
  const workspace = workspacePaths.find(path => isWithin(dir, path))
  if (workspace !== undefined) return `"${dir}" contains the Workspace folder "${workspace}"`
  return null
}
