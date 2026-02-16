import { createClient } from "@supabase/supabase-js";

/**
 * Oura Ring Data Sync Edge Function
 *
 * POST /api/oura/sync { user_id }  → Syncs today's data for a specific user
 * POST /api/oura/sync-all          → Syncs all active Oura connections
 * GET  /api/oura/data?user_id=xxx  → Returns the user's latest Oura data
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

    const OURA_CLIENT_ID = Deno.env.get("OURA_CLIENT_ID");
    const OURA_CLIENT_SECRET = Deno.env.get("OURA_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OURA_CLIENT_ID || !OURA_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return new Response(JSON.stringify({ error: "Oura integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ===== Get user's Oura data =====
    if (path === "/api/oura/data" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return jsonResponse({ error: "Missing user_id" }, 400);
        }

        try {
            const { data: connection } = await supabase
                .from("oura_connections")
                .select("oura_user_id, connected_at, last_sync_at, is_active")
                .eq("user_id", userId)
                .eq("is_active", true)
                .single();

            if (!connection) {
                return jsonResponse({ connected: false });
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const dateStr = sevenDaysAgo.toISOString().split("T")[0];

            const [activityRes, sleepRes, readinessRes] = await Promise.all([
                supabase
                    .from("oura_daily_activity")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
                supabase
                    .from("oura_sleep")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
                supabase
                    .from("oura_readiness")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
            ]);

            return jsonResponse({
                connected: true,
                last_sync: connection.last_sync_at,
                connected_at: connection.connected_at,
                activity: activityRes.data || [],
                sleep: sleepRes.data || [],
                readiness: readinessRes.data || [],
            });

        } catch (err) {
            console.error("Oura data fetch error:", err);
            return jsonResponse({ error: "Failed to fetch data" }, 500);
        }
    }

    // ===== Sync single user =====
    if (path === "/api/oura/sync" && request.method === "POST") {
        try {
            const body = await request.json();
            const userId = body.user_id;

            if (!userId) {
                return jsonResponse({ error: "Missing user_id" }, 400);
            }

            const result = await syncUserOuraData(supabase, userId, OURA_CLIENT_ID, OURA_CLIENT_SECRET);
            return jsonResponse(result);

        } catch (err) {
            console.error("Oura sync error:", err);
            return jsonResponse({ error: "Sync failed" }, 500);
        }
    }

    // ===== Sync all active connections =====
    if (path === "/api/oura/sync-all" && request.method === "POST") {
        try {
            const { data: connections } = await supabase
                .from("oura_connections")
                .select("user_id")
                .eq("is_active", true);

            if (!connections || connections.length === 0) {
                return jsonResponse({ message: "No active connections", synced: 0 });
            }

            let synced = 0;
            let failed = 0;

            for (const conn of connections) {
                try {
                    await syncUserOuraData(supabase, conn.user_id, OURA_CLIENT_ID, OURA_CLIENT_SECRET);
                    synced++;
                } catch (err) {
                    console.error(`Failed to sync Oura user ${conn.user_id}:`, err);
                    failed++;
                }
            }

            return jsonResponse({ synced, failed, total: connections.length });

        } catch (err) {
            console.error("Oura sync-all error:", err);
            return jsonResponse({ error: "Sync-all failed" }, 500);
        }
    }

    return new Response("Not Found", { status: 404 });
};

/**
 * Sync Oura data for a single user
 */
