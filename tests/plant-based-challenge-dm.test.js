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


test('challenge turn decisions preserve refusals, prior cards, FAQ answers and support', () => {
    const {resolveChallengeTurn, normalizeChallengeBookingUrls} = require('../netlify/functions/_lib/plant-based-challenge-dm');
    const history=[{direction:'in',text:'I want to build strength'},{direction:'in',text:'Not now, I need time to think'}];
    assert.equal(resolveChallengeTurn({history,currentMessage:'I trained yesterday'}).offering,false);
    assert.equal(resolveChallengeTurn({history,currentMessage:'I trained yesterday'}).paused,true);
    assert.equal(resolveChallengeTurn({history,currentMessage:'I am ready to book a consultation'}).offering,true);
    assert.equal(resolveChallengeTurn({history:history.slice(0,1),currentMessage:'How much does it cost?'}).offering,false);
    assert.equal(resolveChallengeTurn({history:history.slice(0,1),currentMessage:"I can't log in, can you help?"}).offering,false);
    assert.equal(resolveChallengeTurn({history:history.slice(0,1),currentMessage:'Want to video chat on Discord?'}).offering,false);
    assert.equal(resolveChallengeTurn({currentMessage:'Can you tell me about the eight-week plant-based challenge?'}).offering,false);
    assert.equal(resolveChallengeTurn({currentMessage:'I want to get stronger and need a plan'}).offering,true);
    assert.equal(normalizeChallengeBookingUrls(['Https://plant-based-balance.org/book?source=plant_based_challenge'])[0],CHALLENGE_BOOKING_URL);
});

test('challenge contract keeps common fact and conversational checks without old sales stages', () => {
    const {collectPaidMetaWriterContractIssues:check,buildPaidMetaAgentPrompt} = require('../netlify/functions/ig-instant-draft')._test;
    const base={flowVariant:'plant_based_challenge'};
    for (const [currentMessage,joined,pattern] of [
        ['Do videos have captions?','Yes, videos have captions.',/Unverified lesson captions/],
        ['Can you support gluten-free meals?','Sounds good.',/gluten-free question/],
        ['Are you trying to sell me something?','No, just chatting.',/sales question honestly/],
        ['How many lessons?','There are six lessons.',/Incorrect Learn lesson count/],
        ['I want to get stronger. Are you vegan?',`Training and meals can help. ${CHALLENGE_BOOKING_URL}`,/personal vegan question/],
    ]) assert.ok(check({...base,currentMessage,draft:{joined}}).some(v=>pattern.test(v)),currentMessage);
    assert.deepEqual(check({...base,currentMessage:'How much does the challenge cost?',draft:{joined:'The price depends on the support package.'}}),[]);
    const prompt=buildPaidMetaAgentPrompt({flowVariant:'plant_based_challenge'});
    assert.doesNotMatch(prompt,/LATEST FULL-FLOW REQUIREMENT|BROAD ROUTE GUARD|preview comes before payment|GUIDE THE SALE|ZOOM SUPPORT OPTION/);
    for (const text of ['Preserve negations, corrections and uncertainty','Answer yes/no questions directly','Never deny automation','media','fixed weekly LEARNING theme','45 lessons']) assert.ok(prompt.includes(text),text);
});


test('text closes lose sales tails but factual answers remain intact', () => {
    const {finalizeChallengeText,challengeHandoffMetadata,buildChallengeUnavailableFallback} = require('../netlify/functions/_lib/plant-based-challenge-dm');
    const input={currentMessage:'Not now, I need time to think.',history:[{direction:'in',text:'I want to get stronger'}]};
    assert.deepEqual(finalizeChallengeText(['No worries, take your time. When you are ready we can plan training.'],input),['No worries, take your time.']);
    assert.deepEqual(finalizeChallengeText(['No worries. If you want, tell me more about your goal.'],{...input,currentMessage:'Thanks!'}),['No worries.']);
    assert.deepEqual(finalizeChallengeText(['The package is optional.'],{currentMessage:'Is this a package?'}),['The package is optional.']);
    assert.equal(buildChallengeUnavailableFallback(input).error,null);
    assert.equal(buildChallengeUnavailableFallback({currentMessage:'What is the best treatment for knee pain?'}),null);
    const cleared=challengeHandoffMetadata();
    assert.equal(cleared.approved_link_auto_sendable,false);
    assert.equal(cleared.signup_link_handoff_url,null);
    for(const key of ['needs_you_required','permanent_manual','context_review','media_review']) assert.equal(Object.hasOwn(cleared,key),false);
});


