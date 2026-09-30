const test = require('node:test');
const assert = require('node:assert/strict');
process.env.OPENAI_API_KEY = 'fixture-no-network-key';
process.env.AI_USAGE_LOG_DISABLED = 'true';

const policy = require('../netlify/functions/_lib/plant-based-challenge-dm');
const context = require('../netlify/functions/_lib/client-context');
const attribution = require('../netlify/functions/_lib/ig-acquisition-mode');

const trustHistory = [
    {direction:'in',text:"I'd like to get back into training and try online coaching."},
    {direction:'out',text:'What would you like to achieve?'},
    {direction:'in',text:'Lose body fat and build better nutrition habits over six to eight months.'},
];
const invitation = "We could have a video call and get to know each other a bit, with no pressure to sign up. Would that suit you?";

test('an organic coaching enquiry retains attribution and can invite a call without a blocker field', () => {
    const thread = {created_at:'2026-09-30T00:00:00Z',custom_data:{bot_account:'shan_n_sunny',acquisition_mode:'organic_inbound'}};
    assert.equal(attribution.resolveIgAcquisitionMode({customData:thread.custom_data}), 'organic_inbound');
    assert.equal(policy.resolveChallengeLeadRoute({thread,history:trustHistory,currentMessage:'Trust matters to me before working with someone.'}), true);
    assert.deepEqual(policy.collectChallengeLeadIssues({
        history:trustHistory,currentMessage:'Trust matters to me before working with someone.',
        qualifier:{facts:{history_blockers:null}},draft:{joined:invitation},
    }), []);
    assert.equal(policy.buildChallengeBookingHandoff({history:trustHistory,currentMessage:'Trust matters to me.',draft:{joined:policy.CHALLENGE_BOOKING_URL}}), null);
});

test('accepting a natural call invitation sends the booking card without a second link-permission question', () => {
    for (const offer of [
        invitation,
        'Would you like to have a phone call to discuss your training?',
        'Keen to jump on a call and talk about what you want from coaching?',
        'We could chat on a call about working together. Would that work for you?',
    ]) {
        const history = [...trustHistory,{direction:'out',text:offer}];
        for (const currentMessage of ['Yep sounds good','Yes please','That would be great','Sure, send it through','Yes please!\nCan we use the phone?']) {
            const input = {history,currentMessage,draft:{joined:policy.CHALLENGE_BOOKING_URL}};
            assert.equal(policy.resolveChallengeTurn(input).wantsCard,true,offer + currentMessage);
            assert.ok(policy.buildChallengeBookingHandoff(input));
            assert.ok(policy.collectChallengeLeadIssues({...input,draft:{joined:'Want me to send the booking link?'}}).length);
        }
        for (const currentMessage of ['Not now thanks','Maybe later','Yes but not yet','No thanks','What happens on the call?']) {
            assert.equal(policy.resolveChallengeTurn({history,currentMessage}).wantsCard,false,currentMessage);
        }
    }
});

test('enthusiasm, goal answers and social-call invitations never grant booking permission', () => {
    for (const text of ['Do you want to get stronger?', 'Want me to explain the challenge?', 'Want to video chat on Discord?']) {
        assert.equal(policy.resolveChallengeTurn({history:[{direction:'out',text}],currentMessage:'Yes please'}).wantsCard,false);
    }
    assert.equal(policy.resolveChallengeTurn({currentMessage:'I want to move at my own pace and get to know you first'}).wantsCard,false);
    assert.equal(policy.resolveChallengeTurn({history:[{direction:'out',text:invitation},{direction:'out',text:policy.CHALLENGE_BOOKING_URL}],currentMessage:'Thanks'}).wantsCard,false);
});

test('actual writer assembly uses full history and voice without importing the old stage machine', async () => {
    const contextPath = require.resolve('../netlify/functions/_lib/client-context');
    const writerPath = require.resolve('../netlify/functions/ig-instant-draft');
    const saved = require.cache[contextPath].exports;
    let prompt = '';
    const generate = async contents => {
        prompt = contents.flatMap(c=>c.parts || []).map(p=>p.text || '').join('\n');
        return JSON.stringify({messages:[invitation]});
    };
    require.cache[contextPath].exports = {...saved,loadEditExamples:async()=> 'Learned voice fixture',callOpenAITextModel:generate};
    delete require.cache[writerPath];
    try {
        await require(writerPath)._test.generateDraft({
            leadName:'Prospect',leadBlock:'Organic coaching enquiry',profileBlock:'',memoryBlock:'',
            history:trustHistory.map((item,index)=>({...item,created_at:new Date(Date.now()-(4-index)*60000).toISOString()})),currentMessage:'I want to build trust before working together.',
            recentInboundMessages:[{text:'Where do you work from?'}],leadStage:'qualifying',channel:'instagram',
            igThreadId:null,linkedUserId:null,priorScheduledDrafts:[],linkedNudges:[],
            qualifier:{facts:{history_blockers:null},next_question:'Collect a blocker first'},qualifierQuestion:'Collect a blocker first',
            botAccount:'shan_n_sunny',acquisitionMode:'organic_inbound',adFlowVariant:policy.CHALLENGE_FLOW,
        });
        for (const detail of ['Learned voice fixture','six to eight months','Where do you work from?','I want to build trust','ongoing online coaching','works from home']) assert.ok(prompt.includes(detail),detail);
        assert.doesNotMatch(prompt,/Collect a blocker first|Close through DMs by default|Want me to grab the booking link|Once their goal and struggle\/support need are understood|LATEST FULL-FLOW REQUIREMENT/);
        assert.match(prompt,/do not require a separate blocker answer before offering a call/i);
        assert.match(prompt,/manual takeover/);
    } finally {
        require.cache[contextPath].exports = saved;
        delete require.cache[writerPath];
    }
});

test('actual independent reviewer uses the same call objective without compulsory discovery stages', async () => {
    const savedFetch = global.fetch;
    let prompt = '';
    global.fetch = async (url, options) => {
        assert.equal(url,'https://api.openai.com/v1/responses');
        const body = JSON.parse(options.body);
        prompt = JSON.stringify(body.input);
        return {ok:true,status:200,json:async()=>({output_text:JSON.stringify({
            verdict:'pass',confidence:0.96,summary:'Grounded optional coaching call.',issues:[],
            context_loss_suspected:false,notification_required:false,notification_reason:'none',
        })})};
    };
    try {
        const review = await context.generateDraftReview({
            draftText:invitation,alertType:'ig_incoming_dm',offerFlowVariant:policy.CHALLENGE_FLOW,
            contextBlocks:trustHistory.map(m=>m.direction+': '+m.text).join('\n')+'\nLATEST: Trust matters before working together.',
            clientName:'Prospect',channelLabel:'Instagram',
        });
        assert.equal(review.verdict,'pass');
        assert.match(prompt,/Pass a grounded call invitation for a genuine coaching enquiry/);
        assert.match(prompt,/no blocker field is filled or the source is organic/);
        assert.doesNotMatch(prompt,/If only a goal is known, the next reply must|Once goal and struggle\/support need are understood, expect|Block a booking invitation in this opening/);
    } finally { global.fetch = savedFetch; }
});
