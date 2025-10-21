import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { pool } from "./db.js";

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
    "SELECT id, subject, start_time, end_time, teacher FROM subjects_full WHERE day = $1 ORDER BY id",
    [today]
  )

  return c.json({ today, schedule: result.rows })
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

  const result = await pool.query(
    `SELECT id, subject, start_time, end_time, teacher
     FROM subjects_full
     WHERE day = $1
       AND start_time <= $2
       AND end_time > $2
     ORDER BY id`,
    [today, time]
  );

  return c.json({ today, time, ongoing: result.rows });
});

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
