const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const messaging = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin-dashboard.html'), 'utf8');
const upload = fs.readFileSync(path.join(root, 'netlify/edge-functions/upload-chat-audio.js'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'netlify/functions/log-lp-event.js'), 'utf8');

assert.match(dashboard, /id="dm-voice-btn"[\s\S]*Record voice message/);
assert.match(dashboard, /id="dm-recording-panel"[\s\S]*Cancel recording[\s\S]*Send voice message/);
assert.match(dashboard, /id:\s*'dm-voice-messages-v1'[\s\S]*sel:\s*'#dm-voice-btn'/);
assert.match(dashboard, /sel:'#dm-voice-btn'[\s\S]*title:'Send a voice message'/);
assert.match(dashboard, /dashboard-script-6-ai_coach_draft_mode_logic_auth\.js\?v=43-home-canvas/);

assert.match(messaging, /navigator\.mediaDevices\.getUserMedia\(\{[\s\S]*echoCancellation:\s*true/);
assert.match(messaging, /const DM_VOICE_MAX_MS = 5 \* 60 \* 1000/);
assert.match(messaging, /const DM_VOICE_MAX_BYTES = 12 \* 1024 \* 1024/);
assert.match(messaging, /fetch\('\/api\/upload-chat-audio'/);
assert.match(messaging, /Authorization:\s*`Bearer \$\{accessToken\}`/);
assert.match(messaging, /`🎤 Voice message \(\$\{formatDmVoiceDuration\(pending\.durationSeconds\)\}\)\\n\[AUDIO:\$\{uploadData\.url\}\]`/);
assert.match(messaging, /audioMatch[\s\S]*<audio controls preload="metadata"/);
assert.match(messaging, /function getDmAudioPlaybackUrl[\s\S]*\/api\/chat-audio\?url=/);
assert.match(messaging, /const playbackUrl = getDmAudioPlaybackUrl\(audioUrl\)/);
assert.match(messaging, /function closeDirectMessageModal\(\) \{\s*cancelDmVoiceRecording\(\)/);
assert.match(messaging, /Couldn’t send\. Tap send to retry\./);

assert.match(upload, /async function authenticateUser\(request\)/);
assert.match(upload, /MAX_AUDIO_BYTES = 12 \* 1024 \* 1024/);
assert.match(upload, /ALLOWED_AUDIO_TYPES = new Set/);
assert.match(upload, /chats\/\$\{userId\}\/voice\//);
assert.match(upload, /path:\s*'\/api\/upload-chat-audio'/);
assert.match(admin, /function renderAdminAppMessageContent\(messageText\)[\s\S]*<audio controls/);

for (const eventName of [
  'dm_voice_record_started',
  'dm_voice_record_cancelled',
  'dm_voice_record_failed',
  'dm_voice_message_sent',
]) {
  assert.match(analytics, new RegExp(eventName));
}

console.log('DM voice message contracts passed');
