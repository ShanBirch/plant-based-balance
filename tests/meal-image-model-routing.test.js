const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync(path.join(__dirname, '../netlify/edge-functions/generate-meal-image.ts'), 'utf8');
function load(fetch, env = {}) {
  const js = stripTypeScriptTypes(source).replace('export default async function', 'async function handler');
  const context = vm.createContext({ fetch, Request, Response, console, Deno: { env: { get: key => env[key] } } });
  vm.runInContext(js, context);
  return context;
}
const imageResponse = () => Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] });

test('supported primary preserves the meal photo output contract', async () => {
  const calls = [];
  const ctx = load(async (url, options) => { calls.push({ url, ...options }); return imageResponse(); });
  const image = await ctx.generateImage('test-key', 'fallback-key', 'test meal');
  assert.equal(image.model, 'gpt-image-2.6-flare');
  assert.equal(image.mimeType, 'image/jpeg');
  assert.equal(image.base64, 'aW1hZ2U=');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/images/generations');
  assert.deepEqual(JSON.parse(calls[0].body), { model: 'gpt-image-2.6-flare', prompt: 'test meal', size: '1024x1024', quality: 'medium', output_format: 'jpeg' });
});

test('unavailable primary uses supported secondary, never retired models', async () => {
  const models = [];
  const ctx = load(async (_url, options) => { models.push(JSON.parse(options.body).model); return models.length === 1 ? new Response('unavailable', { status: 404 }) : imageResponse(); });
  const image = await ctx.generateImage('test-key', '', 'test meal');
  assert.deepEqual(models, ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']);
  assert.equal(image.model, 'gpt-image-2.6-sunburst');
});

test('configured Gemini fallback remains available after empty OpenAI outputs', async () => {
  const urls = [];
  const ctx = load(async (url) => { urls.push(url); return url.includes('api.openai.com') ? Response.json({ data: [] }) : Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: 'aW1hZ2U=', mimeType: 'image/png' } }] } }] }); });
  const image = await ctx.generateImage('test-key', 'fallback-key', 'test meal');
  assert.equal(urls.length, 3);
  assert.equal(image.model, 'gemini-3.1-flash-image');
  assert.equal(image.mimeType, 'image/png');
});

test('missing provider configuration fails without a request', async () => {
  const ctx = load(async () => { throw new Error('unexpected request'); });
  await assert.rejects(() => ctx.generateImage('', '', 'test meal'), /No meal photo image provider/);
});

test('authentication remains required before generation', async () => {
  let calls = 0;
  const ctx = load(async () => { calls++; throw new Error('unexpected request'); });
  assert.equal((await ctx.handler(new Request('https://example.test/api/generate-meal-image', { method: 'POST' }), {})).status, 401);
  assert.equal(calls, 0);
});
