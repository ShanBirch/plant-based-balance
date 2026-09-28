const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { lease, LEASE_MS } = require('../scripts/dm-manager-lease.cjs');

test('lease excludes overlaps, recovers expiry, and rejects old owner release', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lease-test-'));
    const file = path.join(dir, 'lease.sqlite');
    try {
        const first = lease('acquire', { file, now: 1000 });
        assert.equal(first.outcome, 'acquired');
        assert.equal(lease('acquire', { file, now: 1001 }).outcome, 'manager_already_running');
        assert.equal(lease('check', { file, token: first.token, now: 1000 + 7 * 60000 }).can_claim, false);
        assert.equal(lease('check', { file, token: first.token, now: 1000 + 9 * 60000 }).can_send, false);
        const next = lease('acquire', { file, now: 1000 + LEASE_MS });
        assert.equal(next.outcome, 'acquired');
        assert.equal(lease('release', { file, token: first.token, now: 1000 + LEASE_MS }).outcome, 'lease_not_owned');
        assert.equal(lease('check', { file, token: next.token, now: 1000 + LEASE_MS }).can_send, true);
        assert.equal(lease('release', { file, token: next.token, now: 1000 + LEASE_MS }).outcome, 'released');
    } finally { fs.rmSync(dir, { recursive: true }); }
});

test('simultaneous scheduled processes acquire exactly one lease', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lease-race-'));
    const file = path.join(dir, 'lease.sqlite');
    const script = path.resolve(__dirname, '../scripts/dm-manager-lease.cjs');
    try {
        const results = await Promise.all(Array.from({ length: 6 }, () => new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [script, 'acquire'], {
                windowsHide: true, env: { ...process.env, BALANCE_DM_LEASE_FILE: file },
            });
            let out = '', err = '';
            child.stdout.on('data', chunk => out += chunk);
            child.stderr.on('data', chunk => err += chunk);
            child.on('error', reject);
            child.on('close', code => code ? reject(new Error(err)) : resolve(JSON.parse(out)));
        })));
        assert.equal(results.filter(r => r.outcome === 'acquired').length, 1);
        assert.equal(results.filter(r => r.outcome === 'manager_already_running').length, 5);
    } finally { fs.rmSync(dir, { recursive: true }); }
});
