import { createClient } from "@supabase/supabase-js";

/**
 * Spotify OAuth 2.0 Authorization Flow
 *
 * GET  /api/spotify/auth?user_id=xxx       → Redirect user to Spotify authorization
 * GET  /api/spotify/callback?code=xxx      → Handle OAuth callback, store tokens
 * POST /api/spotify/disconnect             → Disconnect Spotify account
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

    const SPOTIFY_CLIENT_ID     = Deno.env.get("SPOTIFY_CLIENT_ID");
    const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    const SUPABASE_URL          = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    // Derive SITE_URL from the incoming request so the redirect_uri always
    // matches the domain the user is actually on, avoiding Spotify's
    // INVALID_CLIENT: Invalid redirect URI error when the Netlify URL env
    // variable doesn't match the domain registered in the Spotify app.
    const SITE_URL              = `${url.protocol}//${url.host}`;

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Spotify integration not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    // ===== STEP 1: Start Authorization =====
    if (path === "/api/spotify/auth") {
        const userId = url.searchParams.get("user_id");
        if (!userId) return new Response("Missing user_id", { status: 400 });

        const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }));

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", `${SITE_URL}/api/spotify/callback`);
        authUrl.searchParams.set("scope", [
            "user-read-recently-played",
            "user-top-read",
            "user-read-private",
            "user-read-currently-playing",
            "user-read-playback-state",
            "user-modify-playback-state",
        ].join(" "));
        authUrl.searchParams.set("state", state);

        return Response.redirect(authUrl.toString(), 302);
    }

    // ===== STEP 2: Handle Callback =====
    if (path === "/api/spotify/callback") {
        const code  = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) return Response.redirect(`${SITE_URL}/dashboard.html?spotify=denied`, 302);
        if (!code || !state) return Response.redirect(`${SITE_URL}/dashboard.html?spotify=error`, 302);

        let stateData;
        try {
            stateData = JSON.parse(atob(state));
        } catch {
            return Response.redirect(`${SITE_URL}/dashboard.html?spotify=error`, 302);
        }

        const userId = stateData.user_id;
        if (!userId) return Response.redirect(`${SITE_URL}/dashboard.html?spotify=error`, 302);

        try {
            // Exchange code for tokens
            const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
                },
                body: new URLSearchParams({
                    grant_type:   "authorization_code",
                    code:         code,
                    redirect_uri: `${SITE_URL}/api/spotify/callback`,
                }),
            });

            if (!tokenRes.ok) {
                console.error("Spotify token exchange failed:", await tokenRes.text());
                return Response.redirect(`${SITE_URL}/dashboard.html?spotify=error`, 302);
            }

            const tokens = await tokenRes.json();
            const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

            // Fetch Spotify user profile to get display name + ID
            const profileRes = await fetch("https://api.spotify.com/v1/me", {
                headers: { "Authorization": `Bearer ${tokens.access_token}` },
            });
            const profile = profileRes.ok ? await profileRes.json() : {};

            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            const { error: dbError } = await supabase
                .from("spotify_connections")
                .upsert({
                    user_id:         userId,
                    spotify_user_id: profile.id || "unknown",
                    display_name:    profile.display_name || null,
                    access_token:    tokens.access_token,
                    refresh_token:   tokens.refresh_token,
                    token_type:      tokens.token_type || "Bearer",
                    expires_at:      expiresAt,
                    scope:           tokens.scope,
                    is_active:       true,
                    connected_at:    new Date().toISOString(),
                    updated_at:      new Date().toISOString(),
                }, { onConflict: "user_id" });

            if (dbError) {
                console.error("Failed to store Spotify tokens:", dbError);
                return Response.redirect(`${SITE_URL}/dashboard.html?spotify=error`, 302);
            }

            // Trigger initial sync (non-blocking)
            fetch(`${SITE_URL}/api/spotify/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            }).catch(() => {});

            return Response.redirect(`${SITE_URL}/dashboard.html?spotify=connected`, 302);

        } catch (err) {
            console.error("Spotify callback error:", err);
            return Response.redirect(`${SITE_URL}/dashboard.html?spotify=error`, 302);
        }
    }

    // ===== Disconnect =====
    if (path === "/api/spotify/disconnect" && request.method === "POST") {
        try {
            const body   = await request.json();
            const userId = body.user_id;
            if (!userId) return jsonResponse({ error: "Missing user_id" }, 400);

            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            await supabase.from("spotify_connections").delete().eq("user_id", userId);

            return jsonResponse({ success: true });
        } catch (err) {
            console.error("Spotify disconnect error:", err);
            return jsonResponse({ error: "Failed to disconnect" }, 500);
        }
    }

    return new Response("Not Found", { status: 404 });
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
