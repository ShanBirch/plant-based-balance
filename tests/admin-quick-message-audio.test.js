const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

assert.match(html, /id="admin-reply-audio-input"[^>]+accept="audio\/mpeg,\.mp3"/);
assert.match(html, /fetch\('\/api\/upload-chat-audio'/);
assert.match(html, /Authorization: `Bearer \$\{token\}`/);
assert.match(html, /crypto\.subtle\.digest\('SHA-256', bytes\)/);
assert.match(html, /\.eq\('receiver_id', receiverId\)[\s\S]*\.eq\('reference_id', referenceId\)/);
assert.match(html, /throw new Error\('This exact voice note has already been sent\.'\)/);
assert.match(html, /`🎤 Voice message \(\$\{adminFormatAudioDuration\(duration\)\}\)\\n\[AUDIO:\$\{upload\.url\}\]`/);
assert.match(html, /nudge_type: 'personal'/);
assert.match(html, /reference_id: referenceId/);

console.log('Admin Quick Message audio attachment contract verified.');
