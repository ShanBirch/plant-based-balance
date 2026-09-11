import { createHash, sign } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = encode({ alg: 'ES256', kid: process.env.APP_STORE_CONNECT_API_KEY_ID, typ: 'JWT' });
const payload = encode({ iss: process.env.APP_STORE_CONNECT_ISSUER_ID, aud: 'appstoreconnect-v1', exp: Math.floor(Date.now() / 1000) + 1200 });
const key = Buffer.from(process.env.APP_STORE_CONNECT_API_KEY_BASE64, 'base64').toString();
const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const token = `${header}.${payload}.${signature}`;
async function get(path) {
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body.errors)}`);
  return body;
}
const versions = await get('/apps/6761238161/appStoreVersions?filter[platform]=IOS&limit=50');
const result = [];
for (const version of versions.data) {
  const entry = { id: version.id, version: version.attributes.versionString, state: version.attributes.appStoreState, locales: [] };
  const locales = await get(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
  for (const locale of locales.data) {
    const sets = await get(`/appStoreVersionLocalizations/${locale.id}/appScreenshotSets?limit=50`);
    const local = { locale: locale.attributes.locale, sets: [] };
    for (const set of sets.data) {
      const shots = await get(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
      local.sets.push({ id: set.id, display: set.attributes.screenshotDisplayType, screenshots: shots.data.map(s => ({ id: s.id, ...s.attributes })) });
    }
    entry.locales.push(local);
  }
  result.push(entry);
}
await mkdir('work', { recursive: true });
await writeFile('work/app-store-screenshots.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.map(v => ({ ...v, locales: v.locales.map(l => ({ ...l, sets: l.sets.map(s => ({ ...s, screenshots: s.screenshots.map(p => ({ fileName: p.fileName, sourceFileChecksum: p.sourceFileChecksum, assetDeliveryState: p.assetDeliveryState })) })) })) })), null, 2));

if (process.env.VERIFY_SCREENSHOTS === 'true') {
  const version = result.find(v => v.version === process.env.IOS_VERSION_STRING);
  if (!version) throw new Error('Requested App Store version not found');
  const dir = 'store-listing/app-store-screenshots/en-AU';
  const files = (await readdir(dir)).filter(f => f.endsWith('.png')).sort();
  const expected = await Promise.all(files.map(async file => ({ file, md5: createHash('md5').update(await readFile(`${dir}/${file}`)).digest('hex') })));
  for (const locale of ['en-AU', 'en-US']) {
    const sets = version.locales.find(l => l.locale === locale)?.sets;
    const shots = sets?.find(s => s.display === 'APP_IPHONE_67')?.screenshots;
    if (sets?.some(s => s.display !== 'APP_IPHONE_67' && s.screenshots.length)) throw new Error(`Legacy device screenshots remain for ${locale}`);
    if (!shots || shots.length !== expected.length) throw new Error(`Screenshot count mismatch for ${locale}`);
    for (const [i, expectedShot] of expected.entries()) {
      if (shots[i].sourceFileChecksum !== expectedShot.md5 || shots[i].assetDeliveryState?.state !== 'COMPLETE') {
        throw new Error(`Screenshot mismatch or incomplete processing: ${locale} ${expectedShot.file}`);
      }
    }
  }
  console.log('VERIFIED: both English locales contain the exact ordered screenshot files, fully processed.');
}
