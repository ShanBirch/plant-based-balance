import test from 'node:test';import assert from 'node:assert/strict';
import {reviewSilentTiming as r} from './story-silent-rolling24-20261030.mjs';
const event=(id,at,extra={})=>({id,attempt_id:id,kind:'proactive',at,verified:true,...extra});
const base={identityVerified:true,historyComplete:true,now:'2026-10-30T00:01:00Z',events:[]};
test('midnight never replaces rolling24h',()=>assert.equal(r({...base,events:[event('a','2026-10-29T23:00:00Z')]}).reason,'rolling_24_hours'));
test('second attempt passes at exactly72h',()=>{const x=r({...base,events:[event('a','2026-10-27T00:01:00Z')]});assert.equal(x.decision,'timing_only_pass');assert.equal(x.clearance,false)});
test('reservation and uncertain actions remain blocking',()=>{for(const extra of [{reserved:true,verified:false},{uncertain:true}])assert.equal(r({...base,events:[event('a','2026-10-28T00:00:00Z',extra)]}).reason,'unresolved_attempt')});
test('linked aliases and several bubbles count once',()=>assert.equal(r({...base,events:[event('a','2026-10-28'),event('a','2026-10-28')]}).unanswered_attempts,1));
test('reciprocal closer is not proactive',()=>assert.equal(r({...base,events:[{id:'c',kind:'reciprocal_closer',at:'2026-10-30T00:00:00Z'}]}).decision,'timing_only_pass'));
test('three attempts require subsequent actual tray evidence and retain seven-day cleanup wait',()=>{const events=[event('a','2026-10-25'),event('b','2026-10-26'),event('c','2026-10-27')];assert.equal(r({...base,events}).decision,'needs_review');const x=r({...base,events,trayObservation:{at:base.now,evidence_ref:'actual-page'}});assert.equal(x.decision,'handoff_for_review');assert.equal(x.eligible_after,'2026-11-03T00:00:00.000Z')});
test('new substantive reply resets silence but not rolling time since latest attempt',()=>{const events=[event('a','2026-10-29T23:00:00Z'),{id:'in',kind:'inbound',substantive:true,at:'2026-10-29T23:30:00Z'}];assert.equal(r({...base,events}).unanswered_attempts,0);assert.equal(r({...base,events}).reason,'rolling_24_hours')});
test('holds, ambiguous reactions and incomplete history never pass',()=>{assert.equal(r({...base,holds:['manual']}).decision,'hold');assert.equal(r({...base,historyComplete:false}).decision,'needs_review');assert.equal(r({...base,events:[{id:'r',kind:'inbound',at:'2026-10-29',substantive:false}]}).decision,'needs_review')});
test('second attempt waits until72h',()=>assert.equal(r({...base,events:[event('a','2026-10-27T00:01:01Z')]}).decision,'hold'));
test('third attempt waits seven days from latest attempt',()=>{
 const events=[event('a','2026-10-20'),event('b','2026-10-23T00:01:01Z')];
 assert.equal(r({...base,events}).decision,'hold');
 assert.equal(r({...base,now:'2026-10-30T00:01:01Z',events}).decision,'timing_only_pass');
});
