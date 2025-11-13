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