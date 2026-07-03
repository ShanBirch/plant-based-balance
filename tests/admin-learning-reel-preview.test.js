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
assert.match(html, /dismissLearningReelAlert\(event, '00000000-0000-4000-8000-000000000001'\)/, 'preview should include a dismiss button beside the YouTube link');
assert.match(html, /Everyone Is Confused About Training To Failure by Jeff Nippard/, 'preview should infer the reel title from the alert description');

assert.ok(
    dashboard.includes('function evictAlertFromFastCaches(alertId)') &&
    dashboard.includes('needsYouFeedCache.rows.filter') &&
    dashboard.includes('refreshVisibleCountsAfterDismiss();'),
    'dismissed Needs You rows should be evicted from the fast cache before counts refresh'
);

context.currentFeed = 'unread';
assert.strictEqual(
    context.renderLearningReelContextStrip(linkHandoffAlert),
    '',
    'unclassified YouTube URLs should only render the fallback preview in Needs You'
);

console.log('admin learning reel preview tests passed');
