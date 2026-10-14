import test from 'node:test';
import assert from 'node:assert/strict';
import {facebookPost,dailyProgress,eligibleFacebookPost} from '../scripts/fb-public-comment-policy.mjs';
test('Facebook exact URLs reject profile/feed/external and preserve stable ID aliases',()=>{
 assert.equal(facebookPost('https://facebook.com/alice/posts/123?tracking=x').post_key,facebookPost('https://www.facebook.com/permalink.php?story_fbid=123&id=42').post_key);
 assert.equal(facebookPost('https://facebook.com/reel/456').post_key,facebookPost('https://facebook.com/watch/?v=456').post_key);
 for(const u of ['https://facebook.com/','https://facebook.com/alice','https://facebook.com.evil.test/alice/posts/123']) assert.throws(()=>facebookPost(u));
});
test('resuming segments retains verified and uncertain reservations and separate days',()=>{
 const a=Array.from({length:49},(_,i)=>({id:String(i),brisbane_day:'2026-10-14',status:i===0?'uncertain':'verified'}));
 assert.deepEqual(dailyProgress([...a,a[1]],'2026-10-14'),{target:50,verified:48,reserved:49,remaining:1,complete:false});
 assert.equal(dailyProgress(a,'2026-10-15').remaining,50);
 assert.equal(dailyProgress([...a,{id:'last',brisbane_day:'2026-10-14',status:'verified'}],'2026-10-14').remaining,0);
});
test('incomplete identity/history/holds and lifetime exact posts fail closed',()=>{
 const now=Date.parse('2026-10-14T04:00:00Z');
 const p={url:'https://www.facebook.com/alice/posts/123/',personKey:'fb:alice',nativePostKey:'fb:post:123',publishedAt:new Date(now-1000).toISOString(),origin:'home_feed',organic:true,followingVerified:true,historyComplete:true,eligibilityClear:true,crossWorkerClear:true,mediaUnderstood:true};
 assert.equal(eligibleFacebookPost(p,{now}),true);
 for(const key of ['organic','followingVerified','historyComplete','eligibilityClear','crossWorkerClear','mediaUnderstood']) assert.equal(eligibleFacebookPost({...p,[key]:false},{now}),false);
 assert.equal(eligibleFacebookPost(p,{now,attempts:[{post_key:p.nativePostKey,reserved_at:'2020-01-01',status:'uncertain'}]}),false);
});
