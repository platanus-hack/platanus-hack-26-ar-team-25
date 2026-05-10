import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  schema: {
    profiles: { userId: 'profiles.userId' },
    preferredFormat: { enumValues: ['text', 'audio', 'video', 'visual', 'podcast'] },
  },
}))

import { getProfile, updateProfile } from '../queries'
import * as clientModule from '../client'

type MockedFn = ReturnType<typeof vi.fn>
const mockDb = clientModule.db as unknown as {
  select: MockedFn
  insert: MockedFn
  update: MockedFn
}

const seed = {
  userId: '00000000-0000-4000-8000-000000000123',
  preferredFormat: 'text',
  activeHours: [],
  recurringMistakes: [],
  averageFriction: 50,
  updatedAt: new Date(),
}

describe('profile queries', () => {
  const userId = seed.userId

  beforeEach(() => {
    mockDb.select.mockReset()
    mockDb.insert.mockReset()
    mockDb.update.mockReset()
  })

  it('getProfile returns the existing row', async () => {
    const limit = vi.fn().mockResolvedValue([seed])
    const where = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ where }))
    mockDb.select.mockReturnValue({ from })

    const out = await getProfile(userId)
    expect(out).toEqual(seed)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('getProfile auto-seeds when missing', async () => {
    const limit = vi.fn().mockResolvedValue([])
    const where = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ where }))
    mockDb.select.mockReturnValue({ from })

    const returning = vi.fn().mockResolvedValue([seed])
    const values = vi.fn(() => ({ returning }))
    mockDb.insert.mockReturnValue({ values })

    const out = await getProfile(userId)
    expect(out).toEqual(seed)
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('updateProfile merges fields and returns the updated row', async () => {
    const limit = vi.fn().mockResolvedValue([seed])
    const where1 = vi.fn(() => ({ limit }))
    const from1 = vi.fn(() => ({ where: where1 }))
    mockDb.select.mockReturnValue({ from: from1 })

    const returning = vi.fn().mockResolvedValue([{ ...seed, preferredFormat: 'audio' }])
    const where2 = vi.fn(() => ({ returning }))
    const set = vi.fn(() => ({ where: where2 }))
    mockDb.update.mockReturnValue({ set })

    const out = await updateProfile(userId, { preferredFormat: 'audio' })
    expect(out.preferredFormat).toBe('audio')
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ preferredFormat: 'audio', updatedAt: expect.any(Date) }),
    )
  })
})
