import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { setupAuthRoutes } from './auth.js';
import { setupAdminRoutes } from './admin.js';
import { setupAttendanceRoutes } from './attendances.js';

const app = new Hono()

app.use('*', cors())

// Setup routes
setupAuthRoutes(app);
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
