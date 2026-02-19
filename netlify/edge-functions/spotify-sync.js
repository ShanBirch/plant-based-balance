import { createClient } from "@supabase/supabase-js";

/**
 * Spotify Data Sync Edge Function
 *
 * POST /api/spotify/sync         { user_id }  → Sync today's listening for one user
 * POST /api/spotify/sync-all                  → Sync all active connections
 * GET  /api/spotify/data?user_id=xxx          → Return stored listening data
 */
export default async (request, context) => {
    const url  = new URL(request.url);
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

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jsonResponse({ error: "Spotify integration not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── GET /api/spotify/now-playing ─────────────────────────────────────────
    if (path === "/api/spotify/now-playing" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) return jsonResponse({ error: "Missing user_id" }, 400);

        const { data: connection } = await supabase
            .from("spotify_connections")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true)
            .single();

        if (!connection) return jsonResponse({ connected: false });

        let accessToken = connection.access_token;
        if (new Date(connection.expires_at) <= new Date(Date.now() + 60_000)) {
            const refreshed = await refreshSpotifyToken(supabase, connection, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
            if (refreshed.error) return jsonResponse({ connected: true, playing: false });
            accessToken = refreshed.access_token;
        }

        try {
            const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
                headers: { "Authorization": `Bearer ${accessToken}` },
            });

            if (res.status === 204 || res.status === 404) {
                return jsonResponse({ connected: true, playing: false });
            }
            if (!res.ok) return jsonResponse({ connected: true, playing: false });

            const data = await res.json();
            if (!data || !data.item) return jsonResponse({ connected: true, playing: false });

            return jsonResponse({
                connected: true,
                playing: data.is_playing,
                track: {
                    id:        data.item.id,
                    name:      data.item.name,
                    artist:    data.item.artists?.map(a => a.name).join(", ") || "Unknown",
                    album:     data.item.album?.name || null,
                    album_art: data.item.album?.images?.[1]?.url || data.item.album?.images?.[0]?.url || null,
                    duration_ms:  data.item.duration_ms,
                    progress_ms:  data.progress_ms,
                    spotify_url:  data.item.external_urls?.spotify || null,
                },
            });
        } catch (err) {
            console.error("Now playing fetch error:", err);
            return jsonResponse({ connected: true, playing: false });
        }
    }

    // ── POST /api/spotify/player ──────────────────────────────────────────────
    // action: "play" | "pause" | "next" | "previous"
    if (path === "/api/spotify/player" && request.method === "POST") {
        try {
            const body   = await request.json();
            const userId = body.user_id;
            const action = body.action;
            if (!userId || !action) return jsonResponse({ error: "Missing user_id or action" }, 400);

            const { data: connection } = await supabase
                .from("spotify_connections")
                .select("*")
                .eq("user_id", userId)
                .eq("is_active", true)
                .single();

            if (!connection) return jsonResponse({ error: "No active Spotify connection" }, 401);

            let accessToken = connection.access_token;
            if (new Date(connection.expires_at) <= new Date(Date.now() + 60_000)) {
                const refreshed = await refreshSpotifyToken(supabase, connection, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
                if (refreshed.error) return jsonResponse({ error: "Token refresh failed" }, 500);
                accessToken = refreshed.access_token;
            }

            const headers = {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            };

            let endpoint, method, fetchBody;
            if (action === "play")          { endpoint = "https://api.spotify.com/v1/me/player/play";     method = "PUT";  }
            else if (action === "pause")    { endpoint = "https://api.spotify.com/v1/me/player/pause";    method = "PUT";  }
            else if (action === "next")     { endpoint = "https://api.spotify.com/v1/me/player/next";     method = "POST"; }
            else if (action === "previous") { endpoint = "https://api.spotify.com/v1/me/player/previous"; method = "POST"; }
            else if (action === "play_uri") {
                if (!body.uri) return jsonResponse({ error: "Missing uri for play_uri action" }, 400);
                endpoint  = "https://api.spotify.com/v1/me/player/play";
                method    = "PUT";
                fetchBody = JSON.stringify({ uris: [body.uri] });
            }
            else return jsonResponse({ error: "Invalid action" }, 400);

            const res = await fetch(endpoint, { method, headers, ...(fetchBody ? { body: fetchBody } : {}) });

            // 204 = success (no content), 403 = not premium
            if (res.status === 204) return jsonResponse({ success: true });
            if (res.status === 403) return jsonResponse({ error: "Spotify Premium required for playback control" }, 403);
            if (!res.ok) {
                const text = await res.text();
                console.error(`Spotify player control error (${action}):`, text);
                return jsonResponse({ error: "Player control failed" }, 500);
            }
            return jsonResponse({ success: true });
        } catch (err) {
            console.error("Spotify player control error:", err);
            return jsonResponse({ error: "Player control failed" }, 500);
        }
    }

    // ── GET /api/spotify/data ────────────────────────────────────────────────
    if (path === "/api/spotify/data" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        if (!userId) return jsonResponse({ error: "Missing user_id" }, 400);

        const { data: connection } = await supabase
            .from("spotify_connections")
            .select("spotify_user_id, display_name, connected_at, last_sync_at, is_active")
            .eq("user_id", userId)
            .eq("is_active", true)
            .single();

        if (!connection) return jsonResponse({ connected: false });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: listening } = await supabase
            .from("spotify_daily_listening")
            .select("*")
            .eq("user_id", userId)
            .gte("date", sevenDaysAgo.toISOString().split("T")[0])
            .order("date", { ascending: false });

        return jsonResponse({
            connected:    true,
            display_name: connection.display_name,
            last_sync:    connection.last_sync_at,
            connected_at: connection.connected_at,
            listening:    listening || [],
        });
    }

    // ── POST /api/spotify/sync ───────────────────────────────────────────────
    if (path === "/api/spotify/sync" && request.method === "POST") {
        try {
            const body   = await request.json();
            const userId = body.user_id;
            if (!userId) return jsonResponse({ error: "Missing user_id" }, 400);

            const result = await syncUserSpotifyData(supabase, userId, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
            return jsonResponse(result);
        } catch (err) {
            console.error("Spotify sync error:", err);
            return jsonResponse({ error: "Sync failed" }, 500);
        }
    }

    // ── POST /api/spotify/sync-all ───────────────────────────────────────────
    if (path === "/api/spotify/sync-all" && request.method === "POST") {
        const { data: connections } = await supabase
            .from("spotify_connections")
            .select("user_id")
            .eq("is_active", true);

        if (!connections?.length) return jsonResponse({ message: "No active connections", synced: 0 });

        let synced = 0, failed = 0;
        for (const conn of connections) {
            try {
                await syncUserSpotifyData(supabase, conn.user_id, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET);
                synced++;
            } catch (err) {
                console.error(`Failed to sync user ${conn.user_id}:`, err);
                failed++;
            }
        }

        return jsonResponse({ synced, failed, total: connections.length });
    }

    return new Response("Not Found", { status: 404 });
};

