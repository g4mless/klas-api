import { Hono } from 'hono';
import { supabase, supabaseAdmin, createSupabaseClientWithToken } from './supabaseClient.js';

async function getClientForRequest(c: any) {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data && data.user) {
        return createSupabaseClientWithToken(token);
      }
    }
  } catch (e) {
    // ignore err
  }
  return supabase;
}

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

export function setupScheduleRoutes(app: Hono) {
  app.get("/schedule", async (c) => {
    const rls = await getClientForRequest(c);
    const { data, error } = await rls
      .from('subjects_schedule')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    const grouped = data.reduce((acc: any, row: any) => {
      if (!acc[row.day]) acc[row.day] = [];
      acc[row.day].push({
        id: row.id,
        subject: row.subject
      });
      return acc;
    }, {});
    return c.json(grouped);
  });

  app.get("/duty", async (c) => {
    const rls = await getClientForRequest(c);
    const { data, error } = await rls
    .from('duty_schedule')
    .select('*')
    .order('id', { ascending: true });

    if (error) throw error;
    const grouped = data.reduce((acc: any, row: any) => {
      if (!acc[row.day]) acc[row.day] = [];
      acc[row.day].push({
        id: row.id,
        student_name: row.student_name
      });
      return acc;
    }, {});

    return c.json(grouped);
  });

  app.get("/today-schedule", async (c) => {
    const override = c.req.query("d"); //d = day
    const today = getTodayName(override);

    const rls = await getClientForRequest(c);
    const { data, error } = await rls
      .from('subjects_full')
      .select('id, subject, start_time, end_time, teacher')
      .eq('day', today)
      .order('id', { ascending: true });

    if (error) throw error;
    const schedule = (data || []).map((row: any) => ({
      ...row,
      start_time: typeof row.start_time === 'string' ? row.start_time.slice(0, 5) : row.start_time,
      end_time: typeof row.end_time === 'string' ? row.end_time.slice(0, 5) : row.end_time,
    }));
    return c.json({ today, schedule });
  });

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

    const rls = await getClientForRequest(c);
    const { data, error } = await rls
      .from('subjects_full')
      .select('id, subject, start_time, end_time, teacher')
      .eq('day', today)
      .lte('start_time', time)
      .gt('end_time', time)
      .order('id', { ascending: true });

    if (error) throw error;
    const ongoing = (data || []).map((row: any) => ({
      ...row,
      start_time: typeof row.start_time === 'string' ? row.start_time.slice(0, 5) : row.start_time,
      end_time: typeof row.end_time === 'string' ? row.end_time.slice(0, 5) : row.end_time,
    }));
    return c.json({ today, time, ongoing });
  });

  app.get("/today-duty", async (c) => {
    const override = c.req.query("d"); //d = day
    const today = getTodayName(override);
    const rls = await getClientForRequest(c);
    const { data, error } = await rls
      .from('duty_schedule')
      .select('id, student_name')
      .eq('day', today)
      .order('id', { ascending: true });

    if (error) throw error;
    return c.json({ today, duty: data });
  });
}