const assert = require('assert');

const {
    DEFAULT_PERSONAS,
    choosePersonas,
    parseJsonObject,
    normalizeScorecard,
    mergeScenarioPersona,
    sanitizePersonaSourceText,
    sanitizeGeneratedPersona,
    normalizePersonaRoute,
    detectCoachTurnIssues,
    isAcceptedNoReplyConversation,
    adjustScorecardForAcceptedNoReply,
    transcriptToText,
    runSparringBatch,
} = require('../netlify/functions/_lib/dm-sparring-gym');

const firstPick = choosePersonas({ count: 3, seed: 'same-seed' }).map(p => p.key);
const secondPick = choosePersonas({ count: 3, seed: 'same-seed' }).map(p => p.key);
assert.deepStrictEqual(firstPick, secondPick);
assert.strictEqual(firstPick.length, 3);

assert.deepStrictEqual(
    parseJsonObject('```json\n{"messages":["hey"]}\n```'),
    { messages: ['hey'] }
);

const score = normalizeScorecard({
    felt_human: 11,
    heard_first: -2,
    context_use: 8.27,
    risk_flags: ['x', null, ''],
});
assert.strictEqual(score.felt_human, 10);
assert.strictEqual(score.heard_first, 0);
assert.strictEqual(score.context_use, 8.3);

