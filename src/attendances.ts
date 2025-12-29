import { Hono } from 'hono'
import { supabaseAdmin } from './supabaseClient.js';
import { createErrorResponse, ErrorCodes } from './types/responses.js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const AVATAR_BUCKET = process.env.STUDENT_AVATAR_BUCKET ?? 'student-avatars'
const SIGNED_URL_TTL = Number(process.env.STUDENT_AVATAR_SIGNED_URL_TTL ?? 3600)
const QR_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret';

const attendanceSchema = z.object({
  status: z.enum(['HADIR', 'IZIN', 'SAKIT', 'ALFA']),
});

export function setupAttendanceRoutes(app: Hono) {
  app.post('/absen/qr', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, "Authorization header with Bearer token is required"), 401);
    }
    const accessToken = authHeader.substring(7);

    // 1. Authenticate Student
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData || !userData.user) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Invalid token or user not found"), 401);
    }

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, kelas')
      .eq('user_id', userData.user.id)
      .single();

    if (studentError || !studentData) {
      return c.json(createErrorResponse(ErrorCodes.STUDENT_NOT_LINKED, "Student not linked to this user"), 404);
    }

    // 2. Parse and Verify QR Token
    let body;
    try {
        body = await c.req.json();
    } catch {
        return c.json(createErrorResponse(ErrorCodes.INVALID_JSON, "Invalid JSON body"), 400);
    }
    const { token } = body;
    if (!token) {
        return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, "Token is required"), 400);
    }

    let payload: any;
    try {
        payload = jwt.verify(token, QR_SECRET);
    } catch (e) {
        return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Invalid or expired QR token"), 401);
    }

    if (payload.type !== 'qr-attendance') {
        return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Invalid token type"), 401);
    }

    // 3. Optional: Verify Class Match
    if (payload.class_id && Number(payload.class_id) !== Number(studentData.kelas)) {
        return c.json(createErrorResponse(ErrorCodes.FORBIDDEN, "This QR code is for a different class"), 403);
    }

    // 4. Record Attendance
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    
    // Check existing
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('attendances')
      .select('id')
      .eq('student_id', studentData.id)
      .eq('date', today)
      .limit(1);
      
    if (existingError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, existingError.message), 500);
    if (existing && existing.length > 0) {
      return c.json(createErrorResponse(ErrorCodes.ATTENDANCE_ALREADY_EXISTS, "Attendance already recorded for today", { date: today }), 409);
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('attendances')
      .insert([{ student_id: studentData.id, date: today, status: 'HADIR' }]) // QR Scan implies Present
      .select()
      .limit(1);

    if (insertError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, insertError.message), 500);

    return c.json({ message: 'Attendance recorded via QR', attendance: inserted?.[0] ?? null }, 201);
  });

  app.post('/absen', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, "Authorization header with Bearer token is required"), 401);
    }
    const accessToken = authHeader.substring(7);

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData || !userData.user) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Invalid token or user not found"), 401);
    }

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (studentError || !studentData) {
      return c.json(createErrorResponse(ErrorCodes.STUDENT_NOT_LINKED, "Student not linked to this user"), 404);
    }

    let status: string | null = null;
    try {
      const body = await c.req.json();
      const validated = attendanceSchema.parse(body);
      status = validated.status;
    } catch (e) {
      const url = new URL(c.req.url);
      status = url.searchParams.get('status');
      if (status) {
        try {
          const validated = attendanceSchema.parse({ status: status.toUpperCase() });
          status = validated.status;
        } catch {
          return c.json(createErrorResponse(ErrorCodes.INVALID_STATUS, "Invalid status. Allowed: HADIR, IZIN, SAKIT, ALFA"), 400);
        }
      } else {
        return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, "Status is required (body or ?status=)"), 400);
      }
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('attendances')
      .select('id')
      .eq('student_id', studentData.id)
      .eq('date', today)
      .limit(1);
    if (existingError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, existingError.message), 500);
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return c.json(createErrorResponse(ErrorCodes.ATTENDANCE_ALREADY_EXISTS, "Attendance already recorded for today", { date: today }), 409);
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('attendances')
      .insert([{ student_id: studentData.id, date: today, status: status }])
      .select()
      .limit(1);

    if (insertError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, insertError.message), 500);

    return c.json({ message: 'Attendance recorded', attendance: inserted?.[0] ?? null }, 201);
  });

  app.get('/today-status', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: "Authorization header with Bearer token is required" }, 401);
    }
    const accessToken = authHeader.substring(7);

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData || !userData.user) {
      return c.json({ error: "Invalid token or user not found" }, 401);
    }

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (studentError || !studentData) {
      return c.json({ error: "Student not linked to this user" }, 404);
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from('attendances')
      .select('*')
      .eq('student_id', studentData.id)
      .eq('date', today)
      .single();

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      return c.json({ error: attendanceError.message }, 500);
    }

    return c.json({
      has_attendance: !!attendance,
      attendance: attendance ?? null
    });
  });

  app.get('/students', async (c) => {
    const { data, error } = await supabaseAdmin.from('students').select('*, class(class_name)')
    if (error) return c.json({ error: error.message }, 400)

    if (!data || data.length === 0) {
      return c.json([])
    }

    const hydrated = await Promise.all(
      data.map(async (student) => {
        const avatarPath = (student as any).avatar_path as string | null | undefined
        if (!avatarPath || !AVATAR_BUCKET) {
          return { ...student, avatar_url: null }
        }

        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(avatarPath, SIGNED_URL_TTL)

        if (signedError || !signed) {
          return { ...student, avatar_url: null }
        }

        return { ...student, avatar_url: signed.signedUrl }
      }),
    )

    return c.json(hydrated)
  })
}
