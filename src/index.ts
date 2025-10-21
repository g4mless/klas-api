import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { pool } from "./db.js";

const app = new Hono()

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
  const result = await pool.query("SELECT * FROM subjects_schedule ORDER BY id");
  return c.json(result.rows);
})

app.get("/duty", async (c) => {
  const result = await pool.query("SELECT * FROM duty_schedule ORDER BY id");
  return c.json(result.rows);
})

app.get("/today-schedule", async (c) => {
  const override = c.req.query("d"); //d = day
  const today = getTodayName(override);

  const result = await pool.query(
    "SELECT id, subject FROM subjects_schedule WHERE day = $1 ORDER BY id",
    [today]
  )

  return c.json({ today, schedule: result.rows })
})

app.get("/today-duty", async (c) => {
  const override = c.req.query("d"); //d = day
  const today = getTodayName(override);
  const result = await pool.query(
    "SELECT id, student_name FROM duty_schedule WHERE day = $1 ORDER BY id",
    [today]
  );

  return c.json({ today, duty: result.rows, })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
