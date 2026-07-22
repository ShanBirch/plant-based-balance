const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'netlify', 'edge-functions', 'upload-story-media.js'),
  'utf8'
);

assert.match(source, /async function uploadStoryMediaToSupabase\(fileBuffer, options = \{\}\)/);
assert.match(source, /storage\/v1\/object\/story-media\/\$\{encodedPath\}/);
assert.match(source, /'x-upsert': 'true'/);
assert.match(source, /storageProvider: 'supabase'/);
assert.match(
  source,
  /if \(!uploadData\) \{[\s\S]*uploadStoryMediaToSupabase\(fileBuffer,[\s\S]*return jsonResponse\(200, fallbackUpload\)/,
  'an exhausted B2 relay must fall back to Supabase storage and return a normal upload response'
);

console.log('feed media storage fallback contract passed');
