import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipMetrics } from '../scripts/ig-relationship-metrics.mjs';
const event = (id, at, direction = 'in', extra = {}) => ({ canonicalId: id, at, direction,
  personId: 'verified-person', reviewId: 'native-review', identityVerified: true,
  humanMessage: true, ...extra });
const input = events => ({ window: { start: '2026-11-01T00:00:00Z', end: '2026-12-01T00:00:00Z' }, events });
test('deduplicates canonical IDs and separates outbound volume from human replies', () => {
  const e = event('one', '2026-11-03T10:00:00Z');
  const r = relationshipMetrics(input([e, e, ...Array.from({length: 30}, (_, i) =>
    event('out'+i, '2026-11-03T11:00:00Z', 'out'))]));
  assert.equal(r.people[0].inboundHumanReplies, 1);
  assert.equal(r.peopleAt20InboundReplies, 0);
  assert.equal(r.coverage, 'partial_lower_bound');
});
test('uses Brisbane days and distinguishes repeat replies from sustained two-way', () => {
  const events = [];
  for (let d = 3; d <= 5; d++) for (const dir of ['in', 'out'])
    events.push(event(d+dir, `2026-11-0${d}T14:01:00Z`, dir));
  const r = relationshipMetrics(input(events));
  assert.equal(r.sustainedTwoWayPeople, 1);
  assert.equal(r.repeatPeopleAcrossDays, 1);
  assert.ok(r.people[0].inboundDays[0].includes('04'));
});
test('excludes unverified, system, reaction and protected evidence; rejects conflicts', () => {
  const e = event('one', '2026-11-03T10:00:00Z');
  const r = relationshipMetrics(input([e, {...e, canonicalId:'two', reaction:true},
    {...e, canonicalId:'three', identityVerified:false}, {...e, canonicalId:'four', protected:true}]));
  assert.equal(r.excludedEvents, 3);
  assert.throws(() => relationshipMetrics(input([e, {...e, direction:'out'}])), /Conflicting/);
});
