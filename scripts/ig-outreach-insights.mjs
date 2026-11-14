// Shared relationship-report extension. Reads evidence; never contacts anyone.
const day = at => new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Brisbane',
  year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const handle = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
const held = value => value === true || value === 'true';

export function outreachInsights(input) {
  const window = input.outreachWindow || input.window;
  const start = Date.parse(window.start), end = Date.parse(window.end);
  if (!(start < end)) throw Error('Invalid outreach window');
  const now = Date.parse(input.asOf || new Date().toISOString());
  if (!Number.isFinite(now)) throw Error('Invalid asOf');
  const cutoff = Math.min(end, now);
  const profiles = new Map();
  for (const p of input.contactProfiles || []) {
    if (!p.personId || !p.reviewId || p.identityVerified !== true) continue;
    if (profiles.has(p.personId)) throw Error('Duplicate contact profile');
    profiles.set(p.personId, p);
  }
  const observations = new Map(), ids = new Map();
  let excludedObservations = 0;
  for (const o of input.storyObservations || []) {
    const at = Date.parse(o.observedAt);
    if (!o.observationId || !o.personId || !o.evidenceRef ||
      !['native_review','historical_action_receipt'].includes(o.source) ||
      !['present','absent','unavailable'].includes(o.state) ||
      !Number.isFinite(at) || at < start || at >= cutoff) {
      excludedObservations++; continue;
    }
    if (o.state === 'present' && !/^\d+$/.test(String(o.storyId || ''))) {
      excludedObservations++; continue;
    }
    const signature = JSON.stringify([o.personId,o.storyId,o.observedAt,o.state,o.postedAt || null]);
    if (ids.has(o.observationId)) {
      if (ids.get(o.observationId) !== signature) throw Error('Conflicting Story observation');
      continue;
    }
    ids.set(o.observationId, signature);
    const rows = observations.get(o.personId) || [];
    rows.push(o); observations.set(o.personId, rows);
  }
  const people = [];
  const candidateIds = new Set();
  for (const c of input.outreachCandidates || []) {
    if (!c.personId || candidateIds.has(c.personId)) throw Error('Missing or duplicate candidate identity');
    candidateIds.add(c.personId);
    const p = profiles.get(c.personId);
    const reasons = [];
    const kind = p?.relationshipKind || c.relationshipKind || 'unknown';
    if (kind !== 'prospect' && kind !== 'lead') reasons.push(kind);
    if (!p || p.identityVerified !== true) reasons.push('identity_not_reviewed');
    for (const key of ['linkedClient','purchase','personal','manual','optOut','protected','formerClient','merged','testAccount'])
      if (held(c.controls?.[key]) || held(p?.controls?.[key])) reasons.push(key);
    if (held(c.controls?.outreachExcluded) || held(p?.controls?.outreachExcluded)) reasons.push('outreach_excluded');
    const obs = observations.get(c.personId) || [];
    const present = obs.filter(o => o.state === 'present');
    const checks = obs.filter(o => o.source === 'native_review' && o.state !== 'unavailable');
    const unique = new Map();
    for (const o of present) {
      const old = unique.get(o.storyId);
      if (old?.postedAt && o.postedAt && old.postedAt !== o.postedAt)
        throw Error('Conflicting Story publication time');
      if (!old || (!old.postedAt && o.postedAt)) unique.set(o.storyId,o);
    }
    const exact = [...unique.values()].filter(o => o.postedAt && o.postedAtVerified === true &&
      Number.isFinite(Date.parse(o.postedAt)) && Date.parse(o.postedAt) <= Date.parse(o.observedAt) &&
      Date.parse(o.postedAt) >= start && Date.parse(o.postedAt) < cutoff);
    const hours = {};
    for (const o of exact) {
      const hour = new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Brisbane',hour:'2-digit',hourCycle:'h23'})
        .format(new Date(o.postedAt));
      hours[hour] = (hours[hour] || 0) + 1;
    }
    const activeDays = [...new Set(present.map(o => day(o.observedAt)))].sort();
    const checkedDays = [...new Set(checks.map(o => day(o.observedAt)))].sort();
    const signals = (input.challengeSignals || []).filter(s => s.personId === c.personId &&
      s.reviewId && s.sourceMessageId && s.explicit === true &&
      Date.parse(s.at) >= start && Date.parse(s.at) < cutoff &&
      ['interest','accepted','declined','not_now'].includes(s.kind)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const signal = signals.at(-1);
    if (signal && ['declined','not_now'].includes(signal.kind)) reasons.push('challenge_' + signal.kind);
    const replyDays = Math.max(0, Number(c.replyDays) || 0);
    const inbound = Math.max(0, Number(c.inboundMessages) || 0);
    const lastReply = Date.parse(c.lastReply);
    const age = (cutoff-lastReply)/86400000;
    // Heuristic, not a probability. No points for our outbound volume.
    const score = Math.min(replyDays,10)*5 + Math.min(inbound,20) +
      (age >= 0 && age <= 7 ? 25 : age >= 0 && age <= 14 ? 15 : 0) +
      Math.min(activeDays.length,5)*2;
    people.push({
      personId:c.personId, handle:handle(p?.handle || c.handle), relationshipKind:kind,
      prospectExcluded:reasons.length > 0, exclusionReasons:[...new Set(reasons)],
      replyDays, inboundMessages:inbound, lastReply:c.lastReply || null,
      activityConfidence:c.activityConfidence || 'canonical_metadata_unreviewed',
      unansweredOutbound:c.unansweredOutbound ?? null,
      story:{uniqueStoriesObserved:present.length ? unique.size : null,
        daysSeenPosting:present.length ? activeDays.length : null,
        activeDates:activeDays, checkedDays:checkedDays.length,
        observedPresenceRate:checks.length ? checks.filter(o=>o.state==='present').length/checks.length : null,
        lastSeen:present.length ? present.map(o=>o.observedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1) : null,
        verifiedPostingTimes:exact.length, postingHoursBrisbane:hours,
        latestDisplayedAge:present.filter(o=>o.displayedAge).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).at(-1)?.displayedAge || null,
        timingConfidence:exact.length >= 5 ? 'observed_sample' : 'insufficient',
        coverage:'partial_observed_lower_bound'},
      challengeInterest:signal?.kind || 'unknown',
      challengeSource:signal?.sourceMessageId || null,
      rapportTopics:(input.rapportTopics || []).filter(t=>t.personId===c.personId &&
        t.reviewId && t.sourceMessageId && t.nonSensitive === true).map(t=>({
          topic:t.topic,sourceMessageId:t.sourceMessageId,at:t.at})),
      rankingScore:score,
      contactPermission:'none_from_report; recheck current source and all existing guards'
    });
  }
  const ranked = people.filter(p=>!p.prospectExcluded && p.inboundMessages>0)
    .sort((a,b)=>b.rankingScore-a.rankingScore ||
      (Date.parse(b.lastReply)||0)-(Date.parse(a.lastReply)||0) || a.personId.localeCompare(b.personId))
    .slice(0,100).map((p,i)=>({...p,rank:i+1}));
  return {schema:'ig_outreach_insights_v1',asOf:new Date(now).toISOString(),
    snapshotAgeHours:Math.max(0,(Date.now()-now)/3600000),
    refreshRequired:Date.now()-now>86400000,
    window,excludedObservations,topProspects:ranked,
    excludedPeople:people.filter(p=>p.prospectExcluded),
    limitations:['Posting frequency is an observed lower bound, not total Stories per week.',
      'Observation/action time is never publication time. Brisbane hours are not inferred personal time zones.',
      'Replies are message counts, not turns, verified human interest or Story-attributed conversions.',
      'Unassessed identity, personal/client status, topics and interest remain unknown.',
      'Ranking is a review aid, never authority to send or promote.']};
}
