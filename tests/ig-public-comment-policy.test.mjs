import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPost,startDiscovery,observePost,prioritiseBatch,remainingCapacity,LIMITS} from '../scripts/ig-public-comment-policy.mjs';
const now=Date.parse('2026-10-14T03:00:00Z');
const post=(id,extra={})=>({url:`https://www.instagram.com/p/${id}/`,author:'fixture',origin:'home_feed',followingVerified:true,publishedAt:new Date(now-1000).toISOString(),historyReviewed:true,eligibilityReviewed:true,mediaUnderstood:true,...extra});
test('exact native URLs canonicalise and reject non-post discovery',()=>{
 assert.equal(canonicalPost('https://instagram.com/reel/abc/?igsh=x'),'https://www.instagram.com/reel/abc/');
 for(const u of ['https://instagram.com/explore/','https://instagram.com.evil.test/p/x/','https://instagram.com/person/']) assert.throws(()=>canonicalPost(u));
});
test('forty DISTINCT observed posts bound discovery including unsuitable posts',()=>{
 const s=startDiscovery(now);
 for(let i=0;i<40;i++) observePost(s,post(`x${i}`,{sponsored:true}),{now});
 assert.equal(s.observed.length,40); assert.equal(s.candidates.length,0);
 assert.equal(observePost(s,post('later'),{now}).stop,true);
});
test('duplicate observations do not create extra candidates and15minute wall holds',()=>{
 const s=startDiscovery(now); observePost(s,post('x'),{now}); observePost(s,post('x'),{now});
 assert.equal(s.observed.length,1); assert.equal(s.candidates.length,1);
 assert.equal(observePost(s,post('late'),{now:now+LIMITS.milliseconds}).stop,true);
});
test('fresh followed organic understood media only; uncertain receipts never retry',()=>{
 for(const patch of [{followingVerified:false},{suggested:true},{sponsored:true},{publishedAt:null},{publishedAt:'2020-01-01'}, {mediaUnderstood:false},{historyReviewed:false},{eligibilityReviewed:false},{origin:'explore'}]) {
  const s=startDiscovery(now); observePost(s,post('x',patch),{now}); assert.equal(s.candidates.length,0);
 }
 const s=startDiscovery(now); observePost(s,post('x'),{now,receipts:[{post_url:post('x').url,status:'uncertain'}]});
 assert.equal(s.candidates.length,0); assert.equal(s.skips[0].reason,'exact_post_no_repeat');
 const alias=startDiscovery(now); observePost(alias,post('x'),{now,receipts:[{post_url:'https://www.instagram.com/reel/x/',status:'uncertain'}]});
 assert.equal(alias.candidates.length,0);
});
test('relationships reorder only the collected batch',()=>{
 const s=startDiscovery(now);observePost(s,post('a'),{now});observePost(s,post('b',{meaningfulPriorRelationship:true}),{now});
 assert.deepEqual(prioritiseBatch(s).map(p=>p.url),[post('b').url,post('a').url]);
});
test('pilot reservations survive date changes and unknown outcomes',()=>{
 const a=Array.from({length:5},(_,i)=>({id:String(i),mode:'pilot',brisbane_day:'2026-10-13',status:'uncertain'}));
 assert.equal(remainingCapacity('pilot',a,'2026-10-14'),0);
 assert.equal(remainingCapacity('daily',a,'2026-10-14'),50);
 assert.equal(remainingCapacity('pilot',[...a,a[0]],'2026-10-14'),0);
 assert.throws(()=>remainingCapacity('pilot',[{}],'2026-10-14'));
});
