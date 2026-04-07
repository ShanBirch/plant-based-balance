import { createClient } from "@supabase/supabase-js";

/**
 * Fitbit OAuth 2.0 Authorization Flow
 *
 * GET  /api/fitbit/auth?user_id=xxx       → Redirects user to Fitbit authorization page
 * GET  /api/fitbit/callback?code=xxx&state=xxx → Handles OAuth callback from Fitbit
 * POST /api/fitbit/disconnect              → Disconnects Fitbit account
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

    const FITBIT_CLIENT_ID = Deno.env.get("FITBIT_CLIENT_ID");
    const FITBIT_CLIENT_SECRET = Deno.env.get("FITBIT_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_URL = Deno.env.get("URL") || "https://plantbased-balance.org";

    if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Fitbit integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    // ===== STEP 1: Start Authorization =====
    if (path === "/api/fitbit/auth") {
        const userId = url.searchParams.get("user_id");
        if (!userId) {
            return new Response("Missing user_id", { status: 400 });
        }

        // Use state parameter to securely pass user_id through the OAuth flow
        const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }));

        const authUrl = new URL("https://www.fitbit.com/oauth2/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", FITBIT_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/fitbit/callback`);
        authUrl.searchParams.set("scope", "activity heartrate sleep profile");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("prompt", "consent");

        return Response.redirect(authUrl.toString(), 302);
    }

    // ===== STEP 2: Handle Callback =====
    if (path === "/api/fitbit/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        // User denied access
        if (error) {
            return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=denied`, 302);
        }

        if (!code || !state) {
            return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=error`, 302);
        }

        let stateData;
        try {
            stateData = JSON.parse(atob(state));
        } catch {
            return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=error`, 302);
        }

        const userId = stateData.user_id;
        if (!userId) {
            return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=error`, 302);
        }

        try {
            // Exchange authorization code for tokens
            const tokenResponse = await fetch("https://api.fitbit.com/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`),
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: `${SITE_URL}/api/fitbit/callback`,
                }),
            });

            if (!tokenResponse.ok) {
                console.error("Fitbit token exchange failed:", await tokenResponse.text());
                return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=error`, 302);
            }

            const tokens = await tokenResponse.json();

            // Calculate token expiry
            const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

            // Store tokens in Supabase
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            const { error: dbError } = await supabase
                .from("fitbit_connections")
                .upsert({
                    user_id: userId,
                    fitbit_user_id: tokens.user_id,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type,
                    expires_at: expiresAt,
                    scope: tokens.scope,
                    is_active: true,
                    connected_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            if (dbError) {
                console.error("Failed to store Fitbit tokens:", dbError);
                return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=error`, 302);
            }

            // Trigger initial data sync (non-blocking)
            fetch(`${SITE_URL}/api/fitbit/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            }).catch(() => {});

            return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=connected`, 302);

        } catch (err) {
            console.error("Fitbit callback error:", err);
            return Response.redirect(`${SITE_URL}/dashboard.html?fitbit=error`, 302);
        }
    }

    // ===== Disconnect Fitbit =====
    if (path === "/api/fitbit/disconnect" && request.method === "POST") {
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

            // Get the connection to revoke the token
            const { data: connection } = await supabase
                .from("fitbit_connections")
                .select("access_token")
                .eq("user_id", userId)
                .single();

            if (connection) {
                // Revoke the Fitbit token (best effort)
                fetch("https://api.fitbit.com/oauth2/revoke", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": "Basic " + btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`),
                    },
                    body: new URLSearchParams({ token: connection.access_token }),
                }).catch(() => {});
            }

            // Delete the connection
            await supabase
                .from("fitbit_connections")
                .delete()
                .eq("user_id", userId);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });

        } catch (err) {
            console.error("Fitbit disconnect error:", err);
            return new Response(JSON.stringify({ error: "Failed to disconnect" }), {
                status: 500,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }
    }

    return new Response("Not Found", { status: 404 });
};
