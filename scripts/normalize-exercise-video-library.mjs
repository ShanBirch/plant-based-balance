#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import vm from 'node:vm';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const catalogPath = join(root, 'exercise_videos.js');
const outputDir = join(root, 'output', 'exercise-video-compat');
const checkpointPath = join(outputDir, 'checkpoint.json');
const manifestPath = join(root, 'data', 'exercise-video-compat-manifest.json');
const prefix = process.env.EXERCISE_VIDEO_COMPAT_PREFIX || 'balance-social/app-exercise-videos/phone-v1';
const concurrency = Math.max(1, Number(process.env.EXERCISE_VIDEO_COMPAT_CONCURRENCY || 4));
const shouldWriteCatalog = process.argv.includes('--write-catalog');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : Infinity;

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function loadCatalog(source) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.__catalog = EXERCISE_VIDEOS;`, context);
  return context.__catalog;
}

function destinationName(sourceUrl) {
  const hash = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24);
  return `${prefix}/${hash}.mp4`;
}

function isRepositoryCompatUrl(url) {
  return String(url).startsWith('/assets/exercise-videos/compat/');
}

function isHostedCompatUrl(url) {
  return String(url).includes(`/file/${process.env.B2_BUCKET_NAME || 'plantbasedbalancestories'}/${prefix}/`);
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 750 * attempt));
  }
  throw lastError || new Error('Request failed');
}

async function authorizeB2() {
  const keyId = requiredEnv('B2_KEY_ID');
  const applicationKey = requiredEnv('B2_APPLICATION_KEY');
  const response = await fetchWithRetry('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${applicationKey}`).toString('base64')}` }
  });
  return response.json();
}

async function getUploadTarget(authData, bucketId) {
  const response = await fetchWithRetry(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: authData.authorizationToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bucketId })
  });
  return response.json();
}

async function uploadFile(authData, bucketId, fileName, bytes) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const target = await getUploadTarget(authData, bucketId);
      const response = await fetch(target.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: target.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(fileName),
          'Content-Type': 'video/mp4',
          'Content-Length': String(bytes.byteLength),
          'X-Bz-Content-Sha1': 'do_not_verify',
          'X-Bz-Info-source': 'balance-phone-compat-v1',
          'X-Bz-Info-b2-cache-control': encodeURIComponent('public, max-age=31536000, immutable')
        },
        body: bytes,
        signal: AbortSignal.timeout(120_000)
      });
      if (response.ok) return response.json();
      lastError = new Error(`B2 upload failed: ${response.status} ${await response.text()}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000 * attempt));
  }
  throw lastError || new Error('B2 upload failed');
}

async function verifyPublishedVideo(publicUrl, expectedSize) {
  const response = await fetchWithRetry(publicUrl, {
    headers: { Range: 'bytes=0-0' }
  });
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const contentRange = String(response.headers.get('content-range') || '');
  const publishedSize = Number((contentRange.match(/\/(\d+)$/) || [])[1] || response.headers.get('content-length') || 0);
  await response.body?.cancel();
  if (!contentType.startsWith('video/mp4')) {
    throw new Error(`Published file has unexpected content type: ${contentType || 'missing'}`);
  }
  if (publishedSize !== expectedSize) {
    throw new Error(`Published file size mismatch: expected ${expectedSize}, got ${publishedSize}`);
  }
}

async function probe(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,has_b_frames',
    '-of', 'json',
    filePath
  ], { maxBuffer: 1024 * 1024 });
  const stream = JSON.parse(stdout).streams?.[0];
  if (!stream) throw new Error(`No readable video stream in ${basename(filePath)}`);
  return stream;
}

function assertPhoneCompatible(stream) {
  const validProfile = /constrained baseline|baseline/i.test(String(stream.profile || ''));
  const validRate = String(stream.r_frame_rate || '') === '24/1';
  if (stream.codec_name !== 'h264' || !validProfile || stream.pix_fmt !== 'yuv420p' || !validRate || Number(stream.has_b_frames || 0) !== 0) {
    throw new Error(`Phone compatibility validation failed: ${JSON.stringify(stream)}`);
  }
  if (Number(stream.width || 0) > 1280 || Number(stream.height || 0) > 1280) {
    throw new Error(`Phone compatibility dimensions exceeded 1280px: ${stream.width}x${stream.height}`);
  }
}

async function transcode(sourcePath, outputPath) {
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', sourcePath,
    '-map', '0:v:0', '-an',
    '-vf', "fps=24,scale='if(gt(iw,ih),min(iw,1280),-2)':'if(gt(iw,ih),-2,min(ih,1280))'",
    '-c:v', 'libx264', '-profile:v', 'baseline', '-level:v', '3.1',
    '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-crf', '26',
    '-maxrate', '4000k', '-bufsize', '8000k',
    '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-movflags', '+faststart',
    outputPath
  ], { maxBuffer: 4 * 1024 * 1024 });
  const stream = await probe(outputPath);
  assertPhoneCompatible(stream);
  return stream;
}

