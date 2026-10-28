import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeSegment, isWithin, projectKey, sessionDir, unsafeReason } from '../src/paths.ts'

// The JSONL backend's own encoder, so this mirror cannot silently drift. Only
// present when the tests run inside a DeepSeek Harness checkout.
const upstream = await import('../../../session/session-persistence-jsonl/src/format.ts').catch(() => undefined)

describe('encodeSegment', () => {
  const samples = ['session-1b2c3d4e-0000-4000-8000-000000000000', 'a b', '.', '..', 'ü~x', 'C:\\Users\\A B']

  it('keeps safe characters and escapes the rest', () => {
    expect(encodeSegment('session-abc_1.2')).toBe('session-abc_1.2')
    expect(encodeSegment('a b')).toBe('a~0020b')
    expect(encodeSegment('..')).toBe('~002E~002E')
  })

  it.runIf(upstream !== undefined)('matches the JSONL backend', () => {
    for (const sample of samples) expect(encodeSegment(sample)).toBe(upstream!.encodeSegment(sample))
  })
})

describe('sessionDir', () => {
  const cwds = ['C:\\Users\\A B\\proj', '/Users/a/proj', '/', 'ü/x~y', '//server/share/x']

  it('places a Session without a working directory under _no-cwd', () => {
    expect(sessionDir(join('/', 'r'), undefined, 'session-1')).toBe(join('/', 'r', '_no-cwd', 'session-1'))
  })

  it('turns separators into single dashes', () => {
    expect(projectKey('C:\\Users\\A B\\proj')).toBe('--C-Users-A~0020B-proj--')
  })

  it.runIf(upstream !== undefined)('matches the JSONL backend', () => {
    for (const cwd of cwds) {
      expect(projectKey(cwd)).toBe(upstream!.projectKey(cwd))
      expect(sessionDir('/root', cwd, 'session-1')).toBe(upstream!.sessionDir('/root', cwd, 'session-1' as never))
    }
  })
})

describe('isWithin', () => {
  it('accepts the folder itself and its children only', () => {
    const root = join('/', 'home', 'u')
    expect(isWithin(root, root)).toBe(true)
    expect(isWithin(root, join(root, 'project'))).toBe(true)
    expect(isWithin(root, join('/', 'home', 'u2'))).toBe(false)
    expect(isWithin(join(root, 'project'), root)).toBe(false)
  })
})

describe.each([
  ['Windows', 'C:\\Users\\A B\\.dsh\\sessions', 'C:\\Users\\A B\\proj'],
  ['POSIX', '/Users/a/.dsh/sessions', '/Users/a/proj'],
])('unsafeReason on %s paths', (_name, sessionsRoot, project) => {
  const id = 'session-1'
  const dir = join(sessionsRoot, '--project--', id)

  it.runIf(sessionsRoot.startsWith('/') === (process.platform !== 'win32'))('allows a session folder inside the storage root', () => {
    expect(unsafeReason(dir, id, sessionsRoot, [project])).toBeNull()
  })

  it.runIf(sessionsRoot.startsWith('/') === (process.platform !== 'win32'))('refuses folders outside the storage root or at the wrong depth', () => {
    expect(unsafeReason(join(project, '--project--', id), id, sessionsRoot, [])).toMatch(/not inside/)
    expect(unsafeReason(join(sessionsRoot, id), id, sessionsRoot, [])).toMatch(/not inside/)
    expect(unsafeReason(join(sessionsRoot, 'a', 'b', id), id, sessionsRoot, [])).toMatch(/not inside/)
  })

  it.runIf(sessionsRoot.startsWith('/') === (process.platform !== 'win32'))('refuses a folder named for another session', () => {
    expect(unsafeReason(join(sessionsRoot, '--project--', 'session-2'), id, sessionsRoot, [])).toMatch(/does not belong/)
  })

  it.runIf(sessionsRoot.startsWith('/') === (process.platform !== 'win32'))('refuses a folder that is or contains a workspace folder', () => {
    expect(unsafeReason(dir, id, sessionsRoot, [dir])).toMatch(/contains the Workspace/)
    expect(unsafeReason(dir, id, sessionsRoot, [join(dir, 'nested')])).toMatch(/contains the Workspace/)
  })
})
