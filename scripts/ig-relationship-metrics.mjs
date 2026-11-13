import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Input is reviewed evidence, never unclassified webhook volume.
export function relationshipMetrics(input) {
  if (!input.window?.start || !input.window?.end) throw new Error('Explicit evidence window required');
  const start = Date.parse(input.window.start), end = Date.parse(input.window.end);
  if (!(start < end)) throw new Error('Invalid evidence window');
  const people = new Map(), seen = new Map();
  let excluded = 0;
  for (const e of input.events || []) {
    if (!e.canonicalId || !e.personId || !e.reviewId || e.identityVerified !== true ||
        (e.direction === 'in' ? e.humanMessage !== true : e.deliveryVerified !== true) || !['in', 'out'].includes(e.direction) ||
        e.protected === true || e.reaction === true || e.system === true) { excluded++; continue; }
    const at = Date.parse(e.at);
    if (!Number.isFinite(at) || at < start || at >= end) { excluded++; continue; }
    const signature = JSON.stringify([e.personId, e.direction, at]);
    if (seen.has(e.canonicalId)) {
      if (seen.get(e.canonicalId) !== signature) throw new Error('Conflicting canonical evidence');
      continue;
    }
    seen.set(e.canonicalId, signature);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane',
      year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
    const p = people.get(e.personId) || { inbound: 0, outbound: 0, days: new Map() };
    p[e.direction === 'in' ? 'inbound' : 'outbound']++;
    const d = p.days.get(day) || { in: 0, out: 0 };
    d[e.direction]++; p.days.set(day, d); people.set(e.personId, p);
  }
  const rows = [...people].map(([personId, p]) => {
    const inboundDays = [...p.days].filter(([, d]) => d.in).map(([day]) => day).sort();
    const twoWayDays = [...p.days].filter(([, d]) => d.in && d.out).map(([day]) => day).sort();
    return { personId, inboundHumanReplies: p.inbound, outboundVerifiedMessages: p.outbound,
      inboundDays, twoWayDays, repeatAcrossDays: inboundDays.length >= 2,
      sustainedTwoWay: twoWayDays.length >= 3,
      inboundMilestones: [5, 10, 20].filter(n => p.inbound >= n) };
  }).sort((a, b) => a.personId.localeCompare(b.personId));
  return { schema: 'ig_relationship_metrics_v1', window: input.window,
    coverage: input.coverage === 'complete' ? 'complete_reviewed_evidence' : 'partial_lower_bound',
    historicalGaps: input.historicalGaps || ['Unassessed history is unknown, never zero.'],
    uniquePeopleReplying: rows.filter(p => p.inboundHumanReplies).length,
    repeatPeopleAcrossDays: rows.filter(p => p.repeatAcrossDays).length,
    sustainedTwoWayPeople: rows.filter(p => p.sustainedTwoWay).length,
    peopleAt20InboundReplies: rows.filter(p => p.inboundMilestones.includes(20)).length,
    excludedEvents: excluded, people: rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = relationshipMetrics(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  if (!process.argv[3]) throw new Error('Private output path required');
  writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n');
}
