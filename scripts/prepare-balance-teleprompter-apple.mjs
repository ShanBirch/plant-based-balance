import { createPrivateKey, sign } from 'node:crypto';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

async function ensureAppStoreProfile(bundleId) {
  const profiles = await request(`/bundleIds/${bundleId.id}/profiles?limit=200`);
  let profile = profiles.data?.find(
    (candidate) =>
      candidate.attributes?.profileType === 'IOS_APP_STORE' &&
      candidate.attributes?.profileState === 'ACTIVE',
  );

  if (!profile) {
    const certificates = await request('/certificates?limit=200');
    const now = Date.now();
    const distributionCertificates = (certificates.data || []).filter((certificate) => {
      const type = certificate.attributes?.certificateType;
      const expiration = Date.parse(certificate.attributes?.expirationDate || '');
      return ['DISTRIBUTION', 'IOS_DISTRIBUTION'].includes(type) && expiration > now;
    });

    if (!distributionCertificates.length) {
      throw new Error('No active Apple Distribution certificate is available for the App Store profile.');
    }

    const created = await request('/profiles', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'profiles',
          attributes: {
            name: `Balance Teleprompter App Store ${new Date().toISOString().slice(0, 10)}`,
            profileType: 'IOS_APP_STORE',
          },
          relationships: {
            bundleId: { data: { type: 'bundleIds', id: bundleId.id } },
            certificates: {
              data: distributionCertificates.map((certificate) => ({
                type: 'certificates',
                id: certificate.id,
              })),
            },
          },
        },
      }),
    });
    profile = created.data;
    console.log(`Created App Store provisioning profile: ${profile.attributes?.name}`);
  } else {
    console.log(`Using App Store provisioning profile: ${profile.attributes?.name}`);
  }

  if (!profile.attributes?.profileContent) {
    profile = (await request(`/profiles/${profile.id}`)).data;
  }

  const profilePath = join(requiredEnv('RUNNER_TEMP'), 'BalanceTeleprompter.mobileprovision');
  await writeFile(profilePath, Buffer.from(profile.attributes.profileContent, 'base64'));
  return { profile, profilePath };
}

const bundleId = await ensureBundleId();
const app = await findApp();
if (!app) {
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, 'app_record_exists=false\n');
  }
  throw new Error(
    `The Apple bundle ID is ready, but the App Store Connect app record for ${bundleIdentifier} does not exist yet.`,
  );
}

const { profile, profilePath } = await ensureAppStoreProfile(bundleId);
console.log(`Found App Store Connect app: ${app.attributes?.name || appName} (${app.id})`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `app_record_exists=true\napp_id=${app.id}\nprovisioning_profile_path=${profilePath}\nprovisioning_profile_name=${profile.attributes.name}\n`,
  );
}
