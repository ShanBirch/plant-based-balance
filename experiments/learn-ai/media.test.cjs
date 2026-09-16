const test=require('node:test'),assert=require('node:assert/strict');
const {prepare}=require('./media.cjs');
const msg=(id,text)=>({id,direction:'in',text,manychat_message_id:'ig_graph:'+id});
function fixture(){
 const calls=[],marked=[];
 const deps={normalizeImplicitMediaMarkers:s=>s,extractMediaReferences:s=>[...s.matchAll(/\[(PHOTO|AUDIO|VIDEO):/g)],buildDurableDraftPayload:async()=>null,markDraftAnalysis:async(...args)=>marked.push(args),callGeminiFallback:async()=> 'The photo shows a timetable with Tuesday at 6 pm.',callVertexGeminiMultimodal:async()=>{throw Error('unavailable');},buildMessageMediaBatchParts:async(texts,options)=>{
 calls.push({texts,options});const text=texts[0],a=text.includes('AUDIO'),p=text.includes('PHOTO'),v=text.includes('VIDEO');
 return{audioUrlCount:+a,audioTranscriptCount:+a,photoUrlCount:+p,videoUrlCount:+v,videoFileCount:0,reelContextCount:0,rewrittenMessages:[a?'[Voice note transcript] I want to get stronger and I can train at home.':text],imageParts:p?[{}]:[],videoParts:v?[{}]:[],mediaParts:[{inlineData:{mimeType:v?'video/mp4':'image/jpeg',data:'fixture'}}]};}};
 return{deps,calls,marked};
}
test('voice note plus quick text uses the saved transcript and preserves message order',async()=>{
 const {deps,calls,marked}=fixture();const messages=[msg('audio','[AUDIO:https://expired.example/audio]'),msg('text','Three days a week')];
 const payload={manychatMessageId:'audio',messageText:'[AUDIO:https://private.example/signed]',durableMediaIds:['media-a'],audioTranscriptOverrides:[{verified:true,text:'I want to get stronger and I can train at home.'}]};
 const result=await prepare(messages,{payload},deps);
 assert.match(result.messages[0].text,/get stronger/);assert.equal(result.messages[1].text,'Three days a week');
 assert.equal(calls.length,0); // Verified transcript avoids refetching expired audio.
 assert.deepEqual(marked[0][1].analyzed_kinds,['audio']);
});
test('photo observations reach the conversation and cached media is not fetched again',async()=>{
 const {deps,calls}=fixture(),message=msg('photo','[PHOTO:https://example.test/image]');
 const first=await prepare([message],{},deps);assert.match(first.messages[0].text,/Tuesday at 6 pm/);
 const next=await prepare([message,msg('later','That time suits')],{receipts:[{data:{media_context:first.context}}]},deps);
 assert.equal(calls.length,1);assert.match(next.messages[0].text,/Tuesday/);
});
test('video uses the old frame-and-speech decoder with its video-capable fallback',async()=>{
 const {deps}=fixture();let decoded=false;
 deps.prepareVideoForOpenAI=async()=>{decoded=true;return{contents:[{parts:[{text:'Video speech: I prefer Zoom'}]}]};};
 deps.callOpenAITextModel=async contents=>contents[0].parts[0].text;
 let result=await prepare([msg('video','[VIDEO:https://example.test/video]')],{},deps);assert.equal(decoded,true);assert.match(result.messages[0].text,/prefer Zoom/);
 deps.prepareVideoForOpenAI=async()=>{throw Error('large clip');};deps.callGeminiFallback=async()=> 'Video shows a home gym';
 result=await prepare([msg('video','[VIDEO:https://example.test/video]')],{},deps);assert.match(result.messages[0].text,/home gym/);
});
test('unreadable voice notes remain retryable and never become invented content',async()=>{
 const {deps}=fixture(),build=deps.buildMessageMediaBatchParts;
 deps.buildMessageMediaBatchParts=async(...args)=>({...await build(...args),audioTranscriptCount:0});
 await assert.rejects(prepare([msg('audio','[AUDIO:https://example.test/audio]')],{},deps),error=>error.code==='media_wait');
});
test('an answered historical attachment does not block a new typed message',async()=>{
 const {deps,calls}=fixture();await prepare([msg('old','[PHOTO:https://expired.example/image]'),msg('new','Yes please')],{pendingIds:['new']},deps);assert.equal(calls.length,0);
});
