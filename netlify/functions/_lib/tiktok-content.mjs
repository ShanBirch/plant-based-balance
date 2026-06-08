import crypto from 'crypto';

const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const DEFAULT_SITE_URL = 'https://plantbased-balance.org';
const CONNECTION_KEY = 'balance_owner';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const CREATOR_INFO_URL = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
const DRAFT_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
const PUBLISH_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

export function getEnv(name) {
  const netlifyValue = globalThis.Netlify?.env?.get?.(name);
  if (netlifyValue) return String(netlifyValue);
  return typeof process !== 'undefined' ? String(process.env?.[name] || '') : '';
}

export function cleanString(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

export function json(status, body) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function html(status, body) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function getHeader(req, name) {
  return cleanString(req.headers.get(name), 1000);
}

function secrets() {
  return [
    getEnv('BALANCE_CONTENT_AUTOMATION_SECRET'),
    getEnv('IG_STORY_BOT_BRIDGE_SECRET'),
    getEnv('META_IG_SYNC_SECRET'),
    getEnv('META_WEBHOOK_VERIFY_TOKEN'),
  ].map(value => cleanString(value, 500)).filter(Boolean);
}

export function isAuthorized(req, body = {}) {
  if (getEnv('CONTEXT') === 'dev') return true;
  const provided = cleanString(
    getHeader(req, 'x-balance-content-secret')
      || getHeader(req, 'x-ig-story-secret')
      || body.secret,
    500
  );
  return Boolean(provided && secrets().includes(provided));
}

export function tiktokClientKey() {
  return cleanString(getEnv('TIKTOK_CLIENT_KEY'), 500);
}

export function tiktokClientSecret() {
  return cleanString(getEnv('TIKTOK_CLIENT_SECRET'), 1000);
}

export function tiktokRedirectUri() {
  return cleanString(
    getEnv('TIKTOK_REDIRECT_URI')
      || `${cleanString(getEnv('URL'), 300).replace(/\/+$/, '') || DEFAULT_SITE_URL}/.netlify/functions/tiktok-oauth-callback`,
    500
  );
}

export function requireTikTokEnv() {
  const clientKey = tiktokClientKey();
  const clientSecret = tiktokClientSecret();
  if (!clientKey || !clientSecret) throw new Error('missing_tiktok_client_env');
  return { clientKey, clientSecret, redirectUri: tiktokRedirectUri() };
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hmac(text) {
  const secret = tiktokClientSecret() || secrets()[0] || 'balance-tiktok-state';
  return crypto.createHmac('sha256', secret).update(text).digest('base64url');
}

export function createSignedState(extra = {}) {
  const payload = {
    ...extra,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${hmac(encoded)}`;
}

export function verifySignedState(state) {
  const [encoded, signature] = cleanString(state, 2000).split('.');
  if (!encoded || !signature || hmac(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.exp || Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function formBody(params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
  }
  return body;
}

export async function tokenRequest(params) {
  const { clientKey, clientSecret } = requireTikTokEnv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: formBody({
      client_key: clientKey,
      client_secret: clientSecret,
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error_description || data?.error || `tiktok_oauth_${res.status}`);
  }
  return data;
}

function supabaseUrl() {
  return cleanString(getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL, 300).replace(/\/+$/, '');
}

function serviceKey() {
  return cleanString(getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY'), 5000);
}

async function supabaseFetch(path, options = {}) {
  const key = serviceKey();
  if (!supabaseUrl() || !key) throw new Error('supabase_env_missing');
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`supabase_${res.status}: ${message.slice(0, 500)}`);
  }
  return data || [];
}

async function execSql(sql) {
  try {
    await supabaseFetch('rpc/exec_sql', {
      method: 'POST',
      body: { sql },
    });
  } catch (error) {
    if (!String(error.message || '').includes('Could not find the function')) throw error;
  }
}

export async function ensureTikTokTables() {
  await execSql(`
    CREATE TABLE IF NOT EXISTS public.tiktok_connections (
      connection_key TEXT PRIMARY KEY DEFAULT 'balance_owner',
      open_id TEXT,
      display_name TEXT,
      avatar_url TEXT,
      scope TEXT,
      token_type TEXT DEFAULT 'Bearer',
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      refresh_expires_at TIMESTAMPTZ,
      last_connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_refreshed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;
    CREATE TABLE IF NOT EXISTS public.tiktok_uploads (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      connection_key TEXT NOT NULL DEFAULT 'balance_owner',
      mode TEXT NOT NULL CHECK (mode IN ('draft', 'publish')),
      publish_id TEXT,
      caption TEXT,
      privacy_level TEXT,
      file_name TEXT,
      file_size BIGINT,
      content_type TEXT,
      tiktok_error JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.tiktok_uploads ENABLE ROW LEVEL SECURITY;
  `);
}

function tokenRow(token, profile = {}) {
  const now = Date.now();
  return {
    connection_key: CONNECTION_KEY,
    open_id: cleanString(token.open_id || profile.open_id, 300),
    display_name: cleanString(profile.display_name || '', 300),
    avatar_url: cleanString(profile.avatar_url || '', 1000),
    scope: cleanString(token.scope || '', 1000),
    token_type: cleanString(token.token_type || 'Bearer', 50),
    access_token: cleanString(token.access_token, 5000),
    refresh_token: cleanString(token.refresh_token, 5000),
    expires_at: new Date(now + Math.max(0, Number(token.expires_in || 0) - 60) * 1000).toISOString(),
    refresh_expires_at: token.refresh_expires_in
      ? new Date(now + Math.max(0, Number(token.refresh_expires_in || 0)) * 1000).toISOString()
      : null,
    last_connected_at: new Date().toISOString(),
  };
}

export async function fetchUserInfo(accessToken) {
  try {
    const fields = 'open_id,union_id,avatar_url,display_name,profile_deep_link';
    const res = await fetch(`${USER_INFO_URL}?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    return data?.data?.user || {};
  } catch {
    return {};
  }
}

export async function saveConnection(token, profile = {}) {
  await ensureTikTokTables();
  const rows = await supabaseFetch('tiktok_connections?on_conflict=connection_key', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: tokenRow(token, profile),
  });
  return rows?.[0] || null;
}

export async function getConnection() {
  await ensureTikTokTables();
  const rows = await supabaseFetch(`tiktok_connections?connection_key=eq.${CONNECTION_KEY}&limit=1`);
  return rows?.[0] || null;
}

export async function refreshConnectionIfNeeded(force = false) {
  const connection = await getConnection();
  if (!connection?.refresh_token) throw new Error('tiktok_not_connected');
  const expiresAt = new Date(connection.expires_at || 0).getTime();
  if (!force && expiresAt > Date.now() + 5 * 60 * 1000) return connection;

  const token = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
  });
  const profile = await fetchUserInfo(token.access_token);
  const saved = await saveConnection(token, profile);
  await supabaseFetch(`tiktok_connections?connection_key=eq.${CONNECTION_KEY}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: { last_refreshed_at: new Date().toISOString() },
  });
  return saved;
}

export async function getCreatorInfo(accessToken) {
  const res = await fetch(CREATOR_INFO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error?.code && data.error.code !== 'ok') {
    throw new Error(data?.error?.message || data?.error?.code || `creator_info_${res.status}`);
  }
  return data.data || {};
}

export async function initTikTokUpload({ accessToken, mode, size, caption, privacyLevel, creator = {} }) {
  const sourceInfo = {
    source: 'FILE_UPLOAD',
    video_size: size,
    chunk_size: size,
    total_chunk_count: 1,
  };
  const endpoint = mode === 'publish' ? PUBLISH_INIT_URL : DRAFT_INIT_URL;
  const body = mode === 'publish'
    ? {
        post_info: {
          privacy_level: privacyLevel || 'SELF_ONLY',
          title: caption || '',
          disable_duet: Boolean(creator.duet_disabled),
          disable_stitch: Boolean(creator.stitch_disabled),
          disable_comment: Boolean(creator.comment_disabled),
          brand_content_toggle: false,
          brand_organic_toggle: true,
          is_aigc: false,
        },
        source_info: sourceInfo,
      }
    : { source_info: sourceInfo };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error?.code && data.error.code !== 'ok') {
    const err = new Error(data?.error?.message || data?.error?.code || `tiktok_init_${res.status}`);
    err.tiktok = data;
    throw err;
  }
  return data;
}

export async function uploadBinaryToTikTok(uploadUrl, file, contentType) {
  const size = Number(file.size || 0);
  const buffer = Buffer.from(await file.arrayBuffer());
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      'Content-Range': `bytes 0-${size - 1}/${size}`,
    },
    body: buffer,
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(text || `tiktok_upload_${res.status}`);
  }
  return { status: res.status, body: text };
}

export async function recordUpload(row) {
  await ensureTikTokTables();
  const rows = await supabaseFetch('tiktok_uploads', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      connection_key: CONNECTION_KEY,
      mode: row.mode,
      publish_id: row.publish_id || null,
      caption: cleanString(row.caption, 2200),
      privacy_level: cleanString(row.privacy_level, 100) || null,
      file_name: cleanString(row.file_name, 500) || null,
      file_size: Number(row.file_size || 0) || null,
      content_type: cleanString(row.content_type, 120) || null,
      tiktok_error: row.tiktok_error || null,
    },
  });
  return rows?.[0] || null;
}

export function publicConnection(connection) {
  if (!connection) return { connected: false };
  return {
    connected: true,
    openId: connection.open_id || '',
    displayName: connection.display_name || '',
    avatarUrl: connection.avatar_url || '',
    scope: connection.scope || '',
    expiresAt: connection.expires_at || null,
    refreshExpiresAt: connection.refresh_expires_at || null,
    lastConnectedAt: connection.last_connected_at || null,
    lastRefreshedAt: connection.last_refreshed_at || null,
  };
}

export function buildAuthUrl(scope = 'user.info.basic,video.upload,video.publish') {
  const { clientKey, redirectUri } = requireTikTokEnv();
  const state = createSignedState({ source: 'balance_tiktok_content' });
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope,
    redirect_uri: redirectUri,
    state,
  });
  return {
    authUrl: `${AUTH_URL}?${params}`,
    redirectUri,
    scope,
  };
}
