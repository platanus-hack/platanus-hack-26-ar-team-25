import { eq, desc, and } from 'drizzle-orm'
import { db, schema } from './client'

// Server-side reads/writes use the service-role connection (bypassing RLS).
// Callers must pass a user id returned by requireUserId(), not request input.
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

export async function listSubjects(userId: string) {
  return db
    .select()
    .from(schema.subjects)
    .where(eq(schema.subjects.userId, userId))
    .orderBy(desc(schema.subjects.createdAt))
}

export async function createSubject(
  userId: string,
  input: { name: string; description?: string | null },
) {
  const [row] = await db
    .insert(schema.subjects)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
    })
    .returning()
  return row
}

export async function getSubject(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(schema.subjects)
    .where(and(eq(schema.subjects.id, id), eq(schema.subjects.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function listFilesForSubject(userId: string, subjectId: string) {
  return db
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.subjectId, subjectId), eq(schema.files.userId, userId)))
    .orderBy(desc(schema.files.createdAt))
}

export async function insertPendingFile(input: {
  userId: string
  subjectId: string
  s3Key: string
  originalFilename: string
  mimeType: string
  fileType: typeof schema.fileType.enumValues[number]
  sizeBytes: number
}) {
  const [row] = await db
    .insert(schema.files)
    .values({
      subjectId: input.subjectId,
      userId: input.userId,
      s3Key: input.s3Key,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileType: input.fileType,
      sizeBytes: input.sizeBytes,
      status: 'pending',
    })
    .returning()
  return row
}

// --- Progress ---

export async function listProgressForSubject(userId: string, subjectId: string) {
  return db
    .select({
      id: schema.progress.id,
      nodeId: schema.progress.nodeId,
      status: schema.progress.status,
      completedAt: schema.progress.completedAt,
      updatedAt: schema.progress.updatedAt,
    })
    .from(schema.progress)
    .innerJoin(schema.nodes, eq(schema.nodes.id, schema.progress.nodeId))
    .where(
      and(
        eq(schema.progress.userId, userId),
        eq(schema.nodes.subjectId, subjectId),
      ),
    )
}

export interface ProgressSummary {
  total: number
  mastered: number
  inProgress: number
  available: number
  locked: number
  percentMastered: number
}

export async function summarizeProgressForSubject(
  userId: string,
  subjectId: string,
): Promise<ProgressSummary> {
  const rows = await listProgressForSubject(userId, subjectId)
  const counts = {
    total: rows.length,
    mastered: rows.filter((r) => r.status === 'mastered').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    available: rows.filter((r) => r.status === 'available').length,
    locked: rows.filter((r) => r.status === 'locked').length,
  }
  const percentMastered =
    counts.total === 0 ? 0 : Math.round((counts.mastered / counts.total) * 100)
  return { ...counts, percentMastered }
}

export async function upsertNodeProgress(
  userId: string,
  nodeId: string,
  status: typeof schema.progressStatus.enumValues[number],
) {
  const [node] = await db
    .select({ id: schema.nodes.id })
    .from(schema.nodes)
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.nodes.subjectId))
    .where(and(eq(schema.nodes.id, nodeId), eq(schema.subjects.userId, userId)))
    .limit(1)
  if (!node) return null

  const completedAt = status === 'mastered' ? new Date() : null
  const [row] = await db
    .insert(schema.progress)
    .values({
      userId,
      nodeId,
      status,
      completedAt,
    })
    .onConflictDoUpdate({
      target: [schema.progress.userId, schema.progress.nodeId],
      set: {
        status,
        completedAt,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

// --- Profile ---

export async function getProfile(userId: string) {
  const [row] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1)
  if (row) return row

  // Auto-seed the singleton on first read.
  const [seed] = await db
    .insert(schema.profiles)
    .values({ userId })
    .returning()
  return seed
}

export async function updateProfile(
  userId: string,
  input: {
    preferredFormat?: typeof schema.preferredFormat.enumValues[number]
    activeHours?: string[]
    recurringMistakes?: string[]
    averageFriction?: number
  },
) {
  // Ensure singleton exists
  await getProfile(userId)
  const [row] = await db
    .update(schema.profiles)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.profiles.userId, userId))
    .returning()
  return row
}
