const {test} = require('node:test');
const assert = require('node:assert/strict');
const {build,render,load} = require('../js/admin-engagement-history');
const thread = {id:'synthetic-contact',channel:'instagram'};
const msg = (id,direction,text,created_at,thread_id=thread.id)=>({id,direction,text,created_at,thread_id,source:'synthetic'});
test('counts raw activity separately and only candidate substantive returns',()=>{
 const rows=[msg('1','in','I want to train twice weekly','2026-10-01T01:00:00Z'),msg('2','out','That sounds achievable','2026-10-01T02:00:00Z'),msg('3','in','Thanks!','2026-10-02T05:00:00Z'),msg('4','in','My goal is to build consistency','2026-10-04T05:00:00Z'),msg('5','out','Let us look at your schedule','2026-10-04T06:00:00Z')];
 const result=build(thread,[...rows,rows[0],msg('foreign','in','I want to do something else','2026-10-05T01:00:00Z','other')],{complete:true});
 assert.equal(result.rows.length,5);assert.equal(result.inboundDays,3);assert.equal(result.returning,1);assert.equal(result.goals.length,2);assert.equal(result.suggestion.action,'Wait / no follow-up');
});
test('partial history blocks suggestions and invalid messages cannot fabricate days',()=>{
 const result=build(thread,[msg('bad','in','I want to train more often','invalid'),msg('1','in','I want to train more often','2026-10-01T01:00:00Z')]);
 assert.equal(result.inboundDays,1);assert.equal(result.suggestion.action,'Review history coverage');assert.equal(result.returning,0);
});
test('inbound review and escaping do not produce sends or invented goals',()=>{
 const result=build(thread,[msg('1','in','<img src=x onerror=alert(1)>','2026-10-01T01:00:00Z')],{complete:true});
 assert.equal(result.suggestion.action,'Review and draft a reply');assert.equal(result.goals.length,0);assert.ok(!render(result,thread).includes('<img'));assert.match(render(result,thread),/Public comments/);
});
test('read-only loader paginates, retains thread filter, and surfaces permission errors',async()=>{
 const calls=[];let page=0;
 const client={from(table){assert.equal(table,'ig_messages'); const q={select(){return q},eq(k,v){calls.push([k,v]);return q},order(){return q},range(){return Promise.resolve({data:page++===0?Array.from({length:500},(_,i)=>msg(String(i),'in','thanks','2026-10-01T01:00:00Z')):[]})}};return q}};
 assert.equal((await load(client,thread)).rows.length,500);assert.equal(page,2);assert.ok(calls.every(([k,v])=>k==='thread_id'&&v===thread.id));
 const denied={from(){const q={select(){return q},eq(){return q},order(){return q},range(){return Promise.resolve({error:new Error('denied')})}};return q}};
 await assert.rejects(load(denied,thread),/denied/);
});
test('high message volume and acknowledgements do not establish interest',()=>{
 const rows=Array.from({length:100},(_,i)=>msg(String(i),i%2?'out':'in',i%2?'Checking in':'Thanks!',new Date(Date.UTC(2026,9,1+i)).toISOString()));
 const model=build(thread,rows,{complete:true});
 assert.equal(model.returning,0);assert.equal(model.topics.length,0);assert.equal(model.suggestion.action,'Wait / no follow-up');
});
test('latest words ground review guidance and remain escaped',()=>{
 const text='My goal is to train <script>alert(1)</script>';
 const model=build(thread,[msg('1','in',text,'2026-10-01T01:00:00Z')],{complete:true});
 assert.ok(model.suggestion.reason.includes(text));assert.ok(!render(model,thread).includes('<script>'));assert.match(model.suggestion.reason,/reply is optional/);
});
test('missing contact fails before any query',async()=>{
 await assert.rejects(load({from(){throw new Error('Must not query')}},{}),/contact are required/);
});
test('history cap remains partial and cannot recommend a reply',async()=>{
 let page=0;
 const client={from(){const q={select(){return q},eq(){return q},order(){return q},range(){const offset=page++*500;return Promise.resolve({data:Array.from({length:500},(_,i)=>msg(String(offset+i),'in','My goal is to train twice weekly','2026-10-01T01:00:00Z'))})}};return q}};
 const model=await load(client,thread);
 assert.equal(page,20);assert.equal(model.rows.length,10000);assert.equal(model.complete,false);assert.equal(model.suggestion.action,'Review history coverage');
});
test('Brisbane conversation days use local midnight rather than UTC dates',()=>{
 const model=build(thread,[msg('1','in','I want to train twice weekly','2026-10-01T13:59:00Z'),msg('2','in','My goal is to build consistency','2026-10-01T14:01:00Z')],{complete:true});
 assert.equal(model.inboundDays,2);
});
