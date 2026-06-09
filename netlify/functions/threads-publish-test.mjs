function getEnv(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name);
  if (netlifyValue) return String(netlifyValue);
  return String(process.env?.[name] || '');
}

function cleanString(value, max = 1000) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max);
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

function graphUrl(apiPath) {
  return `${graphBase()}/${graphVersion()}/${String(apiPath || '').replace(/^\/+/, '')}`;
}

function formBody(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
  }
  return body;
}

async function parseGraphResponse(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = data?.error?.message || text || `threads_graph_${res.status}`;
    const error = new Error(cleanString(message, 1000));
    error.status = res.status;
    error.graph = typeof data === 'object' ? data : null;
    throw error;
  }
  return data;
}

async function graphGet(apiPath, params = {}) {
  const url = new URL(graphUrl(apiPath));
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return await parseGraphResponse(await fetch(url));
}

async function graphPost(apiPath, params = {}) {
  return await parseGraphResponse(await fetch(graphUrl(apiPath), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody(params),
  }));
}

async function publishThreadsText({ text, publish }) {
  const resolved = await resolveThreadsAccessToken();
  const token = resolved.token;
  const userId = cleanString(getEnv('THREADS_USER_ID') || 'me', 120);
  const postText = cleanString(text || 'Testing the Balance Threads publisher.', 500);
  const base = {
    ok: false,
    dryRun: !publish,
    userId,
    graphBase: graphBase(),
    graphVersion: graphVersion(),
    text: postText,
    tokenAvailable: Boolean(token),
    tokenSource: resolved.source,
  };

  if (!postText) return { ...base, error: 'missing_text' };
  if (!token) return { ...base, error: 'missing_threads_access_token' };
  if (!publish) return { ...base, ok: true };

  const container = await graphPost(`${encodeURIComponent(userId)}/threads`, {
    media_type: 'TEXT',
    text: postText,
    access_token: token,
  });
  const creationId = cleanString(container?.id, 120);
  if (!creationId) throw new Error('Threads did not return a media container id.');

  const published = await graphPost(`${encodeURIComponent(userId)}/threads_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  const threadId = cleanString(published?.id, 120);
  const media = threadId
    ? await graphGet(threadId, {
        fields: 'id,permalink,text,timestamp,media_product_type',
        access_token: token,
      }).catch(error => ({ lookupError: error.message || 'threads_lookup_failed' }))
    : null;

  return {
    ...base,
    ok: true,
    dryRun: false,
    creationId,
    threadId,
    permalink: cleanString(media?.permalink || '', 700),
    media,
  };
}

export default async (req) => {
  const body = await readBody(req);
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  try {
    const publish = body.publish === true;
    return json(200, await publishThreadsText({ text: body.text, publish }));
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || 'threads_publish_test_failed',
      status: error.status || null,
      graph: error.graph || null,
    });
  }
};
