const assert = require('node:assert/strict');
const events = new EventTarget();
global.addEventListener = events.addEventListener.bind(events);
global.removeEventListener = events.removeEventListener.bind(events);
global.document = new EventTarget();
global.document.visibilityState = 'visible';
const receipts = require('../lib/voice-feedback-playback.js');
class Audio extends EventTarget {
  constructor() { super(); this.currentTime=0; this.duration=40; this.playbackRate=1; this.seeking=false; }
  fire(name) { this.dispatchEvent(new Event(name)); }
}
(async () => {
  const calls=[];
  const client={rpc:async(name,payload)=>{calls.push({name,...payload});return {error:null};}};
  const msg={id:'message',message:'Weekly check-in [AUDIO:https://example.com/note.mp3]',sender_id:'coach',receiver_id:'client'};
  let time=100000; const realNow=Date.now; Date.now=()=>time;
  try {
    const a=new Audio(); receipts.bind(a,msg,'client',client);
    a.fire('loadedmetadata'); assert.equal(calls.length,0,'opening/loading must not record playback');
    a.fire('playing'); await a.__voiceReceipt.flush(false);
    assert.equal(calls.length,1); assert.deepEqual(calls[0].p_ranges,[],'start is distinct from progress');
    time+=10000;a.currentTime=10;a.fire('timeupdate');await a.__voiceReceipt.flush(false);
    assert.deepEqual(calls[1].p_ranges,[[0,10]]);
    a.seeking=true;a.fire('seeking');a.currentTime=39;a.seeking=false;a.fire('seeked');
    time+=1000;a.currentTime=40;a.fire('ended');await a.__voiceReceipt.flush(false);
    assert.deepEqual(calls[2].p_ranges,[[39,40]],'seek gap must not count as played');assert.equal(calls[2].p_ended,true);
    a.currentTime=10; a.fire('playing');time+=5000;a.currentTime=15;a.fire('pause');await a.__voiceReceipt.flush(false);
    assert.deepEqual(calls.at(-1).p_ranges,[[10,15]],'resume records only actual advancing audio');
    const before=calls.length;receipts.bind(a,msg,'client',client);a.fire('playing');await a.__voiceReceipt.flush(false);
    assert.equal(calls.length,before+1,'binding twice does not duplicate handlers');
    const coach=new Audio();receipts.bind(coach,msg,'coach',client);coach.fire('playing');assert.equal(coach.__voiceReceipt,undefined);
    a.__voiceReceipt.dispose();const count=calls.length;a.fire('playing');await Promise.resolve();assert.equal(calls.length,count,'closed player detaches');
    let fail=true;const b=new Audio();const retry=[];
    receipts.bind(b,msg,'client',{rpc:async(n,p)=>{retry.push(p);return {error:fail ? new Error('offline'):null};}});
    b.fire('playing');await b.__voiceReceipt.flush(false);time+=1000;b.currentTime=1;b.fire('timeupdate');fail=false;
    await b.__voiceReceipt.flush(false);assert.deepEqual(retry.at(-1).p_ranges,[[0,1]],'failed writes are retried');b.__voiceReceipt.dispose();
    const base={label:'Weekly check-in',sent_at:'2026-10-10T00:00:00Z',read_at:'2026-10-10T01:00:00Z'};
    assert.match(receipts.render([base]),/No playback recorded/);
    assert.match(receipts.render([{...base,started_at:'x',duration_seconds:40,listened_seconds:10}]),/Started playing.*25%/);
    assert.match(receipts.render([{...base,completed_at:'x',duration_seconds:40,listened_seconds:40}]),/Completed playback/);
    assert.doesNotMatch(receipts.render([{...base,label:'<img onerror=x>'}]),/<img/);
    console.log('Playback lifecycle, seeking, resume, offline retry, coach exclusion and display tests passed.');
  } finally {Date.now=realNow;}
})().catch(error=>{console.error(error);process.exitCode=1;});
