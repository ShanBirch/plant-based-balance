const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveChallengeLeadRoute, buildChallengeLeadPrompt, collectChallengeLeadIssues, buildChallengeBookingHandoff, CHALLENGE_BOOKING_URL } = require('../netlify/functions/_lib/plant-based-challenge-dm');
const fresh = { created_at:'2026-09-27T00:00:00Z', custom_data:{bot_account:'shan_n_sunny'} };

test('new Balance leads use consultation; explicit returning challenge enquiries reuse that route', () => {
    assert.equal(resolveChallengeLeadRoute({thread:fresh,currentMessage:'How does your coaching work?'}),true);
    assert.equal(resolveChallengeLeadRoute({thread:{...fresh,created_at:'2026-08-01'},currentMessage:'I want the eight-week plant-based challenge'}),true);
    assert.equal(resolveChallengeLeadRoute({thread:fresh,history:[{direction:'in',text:'Tell me about the eight-week plant-based challenge'}],currentMessage:'I already told you I want to get stronger'}),true);
});
test('clients, purchases, other brands, legacy campaigns and explicit old-product enquiries keep their routes', () => {
    for (const thread of [
        {...fresh,linked_user_id:'client'},
        {...fresh,custom_data:{...fresh.custom_data,customer_lifecycle:{purchase_id:'purchase',status:'purchased'}}},
        {...fresh,custom_data:{bot_account:'little_companion'}},
        {...fresh,custom_data:{bot_account:'cocos_pt_studio'}},
        {...fresh,custom_data:{}},
        {...fresh,created_at:'2026-08-01'},
        {...fresh,custom_data:{...fresh.custom_data,meta_ad_attribution:{ad_id:'1234567890'}}},
    ]) assert.equal(resolveChallengeLeadRoute({thread,currentMessage:'How does Balance work?'}),false);
    for (const currentMessage of ['How much is the six-week Balance Learn course?', 'Send me the Founders Pass link', 'Can I see the Learn preview?']) {
        assert.equal(resolveChallengeLeadRoute({thread:fresh,currentMessage}),false);
    }
    assert.equal(resolveChallengeLeadRoute({thread:fresh,history:[{direction:'out',text:'Want to see your free personalised app preview?'}],currentMessage:'Yes please'}),false);
});
test('a question about education within the challenge stays on challenge without hiding course facts', () => {
    assert.equal(resolveChallengeLeadRoute({thread:fresh,history:[{direction:'in',text:'I want the eight-week plant-based challenge'}],currentMessage:'What does Balance Learn cover in the challenge?'}),true);
});
test('writer keeps known context, thoughtful tone, truthful pricing, safety and direct consultation instructions', () => {
    const prompt = buildChallengeLeadPrompt({timeline:'Lead: I want strength around night shifts.',unansweredMessages:['How would that work?'],context:'KNOWN GOAL: strength; vegetarian',productKnowledge:'Learn is six weeks. AUD $149.',hasMedia:true});
    for (const evidence of [/night shifts/,/KNOWN GOAL/,/vegetarian/,/eight-week/,/training/i,/meal plans/i,/Balance Learn/,/accountability/,/community/,/60.minute/,/125/,/30.minute/,/only.*ask.*price/i,/do not.*repeat.*question/i,/manual|human/i,/media_summary/,/six weeks/]) assert.match(prompt,evidence);
    assert.ok(prompt.includes(CHALLENGE_BOOKING_URL));
});
test('challenge contract blocks preview detours, unsolicited prices, course dumps and unsupported promises', () => {
    for (const joined of [
        'Want a free personalised app preview before paying?',
        'It is $125/week for everyone. Want to book?',
        'Week 1: Why change feels hard. Week 2: Work with your energy.',
        'You get a weekly 30-minute live training session included.',
        'You are booked in for tomorrow.',
    ]) assert.ok(collectChallengeLeadIssues({draft:{joined},currentMessage:'I want to build strength'}).length,joined);
    assert.deepEqual(collectChallengeLeadIssues({draft:{joined:'The optional AUD $125/week package includes one weekly 30-minute live 1:1 training session. We can work out the right support on the consultation.'},currentMessage:'What does the $125 package include?'}),[]);
    assert.deepEqual(collectChallengeLeadIssues({draft:{joined:'Balance Learn is six weeks. It covers practical behaviour change alongside the training and nutrition support.'},currentMessage:'What is Balance Learn?'}),[]);
});
test('a goal earns a brief relevant offer and the existing card; rejection and already sent cards are not resent', () => {
    const joined = `We can build training and meal plans around your shifts, with education through Balance Learn and accountability. You can pick a consultation time here: ${CHALLENGE_BOOKING_URL}`;
    const input = {draft:{joined},currentMessage:'I want to get stronger around my night shifts',history:[],linkedUserId:null};
    assert.equal(buildChallengeBookingHandoff(input).approved_link_auto_sendable,true);
    for (const currentMessage of ['No thanks', 'Stop messaging me', 'Not now, I need to think', 'Are you trying to sell me something?']) {
        assert.equal(buildChallengeBookingHandoff({...input,currentMessage}),null);
        assert.ok(collectChallengeLeadIssues({...input,currentMessage}).length);
    }
    assert.equal(buildChallengeBookingHandoff({...input,linkedUserId:'client'}),null);
    assert.equal(buildChallengeBookingHandoff({...input,history:[{direction:'out',text:joined}],currentMessage:'Thanks'}),null);
    assert.equal(buildChallengeBookingHandoff({...input,history:[{direction:'out',text:joined}],currentMessage:'Can you resend the booking link?'}).approved_link_auto_sendable,true);
});