// ── Core sync logic ───────────────────────────────────────────────────────────

async function syncUserSpotifyData(supabase, userId, clientId, clientSecret) {
    const { data: connection, error: connErr } = await supabase
        .from("spotify_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

    if (connErr || !connection) return { error: "No active Spotify connection" };

    // Refresh token if expired (with 60s buffer)
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date(Date.now() + 60_000)) {
        const refreshed = await refreshSpotifyToken(supabase, connection, clientId, clientSecret);
        if (refreshed.error) return refreshed;
        accessToken = refreshed.access_token;
    }

    const headers = { "Authorization": `Bearer ${accessToken}` };

    // Fetch recently played (last 50 tracks, up to 24h ago)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime();
    const recentRes = await spotifyFetch(
        `https://api.spotify.com/v1/me/player/recently-played?limit=50&after=${since}`,
        headers
    );

    // Fetch user's top artists (short-term) for genre data
    const topArtistsRes = await spotifyFetch(
        "https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5",
        headers
    );

    // Group recently-played by calendar date
    const byDate = {};
    const items  = recentRes?.items || [];

    for (const item of items) {
        if (!item.track || !item.played_at) continue;

        const date      = item.played_at.split("T")[0];
        const durationMs = item.track.duration_ms || 0;

        if (!byDate[date]) byDate[date] = { totalMs: 0, tracks: [], artistNames: new Set() };

        byDate[date].totalMs += durationMs;
        byDate[date].tracks.push({
            name:          item.track.name,
            artist:        item.track.artists?.[0]?.name || "Unknown",
            album_art_url: item.track.album?.images?.[1]?.url || item.track.album?.images?.[0]?.url || null,
            duration_ms:   durationMs,
            spotify_id:    item.track.id || null,
            spotify_uri:   item.track.uri || null,
        });

        item.track.artists?.forEach(a => byDate[date].artistNames.add(a.name));
    }

    // Build top genres from top artists
    const topGenres = [];
    const genreSet  = new Set();
    for (const artist of topArtistsRes?.items || []) {
        for (const genre of artist.genres || []) {
            if (!genreSet.has(genre)) {
                genreSet.add(genre);
                topGenres.push(genre);
            }
        }
    }

    // Upsert one row per date
    for (const [date, data] of Object.entries(byDate)) {
        // Deduplicate tracks by name+artist, keep top 5
        const trackCounts = {};
        for (const t of data.tracks) {
            const key = `${t.name}::${t.artist}`;
            if (!trackCounts[key]) trackCounts[key] = { ...t, plays: 0 };
            trackCounts[key].plays++;
        }
        const topTracks = Object.values(trackCounts)
            .sort((a, b) => b.plays - a.plays)
            .slice(0, 5)
            .map(({ plays, ...t }) => t);

        const topArtists = (topArtistsRes?.items || []).slice(0, 5).map(a => ({
            name:      a.name,
            image_url: a.images?.[1]?.url || a.images?.[0]?.url || null,
        }));

        await supabase.from("spotify_daily_listening").upsert({
            user_id:                  userId,
            date:                     date,
            total_listening_minutes:  Math.round(data.totalMs / 60_000),
            track_count:              Object.keys(trackCounts).length,
            top_tracks:               topTracks,
            top_artists:              topArtists,
            top_genres:               topGenres.slice(0, 8),
            synced_at:                new Date().toISOString(),
        }, { onConflict: "user_id,date" });
    }

    // Update last_sync_at
    await supabase
        .from("spotify_connections")
        .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    return { success: true, dates_synced: Object.keys(byDate).length };
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshSpotifyToken(supabase, connection, clientId, clientSecret) {
    try {
        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`),
            },
            body: new URLSearchParams({
                grant_type:    "refresh_token",
                refresh_token: connection.refresh_token,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Spotify token refresh failed:", errText);
            if (res.status === 400 && errText.includes("invalid_grant")) {
                await supabase
                    .from("spotify_connections")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", connection.user_id);
            }
            return { error: "Token refresh failed — user may need to reconnect" };
        }

        const tokens     = await res.json();
        const expiresAt  = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await supabase.from("spotify_connections").update({
            access_token:  tokens.access_token,
            // Spotify only issues a new refresh token sometimes
            ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
            expires_at:    expiresAt,
            updated_at:    new Date().toISOString(),
        }).eq("user_id", connection.user_id);

        return { access_token: tokens.access_token };
    } catch (err) {
        console.error("Token refresh error:", err);
        return { error: "Token refresh failed" };
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function spotifyFetch(url, headers) {
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
            console.error(`Spotify API error (${url}): ${res.status}`);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error(`Spotify API fetch error (${url}):`, err);
        return null;
    }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
}
