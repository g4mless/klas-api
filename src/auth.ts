import { supabase, supabaseAdmin } from './supabaseClient.js';
import { Hono } from 'hono';
import { createErrorResponse, ErrorCodes } from './types/responses.js';

export function setupAuthRoutes(app: Hono) {
  app.post("/auth/signin", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createErrorResponse(ErrorCodes.INVALID_JSON, "Invalid JSON body"), 400);
    }
    const { email } = body;
    if (!email) {
      return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, "Email is required"), 400);
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, error.message), 400);
    }

    return c.json({ message: "OTP sent to email" });
  });

  app.post("/auth/verify", async (c) => {
    const body = await c.req.json();
    const { email, token } = body;

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, error.message), 400);
    if (!data.session) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Session not created"), 400);
    }

    c.header(
      "Set-Cookie",
      `refresh_token=${data.session.refresh_token}; HttpOnly; Path=/; Secure; SameSite=Strict`
    );

    return c.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: data.user,
    });
  });

  app.get("/auth/user", async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, "Authorization header with Bearer token is required"), 401);
    }

    const accessToken = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, error.message), 400);
    }

    return c.json({ user: data.user });
  });

  app.post("/auth/refresh", async (c) => {
    const body = await c.req.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, "Refresh token is required"), 400);
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      const isAlreadyUsed = error.message.includes('Already Used');
      const message = isAlreadyUsed 
        ? "Refresh token already used. Note: Refresh tokens are single-use only. You must store and use the NEW refresh token from each successful refresh response."
        : error.message;
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, message), 401);
    }
    if (!data.session) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Session not created"), 400);
    }

    const newRefresh = data.session.refresh_token;

    c.header(
      "Set-Cookie",
      `refresh_token=${newRefresh}; HttpOnly; Path=/; Secure; SameSite=Strict`
    );

    return c.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: data.user,
    });
  });


  app.post("/auth/link-student", async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, "Authorization header with Bearer token is required"), 401);
    }

    const accessToken = authHeader.substring(7);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Invalid token or user not found"), 401);
    }

    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createErrorResponse(ErrorCodes.INVALID_JSON, "Invalid JSON body"), 400);
    }
    const { name } = body;
    if (!name) {
      return c.json(createErrorResponse(ErrorCodes.MISSING_FIELD, "Name is required"), 400);
    }

    const { data: studentData, error: studentError } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('nama', name)
      .single();

    if (studentError || !studentData) {
      return c.json(createErrorResponse(ErrorCodes.STUDENT_NOT_FOUND, "Student not found"), 404);
    }

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('students')
      .update({ user_id: userData.user.id })
      .eq('nama', name)
      .select();

    if (updateError) {
      return c.json(createErrorResponse(ErrorCodes.NOT_FOUND, updateError.message), 400);
    }

    return c.json({ message: "Student linked successfully", student: updateData[0] });
  });

  app.get("/auth/admin", async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(createErrorResponse(ErrorCodes.UNAUTHORIZED, "Authorization header with Bearer token is required"), 401);
    }

    const accessToken = authHeader.substring(7);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return c.json(createErrorResponse(ErrorCodes.INVALID_TOKEN, "Invalid token or user not found"), 401);
    }
    
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admin')
      .select('*')
      .eq('user_id', userData.user.id)
      .single();

    if (!adminError && adminData) {
      return c.json({ is_admin: true, message: "you're an admin" });
    }

    return c.json({ is_admin: false, message: "not admin" });
  });
}