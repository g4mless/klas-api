import { Hono } from 'hono'
import { supabase, supabaseAdmin } from './supabaseClient.js'
import { createErrorResponse, ErrorCodes } from './types/responses.js'

const AVATAR_BUCKET = process.env.STUDENT_AVATAR_BUCKET ?? 'student-avatars'
const MAX_AVATAR_SIZE_BYTES = Number(process.env.STUDENT_AVATAR_MAX_SIZE ?? 2_097_152) // ~2MB
const SIGNED_URL_TTL = Number(process.env.STUDENT_AVATAR_SIGNED_URL_TTL ?? 3600)
const ALLOWED_AVATAR_TYPES = (process.env.STUDENT_AVATAR_ALLOWED_TYPES ?? 'image/png,image/jpeg,image/jpg,image/webp')
  .split(',')
  .map((type) => type.trim().toLowerCase())
  .filter(Boolean)

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}

type UploadedFile = Blob & { name?: string }
type StudentLookupResult =
  | { student: { id: number; user_id: string | null; avatar_path: string | null } }
  | { error: ReturnType<typeof createErrorResponse>; status: number }

async function getStudentFromToken(accessToken: string): Promise<StudentLookupResult> {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return {
      error: createErrorResponse(ErrorCodes.INVALID_TOKEN, 'Invalid token or user not found'),
      status: 401,
    }
  }

  const { data: studentData, error: studentError } = await supabase
    .from('students')
    .select('id, user_id, avatar_path')
    .eq('user_id', userData.user.id)
    .single()

  if (studentError || !studentData) {
    return {
      error: createErrorResponse(ErrorCodes.STUDENT_NOT_LINKED, 'Student not linked to this user'),
      status: 404,
    }
  }

  return { student: studentData }
}

function buildAvatarPath(studentId: number, extension: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${studentId}/avatar-${timestamp}.${extension}`
}

async function createSignedAvatarUrl(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data) {
    return null
  }
  return data.signedUrl
}

export function setupStudentRoutes(app: Hono) {
  app.post('/students/profile-picture', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authorization header with Bearer token is required'),
        401,
      )
    }
    const accessToken = authHeader.substring(7)

    const studentResult = await getStudentFromToken(accessToken)
    if ('error' in studentResult) {
      return c.json(studentResult.error, studentResult.status as any)
    }
    const { student } = studentResult

    const body = await c.req.parseBody()
    const fileCandidate = body.avatar ?? body.file

    if (!fileCandidate || typeof fileCandidate === 'string') {
      return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, 'avatar file is required'), 400)
    }

    const file = fileCandidate as UploadedFile
    const mimeType = (file.type || '').toLowerCase()
    if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
      return c.json(
        createErrorResponse(
          ErrorCodes.INVALID_FILE_TYPE,
          `Invalid file type. Allowed: ${ALLOWED_AVATAR_TYPES.join(', ')}`,
        ),
        400,
      )
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return c.json(
        createErrorResponse(
          ErrorCodes.FILE_TOO_LARGE,
          `File too large. Max ${Math.floor(MAX_AVATAR_SIZE_BYTES / 1024 / 1024)}MB`,
        ),
        400,
      )
    }

    const extension = MIME_EXTENSION_MAP[mimeType] ?? 'dat'
    const objectPath = buildAvatarPath(student.id, extension)

    if (!AVATAR_BUCKET) {
      return c.json(createErrorResponse(ErrorCodes.CONFIGURATION_ERROR, 'Avatar bucket not configured'), 500)
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, file, {
        cacheControl: '3600',
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, uploadError.message), 400)
    }

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('students')
      .update({ avatar_path: objectPath })
      .eq('id', student.id)
      .select('id, avatar_path')
      .single()

    if (updateError || !updateData) {
      return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, updateError?.message ?? 'Failed to update avatar'), 400)
    }

    const signedUrl = await createSignedAvatarUrl(objectPath)

    if (student.avatar_path) {
      await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([student.avatar_path])
    }

    return c.json({
      message: 'Profile picture updated',
      avatar_path: updateData.avatar_path,
      avatar_url: signedUrl,
    })
  })

  app.get('/students/profile-picture', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authorization header with Bearer token is required'),
        401,
      )
    }
    const accessToken = authHeader.substring(7)

    const studentResult = await getStudentFromToken(accessToken)
    if ('error' in studentResult) {
      return c.json(studentResult.error, studentResult.status as any)
    }
    const { student } = studentResult

    if (!student.avatar_path) {
      return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, 'Profile picture not set'), 404)
    }

    const signedUrl = await createSignedAvatarUrl(student.avatar_path)
    if (!signedUrl) {
      return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, 'Failed to create signed URL'), 500)
    }

    return c.json({
      avatar_path: student.avatar_path,
      avatar_url: signedUrl,
      expires_in: SIGNED_URL_TTL,
    })
  })
}

export default setupStudentRoutes
