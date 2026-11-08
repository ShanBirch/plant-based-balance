const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('netlify/functions/ig-media-retry-worker.js','utf8');
test('recovery deduplicates messages, recovers stale leases and continues after dispatch failure', async () => {
  const writes=[], sends=[];
  const sandbox={exports:{},process:{env:{}},Date,JSON,AbortSignal,console:{error(){}},
    require(name){assert.equal(name,'./_lib/client-context');return {supabaseQuery:async(path,options)=>{
      if(options){writes.push(options.body); return [];}
      return [{id:'a',ig_message_id:'one',status:'processing'},{id:'b',ig_message_id:'one',status:'received'},{id:'c',ig_message_id:'two',status:'retry_wait'}];
    }};},
    fetch:async(url,options)=>{assert.match(url,/ig-media-process-background$/);sends.push(JSON.parse(options.body).igMessageId);return {ok:sends.length>1,status:503};}};
  vm.runInNewContext(source,sandbox);
  const result=JSON.parse((await sandbox.exports.handler()).body);
  assert.deepEqual(sends,['one','two']);
  assert.equal(writes[0].status,'retry_wait');
  assert.equal(writes[0].processing_token,null);
  assert.deepEqual(result,{dispatched:1,dispatchErrors:1,recoveredStale:1});
});
test('empty recovery scan makes no background request',async()=>{
 const sandbox={exports:{},process:{env:{}},Date,JSON,AbortSignal,console,require:()=>({supabaseQuery:async()=>[]}),fetch:()=>assert.fail('unexpected dispatch')};
 vm.runInNewContext(source,sandbox);
 assert.equal(JSON.parse((await sandbox.exports.handler()).body).dispatched,0);
});
