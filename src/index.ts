import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { setupAuthRoutes } from './auth.js';
import { setupAdminRoutes } from './admin.js';
import { setupAttendanceRoutes } from './attendances.js';
import { setupStudentRoutes } from './students.js';
import { setupTeacherRoutes } from './teachers.js';

const app = new Hono()

app.use('*', cors())

// Setup routes
setupAuthRoutes(app);
setupAttendanceRoutes(app);
setupAdminRoutes(app);
setupStudentRoutes(app);
setupTeacherRoutes(app);

app.get('/', (c) => {
  return c.text('Klas king!')
})


serve({
  fetch: app.fetch,
  port: 3000,
  hostname: '0.0.0.0'
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

//droid --resume 36a7811f-cdc1-4738-93fc-314f96011cf9