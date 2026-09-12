const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPaidMetaTailoredOfferChunks,
    selectFastDeterministicPaidMetaProgression,
    collectPaidMetaWriterContractIssues,
    isBlockingPaidMetaWriterContractIssue,
    buildPaidMetaGuaranteedContractFallback,
    personalisePaidMetaOffer,
    isPaidMetaBareGoalMessage,
    getAutoDmHoldReason,
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
test('grocery bridge explains practical fit and keeps media, price and decision',async()=>{
 const currentMessage='Food shopping on a tight grocery budget makes meal planning hard';
 const chunks=buildPaidMetaTailoredOfferChunks(currentMessage,'Lose weight','broad_pain');
 // Writer repairs can omit flowVariant or coalesce all paragraphs into one
 // chunk; the actual support choice identifies the approved full-flow offer.
 const draft={chunks:[chunks.join('\n\n')],joined:chunks.join('\n\n'),replyMode:'campaign_sales_progression',model:'test',videoAttachmentUrl:'course.mp4'};
 const result=await personalisePaidMetaOffer({draft,currentMessage,writer:async contents=>{
  assert.match(contents[0].parts[0].text,/NOT a paraphrase exercise/);
  return JSON.stringify({acknowledgement:'We can keep your meal plan based on ordinary supermarket ingredients and simple repeatable meals. The food side of Learn helps you build habits around that.',evidence:['tight grocery budget']});
 }});
 assert.ok(!result.error);assert.match(result.chunks[0],/ordinary supermarket ingredients/);
 assert.doesNotMatch(result.joined,/neuroscience and psychology|budget makes meal planning hard/);
 assert.match(result.joined,/six weeks.*workout program.*meal plan.*weekly training and food check-in/);
 assert.equal(result.chunks.at(-1),chunks.at(-1));assert.equal(result.videoAttachmentUrl,draft.videoAttachmentUrl);
});
for (const scenario of cases) {
    test(`the offer backup stays grounded: ${scenario.text}`, () => {
        const chunks = buildPaidMetaTailoredOfferChunks(scenario.text, 'Lose fat and build muscle', 'broad_pain');
        const joined = chunks.join('\n\n');
        for (const pattern of scenario.needs) assert.match(joined, pattern);
        for (const pattern of scenario.absent) assert.doesNotMatch(joined, pattern);
        const scaffold = {
            model: 'deterministic_paid_meta_guided_sales_v1', replyMode: 'campaign_sales_progression', flowVariant: 'broad_pain', chunks, joined,
        };
        assert.equal(selectFastDeterministicPaidMetaProgression({draft:scaffold}), scaffold);
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

test('final personal acknowledgement sees the full batch and preserves the offer, proof, video and CTA', async () => {
    const chunks = buildPaidMetaTailoredOfferChunks('Chocolate','Lose weight','broad_pain');
    chunks.unshift('This is Ally. She lost 12kg in 16 weeks.');
    const draft = {chunks,joined:chunks.join('\n'),replyMode:'campaign_sales_progression',model:'deterministic_paid_meta_guided_sales_v1',flowVariant:'broad_pain',videoAttachmentUrl:'course.mp4',imageAttachmentUrl:'ally.jpg'};
    const result = await personalisePaidMetaOffer({draft,currentMessage:'Chocolate',history:[{direction:'out',text:'What gets in the way?'},{direction:'in',text:'I guess kids'},{direction:'in',text:'Chocolate'}],writer:async contents=>{
        const prompt = contents[0].parts[0].text;
        assert.match(prompt,/CURRENT INBOUND BATCH[^]*I guess kids Chocolate/);
        return JSON.stringify({acknowledgement:'Sounds like the kids and chocolate might be the bits to work around.',evidence:['"I guess kids",','“Chocolate”']});
    }});
    assert.notEqual(result,draft);
    assert.equal(result.chunks[0],draft.chunks[0]);
    assert.match(result.chunks[1],/^Sounds like the kids and chocolate might/);
    assert.doesNotMatch(result.chunks[1],/neuroscience and psychology/);
    assert.match(result.chunks[2],/six weeks.*workout program.*meal plan.*weekly training and food check-in/);
    assert.match(result.chunks[2],/\$149.*no subscription or auto-renewal.*Here's the course video/);
    assert.equal(result.chunks.at(-1),draft.chunks.at(-1));
    assert.equal(result.videoAttachmentUrl,draft.videoAttachmentUrl);
    assert.equal(result.imageAttachmentUrl,draft.imageAttachmentUrl);
});

test('invalid personalisation or a failed writer holds the offer privately', async () => {
    const chunks=buildPaidMetaTailoredOfferChunks('Chocolate','Lose weight','broad_pain');
    const draft={chunks,joined:chunks.join('\n'),replyMode:'campaign_sales_progression',model:'test',flowVariant:'broad_pain'};
    for (const payload of [
        {acknowledgement:'Weekends and cravings are your problem.',evidence:['Chocolate']},
        {acknowledgement:'Kids make it hard.',evidence:['Kids']},
        {acknowledgement:'Chocolate is the issue?',evidence:['Chocolate']},
        {acknowledgement:'x'.repeat(361),evidence:['Chocolate']},
    ]) assert.ok((await personalisePaidMetaOffer({draft,currentMessage:'Chocolate',writer:async()=>JSON.stringify(payload)})).error);
    assert.ok((await personalisePaidMetaOffer({draft,currentMessage:'Chocolate',writer:async()=>{throw Error('offline');}})).error);
});

test('multiple quoted excerpts in one evidence item remain individually grounded', async () => {
    const currentMessage = "Actually the kids aren't the problem. It's buying chocolate at the petrol station.";
    const chunks = buildPaidMetaTailoredOfferChunks(currentMessage,'Lose weight','broad_pain');
    const draft = {chunks,joined:chunks.join('\n'),replyMode:'campaign_sales_progression',model:'test',flowVariant:'broad_pain'};
    const writer = async () => JSON.stringify({acknowledgement:'Got it, it is the petrol station chocolate that is the issue.',evidence:['"Actually the kids aren\'t the problem.","It\'s buying chocolate at the petrol station."']});
    const result = await personalisePaidMetaOffer({draft,currentMessage,writer});
    assert.match(result.model,/personal-ack/);
    assert.match(result.joined,/^Got it, it is the petrol station chocolate/);
    const invalid = await personalisePaidMetaOffer({draft,currentMessage,writer:async()=>JSON.stringify({acknowledgement:'Chocolate is the issue.',evidence:['"Chocolate","invented detail"']})});
    assert.ok(invalid.error);
});

test('a corrected blocker does not force the writer to repeat the superseded detail', () => {
    const currentMessage = "Actually the kids aren't the problem. It's buying chocolate at the petrol station.";
    const draft = {joined:"It's the petrol-station chocolate habit you want to change. Balance Learn is a six-week course with your workout program, meal plan and weekly check-in. It's one AUD $149 payment, no auto-renewal. Want a free personalised preview before you pay?"};
    const issues = collectPaidMetaWriterContractIssues({draft,currentMessage,flowVariant:'broad_pain',history:[{direction:'in',text:'Kids and chocolate, mostly.'}]});
    assert.ok(!issues.some(issue=>/grounded acknowledgement of kids/.test(issue)));
});

test('unfamiliar personal context and direct questions cannot become a generic blocker question', () => {
    const currentMessage='I want more energy. I look after my dad and some days have to cancel everything. I can manage ten minutes at home. Is that pointless?';
    const shortcut={model:'deterministic_paid_meta_guided_sales_v1',flowVariant:'broad_pain',replyMode:'campaign_sales_progression',joined:'More energy is a solid goal. What usually gets in the way of making that happen consistently?'};
    assert.equal(isPaidMetaBareGoalMessage('I want to lose weight'),true);
    for (const message of [currentMessage,'I want to build strength because I carry my mum upstairs.','I want more energy for rehearsals.','I want strength, not weight loss.']) {
        assert.equal(isPaidMetaBareGoalMessage(message),false);
        assert.equal(selectFastDeterministicPaidMetaProgression({draft:shortcut,currentMessage:message}),null);
    }
    const issues=collectPaidMetaWriterContractIssues({currentMessage,flowVariant:'broad_pain',draft:{joined:"Ten minutes isn't pointless. Short home sessions can fit around caring for your dad, including days when plans change."}});
    assert.ok(!issues.some(issue=>/answered the goal question/.test(issue)),'do not force a blocker question after the writer answers their actual question');
});

test('an indirect blocker request without a question mark cannot ignore a substantive answer', () => {
    const currentMessage="I want to lose weight and feel confident. I read so much conflicting advice I end up doing nothing. I'm not scared of the gym. I just don't know which advice to trust.";
    const draft={joined:'The main thing I would want to understand next is what is getting in the way in real life, like time, stress, food decisions, or conflicting advice.'};
    const issues=collectPaidMetaWriterContractIssues({draft,currentMessage,flowVariant:'broad_pain'});
    assert.ok(issues.some(issue=>/generic blocker again/.test(issue) && isBlockingPaidMetaWriterContractIssue(issue)));
    const legitimate=collectPaidMetaWriterContractIssues({draft:{joined:'What usually gets in the way of making that happen consistently?'},currentMessage:'I want to lose weight',flowVariant:'broad_pain'});
    assert.ok(!legitimate.some(issue=>/generic blocker again/.test(issue)));
});

test('uncertainty does not erase an already supplied fitness goal', () => {
    const currentMessage="I want to get fit again. Honestly not sure what stops me. I've done it before but I can't put my finger on it.";
    const draft={joined:"That makes sense, you've done it before. For the next six weeks, what would you most want to change: fitness, body shape, energy, or consistency?"};
    const issues=collectPaidMetaWriterContractIssues({draft,currentMessage,flowVariant:'broad_pain'});
    assert.ok(issues.some(issue=>/goal again/.test(issue) && isBlockingPaidMetaWriterContractIssue(issue)));
    const repaired=buildPaidMetaGuaranteedContractFallback({draft,currentMessage,flowVariant:'broad_pain',issues});
    assert.match(repaired.joined,/Balance Learn/);
    assert.doesNotMatch(repaired.joined,/what would you most want to change/i);
});

test('a reviewed paid-ad preview invitation cannot be stranded by organic pitch timing', () => {
    const args={
        currentMessage:"I want more strength and energy. I'm not trying to lose weight. I can train twice a week but tracking every calorie puts me off.",
        draft:{model:'openai-gpt-5.4-mini-paid-meta',joined:'That fits Balance Learn nicely - strength and energy without pushing weight loss, and you wouldn’t need to track every calorie.\nI can set the meal plan to your preferences and build the workouts around two training sessions a week. If you want, I can show you a free personalised app preview first so you can see exactly how it would look for you.'},
        draftReview:{verdict:'pass',confidence:1,issues:[],notification_required:false,context_loss_suspected:false},qualifier:{facts:{}},leadStage:'qualifying',linkedUserId:null,meaningfulLeadReplyCount:2,
        alertData:{meta_ad_conversation_fast_lane:true,offer_flow_variant:'broad_pain'},
    };
    assert.equal(getAutoDmHoldReason(args),null);
    assert.equal(getAutoDmHoldReason({...args,alertData:{},currentMessage:'I can train twice a week but tracking every calorie puts me off.'})?.code,'premature_challenge_invite');
    assert.equal(getAutoDmHoldReason({...args,contextReview:{required:true}})?.code,'context_review');
    assert.ok(getAutoDmHoldReason({...args,draftReview:{verdict:'warn',issues:['unverified claim']}}));
});
