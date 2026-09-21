// ============================================================================
// Supabase Edge Function: delete_my_account
// Description: Secure self-service account deletion.
// 1. Verifies the requester's JWT.
// 2. Cascade deletes user data across all application tables.
// 3. Removes the user from auth.users using the Supabase Admin API.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment configuration on Edge Function");
    }

    // 1. Authenticate the caller from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Client bound to the caller's JWT to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // 2. Initialize Admin client with Service Role Key (strictly server-side)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 3. Explicitly cascade delete user's data across application tables
    // (Ensures complete cleanup even if DB foreign key constraints are ever altered)
    await Promise.all([
      adminClient.from("quests").delete().eq("user_id", userId),
      adminClient.from("solved_challenges").delete().eq("user_id", userId),
      adminClient.from("daily_exp").delete().eq("user_id", userId),
      adminClient.from("activity_log").delete().eq("user_id", userId),
      adminClient.from("unlocked_achievements").delete().eq("user_id", userId),
    ]);

    // Delete user profile
    const { error: profileDeleteErr } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteErr) {
      console.error("Error deleting profile row:", profileDeleteErr);
    }

    // 4. Delete the user from Supabase Auth (auth.users)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Error deleting auth.users record:", deleteUserError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to delete auth user account: " + deleteUserError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account and all associated hunter data were successfully deleted.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error in delete_my_account:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "An unexpected error occurred during account deletion",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