async function readCheckpoint() {
  try {
    return JSON.parse(await readFile(checkpointPath, 'utf8'));
  } catch (_) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      return { version: 1, completed: manifest.entries || {}, failed: {} };
    } catch (_) {
      return { version: 1, completed: {}, failed: {} };
    }
  }
}

async function saveCheckpoint(checkpoint) {
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
}

async function main() {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(outputDir, { recursive: true });

  const source = await readFile(catalogPath, 'utf8');
  const catalog = loadCatalog(source);
  const sourceUrls = [...new Set(Object.values(catalog))]
    .filter(url => !isRepositoryCompatUrl(url) && !isHostedCompatUrl(url))
    .slice(0, limit);
  const checkpoint = await readCheckpoint();
  for (const failedUrl of Object.keys(checkpoint.failed)) {
    if (!sourceUrls.includes(failedUrl)) delete checkpoint.failed[failedUrl];
  }
  if (!sourceUrls.length) {
    console.log('All canonical exercise videos already use the phone-compatible library.');
    return;
  }
  const authData = await authorizeB2();
  const bucketId = requiredEnv('B2_BUCKET_ID');
  const bucketName = requiredEnv('B2_BUCKET_NAME');
  const publicBase = `${authData.downloadUrl}/file/${bucketName}`;
  let next = 0;
  let completedThisRun = 0;
  let failedThisRun = 0;
  let checkpointWrite = Promise.resolve();

  console.log(`Normalizing ${sourceUrls.length} distinct videos with concurrency ${concurrency}.`);

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= sourceUrls.length) return;
      const sourceUrl = sourceUrls[index];
      const fileName = destinationName(sourceUrl);
      const publicUrl = `${publicBase}/${fileName.split('/').map(encodeURIComponent).join('/')}`;

      if (checkpoint.completed[sourceUrl]?.publicUrl === publicUrl) continue;

      const taskDir = await mkdtemp(join(tmpdir(), 'balance-video-compat-'));
      const sourcePath = join(taskDir, 'source-video');
      const outputPath = join(taskDir, 'phone-compatible.mp4');
      try {
        const response = await fetchWithRetry(sourceUrl);
        await writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
        const stream = await transcode(sourcePath, outputPath);
        const bytes = await readFile(outputPath);
        const uploaded = await uploadFile(authData, bucketId, fileName, bytes);
        await verifyPublishedVideo(publicUrl, bytes.byteLength);
        checkpoint.completed[sourceUrl] = {
          publicUrl,
          fileName,
          fileId: uploaded.fileId || '',
          size: bytes.byteLength,
          stream
        };
        delete checkpoint.failed[sourceUrl];
        completedThisRun += 1;
      } catch (error) {
        checkpoint.failed[sourceUrl] = String(error?.message || error);
        failedThisRun += 1;
        console.error(`FAILED ${index + 1}/${sourceUrls.length}: ${sourceUrl} - ${checkpoint.failed[sourceUrl]}`);
      } finally {
        await rm(taskDir, { recursive: true, force: true });
        checkpoint.updatedAt = new Date().toISOString();
        checkpointWrite = checkpointWrite.then(() => saveCheckpoint(checkpoint));
        await checkpointWrite;
      }

      const done = Object.keys(checkpoint.completed).filter(url => sourceUrls.includes(url)).length;
      if ((completedThisRun + failedThisRun) % 10 === 0 || done === sourceUrls.length) {
        console.log(`Progress ${done}/${sourceUrls.length}; failures ${Object.keys(checkpoint.failed).length}.`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await checkpointWrite;

  const unresolved = sourceUrls.filter(url => !checkpoint.completed[url]);
  if (unresolved.length) {
    throw new Error(`${unresolved.length} videos remain unresolved. Re-run to retry; catalogue was not changed.`);
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    profile: 'H.264 Constrained Baseline Level 3.1, yuv420p, CFR 24fps, no audio, faststart',
    entries: checkpoint.completed
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (shouldWriteCatalog) {
    let updated = source;
    for (const sourceUrl of sourceUrls) {
      updated = updated.split(JSON.stringify(sourceUrl)).join(JSON.stringify(checkpoint.completed[sourceUrl].publicUrl));
    }
    await writeFile(catalogPath, updated);
    console.log(`Updated ${catalogPath}.`);
  }

  console.log(`Validated and uploaded ${sourceUrls.length} phone-compatible videos.`);
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
