const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('bio.html','utf8');
test('photo hub retains all six destinations and first photo is supplied Learn image',()=>{
 for(const href of ['/founders','/balance.html','/coaching.html','/journey.html','/clients.html','/book.html'])assert.ok(html.includes('href="'+href+'"'));
 assert.match(html,/photo-learn[\s\S]*?photos\/bio\/learn-shannon.jpg/);
 for(const m of html.matchAll(/<img src="\/([^"]+)"/g))assert.ok(fs.existsSync(m[1]),m[1]);
 assert.equal((html.match(/class="photo-link /g)||[]).length,4);
});
test('theme, first-touch attribution and measured link navigation work without intercepting links',()=>{
 const store=new Map([['balance_first_touch','{"utm_source":"original"}']]);let clicked,toggled;const events=[];
 const link={href:'https://example.com/founders',dataset:{bioLink:'learn'},addEventListener:(e,f)=>clicked=f};
 const button={setAttribute(){},addEventListener:(e,f)=>toggled=f};const root={dataset:{}};
 const scope={URL,URLSearchParams,location:{hostname:'example.com',search:'?utm_source=instagram&fbclid=test-click'},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{documentElement:root,getElementById:()=>button,querySelectorAll:()=>[link]},window:{BalanceOnboardingFunnel:{track:(...args)=>events.push(args)}}};
 vm.runInNewContext(fs.readFileSync('bio-photo.js','utf8'),scope);
 assert.equal(new URL(link.href).searchParams.get('fbclid'),'test-click');
 assert.equal(JSON.parse(store.get('balance_first_touch')).utm_source,'original');
 clicked();assert.equal(events[1][1],'bio_learn');assert.equal(events[1][3].mode,'bio_photo_v1');
 toggled();assert.equal(root.dataset.theme,'dark');toggled();assert.equal(root.dataset.theme,'light');
});
