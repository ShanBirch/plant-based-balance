import { createPrivateKey, sign } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

const apiBase = 'https://api.appstoreconnect.apple.com/v1';
const bundleIdentifier = 'com.balance.teleprompter';
const appName = 'Balance Teleprompter';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

const keyId = requiredEnv('APP_STORE_CONNECT_API_KEY_ID');
const issuerId = requiredEnv('APP_STORE_CONNECT_ISSUER_ID');
const privateKey = createPrivateKey(
  Buffer.from(requiredEnv('APP_STORE_CONNECT_API_KEY_BASE64'), 'base64').toString('utf8'),
);
const now = Math.floor(Date.now() / 1000);
const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
const payload = base64Url(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1_200, aud: 'appstoreconnect-v1' }));
const unsignedToken = `${header}.${payload}`;
const signature = sign('sha256', Buffer.from(unsignedToken), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
}).toString('base64url');
const token = `${unsignedToken}.${signature}`;

function formatErrors(body) {
  return (body?.errors || [])
    .map((error) => [error.status, error.code, error.title, error.detail].filter(Boolean).join(' - '))
    .join('\n');
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`App Store Connect API ${response.status} for ${path}\n${formatErrors(body) || text}`);
  }
  return body;
}

async function ensureBundleId() {
  const query = new URLSearchParams({ 'filter[identifier]': bundleIdentifier, limit: '1' });
  const existing = await request(`/bundleIds?${query}`);
  if (existing.data?.[0]) {
    console.log(`Bundle ID already registered: ${bundleIdentifier}`);
    return existing.data[0];
  }

  const created = await request('/bundleIds', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: bundleIdentifier,
          name: appName,
          platform: 'IOS',
        },
      },
    }),
  });
  console.log(`Registered Apple bundle ID: ${bundleIdentifier}`);
  return created.data;
}

async function findApp() {
  const query = new URLSearchParams({ 'filter[bundleId]': bundleIdentifier, limit: '1' });
  const result = await request(`/apps?${query}`);
  return result.data?.[0] || null;
}

await ensureBundleId();
const app = await findApp();
if (!app) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, 'app_record_exists=false\n');
  }
  throw new Error(
    `The Apple bundle ID is ready, but the App Store Connect app record for ${bundleIdentifier} does not exist yet.`,
  );
}

console.log(`Found App Store Connect app: ${app.attributes?.name || appName} (${app.id})`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `app_record_exists=true\napp_id=${app.id}\n`);
}
