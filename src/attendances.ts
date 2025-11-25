import { Hono } from 'hono'
import { supabase, supabaseAdmin } from './supabaseClient.js';
import { createErrorResponse, ErrorCodes } from './types/responses.js';
import { z } from 'zod';

const attendanceSchema = z.object({
  status: z.enum(['HADIR', 'IZIN', 'SAKIT', 'ALFA']),
});

export function setupAttendanceRoutes(app: Hono) {
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

    const { data: studentData, error: studentError } = await supabase
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
    const { data: existing, error: existingError } = await supabase
      .from('attendances')
      .select('id')
      .eq('student_id', studentData.id)
      .eq('date', today)
      .limit(1);
    if (existingError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, existingError.message), 500);
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return c.json(createErrorResponse(ErrorCodes.ATTENDANCE_ALREADY_EXISTS, "Attendance already recorded for today", { date: today }), 409);
    }

    const { data: inserted, error: insertError } = await supabase
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

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (studentError || !studentData) {
      return c.json({ error: "Student not linked to this user" }, 404);
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const { data: attendance, error: attendanceError } = await supabase
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
    const { data, error } = await supabase.from('students').select('*, class(class_name)')
    if (error) return c.json({ error: error.message }, 400)
    return c.json(data)
  })
}
