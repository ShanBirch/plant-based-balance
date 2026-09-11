const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8'),css=fs.readFileSync(path.join(root,'css/dashboard/dashboard-style-1.css'),'utf8'),source=fs.readFileSync(path.join(root,'lib/learning-inline.js'),'utf8');
test('course mascot has an inline image before the optional 3D element',()=>{
 const start=html.indexOf('id="learnMascotAvatar"'),end=html.indexOf('</model-viewer>',start),markup=html.slice(start,end);
 assert.ok(markup.indexOf('<svg')<markup.indexOf('<model-viewer'));
 assert.match(markup,/aria-label="Your learning companion"/);
 const svg=markup.slice(markup.indexOf('<svg'),markup.indexOf('</svg>')+6);
 assert.ok(Buffer.byteLength(svg)<2000);
 assert.doesNotMatch(svg,/<image|(?:href|src)=/);
 assert.match(css,/\.learn-mascot-avatar\.model-ready model-viewer \{ opacity: 1; \}/);
 assert.match(css,/\.learn-mascot-avatar\.model-ready \.learn-mascot-preview \{ visibility: hidden; \}/);
});
test('iPhone show and reopen work without requesting a model',()=>{
 const start=source.indexOf('window.LearningMascot = {'),end=source.indexOf('\n    };',start)+7;
 for(const ios of [true,false]){
  const classes=new Set(),requests=[],model={dataset:{lazySrc:'model.glb'},getAttribute:()=>requests[0],setAttribute:(_,value)=>requests.push(value)};
  const context={window:{_pbbIsIOSSafari:ios},document:{getElementById:id=>id==='learnMascot'?{classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}}:id==='mascot-model'?model:null},setTimeout:()=>0};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const mascot=context.window.LearningMascot;mascot.show();mascot.hide();mascot.show();
  assert.ok(classes.has('visible'));assert.equal(requests.length,ios?0:1);
 }
});
test('successful model load replaces the preview; failure restores it',()=>{
 const classes=new Set(),element={closest:()=>({classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}})};
 const start=html.indexOf('id="mascot-model"'),markup=html.slice(start,html.indexOf('</model-viewer>',start));
 const load=markup.match(/onload="([^"]+)"/)[1],error=markup.match(/onerror="([^"]+)"/)[1];
 new Function(load).call(element);assert.ok(classes.has('model-ready'));
 new Function(error).call(element);assert.equal(classes.has('model-ready'),false);
});
