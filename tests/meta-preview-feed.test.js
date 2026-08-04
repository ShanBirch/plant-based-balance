const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const previewFeed = require('../netlify/functions/meta-preview-feed');
const source = fs.readFileSync(path.join(root, 'netlify/functions/meta-preview-feed.js'), 'utf8');

test('Meta preview feed strips internal card JSON down to public display copy', () => {
    assert.equal(
        previewFeed.safeCaption(JSON.stringify({ title: 'Plant-powered lunch', private_notes: 'never expose this' })),
        'Plant-powered lunch'
    );
    assert.equal(previewFeed.safeCaption('  A community win  '), 'A community win');
});

test('Meta preview feed accepts only HTTPS media URLs', () => {
    assert.equal(previewFeed.safeMediaUrl('https://cdn.example.com/post.jpg'), 'https://cdn.example.com/post.jpg');
    assert.equal(previewFeed.safeMediaUrl('http://cdn.example.com/post.jpg'), '');
    assert.equal(previewFeed.safeMediaUrl('javascript:alert(1)'), '');
    assert.equal(previewFeed.safeMediaUrl('data:image/png;base64,abc'), '');
});

test('Meta preview feed is read-only and scoped to verified Shannon accounts', async () => {
    const methodResponse = await previewFeed.handler({ httpMethod: 'POST' });
    assert.equal(methodResponse.statusCode, 405);
    assert.match(source, /SHANNON_ACCOUNT_IDS/);
    assert.match(source, /user_id=in\.\(\$\{accountIds\.join\(','\)\}\)/);
    assert.match(source, /accountIds\.includes\(String\(row\.user_id/);
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
});
