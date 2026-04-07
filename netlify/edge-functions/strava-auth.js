import { createClient } from "@supabase/supabase-js";

/**
 * Strava OAuth 2.0 Authorization Flow
 *
 * GET  /api/strava/auth?user_id=xxx          → Redirects user to Strava authorization page
 * GET  /api/strava/callback?code=xxx&state=xxx → Handles OAuth callback from Strava
 * POST /api/strava/disconnect                 → Disconnects Strava account
 */
export default async (request, context) => {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for POST requests
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
    const SITE_URL = Deno.env.get("URL") || "https://plantbased-balance.org";

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Strava integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    // ===== STEP 1: Start Authorization =====
    if (path === "/api/strava/auth") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return new Response("Missing user_id", { status: 400 });
        }

        const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }));

        const authUrl = new URL("https://www.strava.com/oauth/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", STRAVA_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/strava/callback`);
        authUrl.searchParams.set("scope", "activity:read_all");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("approval_prompt", "auto");

        return Response.redirect(authUrl.toString(), 302);
    }

    // ===== STEP 2: Handle Callback =====
    if (path === "/api/strava/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
            return Response.redirect(`${SITE_URL}/dashboard.html?strava=denied`, 302);
        }

        if (!code || !state) {
            return Response.redirect(`${SITE_URL}/dashboard.html?strava=error`, 302);
        }

        let stateData;
        try {
            stateData = JSON.parse(atob(state));
        } catch {
            return Response.redirect(`${SITE_URL}/dashboard.html?strava=error`, 302);
        }

        const userId = stateData.user_id;
        if (!userId) {
            return Response.redirect(`${SITE_URL}/dashboard.html?strava=error`, 302);
        }

        try {
            // Strava uses POST with JSON body for token exchange
            const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code,
                    client_id: STRAVA_CLIENT_ID,
                    client_secret: STRAVA_CLIENT_SECRET,
                }),
            });

            if (!tokenResponse.ok) {
                console.error("Strava token exchange failed:", await tokenResponse.text());
                return Response.redirect(`${SITE_URL}/dashboard.html?strava=error`, 302);
            }

            const tokens = await tokenResponse.json();
            // Strava returns expires_at as a unix timestamp (not expires_in)
            const expiresAt = new Date(tokens.expires_at * 1000).toISOString();

            const athlete = tokens.athlete || {};

            // Store tokens in Supabase
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            const { error: dbError } = await supabase
                .from("strava_connections")
                .upsert({
                    user_id: userId,
                    strava_athlete_id: String(athlete.id || "unknown"),
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type || "Bearer",
                    expires_at: expiresAt,
                    scope: "activity:read_all",
                    is_active: true,
                    connected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            if (dbError) {
                console.error("Failed to store Strava tokens:", dbError);
                return Response.redirect(`${SITE_URL}/dashboard.html?strava=error`, 302);
            }

            // Trigger initial data sync (non-blocking)
            fetch(`${SITE_URL}/api/strava/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            }).catch(() => {});

            return Response.redirect(`${SITE_URL}/dashboard.html?strava=connected`, 302);

        } catch (err) {
            console.error("Strava callback error:", err);
            return Response.redirect(`${SITE_URL}/dashboard.html?strava=error`, 302);
        }
    }

    // ===== Disconnect Strava =====
    if (path === "/api/strava/disconnect" && request.method === "POST") {
        try {
            const body = await request.json();
            const userId = body.user_id;

            if (!userId) {
                return new Response(JSON.stringify({ error: "Missing user_id" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });
            }

            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            // Revoke Strava token (best effort)
            const { data: connection } = await supabase
                .from("strava_connections")
                .select("access_token")
                .eq("user_id", userId)
                .single();

            if (connection) {
                fetch("https://www.strava.com/oauth/deauthorize", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({ access_token: connection.access_token }),
                }).catch(() => {});
            }

            // Delete the connection
            await supabase
                .from("strava_connections")
                .delete()
                .eq("user_id", userId);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });

        } catch (err) {
            console.error("Strava disconnect error:", err);
            return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    }

    return new Response("Not Found", { status: 404 });
};
