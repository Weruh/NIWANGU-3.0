import { createClient } from "jsr:@supabase/supabase-js@2.112.0";
Deno.serve(async (req) => {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Origin": allowed.length
      ? origin && allowed.includes(origin)
        ? origin
        : allowed[0]
      : "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return reply(200, {});
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const token = (req.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user)
      return reply(401, { error: "Sign in again to delete your account." });
    const { error: revokeError } = await admin.auth.admin.signOut(
      token,
      "global",
    );
    if (revokeError) throw revokeError;
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile) {
      const { data: photos, error: photoError } = await admin
        .from("profile_photos")
        .select("storage_path")
        .eq("profile_id", profile.id);
      if (photoError) throw photoError;
      const paths = (photos ?? [])
        .map((photo: { storage_path: string | null }) => photo.storage_path)
        .filter((path: string | null): path is string => Boolean(path));
      if (paths.length) {
        const { error: storageError } = await admin.storage
          .from("profile-photos")
          .remove(paths);
        if (storageError) throw storageError;
      }
    }
    // Include uploaded files whose photo-row insert failed. Supabase will refuse
    // auth deletion while the user still owns Storage objects.
    const bucket = admin.storage.from("profile-photos");
    while (true) {
      const { data: files, error: listError } = await bucket.list(
        data.user.id,
        { limit: 100, offset: 0 },
      );
      if (listError) throw listError;
      if (!files?.length) break;
      const { error: removeError } = await bucket.remove(
        files.map((file: { name: string }) => `${data.user.id}/${file.name}`),
      );
      if (removeError) throw removeError;
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(
      data.user.id,
    );
    if (deleteError) throw deleteError;
    return reply(200, { success: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return reply(500, {
      error:
        "Account deletion could not finish. Please retry or contact support.",
    });
  }
});
