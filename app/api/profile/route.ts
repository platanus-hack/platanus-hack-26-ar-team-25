import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfile, updateProfile } from '@/lib/db/queries'
import { requireUserId } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

const UpdateProfileSchema = z
  .object({
    preferredFormat: z.enum(['text', 'audio', 'video', 'visual', 'podcast']).optional(),
    activeHours: z.array(z.string()).optional(),
    recurringMistakes: z.array(z.string()).optional(),
    averageFriction: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .partial()

export async function GET() {
  const auth = await requireUserId()
  if (auth.response) return auth.response

  const profile = await getProfile(auth.userId)
  return NextResponse.json({ profile })
}

export async function PATCH(req: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const profile = await updateProfile(auth.userId, parsed.data)
  return NextResponse.json({ profile })
}
