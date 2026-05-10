import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listSubjects, createSubject } from '@/lib/db/queries'
import { requireUserId } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireUserId()
  if (auth.response) return auth.response

  const subjects = await listSubjects(auth.userId)
  return NextResponse.json({ subjects })
}

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullish(),
})

export async function POST(req: Request) {
  const auth = await requireUserId()
  if (auth.response) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const subject = await createSubject(auth.userId, parsed.data)
  return NextResponse.json({ subject }, { status: 201 })
}
