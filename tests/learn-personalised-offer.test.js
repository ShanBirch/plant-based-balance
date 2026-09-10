const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPaidMetaTailoredOfferChunks,
    selectFastDeterministicPaidMetaProgression,
    collectPaidMetaWriterContractIssues,
    isBlockingPaidMetaWriterContractIssue,
    buildPaidMetaGuaranteedContractFallback,
} = require('../netlify/functions/ig-instant-draft')._test;

const cases = [
    {text: "Mhmm I dunno I've lost weight before\nBut I just don't know\nI guess kids\nChocolate", needs: [/kids/i, /chocolate/i], absent: [/weekends?/i, /cravings?/i, /emotional eating/i]},
    {text: 'Chocolate', needs: [/chocolate/i], absent: [/kids/i, /weekends?/i, /cravings?/i]},
    {text: 'The kids', needs: [/kids/i], absent: [/time pressure/i, /chocolate/i, /weekends?/i]},
    {text: 'Cravings', needs: [/cravings/i], absent: [/weekends?/i, /chocolate/i, /kids/i]},
    {text: 'Weekends', needs: [/weekends/i], absent: [/cravings/i, /chocolate/i]},
    {text: 'My schedule is exactly the same every week', needs: [/schedule/i], absent: [/changing/i, /roster/i]},
    {text: 'Food costs too much', needs: [/food/i], absent: [/prep/i, /busy/i]},
    {text: 'Workouts bore me', needs: [/workout/i], absent: [/not knowing/i, /anxiety/i]},
    {text: 'Can three days a week work?', needs: [/three days/i], absent: [/overwhelm/i]},
    {text: 'Not weekends or cravings. It is chocolate after school pickup.', needs: [], absent: [/cravings and weekends/i, /account for.*weekends/i]},
];
for (const scenario of cases) {
    test(`personal circumstances reach the writer; backup stays grounded: ${scenario.text}`, () => {
        const chunks = buildPaidMetaTailoredOfferChunks(scenario.text, 'Lose fat and build muscle', 'broad_pain');
        const joined = chunks.join('\n\n');
        for (const pattern of scenario.needs) assert.match(joined, pattern);
        for (const pattern of scenario.absent) assert.doesNotMatch(joined, pattern);
        assert.equal(selectFastDeterministicPaidMetaProgression({draft: {
            model: 'deterministic_paid_meta_guided_sales_v1', replyMode: 'campaign_sales_progression', flowVariant: 'broad_pain', chunks, joined,
        }}), null, 'the writer must interpret arbitrary personal answers before a fallback is used');
    });
}

test('the screenshot reply fails grounding and repairs the entire rapid inbound batch', () => {
    const history = [
        {direction:'in',text:'I want to lose weight'},
        {direction:'out',text:'What usually gets in the way of making that happen consistently?'},
        {direction:'in',text:"Mhmm I dunno I've lost weight before"},
        {direction:'in',text:"But I just don't know"},
        {direction:'in',text:'I guess kids'},
        {direction:'in',text:'Chocolate'},
    ];
    const draft = {joined:"If cravings and weekends are where it slips, the food plan needs to fit real life. Balance Learn is a six-week course. It's one AUD $149 payment.",chunks:[]};
    const args = {draft, currentMessage:'Chocolate', history, qualifier:{facts:{current_state:'I want to lose weight'}},flowVariant:'broad_pain'};
    const issues = collectPaidMetaWriterContractIssues(args);
    for (const detail of ['kids','chocolate','weekends','cravings']) assert.ok(issues.some(issue=>issue.includes(detail) && isBlockingPaidMetaWriterContractIssue(issue)));
    const repaired = buildPaidMetaGuaranteedContractFallback({...args,issues});
    assert.match(repaired.joined,/kids/i);
    assert.match(repaired.joined,/chocolate/i);
    assert.doesNotMatch(repaired.joined,/weekends?|cravings?|emotional eating/i);
});

test('a corrected blocker does not force the writer to repeat the superseded detail', () => {
    const currentMessage = "Actually the kids aren't the problem. It's buying chocolate at the petrol station.";
    const draft = {joined:"It's the petrol-station chocolate habit you want to change. Balance Learn is a six-week course with your workout program, meal plan and weekly check-in. It's one AUD $149 payment, no auto-renewal. Want a free personalised preview before you pay?"};
    const issues = collectPaidMetaWriterContractIssues({draft,currentMessage,flowVariant:'broad_pain',history:[{direction:'in',text:'Kids and chocolate, mostly.'}]});
    assert.ok(!issues.some(issue=>/grounded acknowledgement of kids/.test(issue)));
});
