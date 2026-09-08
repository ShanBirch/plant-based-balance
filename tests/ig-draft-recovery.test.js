const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { recoveryAllowed, claimDraftRecovery, RETRY_DELAY_MS } = require('../netlify/functions/_lib/ig-draft-recovery');

const now = Date.parse('2026-09-08T06:00:00Z');
const blank = () => ({ id: 'old-alert', status: 'pending', data: { draft_text: '', operator_note: 'keep' } });

test('only one overlapping worker can claim the same empty alert', async () => {
    let stored = blank();
    const query = async (path, options) => {
        assert.equal(path, 'rpc/claim_ig_draft_recovery');
        if (JSON.stringify(options.body.p_expected_data) !== JSON.stringify(stored.data)) return [];
        stored = { ...stored, data: { ...stored.data, draft_recovery: {
            attempts: 1, retry_after: new Date(now + RETRY_DELAY_MS).toISOString(),
        } } };
        return [structuredClone(stored)];
    };
    const snapshot = structuredClone(stored);
    const claims = await Promise.all([claimDraftRecovery(snapshot, query, now), claimDraftRecovery(snapshot, query, now)]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(stored.data.operator_note, 'keep');
    assert.equal(recoveryAllowed(stored, now + 60_000), false);
    assert.equal(recoveryAllowed(stored, now + RETRY_DELAY_MS), true);
});

test('failed attempts stop after three, and completed or actioned alerts never retry', () => {
    const alert = blank();
    alert.data.draft_recovery = { attempts: 3, retry_after: new Date(now - 1).toISOString() };
    assert.equal(recoveryAllowed(alert, now), false);
    assert.equal(recoveryAllowed({ ...blank(), suggested_message: 'Saved reply' }, now), false);
    assert.equal(recoveryAllowed({ ...blank(), status: 'sent' }, now), false);
    assert.equal(recoveryAllowed({ ...blank(), status: 'dismissed' }, now), false);
});

test('claim errors fail closed without returning a generation permit', async () => {
    await assert.rejects(claimDraftRecovery(blank(), async () => { throw new Error('database unavailable'); }, now));
});

test('actual worker selection retains old exact organic alerts outside the coalescing window', async () => {
    const source = fs.readFileSync(require.resolve('../netlify/functions/ig-instant-draft'), 'utf8');
    const start = source.indexOf('    const coalesceCutoffIso =');
    const end = source.indexOf('\n    let alertId = null;', start);
    const select = vm.runInNewContext(`(async () => { ${source.slice(start, end)}; return existingPending; })`, {
        Date, encodeURIComponent, PENDING_THREAD_COALESCE_LOOKBACK_HOURS: 24,
        regenerateExistingBlankAlert: { ...blank(), created_at: '2026-09-05T00:00:00Z' },
        metaAdFastLane: false, thread: { id: 'thread' },
        supabaseQuery: async () => { throw new Error('must not discard the exact recovery target for a date-filtered lookup'); },
    });
    assert.equal((await select()).id, 'old-alert');
});
