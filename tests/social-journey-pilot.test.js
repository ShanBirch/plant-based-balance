const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const journey = require('../netlify/functions/_lib/social-journey');
const scanModule = require('../netlify/functions/social-journey-reminder-scan');
const scan = scanModule._test;

const root = path.resolve(__dirname, '..');

test('pilot is gated to Shannon exact account', () => {
    assert.equal(journey.isShannonUser({ id: journey.SHANNON_USER_ID, email: journey.SHANNON_EMAIL }), true);
    assert.equal(journey.isShannonUser({ id: journey.SHANNON_USER_ID, email: 'someone@example.com' }), false);
    assert.equal(journey.isShannonUser({ id: 'other', email: journey.SHANNON_EMAIL }), false);
});

test('Instagram reminder allowlist contains only known test conversations', () => {
    assert.deepEqual([...journey.ALLOWED_INSTAGRAM_HANDLES].sort(), ['cocos_pt_studio', 'goldcoast_ai_solutions']);
});

test('candidate selection prefers a send-ready Graph thread', () => {
    const rows = [
        { id: 'plain', ig_username: 'cocos_pt_studio', last_inbound_at: new Date().toISOString(), subscriber_id: 'legacy' },
        { id: 'graph', ig_username: 'cocos_pt_studio', last_inbound_at: new Date().toISOString(), subscriber_id: 'ig_graph:account:recipient' },
    ];
    assert.equal(journey.chooseThread(rows, 'cocos_pt_studio').id, 'graph');
    assert.equal(journey.hasGraphRecipient(rows[1]), true);
});

test('reminder names the first incomplete goal and stays compact', () => {
    const message = journey.buildReminderMessage({
        current_week: 3,
        progress_snapshot: {
            tasks: [
                { label: 'Finished already', complete: true },
                { label: 'Share a workout to Feed', complete: false },
            ],
        },
    });
    assert.match(message, /Week 3/);
    assert.match(message, /Share a workout to Feed/);
    assert.ok(message.length < 240);
});

test('automatic sends use only Meta standard 24-hour window', () => {
    const now = Date.parse('2026-08-05T12:00:00.000Z');
    assert.equal(journey.isInsideStandardMessagingWindow('2026-08-04T12:01:00.000Z', now), true);
    assert.equal(journey.isInsideStandardMessagingWindow('2026-08-04T11:59:00.000Z', now), false);
    assert.equal(journey.isInsideStandardMessagingWindow('', now), false);
});

test('scheduled receipt is idempotent per journey week', () => {
    const state = { current_week: 2, week_started_at: '2026-08-03', reminder_receipts: [] };
    const receipt = journey.buildReceipt({ journey: state, kind: 'scheduled', status: 'sent', message: 'test' });
    assert.equal(receipt.id, scan.scheduledReceiptId(state));
    const receipts = journey.withReceipt(state, receipt);
    assert.equal(journey.hasReceipt({ ...state, reminder_receipts: receipts }, receipt.id), true);
});

test('reminder scanner rejects ordinary public invocations', async () => {
    const response = await scanModule.handler({ headers: {}, body: '{}' });
    assert.equal(response.statusCode, 403);
});

test('dashboard ships both discovery systems and a visible pilot card target', () => {
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    assert.match(html, /id="social-journey-card"/);
    assert.match(html, /social-journey-shannon-pilot-v2/);
    assert.match(html, /sel:'#social-journey-card', title:'Your weekly journey'/);
    assert.match(html, /pbb-social-journey\.js\?v=2/);
    assert.match(html, /pbb-social-journey\.css\?v=2/);
});

test('journey UI is lesson-led, card-triggered and preserves account data on restart', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const weekMatches = source.match(/\n\s+week: \d+,/g) || [];
    assert.equal(weekMatches.length, 12);
    assert.match(source, /viewStage = isCurrentLessonSeen\(\) \? 'goals' : 'lesson'/);
    assert.match(source, /lesson_seen_weeks/);
    assert.match(source, /Use these goals/);
    assert.match(source, /openFeedComposerMediaSource\('camera-photo'\)/);
    assert.match(source, /'feed-photo'/);
    assert.doesNotMatch(source, /setTimeout\(openOnboarding/);
    assert.match(source, /Restart only this journey/);
    assert.match(source, /settings\s*\n\s*}\);/);
    assert.doesNotMatch(source, /from\(['"]users['"]\).*delete/i);
});

test('journey styling uses the Balance cream and gold system in both themes', () => {
    const css = fs.readFileSync(path.join(root, 'css/dashboard/pbb-social-journey.css'), 'utf8');
    assert.match(css, /--sj-cream: var\(--pbb-luxe-cream/);
    assert.match(css, /--sj-gold: var\(--pbb-luxe-gold/);
    assert.match(css, /html\[data-pbb-theme="light"\]/);
    assert.doesNotMatch(css, /#153f2e|#123f2d|#24765a/i);
});

test('migration enables ownership RLS and constrained JSON state', () => {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260805031919_social_journey_pilot.sql'), 'utf8');
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
    assert.match(sql, /auth\.uid\(\)\) = user_id/);
    assert.match(sql, /current_week BETWEEN 1 AND 12/);
    assert.match(sql, /jsonb_typeof\(reminder_receipts\) = 'array'/);
});
