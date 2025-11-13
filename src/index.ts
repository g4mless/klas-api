import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { setupScheduleRoutes } from './schedule.js';
import { setupAuthRoutes } from './auth.js';
import { setupAdminRoutes } from './admin.js';
import { setupAttendanceRoutes } from './attendances.js';

const app = new Hono()

app.use('*', cors())

// Setup routes
setupScheduleRoutes(app);
setupAuthRoutes(app); // just for testing, later on android development will use supabase client directly
setupAttendanceRoutes(app);
setupAdminRoutes(app);

app.get('/', (c) => {
  return c.text('Klas king!')
})


serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
