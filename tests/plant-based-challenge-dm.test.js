const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveChallengeLeadRoute, buildChallengeLeadPrompt, collectChallengeLeadIssues, buildChallengeBookingHandoff, CHALLENGE_BOOKING_URL } = require('../netlify/functions/_lib/plant-based-challenge-dm');
const fresh = { created_at:'2026-09-27T00:00:00Z', custom_data:{bot_account:'shan_n_sunny'} };

test('model understanding clears free-written enquiry heuristics without clearing real context holds', () => {
    const {buildContextReviewInfo,mergeDraftReviewContextReview}=require('../netlify/functions/_lib/client-context');
    const input={channel:'instagram',first_captured_lead_reply:true,message_preview:'Hey, I saw your ad. Can you tell me how this works?',offer_flow_variant:'plant_based_challenge'};
    const context=buildContextReviewInfo(input);
    assert.equal(context.required,true);
    const review={verdict:'warn',confidence:0.93,context_assessment:'model',context_loss_suspected:false,notification_required:false,notification_reason:'lead_quality',issues:['Include the course duration']};
    assert.equal(mergeDraftReviewContextReview(review,context,'plant_based_challenge').required,false);
    assert.equal(mergeDraftReviewContextReview(review,context,'broad_pain').required,true);
    assert.equal(mergeDraftReviewContextReview({...review,context_loss_suspected:true},context,'plant_based_challenge').required,true);
    assert.equal(mergeDraftReviewContextReview({...review,confidence:0.5},context,'plant_based_challenge').required,true);
    for (const reason of ['voice_note_review_required','ai_suspicion_or_authenticity_question','manychat_reconcile_latest_only','missing_media_evidence']) {
        const result=mergeDraftReviewContextReview(review,{...context,reasons:[...context.reasons,reason]},'plant_based_challenge');
        assert.equal(result.required,true);
        assert.ok(result.reasons.includes(reason));
    }
});

test('free-written enquiries use known challenge context without any keyword', () => {
    const campaignThread = {...fresh,custom_data:{...fresh.custom_data,offer_flow_variant:'plant_based_challenge',meta_ad_attribution:{ad_id:'new-ad'}}};
    for (const currentMessage of ['Hey, I saw your ad. Can you tell me how this works?','hiya','Can you help me get fitter?','I want stronger legs but shifts keep getting in the way','I only have a small space to exercise in']) {
        assert.equal(resolveChallengeLeadRoute({thread:campaignThread,currentMessage}),true);
        assert.equal(resolveChallengeLeadRoute({thread:fresh,currentMessage}),true);
        assert.equal(resolveChallengeLeadRoute({thread:{...campaignThread,linked_user_id:'existing-client'},currentMessage}),false);
    }
    const helpers = require('../netlify/functions/ig-instant-draft')._test;
    const currentMessage = 'Hey, I saw your ad. Can you tell me how this works?';
    assert.ok(helpers.buildInternalMetaAdTestResetCustomData({currentMessage,customData:{bot_account:'shan_n_sunny',internal_test_auto_reply_enabled:true,internal_test_meta_ad_flow:'broad_pain'}}));
    assert.equal(helpers.buildInternalMetaAdTestResetCustomData({currentMessage,customData:campaignThread.custom_data}),null);
});

test('conversational booking invitation keeps the consent boundary', () => {
    const invitation = 'Want me to grab the booking link for you so we can tee up a call time?';
    const history = [{direction:'out',text:invitation}];
    assert.equal(policy.resolveChallengeTurn({currentMessage:'Yes please',history}).wantsCard,true);
    assert.equal(policy.resolveChallengeTurn({currentMessage:'Not yet thanks',history}).wantsCard,false);
    assert.equal(policy.resolveChallengeTurn({currentMessage:'I want to build strength',history:[]}).wantsCard,false);
});

