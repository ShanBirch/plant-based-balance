const test=require('node:test'),assert=require('node:assert/strict');
const {duration,createPresence}=require('./presence.cjs');
test('short replies, paragraphs and attachments get proportional bounded pacing',()=>{
 assert.equal(duration({type:'text',text:'Yep, no worries.'}),3200);
 assert.equal(duration({type:'text',text:Array(45).fill('word').join(' ')}),20000);
 assert.equal(duration({type:'text',text:Array(200).fill('word').join(' ')}),30000);
 assert.equal(duration({type:'video'}),1800);
});
test('processing counts toward first reply and later paragraphs get their own typing time',async()=>{
 let time=0,tick,cleared=false;const calls=[],waits=[];
 const p=createPresence({signal:async a=>{calls.push(a);return{ok:true};},now:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},setEvery:fn=>{tick=fn;return 1;},clearEvery:()=>{cleared=true;}});
 await p.start();time=12000;
 const action={type:'text',text:Array(45).fill('word').join(' ')};
 await p.before(action);assert.deepEqual(waits,[8000]);
 await p.delivered(true);await p.before(action);assert.deepEqual(waits,[8000,20000]);
 time+=45000;tick();await new Promise(setImmediate);
 assert.equal(calls.at(-1),'typing_on');assert.equal(calls.includes('typing_off'),false);
 await p.delivered(false);await p.stop();assert.equal(calls.at(-1),'typing_off');assert.equal(cleared,true);
 const count=calls.length;tick();await new Promise(setImmediate);assert.equal(calls.length,count);
 assert.equal(calls[0],'mark_seen');assert.equal(calls[1],'typing_on');
});
test('slow heartbeat never overlaps and is drained before final typing-off',async()=>{
 let tick,release,active=0,maxActive=0;const calls=[];
 const p=createPresence({signal:async a=>{calls.push(a);active++;maxActive=Math.max(maxActive,active);if(calls.length===3)await new Promise(r=>{release=r;});active--;return{ok:true};},setEvery:fn=>{tick=fn;return 1;},clearEvery:()=>{}});
 await p.start();tick();tick();await new Promise(setImmediate);assert.equal(maxActive,1);
 const stopped=p.stop();release();await stopped;assert.equal(calls.at(-1),'typing_off');assert.equal(maxActive,1);
});
test('cosmetic sender-action failure does not strand the actual reply',async()=>{
 const p=createPresence({signal:async()=>{throw Error('network_timeout');},setEvery:()=>1,clearEvery:()=>{},wait:async()=>{}});
 await p.start();await p.before({type:'image'});await p.delivered(false);await p.stop();
 assert.equal(p.events.length,3);assert.ok(p.events.every(e=>e.ok===false));
});
