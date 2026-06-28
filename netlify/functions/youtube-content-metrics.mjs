const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_API_URL = 'https://www.googleapis.com/youtube/v3/videos';
const ANALYTICS_API_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';

function getEnv(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name);
  if (netlifyValue) return String(netlifyValue);
  return String(process.env?.[name] || '');
}

function cleanString(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function json(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getHeader(req, name) {
  return cleanString(req.headers.get(name), 1000);
}

function secrets() {
  return [
    getEnv('BALANCE_CONTENT_AUTOMATION_SECRET'),
    getEnv('IG_STORY_BOT_BRIDGE_SECRET'),
    getEnv('META_IG_SYNC_SECRET'),
  ].map(value => cleanString(value, 500)).filter(Boolean);
}

function isAuthorized(req, body = {}) {
  if (getEnv('CONTEXT') === 'dev') return true;
  const provided = cleanString(
    getHeader(req, 'x-balance-content-secret')
      || getHeader(req, 'x-ig-story-secret')
      || body.secret,
    500
  );
  return Boolean(provided && secrets().includes(provided));
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function formBody(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
  }
  return body;
}

function isoDate(daysAgo) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function normalizeVideoId(value) {
  const text = cleanString(value, 200);
  const shorts = text.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
  if (shorts) return shorts[1];
  const watch = text.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
  if (watch) return watch[1];
  const bare = text.match(/^[A-Za-z0-9_-]{6,}$/);
  return bare ? text : '';
}

async function refreshAccessToken() {
  const clientId = getEnv('YOUTUBE_CLIENT_ID');
  const clientSecret = getEnv('YOUTUBE_CLIENT_SECRET');
  const refreshToken = getEnv('YOUTUBE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('missing_youtube_oauth_env');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `youtube_oauth_${res.status}`);
  }
  return {
    accessToken: data.access_token,
    scope: cleanString(data.scope || '', 500),
    expiresIn: Number(data.expires_in || 0),
  };
}

async function fetchJson(url, accessToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.error_description || data?.error || `youtube_api_${res.status}`;
    throw new Error(String(message).slice(0, 500));
  }
  return data;
}

async function fetchVideoStats(videoId, accessToken) {
  const params = new URLSearchParams({
    part: 'snippet,statistics,status,contentDetails',
    id: videoId,
  });
  const data = await fetchJson(`${DATA_API_URL}?${params}`, accessToken);
  const item = data.items?.[0] || null;
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet?.title || '',
    publishedAt: item.snippet?.publishedAt || null,
    privacyStatus: item.status?.privacyStatus || '',
    duration: item.contentDetails?.duration || '',
    statistics: {
      viewCount: Number(item.statistics?.viewCount || 0),
      likeCount: Number(item.statistics?.likeCount || 0),
      commentCount: Number(item.statistics?.commentCount || 0),
      favoriteCount: Number(item.statistics?.favoriteCount || 0),
    },
  };
}

async function fetchAnalytics(videoId, accessToken, startDate, endDate) {
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
    dimensions: 'video',
    filters: `video==${videoId}`,
  });
  const data = await fetchJson(`${ANALYTICS_API_URL}?${params}`, accessToken);
  return {
    columns: data.columnHeaders?.map(column => column.name) || [],
    rows: data.rows || [],
    totals: data.rows?.[0] || null,
    startDate,
    endDate,
  };
}

export default async (req) => {
  const body = await readBody(req);
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  const videoId = normalizeVideoId(body.videoId || body.url || body.shortsUrl);
  if (!videoId) return json(400, { ok: false, error: 'missing_video_id' });

  const startDate = cleanString(body.startDate || '', 20) || isoDate(30);
  const endDate = cleanString(body.endDate || '', 20) || isoDate(0);

  try {
    const token = await refreshAccessToken();
    const [video, analytics] = await Promise.all([
      fetchVideoStats(videoId, token.accessToken),
      fetchAnalytics(videoId, token.accessToken, startDate, endDate),
    ]);

    return json(200, {
      ok: true,
      videoId,
      video,
      analytics,
      token: {
        scope: token.scope,
        expiresIn: token.expiresIn,
      },
    });
  } catch (error) {
    return json(500, {
      ok: false,
      videoId,
      error: error.message || 'youtube_content_metrics_failed',
    });
  }
};

