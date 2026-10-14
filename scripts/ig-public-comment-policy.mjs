// Pure bounded discovery policy. This module never opens a browser or sends.
export const LIMITS=Object.freeze({pilot:5,daily:10,posts:40,milliseconds:15*60_000,freshness:72*60*60_000});
export function canonicalPost(url) {
  const u=new URL(url);
  if (!['instagram.com','www.instagram.com'].includes(u.hostname)||u.protocol!=='https:') throw Error('native post URL required');
  const match=u.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) throw Error('exact post URL required');
  return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}
export function startDiscovery(now=Date.now()) {return {startedAt:now,observed:[],candidates:[],skips:[],boundary:'partial'};}
const postKey=url=>canonicalPost(url).split('/')[4];
export function observePost(state,post,{now=Date.now(),receipts=[]}={}) {
  if (!Number.isFinite(state.startedAt)||now<state.startedAt) throw Error('valid discovery start required');
  if (now-state.startedAt>=LIMITS.milliseconds||state.observed.length>=LIMITS.posts) return {stop:true,reason:'discovery_ceiling'};
  const url=canonicalPost(post.url);
  if (state.observed.some(p=>postKey(p)===postKey(url))) return {stop:false,reason:'already_observed'};
  state.observed.push(url);
  const age=now-Date.parse(post.publishedAt);
  let reason;
  if (!['following_feed','home_feed'].includes(post.origin)) reason='unsupported_discovery_surface';
  else if (post.sponsored||post.suggested||post.followingVerified!==true) reason='not_verified_followed_organic_post';
  else if (!Number.isFinite(age)||age<0||age>LIMITS.freshness) reason='native_freshness_unverified_or_old';
  else if (receipts.some(r=>postKey(r.post_url)===postKey(url))) reason='exact_post_no_repeat';
  else if (post.historyReviewed!==true||post.eligibilityReviewed!==true||post.mediaUnderstood!==true) reason='review_incomplete';
  if (reason) state.skips.push({url,author:post.author,reason});
  else state.candidates.push({...post,url});
  return {stop:state.observed.length>=LIMITS.posts,reason:reason||'candidate_collected'};
}
export function prioritiseBatch(state) {
  return state.candidates.map((p,i)=>({p,i})).sort((a,b)=>Number(b.p.meaningfulPriorRelationship===true)-Number(a.p.meaningfulPriorRelationship===true)||a.i-b.i).map(x=>x.p);
}
export function remainingCapacity(mode,allAttempts,day) {
  if (!['pilot','daily'].includes(mode)) throw Error('supported mode required');
  const unique=new Map(allAttempts.map(a=>[a.id,a]));
  if ([...unique.keys()].some(k=>!k)) throw Error('immutable attempt IDs required');
  // Every reservation consumes capacity, regardless of result or delivery certainty.
  const attempts=[...unique.values()];
  const daily=LIMITS.daily-attempts.filter(a=>a.brisbane_day===day).length;
  const pilot=LIMITS.pilot-attempts.filter(a=>a.mode==='pilot').length;
  return Math.max(0,mode==='pilot'?Math.min(pilot,daily):daily);
}
