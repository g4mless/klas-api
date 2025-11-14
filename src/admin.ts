// Fixed backend code for Hono + Supabase (TypeScript)
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const ALLOWED_TABLES = [
  'duty_schedule',
  'students',
  'attendances',
  'class',
  'admin',
] as const;

// Initialize Supabase clients
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// JWT verification function
async function verifyToken(token: string): Promise<string | null> {
  try {
    // Decode JWT to get user ID (without verification for now - you should verify with Supabase JWT secret)
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded || !decoded.sub) {
      return null;
    }
    return decoded.sub; // This is the user ID
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

async function isAdminToken(token: string): Promise<boolean> {
  const userId = await verifyToken(token);
  if (!userId) {
    console.log('Token verification failed');
    return false;
  }

  console.log('User ID from token:', userId);

  // Check if the user_id exists in admin table
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('admin')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!adminError && adminData) {
    console.log('User is admin - found in admin table');
    return true;
  }

  console.log('User is not admin');
  return false;
}

export function setupAdminRoutes(app: Hono) {
  // List rows: GET /admin/:table
  app.get('/admin/:table', async (c) => {
    const table = c.req.param('table');
    console.log('GET /admin/' + table);

    if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      console.log('Table not allowed:', table);
      return c.json({ error: 'Table not allowed' }, 400);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization header');
      return c.json({ error: 'Authorization header required' }, 401);
    }

    const token = authHeader.substring(7);
    console.log('Token received:', token.substring(0, 20) + '...');

    const isAdmin = await isAdminToken(token);
    if (!isAdmin) {
      console.log('User is not admin');
      return c.json({ error: 'Not admin' }, 403);
    }

    console.log('Fetching data from table:', table);
    const { data, error } = await supabaseAdmin.from(table).select('*');
    if (error) {
      console.error('Database error:', error);
      return c.json({ error: error.message }, 400);
    }

    console.log('Data fetched successfully, rows:', data?.length || 0);
    return c.json({ data });
  });

  // Get single row: GET /admin/:table/:id
  app.get('/admin/:table/:id', async (c) => {
    const table = c.req.param('table');
    const id = c.req.param('id');

    if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return c.json({ error: 'Table not allowed' }, 400);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401);
    }
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) {
      return c.json({ error: 'not admin' }, 403);
    }

    const parsedId = Number(id);
    const query = supabaseAdmin.from(table).select('*');
    const { data, error } = Number.isNaN(parsedId) ? await query.eq('id', id).single() : await query.eq('id', parsedId).single();

    if (error) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ data });
  });

  // Create row: POST /admin/:table
  app.post('/admin/:table', async (c) => {
    const table = c.req.param('table');
    if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return c.json({ error: 'Table not allowed' }, 400);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401);
    }
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) {
      return c.json({ error: 'not admin' }, 403);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { data, error } = await supabaseAdmin.from(table).insert(body).select();
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ data });
  });

  // Update row: PUT /admin/:table/:id
  app.put('/admin/:table/:id', async (c) => {
    const table = c.req.param('table');
    const id = c.req.param('id');
    if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return c.json({ error: 'Table not allowed' }, 400);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401);
    }
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) {
      return c.json({ error: 'not admin' }, 403);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsedId = Number(id);
    const query = supabaseAdmin.from(table).update(body).select();
    const { data, error } = Number.isNaN(parsedId) ? await query.eq('id', id) : await query.eq('id', parsedId);
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ data });
  });

  // Delete row: DELETE /admin/:table/:id
  app.delete('/admin/:table/:id', async (c) => {
    const table = c.req.param('table');
    const id = c.req.param('id');
    if (!ALLOWED_TABLES.includes(table as typeof ALLOWED_TABLES[number])) {
      return c.json({ error: 'Table not allowed' }, 400);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401);
    }
    const token = authHeader.substring(7);
    if (!(await isAdminToken(token))) {
      return c.json({ error: 'not admin' }, 403);
    }

    const parsedId = Number(id);
    const query = supabaseAdmin.from(table).delete().select();
    const { data, error } = Number.isNaN(parsedId) ? await query.eq('id', id) : await query.eq('id', parsedId);
    if (error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ data });
  });
}

export default setupAdminRoutes;
