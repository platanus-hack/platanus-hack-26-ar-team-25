import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/queries', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/lib/server/auth', () => ({
  requireUserId: vi.fn(),
}))

import { GET, PATCH } from '@/app/api/profile/route'
import * as queries from '@/lib/db/queries'
import * as auth from '@/lib/server/auth'

function jsonRequest(method: string, body?: unknown): Request {
  return new Request('http://test/local', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const USER_ID = '00000000-0000-4000-8000-000000000123'

const seed = {
  userId: USER_ID,
  preferredFormat: 'text' as const,
  activeHours: [] as string[],
  recurringMistakes: [] as string[],
  averageFriction: 50,
  updatedAt: new Date(),
}

describe('Profile routes (Drizzle)', () => {
  beforeEach(() => {
    vi.mocked(queries.getProfile).mockReset()
    vi.mocked(queries.updateProfile).mockReset()
    vi.mocked(auth.requireUserId).mockReset()
    vi.mocked(auth.requireUserId).mockResolvedValue({ userId: USER_ID })
  })

  it('GET /api/profile returns the singleton wrapped', async () => {
    vi.mocked(queries.getProfile).mockResolvedValue(seed)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.userId).toBe(USER_ID)
    expect(vi.mocked(queries.getProfile)).toHaveBeenCalledWith(USER_ID)
  })

  it('PATCH /api/profile merges fields and returns 200', async () => {
    vi.mocked(queries.updateProfile).mockResolvedValue({ ...seed, preferredFormat: 'audio' as const })
    const res = await PATCH(jsonRequest('PATCH', { preferredFormat: 'audio' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profile.preferredFormat).toBe('audio')
    expect(vi.mocked(queries.updateProfile)).toHaveBeenCalledWith(USER_ID, { preferredFormat: 'audio' })
  })

  it('GET /api/profile returns 401 without a verified user', async () => {
    vi.mocked(auth.requireUserId).mockResolvedValue({
      response: Response.json({ error: 'unauthorized' }, { status: 401 }) as never,
    })

    const res = await GET()
    expect(res.status).toBe(401)
    expect(vi.mocked(queries.getProfile)).not.toHaveBeenCalled()
  })

  it('PATCH /api/profile returns 400 on invalid format', async () => {
    const res = await PATCH(jsonRequest('PATCH', { preferredFormat: 'invalid' }))
    expect(res.status).toBe(400)
    expect(vi.mocked(queries.updateProfile)).not.toHaveBeenCalled()
  })

  it('PATCH /api/profile returns 400 on extra fields (strict)', async () => {
    const res = await PATCH(jsonRequest('PATCH', { id: 'hacked' }))
    expect(res.status).toBe(400)
    expect(vi.mocked(queries.updateProfile)).not.toHaveBeenCalled()
  })
})
