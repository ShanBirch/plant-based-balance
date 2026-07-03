const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
const match = dashboard.match(/const ADMIN_LEARNING_REEL_URL_RE =[\s\S]+?\n\s*function humanizeAutoSendHoldCode/);

assert.ok(match, 'learning reel preview helpers should be present');

const code = match[0].replace(/\r?\n\s*function humanizeAutoSendHoldCode[\s\S]*$/, '');
const context = {
    URL,
    window: {
        location: {
            origin: 'https://plantbased-balance.org',
        },
    },
    currentFeed: 'needs-you',
    isLearningReelApprovalAlert(alert) {
        return !!alert?.data?.learning_reel_approval_required;
    },
    isLearningReelVideoDismissed(alert) {
        return !!alert?.data?.learning_reel_video_dismissed;
    },
    getResolvedAlertMessage(alert) {
        const data = alert?.data || {};
        return String(alert?.suggested_message || data.suggested_message || data.draft_text || '');
    },
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
};

vm.createContext(context);
vm.runInContext(code, context);

const linkHandoffAlert = {
    id: '00000000-0000-4000-8000-000000000001',
    status: 'pending',
    alert_type: 'ig_incoming_dm',
    title: 'Reel for Miranda: workout motivation',
    description: 'Miranda was recently chatting about workout motivation. Suggested reel: "Everyone Is Confused About Training To Failure" by Jeff Nippard. Shannon approval required before send.',
    suggested_message: 'good one for the training mindset\nhttps://www.youtube.com/shorts/VsmSkg2h4d8',
    data: {
        needs_you_reason: 'signup_link_handoff',
        draft_text: 'good one for the training mindset\nhttps://www.youtube.com/shorts/VsmSkg2h4d8',
    },
};

const html = context.renderLearningReelContextStrip(linkHandoffAlert);
assert.match(html, /learning-reel-preview/, 'Needs You link handoffs with a YouTube URL should show an embedded preview');
assert.match(html, /youtube-nocookie\.com\/embed\/VsmSkg2h4d8/, 'preview should use the extracted YouTube video ID');
assert.match(html, /origin=https%3A%2F%2Fplantbased-balance\.org/, 'preview should pass the app origin to YouTube embeds');
assert.match(html, /Open YouTube/, 'preview should include an external fallback link');
assert.match(html, /Dismiss video/, 'preview should include a video-only dismiss action');
assert.match(html, /dismissLearningReelAlert\(event, '00000000-0000-4000-8000-000000000001'\)/, 'preview should include a dismiss button beside the YouTube link');
assert.match(html, /Everyone Is Confused About Training To Failure by Jeff Nippard/, 'preview should infer the reel title from the alert description');

assert.ok(
    dashboard.includes('function buildLearningReelDismissPatch(alert, reel)') &&
    dashboard.includes('learning_reel_video_dismissed = true') &&
    dashboard.includes('removeAdminLearningReelFromText(alert?.suggested_message') &&
    !dashboard.includes("const ok = await dismissAlert(alertId, 'youtube_reel_dismissed');"),
    'video dismiss should clear only the learning reel data and must not dismiss the whole generated response'
);

const dismissedAlert = {
    ...linkHandoffAlert,
    data: {
        ...linkHandoffAlert.data,
        learning_reel_video_dismissed: true,
    },
};
assert.strictEqual(
    context.renderLearningReelContextStrip(dismissedAlert),
    '',
    'dismissed YouTube videos should stop rendering without requiring the alert itself to be dismissed'
);

const reel = context.pickAdminLearningReelForAlert(linkHandoffAlert);
const { update } = context.buildLearningReelDismissPatch(linkHandoffAlert, reel);
assert.strictEqual(update.status, undefined, 'video dismiss must not mark the whole alert dismissed');
assert.strictEqual(update.data.learning_reel_approval_required, false, 'video dismiss should clear the learning-reel approval gate');
assert.ok(!/youtube\.com\/shorts\/VsmSkg2h4d8/.test(update.suggested_message || ''), 'video dismiss should strip the YouTube URL from the draft text');
assert.match(update.suggested_message, /good one for the training mindset/, 'video dismiss should keep the generated response text');

context.currentFeed = 'unread';
assert.strictEqual(
    context.renderLearningReelContextStrip(linkHandoffAlert),
    '',
    'unclassified YouTube URLs should only render the fallback preview in Needs You'
);

console.log('admin learning reel preview tests passed');
