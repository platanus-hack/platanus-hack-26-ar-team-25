import { NextResponse } from 'next/server'
import { getSubject, listProgressForSubject } from '@/lib/db/queries'
import { requireUserId } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserId()
  if (auth.response) return auth.response

  const { id } = await params
  const subject = await getSubject(auth.userId, id)
  if (!subject) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const progress = await listProgressForSubject(auth.userId, id)
  return NextResponse.json({ progress })
}
