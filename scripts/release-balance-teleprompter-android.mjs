import { sign } from 'node:crypto';

const packageName = 'com.balance.teleprompter';
const account = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '{}');
if (!account.client_email || !account.private_key) throw new Error('Google Play release credentials are missing.');
const versionCode = process.env.ANDROID_VERSION_CODE;
if (!/^\d+$/.test(versionCode || '')) throw new Error('A built Android version code is required.');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${encode({alg: 'RS256', typ: 'JWT'})}.${encode({iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600})}`;
const assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url')}`;
const authResponse = await fetch('https://oauth2.googleapis.com/token', {method:'POST', body: new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion})});
if (!authResponse.ok) throw new Error(`Google Play authentication failed (${authResponse.status}).`);
const {access_token: token} = await authResponse.json();
const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`;
async function api(url, method = 'GET', body) {
  const response = await fetch(url, {method, headers: {Authorization: `Bearer ${token}`, 'Content-Type':'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Play ${method} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}
const edit = await api(root, 'POST', {});
let committed = false;
try {
  const {tracks = []} = await api(`${root}/${edit.id}/tracks`);
  console.log('Current Play tracks:', JSON.stringify(tracks));
  const production = tracks.find(track => track.track === 'production');
  const active = production?.releases?.find(release => ['completed','inProgress'].includes(release.status));
  if (!active) {
    console.log('PLAY_RELEASE_ACTION_REQUIRED: The updated bundle is uploaded as an internal testing draft. No active production release exists. Complete the first production release and any required testing in Google Play Console.');
  } else {
    const highest = Math.max(...production.releases.flatMap(release => (release.versionCodes || []).map(Number)));
    if (Number(versionCode) <= highest) throw new Error('Refusing to replace an equal or newer production version.');
    const release = {name: `Gallery saving and safe areas (${versionCode})`, versionCodes: [versionCode], status: active.status,
      releaseNotes: [{language:'en-AU', text:'Save recordings directly to your photo library. Fixed controls overlapping the status bar and improved recording save feedback.'}]};
    if (active.status === 'inProgress') release.userFraction = active.userFraction;
    await api(`${root}/${edit.id}/tracks/production`, 'PUT', {track:'production', releases:[release]});
    await api(`${root}/${edit.id}:validate`, 'POST', {});
    await api(`${root}/${edit.id}:commit`, 'POST', {});
    committed = true;
    console.log(`PLAY_PRODUCTION_SUBMITTED: version ${versionCode}; ${active.status}. Google review and publishing controls may delay availability.`);
  }
} finally {
  if (!committed) await api(`${root}/${edit.id}`, 'DELETE').catch(() => {});
}
