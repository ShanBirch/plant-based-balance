import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../learn-course-pricing-ui.js',import.meta.url),'utf8').replace(/^import [^\r\n]+\r?\n/,'').replace('updateLearnPrice();','globalThis.priceUpdated = updateLearnPrice();');
test('public Learn offer shows the server-approved price and October launch deadline',async()=>{
    for(const amount of [14900,45000]){
        const price={textContent:''},card={innerHTML:''};
        const context={getLearnCoursePricing:()=>({unitAmount:14900}), fetch:async()=>({ok:true,json:async()=>({offer:{unitAmount:amount}})}),
            document:{querySelectorAll:selector=>selector==='[data-learn-upfront]'?[price]:[card],addEventListener(){}}, window:{addEventListener(){}}};
        vm.runInNewContext(source,context);
        await context.priceUpdated;
        assert.equal(price.textContent,`$${amount/100}`);
        if(amount===14900){assert.match(card.innerHTML,/AUD \$149/);assert.match(card.innerHTML,/21 October 2026/);}
        else {assert.match(card.innerHTML,/package: AUD \$450/);assert.doesNotMatch(card.innerHTML,/\$149/);}
    }
});

test('hero offer shows crossed-out standard price only during the introductory period', async () => {
    for (const amount of [14900, 45000]) {
        const hero = { dataset: { learnPresentation: 'hero' }, innerHTML: '' };
        const context = { getLearnCoursePricing: () => ({ unitAmount: amount }), fetch: async () => ({ ok: true, json: async () => ({ offer: { unitAmount: amount } }) }),
            document: { querySelectorAll: selector => selector === '.learn-intro-price' ? [hero] : [], addEventListener() {} }, window: { addEventListener() {} } };
        vm.runInNewContext(source, context);
        await context.priceUpdated;
        if (amount === 14900) {
            assert.match(hero.innerHTML, /<s[^>]+>\$450<\/s>/);
            assert.match(hero.innerHTML, /\$149/);
            assert.match(hero.innerHTML, /Introductory Offer/);
            assert.match(hero.innerHTML, /Offer lasts until October 20th/);
        } else {
            assert.match(hero.innerHTML, /\$450/);
            assert.doesNotMatch(hero.innerHTML, /<s\s|\$149|introductory offer|October 20th/);
        }
    }
});
