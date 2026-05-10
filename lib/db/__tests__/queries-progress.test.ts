import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  schema: {
    progress: {
      userId: 'progress.userId',
      nodeId: 'progress.nodeId',
      id: 'progress.id',
      status: 'progress.status',
      completedAt: 'progress.completedAt',
      updatedAt: 'progress.updatedAt',
    },
    nodes: { id: 'nodes.id', subjectId: 'nodes.subjectId' },
    subjects: { id: 'subjects.id', userId: 'subjects.userId' },
    progressStatus: { enumValues: ['locked', 'available', 'in_progress', 'mastered'] },
  },
}))

import {
  listProgressForSubject,
  summarizeProgressForSubject,
  upsertNodeProgress,
} from '../queries'
import * as clientModule from '../client'

type MockedFn = ReturnType<typeof vi.fn>
const mockDb = clientModule.db as unknown as {
  select: MockedFn
  insert: MockedFn
  update: MockedFn
}

describe('progress queries', () => {
  const userId = '00000000-0000-4000-8000-000000000123'

  beforeEach(() => {
    mockDb.select.mockReset()
    mockDb.insert.mockReset()
    mockDb.update.mockReset()
  })

  it('listProgressForSubject builds a join + filter query and returns rows', async () => {
    const rows = [{ id: 'p1', nodeId: 'n1', status: 'mastered', completedAt: new Date(), updatedAt: new Date() }]
    const where = vi.fn().mockResolvedValue(rows)
    const innerJoin = vi.fn(() => ({ where }))
    const from = vi.fn(() => ({ innerJoin }))
    mockDb.select.mockReturnValue({ from })

    const out = await listProgressForSubject(userId, 'subject-1')
    expect(out).toEqual(rows)
    expect(mockDb.select).toHaveBeenCalled()
    expect(from).toHaveBeenCalled()
    expect(innerJoin).toHaveBeenCalled()
  })

  it('summarizeProgressForSubject computes counts and percent', async () => {
    const rows = [
      { id: '1', nodeId: 'n1', status: 'mastered', completedAt: null, updatedAt: new Date() },
      { id: '2', nodeId: 'n2', status: 'mastered', completedAt: null, updatedAt: new Date() },
      { id: '3', nodeId: 'n3', status: 'in_progress', completedAt: null, updatedAt: new Date() },
      { id: '4', nodeId: 'n4', status: 'available', completedAt: null, updatedAt: new Date() },
    ]
    const where = vi.fn().mockResolvedValue(rows)
    const innerJoin = vi.fn(() => ({ where }))
    const from = vi.fn(() => ({ innerJoin }))
    mockDb.select.mockReturnValue({ from })

    const summary = await summarizeProgressForSubject(userId, 'subject-1')
    expect(summary).toEqual({
      total: 4,
      mastered: 2,
      inProgress: 1,
      available: 1,
      locked: 0,
      percentMastered: 50,
    })
  })

  it('summarizeProgressForSubject returns 0% when no rows', async () => {
    const where = vi.fn().mockResolvedValue([])
    const innerJoin = vi.fn(() => ({ where }))
    const from = vi.fn(() => ({ innerJoin }))
    mockDb.select.mockReturnValue({ from })

    const summary = await summarizeProgressForSubject(userId, 'subject-1')
    expect(summary.total).toBe(0)
    expect(summary.percentMastered).toBe(0)
  })

  it("upsertNodeProgress sets completedAt when status is 'mastered'", async () => {
    const returning = vi.fn().mockResolvedValue([
      { id: 'p1', userId, nodeId: 'n1', status: 'mastered', completedAt: new Date(), updatedAt: new Date() },
    ])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    const values = vi.fn(() => ({ onConflictDoUpdate }))
    mockDb.insert.mockReturnValue({ values })
    const limit = vi.fn().mockResolvedValue([{ id: 'n1' }])
    const where = vi.fn(() => ({ limit }))
    const innerJoin = vi.fn(() => ({ where }))
    const from = vi.fn(() => ({ innerJoin }))
    mockDb.select.mockReturnValue({ from })

    const out = await upsertNodeProgress(userId, 'n1', 'mastered')
    if (!out) throw new Error('expected progress row')
    expect(out.status).toBe('mastered')
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId, nodeId: 'n1', status: 'mastered', completedAt: expect.any(Date) }),
    )
  })

  it("upsertNodeProgress nulls completedAt when leaving 'mastered'", async () => {
    const returning = vi.fn().mockResolvedValue([
      { id: 'p1', userId, nodeId: 'n1', status: 'in_progress', completedAt: null, updatedAt: new Date() },
    ])
    const onConflictDoUpdate = vi.fn(() => ({ returning }))
    const values = vi.fn(() => ({ onConflictDoUpdate }))
    mockDb.insert.mockReturnValue({ values })
    const limit = vi.fn().mockResolvedValue([{ id: 'n1' }])
    const where = vi.fn(() => ({ limit }))
    const innerJoin = vi.fn(() => ({ where }))
    const from = vi.fn(() => ({ innerJoin }))
    mockDb.select.mockReturnValue({ from })

    await upsertNodeProgress(userId, 'n1', 'in_progress')
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ userId, nodeId: 'n1', status: 'in_progress', completedAt: null }),
    )
  })

  it('upsertNodeProgress returns null when the user does not own the node', async () => {
    const limit = vi.fn().mockResolvedValue([])
    const where = vi.fn(() => ({ limit }))
    const innerJoin = vi.fn(() => ({ where }))
    const from = vi.fn(() => ({ innerJoin }))
    mockDb.select.mockReturnValue({ from })

    const out = await upsertNodeProgress(userId, 'n1', 'mastered')
    expect(out).toBeNull()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})
