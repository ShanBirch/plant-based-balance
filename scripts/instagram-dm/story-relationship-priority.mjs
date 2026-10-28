const handle = value => typeof value === 'string' && /^[a-z0-9_.]{1,30}$/.test(value.replace(/^@/, '').toLowerCase()) ? value.replace(/^@/, '').toLowerCase() : null;
const brisbaneDay = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export const returningTrial = Object.freeze({dailyExtraLookups:5,startsAt:'2026-10-27T14:00:00Z',endsAt:'2026-10-30T14:00:00Z',reviewBrisbaneDate:'2026-10-31'});
export function planRelationshipChecks({candidates, trayHandles = [], checks = {}, observations = null, now, limit = 12, returningCursor = null}) {
  const time = Date.parse(now);
  if (!Number.isFinite(time) || !Array.isArray(candidates)) throw new Error('Actual time and candidate inventory required');
  const tray = new Set(trayHandles.map(handle).filter(Boolean));
  const merged = new Map();
  for (const row of candidates) {
    const username = handle(row.username);
    if (!username) continue;
    const prior = merged.get(username);
    merged.set(username, {...prior, ...row, username,
      planning_hold: prior?.planning_hold || row.planning_hold || null,
      awaiting_next_conversation: !!(prior?.awaiting_next_conversation || row.awaiting_next_conversation),
      priority: Math.min(prior?.priority ?? 9, row.priority ?? 9),
      send_clearance: false});
  }
  const skipped = [], selected = [];
  let extraLookups = (observations??Object.values(checks)).filter(c=>c.audience==='returning_bc' && c.check_method!=='inspect_current_tray_story' && Number.isFinite(Date.parse(c.checked_at)) && brisbaneDay(c.checked_at)===brisbaneDay(time)).length;
  const ordered=[...merged.values()].sort((a,b) => a.priority-b.priority || (b.stories_liked??0)-(a.stories_liked??0) || a.username.localeCompare(b.username));
  const normal=ordered.filter(r=>r.priority!==2), returning=ordered.filter(r=>r.priority===2);
  const cursor=handle(returningCursor);
  const rotated=cursor?[...returning.filter(r=>r.username>cursor),...returning.filter(r=>r.username<=cursor)]:returning;
  for (const row of [...normal,...rotated]) {
    const checkpoint = checks[row.username];
    const last = Date.parse(checkpoint?.checked_at);
    if (row.planning_hold) { skipped.push({username:row.username, reason:row.planning_hold}); continue; }
    if (row.awaiting_next_conversation) {
      const due = Date.parse(row.next_approach_at);
      if (!Number.isFinite(due) || time<due) {skipped.push({username:row.username,reason:'returning_contact_24_hour_spacing_or_missing_evidence'});continue;}
    }
    if (checkpoint?.outcome === 'declined_or_protected') { skipped.push({username:row.username,reason:'declined_or_protected'}); continue; }
    if (!tray.has(row.username) && Number.isFinite(last) && time-last < 86400000) {
      skipped.push({username:row.username,reason:'profile_already_checked_today_or_future_checkpoint'}); continue;
    }
    if (row.priority===2 && !tray.has(row.username)) {
      if(time<Date.parse(returningTrial.startsAt) || time>=Date.parse(returningTrial.endsAt)){skipped.push({username:row.username,reason:'extra_lookup_trial_inactive'});continue;}
      if(extraLookups>=returningTrial.dailyExtraLookups){skipped.push({username:row.username,reason:'returning_daily_extra_lookup_budget'});continue;}
      extraLookups++;
    }
    selected.push({...row,audience:row.priority===2?'returning_bc':'viewer',check_method:tray.has(row.username)?'inspect_current_tray_story':'one_profile_check',requires_full_live_review:true,send_clearance:false});
  }
  return {selected:selected.slice(0,Math.max(0,Math.min(25,limit))),remaining:selected.slice(Math.max(0,Math.min(25,limit))),skipped,planning_only:true};
}
export function recordRelationshipCheck(checks, {username, checked_at, outcome, evidence_ref, audience = 'viewer',check_method = 'one_profile_check'}) {
  const key = handle(username);
  if (!key || !Number.isFinite(Date.parse(checked_at)) || !evidence_ref ||
      !['viewer','returning_bc'].includes(audience) || !['one_profile_check','inspect_current_tray_story'].includes(check_method) || !['no_current_story','reviewed','sent_verified','declined_or_protected','held'].includes(outcome)) throw new Error('Actual check outcome and evidence required');
  return {...checks,[key]:{checked_at,outcome,evidence_ref,audience,check_method}};
}
