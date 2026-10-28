import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRelationshipObservation} from './story-relationship-work.mjs';
test('real observation cache is deduplicated while prior-day evidence is retained',()=>{
 const observation={username:'EXAMPLE',checked_at:'2026-10-28T04:00:00Z',outcome:'no_current_story',evidence_ref:'controlled native observation',audience:'returning_bc',check_method:'one_profile_check'};
 let state=applyRelationshipObservation({checks:{},events:[]},observation);
 state=applyRelationshipObservation(state,observation);
 assert.equal(state.events.length,1);assert.equal(state.returning_cursor,'example');
 state=applyRelationshipObservation(state,{...observation,checked_at:'2026-10-29T04:00:00Z',outcome:'reviewed',story_available:true});
 assert.equal(state.events.length,2);assert.equal(Object.keys(state.checks).length,1);assert.equal(state.events[1].story_available,true);
});
