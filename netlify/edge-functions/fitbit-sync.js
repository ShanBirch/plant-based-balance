import { createClient } from "@supabase/supabase-js";

/**
 * Fitbit Data Sync Edge Function
 *
 * POST /api/fitbit/sync { user_id }  → Syncs today's data for a specific user
 * POST /api/fitbit/sync-all          → Syncs all active Fitbit connections (for scheduled use)
 * GET  /api/fitbit/data?user_id=xxx  → Returns the user's latest Fitbit data
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

    const FITBIT_CLIENT_ID = Deno.env.get("FITBIT_CLIENT_ID");
    const FITBIT_CLIENT_SECRET = Deno.env.get("FITBIT_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return new Response(JSON.stringify({ error: "Fitbit integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ===== Get user's Fitbit data =====
    if (path === "/api/fitbit/data" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return jsonResponse({ error: "Missing user_id" }, 400);
        }

        try {
            // Check if connected
            const { data: connection } = await supabase
                .from("fitbit_connections")
                .select("fitbit_user_id, connected_at, last_sync_at, is_active")
                .eq("user_id", userId)
                .eq("is_active", true)
                .single();

            if (!connection) {
                return jsonResponse({ connected: false });
            }

            // Get last 7 days of data
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const dateStr = sevenDaysAgo.toISOString().split("T")[0];

            const [activityRes, sleepRes, heartRes] = await Promise.all([
                supabase
                    .from("fitbit_daily_activity")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
                supabase
                    .from("fitbit_sleep")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("date", dateStr)
                    .order("date", { ascending: false }),
                supabase
                    .from("fitbit_heart_rate")
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
                heart_rate: heartRes.data || [],
            });

        } catch (err) {
            console.error("Fitbit data fetch error:", err);
            return jsonResponse({ error: "Failed to fetch data" }, 500);
        }
    }

    // ===== Sync single user =====
    if (path === "/api/fitbit/sync" && request.method === "POST") {
        try {
            const body = await request.json();
            const userId = body.user_id;

            if (!userId) {
                return jsonResponse({ error: "Missing user_id" }, 400);
            }

            const result = await syncUserFitbitData(supabase, userId, FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET);
            return jsonResponse(result);

        } catch (err) {
            console.error("Fitbit sync error:", err);
            return jsonResponse({ error: "Sync failed" }, 500);
        }
    }

    // ===== Sync all active connections =====
    if (path === "/api/fitbit/sync-all" && request.method === "POST") {
        try {
            const { data: connections } = await supabase
                .from("fitbit_connections")
                .select("user_id")
                .eq("is_active", true);

            if (!connections || connections.length === 0) {
                return jsonResponse({ message: "No active connections", synced: 0 });
            }

            let synced = 0;
            let failed = 0;

            for (const conn of connections) {
                try {
                    await syncUserFitbitData(supabase, conn.user_id, FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET);
                    synced++;
                } catch (err) {
                    console.error(`Failed to sync user ${conn.user_id}:`, err);
                    failed++;
                }
            }

            return jsonResponse({ synced, failed, total: connections.length });

        } catch (err) {
            console.error("Fitbit sync-all error:", err);
            return jsonResponse({ error: "Sync-all failed" }, 500);
        }
    }

    return new Response("Not Found", { status: 404 });
};

/**
 * Sync Fitbit data for a single user
 */
async function syncUserFitbitData(supabase, userId, clientId, clientSecret) {
    // Get connection
    const { data: connection, error: connError } = await supabase
        .from("fitbit_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

    if (connError || !connection) {
        return { error: "No active Fitbit connection" };
    }

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date()) {
        const refreshResult = await refreshFitbitToken(supabase, connection, clientId, clientSecret);
        if (refreshResult.error) {
            return refreshResult;
        }
        accessToken = refreshResult.access_token;
    }

    const today = new Date().toISOString().split("T")[0];
    const headers = { "Authorization": `Bearer ${accessToken}` };

    // Fetch data from Fitbit API in parallel
    const [activityData, sleepData, heartData] = await Promise.all([
        fetchFitbitAPI(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, headers),
        fetchFitbitAPI(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`, headers),
        fetchFitbitAPI(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`, headers),
    ]);

    // Store activity data
    if (activityData && activityData.summary) {
        const s = activityData.summary;
        await supabase.from("fitbit_daily_activity").upsert({
            user_id: userId,
            date: today,
            steps: s.steps || 0,
            calories_burned: s.caloriesOut || 0,
            distance: s.distances?.find(d => d.activity === "total")?.distance || 0,
            active_minutes: (s.fairlyActiveMinutes || 0) + (s.veryActiveMinutes || 0),
            floors: s.floors || 0,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Store sleep data
    if (sleepData && sleepData.summary) {
        const summary = sleepData.summary;
        const mainSleep = sleepData.sleep?.find(s => s.isMainSleep) || sleepData.sleep?.[0];

        await supabase.from("fitbit_sleep").upsert({
            user_id: userId,
            date: today,
            start_time: mainSleep?.startTime || null,
            end_time: mainSleep?.endTime || null,
            duration_minutes: summary.totalMinutesAsleep || 0,
            efficiency: mainSleep?.efficiency || null,
            deep_minutes: summary.stages?.deep || 0,
            light_minutes: summary.stages?.light || 0,
            rem_minutes: summary.stages?.rem || 0,
            wake_minutes: summary.stages?.wake || 0,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Store heart rate data
    if (heartData && heartData["activities-heart"]?.[0]) {
        const hr = heartData["activities-heart"][0].value;
        const zones = hr.heartRateZones || [];

        await supabase.from("fitbit_heart_rate").upsert({
            user_id: userId,
            date: today,
            resting_heart_rate: hr.restingHeartRate || null,
            fat_burn_minutes: zones.find(z => z.name === "Fat Burn")?.minutes || 0,
            cardio_minutes: zones.find(z => z.name === "Cardio")?.minutes || 0,
            peak_minutes: zones.find(z => z.name === "Peak")?.minutes || 0,
            out_of_range_minutes: zones.find(z => z.name === "Out of Range")?.minutes || 0,
            synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Update last_sync_at
    await supabase
        .from("fitbit_connections")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    return { success: true, synced_date: today };
}

/**
 * Refresh an expired Fitbit access token
 */
async function refreshFitbitToken(supabase, connection, clientId, clientSecret) {
    try {
        const response = await fetch("https://api.fitbit.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`),
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: connection.refresh_token,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Fitbit token refresh failed:", errText);

            // If refresh fails with invalid_grant, mark connection as inactive
            if (response.status === 401 || errText.includes("invalid_grant")) {
                await supabase
                    .from("fitbit_connections")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", connection.user_id);
            }

            return { error: "Token refresh failed - user may need to reconnect" };
        }

        const tokens = await response.json();
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await supabase
            .from("fitbit_connections")
            .update({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", connection.user_id);

        return { access_token: tokens.access_token };

    } catch (err) {
        console.error("Token refresh error:", err);
        return { error: "Token refresh failed" };
    }
}

/**
 * Fetch data from Fitbit API with error handling
 */
async function fetchFitbitAPI(url, headers) {
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`Fitbit API error (${url}):`, response.status);
            return null;
        }
        return await response.json();
    } catch (err) {
        console.error(`Fitbit API fetch error (${url}):`, err);
        return null;
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
