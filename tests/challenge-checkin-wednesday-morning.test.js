const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const scan = fs.readFileSync(path.join(root, 'netlify/functions/challenge-checkin-scan.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(root, 'netlify/functions/challenge-checkin-scan-wednesday.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin-dashboard.html'), 'utf8');
const { runScan, _private } = require('../netlify/functions/challenge-checkin-scan');

assert.ok(toml.includes('schedule = "30 19 * * 0,6"'), 'challenge check-ins should stay scheduled for Monday/Sunday Brisbane mornings');
assert.ok(!toml.includes('[functions."challenge-checkin-scan-wednesday"]'), 'Wednesday cron should remain unscheduled');
assert.ok(!toml.includes('schedule = "0 20 * * 2"'), 'Wednesday 6am Brisbane cron should not return');
assert.ok(wrapper.includes('Deprecated Wednesday wrapper'), 'wrapper should be clearly marked as disabled');
assert.ok(admin.includes('6am Monday/Sunday'), 'admin timing copy should match the active cadence');
assert.ok(!admin.includes('Monday/Wednesday/Sunday'), 'admin copy should not advertise Wednesday check-ins');
assert.ok(!admin.includes('Mon/Wed/Sun'), 'admin copy should not advertise the old roster cadence');
assert.ok(!admin.includes('M/W/S'), 'admin badges should not advertise the old roster cadence');

assert.ok(scan.includes('Wednesday check-ins were cancelled by Shannon'), 'generator should explain why Wednesday returns null');
assert.ok(scan.includes('skipped_disabled_cadence'), 'manual/direct Wednesday calls should fail closed');
assert.ok(scan.includes('Sunday morning quick check-in'), 'Sunday should be labelled as a quick check-in');
assert.ok(scan.includes('this is not the weekly review'), 'Sunday prompt should not duplicate the in-app weekly review');
assert.ok(scan.includes('Yo smashed it this week'), 'Sunday prompt should include the short celebration shape');
assert.ok(scan.includes("Hey haven't seen you around much this week! Everything okay?"), 'Sunday fallback should include the quiet-week check-in shape');
assert.ok(!scan.includes('SUNDAY RULE: this is the full weekly review'), 'old Sunday full-review prompt should not return');
assert.ok(scan.includes('Keep one pending') && scan.includes('client_id=eq.${clientId}'), 'pending check-in lookup should dedupe across Shannon coach identities');
assert.ok(!scan.includes('Wed 08:00 UTC -> Wed 18:00 Brisbane'), 'old Wednesday evening schedule comment should be gone');
assert.ok(!scan.includes('Wednesday night halfway check'), 'old Wednesday night label should be gone');
assert.ok(!scan.includes("label: 'Wednesday morning chill check'"), 'Wednesday generator label should not be active');

const wed = _private.cadenceForWeekday('Wed');
assert.strictEqual(wed, null, 'Wednesday cadence should be disabled');

assert.strictEqual(
    _private.cleanDraftOutput("hey! how's your week going?", 'Miranda', { allowGreeting: true }),
    "Hey! How's your week going?",
    'Cleaner should keep a small no-name greeting when explicitly allowed'
);

assert.strictEqual(
    _private.cleanDraftOutput("hey Miranda, how's your week going?", 'Miranda'),
    "How's your week going?",
    'Normal cleaner should still strip direct name greetings'
);

(async () => {
    const forced = await runScan({ force: true, cadenceKey: 'wednesday' });
    assert.strictEqual(forced.skipped_disabled_cadence, 1, 'manual Wednesday scans should skip without hitting Supabase');
    assert.strictEqual(forced.cadence, 'wednesday');
    assert.strictEqual(forced.cadence_label, 'Wednesday check-ins cancelled');
    console.log('challenge check-in Wednesday cancellation ok');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
