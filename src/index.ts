import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { supabase, supabaseAdmin } from './supabaseClient.js';

const app = new Hono()

app.use('*', prettyJSON())

function getTodayName(override?: string): string {
  const dayMap: Record<string, string> = {
    sunday: "Minggu",
    monday: "Senin",
    tuesday: "Selasa",
    wednesday: "Rabu",
    thursday: "Kamis",
    friday: "Jumat",
    saturday: "Sabtu",
    //minggu: "Minggu", in case override is broke
    //senin: "Senin",
    //selasa: "Selasa",
    //rabu: "Rabu",
    //kamis: "Kamis",
    //jumat: "Jumat",
    //sabtu: "Sabtu",
  };

  if (override) {
    const key = override.toLowerCase();
    return dayMap[key] ?? override;
  }

  const today = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
  }).toLowerCase();

  return dayMap[today] ?? today;
}

app.get('/', (c) => {
  return c.text('Klas king!')
})

app.get("/schedule", async (c) => {
  const { data, error } = await supabase
    .from('subjects_schedule')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;
  const grouped = data.reduce((acc: any, row) => {
    if (!acc[row.day]) acc[row.day] = [];
    acc[row.day].push({
      id: row.id,
      subject: row.subject
    });
    return acc;
  }, {});
  return c.json(grouped);
})

app.get("/duty", async (c) => {
  const { data, error } = await supabase
  .from('duty_schedule')
  .select('*')
  .order('id', { ascending: true });

  if (error) throw error;
  const grouped = data.reduce((acc: any, row) => {
    if (!acc[row.day]) acc[row.day] = [];
    acc[row.day].push({
      id: row.id,
      student_name: row.student_name
    });
    return acc;
  }, {});

  return c.json(grouped);
})

app.get("/today-schedule", async (c) => {
  const override = c.req.query("d"); //d = day
  const today = getTodayName(override);

  const { data, error } = await supabase
    .from('subjects_full')
    .select('id, subject, start_time, end_time, teacher')
    .eq('day', today)
    .order('id', { ascending: true });

  if (error) throw error;
  return c.json({ today, schedule: data });
})

app.get("/ongoing", async (c) => {
  const overrideDay = c.req.query("d");
  const overrideTime = c.req.query("t");
  const today = getTodayName(overrideDay);

  let time: string;
  if (overrideTime) {
    const parts = (overrideTime as string).split(":");
    const hh = (parts[0] ?? "00").padStart(2, "0");
    const mm = (parts[1] ?? "00").padStart(2, "0");
    time = `${hh}:${mm}`;
  } else {
    const now = new Date();
    const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const hh = String(jakarta.getHours()).padStart(2, "0");
    const mm = String(jakarta.getMinutes()).padStart(2, "0");
    time = `${hh}:${mm}`;
  }

  const { data, error } = await supabase
    .from('subjects_full')
    .select('id, subject, start_time, end_time, teacher')
    .eq('day', today)
    .lte('start_time', time)
    .gt('end_time', time)
    .order('id', { ascending: true });

  if (error) throw error;
  return c.json({ today, time, ongoing: data });
});

app.get("/today-duty", async (c) => {
  const override = c.req.query("d"); //d = day
  const today = getTodayName(override);
  const { data, error } = await supabase
    .from('duty_schedule')
    .select('id, student_name')
    .eq('day', today)
    .order('id', { ascending: true });

  if (error) throw error;
  return c.json({ today, duty: data });
})

// Authentication endpoints
app.post("/auth/signin", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { email } = body;
  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ message: "OTP sent to email" });
});

app.post("/auth/verify-otp", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { email, token } = body;
  if (!email || !token) {
    return c.json({ error: "Email and token are required" }, 400);
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ user: data.user, session: data.session });
});

app.get("/auth/user", async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: "Authorization header with Bearer token is required" }, 401);
  }

  const accessToken = authHeader.substring(7);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ user: data.user });
});

app.post("/auth/link-student", async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: "Authorization header with Bearer token is required" }, 401);
  }

  const accessToken = authHeader.substring(7);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return c.json({ error: "Invalid token or user not found" }, 401);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { name } = body;
  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  const { data: studentData, error: studentError } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('name', name)
    .single();

  if (studentError || !studentData) {
    return c.json({ error: "Student not found" }, 404);
  }

  const { data: updateData, error: updateError } = await supabaseAdmin
    .from('students')
    .update({ user_id: userData.user.id })
    .eq('name', name)
    .select();

  if (updateError) {
    return c.json({ error: updateError.message }, 400);
  }

  return c.json({ message: "Student linked successfully", student: updateData[0] });
});

app.get("/student", async (c) => {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('name')
    .is('user_id', null)
    .order('name', { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ students: data });
});

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
