import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deletesAt, emptyState, expiredIds, loadState, saveState, syncArchived, type StoreState } from '../src/store.ts'

const DAY = 86_400_000
const NOW = 1_800_000_000_000

function state(overrides: Partial<StoreState> = {}): StoreState {
  return { ...emptyState(), ...overrides }
}

describe('syncArchived', () => {
  it('records newly archived sessions at the current time', () => {
    const result = syncArchived(state(), ['a'], NOW)
    expect(result.changed).toBe(true)
    expect(result.state.archived).toEqual({ a: { archivedAt: NOW, archivedBy: 'user' } })
  })

  it('keeps the original time of sessions it already tracks', () => {
    const before = state({ archived: { a: { archivedAt: NOW - 5 * DAY, archivedBy: 'workspace-delete' } } })
    const result = syncArchived(before, ['a'], NOW)
    expect(result.changed).toBe(false)
    expect(result.state.archived.a).toEqual({ archivedAt: NOW - 5 * DAY, archivedBy: 'workspace-delete' })
  })

  it('forgets unarchived sessions, cancels their pending delete, and trims deleted-workspace snapshots', () => {
    const before = state({
      archived: { a: { archivedAt: NOW, archivedBy: 'user' }, b: { archivedAt: NOW, archivedBy: 'user' } },
      deletedWorkspaces: [
        { key: 'w1', path: '/p1', title: 'one', sessionIds: ['a', 'b'], deletedAt: NOW },
        { key: 'w2', path: '/p2', title: 'two', sessionIds: ['b'], deletedAt: NOW },
      ],
      pendingDelete: ['b'],
    })
    const result = syncArchived(before, ['a'], NOW)
    expect(result.changed).toBe(true)
    expect(Object.keys(result.state.archived)).toEqual(['a'])
    expect(result.state.deletedWorkspaces).toEqual([{ key: 'w1', path: '/p1', title: 'one', sessionIds: ['a'], deletedAt: NOW }])
    expect(result.state.pendingDelete).toEqual([])
  })

  it('does not mutate its input', () => {
    const before = state()
    syncArchived(before, ['a'], NOW)
    expect(before.archived).toEqual({})
  })
})

describe('retention', () => {
  it('never deletes when retention is off', () => {
    const s = state({ archived: { a: { archivedAt: 0, archivedBy: 'user' } } })
    expect(deletesAt(s.archived.a!, null)).toBeNull()
    expect(expiredIds(s, NOW)).toEqual([])
  })

  it('deletes only sessions whose own period has elapsed, oldest first', () => {
    const s = state({
      retentionDays: 5,
      archived: {
        fresh: { archivedAt: NOW - 4 * DAY, archivedBy: 'user' },
        exact: { archivedAt: NOW - 5 * DAY, archivedBy: 'user' },
        old: { archivedAt: NOW - 9 * DAY, archivedBy: 'workspace-delete' },
      },
    })
    expect(expiredIds(s, NOW)).toEqual(['old', 'exact'])
  })

  it('computes the deletion time from the archive time', () => {
    expect(deletesAt({ archivedAt: NOW, archivedBy: 'user' }, 7)).toBe(NOW + 7 * DAY)
  })
})

describe('state file', () => {
  it('returns undefined before the first save and round-trips afterwards', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'archive-cleanup-'))
    try {
      const file = join(dir, 'state.json')
      expect(await loadState(file)).toBeUndefined()
      const s = state({ retentionDays: 30, archived: { a: { archivedAt: NOW, archivedBy: 'user' } }, pendingDelete: ['a'] })
      await saveState(file, s)
      expect(await loadState(file)).toEqual(s)
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(s)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('fills fields missing from an older file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'archive-cleanup-'))
    try {
      const file = join(dir, 'state.json')
      await saveState(file, { version: 1, retentionDays: 3, archived: {}, deletedWorkspaces: [] } as unknown as StoreState)
      expect((await loadState(file))?.pendingDelete).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
