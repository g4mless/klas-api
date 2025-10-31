import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { supabase, supabaseAdmin } from './supabaseClient.js';
import { cors } from 'hono/cors';
import { setupScheduleRoutes } from './schedule.js';
import { setupAuthRoutes } from './auth.js';

const app = new Hono()

app.use('*', prettyJSON())
app.use('*', cors())

// Setup routes
setupScheduleRoutes(app);
setupAuthRoutes(app);

app.get('/', (c) => {
  return c.text('Klas king!')
})


app.get('/students', async (c) => {
  const { data, error } = await supabase.from('students').select('*')
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})

app.post('/absen', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: "Authorization header with Bearer token is required" }, 401);
  }

  const accessToken = authHeader.substring(7);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
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

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { status } = body;
  if (!status) {
    return c.json({ error: "Status is required" }, 400);
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const { error } = await supabase
    .from('students')
    .update({
      last_status: status,
      last_date: today
    })
    .eq('id', studentData.id);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ message: 'Absensi diperbarui' });
});

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
