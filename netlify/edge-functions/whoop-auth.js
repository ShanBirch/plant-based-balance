import { createClient } from "@supabase/supabase-js";

/**
 * WHOOP OAuth 2.0 Authorization Flow
 *
 * GET  /api/whoop/auth?user_id=xxx          → Redirects user to WHOOP authorization page
 * GET  /api/whoop/callback?code=xxx&state=xxx → Handles OAuth callback from WHOOP
 * POST /api/whoop/disconnect                 → Disconnects WHOOP account
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

    const WHOOP_CLIENT_ID = Deno.env.get("WHOOP_CLIENT_ID");
    const WHOOP_CLIENT_SECRET = Deno.env.get("WHOOP_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_URL = Deno.env.get("URL") || "https://plantbased-balance.org";

    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "WHOOP integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    // ===== STEP 1: Start Authorization =====
    if (path === "/api/whoop/auth") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return new Response("Missing user_id", { status: 400 });
        }

        // State must be 8+ characters for WHOOP
        const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }));

        const authUrl = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", WHOOP_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/whoop/callback`);
        authUrl.searchParams.set("scope", "read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement offline");
        authUrl.searchParams.set("state", state);

        return Response.redirect(authUrl.toString(), 302);
    }

    // ===== STEP 2: Handle Callback =====
    if (path === "/api/whoop/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
            return Response.redirect(`${SITE_URL}/dashboard.html?whoop=denied`, 302);
        }

        if (!code || !state) {
            return Response.redirect(`${SITE_URL}/dashboard.html?whoop=error`, 302);
        }

        let stateData;
        try {
            stateData = JSON.parse(atob(state));
        } catch {
            return Response.redirect(`${SITE_URL}/dashboard.html?whoop=error`, 302);
        }

        const userId = stateData.user_id;
        if (!userId) {
            return Response.redirect(`${SITE_URL}/dashboard.html?whoop=error`, 302);
        }

        try {
            // Exchange authorization code for tokens
            const tokenResponse = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: `${SITE_URL}/api/whoop/callback`,
                    client_id: WHOOP_CLIENT_ID,
                    client_secret: WHOOP_CLIENT_SECRET,
                }),
            });

            if (!tokenResponse.ok) {
                console.error("WHOOP token exchange failed:", await tokenResponse.text());
                return Response.redirect(`${SITE_URL}/dashboard.html?whoop=error`, 302);
            }

            const tokens = await tokenResponse.json();
            const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

            // Get WHOOP user profile
            let whoopUserId = "unknown";
            try {
                const profileRes = await fetch("https://api.prod.whoop.com/developer/v1/user/profile/basic", {
                    headers: { "Authorization": `Bearer ${tokens.access_token}` },
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    whoopUserId = String(profile.user_id);
                }
            } catch {}

            // Store tokens in Supabase
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            const { error: dbError } = await supabase
                .from("whoop_connections")
                .upsert({
                    user_id: userId,
                    whoop_user_id: whoopUserId,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type || "Bearer",
                    expires_at: expiresAt,
                    scope: tokens.scope || "",
                    is_active: true,
                    connected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            if (dbError) {
                console.error("Failed to store WHOOP tokens:", dbError);
                return Response.redirect(`${SITE_URL}/dashboard.html?whoop=error`, 302);
            }

            // Trigger initial data sync (non-blocking)
            fetch(`${SITE_URL}/api/whoop/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            }).catch(() => {});

            return Response.redirect(`${SITE_URL}/dashboard.html?whoop=connected`, 302);

        } catch (err) {
            console.error("WHOOP callback error:", err);
            return Response.redirect(`${SITE_URL}/dashboard.html?whoop=error`, 302);
        }
    }

    // ===== Disconnect WHOOP =====
    if (path === "/api/whoop/disconnect" && request.method === "POST") {
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

            // Delete the connection
            await supabase
                .from("whoop_connections")
                .delete()
                .eq("user_id", userId);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });

        } catch (err) {
            console.error("WHOOP disconnect error:", err);
            return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    }

    return new Response("Not Found", { status: 404 });
};
