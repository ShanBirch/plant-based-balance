import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LEARN_INTRO_END, getLearnCoursePricing } from '../lib/learn-course-pricing.js';
const require=createRequire(import.meta.url);
const { BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL: launchVideo, BALANCE_LEARN_STANDARD_VIDEO_URL: standardVideo,
    BALANCE_LEARN_STANDARD_START_MS, resolveBalanceFoundationsAppProofVideoUrl: resolveVideo,
    resolvePaidMetaProofVideoAttachmentUrl: resolveAttachment, stripPaidMetaProofMediaUrls }=require('../netlify/functions/_lib/paid-meta-proof-media.js');

test('DM video and checkout change at the same Brisbane launch-offer boundary',()=>{
    assert.equal(BALANCE_LEARN_STANDARD_START_MS,Date.parse(LEARN_INTRO_END));
    for(const date of ['2026-09-21T00:00:00+10:00','2026-10-20T23:59:59.999+10:00']){
        assert.equal(getLearnCoursePricing(date).unitAmount,14900);
        assert.equal(resolveVideo(Date.parse(date)),launchVideo);
    }
    assert.equal(getLearnCoursePricing(LEARN_INTRO_END).unitAmount,45000);
    assert.equal(resolveVideo(Date.parse(LEARN_INTRO_END)),standardVideo);
    assert.match(launchVideo,/balance-learn-dm-149-v15-typewriter\.mp4$/);
    assert.match(standardVideo,/balance-learn-dm-450-v15-typewriter\.mp4$/);
});
test('queued old social and expired-price drafts resolve to the correct current DM video',()=>{
    const legacy='https://plantbased-balance.org/assets/balance-foundations-course-first-v8.mp4';
    assert.equal(resolveAttachment(legacy,Date.parse('2026-09-21')),launchVideo);
    assert.equal(resolveAttachment(legacy,Date.parse(LEARN_INTRO_END)),standardVideo);
    assert.equal(resolveAttachment(launchVideo,Date.parse(LEARN_INTRO_END)),standardVideo);
    assert.equal(resolveAttachment('https://example.com/exercise.mp4'), 'https://example.com/exercise.mp4');
    for(const url of [legacy,launchVideo,standardVideo]) assert.equal(stripPaidMetaProofMediaUrls(`Here is the video: ${url}`),'Here is the video:');
});
test('the spoken DM offer uses the same $450 price after launch month',t=>{
    t.mock.method(Date,'now',()=>Date.parse(LEARN_INTRO_END));
    const {buildPaidMetaTailoredOfferChunks}=require('../netlify/functions/ig-instant-draft.js')._test;
    const text=buildPaidMetaTailoredOfferChunks('My shifts change every week','Build strength','broad_pain').join(' ');
    assert.match(text,/AUD \$450 payment for the full six weeks/);
    assert.doesNotMatch(text,/\$149/);
});

test('queued v9 video is upgraded and removed from duplicate text',()=>{
 for(const price of [149,450]) {
 const old='https://plantbased-balance.org/assets/balance-learn-dm-'+price+'-v9.mp4';
 assert.equal(resolveAttachment(old,Date.parse('2026-09-21')),launchVideo);
 assert.equal(resolveAttachment(old,Date.parse(LEARN_INTRO_END)),standardVideo);
 assert.equal(stripPaidMetaProofMediaUrls('Video: '+old),'Video:');
 }
});

test('queued v10 attachments upgrade to the quieter-music revision',()=>{
 for(const price of [149,450]) {
 const old='https://plantbased-balance.org/assets/balance-learn-dm-'+price+'-v10.mp4';
 assert.equal(resolveAttachment(old,Date.parse('2026-09-21')),launchVideo);
 assert.equal(resolveAttachment(old,Date.parse(LEARN_INTRO_END)),standardVideo);
 assert.equal(stripPaidMetaProofMediaUrls('Video: '+old),'Video:');
 }
});

test('retired eight-week attachments are replaced with the current six-week originals',()=>{
 for(const price of [149,450]) {
  const old=`https://plantbased-balance.org/assets/balance-learn-dm-${price}-v12-eight-weeks.mp4`;
  assert.equal(resolveAttachment(old,Date.parse('2026-09-21')),launchVideo);
  assert.equal(resolveAttachment(old,Date.parse(LEARN_INTRO_END)),standardVideo);
  assert.equal(stripPaidMetaProofMediaUrls(`Here is the video: ${old}`),'Here is the video:');
 }
});


test('queued v11 launch attachments use the approved September 15 final edit',()=>{
 const old='https://plantbased-balance.org/assets/balance-learn-dm-149-v11.mp4';
 assert.equal(resolveAttachment(old,Date.parse('2026-09-16T12:00:00+10:00')),launchVideo);
 assert.equal(resolveAttachment(old,Date.parse(LEARN_INTRO_END)),standardVideo);
 assert.equal(stripPaidMetaProofMediaUrls(`Here is the video: ${old}`),'Here is the video:');
 const {maySendDraftVideoAttachment}=require('../netlify/functions/_lib/paid-meta-proof-media.js');
 assert.equal(maySendDraftVideoAttachment({videoUrl:launchVideo,replyText:'Here is the course video'}),true);
 assert.equal(maySendDraftVideoAttachment({videoUrl:launchVideo,replyText:'How is your week?'}),false);
});


test('queued pre-energy videos upgrade without duplicating URLs or bypassing introduction',()=>{
 const {maySendDraftVideoAttachment}=require('../netlify/functions/_lib/paid-meta-proof-media.js');
 for(const old of ['balance-learn-dm-149-v13-polished-cards.mp4','balance-learn-dm-450-v11.mp4']){
 const url='https://plantbased-balance.org/assets/'+old;
 assert.equal(resolveAttachment(url,Date.parse('2026-09-16T12:00:00+10:00')),launchVideo);
 assert.equal(resolveAttachment(url,Date.parse(LEARN_INTRO_END)),standardVideo);
 assert.equal(stripPaidMetaProofMediaUrls('Video: '+url),'Video:');
 assert.equal(maySendDraftVideoAttachment({videoUrl:url,replyText:'How are you?'}),false);
 }
});


test('queued v14 energy editions resolve to current typewriter editions',()=>{for(const price of [149,450]){const old='https://plantbased-balance.org/assets/balance-learn-dm-'+price+'-v14-energy-context.mp4';assert.equal(resolveAttachment(old,Date.parse('2026-09-16')),launchVideo);assert.equal(resolveAttachment(old,Date.parse(LEARN_INTRO_END)),standardVideo);assert.equal(stripPaidMetaProofMediaUrls('Video: '+old),'Video:');}});

test('Learn AI ad catalogue shares the canonical current video and price boundary',()=>{
 const {catalogue}=require('../experiments/learn-ai/flow.cjs');
 assert.equal(catalogue(new Date('2026-09-16')).course.url,launchVideo);
 assert.equal(catalogue(new Date(LEARN_INTRO_END)).course.url,standardVideo);
});
