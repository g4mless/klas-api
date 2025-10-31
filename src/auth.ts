import { supabase, supabaseAdmin } from './supabaseClient.js';
import { Hono } from 'hono';

export function setupAuthRoutes(app: Hono) {
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

  app.post("/auth/verify", async (c) => {
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
}