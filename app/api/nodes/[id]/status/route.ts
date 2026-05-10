import { NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertNodeProgress } from '@/lib/db/queries'
import { requireUserId } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

const PatchStatusSchema = z.object({
  status: z.enum(['locked', 'available', 'in_progress', 'mastered']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserId()
  if (auth.response) return auth.response

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = PatchStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const progress = await upsertNodeProgress(auth.userId, id, parsed.data.status)
  if (!progress) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ progress })
}
