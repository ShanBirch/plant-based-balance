const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('css/dashboard/pbb-weighin-theme.css');
test('weigh-in has paired cream/obsidian, readable ink, and gold actions',()=>{
 assert.match(css,/--wi-surface:#f8f7f2/);
 assert.match(css,/html:not\(\[data-pbb-theme="light"\]\)[\s\S]*--wi-surface:#191919/);
 assert.match(css,/button\[onclick="submitWeighInModal\(\)"\][\s\S]*linear-gradient[\s\S]*-webkit-text-fill-color:#292313/);
 for(const state of ['input::placeholder','input:focus','button:focus-visible','button:disabled','#bf-result-row','#weigh-in-modal-success-section'])assert.ok(css.includes(state),state);
});
test('small-phone modal has zero-inset fallback and reachable internal scrolling',()=>{
 assert.match(css,/max\(44px,env\(safe-area-inset-top,0px\)\)/);
 assert.match(css,/max\(24px,env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/max-height:100%!important/);
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/overscroll-behavior:contain/);
 assert.match(css,/font-size:16px!important/);
});
test('theme ships after legacy overrides and is in the versioned app cache',()=>{
 const html=read('dashboard.html'),sw=read('sw.js');
 assert.ok(html.indexOf('pbb-weighin-theme.css')>html.indexOf('pbb-premium-overlays.css'));
 assert.match(sw,/pbb-weighin-theme.css\?v=1-balance-gold/);
 assert.match(html,/class="weighin-header"/);
 assert.match(html,/for="weigh-in-modal-input"/);
});
test('both theme text and control boundaries meet contrast targets',()=>{
 const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb.reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0)};
 const ratio=(a,b)=>{const l=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (l[0]+.05)/(l[1]+.05)};
 for(const [fg,bg,min] of [['686052','f8f7f2',4.5],['c6bfae','191919',4.5],['292313','d8b25e',4.5],['80601f','f4e9cf',4.5],['96866a','fffdf7',3],['9b8963','252525',3]])assert.ok(ratio(fg,bg)>=min,`${fg}/${bg}: ${ratio(fg,bg)}`);
});
