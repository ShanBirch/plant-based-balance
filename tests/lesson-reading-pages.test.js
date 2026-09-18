const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('lib/learning-inline.js','utf8');
function fixture(){
 const c={console,Intl,window:{}};vm.runInNewContext(fs.readFileSync('lib/learn-predictive-content.js','utf8'),c);
 vm.runInNewContext(src.slice(0,src.indexOf('    // STATE'))+'window.data={LESSONS,UNITS};})();',c);
 c.UNITS=c.window.data.UNITS;
 vm.runInNewContext(src.slice(src.indexOf('    function highlightKeyTerms'),src.indexOf('    function renderStorySlide')),c);
 return {c,lessons:Object.values(c.window.data.LESSONS).flat()};
}
const normalize=s=>s.replace(/\s+/g,' ').trim();
test('every lesson keeps all words, punctuation and order while each page is bounded',()=>{
 const {c,lessons}=fixture();
 for(const lesson of lessons){
  const original=JSON.stringify(lesson),pages=c.prepareStorySlides(lesson);
  assert.equal(normalize(pages.map(p=>p.rawText).join(' ')),normalize(lesson.content.intro),lesson.id);
  for(const p of pages){assert.ok(p.rawText.split(/\s+/).length<=42,lesson.id);assert.ok(p.rawText.length<=280 || !p.rawText.includes(' '),lesson.id);}
  assert.equal(JSON.stringify(lesson),original,'presentation must not mutate '+lesson.id);
 }
});
test('approved social text is distributed across short pages, with the correct photo context',()=>{
 const {c,lessons}=fixture(),lesson=lessons.find(l=>l.id==='mind-6-5'),pages=c.prepareStorySlides(lesson);
 assert.ok(pages.length>lesson.content.intro.split(/\n\n+/).length);
 assert.match(pages[0].image.src,/group-walking/);
 for(const p of pages.filter(p=>p.paragraphIndex===4))assert.match(p.image.src,/brain-mri/,'no stock person next to obesity finding');
 assert.ok(pages.some(p=>p.image?.src.includes('brain-mri')));
});
test('existing anatomy images follow their original paragraph when it is split',()=>{
 const {c,lessons}=fixture();
 for(const l of lessons.filter(l=>!l.id.startsWith('mind-'))){
  for(const p of c.prepareStorySlides(l)){
   const expected=l.content.images?.[p.paragraphIndex] !== undefined?l.content.images[p.paragraphIndex]:p.paragraphIndex===0?l.content.image:null;
   if(expected) assert.equal(p.image?.src,typeof expected==='string'?expected:expected.src,l.id);
   assert.ok(p.image?.src, 'every page has a relevant visual: '+l.id);
  }
 }
});
test('new brain imagery is limited to new units and approved social lesson',()=>{
 const {c,lessons}=fixture();
 for(const l of lessons.filter(l=>l.id.startsWith('mind-')&&!/^mind-(3|7|8)-/.test(l.id)&&l.id!=='mind-6-5')){
  const image=c.prepareStorySlides(l)[0].image;
  const original=l.content.images?.[0]!==undefined?l.content.images[0]:l.content.image;
  assert.equal(image?.src||null,typeof original==='string'?original:original?.src||null,l.id);
 }
});
test('loader versions and both feature discovery entries ship together',()=>{
 const html=fs.readFileSync('dashboard.html','utf8');assert.equal((html.match(/learning-inline.js\?v=page-photos-20260918/g)||[]).length,2);
 assert.equal((html.match(/A picture on every lesson page/g)||[]).length,2);
 assert.match(html,/pbb-quiz-theme.css\?v=4-page-photos/);
});
test('older WebViews without sentence segmentation preserve citations and every word',()=>{
 const {c,lessons}=fixture();c.Intl={};
 for(const l of lessons){const pages=c.prepareStorySlides(l);assert.equal(normalize(pages.map(p=>p.rawText).join(' ')),normalize(l.content.intro),l.id);}
});

test('all reading pages include an image and a bundled recovery photo',()=>{
 const {c,lessons}=fixture(); let count=0;
 for(const l of lessons) for(const p of c.prepareStorySlides(l)) {
  assert.ok(p.image?.src,l.id); assert.ok(fs.existsSync(p.fallbackImage.src),l.id); count++;
 }
 console.log(`${lessons.length} lessons, ${count} illustrated reading pages`);
});
test('paragraph topics choose practical photos without changing dedicated original images',()=>{
 const {c}=fixture(); const l={id:'mind-4-1',unitId:'mind-4',content:{}};
 for(const [text,file] of [['Sleep and bedtime','sleep-bedroom'],['Protein and vegetables','plant-bowl'],['Walking and water','walking-shoes'],['Lifting dumbbells','strength-equipment'],['Plan a routine','weekly-planner']]) {
  assert.ok(c.storyPhoto(l,1,null,text).src.includes(file));
 }
 const original={src:'anatomy.png'}; assert.equal(c.storyPhoto(l,1,original,'sleep'),original);
});
