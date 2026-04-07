import { createClient } from "@supabase/supabase-js";

/**
 * Oura Ring OAuth 2.0 Authorization Flow
 *
 * GET  /api/oura/auth?user_id=xxx          → Redirects user to Oura authorization page
 * GET  /api/oura/callback?code=xxx&state=xxx → Handles OAuth callback from Oura
 * POST /api/oura/disconnect                 → Disconnects Oura account
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

    const OURA_CLIENT_ID = Deno.env.get("OURA_CLIENT_ID");
    const OURA_CLIENT_SECRET = Deno.env.get("OURA_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_URL = Deno.env.get("URL") || "https://plantbased-balance.org";

    if (!OURA_CLIENT_ID || !OURA_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Oura integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    // ===== STEP 1: Start Authorization =====
    if (path === "/api/oura/auth") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return new Response("Missing user_id", { status: 400 });
        }

        const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }));

        const authUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", OURA_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/oura/callback`);
        authUrl.searchParams.set("scope", "daily heartrate workout personal session");
        authUrl.searchParams.set("state", state);

        return Response.redirect(authUrl.toString(), 302);
    }

    // ===== STEP 2: Handle Callback =====
    if (path === "/api/oura/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
            return Response.redirect(`${SITE_URL}/dashboard.html?oura=denied`, 302);
        }

        if (!code || !state) {
            return Response.redirect(`${SITE_URL}/dashboard.html?oura=error`, 302);
        }

        let stateData;
        try {
            stateData = JSON.parse(atob(state));
        } catch {
            return Response.redirect(`${SITE_URL}/dashboard.html?oura=error`, 302);
        }

        const userId = stateData.user_id;
        if (!userId) {
            return Response.redirect(`${SITE_URL}/dashboard.html?oura=error`, 302);
        }

        try {
            // Exchange authorization code for tokens
            // Note: Oura token endpoint is on api.ouraring.com, not cloud.ouraring.com
            const tokenResponse = await fetch("https://api.ouraring.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: `${SITE_URL}/api/oura/callback`,
                    client_id: OURA_CLIENT_ID,
                    client_secret: OURA_CLIENT_SECRET,
                }),
            });

            if (!tokenResponse.ok) {
                console.error("Oura token exchange failed:", await tokenResponse.text());
                return Response.redirect(`${SITE_URL}/dashboard.html?oura=error`, 302);
            }

            const tokens = await tokenResponse.json();
            const expiresAt = new Date(Date.now() + (tokens.expires_in || 2592000) * 1000).toISOString();

            // Get Oura user info
            let ouraUserId = "unknown";
            try {
                const profileRes = await fetch("https://api.ouraring.com/v2/usercollection/personal_info", {
                    headers: { "Authorization": `Bearer ${tokens.access_token}` },
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    ouraUserId = profile.id || profile.email || "unknown";
                }
            } catch {}

            // Store tokens in Supabase
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            const { error: dbError } = await supabase
                .from("oura_connections")
                .upsert({
                    user_id: userId,
                    oura_user_id: ouraUserId,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token || "",
                    token_type: tokens.token_type || "Bearer",
                    expires_at: expiresAt,
                    scope: tokens.scope || "",
                    is_active: true,
                    connected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            if (dbError) {
                console.error("Failed to store Oura tokens:", dbError);
                return Response.redirect(`${SITE_URL}/dashboard.html?oura=error`, 302);
            }

            // Trigger initial data sync (non-blocking)
            fetch(`${SITE_URL}/api/oura/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            }).catch(() => {});

            return Response.redirect(`${SITE_URL}/dashboard.html?oura=connected`, 302);

        } catch (err) {
            console.error("Oura callback error:", err);
            return Response.redirect(`${SITE_URL}/dashboard.html?oura=error`, 302);
        }
    }

    // ===== Disconnect Oura =====
    if (path === "/api/oura/disconnect" && request.method === "POST") {
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

            // Revoke Oura token (best effort)
            const { data: connection } = await supabase
                .from("oura_connections")
                .select("access_token")
                .eq("user_id", userId)
                .single();

            if (connection) {
                fetch(`https://api.ouraring.com/oauth/revoke?access_token=${connection.access_token}`, {
                    method: "POST",
                }).catch(() => {});
            }

            // Delete the connection
            await supabase
                .from("oura_connections")
                .delete()
                .eq("user_id", userId);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });

        } catch (err) {
            console.error("Oura disconnect error:", err);
            return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    }

    return new Response("Not Found", { status: 404 });
};