const acceptedExitHistory = [
    { role: 'lead', speaker: 'Casey', text: 'Bye' },
    { role: 'coach', speaker: 'Shannon', text: 'oops! all good, have a good one' },
    { role: 'lead', speaker: 'Casey', text: '[no reply]', no_reply: true },
];
const acceptedExitPersona = {
    hookContext: 'Accidental contact after trying to dismiss a story.',
    hiddenProfile: 'Intent to engage is genuinely zero.',
};
assert.ok(isAcceptedNoReplyConversation({ persona: acceptedExitPersona, history: acceptedExitHistory }));
const respectfulByeIssues = detectCoachTurnIssues({
    coachText: 'all good, no worries at all!\nhope you have a good one',
    leadText: 'Bye',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.deepStrictEqual(respectfulByeIssues, []);
const adjustedAcceptedExit = adjustScorecardForAcceptedNoReply(normalizeScorecard({
    felt_human: 2,
    heard_first: 2,
    context_use: 2,
    not_boring: 2,
    not_salesy: 9,
    question_quality: 2,
    invite_timing: 10,
    likely_reply: 1,
    likely_join: 1,
    overall: 1,
    risk_flags: ['ghosted'],
}), { persona: acceptedExitPersona, history: acceptedExitHistory });
assert.ok(!adjustedAcceptedExit.risk_flags.includes('ghosted'));
assert.ok(adjustedAcceptedExit.overall >= 8.5);

const acceptedBusyExitHistory = [
    { role: 'lead', speaker: 'Alex', text: 'Things are wild here with the new spot, barely have a sec.' },
    { role: 'coach', speaker: 'Shannon', text: 'so good to see you too. no rush to reply at all!' },
    { role: 'lead', speaker: 'Alex', text: "Market's still buzzing, but I gotta jump back in. So swamped! Talk later!" },
    { role: 'coach', speaker: 'Shannon', text: 'totally, good luck with the market. talk soon' },
    { role: 'lead', speaker: 'Alex', text: '[no reply]', no_reply: true },
];
const acceptedBusyExitPersona = {
    hookContext: 'Brief positive interaction at a busy community market.',
    hiddenProfile: 'Very low bandwidth and protective of limited time.',
};
assert.ok(isAcceptedNoReplyConversation({ persona: acceptedBusyExitPersona, history: acceptedBusyExitHistory }));

const pitchedOptOut = adjustScorecardForAcceptedNoReply(normalizeScorecard({
    overall: 1,
    risk_flags: ['ghosted'],
}), {
    persona: acceptedExitPersona,
    history: [
        { role: 'lead', speaker: 'Casey', text: 'Bye' },
        { role: 'coach', speaker: 'Shannon', text: 'want me to send the link for the free challenge?' },
        { role: 'lead', speaker: 'Casey', text: '[no reply]', no_reply: true },
    ],
});
assert.ok(pitchedOptOut.risk_flags.includes('ghosted'));
assert.deepStrictEqual(score.risk_flags, ['x']);
assert.deepStrictEqual(
    normalizeScorecard({ risk_flags: ['No probing questions to uncover potential needs', 'Stuck in a validation loop without progression towards the goal'] }).risk_flags,
    ['no_progression', 'validation_loop']
);

const merged = mergeScenarioPersona(DEFAULT_PERSONAS[0], {
    hidden_profile: 'more realistic hidden profile',
    lead_rules: ['answer only the newest question'],
    reality_checks: ['do not become hot from one nice reply'],
});
assert.strictEqual(merged.hiddenProfile, 'more realistic hidden profile');
assert.deepStrictEqual(merged.leadRules, ['answer only the newest question']);
assert.deepStrictEqual(merged.storyChecks, ['do not become hot from one nice reply']);

const sanitized = sanitizePersonaSourceText('hey @real_handle email me a@b.com [PHOTO:https://x.test/a.jpg] 0412 345 678');
assert.ok(!sanitized.includes('@real_handle'), sanitized);
assert.ok(!sanitized.includes('a@b.com'), sanitized);
assert.ok(!sanitized.includes('0412'), sanitized);
assert.ok(sanitized.includes('[photo]'), sanitized);

const personaSanitized = sanitizeGeneratedPersona({
    storyChecks: ['mentions a 20kg barbell and 30-second hold with her sister in October'],
});
assert.strictEqual(personaSanitized.storyChecks[0], 'mentions a [specific weight] barbell and [specific duration] hold with her family member in [specific month]');
assert.strictEqual(normalizePersonaRoute('generic|sparring_enthusiast'), 'generic');
assert.strictEqual(normalizePersonaRoute('plant based curious'), 'vegan');

assert.strictEqual(
    transcriptToText([{ speaker: 'Lead', text: '[no reply]', no_reply: true }]),
    'Lead: [no reply / left on seen]'
);

const premature = detectCoachTurnIssues({
    coachText: 'yeah i can get you into the free 30 day challenge if you want, want me to send the link?',
    leadText: 'haha yeah sounds cool',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(premature.includes('possible_premature_challenge_invite'));

const personalChallengePitch = detectCoachTurnIssues({
    coachText: "i run a free 30-day challenge that's all about building solid habits. keen to hear more about it?",
    leadText: "What kind of stuff do you usually do for a challenge?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(personalChallengePitch.includes('premature_challenge_invite'));

const personalChallengeAnswer = detectCoachTurnIssues({
    coachText: "for me it's usually heavy training blocks, trying to beat last week's numbers without doing anything too silly. what kind of challenge feels fun for you after nailing that rope climb?",
    leadText: "What kind of stuff do you usually do for a challenge?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!personalChallengeAnswer.includes('premature_challenge_invite'));
assert.ok(!personalChallengeAnswer.includes('no_progression'));

const programInfoLinkPush = detectCoachTurnIssues({
    coachText: "the 30-day challenge has daily workouts, meal ideas, and habit tracking in the app. want me to send you the link to get started?",
    leadText: "What's included in the program?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(programInfoLinkPush.includes('possible_premature_challenge_invite'));

const programInfoNoLink = detectCoachTurnIssues({
    coachText: "it's daily workouts, simple meal ideas, and habit tracking in the app so you have a bit of structure each day. is the workout side or the food side the bit you care most about?",
    leadText: "What's included in the program?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!programInfoNoLink.includes('possible_premature_challenge_invite'));

const momentumBroadHistoryLoop = detectCoachTurnIssues({
    coachText: "yeah that's super relatable. what kind of things have you tried before that just didn't quite stick for you?",
    leadText: "Just lose momentum after a bit. Tried a few things before and always end up stopping.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(momentumBroadHistoryLoop.includes('too_generic'));
assert.ok(momentumBroadHistoryLoop.includes('no_progression'));

const momentumDropoffBridge = detectCoachTurnIssues({
    coachText: "that drop-off after the first burst is exactly where daily check-ins and small wins matter. where does momentum usually disappear for you, week one or after the novelty wears off?",
    leadText: "Just lose momentum after a bit. Tried a few things before and always end up stopping.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!momentumDropoffBridge.includes('too_generic'));
assert.ok(!momentumDropoffBridge.includes('no_progression'));

const peptideAnswerThenClarifier = detectCoachTurnIssues({
    coachText: "it's not totally black and white. some have promising research for specific things, but it's a complex area and not like a magic bullet. what's got you thinking about them? more for recovery or building muscle?",
    leadText: "What's the real deal with those? I keep seeing stuff about peptides for muscle and recovery, but is it actually legit or just another hyped-up thing?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!peptideAnswerThenClarifier.includes('ignored_direct_question'));
assert.ok(!peptideAnswerThenClarifier.includes('too_many_questions'));

const advancedBiohackDodge = detectCoachTurnIssues({
    coachText: "love that drive for new PBs. when you say next edge, is it more around strength, endurance, body comp, or something else?",
    leadText: "What kind of advanced protocols do you usually recommend for someone who's already deep into optimizing performance with peptide stacks?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(advancedBiohackDodge.includes('ignored_direct_question'));
assert.ok(advancedBiohackDodge.includes('no_progression'));

const advancedBiohackBoundary = detectCoachTurnIssues({
    coachText: "i wouldn't recommend peptide or NAD protocols over DMs, that's clinician and bloodwork territory. in my lane, i'd first make sure training load, sleep, protein and recovery are nailed. which baseline is already most dialled?",
    leadText: "What are your thoughts on NAD+ precursors or senolytics for performance?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!advancedBiohackBoundary.includes('ignored_direct_question'));
assert.ok(!advancedBiohackBoundary.includes('no_progression'));

const veganRecipeRapport = detectCoachTurnIssues({
    coachText: "that dish was a good one. i'm always after easy plant-based recipes, what's your go-to at the moment?",
    leadText: "OMG, this vegan dish looks incredible! I have some amazing plant-based recipes if you're interested.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!veganRecipeRapport.includes('too_generic'));
assert.ok(!veganRecipeRapport.includes('no_progression'));

const travelReciprocalRapport = detectCoachTurnIssues({
    coachText: "that sounds unreal. i loved new zealand for just getting lost in the mountains. was it a specific village or just wherever you ended up?",
    leadText: "My favorite trip was to a tiny village in Italy, totally got lost. Felt like stepping into a postcard. What about you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!travelReciprocalRapport.includes('too_generic'));
assert.ok(!travelReciprocalRapport.includes('no_progression'));

const travelViewLoop = detectCoachTurnIssues({
    coachText: "yeah green hills at dusk are so calming. do you have a favourite place you've seen a really epic skyline or mountain view?",
    leadText: "Totally get that world away feeling. For me, it's usually a dramatic landscape, like mountains or a cool city skyline at dusk. What about you, any views that captivate you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(travelViewLoop.includes('too_generic'));
assert.ok(travelViewLoop.includes('no_progression'));

const travelViewBridge = detectCoachTurnIssues({
    coachText: "green hills are the one for me, mainly because they make my brain properly switch off. do you chase those views for the reset too, or more for the hiking/exploring side?",
    leadText: "Totally get that world away feeling. For me, it's usually a dramatic landscape, like mountains or a cool city skyline at dusk. What about you, any views that captivate you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!travelViewBridge.includes('too_generic'));
assert.ok(!travelViewBridge.includes('no_progression'));

const nostalgiaMemoryLoop = detectCoachTurnIssues({
    coachText: 'haha the menu collection! what kind of takeout was usually on rotation for you back in the day?',
    leadText: "Hmm, slow reveal... I guess watching old movies on VHS. Or maybe just waiting for a really good takeout order. Remember those old menus you'd collect?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(nostalgiaMemoryLoop.includes('too_generic'));
assert.ok(nostalgiaMemoryLoop.includes('no_progression'));

const nostalgiaCurrentBridge = detectCoachTurnIssues({
    coachText: 'yeah, sounds like you miss having slower offline moments more than the menus themselves. do you get anything now that gives you that same switch-off feeling?',
    leadText: "Hmm, slow reveal... I guess watching old movies on VHS. Or maybe just waiting for a really good takeout order. Remember those old menus you'd collect?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!nostalgiaCurrentBridge.includes('too_generic'));
assert.ok(!nostalgiaCurrentBridge.includes('no_progression'));

const creativeChaosLoop = detectCoachTurnIssues({
    coachText: 'haha exactly! what kind of fun stuff usually gets mixed into your flow?',
    leadText: 'My creative chaos will definitely be flowing, probably with some fun stuff mixed in too.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(creativeChaosLoop.includes('too_generic'));
assert.ok(creativeChaosLoop.includes('no_progression'));

const creativeChaosBridge = detectCoachTurnIssues({
    coachText: 'haha fair, does the creative chaos usually give you energy, or drain you by the end of the day?',
    leadText: 'My creative chaos will definitely be flowing, probably with some fun stuff mixed in too.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!creativeChaosBridge.includes('too_generic'));
assert.ok(!creativeChaosBridge.includes('no_progression'));

const kneeClarifier = detectCoachTurnIssues({
    coachText: "yeah that's super frustrating when it feels like that. what's the go with the knee? has it been playing up for a while?",
    leadText: "Mostly this damn knee, it's a real buzzkill.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!kneeClarifier.includes('too_many_questions'));

const kneeEarlyTriage = detectCoachTurnIssues({
    coachText: "ah, that's a bummer. is it something that comes and goes, or a new thing?",
    leadText: "It means I'm resting. Knee's still acting up.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!kneeEarlyTriage.includes('no_progression'));

const jointImpactClarifier = detectCoachTurnIssues({
    coachText: "lentil stews and veggie curries for comfort food sounds perfect. what does that feel like when your joints flare up? does it make it hard to do certain things?",
    leadText: "I used to be more adventurous, but some days it's hard to manage much beyond the basics, especially when my joints are flaring up.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!jointImpactClarifier.includes('too_many_questions'));

const kneeFocusPivot = detectCoachTurnIssues({
    coachText: "haha the bag of peas is a classic. sounds like you really went for it today, what was the focus?",
    leadText: "Haha, my recovery crew is just me, myself, and maybe a very cold bag of peas for the knee lol.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(kneeFocusPivot.includes('no_progression'));

const kneeRecoveryBridge = detectCoachTurnIssues({
    coachText: "the bag of peas is classic. does the knee usually flare after sessions like that, or was today an exception?",
    leadText: "Haha, my recovery crew is just me, myself, and maybe a very cold bag of peas for the knee lol.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!kneeRecoveryBridge.includes('no_progression'));

const shoulderVagueProbe = detectCoachTurnIssues({
    coachText: "yeah, plateaus are frustrating and nagging shoulders are the worst for consistency. what's going on with it?",
    leadText: "Yeah, plateaus suck. My shoulder's always nagging, makes consistency tough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(shoulderVagueProbe.includes('no_progression'));

const shoulderSpecificProbe = detectCoachTurnIssues({
    coachText: "yeah, nagging shoulders make consistency brutal. is it bench, overhead work, or pressing in general that flares it most?",
    leadText: "Yeah, plateaus suck. My shoulder's always nagging, makes consistency tough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!shoulderSpecificProbe.includes('no_progression'));

const petClarifier = detectCoachTurnIssues({
    coachText: "what about your menace? is she still going strong on the chaos front?",
    leadText: "What's their latest destructive masterpiece been?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!petClarifier.includes('too_many_questions'));

const rhetoricalPlusQuestion = detectCoachTurnIssues({
    coachText: "hahaha right? the project manager probably quit from all the admin. what was it about those glory days that felt easier?",
    leadText: "Where's the project manager for this shredding initiative?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!rhetoricalPlusQuestion.includes('too_many_questions'));

const goalRightPlusQuestion = detectCoachTurnIssues({
    coachText: "haha good! that's the goal right? what is your usual go-to for getting moving?",
    leadText: "Makes me almost want to join in!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!goalRightPlusQuestion.includes('too_many_questions'));

const chatBotTagPlusQuestion = detectCoachTurnIssues({
    coachText: "chat bot hey? guess i need to step up my game then. what's been taking up your time lately?",
    leadText: "What's up, chat bot?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!chatBotTagPlusQuestion.includes('too_many_questions'));

const ehBanterPlusQuestion = detectCoachTurnIssues({
    coachText: "ah the usual grief, eh? is it something that flares up with specific movements or just generally after leg day?",
    leadText: "The knee's giving me the usual grief after squats. Always something, eh?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!ehBanterPlusQuestion.includes('too_many_questions'));

const elaboratedQuestion = detectCoachTurnIssues({
    coachText: "what's your vibe for a coffee shop? like, what makes the spot for you?",
    leadText: "Still on the hunt for the spot.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!elaboratedQuestion.includes('too_many_questions'));

const reflectiveEchoQuestion = detectCoachTurnIssues({
    coachText: "and that feeling of wanting to stick to things instead of feeling scattered? that's so real. what usually makes it fall apart first?",
    leadText: "I want to stick to the things I plan, but I feel scattered all the time.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!reflectiveEchoQuestion.includes('too_many_questions'));

const rhetoricalTagQuestion = detectCoachTurnIssues({
    coachText: "haha yeah it's never a dull moment with them around, is it? does he have any other enemies besides the vacuum?",
    leadText: "Buster definitely thinks he's protecting me from the vacuum.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!rhetoricalTagQuestion.includes('too_many_questions'));

const dreamComboRightQuestion = detectCoachTurnIssues({
    coachText: "yeah that's the dream combo right? if you had a few go-to meals sorted, what difference would that make to your day or week?",
    leadText: "Something healthy that's not too complicated. And quick!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!dreamComboRightQuestion.includes('too_many_questions'));

const whatIfQuestionStack = detectCoachTurnIssues({
    coachText: "what if healthy stuff could feel easy without needing all that mental energy? what would that even feel like for you?",
    leadText: "If it's not basically ready to eat, my brain can't deal.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(whatIfQuestionStack.includes('too_many_questions'));

const optionContinuationQuestion = detectCoachTurnIssues({
    coachText: "if you can pick one or two things to log consistently, that's a solid start. what's your go-to if you had the gym all to yourself? upper body, full body, or something else?",
    leadText: 'Maybe some upper body stuff or full body. Depends on how busy it is.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!optionContinuationQuestion.includes('too_many_questions'));

const optionProbeWithStarter = detectCoachTurnIssues({
    coachText: "that makes sense. what's the biggest drag when those workouts start to slide? is it the prep, the actual session, or just getting started?",
    leadText: "Usually the consistent workouts. I try to stick to calisthenics and Pilates.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!optionProbeWithStarter.includes('too_many_questions'));

const moodOptionProbe = detectCoachTurnIssues({
    coachText: "solid, i'm doing pretty good. how's things looking at your end today? calm or still the usual delightful chaos?",
    leadText: "How are you doing today?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!moodOptionProbe.includes('too_many_questions'));

const repeatedQuestionStillFlagged = detectCoachTurnIssues({
    coachText: "that expert sounded interesting. what was that expert you mentioned on? was it a podcast you were listening to?",
    leadText: "That expert was so good! Really interesting stuff. Do you listen to podcasts much?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(repeatedQuestionStillFlagged.includes('too_many_questions'));

const podcastReciprocalBridge = detectCoachTurnIssues({
    coachText: "yeah i do, mostly science ones and the odd thriller when i need my brain off. what did that expert say that stuck with you?",
    leadText: "That expert was so good! Really interesting stuff. Do you listen to podcasts much?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!podcastReciprocalBridge.includes('too_many_questions'));
assert.ok(!podcastReciprocalBridge.includes('no_progression'));

const petFocusLoop = detectCoachTurnIssues({
    coachText: "hahaha yeah that's pretty much an instant focus killer isn't it. i swear they know exactly when you're trying to concentrate",
    leadText: "They know how to make their presence known, especially when we're trying to focus. My keyboard is basically Mittens' second bed sometimes.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(petFocusLoop.includes('too_generic'));
assert.ok(petFocusLoop.includes('no_progression'));

const petFocusBridge = detectCoachTurnIssues({
    coachText: "haha they absolutely know. does mittens end up being your main little reset when work gets intense, or do you have anything else that helps you switch off?",
    leadText: "They know how to make their presence known, especially when we're trying to focus. My keyboard is basically Mittens' second bed sometimes.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!petFocusBridge.includes('too_generic'));
assert.ok(!petFocusBridge.includes('no_progression'));

const petDeflectionLoop = detectCoachTurnIssues({
    coachText: "haha, that's definitely a type of balance right there. mine's usually going for cables, but shoelaces are a new level of chaos",
    leadText: "For me, balance is mostly trying to stop my cat from redecorating with his claws. My cat just tried to eat my shoelaces.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(petDeflectionLoop.includes('too_generic'));
assert.ok(petDeflectionLoop.includes('no_progression'));

const petDeflectionBridge = detectCoachTurnIssues({
    coachText: "haha the shoelace war is real. outside the cat chaos, what would actual balance mean for you this week?",
    leadText: "For me, balance is mostly trying to stop my cat from redecorating with his claws. My cat just tried to eat my shoelaces.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!petDeflectionBridge.includes('too_generic'));
assert.ok(!petDeflectionBridge.includes('no_progression'));

const reciprocalCatsNameQuestion = detectCoachTurnIssues({
    coachText: "haha love that. i've got sunshine, a free-roam rabbit who mostly chills or causes chaos. what are your cats' names?",
    leadText: "Oh my gosh, yes! Animals are the best. I have two cats myself, they're my little shadows. What about you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!reciprocalCatsNameQuestion.includes('too_generic'));
assert.ok(!reciprocalCatsNameQuestion.includes('no_progression'));

const reciprocalPetsClosedDoor = detectCoachTurnIssues({
    coachText: "i do actually, a free-roam rabbit called sunshine who pretty much runs the house haha. hope you find a good vet soon!",
    leadText: "My main focus has been finding a good vet here since I just moved, which is surprisingly stressful! Do you have any pets?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(reciprocalPetsClosedDoor.includes('too_generic'));
assert.ok(reciprocalPetsClosedDoor.includes('no_progression'));

const reciprocalPetsBridge = detectCoachTurnIssues({
    coachText: "i do, a free-roam rabbit called sunshine who runs the house haha. moving with a pet sounds stressful though, does that anxiety carry into your whole day or do you get any chance to switch off?",
    leadText: "My main focus has been finding a good vet here since I just moved, which is surprisingly stressful! Do you have any pets?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!reciprocalPetsBridge.includes('too_generic'));
assert.ok(!reciprocalPetsBridge.includes('no_progression'));

const correctedPetNameQuestion = detectCoachTurnIssues({
    coachText: "haha my bad, a cat, love that. what's her name?",
    leadText: "Haha, thanks! Actually, she's a cat.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!correctedPetNameQuestion.includes('too_generic'));
assert.ok(!correctedPetNameQuestion.includes('no_progression'));

const petDamageLoop = detectCoachTurnIssues({
    coachText: "oh no, curtains too! they really do plan the chaos. what's their go-to target when it's not the curtains?",
    leadText: 'My cats are currently obsessed with trying to "redecorate" the curtains. So annoying!',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(petDamageLoop.includes('too_generic'));
assert.ok(petDamageLoop.includes('no_progression'));

const extendedPetBridge = detectCoachTurnIssues({
    coachText: "haha the curtains are fighting for their life. outside the cat chaos, does home or work feel calmer for you lately, or is it all a bit loud?",
    leadText: 'My cats are currently obsessed with trying to "redecorate" the curtains. So annoying!',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!extendedPetBridge.includes('too_generic'));
assert.ok(!extendedPetBridge.includes('no_progression'));

const sunshinePetLoop = detectCoachTurnIssues({
    coachText: "oh usually trying to chew through power cords or zoom around the place at full speed. it's like they have a sixth sense for when you're busy haha. does mittens have any specific ways of helping you out?",
    leadText: "Haha, sounds about right. What kind of chaos does Sunshine usually get into?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(sunshinePetLoop.includes('too_generic'));
assert.ok(sunshinePetLoop.includes('no_progression'));

const sunshinePetBridge = detectCoachTurnIssues({
    coachText: "sunshine is usually chewing cords or doing zoomies when i'm trying to work. does mittens end up being your little reset from the day, or more just extra chaos?",
    leadText: "Haha, sounds about right. What kind of chaos does Sunshine usually get into?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!sunshinePetBridge.includes('too_generic'));
assert.ok(!sunshinePetBridge.includes('no_progression'));

const chaoticQuietMomentLoop = detectCoachTurnIssues({
    coachText: "app building is a battle with a weird bug today, so sunshine's distractions are almost a welcome break haha. those chaotic days can be a real drain. what does that usually feel like for you?",
    leadText: "Definitely leaning towards chaotic today! Wishing for a quiet moment myself. Hope your app building is going well despite Sunshine's chaos though!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(chaoticQuietMomentLoop.includes('too_generic'));
assert.ok(chaoticQuietMomentLoop.includes('no_progression'));

const chaoticQuietMomentBridge = detectCoachTurnIssues({
    coachText: "app building is a battle with a weird bug today, but i'll survive haha. if today feels chaotic, what's the smallest quiet moment that would help you switch off for five minutes?",
    leadText: "Definitely leaning towards chaotic today! Wishing for a quiet moment myself. Hope your app building is going well despite Sunshine's chaos though!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!chaoticQuietMomentBridge.includes('too_generic'));
assert.ok(!chaoticQuietMomentBridge.includes('no_progression'));

const temporaryDistractionPodcastPivot = detectCoachTurnIssues({
    coachText: "yeah that temporary distraction thing is so real. what kind of podcasts do you usually lean towards?",
    leadText: "Sometimes I try listening to a podcast or just getting up, but it rarely feels like it actually helps long-term. More like a temporary distraction until the puppy wakes up again.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(temporaryDistractionPodcastPivot.includes('too_generic'));
assert.ok(temporaryDistractionPodcastPivot.includes('no_progression'));

const temporaryDistractionResetBridge = detectCoachTurnIssues({
    coachText: "yeah that temporary distraction thing is real. when the puppy is finally asleep, what would actually help your mind switch off beyond just distracting it?",
    leadText: "Sometimes I try listening to a podcast or just getting up, but it rarely feels like it actually helps long-term. More like a temporary distraction until the puppy wakes up again.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!temporaryDistractionResetBridge.includes('too_generic'));
assert.ok(!temporaryDistractionResetBridge.includes('no_progression'));

const exhaustionFoundHelpsBridge = detectCoachTurnIssues({
    coachText: "i totally get that feeling when your brain just won't switch off. is there anything you've found that helps even a little bit when your mind is racing like that?",
    leadText: "Haha, totally! It's mostly the puppy. And then when he's asleep, my brain just won't switch off. What about you, do you have any pets?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!exhaustionFoundHelpsBridge.includes('too_generic'));
assert.ok(!exhaustionFoundHelpsBridge.includes('no_progression'));

const busyDayReciprocalBridge = detectCoachTurnIssues({
    coachText: "pretty standard here, weird app bug and trying to get a walk in before rain. does your busy mean heads down on one thing, or juggling a bunch of bits?",
    leadText: "Work's fine, busy as ever. How's your day?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!busyDayReciprocalBridge.includes('too_generic'));
assert.ok(!busyDayReciprocalBridge.includes('no_progression'));

const reciprocalMusicArtistLoop = detectCoachTurnIssues({
    coachText: "oh nice! i definitely lean into instrumental electronic stuff too, especially for focus when i'm working or training. keeps things moving without distracting me. any artists you're really digging right now?",
    leadText: "No problem, really do enjoy your stuff! I'm pretty eclectic, depends on my mood. Lately, lots of indie folk and some chill electronic. What about you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(reciprocalMusicArtistLoop.includes('too_generic'));
assert.ok(reciprocalMusicArtistLoop.includes('no_progression'));

const reciprocalMusicResetBridge = detectCoachTurnIssues({
    coachText: "i'm usually into stuff i can work or train to. do you use chill electronic more for runs, focus, or switching off?",
    leadText: "No problem, really do enjoy your stuff! I'm pretty eclectic, depends on my mood. Lately, lots of indie folk and some chill electronic. What about you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!reciprocalMusicResetBridge.includes('too_generic'));
assert.ok(!reciprocalMusicResetBridge.includes('no_progression'));

const reciprocalRunObstacleLoop = detectCoachTurnIssues({
    coachText: "i try to get a couple of runs in each week myself, usually when i need a bit of a reset from app chaos. what usually gets in the way of those runs for you?",
    leadText: "Not as often as I'd like, honestly! Trying to be more consistent though. How about you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(reciprocalRunObstacleLoop.includes('too_generic'));
assert.ok(reciprocalRunObstacleLoop.includes('no_progression'));

const reciprocalRunConsistencyBridge = detectCoachTurnIssues({
    coachText: "i use runs as a reset from app chaos more than anything. for you, is the consistency thing more time, energy, or motivation after work?",
    leadText: "Not as often as I'd like, honestly! Trying to be more consistent though. How about you?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!reciprocalRunConsistencyBridge.includes('too_generic'));
assert.ok(!reciprocalRunConsistencyBridge.includes('no_progression'));

const busyDayClosedWish = detectCoachTurnIssues({
    coachText: 'yeah some days are just like that. hope you can chill a bit later',
    leadText: 'Doing okay, busy day.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(busyDayClosedWish.includes('too_generic'));
assert.ok(busyDayClosedWish.includes('no_progression'));

const busyDayEasyHook = detectCoachTurnIssues({
    coachText: 'yeah, those days can be a lot. busy with work/study, or just life admin stacking up?',
    leadText: 'Doing okay, busy day.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!busyDayEasyHook.includes('too_generic'));
assert.ok(!busyDayEasyHook.includes('no_progression'));

const veganFoodEnjoyment = detectCoachTurnIssues({
    coachText: "haha that's awesome. was it a fully vegan spot, or just a place with surprisingly good options?",
    leadText: "Just tried that new vegan spot. Wow! Didn't expect to actually enjoy the 'chicken' nuggets.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!veganFoodEnjoyment.includes('too_generic'));
assert.ok(!veganFoodEnjoyment.includes('no_progression'));

const mentalNoiseValidationLoop = detectCoachTurnIssues({
    coachText: "yeah exactly, that constant background noise is so real. app stuff keeps my brain trying to solve things into the night too.",
    leadText: "Yeah, exactly. It's like my brain just can't settle down, even for a few minutes. Always something running in the background.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(mentalNoiseValidationLoop.includes('too_generic'));
assert.ok(mentalNoiseValidationLoop.includes('no_progression'));

const mentalNoiseResetBridge = detectCoachTurnIssues({
    coachText: "that constant background noise is draining. does anything actually help your brain settle, even a walk, a brain dump, or proper quiet?",
    leadText: "Yeah, exactly. It's like my brain just can't settle down, even for a few minutes. Always something running in the background.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!mentalNoiseResetBridge.includes('too_generic'));
assert.ok(!mentalNoiseResetBridge.includes('no_progression'));

const fluHopeOnly = detectCoachTurnIssues({
    coachText: "ugh, that lingering drained feeling is the worst. hope you're managing to properly rest up and not have to push through too much.",
    leadText: "Just a long recovery from a flu. Drains you completely.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(fluHopeOnly.includes('no_progression'));

const fluRecoveryBridge = detectCoachTurnIssues({
    coachText: "flu recovery can wipe you out. what's making proper rest hardest right now, work, family, or just not being able to switch off?",
    leadText: "Just a long recovery from a flu. Drains you completely.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!fluRecoveryBridge.includes('no_progression'));

const backPainDayBridge = detectCoachTurnIssues({
    coachText: "chronic lower back pain for years sounds rough. how does that usually affect your day when it's really acting up?",
    leadText: "It's chronic lower back pain, been a struggle for years. Makes it hard to do much, even stand for too long.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!backPainDayBridge.includes('too_generic'));
assert.ok(!backPainDayBridge.includes('no_progression'));

const familyRestHardBridge = detectCoachTurnIssues({
    coachText: "yeah it really is the hardest part when everything still wants your attention. what usually gets put on the back burner first when you're running on empty like that?",
    leadText: "Trying. But work and family commitments make proper rest hard. Thanks for understanding.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!familyRestHardBridge.includes('too_generic'));
assert.ok(!familyRestHardBridge.includes('no_progression'));

const acuteFamilySupport = detectCoachTurnIssues({
    coachText: "oh man, that sounds really tough. no need to rush replies or anything, just wanted to say i'm thinking of you.",
    leadText: "Thanks for checking in. Rough family thing. Feeling drained, overwhelmed by everything.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!acuteFamilySupport.includes('too_generic'));
assert.ok(!acuteFamilySupport.includes('no_progression'));

const capacityKneeOnly = detectCoachTurnIssues({
    coachText: "especially when the knee starts acting up too. is it usually after training or just generally a bit niggly?",
    leadText: "Juggling a lot, energy low, knee acting up. Not sure I have the time.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(capacityKneeOnly.includes('too_generic'));
assert.ok(capacityKneeOnly.includes('no_progression'));

const capacityBridge = detectCoachTurnIssues({
    coachText: "that is a lot at once. is time, energy, or the knee the loudest blocker right now?",
    leadText: "Juggling a lot, energy low, knee acting up. Not sure I have the time.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!capacityBridge.includes('too_generic'));
assert.ok(!capacityBridge.includes('no_progression'));

const timeSinkSpecificQuestion = detectCoachTurnIssues({
    coachText: "yeah, that feeling of knowing what to do but having no space for it is a special kind of frustrating. what's usually the first thing that eats up the hours?",
    leadText: "Honestly, it's just super frustrating. I know what I need to do for myself, but there's literally no time. End up feeling sluggish and just... not my best. It's a constant battle.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!timeSinkSpecificQuestion.includes('too_generic'));
assert.ok(!timeSinkSpecificQuestion.includes('no_progression'));

const foodAfterthoughtCityLoop = detectCoachTurnIssues({
    coachText: "yeah that makes total sense. do you usually find your routine settles down a bit once you're in the new city?",
    leadText: "Oh, definitely my job! It's super demanding right now and I get so focused, food just becomes an afterthought. Like, there's no time to stop. Plus, I'm trying to wrap things up before I move back to the city soon.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(foodAfterthoughtCityLoop.includes('too_generic'));
assert.ok(foodAfterthoughtCityLoop.includes('no_progression'));

const foodAfterthoughtAnchor = detectCoachTurnIssues({
    coachText: "that sounds like you need a no-thinking food backup before the dizzy crash, not a perfect routine. what tiny snack or bowl could live at work on the demanding days?",
    leadText: "Oh, definitely my job! It's super demanding right now and I get so focused, food just becomes an afterthought. Like, there's no time to stop. Plus, I'm trying to wrap things up before I move back to the city soon.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!foodAfterthoughtAnchor.includes('too_generic'));
assert.ok(!foodAfterthoughtAnchor.includes('no_progression'));

const broadTimeLoop = detectCoachTurnIssues({
    coachText: "ugh, yeah that makes total sense. what sort of things usually eat up your hours?",
    leadText: "Ugh, everything! Just never enough hours in the day tbh",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(broadTimeLoop.includes('too_generic'));
assert.ok(broadTimeLoop.includes('no_progression'));

const broadTimeBridge = detectCoachTurnIssues({
    coachText: "yeah, when it feels like never enough hours, the trick is usually making the next step almost no-thinking. what's the smallest thing you could fit on a chaotic day?",
    leadText: "Ugh, everything! Just never enough hours in the day tbh",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!broadTimeBridge.includes('too_generic'));
assert.ok(!broadTimeBridge.includes('no_progression'));

const noEnergyLoop = detectCoachTurnIssues({
    coachText: "yeah that sounds absolutely brutal. those coding challenges alone would be so intense. must be hard to find any headspace for training after all that.",
    leadText: "Endless interviews and coding challenges, honestly. Just no energy left for anything else.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(noEnergyLoop.includes('no_progression'));

const noEnergyTinyBridge = detectCoachTurnIssues({
    coachText: "that sounds like a brain-fried week, not a motivation problem. would a 10-minute no-thinking reset be the easiest thing to protect on interview days?",
    leadText: "Endless interviews and coding challenges, honestly. Just no energy left for anything else.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!noEnergyTinyBridge.includes('too_generic'));
assert.ok(!noEnergyTinyBridge.includes('no_progression'));

const personalProjectExcitementMiss = detectCoachTurnIssues({
    coachText: "yeah that never-ending list feeling is so real. is there one of those personal projects you're most excited about right now?",
    leadText: "Ugh, just a never-ending list! Work stuff, errands, trying to squeeze in some personal projects before they totally fall apart! It's always something, right?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(personalProjectExcitementMiss.includes('too_generic'));
assert.ok(personalProjectExcitementMiss.includes('no_progression'));

const personalProjectTinyBridge = detectCoachTurnIssues({
    coachText: "that sounds like the week needs a tiny protected pocket, not another task. would 10 minutes of no-thinking reset time help keep one project alive?",
    leadText: "Ugh, just a never-ending list! Work stuff, errands, trying to squeeze in some personal projects before they totally fall apart! It's always something, right?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!personalProjectTinyBridge.includes('too_generic'));
assert.ok(!personalProjectTinyBridge.includes('no_progression'));

const swampedWorkGeneric = detectCoachTurnIssues({
    coachText: "ah that makes sense with the apartment, and work makes it tough too. what kind of work keeps you so busy?",
    leadText: "Not right now, unfortunately! I'd love to, but my apartment isn't really dog-friendly, and I'm honestly so swamped with work these days. Maybe in the future!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(swampedWorkGeneric.includes('too_generic'));
assert.ok(swampedWorkGeneric.includes('no_progression'));

const swampedWorkCapacityBridge = detectCoachTurnIssues({
    coachText: "yeah, that sounds like a one-day dog dream, not a right-now capacity thing. does work leave you much switch-off time at the moment?",
    leadText: "Not right now, unfortunately! I'd love to, but my apartment isn't really dog-friendly, and I'm honestly so swamped with work these days. Maybe in the future!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!swampedWorkCapacityBridge.includes('too_generic'));
assert.ok(!swampedWorkCapacityBridge.includes('no_progression'));

const simpleSustainableHistoryLoop = detectCoachTurnIssues({
    coachText: "yeah, that makes total sense. what kind of routines have you tried in the past that ended up feeling like another full-time job?",
    leadText: "Honestly, just something simple and sustainable that doesn't feel like another full-time job. I need practical, quick things I can actually stick to, not another complicated routine I'll abandon because I have no time.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(simpleSustainableHistoryLoop.includes('too_generic'));
assert.ok(simpleSustainableHistoryLoop.includes('no_progression'));

const simpleSustainableMinimumBridge = detectCoachTurnIssues({
    coachText: "that points to a no-thinking minimum, not a bigger routine. would a 10 minute fallback on busy days feel more realistic than a full plan?",
    leadText: "Honestly, just something simple and sustainable that doesn't feel like another full-time job. I need practical, quick things I can actually stick to, not another complicated routine I'll abandon because I have no time.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!simpleSustainableMinimumBridge.includes('too_generic'));
assert.ok(!simpleSustainableMinimumBridge.includes('no_progression'));

const overloadedMovementLoop = detectCoachTurnIssues({
    coachText: "it sounds like you've tried to get consistent with movement before too. what usually makes it tough to stick with those things once you start?",
    leadText: "Workouts, it's usually just any consistent movement, honestly. I've tried different things, but finding the time and energy is tough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(overloadedMovementLoop.includes('too_generic'));
assert.ok(overloadedMovementLoop.includes('no_progression'));

const overloadedMovementBridge = detectCoachTurnIssues({
    coachText: "that makes sense. if movement had to be a 5 minute floor instead of a workout, would a walk, stretch, or one home set be the easiest to survive a nursing week?",
    leadText: "Workouts, it's usually just any consistent movement, honestly. I've tried different things, but finding the time and energy is tough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!overloadedMovementBridge.includes('too_generic'));
assert.ok(!overloadedMovementBridge.includes('no_progression'));

const longHoursAttemptLoop = detectCoachTurnIssues({
    coachText: "yeah, that's a tough combo, constantly rushing and then feeling like your efforts fall apart. what usually makes those attempts feel like a joke for you?",
    leadText: "Just work, mostly. Long hours, always something else popping up. Trying to squeeze in gym time feels like I'm constantly rushing. My attempts usually end up being a joke.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(longHoursAttemptLoop.includes('too_generic'));
assert.ok(longHoursAttemptLoop.includes('no_progression'));

const longHoursTinyBridge = detectCoachTurnIssues({
    coachText: "that rushing loop is rough. would a tiny no-thinking version that fits long work days be easier than trying to restart perfectly?",
    leadText: "Just work, mostly. Long hours, always something else popping up. Trying to squeeze in gym time feels like I'm constantly rushing. My attempts usually end up being a joke.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!longHoursTinyBridge.includes('too_generic'));
assert.ok(!longHoursTinyBridge.includes('no_progression'));

const lostPastFitnessLoop = detectCoachTurnIssues({
    coachText: "that sounds like such a powerful feeling. what usually ends up getting in the way when you think about trying to get back to it?",
    leadText: "Oh, it felt amazing. So much energy, clear head, just felt strong and capable. Like I could tackle anything. It's hard to even remember that feeling now.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(lostPastFitnessLoop.includes('too_generic'));
assert.ok(lostPastFitnessLoop.includes('no_progression'));

const lostPastFitnessBridge = detectCoachTurnIssues({
    coachText: "that clear-head, strong feeling sounds like the bit worth protecting. which tiny piece would you want back first: energy, feeling strong, or a bit of spontaneity?",
    leadText: "Oh, it felt amazing. So much energy, clear head, just felt strong and capable. Like I could tackle anything. It's hard to even remember that feeling now.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!lostPastFitnessBridge.includes('too_generic'));
assert.ok(!lostPastFitnessBridge.includes('no_progression'));

const simplePlanValidationLoop = detectCoachTurnIssues({
    coachText: "yeah, exactly. machines, full-body, and just getting in and out makes perfect sense. no one wants to spend half their workout trying to decipher a plan.",
    leadText: "Just something I can actually stick to. Machines, full-body, in and out. No crazy setups or deciphering obscure exercises.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(simplePlanValidationLoop.includes('validation_loop'));
assert.ok(simplePlanValidationLoop.includes('no_progression'));

const simplePlanProgression = detectCoachTurnIssues({
    coachText: "that points to a simple 3-day full-body machine template: one press, one pull, one leg press or hinge, then a core finisher. would M/W/F with the same exercise slots be easiest to stick to?",
    leadText: "Just something I can actually stick to. Machines, full-body, in and out. No crazy setups or deciphering obscure exercises.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!simplePlanProgression.includes('validation_loop'));
assert.ok(!simplePlanProgression.includes('no_progression'));

const veganThrivingHook = detectCoachTurnIssues({
    coachText: "yeah it's easy to dismiss it as just a diet when it's so much deeper. what does thriving look like for you in those demanding physical pursuits?",
    leadText: "Many assume it's purely a diet for health or trend, rather than a deep ethical stance rooted in animal liberation. They often underestimate the discipline and knowledge required to thrive, especially in demanding physical pursuits, without compromise on those values.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!veganThrivingHook.includes('missed_specific_hook'));

const veganProBasicQuestion = detectCoachTurnIssues({
    coachText: "i can definitely appreciate the discipline behind such meticulous planning, especially with a demanding schedule. that's seriously impressive.",
    leadText: "Ease isn't a factor. My focus is on elite performance and ethical alignment. Protein and variety are handled through meticulous planning around a very demanding schedule.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(veganProBasicQuestion.includes('missed_specific_hook'));
assert.ok(veganProBasicQuestion.includes('too_generic'));
assert.ok(veganProBasicQuestion.includes('no_progression'));

const veganProProcessQuestion = detectCoachTurnIssues({
    coachText: "respect that, if protein and variety are already handled, what is the hardest part of keeping elite performance and ethics aligned around such a demanding schedule?",
    leadText: "Ease isn't a factor. My focus is on elite performance and ethical alignment. Protein and variety are handled through meticulous planning around a very demanding schedule.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!veganProProcessQuestion.includes('missed_specific_hook'));
assert.ok(!veganProProcessQuestion.includes('too_generic'));
assert.ok(!veganProProcessQuestion.includes('no_progression'));

const familyMealPrematureInvite = detectCoachTurnIssues({
    coachText: "that struggle to keep things varied and healthy is exactly what our free 30-day plant-based challenge is built to help with. keen to hear a bit more about it?",
    leadText: "We've been plant-based for about two years now, and I still struggle to keep things varied and healthy for the kids.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(familyMealPrematureInvite.includes('premature_challenge_invite'));
assert.ok(familyMealPrematureInvite.includes('no_progression'));

const familyMealProgression = detectCoachTurnIssues({
    coachText: "that sounds like the rotation needs to get easier, not bigger. what are the two plant-based dinners the kids already accept most weeks?",
    leadText: "We've been plant-based for about two years now, and I still struggle to keep things varied and healthy for the kids.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!familyMealProgression.includes('premature_challenge_invite'));
assert.ok(!familyMealProgression.includes('no_progression'));

const plantFamilyTraditionRapport = detectCoachTurnIssues({
    coachText: "oh nice, love that it's a family tradition! what kind of plant-based dishes would you guys usually make? i grew up vegetarian too, so always appreciate a good family recipe.",
    leadText: "Oh, that looks delicious! My family always made something similar this time of year, lots of plant-based dishes.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!plantFamilyTraditionRapport.includes('no_progression'));

const familyApprovedMealQuestion = detectCoachTurnIssues({
    coachText: "one safe base meal is usually easier than trying to reinvent dinner. are there any meals that usually get approved by everyone, even when you want something quick?",
    leadText: "It's the effort of planning, shopping, and cooking after a full day. By dinner time I just want something quick and healthy options feel like more work. Plus, picky eaters at home don't help!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!familyApprovedMealQuestion.includes('too_generic'));
assert.ok(!familyApprovedMealQuestion.includes('no_progression'));

const familyBattleGoToOnly = detectCoachTurnIssues({
    coachText: "ugh, that's such a classic one. do you have any go-to meals that usually get approved, even if it's just a couple?",
    leadText: "Oh, you know, the usual what's for dinner arguments. Trying to make something healthy that everyone will actually eat is a constant battle, especially with picky kids.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(familyBattleGoToOnly.includes('too_generic'));
assert.ok(familyBattleGoToOnly.includes('no_progression'));

const familyBattleBaseMeal = detectCoachTurnIssues({
    coachText: "that sounds like the win is one repeatable base meal, not a whole new menu. is pasta, wraps, or a bean burger style fallback the safest starting point?",
    leadText: "Oh, you know, the usual what's for dinner arguments. Trying to make something healthy that everyone will actually eat is a constant battle, especially with picky kids.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!familyBattleBaseMeal.includes('too_generic'));
assert.ok(!familyBattleBaseMeal.includes('no_progression'));

const familyMealProjectOptions = detectCoachTurnIssues({
    coachText: "yeah i can see why that feels like a big project. is the recipe hunt the bit that makes it feel heavy, or the shopping/kids rejecting it?",
    leadText: "I'd love to expand it, definitely! But it feels like a big project sometimes. So much easier to just stick to what works, even if it gets a bit boring.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!familyMealProjectOptions.includes('too_many_questions'));

const studyFoodQuickMeals = detectCoachTurnIssues({
    coachText: "yeah that makes sense, especially having to figure out something your kid will actually eat too. what kind of quick meals usually save the day for you both?",
    leadText: "Totally. When I'm swamped with studies, healthy eating just goes out the window. It's easier to grab something quick or whatever my kid will actually eat. No energy for cooking after a long day.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!studyFoodQuickMeals.includes('too_generic'));
assert.ok(!studyFoodQuickMeals.includes('no_progression'));

const positiveSessionGenericNext = detectCoachTurnIssues({
    coachText: "awesome, so glad to hear that. what are you keen to work on next?",
    leadText: "First session was great, thanks!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(positiveSessionGenericNext.includes('no_progression'));

const positiveSessionSpecific = detectCoachTurnIssues({
    coachText: "love that. what made the first session feel good for you, the mental reset, the pace, or just getting it done?",
    leadText: "First session was great, thanks!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!positiveSessionSpecific.includes('no_progression'));

const workoutLifesaverDeadEnd = detectCoachTurnIssues({
    coachText: "that's huge though, i'm really glad they're giving you that break.",
    leadText: "Honestly, not much else right now! Just trying to squeeze in anything that helps. These workouts have been a lifesaver for that.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(workoutLifesaverDeadEnd.includes('no_progression'));

const workoutLifesaverBridge = detectCoachTurnIssues({
    coachText: "that's huge. what made the workout feel like a lifesaver, the mental reset or just having one pocket of time for yourself?",
    leadText: "Honestly, not much else right now! Just trying to squeeze in anything that helps. These workouts have been a lifesaver for that.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!workoutLifesaverBridge.includes('no_progression'));

const casualTrainingDeadEnd = detectCoachTurnIssues({
    coachText: "warzone with the boys sounds like a perfect way to switch off after a good chest day",
    leadText: "For sure, brain needs a break sometimes. Just gonna hop on Warzone later with the boys. Always good to switch off.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(casualTrainingDeadEnd.includes('no_progression'));

const casualTrainingProgression = detectCoachTurnIssues({
    coachText: "fair recovery plan. are you just enjoying the chest pump at the moment, or chasing a bit more upper chest progress next?",
    leadText: "For sure, brain needs a break sometimes. Just gonna hop on Warzone later with the boys. Always good to switch off.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!casualTrainingProgression.includes('no_progression'));

const musicGenericBandQuestion = detectCoachTurnIssues({
    coachText: "oh yeah, proper indie rock and psych-rock, i totally get that vibe. any bands in particular you've been listening to lately?",
    leadText: "Honestly, anything with actual substance, not just recycled beats. Proper indie rock, old-school hip hop, or a killer psych-rock band. Stuff that actually takes effort, y'know? This new album just feels so manufactured.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(musicGenericBandQuestion.includes('no_progression'));

const musicSubstanceBridge = detectCoachTurnIssues({
    coachText: "yeah, you can feel when something has actual effort behind it. what's the last album that felt like it had real substance instead of that manufactured thing?",
    leadText: "Honestly, anything with actual substance, not just recycled beats. Proper indie rock, old-school hip hop, or a killer psych-rock band. Stuff that actually takes effort, y'know? This new album just feels so manufactured.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!musicSubstanceBridge.includes('no_progression'));

const musicIndependentDiscoveryLoop = detectCoachTurnIssues({
    coachText: "love that you trust your own ears first. so if you're not going by critics, how do you usually stumble on new artists or sounds that resonate?",
    leadText: "Honestly? I mostly just listen and decide for myself. Don't really 'trust' anyone else's take, especially not most of these so-called critics chasing trends. My ears are good enough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(musicIndependentDiscoveryLoop.includes('no_progression'));

const musicIndependentTrainingBridge = detectCoachTurnIssues({
    coachText: "love that you trust your own ears first. are you like that with training too, needing to feel what actually works for your own body before you buy into it?",
    leadText: "Honestly? I mostly just listen and decide for myself. Don't really 'trust' anyone else's take, especially not most of these so-called critics chasing trends. My ears are good enough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!musicIndependentTrainingBridge.includes('no_progression'));

const danceScheduleRhythmBridge = detectCoachTurnIssues({
    coachText: "yeah that's a tough juggle with fixed dance classes, lifting, work, and rest. when you do manage to get a consistent rhythm, what usually makes that possible?",
    leadText: "Honestly, it's probably the scheduling. My dance classes are fixed, and then trying to squeeze in lifting, work, and actual rest... it feels impossible to get a consistent rhythm. And then I worry I'm not doing enough, or the right things, so I just stay 'stuck'.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!danceScheduleRhythmBridge.includes('too_generic'));
assert.ok(!danceScheduleRhythmBridge.includes('no_progression'));

const recoveryRhythmValidationLoop = detectCoachTurnIssues({
    coachText: "yeah that makes total sense. it's such a pain when that rhythm gets thrown off, makes everything feel a bit more uphill.",
    leadText: "Oh yeah, big time. My next session feels harder, and recovery definitely takes longer. It really throws off my rhythm.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(recoveryRhythmValidationLoop.includes('too_generic'));
assert.ok(recoveryRhythmValidationLoop.includes('no_progression'));

const recoveryRhythmBridge = detectCoachTurnIssues({
    coachText: "yeah, that rhythm matters. which recovery piece slips first when life gets in the way, the stretch, food, or sleep?",
    leadText: "Oh yeah, big time. My next session feels harder, and recovery definitely takes longer. It really throws off my rhythm.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!recoveryRhythmBridge.includes('too_generic'));
assert.ok(!recoveryRhythmBridge.includes('no_progression'));

const recoveryRoutineVagueDifference = detectCoachTurnIssues({
    coachText: "that's solid, smart to have that routine locked in. do you notice a big difference when you can't stick to it?",
    leadText: "Usually foam rolling, maybe some light stretching, and then making sure I get enough protein. Stick to a pretty consistent routine.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(recoveryRoutineVagueDifference.includes('no_progression'));

const recoveryRoutineSpecificLever = detectCoachTurnIssues({
    coachText: "that's a solid recovery routine. which bit makes the biggest difference to the next session, foam rolling, stretching, or protein?",
    leadText: "Usually foam rolling, maybe some light stretching, and then making sure I get enough protein. Stick to a pretty consistent routine.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!recoveryRoutineSpecificLever.includes('no_progression'));

const sparringDeadEnd = detectCoachTurnIssues({
    coachText: "haha yeah it gets pretty wild sometimes. always a good way to finish the week though",
    leadText: "Yo, that sparring looks sick!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(sparringDeadEnd.includes('no_progression'));

const sparringProgression = detectCoachTurnIssues({
    coachText: "haha yeah it gets wild, heart rate goes through the roof. have you done much sparring or muay thai yourself?",
    leadText: "Yo, that sparring looks sick!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!sparringProgression.includes('no_progression'));

const selfSufficientInventoryQuestion = detectCoachTurnIssues({
    coachText: "love that. when it clicks and you enjoy the process, it's such a game changer. what kind of training do you usually gravitate towards?",
    leadText: "I just genuinely enjoy it, so it doesn't feel like a chore. Plus, seeing progress keeps me motivated.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(selfSufficientInventoryQuestion.includes('too_generic'));
assert.ok(selfSufficientInventoryQuestion.includes('no_progression'));

const hypermobilityOriginQuestion = detectCoachTurnIssues({
    coachText: "that's great you've found what works for you. managing hypermobility like that with a solid routine sounds really smart. did you figure out that routine over time yourself or did someone help you with it?",
    leadText: "Honestly, just sticking to my usual routine. Lots of squats, mobility work, and making sure I don't sit too long. It really helps with my hypermobility and just feeling strong.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(hypermobilityOriginQuestion.includes('too_generic'));
assert.ok(hypermobilityOriginQuestion.includes('no_progression'));

const hypermobilityCurrentBridge = detectCoachTurnIssues({
    coachText: "that's smart, especially with hypermobility. what feels most non-negotiable for staying strong and pain-free, the squats, mobility, or not sitting too long?",
    leadText: "Honestly, just sticking to my usual routine. Lots of squats, mobility work, and making sure I don't sit too long. It really helps with my hypermobility and just feeling strong.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!hypermobilityCurrentBridge.includes('too_generic'));
assert.ok(!hypermobilityCurrentBridge.includes('no_progression'));

const hypermobilityBusyRoutineGeneric = detectCoachTurnIssues({
    coachText: "it's really smart to lean into simple and consistent when things are busy. what's one thing you make sure to keep in your routine no matter how crazy things get?",
    leadText: "Yeah, it can be a lot sometimes. But it's just how it is with hypermobility, I guess. I just try to keep things simple and consistent, which works for me. Pretty busy lately, so I just focus on what I know.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(hypermobilityBusyRoutineGeneric.includes('too_generic'));
assert.ok(hypermobilityBusyRoutineGeneric.includes('no_progression'));

const hypermobilityBusyStabilityBridge = detectCoachTurnIssues({
    coachText: "that makes sense with hypermobility. on the busiest weeks, what's the stability piece you protect first so things stay pain-free?",
    leadText: "Yeah, it can be a lot sometimes. But it's just how it is with hypermobility, I guess. I just try to keep things simple and consistent, which works for me. Pretty busy lately, so I just focus on what I know.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!hypermobilityBusyStabilityBridge.includes('too_generic'));
assert.ok(!hypermobilityBusyStabilityBridge.includes('no_progression'));

const selfSufficientNextEdgeQuestion = detectCoachTurnIssues({
    coachText: "love that. when training already feels good, what's the next bit of progress you're chasing?",
    leadText: "I just genuinely enjoy it, so it doesn't feel like a chore. Plus, seeing progress keeps me motivated.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!selfSufficientNextEdgeQuestion.includes('too_generic'));
assert.ok(!selfSufficientNextEdgeQuestion.includes('no_progression'));

const politeHopeClosing = detectCoachTurnIssues({
    coachText: "haha chaotic but fun is a fair summary. hope the market keeps buzzing for you!",
    leadText: "Thanks for getting it! Appreciate you reaching out! Hope you're having a good one too!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!politeHopeClosing.includes('too_generic'));
assert.ok(!politeHopeClosing.includes('no_progression'));

const ignoredAdvice = detectCoachTurnIssues({
    coachText: 'is that tricky balance something you have run into before?',
    leadText: 'Any general tips for knowing when to scale back before I overdo it?',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(ignoredAdvice.includes('ignored_direct_question'));

const answeredAdvice = detectCoachTurnIssues({
    coachText: 'yeah, good rule of thumb is to leave one or two reps in the tank, then see how you feel the next day. is it mainly shoulders that flare up?',
    leadText: 'Any general tips for knowing when to scale back before I overdo it?',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!answeredAdvice.includes('ignored_direct_question'));

const mealIdeasInviteBeforeAnswer = detectCoachTurnIssues({
    coachText: "honestly, that's exactly why i put together the 30-day plant-based challenge. want me to send you the details?",
    leadText: "Oh really? I'd love to hear some of your go-to minimal effort meals! I'm always looking for new ideas, especially when my energy is super low.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(mealIdeasInviteBeforeAnswer.includes('ignored_direct_question'));
assert.ok(mealIdeasInviteBeforeAnswer.includes('premature_challenge_invite'));

const mealIdeasAnswered = detectCoachTurnIssues({
    coachText: "for sure. two easy ones: one-pot pasta with canned tomatoes, spinach, and cannellini beans, or ramen with frozen veg and tofu thrown in. proper meal, barely any work.",
    leadText: "Oh really? I'd love to hear some of your go-to minimal effort meals! I'm always looking for new ideas, especially when my energy is super low.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!mealIdeasAnswered.includes('ignored_direct_question'));
assert.ok(!mealIdeasAnswered.includes('premature_challenge_invite'));

const indirectAdviceMention = detectCoachTurnIssues({
    coachText: "sounds like you're looking for something that cuts through the noise and fits into a busy life. is that right?",
    leadText: "Sometimes I feel overwhelmed by all the different advice online, and trying to figure out if I'm combining my workouts right.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!indirectAdviceMention.includes('ignored_direct_question'));

const plateauTakeDodged = detectCoachTurnIssues({
    coachText: 'yeah, there are definitely a few angles to look at. what specific lifts are feeling stuck for you right now?',
    leadText: "Mostly just different ways to approach my current lifts, or maybe some tweaks to rep ranges. What's your take on pushing past plateaus in leg strength?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(plateauTakeDodged.includes('ignored_direct_question'));
assert.ok(plateauTakeDodged.includes('no_progression'));

const plateauTakeAnswered = detectCoachTurnIssues({
    coachText: 'one angle is changing the stimulus before adding more weight: tempo reps, pauses, or a few heavy doubles paired with higher-rep accessories can expose the sticking point. which lift is stalling most?',
    leadText: "Mostly just different ways to approach my current lifts, or maybe some tweaks to rep ranges. What's your take on pushing past plateaus in leg strength?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!plateauTakeAnswered.includes('ignored_direct_question'));
assert.ok(!plateauTakeAnswered.includes('no_progression'));

const ignoredCue = detectCoachTurnIssues({
    coachText: "when you try to push through your heels, what does that actually feel like in your glutes or hamstrings?",
    leadText: "I can't connect my brain to my glutes for deadlifts. Any tricks for that mind-muscle connection?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(ignoredCue.includes('ignored_direct_question'));

const answeredCue = detectCoachTurnIssues({
    coachText: "try a light hip hinge wall tap first: push your hips back until you feel hamstrings, pause there, then use that same feeling on the first rep. if it still hits low back, film one side angle set.",
    leadText: "I can't connect my brain to my glutes for deadlifts. Any tricks for that mind-muscle connection?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!answeredCue.includes('ignored_direct_question'));

const answeredRdlCue = detectCoachTurnIssues({
    coachText: "the key is often pushing your hips back first, rather than just bending forward. think about reaching your butt back to touch a wall behind you and really feel that stretch in the hamstrings and glutes on the way down. what does it feel like when you do them now, if not in the glutes?",
    leadText: "Sometimes it's hard to tell if I'm even doing RDLs right to feel it in my glutes properly. Any tips on really feeling that stretch in the right spot?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!answeredRdlCue.includes('ignored_direct_question'));

const answeredDepthCue = detectCoachTurnIssues({
    coachText: "yeah that lower back feeling is common. going too low can take tension off the glutes if your lower back rounds. the sweet spot is just before that, then try stopping there and pushing the floor away as you drive your hips forward.",
    leadText: "Okay, the cue makes sense. Usually, I feel it mostly in my lower back or hamstrings. I've also heard not to go too low. Does that affect how much you feel it in the glutes?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!answeredDepthCue.includes('too_generic'));
assert.ok(!answeredDepthCue.includes('no_progression'));

const procedureRecoveryValidationLoop = detectCoachTurnIssues({
    coachText: "yeah that's the tricky part, when it's hard to trust what feels okay. what kind of movements do you usually enjoy, or feel like you're missing out on right now?",
    leadText: "I try to stick to lighter weights or machines, but honestly, it's hard to tell what's totally safe without putting pressure on it. Just worried about messing up my recovery after a recent procedure.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(procedureRecoveryValidationLoop.includes('validation_loop'));
assert.ok(procedureRecoveryValidationLoop.includes('no_progression'));

const procedureRecoverySafetyBridge = detectCoachTurnIssues({
    coachText: "with a recent procedure, i'd keep this conservative and clinician-cleared: pain-free range, lower load, machines if cleared, and stop if anything gets sharp or worse. what movements have you actually been cleared for?",
    leadText: "I try to stick to lighter weights or machines, but honestly, it's hard to tell what's totally safe without putting pressure on it. Just worried about messing up my recovery after a recent procedure.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!procedureRecoverySafetyBridge.includes('validation_loop'));
assert.ok(!procedureRecoverySafetyBridge.includes('no_progression'));

const bracingDiagnosticLoop = detectCoachTurnIssues({
    coachText: "that's common with bracing. when you try to brace, what does it feel like for you?",
    leadText: "Sometimes I think about bracing my core, but I'm not always sure I'm doing it right or if it's enough to feel truly stable.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(bracingDiagnosticLoop.includes('ignored_direct_question'));
assert.ok(bracingDiagnosticLoop.includes('no_progression'));

const bracingCueAnswer = detectCoachTurnIssues({
    coachText: "think 360 brace, like gently coughing before the rep: ribs down, breathe into the sides and back, then keep that pressure without just pulling your belly button in.",
    leadText: "Sometimes I think about bracing my core, but I'm not always sure I'm doing it right or if it's enough to feel truly stable.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!bracingCueAnswer.includes('ignored_direct_question'));
assert.ok(!bracingCueAnswer.includes('no_progression'));

const appWipedDataQuestion = detectCoachTurnIssues({
    coachText: "ugh that's so frustrating. having to re-enter everything is such a pain. do you usually track your workouts in an app or just that one for specific programs?",
    leadText: "Nah, it saved like half of it but then wiped the rest when I tried to restart it. So annoying having to remember everything and manually re-enter.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!appWipedDataQuestion.includes('no_progression'));

const deadliftDiagnosticLoop = detectCoachTurnIssues({
    coachText: "totally get that, those are the common ones that pop up with deadlifts. what do you reckon is the trickiest part about locking it all in?",
    leadText: "It's usually my lower back rounding first, especially when I try to pull heavier. Sometimes my hips shoot up a bit too fast too. Feels like I just can't keep everything tight.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(deadliftDiagnosticLoop.includes('too_generic'));
assert.ok(deadliftDiagnosticLoop.includes('no_progression'));

const deadliftCueBridge = detectCoachTurnIssues({
    coachText: "i'd drop the load until you can own the brace first: 360 brace before the pull, lats tight like you're squeezing your armpits, then push the floor away. does the rounding happen right off the floor or later in the pull?",
    leadText: "It's usually my lower back rounding first, especially when I try to pull heavier. Sometimes my hips shoot up a bit too fast too. Feels like I just can't keep everything tight.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!deadliftCueBridge.includes('too_generic'));
assert.ok(!deadliftCueBridge.includes('no_progression'));

const softMidsectionLoop = detectCoachTurnIssues({
    coachText: "that soft midsection feeling is really common. what does it actually feel like when you're under load?",
    leadText: "Thanks for the bracing tips. It feels like a disconnect, like I know I should be bracing, but when I try to pull, it just feels soft in my midsection. Applying it during a heavy lift is tough.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(softMidsectionLoop.includes('ignored_direct_question'));
assert.ok(softMidsectionLoop.includes('no_progression'));

const programExplanationMiss = detectCoachTurnIssues({
    coachText: "it's not just another program, it's designed to break through that stuck feeling. want me to send you the link for the free 30-day challenge?",
    leadText: "Is it actually intense, or just another program? I need a serious kick in the ass. What's the real deal?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(programExplanationMiss.includes('ignored_direct_question'));
assert.ok(programExplanationMiss.includes('premature_challenge_invite'));

const programExplanationAnswer = detectCoachTurnIssues({
    coachText: "the real difference is the structure: progressive overload, planned deloads, and RPE so you can adjust if a lift stalls instead of just adding random intensity. it is not full 1:1 customization, but it gives you a framework to work through sticking points.",
    leadText: "Is it actually intense, or just another program? I need a serious kick in the ass. What's the real deal?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!programExplanationAnswer.includes('ignored_direct_question'));

const plateauLead = "I've tried adding more volume, reducing volume, different rep ranges, more accessory work for quads and glutes. Even deloaded and built back up. Nothing seems to make a difference.";
const plateauInvite = detectCoachTurnIssues({
    coachText: "given you've tried so much already and nothing's shifting, would you be keen to try my free 30-day challenge to shake things up?",
    leadText: plateauLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(plateauInvite.includes('premature_challenge_invite'));
assert.ok(plateauInvite.includes('missed_specific_hook'));
assert.ok(plateauInvite.includes('no_progression'));

const plateauProbe = detectCoachTurnIssues({
    coachText: "yeah that's maddening after trying all of that. i'd look at where the rep actually stalls first, out of the hole or halfway up, because that changes the next tweak. where does it usually break down?",
    leadText: plateauLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!plateauProbe.includes('missed_specific_hook'));

const trainerPlateauInvite = detectCoachTurnIssues({
    coachText: "yeah that good enough but still stuck feeling is exactly why the free 30-day challenge exists. want me to send you the details?",
    leadText: "I try to be consistent. I track macros loosely, aim for enough protein, and usually get 7-8 hours sleep. My trainer reviews it too, but we haven't found a clear issue there either. It just feels like everything is 'good enough' but nothing's changing.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(trainerPlateauInvite.includes('possible_premature_challenge_invite'));

const trainerPlateauDiagnostic = detectCoachTurnIssues({
    coachText: "that 'good enough but nothing's changing' spot is where i'd look for a hidden pattern, like RPE creeping too high or fatigue masking progress. are your top sets stalling at the same point each week?",
    leadText: "I try to be consistent. I track macros loosely, aim for enough protein, and usually get 7-8 hours sleep. My trainer reviews it too, but we haven't found a clear issue there either. It just feels like everything is 'good enough' but nothing's changing.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!trainerPlateauDiagnostic.includes('possible_premature_challenge_invite'));
assert.ok(!trainerPlateauDiagnostic.includes('no_progression'));

const localTrainerInvite = detectCoachTurnIssues({
    coachText: "no, that's online 1:1 coaching. it's designed to give you that push wherever you are. still want me to send you the details?",
    leadText: 'Is that in-person coaching?',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(localTrainerInvite.includes('premature_challenge_invite'));
assert.ok(localTrainerInvite.includes('missed_specific_hook'));

const localTrainerPreferenceHandled = detectCoachTurnIssues({
    coachText: "mine is online 1:1 coaching, so if you're only wanting in-person i totally get that. would online check-ins still be useful or are you set on local?",
    leadText: 'Is that in-person coaching?',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!localTrainerPreferenceHandled.includes('premature_challenge_invite'));
assert.ok(!localTrainerPreferenceHandled.includes('missed_specific_hook'));

const aiMirror = detectCoachTurnIssues({
    coachText: "haha yeah, broken AI is a pretty solid burn",
    leadText: "it sounds like it was generated by a broken AI",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(aiMirror.includes('ai_disclosure_risk'));

const plantExpertLead = "Honestly, hitting macros plant-based isn't hard once you get the hang of it. Did you track micronutrients when you tried it?";
const plantExpertMiss = detectCoachTurnIssues({
    coachText: "to be honest, i mostly focused on macros back then, so micros weren't something i was tracking as closely. i probably just assumed i was getting enough.",
    leadText: plantExpertLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(plantExpertMiss.includes('missed_specific_hook'));
assert.ok(plantExpertMiss.includes('no_progression'));

const plantExpertBridge = detectCoachTurnIssues({
    coachText: "not properly back then, i was more macro-focused. what micros do you pay closest attention to now with training?",
    leadText: plantExpertLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!plantExpertBridge.includes('missed_specific_hook'));

const veganEthicsChallengeLead = "What made you settle back into vegetarianism after trying to go fully plant-based, especially with animal welfare in mind?";
const veganEthicsMiss = detectCoachTurnIssues({
    coachText: "it came down to finding what felt personally sustainable long-term without feeling too restrictive. vegetarianism still aligns with animal welfare but fits my day-to-day better.",
    leadText: veganEthicsChallengeLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(veganEthicsMiss.includes('missed_specific_hook'));
assert.ok(veganEthicsMiss.includes('no_progression'));

const veganEthicsBridge = detectCoachTurnIssues({
    coachText: "honestly, it was me falling back into what felt sustainable, but i know that is not a clean answer from an animal welfare lens. what feels hardest to carry now, the advocacy burnout or the social side?",
    leadText: veganEthicsChallengeLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!veganEthicsBridge.includes('missed_specific_hook'));
assert.ok(!veganEthicsBridge.includes('no_progression'));

const ethicalTrivialized = detectCoachTurnIssues({
    coachText: 'with that kind of commitment, what helps you make it easy to stay on track, especially with training or busy days?',
    leadText: "It's not just a belief, it's how I operate daily. Few truly understand the implications of structuring everything around that kind of non-negotiable ethical foundation.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(ethicalTrivialized.includes('missed_specific_hook'));
assert.ok(ethicalTrivialized.includes('too_generic'));

const ethicalBridge = detectCoachTurnIssues({
    coachText: 'yeah, that sounds like it shapes the whole day, not just food. what do people usually misunderstand most about living it that fully?',
    leadText: "It's not just a belief, it's how I operate daily. Few truly understand the implications of structuring everything around that kind of non-negotiable ethical foundation.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!ethicalBridge.includes('missed_specific_hook'));

const ethicalGoToMealMiss = detectCoachTurnIssues({
    coachText: "yeah, i definitely find it easier to cook at home. do you have a few go-to meals you always fall back on?",
    leadText: "I think people often misunderstand that it's a deep ethical stance, not just a diet trend. It's about compassion for all beings. Do you find it easier to cook at home?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(ethicalGoToMealMiss.includes('missed_specific_hook'));
assert.ok(ethicalGoToMealMiss.includes('too_generic'));
assert.ok(ethicalGoToMealMiss.includes('no_progression'));

const ethicalPracticalThenEthics = detectCoachTurnIssues({
    coachText: "yeah, cooking at home is definitely easier for me. from your side, where does that compassion piece get tested most, socially or just in day-to-day choices?",
    leadText: "I think people often misunderstand that it's a deep ethical stance, not just a diet trend. It's about compassion for all beings. Do you find it easier to cook at home?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!ethicalPracticalThenEthics.includes('missed_specific_hook'));
assert.ok(!ethicalPracticalThenEthics.includes('no_progression'));

const workoutSupportLead = "It's just the same exercises and rep schemes. I'm not seeing progress anymore and it's getting boring. I need new challenges to stay motivated, especially when the app is already being a pain.";
const workoutSupportInvite = detectCoachTurnIssues({
    coachText: "we've got a free 30-day challenge that gets you out of that rut. want me to send you the link?",
    leadText: workoutSupportLead,
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(workoutSupportInvite.includes('premature_challenge_invite'));
assert.ok(workoutSupportInvite.includes('missed_specific_hook'));

const lowEnergyChase = detectCoachTurnIssues({
    coachText: "haha sometimes that's just how it goes with bars right",
    leadText: 'Not really.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(lowEnergyChase.includes('too_generic'));
assert.ok(lowEnergyChase.includes('no_progression'));

const lowEnergyExit = detectCoachTurnIssues({
    coachText: "haha brutal, sounds like a strong 2/10 night. i'll leave you to survive it, report back if it gets better",
    leadText: 'Not really.',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!lowEnergyExit.includes('too_generic'));

const lowEnergyValidationLoop = detectCoachTurnIssues({
    coachText: "totally get that. just having things somewhat sorted makes such a difference to the headspace. it's hard to properly settle in when everything is still in limbo.",
    leadText: "Honestly, just having things somewhat sorted. It's a lot.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(lowEnergyValidationLoop.includes('no_progression'));

const shortOpenerDeadEnd = detectCoachTurnIssues({
    coachText: "was good to meet you earlier. hope you got to chill out after that, those things can be a bit full on haha",
    leadText: 'Yo!',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(shortOpenerDeadEnd.includes('no_progression'));

const shortOpenerThread = detectCoachTurnIssues({
    coachText: "yo! good to hear from you. what did you end up grabbing after we crossed paths?",
    leadText: 'Yo!',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!shortOpenerThread.includes('no_progression'));

const caregiverCommiserationLoop = detectCoachTurnIssues({
    coachText: "haha that's so real though. the ultimate brain off mode. sometimes the couch just wins instantly",
    leadText: "Half the time I just fall asleep before I even pick something. Snacks are easiest to grab. Total brain off mode.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(caregiverCommiserationLoop.includes('no_progression'));

const caregiverSpecificBridge = detectCoachTurnIssues({
    coachText: "yeah, that sounds cooked. what gets squeezed first when you're that tired, food, moving, or any time to yourself?",
    leadText: "Half the time I just fall asleep before I even pick something. Snacks are easiest to grab. Total brain off mode.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!caregiverSpecificBridge.includes('no_progression'));

const caregiverForYourselfBridge = detectCoachTurnIssues({
    coachText: "keeping up with kids' schedules sounds like a full-time job in itself. when you're completely drained by the end of the day, does that usually stop you from doing things you want to do for yourself?",
    leadText: "Oh, definitely the kids. Their schedules and just keeping up with everything for them takes so much energy. By the end of the day, I'm usually just completely drained.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!caregiverForYourselfBridge.includes('no_progression'));

const movingPetJokeOnly = detectCoachTurnIssues({
    coachText: "oh yeah, that makes total sense. moving is such a huge amount to juggle, it's easy to feel completely swamped. and demanding bunnies, mine just stares at me until i bring him snacks haha",
    leadText: "Just general stuff really. Been a lot going on with the move, still trying to settle in properly. And the bunnies are demanding! haha. Just feeling a bit overwhelmed sometimes.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(movingPetJokeOnly.includes('too_generic'));
assert.ok(movingPetJokeOnly.includes('no_progression'));

const movingIsolationBridge = detectCoachTurnIssues({
    coachText: "moving plus demanding bunnies is a lot. what would help the new place feel a bit more like home this week, people, routine, or just one calmer pocket?",
    leadText: "Just general stuff really. Been a lot going on with the move, still trying to settle in properly. And the bunnies are demanding! haha. Just feeling a bit overwhelmed sometimes.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!movingIsolationBridge.includes('too_generic'));
assert.ok(!movingIsolationBridge.includes('no_progression'));

const longShiftReciprocalDeadEnd = detectCoachTurnIssues({
    coachText: "ah yeah, that's the worst feeling after a long one. hope you get to switch off properly tonight. pretty standard one here, fighting with a weird app bug and trying to get a walk in before the rain.",
    leadText: "Yeah, good! Just finished a long one at work, pretty wiped. You?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(longShiftReciprocalDeadEnd.includes('no_progression'));

const longShiftReciprocalBridge = detectCoachTurnIssues({
    coachText: "pretty standard one here, fighting with a weird app bug and trying to get a walk in. what helps you switch off after a long one like that?",
    leadText: "Yeah, good! Just finished a long one at work, pretty wiped. You?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!longShiftReciprocalBridge.includes('no_progression'));

const anotherShiftRhetorical = detectCoachTurnIssues({
    coachText: "ugh, another one? that's tough. thanks for the bug wishes! what's your best trick for switching off after those big shifts?",
    leadText: "Haha yeah trying to! Another long support worker shift tomorrow. Hope you win the bug fight and get that walk in!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!anotherShiftRhetorical.includes('too_many_questions'));

const longDaySwitchOffBridge = detectCoachTurnIssues({
    coachText: "yeah that brain-off feeling after a long day is real. what actually helps you switch off, a walk, food sorted, or just quiet time?",
    leadText: "My brain feels like that sometimes after a long day too, haha.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!longDaySwitchOffBridge.includes('no_progression'));

const genericColdProbe = detectCoachTurnIssues({
    coachText: "ugh, that never-ending cold is rough. does that usually make it even harder to keep on top of things?",
    leadText: "My brain feels lost thanks to this never-ending cold. The kids' schedules feel like rocket science right now.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(genericColdProbe.includes('no_progression'));

const personalQuestionDeadEnd = detectCoachTurnIssues({
    coachText: "i'm into big lifts and bodybuilding style training. today has been app chaos and chilling with sunshine. hope you crush legs!",
    leadText: "What kind of workouts are you into, Shannon? Or are you more of a chill weekend vibes person today?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(personalQuestionDeadEnd.includes('no_progression'));

const personalQuestionBridge = detectCoachTurnIssues({
    coachText: "i'm into big lifts, mostly bodybuilding style training. what are you most excited for with legs day tomorrow?",
    leadText: "What kind of workouts are you into, Shannon? Or are you more of a chill weekend vibes person today?",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!personalQuestionBridge.includes('no_progression'));

const earnedChallengeBridge = detectCoachTurnIssues({
    coachText: "honestly this is the kind of thing the free 30 day challenge is good for: simple structure after work without having to think it all through. want me to send the details?",
    leadText: "yeah exactly, it is mainly after work that i fall off",
    qualifier: {
        stage: 'commitment',
        stage_label: 'Commitment',
        stage_index: 4,
        warmth_score: 72,
        warmth_label: 'warm',
        meaningful_lead_reply_count: 3,
        facts: {
            relationship_context: 'works long shifts and trains around a busy week',
            relationship_checklist: { work_study: 'long shifts', training_background: 'trying to get back into training' },
            current_state: 'inconsistent with food and training after work',
            motivation: 'wants more energy and confidence',
            history_blockers: 'falls off when work gets busy',
        },
    },
    leadStage: 'qualifying',
    leadReplyCount: 3,
});
assert.ok(!earnedChallengeBridge.includes('premature_challenge_invite'));
assert.ok(!earnedChallengeBridge.includes('possible_premature_challenge_invite'));

const builderRabbitHoleLoop = detectCoachTurnIssues({
    coachText: "that's huge. i know that tech rabbit hole, trying to make all the pieces talk to each other is a massive solo project.",
    leadText: "Building a wellness app for personalized routines. The biggest challenge is getting the models to feel intuitive without overcomplicating the UI.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(builderRabbitHoleLoop.includes('no_progression'));

const builderBodyCostBridge = detectCoachTurnIssues({
    coachText: "that's a huge build. after long coding sessions, is ankle-friendly movement the bit you want easiest to keep consistent?",
    leadText: "Building a wellness app for personalized routines. The biggest challenge is getting the models to feel intuitive without overcomplicating the UI.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!builderBodyCostBridge.includes('no_progression'));

const builderKneeDeflectionLoop = detectCoachTurnIssues({
    coachText: "yeah that sounds like a proper rabbit hole trying to get those integrations just right. i know that feeling of getting lost in a bug for hours.",
    leadText: "Knee's just... a thing. Back to the haptics though, trying to figure out Core Haptics with SwiftUI state without latency. It's a real time sink.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(builderKneeDeflectionLoop.includes('no_progression'));

const builderKneeBridge = detectCoachTurnIssues({
    coachText: "that haptics loop sounds like a proper rabbit hole. does that time sink make it harder to step away and actually rest that knee?",
    leadText: "Knee's just... a thing. Back to the haptics though, trying to figure out Core Haptics with SwiftUI state without latency. It's a real time sink.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!builderKneeBridge.includes('no_progression'));

const busyGymGenericDayToDay = detectCoachTurnIssues({
    coachText: "yeah, that's super frustrating when you're trying to build strength but the gym equipment just isn't cooperating. when you say general strength and not getting totally out of shape, what does that usually look like for you in your day-to-day?",
    leadText: "Honestly, just general strength and not getting totally out of shape. It's tough when you can't consistently hit the same machines or weights because they're always taken, or my partner needs to focus on his own thing.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(busyGymGenericDayToDay.includes('too_generic'));
assert.ok(busyGymGenericDayToDay.includes('no_progression'));

const busyGymFallbackBridge = detectCoachTurnIssues({
    coachText: "that sounds like you need a backup template, not more willpower. which machines or weights are usually taken when the session falls apart?",
    leadText: "Honestly, just general strength and not getting totally out of shape. It's tough when you can't consistently hit the same machines or weights because they're always taken, or my partner needs to focus on his own thing.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!busyGymFallbackBridge.includes('too_generic'));
assert.ok(!busyGymFallbackBridge.includes('no_progression'));

const homeGymValidationLoop = detectCoachTurnIssues({
    coachText: "yeah, totally get that. going from full racks and machines to just dumbbells and bands at home is a huge shift. definitely not the same buzz as the old place.",
    leadText: "Just some basics, you know? Dumbbells, resistance bands, a mat. Nothing like the full racks and machines I had at The Iron Den. It's just... limited.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(homeGymValidationLoop.includes('validation_loop'));
assert.ok(homeGymValidationLoop.includes('no_progression'));

const homeGymProgressBridge = detectCoachTurnIssues({
    coachText: "yeah, dumbbells and bands won't feel like the iron den, but you can still make them progress. which lift do you miss most from the racks?",
    leadText: "Just some basics, you know? Dumbbells, resistance bands, a mat. Nothing like the full racks and machines I had at The Iron Den. It's just... limited.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!homeGymProgressBridge.includes('validation_loop'));
assert.ok(!homeGymProgressBridge.includes('no_progression'));

const homeEquipmentColloquialPain = detectCoachTurnIssues({
    coachText: "yeah totally get that, it's hard to replicate proper barbell work at home. do you have any dumbbells or bands at all, or literally starting from scratch?",
    leadText: "Mostly weightlifting, you know? Like, proper barbells and machines. Can't really do that effectively at home, which is why this whole thing is such a pain. Just feels impossible to get a good workout without the right equipment.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!homeEquipmentColloquialPain.includes('no_progression'));

const homeGymVibeLoop = detectCoachTurnIssues({
    coachText: "yeah i hear you, it's tough when you're used to heavy lifting and then feel limited. the motivation side of it is a big one too. what was it about the gym vibe that made it easier to get going?",
    leadText: "I have a couple of super light dumbbells, but it's hardly enough for anything serious. Honestly, even with those, it's so hard to get motivated to do anything at home. Just not the same vibe.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(homeGymVibeLoop.includes('too_generic'));
assert.ok(homeGymVibeLoop.includes('no_progression'));

const homeGymMinimumTemplate = detectCoachTurnIssues({
    coachText: "yeah, light dumbbells won't recreate the old gym. this probably needs a minimum home template, not more motivation. would a simple movement-swap plan make it feel less pointless?",
    leadText: "I have a couple of super light dumbbells, but it's hardly enough for anything serious. Honestly, even with those, it's so hard to get motivated to do anything at home. Just not the same vibe.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!homeGymMinimumTemplate.includes('too_generic'));
assert.ok(!homeGymMinimumTemplate.includes('no_progression'));

const quotedWhatsThePointInvite = detectCoachTurnIssues({
    coachText: "totally get that feeling of 'what's the point?' when the equipment doesn't feel right. the free 30 day challenge could give you a minimum home fallback so you aren't guessing with light dumbbells. want me to send over the details?",
    leadText: "It's usually when I look at my light dumbbells and think 'what's the point?' Or when I start and just feel like I'm not getting anything out of it. Plus, all the distractions at home make it so easy to just stop.",
    qualifier: {
        meaningful_lead_reply_count: 5,
        warmth_score: 90,
        facts: {
            relationship_context: 'lost gym routine and struggles to train at home',
            current_state: 'light dumbbells feel pointless and home distractions make stopping easy',
            motivation: 'wants a workable home fallback',
            history_blockers: 'gym closing, limited equipment, distractions',
        },
    },
    leadStage: 'qualifying',
    leadReplyCount: 5,
});
assert.ok(!quotedWhatsThePointInvite.includes('too_many_questions'));

const renovationDustLogisticsLoop = detectCoachTurnIssues({
    coachText: "yeah the dusty phase is the worst. what's your go-to for getting through that kind of tedious, dusty phase?",
    leadText: "Honestly I just want the main structure done. My Revan statue deserves better than a dust sheet.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(renovationDustLogisticsLoop.includes('no_progression'));

const renovationDustEnergyBridge = detectCoachTurnIssues({
    coachText: "revan absolutely deserves better. does that kind of dusty project drain your energy more, or is it mostly the patience and focus side?",
    leadText: "Honestly I just want the main structure done. My Revan statue deserves better than a dust sheet.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!renovationDustEnergyBridge.includes('no_progression'));

const projectBeastLogisticsLoop = detectCoachTurnIssues({
    coachText: "that project sounds like it's really putting you through it. what's making it such a beast?",
    leadText: "Yeah, this project is a beast, but almost there hopefully.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(projectBeastLogisticsLoop.includes('no_progression'));

const projectBeastEnergyBridge = detectCoachTurnIssues({
    coachText: "that almost-there phase can be the worst. is it draining your head more, or just chewing up time?",
    leadText: "Yeah, this project is a beast, but almost there hopefully.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!projectBeastEnergyBridge.includes('no_progression'));

const appPasswordSupport = detectCoachTurnIssues({
    coachText: "ugh that's a proper loop. if the reset link is bouncing to spam or an old email, would you be open to me manually resetting it on our end?",
    leadText: "Ugh, it just says my password is wrong and the reset link sometimes goes to spam or an old email.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!appPasswordSupport.includes('premature_challenge_invite'));
assert.ok(!appPasswordSupport.includes('no_progression'));

const trackingAccuracyDodge = detectCoachTurnIssues({
    coachText: "yeah that's frustrating when the numbers don't seem to back it up. when you're hitting it hard, what would you expect the graphs to show?",
    leadText: "How do I know if the numbers I'm seeing actually reflect what I'm doing? Sometimes I feel like I'm hitting it hard, but the graphs don't always show that.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(trackingAccuracyDodge.includes('ignored_direct_question'));

const trackingAccuracyAnswer = detectCoachTurnIssues({
    coachText: "i'd check the trend week to week rather than one noisy graph, then cross-check logging consistency with sets, reps, loads, and how performance is moving. what part looks most out of sync?",
    leadText: "How do I know if the numbers I'm seeing actually reflect what I'm doing? Sometimes I feel like I'm hitting it hard, but the graphs don't always show that.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!trackingAccuracyAnswer.includes('ignored_direct_question'));
assert.ok(!trackingAccuracyAnswer.includes('no_progression'));

const animalHookMiss = detectCoachTurnIssues({
    coachText: "haha that's awesome, Pip and Squeak sound amazing. hope you crush legs day!",
    leadText: "I have two rescue bunnies, Pip and Squeak, and volunteer at a shelter. I'm dreaming of a sanctuary one day.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(animalHookMiss.includes('missed_specific_hook'));

const animalHookBridge = detectCoachTurnIssues({
    coachText: "pip and squeak is elite. how did the sanctuary dream start for you?",
    leadText: "I have two rescue bunnies, Pip and Squeak, and volunteer at a shelter. I'm dreaming of a sanctuary one day.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!animalHookBridge.includes('missed_specific_hook'));

const closingRoutineProbe = detectCoachTurnIssues({
    coachText: "thanks for the rewatch wishes! what's usually your go-to when you carve out chill time?",
    leadText: 'Thanks so much, you too, enjoy your popcorn and rewatch!',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(closingRoutineProbe.includes('no_progression'));

const plantTasteDeadEnd = detectCoachTurnIssues({
    coachText: "that's cool! wish i was better at just throwing things together like that. i usually need a recipe haha.",
    leadText: "Haha, I think she just kinda wings it. She's good at that stuff.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(plantTasteDeadEnd.includes('no_progression'));
assert.ok(plantTasteDeadEnd.includes('missed_specific_hook'));

const plantTasteProgression = detectCoachTurnIssues({
    coachText: "that's usually the trick with plant-based swaps, they win or lose on flavour and texture. was it proper comfort-food good, or more 'good for plant-based' good?",
    leadText: "Haha, I think she just kinda wings it. She's good at that stuff.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!plantTasteProgression.includes('no_progression'));
assert.ok(!plantTasteProgression.includes('missed_specific_hook'));

const wellnessFadWishWell = detectCoachTurnIssues({
    coachText: "totally, it's wild how much of that is out there. feels like you need a science degree just to read a label these days haha. hope the busy day goes smoothly!",
    leadText: "Exactly! Like, what even is 'natural' these days when it comes to supplements? So much greenwashing. Makes you cynical after a while, haha. Anyway, busy day ahead!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(wellnessFadWishWell.includes('no_progression'));
assert.ok(wellnessFadWishWell.includes('missed_specific_hook'));

const wellnessFadProgression = detectCoachTurnIssues({
    coachText: "yeah, 'natural' gets used as a pretty loose marketing word. my filter is usually whether it improves the boring basics, food, movement, sleep, recovery, or just sells a shortcut. what part of that wellness stuff annoys you most?",
    leadText: "Exactly! Like, what even is 'natural' these days when it comes to supplements? So much greenwashing. Makes you cynical after a while, haha. Anyway, busy day ahead!",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!wellnessFadProgression.includes('no_progression'));
assert.ok(!wellnessFadProgression.includes('missed_specific_hook'));

const classCoveredGenericWork = detectCoachTurnIssues({
    coachText: "ah gotcha. 3-4 times is still solid. what kind of work are you in?",
    leadText: "Usually 3-4 LesMills classes a week, depending on my work schedule.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(classCoveredGenericWork.includes('no_progression'));

const classCoveredNextEdge = detectCoachTurnIssues({
    coachText: "3-4 classes is solid. if the classes already give you the push, is the next edge more recovery between sessions, strength progress, or just keeping that energy consistent?",
    leadText: "Usually 3-4 LesMills classes a week, depending on my work schedule.",
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(!classCoveredNextEdge.includes('no_progression'));

const stock = detectCoachTurnIssues({
    coachText: 'what does a normal day look like for you at the moment?',
    leadText: 'food is where i struggle',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(stock.includes('stock_discovery_question'));

(async () => {
    const batch = await runSparringBatch({
        count: 1,
        turns: 2,
        seed: 'offline-test',
        personaKeys: [DEFAULT_PERSONAS[0].key],
        offline: true,
    });
    assert.strictEqual(batch.count, 1);
    assert.strictEqual(batch.conversations.length, 1);
    assert.ok(batch.conversations[0].transcript.length >= 2);
    assert.ok(batch.summary.averages.overall >= 0);
    console.log('dm sparring gym tests passed');
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
