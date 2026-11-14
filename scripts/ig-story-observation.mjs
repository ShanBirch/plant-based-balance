import {appendFileSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Called by the existing Story owner after normal native review. No browser,
// sender, discovery, scheduler or shared-report writer is created here.
export function storyObservation(e) {
  const h = String(e.handle || '').toLowerCase().replace(/^@/,'').trim();
  const at = Date.parse(e.observedAt);
  if (!/^[a-z0-9_.]+$/.test(h) || !e.personId || !e.reviewId ||
      e.nativeIdentityVerified !== true || !Number.isFinite(at))
    throw Error('Exact reviewed native identity, source and observation time required');
  if (!['present','absent','unavailable'].includes(e.state)) throw Error('Explicit observation state required');
  let storyId = null;
  if (e.state === 'present') {
    const u = new URL(e.storyUrl);
    const parts = u.pathname.split('/');
    if (u.origin !== 'https://www.instagram.com' || parts[1] !== 'stories' ||
        parts[2] !== h || !/^[0-9]+$/.test(parts[3] || '') ||
        parts.length !== 5 || parts[4] !== '' || u.search || u.hash)
      throw Error('Exact native Story URL required');
    storyId = parts[3];
  }
  const row = {observationId:createHash('sha256').update(JSON.stringify([
    e.personId,storyId,e.observedAt,e.reviewId,e.state])).digest('hex'),
    personId:e.personId,handle:h,storyId,observedAt:e.observedAt,state:e.state,
    source:'native_review',evidenceRef:e.reviewId};
  if (e.displayedAge != null) row.displayedAge = String(e.displayedAge).slice(0,80);
  if (e.postedAt != null) {
    const posted = Date.parse(e.postedAt);
    if (e.postedAtVerified !== true || !Number.isFinite(posted) ||
        posted > at || e.state !== 'present') throw Error('Verified publication time required');
    row.postedAt = e.postedAt; row.postedAtVerified = true;
  }
  return row;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[3]) throw Error('Private contribution journal required');
  const row = storyObservation(JSON.parse(readFileSync(process.argv[2],'utf8')));
  appendFileSync(process.argv[3],JSON.stringify(row)+'\n');
}
