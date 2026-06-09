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

function graphBase() {
  return cleanString(getEnv('THREADS_GRAPH_BASE') || 'https://graph.threads.net', 200).replace(/\/+$/, '');
}

function graphVersion() {
  const raw = cleanString(getEnv('THREADS_GRAPH_VERSION') || 'v1.0', 40);
  return raw.startsWith('v') ? raw : `v${raw}`;
}

function supabaseUrl() {
  return cleanString(getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL'), 300).replace(/\/+$/, '');
}

function serviceKey() {
  return cleanString(getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY'), 5000);
}

async function readPrivateSecret(key) {
  if (!supabaseUrl() || !serviceKey()) return '';
  const url = `${supabaseUrl()}/rest/v1/app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
    },
  });
  if (!res.ok) return '';
  const rows = await res.json().catch(() => []);
  return cleanString(rows?.[0]?.value, 5000);
}

async function resolveThreadsAccessToken() {
  const envToken = cleanString(getEnv('THREADS_ACCESS_TOKEN'), 5000);
  if (envToken) return { token: envToken, source: 'env' };
  const secretToken = await readPrivateSecret('threads_access_token');
  if (secretToken) return { token: secretToken, source: 'supabase:app_private_secrets' };
  return { token: '', source: 'none' };
}

async function checkThreadsAuth() {
  const resolved = await resolveThreadsAccessToken();
  const token = resolved.token;
  const configuredUserId = cleanString(getEnv('THREADS_USER_ID'), 120);
  const envState = {
    THREADS_ACCESS_TOKEN: { present: Boolean(token), length: token.length },
    THREADS_ACCESS_TOKEN_SOURCE: resolved.source,
    THREADS_USER_ID: { present: Boolean(configuredUserId), value: configuredUserId || null },
    THREADS_GRAPH_BASE: graphBase(),
    THREADS_GRAPH_VERSION: graphVersion(),
  };

  if (!token) {
    return { ok: false, env: envState, error: 'missing_threads_access_token' };
  }

  const url = new URL(`${graphBase()}/${graphVersion()}/me`);
  url.searchParams.set('fields', 'id,username');
  url.searchParams.set('access_token', token);

  const res = await fetch(url);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = {};
  }

  if (!res.ok) {
    return {
      ok: false,
      env: envState,
      status: res.status,
      error: cleanString(data?.error?.message || `threads_graph_${res.status}`, 500),
      code: data?.error?.code || null,
      type: cleanString(data?.error?.type || '', 100) || null,
    };
  }

  return {
    ok: true,
    env: envState,
    profile: {
      id: cleanString(data?.id, 120),
      username: cleanString(data?.username, 120),
      matchesConfiguredUserId: configuredUserId ? configuredUserId === cleanString(data?.id, 120) : null,
    },
  };
}

export default async (req) => {
  const body = await readBody(req);
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  try {
    return json(200, await checkThreadsAuth());
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || 'threads_auth_check_failed',
    });
  }
};
