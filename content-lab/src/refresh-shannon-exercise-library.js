#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'content-lab', 'data', 'shannon-exercise-library.json');
const BUCKET_NAME = process.env.B2_BUCKET_NAME || 'plantbasedbalancestories';
const SOURCE_FOLDERS = [
  {
    prefix: 'balance-social/app-exercise-videos/',
    collection: 'app_exercise_videos',
    priority: 1,
    classification: 'shannon_confirmed_collection',
  },
  {
    prefix: 'balance-social/reels-ready/videos/',
    collection: 'reels_ready_videos',
    priority: 2,
    classification: 'shannon_confirmed_collection',
  },
];

function isVideo(fileName) {
  return /\.(mp4|mov|m4v|webm)$/i.test(fileName);
}

function encodeFileName(fileName) {
  return fileName.split('/').map(encodeURIComponent).join('/');
}

function exerciseName(fileName) {
  return path.basename(fileName)
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[-_\s]+/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizedFileKey(fileName) {
  return path.basename(fileName)
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[-_\s]+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function authorize() {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  if (!keyId || !applicationKey) {
    throw new Error('B2_KEY_ID and B2_APPLICATION_KEY are required');
  }

  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${applicationKey}`).toString('base64')}`,
    },
  });
  if (!response.ok) throw new Error(`Backblaze authorization failed (${response.status})`);
  return response.json();
}

async function listFolder(auth, folder) {
  const files = [];
  let nextFileName;

  do {
    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucketId: auth.allowed.bucketId,
        prefix: folder.prefix,
        maxFileCount: 10000,
        ...(nextFileName ? { startFileName: nextFileName } : {}),
      }),
    });
    if (!response.ok) throw new Error(`Backblaze file listing failed (${response.status})`);
    const page = await response.json();
    files.push(...(page.files || []).filter((file) => isVideo(file.fileName)));
    nextFileName = page.nextFileName;
  } while (nextFileName);

  return files.map((file) => ({
    exercise: exerciseName(file.fileName),
    normalizedKey: normalizedFileKey(file.fileName),
    url: `${auth.downloadUrl}/file/${encodeURIComponent(BUCKET_NAME)}/${encodeFileName(file.fileName)}`,
    fileName: file.fileName,
    collection: folder.collection,
    performer: 'shannon',
    identityBasis: folder.classification,
    safeForShanFeed: true,
    bytes: file.contentLength,
    uploadedAt: new Date(file.uploadTimestamp).toISOString(),
    priority: folder.priority,
  }));
}

function buildManifest(entries) {
  const byKey = new Map();
  for (const entry of entries.sort((a, b) => (
    a.priority - b.priority || a.fileName.localeCompare(b.fileName)
  ))) {
    const existing = byKey.get(entry.normalizedKey);
    if (!existing) {
      byKey.set(entry.normalizedKey, {
        ...entry,
        alternates: [],
      });
      continue;
    }
    existing.alternates.push({
      url: entry.url,
      fileName: entry.fileName,
      collection: entry.collection,
      bytes: entry.bytes,
      uploadedAt: entry.uploadedAt,
    });
  }

  const primaryEntries = [...byKey.values()]
    .sort((a, b) => a.exercise.localeCompare(b.exercise))
    .map(({ priority, ...entry }) => entry);

  const folderCounts = entries.reduce((counts, entry) => {
    counts[entry.collection] = (counts[entry.collection] || 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    classification: {
      performer: 'shannon',
      safeForShanFeed: true,
      basis: 'Folder-level identity audit with evenly distributed visual frame sampling on 2026-07-29.',
      excludedCollection: 'The separate shannonsvideos bucket-root catalogue contains generic/other demonstrators and is not eligible.',
    },
    sourceFolders: SOURCE_FOLDERS.map(({ priority, ...folder }) => folder),
    summary: {
      sourceFiles: entries.length,
      uniqueExercises: primaryEntries.length,
      alternateFiles: entries.length - primaryEntries.length,
      folderCounts,
    },
    entries: primaryEntries,
  };
}

async function main() {
  const auth = await authorize();
  const folderEntries = await Promise.all(SOURCE_FOLDERS.map((folder) => listFolder(auth, folder)));
  const manifest = buildManifest(folderEntries.flat());
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.summary.uniqueExercises} Shannon exercise clips to ${OUTPUT}`);
  console.log(JSON.stringify(manifest.summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildManifest,
  encodeFileName,
  exerciseName,
  isVideo,
  normalizedFileKey,
};
