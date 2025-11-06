import { Hono } from 'hono';
import { supabase, supabaseAdmin } from './supabaseClient.js';

const ALLOWED_TABLES = [
  'duty_schedule',
  'subjects_full',
  'subjects_schedule',
  'students',
  'attendances',
  'admin',
];

async function isAdminToken(token: string) {
  if (!token) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return false;

  // Check if the user is linked to a student and that student id appears in admin table
  const { data: studentData, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('user_id', userData.user.id)
    .single();

  if (!studentError && studentData && (studentData as any).id) {
    const studentId = (studentData as any).id;
    const { data: adminByStudent, error: adminByStudentError } = await supabaseAdmin
      .from('admin')
      .select('*')
      .eq('admin', studentId)
      .single();

    if (!adminByStudentError && adminByStudent) return true;
  }

  // Fallback: check by auth user id (string)
  const { data: adminByUserId, error: adminByUserIdError } = await supabaseAdmin
    .from('admin')
    .select('*')
    .eq('admin', userData.user.id)
    .single();

  if (!adminByUserIdError && adminByUserId) return true;

  // Final fallback: numeric parse
  const parsed = Number(userData.user.id as unknown as string);
  if (!Number.isNaN(parsed)) {
    const { data: adminByNumber, error: adminByNumberError } = await supabaseAdmin
      .from('admin')
      .select('*')
      .eq('admin', parsed)
      .single();

    if (!adminByNumberError && adminByNumber) return true;
  }

  return false;
}

export function setupAdminRoutes(app: Hono) {
  // List rows: GET /admin/:table
  app.get('/admin/:table', async (c) => {
    const table = c.req.param('table');
    if (!ALLOWED_TABLES.includes(table)) return c.json({ error: 'Table not allowed' }, 400);

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Authorization header required' }, 401);
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) return c.json({ error: 'not admin' }, 403);

    const { data, error } = await supabaseAdmin.from(table).select('*');
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data });
  });

  // Get single row: GET /admin/:table/:id
  app.get('/admin/:table/:id', async (c) => {
    const table = c.req.param('table');
    const id = c.req.param('id');
    if (!ALLOWED_TABLES.includes(table)) return c.json({ error: 'Table not allowed' }, 400);

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Authorization header required' }, 401);
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) return c.json({ error: 'not admin' }, 403);

    const parsedId = Number(id);
    const query = supabaseAdmin.from(table).select('*');
    const { data, error } = Number.isNaN(parsedId) ? await query.eq('id', id).single() : await query.eq('id', parsedId).single();

    if (error) return c.json({ error: error.message }, 404);
    return c.json({ data });
  });

  // Create row: POST /admin/:table
  app.post('/admin/:table', async (c) => {
    const table = c.req.param('table');
    if (!ALLOWED_TABLES.includes(table)) return c.json({ error: 'Table not allowed' }, 400);

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Authorization header required' }, 401);
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) return c.json({ error: 'not admin' }, 403);

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { data, error } = await supabaseAdmin.from(table).insert(body).select();
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data });
  });

  // Update row: PUT /admin/:table/:id
  app.put('/admin/:table/:id', async (c) => {
    const table = c.req.param('table');
    const id = c.req.param('id');
    if (!ALLOWED_TABLES.includes(table)) return c.json({ error: 'Table not allowed' }, 400);

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Authorization header required' }, 401);
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) return c.json({ error: 'not admin' }, 403);

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsedId = Number(id);
    const query = supabaseAdmin.from(table).update(body).select();
    const { data, error } = Number.isNaN(parsedId) ? await query.eq('id', id) : await query.eq('id', parsedId);
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data });
  });

  // Delete row: DELETE /admin/:table/:id
  app.delete('/admin/:table/:id', async (c) => {
    const table = c.req.param('table');
    const id = c.req.param('id');
    if (!ALLOWED_TABLES.includes(table)) return c.json({ error: 'Table not allowed' }, 400);

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: 'Authorization header required' }, 401);
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) return c.json({ error: 'not admin' }, 403);

    const parsedId = Number(id);
    const query = supabaseAdmin.from(table).delete().select();
    const { data, error } = Number.isNaN(parsedId) ? await query.eq('id', id) : await query.eq('id', parsedId);
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data });
  });
}

export default setupAdminRoutes;
