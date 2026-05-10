import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireUserId(): Promise<
  { userId: string; response?: never } | { userId?: never; response: NextResponse }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return {
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  return { userId: data.user.id }
}