test('actual writer finalization removes observed close regressions and preserves all-provider-failure recovery', async () => {
    const contextPath=require.resolve('../netlify/functions/_lib/client-context');
    const draftPath=require.resolve('../netlify/functions/ig-instant-draft');
    const saved=require.cache[contextPath].exports;
    const input={leadName:'Fixture',leadBlock:'Synthetic enquiry',profileBlock:'',memoryBlock:'',history:[],currentMessage:'Thanks!',recentInboundMessages:[],leadStage:'qualifying',channel:'instagram',igThreadId:null,linkedUserId:null,priorScheduledDrafts:[],linkedNudges:[],qualifier:{facts:{}},botAccount:'shan_n_sunny',acquisitionMode:'organic_inbound',adFlowVariant:'plant_based_challenge'};
    let fail=false;
    const model=async()=>{if(fail)throw new Error('Synthetic model failure');return JSON.stringify({messages:['No worries at all. If you want, tell me what you mean by stronger.']});};
    require.cache[contextPath].exports={...saved,loadEditExamples:async()=>'',callVertexAIModel:model,callOpenAITextModel:model,callGeminiFallback:model};
    delete require.cache[draftPath];
    try {
        const {generateDraft}=require(draftPath)._test;
        assert.equal((await generateDraft(input)).joined,'No worries at all.');
        fail=true;
        const fallback=await generateDraft({...input,acquisitionMode:'paid_meta',currentMessage:'Can I book a consultation?'});
        assert.equal(fallback.error,null);
        assert.equal(fallback.model,'deterministic_challenge_unavailable_v1');
        assert.ok(fallback.joined.includes(CHALLENGE_BOOKING_URL));
        assert.deepEqual(collectChallengeLeadIssues({draft:fallback,currentMessage:'Can I book a consultation?'}),[]);
    } finally {require.cache[contextPath].exports=saved;delete require.cache[draftPath];}
});

test('dormant worker inherits challenge content without changing the transport contract', async () => {
    const {buildLivePrompt}=await import('../scripts/ig-codex-live-worker.mjs');
    const prompt=buildLivePrompt({alert:{id:'fixture',data:{challenge_policy_version:'plant_based_challenge_consult_v1'}},action:{id:'fixture'},codexThreadId:'fixture'});
    assert.ok(prompt.includes(CHALLENGE_BOOKING_URL));
    assert.ok(prompt.includes('Revalidate the supplied codex_live_worker controller claim'));
    assert.ok(prompt.includes('replyTextUtf8Base64'));
    assert.doesNotMatch(prompt,/Exact signed app-preview URL|Exact approved Founders Pass checkout URL|newest inbound equivalent to/);
});


test('booking query parameters are not repeated conversational questions', () => {
    const check=require('../netlify/functions/ig-instant-draft')._test.collectPaidMetaWriterContractIssues;
    const input={flowVariant:'plant_based_challenge',currentMessage:'Can you resend the consultation booking link?',history:[{direction:'out',text:`Choose a time: ${CHALLENGE_BOOKING_URL}`}],draft:{joined:`Here it is again: ${CHALLENGE_BOOKING_URL}`}};
    assert.deepEqual(check(input),[]);
    assert.ok(check({...input,currentMessage:'Thanks'}).length);
});


test('a refusal does not erase a new direct question or unrelated rapport', () => {
    const {finalizeChallengeText}=require('../netlify/functions/_lib/plant-based-challenge-dm');
    const history=[{direction:'in',text:'Not now, I need time to think.'}];
    assert.deepEqual(finalizeChallengeText(["I've been vegan for five years."],{history,currentMessage:'Are you vegan?'}),["I've been vegan for five years."]);
    assert.deepEqual(finalizeChallengeText(['Nice, glad you got that session in. When you want help, we can plan training.'],{history,currentMessage:'I trained yesterday.'}),['Nice, glad you got that session in.']);
});


test('requested package facts survive a rapid-batch answer without unsolicited prices', () => {
    const {finalizeChallengeText}=require('../netlify/functions/_lib/plant-based-challenge-dm');
    const text=finalizeChallengeText(["Yep, the live workout is half an hour."],{currentMessage:'What does the $125 a week option include?\nIs the live workout half an hour?'}).join(' ');
    for(const pattern of [/125/,/weekly/,/1:1/,/Learn/]) assert.match(text,pattern);
    assert.doesNotMatch(finalizeChallengeText(['Yep, half an hour.'],{currentMessage:'Is the live workout half an hour?'}).join(' '),/125/);
});


test('known goals do not turn unrelated rapport into a sales invitation', () => {
    const {resolveChallengeTurn}=require('../netlify/functions/_lib/plant-based-challenge-dm');
    const history=[{direction:'in',text:'I want to get stronger and need help'}];
    for(const currentMessage of ['How was your weekend?', 'That sunset looks amazing', 'Nice!', 'Are you vegan?']) assert.equal(resolveChallengeTurn({history,currentMessage}).offering,false,currentMessage);
    assert.equal(resolveChallengeTurn({history:[{direction:'out',text:'Want the consultation booking card?'}],currentMessage:'Yes please'}).offering,true);
});
