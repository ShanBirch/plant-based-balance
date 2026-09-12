const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { payloadFor, deliver } = require('../netlify/functions/_lib/client-checkin-push');
const row = { user_id: 'member-id', week_start: '2026-09-07', occurrence: 'weekly' };
test('member reminder has private copy and correct destination, never admin queue', () => {
 const p = payloadFor(row);
 assert.equal(p.recipientId, row.user_id);
 assert.equal(p.type, 'client_checkin_ready');
 assert.equal(p.url, '/dashboard.html?checkin=ready');
 assert.ok(!JSON.stringify(p).includes('admin-dashboard'));
 assert.equal(p.collapseKey, 'checkin-2026-09-07-weekly');
 assert.notEqual(payloadFor({...row,occurrence:'midweek_wednesday'}).collapseKey,p.collapseKey);
});
test('only provider acceptance records a successful push', async () => {
 for (const count of [0,1]) {
  let saved;
  const result = await deliver(row, async (_, opts) => saved=opts.body, async () => ({sent:count}));
  assert.equal(result, count>0);
  assert.equal(!!saved.sent_at,count>0);
 }
});
test('uncertain transport is recorded without retrying or claiming success', async () => {
 let attempts=0, saved;
 assert.equal(await deliver(row, async (_,o)=>saved=o.body, async()=>{ attempts++;throw Error('timeout'); }),false);
 assert.equal(attempts,1);
 assert.equal(saved.result.error,'delivery_unknown');
 assert.equal(saved.sent_at,null);
});
test('database gate protects new starters, completed actions and concurrent runs', () => {
 const sql=fs.readFileSync('supabase/migrations/20260912225834_client_checkin_ready_push.sql','utf8');
 for (const part of ['onboarding_complete is true',"interval '7 days'",'weekly_checkins','on conflict do nothing','enable row level security','from public,anon,authenticated','midweek_wednesday']) assert.ok(sql.includes(part),part);
});
test('native foreground, native background and browser taps all route to member check-in', () => {
 const native=fs.readFileSync('lib/native-push.js','utf8');
 const sw=fs.readFileSync('sw.js','utf8');
 const ui=fs.readFileSync('js/dashboard/pbb-weekly-checkin-preview.js','utf8');
 assert.equal((native.match(/data.type === 'client_checkin_ready'/g)||[]).length,2);
 assert.ok(sw.includes("clients.openWindow('./dashboard.html?checkin=ready')"));
 assert.ok(ui.includes("window.addEventListener('pbbCurrentUserReady', openCheckinFromPush)"));
 assert.ok(ui.includes("window.addEventListener('pbbInitComplete', openCheckinFromPush)"));
});
