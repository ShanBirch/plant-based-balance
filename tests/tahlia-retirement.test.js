const assert = require('assert');
const fs = require('fs');
const path = require('path');

const worker = require('../netlify/functions/tahlia-social-worker')._test;
const netlifySource = fs.readFileSync(path.join(__dirname, '../netlify.toml'), 'utf8');
const migration = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20260901000000_retire_tahlia_automation.sql'),
    'utf8'
);

(async () => {
    const result = await worker.runTahliaSocialWorker();
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.skipped, 'retired');
    assert.strictEqual(result.reason, 'tahlia_wound_down');

    assert.ok(!netlifySource.includes('[functions."tahlia-social-worker"]'));
    assert.match(migration, /SET enabled = FALSE/);
    assert.match(migration, /WHERE jobname = 'tahlia-brooks-xp-autopilot'/);
    assert.match(migration, /skipped_reason = 'tahlia_wound_down'/);
    assert.match(migration, /'dismiss_reason', 'tahlia_wound_down'/);

    console.log('tahlia-retirement tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
