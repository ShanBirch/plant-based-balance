const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInstagramStorySource: parse, assessInstagramStoryVideo: assess } =
  require('../scripts/lib/ig-story-observation');

function sample(overrides = {}) {
  return { observedAt: 1000, source: parse('https://www.instagram.com/stories/alice/123/', 'alice'),
    replyVisible: true, playVisible: true, pauseVisible: false,
    media: [{src:'blob:actual',paused:true,time:2,duration:8,ready:4,width:1080,height:1920,muted:true}],
    ...overrides };
}
test('exact creator/id only; creator-only and neighbouring links cannot become sources', () => {
  assert.equal(parse('https://www.instagram.com/stories/alice/', 'alice'), null);
  assert.equal(parse('https://www.instagram.com/stories/bob/123/', 'alice'), null);
  assert.equal(parse('https://evil.test/stories/alice/123/', 'alice'), null);
  assert.equal(parse('https://www.instagram.com/stories/alice/123/?r=1', 'alice').storyId, '123');
});
test('stable loaded video remains visual-review-only, never send authorization', () => {
  const result = assess(sample(), sample({observedAt:2000}));
  assert.equal(result.readyForVisualReview,true);
  assert.equal(result.requiresVisualReview,true);
  assert.equal(result.requiresPlaybackReview,true);
  assert.equal(result.requiresFreshEligibilityAndClaim,true);
});
test('rejects hydration, advancing playback, background-only and changed frames', () => {
  for (const change of [
    {source:null}, {source:parse('https://www.instagram.com/stories/alice/124/','alice')},
    {replyVisible:false}, {playVisible:false}, {pauseVisible:true}, {observedAt:1100},
    {media:[]}, {media:[...sample().media,...sample().media]},
    {media:[{...sample().media[0],paused:false}]},
    {media:[{...sample().media[0],ready:1}]},
    {media:[{...sample().media[0],src:'blob:other'}]},
    {media:[{...sample().media[0],time:3}]},
    {media:[{...sample().media[0],duration:null}]},
    {media:[{...sample().media[0],width:0}]}
  ]) assert.equal(assess(sample(),sample({observedAt:2000,...change})).readyForVisualReview,false,
    JSON.stringify(change));
});
test('same black end boundary cannot pass just because playback stopped', () => {
  const media=[{...sample().media[0],time:7.9}];
  assert.equal(assess(sample({media}),sample({media,observedAt:2000})).reason,'video_at_end_boundary');
});
test('native freeze recovers once only after confirming Pause still exists', async () => {
  const {freezeInstagramStory} = require('../scripts/lib/ig-story-observation');
  let clicks=0, waits=0;
  const reply={waitFor:async()=>{},isVisible:async()=>true};
  const pause={isVisible:async()=>true,click:async()=>{clicks++;}};
  const play={waitFor:async()=>{if(++waits===1)throw new Error('hydration race');}};
  await freezeInstagramStory({playwright:{getByRole:(_r,{name})=>
    name==='Pause'?pause:name==='Play'?play:reply}});
  assert.equal(clicks,2);
  assert.equal(waits,2);
});
test('native freeze never blindly toggles after Pause disappeared', async () => {
  const {freezeInstagramStory} = require('../scripts/lib/ig-story-observation');
  let clicks=0, pauseReads=0;
  const reply={waitFor:async()=>{},isVisible:async()=>true};
  const pause={isVisible:async()=>++pauseReads===1,click:async()=>{clicks++;}};
  const play={waitFor:async()=>{throw new Error('changed frame');}};
  await assert.rejects(freezeInstagramStory({playwright:{getByRole:(_r,{name})=>
    name==='Pause'?pause:name==='Play'?play:reply}}),/changed frame/);
  assert.equal(clicks,1);
});
