import test from 'node:test';
import assert from 'node:assert/strict';
import {outreachInsights} from '../scripts/ig-outreach-insights.mjs';
import {storyObservation} from '../scripts/ig-story-observation.mjs';
const base = () => ({window:{start:'2026-11-01T00:00:00Z',end:'2026-12-01T00:00:00Z'},
 asOf:'2026-11-15T00:00:00Z',
 outreachCandidates:[{personId:'a',handle:'someone',relationshipKind:'lead',replyDays:5,inboundMessages:10,lastReply:'2026-11-14T00:00:00Z'}],
 contactProfiles:[{personId:'a',identityVerified:true,reviewId:'review',relationshipKind:'lead'}]});
const obs = extra => ({observationId:'one',personId:'a',storyId:'123',observedAt:'2026-11-14T14:10:00Z',
 state:'present',source:'historical_action_receipt',evidenceRef:'receipt',...extra});
test('deduplicates Story frames and distinguishes sighting days from posting times',()=>{
 const i=base(); i.storyObservations=[obs(),obs(),obs({observationId:'two',observedAt:'2026-11-14T16:00:00Z'})];
 const r=outreachInsights(i).topProspects[0].story;
 assert.equal(r.uniqueStoriesObserved,1); assert.equal(r.daysSeenPosting,1);
 assert.equal(r.activeDates[0],'2026-11-15'); assert.deepEqual(r.postingHoursBrisbane,{});
 assert.equal(r.observedPresenceRate,null);
 assert.throws(()=>outreachInsights({...i,storyObservations:[obs(),obs({storyId:'456'})]}),/Conflicting/);
});
test('client, personal and string controls exclude even the most active people',()=>{
 for(const kind of ['client','personal','former_client']){
  const i=base();i.contactProfiles[0].relationshipKind=kind;
  assert.equal(outreachInsights(i).topProspects.length,0);
 }
 const i=base();i.outreachCandidates[0].controls={manual:'true'};
 i.contactProfiles[0].controls={manual:false};
 assert.equal(outreachInsights(i).topProspects.length,0);
 i.outreachCandidates[0].controls={outreachExcluded:true};
 i.contactProfiles[0].controls={outreachExcluded:false};
 assert.equal(outreachInsights(i).topProspects.length,0);
});
test('unknown identity and unreviewed challenge keywords never qualify interest',()=>{
 const i=base();i.contactProfiles=[];
 assert.equal(outreachInsights(i).topProspects.length,0);
 const j=base();j.challengeSignals=[{personId:'a',kind:'interest',explicit:true}];
 assert.equal(outreachInsights(j).topProspects[0].challengeInterest,'unknown');
 j.challengeSignals=[{personId:'a',kind:'declined',explicit:true,reviewId:'r',sourceMessageId:'m',at:'2026-11-14T00:00:00Z'}];
 assert.equal(outreachInsights(j).topProspects.length,0);
});
test('posting time needs separate verification; unknown observation coverage is not zero',()=>{
 const i=base();i.storyObservations=[obs({postedAt:'2026-11-14T12:00:00Z'})];
 assert.equal(outreachInsights(i).topProspects[0].story.verifiedPostingTimes,0);
 i.storyObservations[0].postedAtVerified=true;
 assert.deepEqual(outreachInsights(i).topProspects[0].story.postingHoursBrisbane,{'22':1});
 i.storyObservations=[];assert.equal(outreachInsights(i).topProspects[0].story.uniqueStoriesObserved,null);
});
test('collector rejects mismatched sources; displayed age stays distinct from exact time',()=>{
 const e={personId:'a',handle:'someone',reviewId:'native-proof',nativeIdentityVerified:true,
 observedAt:'2026-11-14T00:00:00Z',state:'present',storyUrl:'https://www.instagram.com/stories/someone/123/',displayedAge:'2h'};
 const r=storyObservation(e);assert.equal(r.displayedAge,'2h');assert.equal(r.postedAt,undefined);
 assert.throws(()=>storyObservation({...e,storyUrl:'https://www.instagram.com/stories/other/123/'}),/Exact/);
 assert.throws(()=>storyObservation({...e,postedAt:e.observedAt}),/Verified/);
});
