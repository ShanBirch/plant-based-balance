import type { Context } from "https://edge.netlify.com";
import { createClient } from "@supabase/supabase-js";

const WALKTHROUGH_STORAGE_KEYS = [
  "featureTourComplete",
  "pbb_walkthrough_xp_awarded_v2",
];

export default async (request: Request, context: Context): Promise<Response> => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), { status: 500, headers });
    }

    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers });
    }

    const accessToken = authHeader.slice("Bearer ".length);
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: serviceKey,
      },
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ success: false, error: "Invalid session" }), { status: 401, headers });
    }

    const authUser = await userRes.json();
    const userId = authUser?.id;
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Invalid session" }), { status: 401, headers });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id,email,is_test_account")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ success: false, error: "User profile not found" }), { status: 404, headers });
    }

    if (!profile.is_test_account) {
      return new Response(JSON.stringify({ success: false, error: "This reset is only available for test accounts" }), { status: 403, headers });
    }

    const { data: removedRows, error: deleteError } = await supabase
      .from("point_transactions")
      .delete()
      .eq("user_id", userId)
      .eq("transaction_type", "earn_walkthrough")
      .select("points_amount");

    if (deleteError) throw deleteError;

    const removedPoints = (removedRows || []).reduce((sum, row) => sum + Math.max(0, Number(row.points_amount) || 0), 0);

    if (removedPoints > 0) {
      const { data: pointsRow, error: pointsError } = await supabase
        .from("user_points")
        .select("current_points,lifetime_points")
        .eq("user_id", userId)
        .maybeSingle();

      if (pointsError) throw pointsError;

      const { error: updateError } = await supabase
        .from("user_points")
        .upsert({
          user_id: userId,
          current_points: Math.max(0, (Number(pointsRow?.current_points) || 0) - removedPoints),
          lifetime_points: Math.max(0, (Number(pointsRow?.lifetime_points) || 0) - removedPoints),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      removedTransactions: removedRows?.length || 0,
      removedPoints,
      localStorageKeysToClear: WALKTHROUGH_STORAGE_KEYS,
      message: "Walkthrough test state reset",
    }), { status: 200, headers });
  } catch (error) {
    console.error("reset-walkthrough-test-state error:", error);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), { status: 500, headers });
  }
};
