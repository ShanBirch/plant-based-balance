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
    assert.match(html, /aria-label="Open Your Next Step"/);
    assert.match(html, /social-journey-your-next-step-v1/);
    assert.match(html, /allFeatures = \[\];[\s\S]*?allFeatures\.push\(\{[\s\S]*?id: 'social-journey-your-next-step-v1'/);
    assert.match(html, /sel:'#next-obvious-steps-card', fallbackSel:'#social-journey-card', title:'Your Next Step'/);
    assert.match(html, /finish this App Tour and your first Balance Foundations lesson/);
    assert.match(html, /pbb-social-journey\.js\?v=\d+/);
    assert.match(html, /pbb-social-journey\.css\?v=\d+/);
});

test('Home plan cards stay below the complete FitGotchi stats block', () => {
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

    assert.match(source, /const characterBlockTail = document\.getElementById\('battle-stats-row'\) \|\| levelStrip/);
    assert.match(source, /characterBlockTail\.parentNode\.insertBefore\(weeklyGoals, characterBlockTail\.nextSibling\)/);
    assert.match(source, /characterBlockTail\.parentNode\.insertBefore\(card, characterBlockTail\.nextSibling\)/);
    assert.doesNotMatch(source, /levelStrip\.parentNode\.insertBefore\((weeklyGoals|card), levelStrip\.nextSibling\)/);
    assert.match(html, /pbb-social-journey\.js\?v=34-next-step-priority/);
    assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v340-complete-workout-share'/);
});

test('Home goals and plan cards follow light and dark mode', () => {
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const goals = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-weeklygoals.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/dashboard/pbb-social-journey.css'), 'utf8');

    assert.match(goals, /card\.classList\.add\('weekly-goals-home-card'\)/);
    assert.match(css, /html\[data-pbb-theme="light"\] #weekly-goals-card\.weekly-goals-home-card/);
    assert.match(css, /html\[data-pbb-theme="dark"\]\.pbb-unified-next-steps #next-obvious-steps-card\.is-unified-plan \.next-step-action/);
    assert.match(css, /weekly-goal-progress-card__value\.is-complete/);
    assert.match(css, /html\.pbb-unified-next-steps #weekly-goals-card\.weekly-goals-home-card\s*\{[\s\S]*?margin: 10px 25px 14px !important/);
    assert.match(html, /pbb-social-journey\.css\?v=23-working-targets/);
    assert.match(html, /pbb-deferred-weeklygoals\.js\?v=33-home-theme/);
});

test('first check-in ships the recorded Shannon welcome audio used by Inbox and Your Next Step', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const inboxSource = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js'), 'utf8');
    const audioPath = path.join(root, 'assets/audio/shannon-balance-welcome.mp3');
    assert.match(source, /\/assets\/audio\/shannon-balance-welcome\.mp3/);
    assert.match(inboxSource, /balance-onboarding-inbox-message/);
    assert.match(inboxSource, /\/assets\/audio\/shannon-balance-welcome\.mp3/);
    assert.equal(fs.existsSync(audioPath), true);
    assert.ok(fs.statSync(audioPath).size > 1_000_000);
});

test('journey UI is lesson-led, card-triggered and preserves account data on restart', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const weekMatches = source.match(/\n\s+week: \d+,/g) || [];
    assert.equal(weekMatches.length, 12);
    assert.match(source, /viewStage = typeof stage === 'string' \? stage : \(isCurrentLessonSeen\(\) \? 'goals' : 'lesson'\)/);
    assert.match(source, /lesson_seen_weeks/);
    assert.match(source, /Use these next steps/);
    assert.match(source, /openFeedComposerMediaSource\('camera-photo'\)/);
    assert.match(source, /'feed-photo'/);
    assert.doesNotMatch(source, /setTimeout\(openOnboarding/);
    assert.match(source, /Restart only this journey/);
    assert.match(source, /Your Next Step/);
    assert.doesNotMatch(source, /Your inbox|Welcome to your Inbox/);
    assert.match(source, /settings\s*\n\s*}\);/);
    assert.doesNotMatch(source, /from\(['"]users['"]\).*delete/i);
});

test('Balance Identity teaches the input-output loop before the Instagram plan', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

    assert.match(source, /Your inputs train two prediction systems/);
    assert.match(source, /Data input affects output, and that output becomes your next input/);
    assert.match(source, /The feed does not determine who you become/);
    assert.match(source, /I understand the loop - build my plan/);
    assert.match(source, /socialJourney\.showGoals\(\)/);
    assert.match(html, /balance-identity-instagram-plan-v1/);
    assert.match(html, /title:'Build Your Fitness Instagram'|title: 'Build Your Fitness Instagram'/);
});

test('Balance Identity is available from the unified Home plan', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const nextSteps = fs.readFileSync(path.join(root, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

    assert.match(source, /isUnifiedPlanActive: function \(\) \{ return isJourneyEligible\(\) && !!state; \}/);
    assert.match(source, /function getUnifiedAction\(\)/);
    assert.match(source, /kind: 'course_lesson'/);
    assert.match(source, /function openUnifiedAction\(\)/);
    assert.match(source, /item\.type !== 'daily_manual'[\s\S]*dailyTaskDates\(item\.id\)\.includes\(brisbaneDateKey\(\)\)/);
    assert.match(nextSteps, /id: 'balance_journey'/);
    assert.match(nextSteps, /addUniqueAction\(picked, journeyAction\)/);
    assert.match(nextSteps, /journeyAction\.kind !== 'course_lesson'/);
    assert.match(html, /balance-identity-home-rollout-v2/);
    assert.match(html, /sel: '#next-obvious-steps-card'[\s\S]*getCurrentWeek\(\) >= 7/);
});

test('Instagram planner captures a complete strategy in owned journey settings', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');

    for (const field of ['purpose', 'niche', 'audience', 'identity_statement', 'content_pillars', 'account_name', 'bio', 'posting_rhythm', 'boundaries', 'first_posts']) {
        assert.match(source, new RegExp(field));
    }
    assert.match(source, /instagram_plan: plan/);
    assert.match(source, /isInstagramPlanComplete\(instagramPlan\(\)\)/);
    assert.match(source, /Save my Instagram plan/);
});

test('Weeks 7 to 12 require three meaningful Instagram comments on seven distinct days', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
    const dailyTasks = source.match(/task\('w(?:7|8|9|10|11|12)_daily_comments',[\s\S]*?'daily_manual', 7/g) || [];

    assert.equal(dailyTasks.length, 6);
    assert.match(source, /Leave 3 meaningful Instagram comments today/);
    assert.match(source, /daily_task_dates/);
    assert.match(source, /new Set\(dailyTaskDates\(taskId\)/);
    assert.match(source, /Today is already counted/);
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
