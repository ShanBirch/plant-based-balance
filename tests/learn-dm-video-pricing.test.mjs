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
    assert.match(launchVideo,/balance-learn-dm-149-v10\.mp4$/);
    assert.match(standardVideo,/balance-learn-dm-450-v10\.mp4$/);
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
