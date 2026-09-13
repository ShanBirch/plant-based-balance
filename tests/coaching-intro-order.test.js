const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('offer heading leads directly to four-part journey without photo card',()=>{
 const html=fs.readFileSync('coaching.html','utf8');
 const intro=html.slice(html.indexOf('<main>'),html.indexOf('id="four-part-journey"'));
 assert.ok(intro.includes('<h1>What I Offer.</h1>'));
 assert.ok(intro.includes('hero hero-solo'));
 assert.ok(!intro.includes('<aside'));assert.ok(!intro.includes('Best first move'));
 assert.ok(!intro.includes('what-i-offer-portrait.jpg'));
 assert.ok(html.includes('Learn. Master. Become. Lead.'));
});
