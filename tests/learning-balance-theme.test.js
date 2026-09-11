const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('lib/learning-inline.js');
const css=read('css/dashboard/pbb-quiz-theme.css');
test('quizzes and rewards opt into a scoped palette, not a changed learning module',()=>{
 const render=source.slice(source.indexOf('function renderCurrentGame()'),source.indexOf('function initOrderDragAndDrop()'));
 assert.match(render,/const module = \{ \.\.\.MODULES\[unit.moduleId\], color: '#80601f' \}/);
 assert.match(render,/learning-game-shell balance-quiz/);
 assert.match(source,/story-container balance-quiz/);
 for(const renderer of ['renderSwipeTrueFalse','renderFillBlank','renderTapAll','renderMatchPairs','renderOrderSequence','renderScenarioStory'])assert.match(render,new RegExp(renderer+'\\(game, module\\)'));
 assert.match(source,/data-lesson-result class="balance-quiz balance-quiz-result"/);
 assert.doesNotMatch(source.match(/<div data-lesson-result[^>]+>/)[0],/module\.color/);
 assert.match(source,/overlay.className = 'balance-quiz-feedback'/);
 assert.match(source,/overlay.dataset.result = isCorrect \? 'correct' : 'incorrect'/);
 assert.match(source,/const colors = \['#d8b25e', '#f6e8bd', '#b8892b', '#fffaf0'\]/);
});
test('each theme pairs readable ink with surfaces and answer states',()=>{
 function luminance(hex){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
 const base={};
 for(const [index,block] of [css.match(/:root \{([^}]+)\}/)[1],css.match(/html:not\(\[data-pbb-theme="light"\]\) \{([^}]+)\}/)[1]].entries()){
  for(const [,key,value] of block.matchAll(/--quiz-([\w-]+):#([\da-f]{6})/g))base[key]=value;
  for(const [fg,bg] of [['ink','bg'],['ink','card'],['ink','selected'],['muted','bg'],['gold','bg'],['button-ink','button'],['correct-ink','correct'],['incorrect-ink','incorrect']]){
   const a=luminance(base[fg]),b=luminance(base[bg]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   assert.ok(ratio>=4.5,`theme ${index} ${fg}/${bg}: ${ratio}`);
  }
 }
 assert.match(css,/-webkit-text-fill-color:var\(--quiz-ink\)/);
 assert.match(css,/learning-answer-correct/);assert.match(css,/learning-answer-incorrect/);
});
test('reward overlays remain scrollable and safe with zero or nonzero phone insets',()=>{
 assert.match(css,/max-height:100%; overflow-y:auto; overscroll-behavior:contain/);
 assert.match(css,/padding:max\(44px,env\(safe-area-inset-top,0px\)\)/);
 assert.match(css,/max\(24px,env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 const dashboard=read('dashboard.html');
 assert.equal((dashboard.match(/pbb-quiz-theme.css\?v=1-balance-gold/g)||[]).length,1);
 assert.equal((dashboard.match(/learning-inline.js\?v=55-balance-quiz-gold/g)||[]).length,2);
 assert.match(read('sw.js'),/pbb-quiz-theme.css\?v=1-balance-gold/);
});
