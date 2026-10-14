// Pure policy only: identity is always verified separately in the native UI.
export const FACEBOOK_IDENTITY=Object.freeze({name:'Shannon Birch',handle:'shazbirch',url:'https://www.facebook.com/shazbirch'});
export const FACEBOOK_LIMITS=Object.freeze({daily:50,posts:40,milliseconds:900000,freshness:259200000});
export function facebookPost(url) {
 const u=new URL(url);
 if(u.protocol!=='https:'||!['facebook.com','www.facebook.com'].includes(u.hostname)) throw Error('native Facebook post required');
 let id;
 const m=u.pathname.match(/^\/(?:[^/]+\/posts|reel|videos)\/([A-Za-z0-9_-]+)\/?$/);
 if(m) id=m[1];
 else if(['/permalink.php','/story.php'].includes(u.pathname)&&u.searchParams.get('id')) id=u.searchParams.get('story_fbid');
 else if(u.pathname==='/watch/'||u.pathname==='/watch') id=u.searchParams.get('v');
 if(!id||!/^[A-Za-z0-9_-]+$/.test(id)) throw Error('stable native post ID required');
 return {post_key:`fb:post:${id}`,url:m?`https://www.facebook.com${u.pathname.replace(/\/$/,'')}/`:`https://www.facebook.com${u.pathname}?${u.pathname.startsWith('/watch')?'v='+id:'story_fbid='+id+'&id='+u.searchParams.get('id')}`};
}
export function dailyProgress(attempts,day) {
 const unique=new Map(attempts.map(a=>[a.id,a]));
 if([...unique.keys()].some(id=>!id)) throw Error('immutable attempt IDs required');
 const today=[...unique.values()].filter(a=>a.brisbane_day===day);
 const verified=today.filter(a=>a.status==='verified').length;
 return {target:50,verified,reserved:today.length,remaining:Math.max(0,50-today.length),complete:verified>=50};
}
export function eligibleFacebookPost(post,{now=Date.now(),attempts=[]}={}) {
 const exact=facebookPost(post.url);
 const age=now-Date.parse(post.publishedAt);
 if(!Number.isFinite(age)||age<0||age>FACEBOOK_LIMITS.freshness) return false;
 if(!['home_feed','following_feed'].includes(post.origin)||post.organic!==true||post.followingVerified!==true) return false;
 if(!post.personKey||!post.nativePostKey||!post.historyComplete||!post.eligibilityClear||!post.crossWorkerClear||!post.mediaUnderstood) return false;
 return !attempts.some(a=>a.post_key===post.nativePostKey||a.post_key===exact.post_key||
 (a.person_key===post.personKey&&now-Date.parse(a.reserved_at)<7*86400000));
}
