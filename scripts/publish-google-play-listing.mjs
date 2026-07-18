import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.fitgotchi.app';
const credentialsJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
if (!credentialsJson) throw new Error('Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');

const root = process.cwd();
const sourceLocale = path.join(root, 'store-listing', 'google-play', 'en-AU');
const languages = ['en-AU', 'en-US'];
const read = async (file) => (await fs.readFile(path.join(sourceLocale, file), 'utf8')).trim();
const title = await read('title.txt');
const shortDescription = await read('short_description.txt');
const fullDescription = await read('full_description.txt');

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson),
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const androidpublisher = google.androidpublisher({ version: 'v3', auth });
const editResponse = await androidpublisher.edits.insert({ packageName, requestBody: {} });
const editId = editResponse.data.id;
if (!editId) throw new Error('Google Play did not return an edit ID');

async function replaceImages(language, imageType, files) {
  await androidpublisher.edits.images.deleteall({ packageName, editId, language, imageType });
  for (const file of files) {
    await androidpublisher.edits.images.upload({
      packageName,
      editId,
      language,
      imageType,
      media: { mimeType: 'image/png', body: createReadStream(file) },
    });
  }
}

const screenshotDir = path.join(sourceLocale, 'images', 'phoneScreenshots');
const screenshots = (await fs.readdir(screenshotDir))
  .filter((file) => file.endsWith('.png'))
  .sort()
  .map((file) => path.join(screenshotDir, file));
const featureGraphic = path.join(sourceLocale, 'images', 'featureGraphic.png');

for (const language of languages) {
  await androidpublisher.edits.listings.update({
    packageName,
    editId,
    language,
    requestBody: { title, shortDescription, fullDescription },
  });
  await replaceImages(language, 'phoneScreenshots', screenshots);
  await replaceImages(language, 'featureGraphic', [featureGraphic]);
  console.log(`Prepared Google Play listing: ${language}`);
}

await androidpublisher.edits.validate({ packageName, editId });
await androidpublisher.edits.commit({ packageName, editId });
console.log(`Committed Google Play listing edit ${editId}`);