test('the verified Balance Facebook Page shares content policy without adopting other Pages', () => {
    const thread = {...fresh,channel:'messenger',subscriber_id:'fb_graph:561122130919678:123',custom_data:{facebook_messenger:{page_id:'561122130919678',psid:'123'}}};
    assert.equal(resolveChallengeLeadRoute({thread,currentMessage:'I want to get fitter'}),true);
    assert.equal(resolveChallengeLeadRoute({thread:{...thread,custom_data:{facebook_messenger:{page_id:'999',psid:'123'}}},currentMessage:'I want the plant-based challenge'}),false);
    assert.equal(resolveChallengeLeadRoute({thread:{...fresh,custom_data:{...fresh.custom_data,learn_keyword_flow:{keyword:'balance'}}},currentMessage:'How does it work?'}),false);
});

test('the content update retains the established paid writer prompt verbatim', () => {
    const writer = require('../netlify/functions/ig-instant-draft')._test;
    const basePrompt = writer.buildPaidMetaAgentPrompt({flowVariant:'broad_pain',timeline:'Lead: Vegetarian, strength, night shifts.',unansweredMessages:['Can you help?']});
    const updated = buildChallengeLeadPrompt({basePrompt});
    assert.equal(updated.slice(0,basePrompt.length),basePrompt);
    assert.ok(updated.indexOf('SCOPED OFFER CONTENT UPDATE') > basePrompt.length);
    assert.equal(writer.buildDeterministicPaidMetaConversationReply({flowVariant:'plant_based_challenge',currentMessage:'How does it work?'}),null);
    const chunks = writer.finalizeDraftChunksFromRawText(JSON.stringify({messages:[`Pick a consultation time here: ${CHALLENGE_BOOKING_URL}`]}),{challengeLead:true,currentMessageText:'Send the link',qualifier:{stage:'won'},leadStage:'qualifying',checkoutUrl:'https://plantbased-balance.org/founders'});
    assert.ok(chunks.join(' ').includes(CHALLENGE_BOOKING_URL));
    assert.doesNotMatch(chunks.join(' '),/\/founders/);
});

test('the established rich card retains its artwork, destination and text/card order on both Graph transports', () => {
    const sender = require('../netlify/functions/send-ig-reply')._test;
    const old = sender.resolveApprovedInstagramLinkButton('Book here: https://plantbased-balance.org/book');
    const items = sender.buildInstagramGraphOutboundItems([`We can talk through the support that fits you. Pick a time here: ${CHALLENGE_BOOKING_URL}`],true);
    assert.deepEqual(items.map(item=>item.kind),['text','link_button']);
    assert.equal(items[1].imageUrl,old.imageUrl);
    assert.equal(items[1].url,CHALLENGE_BOOKING_URL);
    const payload = sender.buildInstagramGraphButtonMessagePayload({recipientId:'fixture',...items[1],text:''});
    assert.equal(payload.message.attachment.payload.template_type,'generic');
    assert.equal(payload.message.attachment.payload.elements[0].buttons[0].url,CHALLENGE_BOOKING_URL);
    const manager = require('../netlify/functions/client-lead-manager')._test;
    assert.equal(manager.approvedLinkHandoffKind({suggested_message:items[0].text+' '+CHALLENGE_BOOKING_URL,data:buildChallengeBookingHandoff({draft:{joined:CHALLENGE_BOOKING_URL},currentMessage:'Can I book a consultation?'})}),'call_booking');
});

