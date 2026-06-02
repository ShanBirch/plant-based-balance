const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const scan = fs.readFileSync(path.join(root, 'netlify/functions/challenge-checkin-scan.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(root, 'netlify/functions/challenge-checkin-scan-wednesday.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin-dashboard.html'), 'utf8');

assert.ok(toml.includes('[functions."challenge-checkin-scan-wednesday"]'));
assert.ok(toml.includes('schedule = "0 20 * * 2"'), 'Wednesday cron should run Tue 20:00 UTC / Wed 06:00 Brisbane');
assert.ok(wrapper.includes('Wednesday 6am Brisbane'), 'wrapper comment should match the production schedule');
assert.ok(admin.includes('6am Monday/Wednesday/Sunday'), 'admin timing copy should match the new cadence');

assert.ok(scan.includes('Wednesday morning chill check'), 'Wednesday cadence should be labelled as a morning chill check');
assert.ok(scan.includes('If the latest conversation line is from the client and Shannon has not replied'), 'Wednesday prompt should respect open conversations');
assert.ok(scan.includes('if Sukh said she was sick Monday'), 'Wednesday prompt should prioritize sickness/context follow-up');
assert.ok(scan.includes('Keep one pending') && scan.includes('client_id=eq.${clientId}'), 'pending check-in lookup should dedupe across Shannon coach identities');
assert.ok(!scan.includes('Wed 08:00 UTC -> Wed 18:00 Brisbane'), 'old Wednesday evening schedule comment should be gone');
assert.ok(!scan.includes('Wednesday night halfway check'), 'old Wednesday night label should be gone');

console.log('challenge check-in Wednesday morning cadence ok');
