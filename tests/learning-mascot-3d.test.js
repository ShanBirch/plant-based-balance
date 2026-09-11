const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/dashboard/pbb-course-mascot.js'),'utf8');
function fixture({ios=true, registered=true, safeBoot=false}={}) {
 const classes=new Set(), attributes={},events={},timers=new Map(),requests=[];
 let restored=0,plays=0,pauses=0,sequence=0;
 const avatar={classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle:(n,b)=>b?classes.add(n):classes.delete(n)}};
 const model={tagName:'MODEL-VIEWER',dataset:{lazySrc:'assets/models/shanbot-course-v1.glb'},closest:()=>avatar,addEventListener:(n,cb)=>events[n]=cb,getAttribute:n=>attributes[n],setAttribute:(n,v)=>{attributes[n]=v;if(n==='src')requests.push(v)},removeAttribute:n=>delete attributes[n],play:()=>plays++,pause:()=>pauses++};
 const status={textContent:''},mascot={classList:{contains:()=>classes.has('visible')}};
 const scripts=[];
 const context={window:{_pbbIsIOSSafari:ios,_pbbNativeViewerAvailable:ios,_pbbDisableCharacterModel:safeBoot,_pbbRestorePlaceholder:()=>{restored++;return model}},document:{getElementById:id=>({'mascot-model':model,learnMascot:mascot,learnMascotAvatar:avatar,learnMascotStatus:status}[id]),querySelector:()=>null,createElement:()=>({dataset:{},addEventListener(){},remove(){}}),head:{appendChild:s=>scripts.push(s)}},customElements:{get:()=>registered?{}:undefined,whenDefined:()=>new Promise(()=>{})},setTimeout:cb=>{timers.set(++sequence,cb);return sequence},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(source,context);
 return {api:context.window.BalanceCourseMascot,classes,model,events,status,scripts,requests,timers,get restored(){return restored},get plays(){return plays},get pauses(){return pauses}};
}
test('original animated 3D mascot is used, never the vector replacement',()=>{
 const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
 const markup=html.slice(html.indexOf('id="learnMascotAvatar"'),html.indexOf('<div class="container">'));
 assert.doesNotMatch(markup,/<svg|learn-mascot-preview/);
 assert.match(markup,/assets\/models\/shanbot-course-v1.glb/);
 assert.match(markup,/animation-name="dance"/);
 assert.match(markup,/pbb-course-mascot.js\?v=1-original-3d/);
 const b=fs.readFileSync(path.join(root,'assets/models/shanbot-course-v1.glb'));
 assert.ok(b.length<2*1024*1024);
 assert.equal(b.readUInt32LE(8),b.length);
 const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.deepEqual(doc.animations.map(a=>a.name),['dance']);
 assert.ok(doc.skins.length>0 && doc.meshes.length>0 && doc.images.length>0);
});
test('iOS and desktop restore a real viewer, eagerly load once, and pause on close',()=>{
 for(const ios of [true,false]){
  const f=fixture({ios});f.api.prepare();f.api.show();f.api.hide();f.api.show();
  assert.ok(f.restored>=1);assert.equal(f.requests.length,1);
  assert.equal(f.model.getAttribute('loading'),'eager');assert.equal(f.model.getAttribute('reveal'),'auto');
  assert.equal(f.plays,2);assert.equal(f.pauses,1);
  f.events.load();assert.ok(f.classes.has('model-ready'));assert.equal(f.status.textContent,'');
 }
});
test('native iOS can request the viewer when Home skipped its library',()=>{
 const f=fixture({registered:false});f.api.show();f.api.show();
 assert.equal(f.scripts.length,1);assert.match(f.scripts[0].src,/model-viewer\/4.1.0/);
});
test('failed load can be retried and success removes error state',()=>{
 const f=fixture();f.api.show();f.events.error();
 assert.equal(f.status.textContent,'Tap to retry');assert.ok(f.api.retryIfNeeded());
 assert.equal(f.requests.length,2);f.classes.add('visible');f.events.load();
 assert.ok(f.classes.has('model-ready'));assert.equal(f.api.retryIfNeeded(),false);
});
test('safe boot stays protected until an explicit tap and slow loads have recovery',()=>{
 const f=fixture({safeBoot:true});f.api.show();assert.equal(f.requests.length,0);
 assert.equal(f.status.textContent,'Tap to load');f.api.retryIfNeeded();assert.equal(f.requests.length,1);
 [...f.timers.values()].forEach(cb=>cb());assert.equal(f.status.textContent,'Tap to retry');
});
test('course entry prepares the model and lesson taps use retry recovery',()=>{
 const learning=fs.readFileSync(path.join(root,'lib/learning-inline.js'),'utf8');
 assert.match(learning,/async function initLearning\(\) \{\s*window.BalanceCourseMascot\?\.prepare\(\)/);
 assert.match(learning,/BalanceCourseMascot\?\.show\(\)/);
 assert.match(learning,/BalanceCourseMascot\?\.hide\(\)/);
 assert.match(learning,/BalanceCourseMascot\?\.retryIfNeeded\(\)/);
});
