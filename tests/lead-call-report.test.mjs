import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, renderReport } from '../scripts/report-lead-call-funnel.mjs';

test('report bounds preserve Brisbane midnight and reject ambiguous or injected timestamps', () => {
    const sql = buildQuery('2026-10-04T00:00:00+10:00', '2026-10-11T00:00:00+10:00');
    assert.match(sql, /2026-10-03T14:00:00\.000Z/);
    assert.match(sql, /2026-10-10T14:00:00\.000Z/);
    assert.doesNotMatch(sql, /\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
    for (const start of ['2026-10-04T00:00:00', "2026-10-04'; drop table ig_threads", 'invalid']) {
        assert.throws(() => buildQuery(start, '2026-10-11T00:00:00+10:00'));
    }
    assert.throws(() => buildQuery('2026-10-11T00:00:00Z', '2026-10-04T00:00:00Z'));
});

test('empty event trail and existing scheduled calls are reported without invented outcomes', () => {
    const report = renderReport({
        version: 'lead_call_funnel_v1', generated_at: '2026-10-11T05:12:00Z',
        periods: [
            { period: 'current', start_at: '2026-10-03T14:00:00Z', end_at: '2026-10-11T05:12:00Z' },
            { period: 'previous', start_at: '2026-09-25T22:48:00Z', end_at: '2026-10-03T14:00:00Z' },
        ], activity: [], events: [], transport: [], bookings: [
            { period: 'current', created: 0, created_currently_confirmed: 0,
                created_linked_to_scoped_thread: 0, scheduled_currently_confirmed: 2,
                scheduled_without_thread_link: 2 },
        ],
    });
    assert.match(report, /\| current \| 0 \| 0 \| 0 \| 2 \| 2 \|/);
    assert.match(report, /unmeasured progression, not zero actual progression/);
    assert.match(report, /does not establish attendance/);
    assert.match(report, /not unique people/);
    assert.doesNotMatch(report, /0%|winner:|attendance rate/i);
});
