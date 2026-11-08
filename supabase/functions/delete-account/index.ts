import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const allowedOrigins = new Set([
  "https://prunex-play.vercel.app",
  "https://prunex-review.vercel.app",
]);

function headersFor(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: headersFor(origin) });
  }
  if (request.method !== "POST") return json(origin, 405, { error: "Method not allowed." });
  if (origin && !allowedOrigins.has(origin)) return json(origin, 403, { error: "Origin not allowed." });

  let body: { confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return json(origin, 400, { error: "Invalid request body." });
  }
  if (body.confirmation !== "DELETE_MY_PRUNEX_ACCOUNT") {
    return json(origin, 400, { error: "Explicit account-deletion confirmation is required." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(origin, 401, { error: "A signed-in Prunex session is required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing server-side Supabase administrative configuration.");
    return json(origin, 500, { error: "Account deletion is temporarily unavailable." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return json(origin, 401, { error: "Your session could not be verified. Sign in again and retry." });
  }

  // Revoke refresh-token sessions before deleting the user. Access JWTs remain
  // cryptographically valid until expiry, but the Auth user and all FK-owned
  // Prunex rows are deleted immediately afterwards.
  const { error: revokeError } = await admin.auth.admin.signOut(token);
  if (revokeError) {
    console.error("Could not revoke Prunex user sessions:", revokeError.message);
    return json(origin, 503, { error: "Could not revoke your sessions; no data was deleted. Please retry." });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error("Could not delete Prunex user:", deleteError.message);
    return json(origin, 500, { error: "Your account could not be deleted. Please contact support." });
  }

  return json(origin, 200, { success: true });
});
