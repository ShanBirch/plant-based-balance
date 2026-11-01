const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('preview and source requests never overwrite the normal offline dashboard',async()=>{
 const source=fs.readFileSync('sw.js','utf8'),start=source.indexOf('async function shellResponse('),end=source.indexOf('// Cache only public app files',start);let writes=0;
 const c={URL,AbortController,setTimeout,clearTimeout,CACHE_NAME:'fixture',self:{location:{origin:'https://example.test'}},caches:{open:async()=>({match:async()=>null,put:async()=>writes++})},fetch:async()=>({ok:true,status:200,type:'basic',clone:()=>({})})};vm.runInNewContext(source.slice(start,end)+';this.run=shellResponse;',c);
 for(const query of ['?onboarding_replay=1','?onboarding_source=1','?view_as=other'])await c.run({request:{},waitUntil(){}},new URL('https://example.test/dashboard.html'+query));assert.equal(writes,0);
 await c.run({request:{},waitUntil(){}},new URL('https://example.test/dashboard.html'));assert.equal(writes,1);
});
