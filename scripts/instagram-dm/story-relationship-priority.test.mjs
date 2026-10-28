import test from 'node:test';
import assert from 'node:assert/strict';
import {planRelationshipChecks,recordRelationshipCheck} from './story-relationship-priority.mjs';
const now='2026-10-28T04:00:00Z';
test('overlapping viewer and ABC identities are merged once, never cleared for send',()=>{
 const p=planRelationshipChecks({now,candidates:[{username:'@Example',priority:1,stories_liked:2},{username:'example',priority:0,awaiting_next_conversation:true,next_approach_at:'2026-10-28T03:00:00Z'}],trayHandles:['EXAMPLE']});
 assert.equal(p.selected.length,1);assert.equal(p.selected[0].priority,0);assert.equal(p.selected[0].send_clearance,false);assert.equal(p.selected[0].check_method,'inspect_current_tray_story');
});
test('saved no-Story check prevents repeated profile work but fresh tray Story can be reviewed',()=>{
 const checks=recordRelationshipCheck({}, {username:'example',checked_at:'2026-10-28T03:00:00Z',outcome:'no_current_story',evidence_ref:'controlled screenshot'});
 const input={now,candidates:[{username:'example',priority:0}],checks};
 assert.equal(planRelationshipChecks(input).selected.length,0);
 assert.equal(planRelationshipChecks({...input,trayHandles:['example']}).selected.length,1);
 assert.equal(planRelationshipChecks({...input,now:'2026-10-29T04:00:00Z'}).selected.length,1);
});
test('declines and holds survive viewer priority and new tray appearances',()=>{
 const p=planRelationshipChecks({now,candidates:[{username:'held',priority:0,planning_hold:'pending_other_owner'},{username:'declined',priority:0}],trayHandles:['held','declined'],checks:{declined:{outcome:'declined_or_protected'}}});
 assert.equal(p.selected.length,0);assert.equal(p.skipped.length,2);
});
test('duplicate unheld row cannot erase a hold',()=>{
 assert.equal(planRelationshipChecks({now,candidates:[{username:'example',planning_hold:'protected'},{username:'example',planning_hold:null}]}).selected.length,0);
});
test('bounded work keeps the rest for continuation and rejects absent evidence',()=>{
 const p=planRelationshipChecks({now,limit:1,candidates:[{username:'one',priority:0},{username:'two',priority:1}]});
 assert.equal(p.selected.length,1);assert.equal(p.remaining.length,1);
 assert.throws(()=>recordRelationshipCheck({}, {username:'one',checked_at:now,outcome:'no_current_story'}));
 assert.throws(()=>planRelationshipChecks({now:'not verified',candidates:[]}));
});
test('24-hour spacing applies to B/C even when also a viewer with a visible Story',()=>{
 const candidate={username:'example',priority:0,awaiting_next_conversation:true,next_approach_at:'2026-10-29T04:00:00Z'};
 assert.equal(planRelationshipChecks({now,candidates:[candidate],trayHandles:['example']}).selected.length,0);
 assert.equal(planRelationshipChecks({now:'2026-10-29T04:00:00Z',candidates:[candidate],trayHandles:['example']}).selected.length,1);
 assert.equal(planRelationshipChecks({now,candidates:[{...candidate,next_approach_at:null}]}).selected.length,0);
});
test('three-day trial allows five shared B/C extra lookups, rotates and still permits current tray matches',()=>{
 const candidates=Array.from({length:20},(_,i)=>({username:'person'+String(i).padStart(2,'0'),priority:2,awaiting_next_conversation:true,next_approach_at:'2026-10-27T01:00:00Z'}));
 const p=planRelationshipChecks({now,limit:25,candidates,returningCursor:'person09'});
 assert.equal(p.selected.length,5);assert.equal(p.selected[0].username,'person10');
 const checks=Object.fromEntries(p.selected.map(r=>[r.username,{checked_at:now,outcome:'no_current_story',audience:'returning_bc',check_method:'one_profile_check'}]));
 assert.equal(planRelationshipChecks({now,limit:25,candidates,checks}).selected.length,0);
 assert.equal(planRelationshipChecks({now,limit:25,candidates,checks,trayHandles:['person00']}).selected.length,1);
 assert.equal(planRelationshipChecks({now:'2026-10-31T00:00:00Z',limit:25,candidates}).selected.length,0);
 assert.equal(planRelationshipChecks({now:'2026-10-31T00:00:00Z',limit:25,candidates,trayHandles:['person00']}).selected.length,1);
});
test('later tray observations cannot erase already spent profile search budget',()=>{
 const observations=Array.from({length:5},(_,i)=>({username:'prior'+i,checked_at:now,audience:'returning_bc',check_method:'one_profile_check'}));
 const candidates=[{username:'next',priority:2,awaiting_next_conversation:true,next_approach_at:'2026-10-27T00:00:00Z'}];
 assert.equal(planRelationshipChecks({now,candidates,checks:{},observations}).selected.length,0);
});
