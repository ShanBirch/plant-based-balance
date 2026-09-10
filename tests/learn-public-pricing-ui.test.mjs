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