async function syncUserOuraData(supabase, userId, clientId, clientSecret) {
    const { data: connection, error: connError } = await supabase
        .from("oura_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

    if (connError || !connection) {
        return { error: "No active Oura connection" };
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date()) {
        const refreshResult = await refreshOuraToken(supabase, connection, clientId, clientSecret);
        if (refreshResult.error) {
            return refreshResult;
        }
        accessToken = refreshResult.access_token;
    }

    const today = new Date().toISOString().split("T")[0];
    const headers = { "Authorization": `Bearer ${accessToken}` };

    // Fetch data from Oura API in parallel
    // Oura uses start_date/end_date query params (YYYY-MM-DD)
    const [activityData, sleepData, readinessData] = await Promise.all([
        fetchOuraAPI(`https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${today}&end_date=${today}`, headers),
        fetchOuraAPI(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${today}&end_date=${today}`, headers),
        fetchOuraAPI(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${today}&end_date=${today}`, headers),
    ]);

    // Also fetch detailed sleep for sleep stages
    const detailedSleep = await fetchOuraAPI(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${today}&end_date=${today}`, headers);

    // Store activity data
    if (activityData && activityData.data && activityData.data[0]) {
        const a = activityData.data[0];
        await supabase.from("oura_daily_activity").upsert({
            user_id: userId,
            date: a.day || today,
            steps: a.steps || 0,
            active_calories: a.active_calories || 0,
            total_calories: a.total_calories || 0,
            distance_meters: a.equivalent_walking_distance || 0,
            active_minutes: a.high_activity_time ? Math.round(a.high_activity_time / 60) : 0,
            low_activity_minutes: a.low_activity_time ? Math.round(a.low_activity_time / 60) : 0,
            medium_activity_minutes: a.medium_activity_time ? Math.round(a.medium_activity_time / 60) : 0,
            high_activity_minutes: a.high_activity_time ? Math.round(a.high_activity_time / 60) : 0,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Store sleep data (combining daily summary and detailed)
    if (sleepData && sleepData.data && sleepData.data[0]) {
        const s = sleepData.data[0];
        const detailed = detailedSleep?.data?.[0] || {};

        // Oura sleep durations are in seconds
        await supabase.from("oura_sleep").upsert({
            user_id: userId,
            date: s.day || today,
            sleep_score: s.score || null,
            total_sleep_minutes: detailed.total_sleep_duration ? Math.round(detailed.total_sleep_duration / 60) : 0,
            deep_minutes: detailed.deep_sleep_duration ? Math.round(detailed.deep_sleep_duration / 60) : 0,
            light_minutes: detailed.light_sleep_duration ? Math.round(detailed.light_sleep_duration / 60) : 0,
            rem_minutes: detailed.rem_sleep_duration ? Math.round(detailed.rem_sleep_duration / 60) : 0,
            wake_minutes: detailed.awake_time ? Math.round(detailed.awake_time / 60) : 0,
            efficiency: detailed.efficiency || null,
            lowest_heart_rate: detailed.lowest_heart_rate || null,
            time_in_bed_minutes: detailed.time_in_bed ? Math.round(detailed.time_in_bed / 60) : 0,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Store readiness data
    if (readinessData && readinessData.data && readinessData.data[0]) {
        const r = readinessData.data[0];
        const contributors = r.contributors || {};
        await supabase.from("oura_readiness").upsert({
            user_id: userId,
            date: r.day || today,
            readiness_score: r.score || null,
            temperature_deviation: r.temperature_deviation || null,
            resting_heart_rate_contrib: contributors.resting_heart_rate || null,
            hrv_balance_contrib: contributors.hrv_balance || null,
            body_temperature_contrib: contributors.body_temperature || null,
            recovery_index_contrib: contributors.recovery_index || null,
            sleep_balance_contrib: contributors.sleep_balance || null,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Update last_sync_at
    await supabase
        .from("oura_connections")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    return { success: true, synced_date: today };
}

/**
 * Refresh an expired Oura access token
 */
async function refreshOuraToken(supabase, connection, clientId, clientSecret) {
    try {
        if (!connection.refresh_token) {
            // Oura client-side tokens don't have refresh tokens
            await supabase
                .from("oura_connections")
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq("user_id", connection.user_id);
            return { error: "Token expired - user needs to reconnect (no refresh token)" };
        }

        const response = await fetch("https://api.ouraring.com/oauth/token", {
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
            console.error("Oura token refresh failed:", errText);

            if (response.status === 401 || errText.includes("invalid_grant")) {
                await supabase
                    .from("oura_connections")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", connection.user_id);
            }

            return { error: "Token refresh failed - user may need to reconnect" };
        }

        const tokens = await response.json();
        const expiresAt = new Date(Date.now() + (tokens.expires_in || 2592000) * 1000).toISOString();

        await supabase
            .from("oura_connections")
            .update({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || connection.refresh_token,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", connection.user_id);

        return { access_token: tokens.access_token };

    } catch (err) {
        console.error("Oura token refresh error:", err);
        return { error: "Token refresh failed" };
    }
}

/**
 * Fetch data from Oura API with error handling
 */
async function fetchOuraAPI(url, headers) {
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`Oura API error (${url}):`, response.status);
            return null;
        }
        return await response.json();
    } catch (err) {
        console.error(`Oura API fetch error (${url}):`, err);
        return null;
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