test('Summer Shred ad questions start independent internal tests but preserve real lead history', () => {
    const {buildInternalMetaAdTestResetCustomData, filterInternalTestHistoryAfterReset} = require('../netlify/functions/ig-instant-draft')._test;
    const customData = {bot_account:'shan_n_sunny',internal_test_auto_reply_enabled:true,internal_test_meta_ad_flow:'broad_pain'};
    const resetAt = '2026-09-29T06:00:00Z';
    const history = [{direction:'in',text:'old test goal',created_at:'2026-09-29T05:00:00Z'}];
    for (const currentMessage of ['Tell me more about the Summer Shred','Can I do the Summer Shred at home?','Is the Summer Shred right for me?']) {
        const reset = buildInternalMetaAdTestResetCustomData({customData,currentMessage,resetAt});
        const current = {direction:'in',text:currentMessage,created_at:resetAt};
        assert.deepEqual(filterInternalTestHistoryAfterReset({history:[...history,current],customData:reset}),[current]);
        assert.equal(buildInternalMetaAdTestResetCustomData({customData:{bot_account:'shan_n_sunny'},currentMessage,resetAt}),null);
        assert.equal(buildInternalMetaAdTestResetCustomData({linkedUserId:'client',customData,currentMessage,resetAt}),null);
        assert.equal(resolveChallengeLeadRoute({thread:{...fresh,custom_data:{bot_account:'shan_n_sunny',meta_ad_attribution:{ad_id:'new-ad'}}},currentMessage}),true);
    }
});

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
    for (const evidence of [/night shifts/,/KNOWN GOAL/,/vegetarian/,/Summer Shred/,/training/i,/meal plans/i,/Balance Learn/,/accountability/,/community/,/60.minute/,/125/,/30.minute/,/Only if they ask about price/i,/never repeat|Reuse answers/i,/manual|human/i,/media_summary/,/six weeks/]) assert.match(prompt,evidence);
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
    const common = {draft:{joined:`I can help with that strength goal through training and meal plans. Pick a consultation time here: ${CHALLENGE_BOOKING_URL}`,model:'vertex-v7'},currentMessage:'I want to build strength',qualifier:{facts:{motivation:'build strength'}},linkedUserId:null,leadStage:'qualifying',meaningfulLeadReplyCount:1,alertData:{challenge_policy_version:'plant_based_challenge_consent_v2'},challengeOfferWarning:{required:false,code:'approved_challenge_consultation'},mediaReview:{required:false},contextReview:{required:false},draftReview:{verdict:'pass',confidence:1,issues:[],context_loss_suspected:false}};
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
        assert.equal(requests[1].config.temperature,requests[0].config.temperature);
        assert.equal(requests[1].config.reasoningEffort,'medium');
        assert.equal(requests[0].config.reasoningEffort,undefined);
        assert.equal(requests[1].config.maxOutputTokens,2200);
        assert.equal(requests[1].options.label,'openai-paid-meta-primary');
        for (const text of ['LEARNED VOICE FIXTURE','Profile fixture: vegetarian','Memory fixture: strength goal, night shifts','I already told you about my night shifts.','And do I need to be vegan?']) {

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
test('challenge content guard catches misspelled destinations', () => {
    for (const url of ['Https://plant-based-balance.org/book?source=plant_based_challenge','Https://plantbased-balance.org/BOOK?source=plant_based_challenge']) {
        assert.ok(collectChallengeLeadIssues({draft:{joined:url},currentMessage:'Send the consultation link'}).length);
    }
});


test('challenge contract keeps common fact and conversational checks without old sales stages', () => {
    const {collectPaidMetaWriterContractIssues:check,buildPaidMetaAgentPrompt} = require('../netlify/functions/ig-instant-draft')._test;
    const base={flowVariant:'plant_based_challenge'};
    for (const [currentMessage,joined,pattern] of [
        ['Do videos have captions?','Yes, videos have captions.',/Unverified lesson captions/],
        ['Can you support gluten-free meals?','Sounds good.',/gluten-free question/],
        ['Are you trying to sell me something?','No, just chatting.',/sales question honestly/],
        ['How many lessons?','There are six lessons.',/Incorrect Learn lesson count/],
        ['Are you vegan?',"I'm vegan for five years.",/vegetarian/],
    ]) assert.ok(check({...base,currentMessage,draft:{joined}}).some(v=>pattern.test(v)),currentMessage);
    assert.deepEqual(check({...base,currentMessage:'How much does the challenge cost?',draft:{joined:'The price depends on the support package.'}}),[]);
    const prompt=buildPaidMetaAgentPrompt({flowVariant:'plant_based_challenge'});
    assert.doesNotMatch(prompt,/LATEST FULL-FLOW REQUIREMENT|BROAD ROUTE GUARD|preview comes before payment|GUIDE THE SALE|ZOOM SUPPORT OPTION/);
    for (const text of ['Preserve negations, corrections and uncertainty','Answer yes/no questions directly','Never deny automation','fixed weekly LEARNING theme','45 lessons']) assert.ok(prompt.includes(text),text);
});


test('dormant worker inherits challenge content without changing the transport contract', async () => {
    const {buildLivePrompt}=await import('../scripts/ig-codex-live-worker.mjs');
    const prompt=buildLivePrompt({alert:{id:'fixture',data:{challenge_policy_version:'plant_based_challenge_consent_v2'}},action:{id:'fixture'},codexThreadId:'fixture'});
    assert.ok(prompt.includes(CHALLENGE_BOOKING_URL));
    assert.ok(prompt.includes('Revalidate the supplied codex_live_worker controller claim'));
    assert.ok(prompt.includes('replyTextUtf8Base64'));
    assert.ok(prompt.includes('Keep the fixed curriculum distinct'));
    assert.ok(prompt.includes('Never ask for first name'));
    assert.doesNotMatch(prompt,/Exact signed app-preview URL|Exact approved Founders Pass checkout URL|newest inbound equivalent to/);
});


test('booking query parameters are not repeated conversational questions', () => {
    const check=require('../netlify/functions/ig-instant-draft')._test.collectPaidMetaWriterContractIssues;
    const input={flowVariant:'plant_based_challenge',currentMessage:'Can you resend the consultation booking link?',history:[{direction:'out',text:`Choose a time: ${CHALLENGE_BOOKING_URL}`}],draft:{joined:`Here it is again: ${CHALLENGE_BOOKING_URL}`}};
    assert.deepEqual(check(input),[]);
    assert.ok(check({...input,currentMessage:'Thanks'}).length);
});


test('ordinary acknowledgement after a pause is not confused with a future sales hook', () => {
    const history=[{direction:'in',text:'Not now, I need time to think.'}];
    assert.deepEqual(collectChallengeLeadIssues({history,currentMessage:'I trained yesterday.',draft:{joined:'Nice, sounds like you are already taking action.'}}),[]);
    assert.ok(collectChallengeLeadIssues({history,currentMessage:'I trained yesterday.',draft:{joined:'When you are ready, we can make a plan.'}}).length);
});


test('a later legacy promise outranks stale challenge metadata until explicitly reopened', () => {
    const thread={...fresh,custom_data:{...fresh.custom_data,offer_flow_variant:'plant_based_challenge'}};
    const history=[{direction:'in',text:'Tell me about the plant-based challenge'},{direction:'in',text:'Can I see the Learn preview?'},{direction:'out',text:'Want your free app preview?'}];
    assert.equal(resolveChallengeLeadRoute({thread,history,currentMessage:'Yes please'}),false);
    assert.equal(resolveChallengeLeadRoute({thread,history,currentMessage:'Actually I want the eight-week plant-based challenge'}),true);
    assert.equal(resolveChallengeLeadRoute({thread,currentMessage:'How much is the six-week Learn course?'}),false);
});


test('a late repair cannot hide a sales tail behind a correct safety answer', () => {
    const currentMessage='My knee is swollen and painful. What will fix it?';
    assert.ok(collectChallengeLeadIssues({currentMessage,draft:{joined:"I can't tell you what exercise fixes that. If you want, book a challenge consult later."}}).length);
});


test('only the explicit challenge keyword is independent of missing prior context', () => {
 const {buildContextReviewInfo}=require('../netlify/functions/_lib/client-context');
 const input={channel:'instagram',first_captured_lead_reply:true,message_preview:'Balance',offer_flow_variant:'plant_based_challenge'};
 assert.equal(buildContextReviewInfo(input).required,false);
 assert.equal(buildContextReviewInfo({...input,offer_flow_variant:undefined}).required,true);
 assert.equal(buildContextReviewInfo({...input,message_preview:'that one'}).required,true);
 assert.equal(buildContextReviewInfo({...input,context_review:{required:true,reasons:['voice_note_review_required']}}).required,true);
});

const policy = require('../netlify/functions/_lib/plant-based-challenge-dm');
const offered = [{direction:'out',text:'I can work the plan around those shifts. Want me to send the call booking link?'}];
test('goal and unusual struggle get an AI-written invitation, never immediate card permission', () => {
    for (const currentMessage of ['I want strength','My travel changes daily and conflicting advice leaves me doing nothing','I want to hike with my dad, but hotel floor space is all I have']) {
        assert.equal(policy.resolveChallengeTurn({currentMessage}).wantsCard,false);
        assert.equal(buildChallengeBookingHandoff({currentMessage,draft:{joined:CHALLENGE_BOOKING_URL}}),null);
        assert.deepEqual(collectChallengeLeadIssues({currentMessage,draft:{joined:'I can fit the training around that. Want me to send the call booking link?'}}),[]);
    }
});
test('booking acceptance requires a prior link invitation and handles multiple inbound bubbles', () => {
    for (const currentMessage of ['Yes please','Yeah sounds good','Sure, send it through','That would be great','Yes please!\nIs the call 60 minutes?']) {
        const input={history:offered,currentMessage,draft:{joined:CHALLENGE_BOOKING_URL}};
        assert.ok(buildChallengeBookingHandoff(input),currentMessage);
        assert.equal(buildChallengeBookingHandoff({...input,history:[{direction:'out',text:'Do you want to get stronger?'}]}),null);
    }
    for (const currentMessage of ['No thanks','Not yet','Yes but not now','Maybe','Yes if it is free','Sounds interesting','What happens on the call?']) {
        assert.equal(buildChallengeBookingHandoff({history:offered,currentMessage,draft:{joined:CHALLENGE_BOOKING_URL}}),null,currentMessage);
    }
});
test('direct request supplies consent; refusal, social calls and old card acknowledgements do not', () => {
    for(const currentMessage of ['Please send the booking link','Can I book a consultation?','Can you resend the call booking link?']) assert.ok(buildChallengeBookingHandoff({currentMessage,draft:{joined:CHALLENGE_BOOKING_URL}}));
    for(const currentMessage of ["Don't send the booking link",'Want to video chat on Discord?','Thanks','Yes please']) assert.equal(buildChallengeBookingHandoff({currentMessage,history:[{direction:'out',text:CHALLENGE_BOOKING_URL}],draft:{joined:CHALLENGE_BOOKING_URL}}),null);
});
test('ordinary wording is preserved exactly and model outage never substitutes a sales script', () => {
    for(const currentMessage of ['BALANCE','I want strength','No thanks','How much is it?']) {
        const chunks=['A deliberately unusual model sentence.','A second answer to their other question.'];
        assert.deepEqual(policy.finalizeChallengeText(chunks,{currentMessage}),chunks);
        assert.equal(policy.buildChallengeUnavailableFallback({currentMessage}),null);
    }
});
test('challenge media prohibition and vegetarian correction survive late draft repairs', () => {
    for(const draft of [{joined:"Here's a photo showing a transformation"},{joined:'Here you go',imageAttachmentUrl:'https://example.com/photo.jpg'},{joined:'Here you go',videoAttachmentUrl:'https://example.com/video.mp4'},{joined:"I'm vegan for five years"}]) assert.ok(collectChallengeLeadIssues({currentMessage:'Can you help?',draft}).length);
});
test('opener preference includes Summer Shred, Learn and ten-week goal horizon without diet qualification', () => {
    const prompt=buildChallengeLeadPrompt({currentMessage:'BALANCE'});
    for(const phrase of ['Summer Shred','six-week course','long-term lifestyle changes','What are you looking to achieve over the next ten weeks?','not a vegan-status qualification gate','No transformation photos']) assert.ok(prompt.includes(phrase),phrase);
    assert.doesNotMatch(prompt,/No extra permission loop|goal plus a genuine.*enquiry is enough|Do not ask permission to send/);
});

test('challenge uses semantic review for earned invitations while keeping every safety hold', () => {
 const writer=require('../netlify/functions/ig-instant-draft')._test;
 const input={draft:{joined:'We can fit training around that. Want me to send the call booking link?',model:'openai-gpt-5.4-mini-paid-meta'},currentMessage:'The hotel floor is all I have to train on',history:[{direction:'in',text:'I want to hike with my dad'}],qualifier:{},linkedUserId:null,leadStage:'qualifying',meaningfulLeadReplyCount:1,alertData:{challenge_policy_version:'plant_based_challenge_consent_v2'},challengeOfferWarning:{required:true,code:'challenge_offer'},mediaReview:{required:false},contextReview:{required:false},draftReview:{verdict:'pass',confidence:1,issues:[],reviewer_model:'gemini-draft-context-review',context_loss_suspected:false,notification_required:false}};
 assert.equal(writer.getAutoDmHoldReason(input),null);
 for(const override of [{draftReview:{...input.draftReview,reviewer_model:'deterministic-paid-meta-fast-contract-v1'}},{draftReview:{...input.draftReview,verdict:'block',issues:['premature invitation']}},{contextReview:{required:true}},{mediaReview:{required:true}}]) assert.ok(writer.getAutoDmHoldReason({...input,...override}));
 assert.deepEqual(writer.collectCocosAutoRepairIssues({...input,flowVariant:'plant_based_challenge'}),[]);
});

test('a missing intro is a repairable content omission, while actual missing conversation remains held', () => {
 const ctx=require('../netlify/functions/_lib/client-context');
 const writer=require('../netlify/functions/ig-instant-draft')._test;
 const raw={verdict:'block',confidence:0.86,summary:'Missing context in the opening explanation',issues:['Missing challenge introduction before goal'],context_loss_suspected:false};
 const review=ctx.normalizeDraftReviewPayload(raw,{trustExplicitContextAssessment:true});
 assert.equal(review.context_loss_suspected,false);
 assert.equal(ctx.mergeDraftReviewContextReview(review,{required:false}).required,false);
 assert.equal(writer.reviewLooksLikePureContextGap(review),false);
 assert.ok(writer.collectCocosAutoRepairIssues({draft:{joined:'What is your goal?'},draftReview:review,flowVariant:'plant_based_challenge'}).length);
 const missing=ctx.normalizeDraftReviewPayload({...raw,context_loss_suspected:true},{trustExplicitContextAssessment:true});
 assert.equal(ctx.mergeDraftReviewContextReview(missing).required,true);
 assert.equal(ctx.normalizeDraftReviewPayload(raw).context_loss_suspected,true);
});

test('the included Learn explanation never migrates Summer Shred into the legacy media route', () => {
 const thread={created_at:'2026-09-29T00:00:00Z',custom_data:{bot_account:'shan_n_sunny',offer_flow_variant:'plant_based_challenge'}};
 const history=[{direction:'in',text:'BALANCE'},{direction:'out',text:'The ten week Summer Shred includes workout programming, meal plan support, accountability, and Balance Learn, the six week course that helps with the long-term change side of it.'},{direction:'out',text:'What are you looking to achieve over the next ten weeks?'}];
 assert.equal(resolveChallengeLeadRoute({thread,history,currentMessage:"I'd like to feel fitter and get stronger for hiking."}),true);
 assert.equal(resolveChallengeLeadRoute({thread,history:[...history,{direction:'in',text:'I want hiking fitness'},{direction:'out',text:'What makes that difficult?'}],currentMessage:'Conflicting advice means I do nothing'}),true);
 for(const currentMessage of ['Tell me about the ten-week plant-based challenge','Tell me about Summer Shred']) assert.equal(resolveChallengeLeadRoute({thread,history:[],currentMessage}),true);
 assert.equal(resolveChallengeLeadRoute({thread,history:[...history,{direction:'out',text:'Want your free app preview?'}],currentMessage:'Yes please'}),false);
});

test('challenge quality warnings cannot be relabelled as a deterministic style pass', () => {
 const {buildPaidMetaNonBlockingReviewFallback}=require('../netlify/functions/ig-instant-draft')._test;
 assert.equal(buildPaidMetaNonBlockingReviewFallback({flowVariant:'plant_based_challenge',draft:{joined:'What is your goal?'},draftReview:{verdict:'warn',notification_required:false,issues:['Missing introduction']}}),null);
});

test('native likes must never be simulated with heart emojis in reply text', () => {
 for (const heart of ['❤️','♥','💕','🩷']) {
  assert.ok(collectChallengeLeadIssues({draft:{joined:`Nice ${heart} What gets in the way?`},currentMessage:'I want to get stronger'}).some(issue=>issue.includes('heart emojis')));
 }
 assert.deepEqual(collectChallengeLeadIssues({draft:{joined:'Nice, what gets in the way of building that up?'},currentMessage:'I want to get stronger'}),[]);
});

test('sender phone capitalization preserves the approved booking destination', () => {
 const {sanitizeVisibleOutboundDmText}=require('../netlify/functions/_lib/client-context');
 const joined=sanitizeVisibleOutboundDmText('Yep, the consult is 60 minutes.\nhttps://plantbased-balance.org/book?source=plant_based_challenge');
 assert.deepEqual(collectChallengeLeadIssues({draft:{joined},currentMessage:'Yes please. Is the call 60 minutes?',history:[{direction:'out',text:'Want me to send the booking link?'}]}),[]);
});
