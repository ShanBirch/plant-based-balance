const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../plant-based-fitness.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('var paidMetaSources'));
for (const device of ['Desktop', 'iPhone', 'Android']) {
    test('website Learn preview handoff: ' + device, () => {
        const nodes = new Map();
        const node = id => { if (!nodes.has(id)) nodes.set(id, {style:{},dataset:{},addEventListener(){},setAttribute(){}}); return nodes.get(id); };
        const window = {location:{search:'',pathname:'/founders',hash:''},localStorage:{getItem(){return null;}},BalanceIOSMetaPreviewHandoff:require('../lib/ios-meta-preview-handoff.js'),matchMedia:()=>({matches:true})};
        const document = {getElementById:node,querySelector:node,querySelectorAll:()=>[],body:{classList:{add(){}},dataset:{}}};
        vm.runInNewContext(script,{window,document,navigator:{userAgent:device},URLSearchParams});
        const hero = node('foundations-hero-action').href;
        if(device==='Desktop') assert.match(hero,/^\/login.html\?action=signup&/);
        if(device==='Android') { const ref=new URL(hero).searchParams.get('referrer'); assert.match(ref,/learn_entry%3Dwebsite/); }
        if(device==='iPhone') { assert.match(hero,/apps.apple.com/); assert.match(node('paid-preview-open-installed').href,/learn_entry=website/); }
        assert.equal(node('#checkout-terms-container').style.display,undefined);
        assert.equal(node('checkout-terms-container').style.display,'none');
        assert.match(node('.secure-note').textContent,/Payment comes after the preview/);
    });
}
