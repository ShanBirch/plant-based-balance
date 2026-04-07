import { createClient } from "@supabase/supabase-js";

/**
 * Strava Data Sync Edge Function
 *
 * POST /api/strava/sync { user_id }  → Syncs recent activities for a specific user
 * POST /api/strava/sync-all          → Syncs all active Strava connections
 * GET  /api/strava/data?user_id=xxx  → Returns the user's latest Strava data
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

    const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID");
    const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return new Response(JSON.stringify({ error: "Strava integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ===== Get user's Strava data =====
    if (path === "/api/strava/data" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return jsonResponse({ error: "Missing user_id" }, 400);
        }

        try {
            const { data: connection } = await supabase
                .from("strava_connections")
                .select("strava_athlete_id, connected_at, last_sync_at, is_active")
                .eq("user_id", userId)
                .eq("is_active", true)
                .single();

            if (!connection) {
                return jsonResponse({ connected: false });
            }

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const dateStr = sevenDaysAgo.toISOString().split("T")[0];

            const { data: activities } = await supabase
                .from("strava_activities")
                .select("*")
                .eq("user_id", userId)
                .gte("date", dateStr)
                .order("date", { ascending: false });

            return jsonResponse({
                connected: true,
                last_sync: connection.last_sync_at,
                connected_at: connection.connected_at,
                activities: activities || [],
            });

        } catch (err) {
            console.error("Strava data fetch error:", err);
            return jsonResponse({ error: "Failed to fetch data" }, 500);
        }
    }

    // ===== Sync single user =====
    if (path === "/api/strava/sync" && request.method === "POST") {
        try {
            const body = await request.json();
            const userId = body.user_id;

            if (!userId) {
                return jsonResponse({ error: "Missing user_id" }, 400);
            }

            const result = await syncUserStravaData(supabase, userId, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET);
            return jsonResponse(result);

        } catch (err) {
            console.error("Strava sync error:", err);
            return jsonResponse({ error: "Sync failed" }, 500);
        }
    }

    // ===== Sync all active connections =====
    if (path === "/api/strava/sync-all" && request.method === "POST") {
        try {
            const { data: connections } = await supabase
                .from("strava_connections")
                .select("user_id")
                .eq("is_active", true);

            if (!connections || connections.length === 0) {
                return jsonResponse({ message: "No active connections", synced: 0 });
            }

            let synced = 0;
            let failed = 0;

            for (const conn of connections) {
                try {
                    await syncUserStravaData(supabase, conn.user_id, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET);
                    synced++;
                } catch (err) {
                    console.error(`Failed to sync Strava user ${conn.user_id}:`, err);
                    failed++;
                }
            }

            return jsonResponse({ synced, failed, total: connections.length });

        } catch (err) {
            console.error("Strava sync-all error:", err);
            return jsonResponse({ error: "Sync-all failed" }, 500);
        }
    }

    return new Response("Not Found", { status: 404 });
};

/**
 * Sync Strava data for a single user
 */
async function syncUserStravaData(supabase, userId, clientId, clientSecret) {
    const { data: connection, error: connError } = await supabase
        .from("strava_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

    if (connError || !connection) {
        return { error: "No active Strava connection" };
    }

    // Strava tokens expire every 6 hours - always check
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date()) {
        const refreshResult = await refreshStravaToken(supabase, connection, clientId, clientSecret);
        if (refreshResult.error) {
            return refreshResult;
        }
        accessToken = refreshResult.access_token;
    }

    const headers = { "Authorization": `Bearer ${accessToken}` };

    // Fetch recent activities (last 7 days)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const activitiesData = await fetchStravaAPI(
        `https://www.strava.com/api/v3/athlete/activities?after=${sevenDaysAgo}&per_page=30`,
        headers
    );

    if (activitiesData && Array.isArray(activitiesData)) {
        for (const activity of activitiesData) {
            const activityDate = activity.start_date_local
                ? activity.start_date_local.split("T")[0]
                : new Date(activity.start_date).toISOString().split("T")[0];

            await supabase.from("strava_activities").upsert({
                user_id: userId,
                strava_activity_id: String(activity.id),
                date: activityDate,
                name: activity.name || "Activity",
                sport_type: activity.sport_type || activity.type || "Unknown",
                distance_meters: activity.distance || 0,
                moving_time_seconds: activity.moving_time || 0,
                elapsed_time_seconds: activity.elapsed_time || 0,
                total_elevation_gain: activity.total_elevation_gain || 0,
                avg_speed: activity.average_speed || 0,
                max_speed: activity.max_speed || 0,
                avg_heart_rate: activity.average_heartrate || null,
                max_heart_rate: activity.max_heartrate || null,
                calories: activity.calories || 0,
                suffer_score: activity.suffer_score || null,
                start_time: activity.start_date || null,
                synced_at: new Date().toISOString(),
            }, { onConflict: "strava_activity_id" });
        }
    }

    // Update last_sync_at
    await supabase
        .from("strava_connections")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    return { success: true, activities_synced: activitiesData?.length || 0 };
}

/**
 * Refresh an expired Strava access token
 * Note: Strava tokens expire every 6 hours
 */
async function refreshStravaToken(supabase, connection, clientId, clientSecret) {
    try {
        const response = await fetch("https://www.strava.com/oauth/token", {
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
            console.error("Strava token refresh failed:", errText);

            if (response.status === 401 || errText.includes("invalid_grant")) {
                await supabase
                    .from("strava_connections")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", connection.user_id);
            }

            return { error: "Token refresh failed - user may need to reconnect" };
        }

        const tokens = await response.json();
        // Strava returns expires_at as unix timestamp
        const expiresAt = new Date(tokens.expires_at * 1000).toISOString();

        await supabase
            .from("strava_connections")
            .update({
                access_token: tokens.access_token,
                // Strava may return a new refresh token - always persist the latest
                refresh_token: tokens.refresh_token || connection.refresh_token,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", connection.user_id);

        return { access_token: tokens.access_token };

    } catch (err) {
        console.error("Strava token refresh error:", err);
        return { error: "Token refresh failed" };
    }
}

/**
 * Fetch data from Strava API with error handling
 */
async function fetchStravaAPI(url, headers) {
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`Strava API error (${url}):`, response.status);
            return null;
        }
        return await response.json();
    } catch (err) {
        console.error(`Strava API fetch error (${url}):`, err);
        return null;
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
