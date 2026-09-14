const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('bio.html','utf8');
test('homepage uses the website menu and puts its control before the logo',()=>{
 const header=html.match(/<header class="bio-masthead">([\s\S]*?)<\/header>/)[1];
 assert.ok(header.indexOf('class="balance-menu-toggle"')<header.indexOf('class="identity"'));
});
test('photo hub retains destinations and uses all five new photos without a footer band',()=>{
 for(const href of ['/founders','/balance.html','/coaching.html','/journey.html','/clients.html','/book'])assert.ok(html.includes('href="'+href+'"'));
 assert.match(html,/photo-learn[\s\S]*?photos\/bio\/shannon-panel-1.jpg/);
 for(const m of html.matchAll(/<img src="\/([^"]+)"/g))assert.ok(fs.existsSync(m[1]),m[1]);
 assert.equal((html.match(/class="photo-link /g)||[]).length,5);
 for(let i=1;i<=5;i++)assert.ok(html.includes('shannon-panel-'+i+'.jpg'));
 assert.ok(!html.includes('<footer>'));assert.match(html,/<dialog id="balance-menu"/);
});
test('first-touch attribution and measured link navigation work without intercepting links',()=>{
 const store=new Map([['balance_first_touch','{"utm_source":"original"}']]);let clicked;const events=[];
 const link={href:'https://example.com/founders',dataset:{bioLink:'learn'},addEventListener:(e,f)=>clicked=f};

 const scope={URL,URLSearchParams,location:{hostname:'example.com',search:'?utm_source=instagram&fbclid=test-click'},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{querySelectorAll:()=>[link]},window:{addEventListener(){},BalanceOnboardingFunnel:{track:(...args)=>events.push(args)}}};
 vm.runInNewContext(fs.readFileSync('bio-photo.js','utf8'),scope);
 assert.equal(new URL(link.href).searchParams.get('fbclid'),'test-click');
 assert.equal(JSON.parse(store.get('balance_first_touch')).utm_source,'original');
 clicked();assert.equal(events[1][1],'bio_learn');assert.equal(events[1][3].mode,'bio_photo_v1');
 assert.ok(!html.includes('bio-theme'));
 assert.ok(!store.has('userThemePreference'));
});
