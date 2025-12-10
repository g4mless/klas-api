import { Hono } from 'hono'
import { supabase, supabaseAdmin } from './supabaseClient.js'
import { createErrorResponse, ErrorCodes } from './types/responses.js'
import jwt from 'jsonwebtoken';

const AVATAR_BUCKET = process.env.STUDENT_AVATAR_BUCKET ?? 'student-avatars'
const SIGNED_URL_TTL = Number(process.env.STUDENT_AVATAR_SIGNED_URL_TTL ?? 3600)
const QR_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret';

async function getTeacherFromToken(accessToken: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return { error: createErrorResponse(ErrorCodes.INVALID_TOKEN, 'Invalid token or user not found'), status: 401 }
  }

  const { data: teacherData, error: teacherError } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('user_id', userData.user.id)
    .single()

  if (teacherError || !teacherData) {
    return { error: createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Teacher profile not found'), status: 403 }
  }

  return { teacher: teacherData }
}

async function signAvatarUrl(avatarPath: string | null) {
  if (!avatarPath) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, SIGNED_URL_TTL)
  
  if (error || !data) return null;
  return data.signedUrl;
}

export function setupTeacherRoutes(app: Hono) {
  
  // Middleware to ensure user is a teacher
  const ensureTeacher = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Authorization header required'), 401)
    }
    const accessToken = authHeader.substring(7)
    const { error, status, teacher } = await getTeacherFromToken(accessToken)
    
    if (error) return c.json(error, status)
    
    c.set('teacher', teacher)
    await next()
  }

  const teacherGroup = new Hono()
  teacherGroup.use('*', ensureTeacher)

  // Generate QR Token
  teacherGroup.post('/qr/generate', async (c) => {
    let body;
    try {
        body = await c.req.json();
    } catch {
        return c.json(createErrorResponse(ErrorCodes.INVALID_JSON, "Invalid JSON body"), 400);
    }
    const { class_id } = body;
    if (!class_id) {
        return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, "class_id is required"), 400);
    }

    const teacher = c.get('teacher') as any;

    // Create a stateless signed token
    // Payload contains class_id and teacher info, timestamp, and a nonce (optional but good for uniqueness if needed)
    // Expires in 60 seconds (short lived)
    const payload = {
        type: 'qr-attendance',
        class_id: class_id,
        teacher_id: teacher.id,
        generated_at: Date.now(),
        nonce: Math.random().toString(36).substring(7)
    };

    const token = jwt.sign(payload, QR_SECRET, { expiresIn: '60s' });

    return c.json({
        token: token,
        expires_in: 60,
        class_id: class_id
    });
  });

  // Get all classes
  teacherGroup.get('/classes', async (c) => {
    const { data, error } = await supabase.from('class').select('*').order('class_name')
    if (error) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, error.message), 500)
    return c.json(data)
  })

  // Get today's attendance for a specific class (or all)
  teacherGroup.get('/attendances/today', async (c) => {
    const classId = c.req.query('class_id')
    
    if (!classId) {
       return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, 'class_id is required'), 400)
    }

    // 1. Get students in the class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, nisn, nama, avatar_path')
      .eq('kelas', classId)
      .order('nama')
    
    if (studentsError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, studentsError.message), 500)

    // 2. Get attendances for today
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
    const studentIds = students.map(s => s.id)
    
    let attendancesMap = new Map();
    if (studentIds.length > 0) {
        const { data: attendances, error: attendanceError } = await supabase
        .from('attendances')
        .select('student_id, status, date')
        .in('student_id', studentIds)
        .eq('date', today)

        if (attendanceError) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, attendanceError.message), 500)
        
        attendances?.forEach(a => {
            attendancesMap.set(a.student_id, a)
        })
    }

    // 3. Merge data
    const result = await Promise.all(students.map(async (s) => {
        const attendance = attendancesMap.get(s.id)
        const avatarUrl = await signAvatarUrl(s.avatar_path)
        return {
            student: {
                ...s,
                avatar_url: avatarUrl
            },
            status: attendance ? attendance.status : 'ALPHA', // Default to ALPHA or null? Usually ALPHA if not present, or just null. Let's return null if not present so frontend decides.
            is_present: !!attendance
        }
    }))

    return c.json({
        date: today,
        class_id: classId,
        students: result
    })
  })

  // Get attendance history
  teacherGroup.get('/attendances/history', async (c) => {
    const classId = c.req.query('class_id')
    const studentId = c.req.query('student_id')
    const fromDate = c.req.query('from')
    const toDate = c.req.query('to')

    let query = supabase
      .from('attendances')
      .select('*, students(nama, nisn, kelas, class(class_name))')
      .order('date', { ascending: false })

    if (studentId) {
        query = query.eq('student_id', studentId)
    }
    
    if (classId) {
        // Filter by class via students table is tricky in simple select if Supabase doesn't support deep filtering efficiently or if we rely on inner join behavior.
        // Supabase/PostgREST allows filtering on embedded resources: students!inner(kelas)
        query = query.eq('students.kelas', classId) // This might require !inner hint in the select if strictly filtering
        // Let's try explicit syntax
        // query = supabase.from('attendances').select('*, students!inner(nama, nisn, kelas, class(class_name))').eq('students.kelas', classId)
        // Re-construct query
        query = supabase
            .from('attendances')
            .select('*, students!inner(nama, nisn, kelas, class(class_name))')
            .eq('students.kelas', classId)
            .order('date', { ascending: false })
    }

    if (fromDate) {
        query = query.gte('date', fromDate)
    }
    if (toDate) {
        query = query.lte('date', toDate)
    }

    // Limit to reasonable amount if no date range?
    if (!fromDate && !toDate) {
        query = query.limit(100)
    }

    const { data, error } = await query

    if (error) return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, error.message), 500)

    return c.json(data)
  })

  app.route('/teacher', teacherGroup)
}
