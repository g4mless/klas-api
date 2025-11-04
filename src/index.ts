import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { supabase, supabaseAdmin } from './supabaseClient.js';
import { cors } from 'hono/cors';
import { setupScheduleRoutes } from './schedule.js';
import { setupAuthRoutes } from './auth.js';
import { setupAttendanceRoutes } from './attendances.js';

const app = new Hono()

app.use('*', prettyJSON())
app.use('*', cors())

// Setup routes
setupScheduleRoutes(app);
setupAuthRoutes(app); // just for testing, later on android development will use supabase client directly
setupAttendanceRoutes(app);

app.get('/', (c) => {
  return c.text('Klas king!')
})


app.get('/students', async (c) => {
  const { data, error } = await supabase.from('students').select('*')
  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
})


serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
