import { createClient } from "@supabase/supabase-js";

/**
 * WHOOP Data Sync Edge Function
 *
 * POST /api/whoop/sync { user_id }  → Syncs latest data for a specific user
 * POST /api/whoop/sync-all          → Syncs all active WHOOP connections
 * GET  /api/whoop/data?user_id=xxx  → Returns the user's latest WHOOP data
 */
export default async (request, context) => {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    const WHOOP_CLIENT_ID = Deno.env.get("WHOOP_CLIENT_ID");
    const WHOOP_CLIENT_SECRET = Deno.env.get("WHOOP_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return new Response(JSON.stringify({ error: "WHOOP integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ===== Get user's WHOOP data =====
    if (path === "/api/whoop/data" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return jsonResponse({ error: "Missing user_id" }, 400);
        }

        try {
            const { data: connection } = await supabase
                .from("whoop_connections")
                .select("whoop_user_id, connected_at, last_sync_at, is_active")
                .eq("user_id", userId)
                .eq("is_active", true)
                .single();

            if (!connection) {
                return jsonResponse({ connected: false });
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const dateStr = sevenDaysAgo.toISOString().split("T")[0];

            const [recoveryRes, sleepRes, workoutRes] = await Promise.all([
                supabase
                    .from("whoop_recovery")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
                supabase
                    .from("whoop_sleep")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
                supabase
                    .from("whoop_workouts")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
            ]);

            return jsonResponse({
                connected: true,
                last_sync: connection.last_sync_at,
                connected_at: connection.connected_at,
                recovery: recoveryRes.data || [],
                sleep: sleepRes.data || [],
                workouts: workoutRes.data || [],
            });

        } catch (err) {
            console.error("WHOOP data fetch error:", err);
            return jsonResponse({ error: "Failed to fetch data" }, 500);
        }
    }

    // ===== Sync single user =====
    if (path === "/api/whoop/sync" && request.method === "POST") {
        try {
            const body = await request.json();
            const userId = body.user_id;

            if (!userId) {
                return jsonResponse({ error: "Missing user_id" }, 400);
            }

            const result = await syncUserWhoopData(supabase, userId, WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET);
            return jsonResponse(result);

        } catch (err) {
            console.error("WHOOP sync error:", err);
            return jsonResponse({ error: "Sync failed" }, 500);
        }
    }

    // ===== Sync all active connections =====
    if (path === "/api/whoop/sync-all" && request.method === "POST") {
        try {
            const { data: connections } = await supabase
                .from("whoop_connections")
                .select("user_id")
                .eq("is_active", true);

            if (!connections || connections.length === 0) {
                return jsonResponse({ message: "No active connections", synced: 0 });
            }

            let synced = 0;
            let failed = 0;

            for (const conn of connections) {
                try {
                    await syncUserWhoopData(supabase, conn.user_id, WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET);
                    synced++;
                } catch (err) {
                    console.error(`Failed to sync WHOOP user ${conn.user_id}:`, err);
                    failed++;
                }
            }

            return jsonResponse({ synced, failed, total: connections.length });

        } catch (err) {
            console.error("WHOOP sync-all error:", err);
            return jsonResponse({ error: "Sync-all failed" }, 500);
        }
    }

    return new Response("Not Found", { status: 404 });
};

/**
 * Sync WHOOP data for a single user
 */
async function syncUserWhoopData(supabase, userId, clientId, clientSecret) {
    const { data: connection, error: connError } = await supabase
        .from("whoop_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

    if (connError || !connection) {
        return { error: "No active WHOOP connection" };
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date()) {
        const refreshResult = await refreshWhoopToken(supabase, connection, clientId, clientSecret);
        if (refreshResult.error) {
            return refreshResult;
        }
        accessToken = refreshResult.access_token;
    }

    const today = new Date().toISOString().split("T")[0];
    const headers = { "Authorization": `Bearer ${accessToken}` };

    // Fetch data from WHOOP API in parallel
    const [cycleData, sleepData, workoutData] = await Promise.all([
        fetchWhoopAPI("https://api.prod.whoop.com/developer/v1/cycle?limit=1", headers),
        fetchWhoopAPI("https://api.prod.whoop.com/developer/v1/activity/sleep?limit=1", headers),
        fetchWhoopAPI("https://api.prod.whoop.com/developer/v1/activity/workout?limit=1", headers),
    ]);

    // Get recovery for the latest cycle
    let recoveryData = null;
    if (cycleData && cycleData.records && cycleData.records[0]) {
        const cycleId = cycleData.records[0].id;
        recoveryData = await fetchWhoopAPI(`https://api.prod.whoop.com/developer/v1/cycle/${cycleId}/recovery`, headers);
    }

    // Store recovery data
    if (recoveryData && recoveryData.score_state === "SCORED" && recoveryData.score) {
        const score = recoveryData.score;
        await supabase.from("whoop_recovery").upsert({
            user_id: userId,
            date: today,
            recovery_score: score.recovery_score || 0,
            resting_heart_rate: score.resting_heart_rate || null,
            hrv_rmssd: score.hrv_rmssd_milli || null,
            spo2_percentage: score.spo2_percentage || null,
            skin_temp_celsius: score.skin_temp_celsius || null,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Store sleep data
    if (sleepData && sleepData.records && sleepData.records[0]) {
        const sleep = sleepData.records[0];
        const sleepDate = sleep.start ? sleep.start.split("T")[0] : today;
        const score = sleep.score || {};

        // Calculate duration in minutes from start/end
        let durationMinutes = 0;
        if (sleep.start && sleep.end) {
            durationMinutes = Math.round((new Date(sleep.end) - new Date(sleep.start)) / 60000);
        }

        await supabase.from("whoop_sleep").upsert({
            user_id: userId,
            date: sleepDate,
            start_time: sleep.start || null,
            end_time: sleep.end || null,
            duration_minutes: durationMinutes,
            sleep_efficiency: score.sleep_efficiency_percentage || null,
            disturbance_count: score.disturbance_count || 0,
            light_sleep_minutes: score.stage_summary?.total_light_sleep_time_milli ? Math.round(score.stage_summary.total_light_sleep_time_milli / 60000) : 0,
            deep_sleep_minutes: score.stage_summary?.total_slow_wave_sleep_time_milli ? Math.round(score.stage_summary.total_slow_wave_sleep_time_milli / 60000) : 0,
            rem_sleep_minutes: score.stage_summary?.total_rem_sleep_time_milli ? Math.round(score.stage_summary.total_rem_sleep_time_milli / 60000) : 0,
            wake_minutes: score.stage_summary?.total_awake_time_milli ? Math.round(score.stage_summary.total_awake_time_milli / 60000) : 0,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Store workout data
    if (workoutData && workoutData.records && workoutData.records[0]) {
        const workout = workoutData.records[0];
        if (workout.score_state === "SCORED" && workout.score) {
            const workoutDate = workout.start ? workout.start.split("T")[0] : today;
            const score = workout.score;

            await supabase.from("whoop_workouts").upsert({
                user_id: userId,
                date: workoutDate,
                sport_id: workout.sport_id || 0,
                strain: score.strain || 0,
                avg_heart_rate: score.average_heart_rate || null,
                max_heart_rate: score.max_heart_rate || null,
                kilojoules: score.kilojoule || 0,
                distance_meters: score.distance_meter || null,
                start_time: workout.start || null,
                end_time: workout.end || null,
                synced_at: new Date().toISOString(),
            }, { onConflict: "user_id,date" });
        }
    }

    // Update last_sync_at
    await supabase
        .from("whoop_connections")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    return { success: true, synced_date: today };
}

/**
 * Refresh an expired WHOOP access token
 */
async function refreshWhoopToken(supabase, connection, clientId, clientSecret) {
    try {
        const response = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: connection.refresh_token,
                client_id: clientId,
                client_secret: clientSecret,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("WHOOP token refresh failed:", errText);

            if (response.status === 401 || errText.includes("invalid_grant")) {
                await supabase
                    .from("whoop_connections")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", connection.user_id);
            }

            return { error: "Token refresh failed - user may need to reconnect" };
        }

        const tokens = await response.json();
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await supabase
            .from("whoop_connections")
            .update({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", connection.user_id);

        return { access_token: tokens.access_token };

    } catch (err) {
        console.error("WHOOP token refresh error:", err);
        return { error: "Token refresh failed" };
    }
}

/**
 * Fetch data from WHOOP API with error handling
 */
async function fetchWhoopAPI(url, headers) {
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`WHOOP API error (${url}):`, response.status);
            return null;
        }
        return await response.json();
    } catch (err) {
        console.error(`WHOOP API fetch error (${url}):`, err);
        return null;
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