test('consultation content approval never overrides safety, context, media or reviewer holds', () => {
    const writer = require('../netlify/functions/ig-instant-draft')._test;
    const common = {draft:{joined:`I can help with that strength goal through training and meal plans. Pick a consultation time here: ${CHALLENGE_BOOKING_URL}`,model:'vertex-v7'},currentMessage:'I want to build strength',qualifier:{facts:{motivation:'build strength'}},linkedUserId:null,leadStage:'qualifying',meaningfulLeadReplyCount:1,alertData:{challenge_policy_version:'plant_based_challenge_consult_v1'},challengeOfferWarning:{required:false,code:'approved_challenge_consultation'},mediaReview:{required:false},contextReview:{required:false},draftReview:{verdict:'pass',confidence:1,issues:[],context_loss_suspected:false}};
    assert.equal(writer.getAutoDmHoldReason(common),null);
    for (const override of [{mediaReview:{required:true}},{contextReview:{required:true}},{draftReview:{verdict:'warn',issues:['Missing context']}},{draft:{...common.draft,error:'model failed'}}]) assert.ok(writer.getAutoDmHoldReason({...common,...override}));
});

test('actual draft assembly preserves learned voice, full context and the same model calls', async () => {
    const contextPath = require.resolve('../netlify/functions/_lib/client-context');
    const draftPath = require.resolve('../netlify/functions/ig-instant-draft');
    const saved = require.cache[contextPath].exports;
    const requests=[];
    const generate = async (contents, config, options) => {
        requests.push({prompt:contents.flatMap(c=>c.parts||[]).map(p=>p.text||'').join('\n'),config,options});
        return JSON.stringify({messages:['That sounds doable around your night shifts.']});
    };
    require.cache[contextPath].exports={...saved,loadEditExamples:async()=> 'LEARNED VOICE FIXTURE: keep my individual conversational edit.',callVertexAIModel:generate,callOpenAITextModel:generate};
    delete require.cache[draftPath];
    try {
        const {generateDraft} = require(draftPath)._test;
        const input={leadName:'Fixture',leadBlock:'Lead context fixture',profileBlock:'Profile fixture: vegetarian',memoryBlock:'Memory fixture: strength goal, night shifts',history:[{direction:'in',text:'I already told you about my night shifts.',created_at:new Date(Date.now()-60000).toISOString()}],currentMessage:'Can the training fit my week?',recentInboundMessages:[{text:'And do I need to be vegan?'}],leadStage:'qualifying',channel:'instagram',igThreadId:null,linkedUserId:null,priorScheduledDrafts:[],linkedNudges:[],qualifier:{facts:{motivation:'strength'}},botAccount:'shan_n_sunny',acquisitionMode:'organic_inbound'};
        await generateDraft({...input,adFlowVariant:'plant_based_control'});
        await generateDraft({...input,adFlowVariant:'plant_based_challenge'});
        assert.equal(requests.length,2);
        assert.deepEqual(requests[1].config,requests[0].config);
        assert.deepEqual(requests[1].options,requests[0].options);
        for (const text of ['LEARNED VOICE FIXTURE','Profile fixture: vegetarian','Memory fixture: strength goal, night shifts','I already told you about my night shifts.','And do I need to be vegan?','CONVERSATION RESPONSIBILITY','GROUNDING AND TIMELINE RULES']) {
            assert.ok(requests[0].prompt.includes(text),text);
            assert.ok(requests[1].prompt.includes(text),text);
        }
        assert.ok(requests[1].prompt.includes(CHALLENGE_BOOKING_URL));
    } finally {
        require.cache[contextPath].exports=saved;
        delete require.cache[draftPath];
    }
});

// Existing text cleanup can capitalize a URL at a sentence boundary. A malformed
// or non-exact destination must be held instead of silently losing the rich card.
test('challenge content guard catches capitalized and misspelled destinations', () => {
    for (const url of ['Https://plantbased-balance.org/book?source=plant_based_challenge','Https://plant-based-balance.org/book?source=plant_based_challenge']) {
        assert.ok(collectChallengeLeadIssues({draft:{joined:url},currentMessage:'Send the consultation link'}).length);
    }
});
