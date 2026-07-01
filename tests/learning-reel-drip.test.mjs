import assert from 'node:assert';

const { _test } = await import('../netlify/functions/learning-reel-drip.mjs');
const learningReelSources = (await import('../netlify/functions/_lib/learning-reel-sources.js')).default;

delete process.env.LEARNING_REEL_DRIP_FORCE_ACTIVE;
delete process.env.LEARNING_REEL_DRIP_AUTOSTART_UNTIL;

const nowMs = Date.parse('2026-06-02T02:00:00.000Z');
const plan = _test.buildInitialPlan(nowMs);
assert.strictEqual(plan.length, 168);
assert.strictEqual(plan[0].topic_id, 'plant_based_cooking');
assert.strictEqual(plan[1].topic_id, 'protein_science');
assert.strictEqual(plan[3].topic_id, 'workout_motivation');
assert.strictEqual(plan[14].topic_id, 'plant_based_cooking');
assert.strictEqual(Date.parse(plan[1].due_at) - Date.parse(plan[0].due_at), 60 * 60 * 1000);

const state = _test.normalizeDripState({ custom_data: {} }, nowMs);
assert.strictEqual(state.id, 'shan_n_sunny_cocos_learning_drip_2026_06');
assert.strictEqual(state.revision, 'hourly_168_v2');
assert.strictEqual(state.status, 'active');
assert.strictEqual(state.total_sends, 168);
assert.strictEqual(state.plan.length, 168);

const pilotConfig = _test.CLIENT_PILOT_TARGETS.find(target => target.id === 'mon_vegan_food_pilot');
assert.ok(pilotConfig);
assert.strictEqual(pilotConfig.handle, 'monica.l.sheekey');
assert.strictEqual(pilotConfig.review_before_send, true);
const pilotPlan = _test.buildClientPilotPlan(pilotConfig, nowMs);
assert.strictEqual(pilotPlan.length, 12);
assert.strictEqual(pilotPlan[0].topic_id, 'plant_based_cooking');
assert.strictEqual(pilotPlan[1].topic_id, 'meal_prep_planning');
assert.strictEqual(pilotPlan[2].topic_id, 'plant_based_cooking');
assert.strictEqual(Date.parse(pilotPlan[1].due_at) - Date.parse(pilotPlan[0].due_at), _test.CLIENT_PILOT_INTERVAL_MS);
assert.ok(_test.CLIENT_PILOT_INTERVAL_MS >= 55 * 60 * 60 * 1000);
assert.ok(_test.CLIENT_PILOT_INTERVAL_MS <= 57 * 60 * 60 * 1000);

const pilotState = _test.normalizeClientPilotState({ custom_data: {} }, pilotConfig, nowMs);
assert.strictEqual(pilotState.id, 'mon_vegan_food_pilot');
assert.strictEqual(pilotState.vegan_safe_required, true);
assert.deepStrictEqual(pilotState.topics, ['plant_based_cooking', 'meal_prep_planning']);
assert.strictEqual(pilotState.require_coach_reply_after_inbound, true);
assert.strictEqual(pilotState.review_before_send, true);
assert.strictEqual(pilotState.plan.length, 12);

const fraPilotConfig = _test.CLIENT_PILOT_TARGETS.find(target => target.id === 'francesca_vegan_food_pilot');
assert.ok(fraPilotConfig);
assert.strictEqual(fraPilotConfig.handle, 'cavazzanafrancesca');
assert.deepStrictEqual(fraPilotConfig.topics, ['vegan_panettone', 'plant_based_cooking', 'meal_prep_planning']);
assert.strictEqual(fraPilotConfig.review_before_send, true);
assert.strictEqual(fraPilotConfig.review_reason, 'francesca_panettone_reel_review');
const fraPilotPlan = _test.buildClientPilotPlan(fraPilotConfig, nowMs);
assert.strictEqual(fraPilotPlan[0].topic_id, 'vegan_panettone');
const fraPilotState = _test.normalizeClientPilotState({ custom_data: {} }, fraPilotConfig, nowMs);
assert.strictEqual(fraPilotState.review_before_send, true);
assert.deepStrictEqual(fraPilotState.topics, ['vegan_panettone', 'plant_based_cooking', 'meal_prep_planning']);
assert.strictEqual(fraPilotState.plan[0].topic_id, 'vegan_panettone');

const lilPilotConfig = _test.CLIENT_PILOT_TARGETS.find(target => target.id === 'lil_bunny_reel_pilot');
assert.ok(lilPilotConfig);
assert.strictEqual(lilPilotConfig.handle, 'liligrace_h');
assert.strictEqual(lilPilotConfig.caption_mode, 'url_only');
assert.deepStrictEqual(lilPilotConfig.topics, ['bunny_reels']);
assert.strictEqual(lilPilotConfig.vegan_safe_required, false);
const lilMessage = _test.buildClientPilotVisibleMessage({
    url: 'https://www.youtube.com/shorts/test-bunny-flop',
    title: 'Cute bunny flop',
    topic_id: 'bunny_reels',
    topic_label: 'Bunny reels',
}, 0, lilPilotConfig);
assert.strictEqual(lilMessage, 'https://www.youtube.com/shorts/test-bunny-flop');
const manualReelPayload = _test.buildClientPilotReelPayload({
    reel: {
        video_id: 'test-bunny-flop',
        url: 'https://www.youtube.com/shorts/test-bunny-flop',
        title: 'Cute bunny flop',
        channel_title: 'Rabbit Creator',
        description: 'A free-roam rabbit does a happy flop.',
    },
    item: { topic_id: 'bunny_reels', topic_label: 'Bunny reels' },
    config: lilPilotConfig,
    message: lilMessage,
    nowIso: new Date(nowMs).toISOString(),
});
assert.strictEqual(manualReelPayload.pilot_id, 'lil_bunny_reel_pilot');
assert.strictEqual(manualReelPayload.topic_id, 'bunny_reels');
assert.strictEqual(manualReelPayload.sent_message, 'https://www.youtube.com/shorts/test-bunny-flop');
assert.strictEqual(manualReelPayload.vegan_safe_required, undefined);

const mirandaPilotConfig = _test.CLIENT_PILOT_TARGETS.find(target => target.id === 'miranda_core_pelvic_tilt_pilot');
assert.ok(mirandaPilotConfig);
assert.strictEqual(mirandaPilotConfig.handle, 'miranda_laree_is_me');
assert.deepStrictEqual(mirandaPilotConfig.topics, ['pelvic_tilt_balance', 'core_training_technique', 'weight_training_technique']);
assert.strictEqual(mirandaPilotConfig.vegan_safe_required, false);
assert.strictEqual(mirandaPilotConfig.review_before_send, true);
const mirandaState = _test.normalizeClientPilotState({ custom_data: {} }, mirandaPilotConfig, nowMs);
assert.strictEqual(mirandaState.id, 'miranda_core_pelvic_tilt_pilot');
assert.strictEqual(mirandaState.review_before_send, true);
assert.strictEqual(mirandaState.vegan_safe_required, false);
assert.deepStrictEqual(mirandaState.vegan_safety_reasons, []);
assert.strictEqual(mirandaState.plan[0].topic_id, 'pelvic_tilt_balance');
assert.strictEqual(mirandaState.plan[1].topic_id, 'core_training_technique');

const songSignals = _test.extractSongSignalsFromMessages([{
    id: 'm-song',
    direction: 'in',
    text: 'I love the song The Thunder Rolls for training',
    created_at: new Date(nowMs - 60 * 60 * 1000).toISOString(),
}]);
assert.strictEqual(songSignals[0].label, 'The Thunder Rolls for training');
assert.ok(_test.songSearchQueries(songSignals[0].label).some(query => /The Thunder Rolls/i.test(query)));

const leadTopicEntries = _test.topicEntriesFromLeadText('Miranda said core bracing and pelvic tilt are the main things she is working on.');
assert.strictEqual(leadTopicEntries[0].topic_id, 'pelvic_tilt_balance');
assert.ok(leadTopicEntries.some(entry => entry.topic_id === 'core_training_technique'));

const dynamicLeadConfig = _test.buildDynamicLeadReelConfig({
    id: 'thread-dynamic',
    ig_username: 'miranda_laree_is_me',
    profile_name: 'Miranda',
    channel: 'instagram',
    lead_stage: 'qualifying',
    last_inbound_at: new Date(nowMs - 23 * 60 * 60 * 1000).toISOString(),
    last_outbound_at: new Date(nowMs - 22.25 * 60 * 60 * 1000).toISOString(),
    custom_data: {},
    goals: 'core strength',
}, [{
    id: 'm1',
    direction: 'in',
    text: 'I love the song The Thunder Rolls. Also keen for core bracing stuff.',
    created_at: new Date(nowMs - 23 * 60 * 60 * 1000).toISOString(),
}], nowMs);
assert.strictEqual(dynamicLeadConfig.id, _test.DYNAMIC_LEAD_DRIP_ID);
assert.strictEqual(dynamicLeadConfig.review_before_send, false);
assert.strictEqual(dynamicLeadConfig.max_sends_per_7_days, 3);
assert.strictEqual(dynamicLeadConfig.min_last_inbound_hours, 22);
assert.strictEqual(dynamicLeadConfig.min_quiet_hours_since_last_activity, 22);
assert.strictEqual(dynamicLeadConfig.plan_topics[0].topic_id, 'personal_music');
assert.strictEqual(dynamicLeadConfig.plan_topics[0].open_search, true);
assert.ok(dynamicLeadConfig.plan_topics.some(entry => entry.topic_id === 'core_training_technique'));

const angelaDogMessages = [
    {
        id: 'a1',
        direction: 'out',
        text: 'oh so cute, whats their name?',
        created_at: new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'a2',
        direction: 'in',
        text: 'Kali',
        created_at: new Date(nowMs - 23.8 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'a3',
        direction: 'out',
        text: "Kali is such a cute name. is she always that fast? Kali's got serious zoomies energy.",
        created_at: new Date(nowMs - 23.6 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'a4',
        direction: 'in',
        text: 'Haha yep',
        created_at: new Date(nowMs - 23.4 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'a5',
        direction: 'out',
        text: 'Does she only go full speed like that in the open field, or is she chaotic at home too?',
        created_at: new Date(nowMs - 23.2 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'a6',
        direction: 'in',
        text: 'Nah shes super chill at home',
        created_at: new Date(nowMs - 22.9 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'a7',
        direction: 'out',
        text: 'haha love that, Kali saves all the chaos for the open field then',
        created_at: new Date(nowMs - 22.8 * 60 * 60 * 1000).toISOString(),
    },
];
const staleFitnessLeadConfig = _test.buildDynamicLeadReelConfig({
    id: 'thread-angela',
    ig_username: 'angela_mylott',
    profile_name: 'Angela',
    channel: 'instagram',
    lead_stage: 'qualifying',
    goals: 'build muscle and stay consistent with training',
    custom_data: {},
}, angelaDogMessages, nowMs);
assert.strictEqual(staleFitnessLeadConfig.plan_topics[0].topic_id, 'cute_pet_reels');
assert.strictEqual(staleFitnessLeadConfig.plan_topics[0].signal_label, 'pet:Kali');
assert.ok(staleFitnessLeadConfig.plan_topics.some(entry => entry.topic_id === 'muscle_gain_basics'));
const dogContextReview = _test.dynamicLeadLatestContextReview({
    item: { topic_id: 'workout_motivation', topic_label: 'Workout motivation' },
    messages: angelaDogMessages,
    nowMs,
});
assert.strictEqual(dogContextReview.ok, false);
assert.strictEqual(dogContextReview.blocker, 'latest_context_pet_social_chat');
const petContextReview = _test.dynamicLeadLatestContextReview({
    item: { topic_id: 'cute_pet_reels', topic_label: 'Cute pet reels' },
    messages: angelaDogMessages,
    nowMs,
});
assert.strictEqual(petContextReview.ok, true);
assert.ok(petContextReview.topic_ids.includes('cute_pet_reels'));
const petMessage = _test.buildClientPilotVisibleMessage({
    url: 'https://www.youtube.com/shorts/pet123',
    topic_id: 'cute_pet_reels',
    topic_label: 'Cute pet reels',
    signal_label: 'pet:Kali',
}, 0, staleFitnessLeadConfig, staleFitnessLeadConfig.plan_topics[0]);
assert.ok(petMessage.includes('https://www.youtube.com/shorts/pet123'));
assert.match(petMessage, /Kali/i);

const coreContextReview = _test.dynamicLeadLatestContextReview({
    item: { topic_id: 'core_training_technique', topic_label: 'Core training technique' },
    messages: [{
        id: 'core1',
        direction: 'in',
        text: 'Core bracing and dead bugs are what I need help with.',
        created_at: new Date(nowMs - 23 * 60 * 60 * 1000).toISOString(),
    }],
    nowMs,
});
assert.strictEqual(coreContextReview.ok, true);
assert.ok(coreContextReview.topic_ids.includes('core_training_technique'));
assert.strictEqual(_test.isDynamicLeadStage({ lead_stage: 'qualifying' }), true);
assert.strictEqual(_test.isDynamicLeadStage({ lead_stage: 'invited' }), true);
assert.strictEqual(_test.isDynamicLeadStage({ lead_stage: 'paid_client' }), false);
assert.strictEqual(_test.isDynamicLeadStage({ lead_stage: 'starter_coaching' }), false);
assert.strictEqual(_test.isDynamicLeadStage({ lead_stage: 'churned' }), false);

const dynamicLeadPlan = _test.buildClientPilotPlan(dynamicLeadConfig, nowMs);
assert.strictEqual(dynamicLeadPlan[0].topic_id, 'personal_music');
assert.ok(dynamicLeadPlan[0].search_queries.some(query => /Thunder Rolls/i.test(query)));
const dynamicLeadState = _test.normalizeClientPilotState({ custom_data: {} }, dynamicLeadConfig, nowMs);
assert.strictEqual(dynamicLeadState.review_before_send, false);
assert.strictEqual(dynamicLeadState.plan[0].caption_mode, 'song');

const musicMessage = _test.buildClientPilotVisibleMessage({
    url: 'https://www.youtube.com/shorts/song123',
    topic_id: 'personal_music',
    topic_label: 'Music',
    intent: 'song',
    caption_mode: 'song',
}, 0, dynamicLeadConfig, dynamicLeadPlan[0]);
assert.ok(musicMessage.includes('https://www.youtube.com/shorts/song123'));
assert.match(musicMessage, /song|came up|made me think/i);

assert.ok(_test.scoreOpenSearchLearningReelCandidate({
    title: 'The Thunder Rolls workout edit #shorts',
    description: 'Training clip using The Thunder Rolls audio.',
    channel_title: 'Creator',
    duration_seconds: 32,
    view_count: 120000,
}, { item: dynamicLeadPlan[0], topicId: 'personal_music' }) > 80);
assert.strictEqual(_test.scoreOpenSearchLearningReelCandidate({
    title: 'Miracle detox belly fat burner',
    description: 'Cleanse hack.',
    duration_seconds: 32,
}, { item: dynamicLeadPlan[0], topicId: 'personal_music' }), -1000);

assert.strictEqual(_test.recentLearningReelSendCount({
    custom_data: {
        learning_reels: {
            history: [
                { video_id: 'a', sent_at: new Date(nowMs - 1 * 60 * 60 * 1000).toISOString() },
                { video_id: 'b', sent_at: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString() },
            ],
        },
    },
}, {
    sent: [{ video_id: 'c', sent_at: new Date(nowMs - 3 * 60 * 60 * 1000).toISOString() }],
}, nowMs), 3);

assert.strictEqual(_test.clientPilotTimingBlocker({
    last_inbound_at: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
    last_outbound_at: new Date(nowMs - 1 * 60 * 60 * 1000).toISOString(),
}, {
    ...dynamicLeadConfig,
    min_last_inbound_hours: 22,
    max_last_inbound_hours: 24,
    min_quiet_hours_since_last_activity: 22,
}, nowMs).blocker, 'waiting_for_reel_window');
assert.strictEqual(_test.clientPilotTimingBlocker({
    last_inbound_at: new Date(nowMs - 23 * 60 * 60 * 1000).toISOString(),
    last_outbound_at: new Date(nowMs - 11 * 60 * 60 * 1000).toISOString(),
}, {
    ...dynamicLeadConfig,
    min_last_inbound_hours: 22,
    max_last_inbound_hours: 24,
    min_quiet_hours_since_last_activity: 22,
}, nowMs).blocker, 'waiting_for_quiet_window');
assert.strictEqual(_test.clientPilotTimingBlocker({
    last_inbound_at: new Date(nowMs - 23 * 60 * 60 * 1000).toISOString(),
    last_outbound_at: new Date(nowMs - 22.25 * 60 * 60 * 1000).toISOString(),
}, {
    ...dynamicLeadConfig,
    min_last_inbound_hours: 22,
    max_last_inbound_hours: 24,
    min_quiet_hours_since_last_activity: 22,
}, nowMs), null);

assert.strictEqual(_test.hasCoachRepliedSinceLastInbound({
    last_inbound_at: '2026-06-04T10:00:00.000Z',
    last_outbound_at: '2026-06-04T09:59:00.000Z',
}), false);
assert.strictEqual(_test.hasCoachRepliedSinceLastInbound({
    last_inbound_at: '2026-06-04T10:00:00.000Z',
    last_outbound_at: '2026-06-04T10:01:00.000Z',
}), true);
assert.strictEqual(_test.isLearningReelOutboundSource('learning_reel_drip_instagram_graph'), true);
assert.strictEqual(_test.isLearningReelOutboundSource('admin_dashboard_direct_instagram_graph'), false);
assert.strictEqual(_test.isLinkHandoffOutboundText("Yo @shan_n_sunny, here's that info about using ChatGPT for your Instagram content system: https://plantbased-balance.org/ig-system?ig=shan_n_sunny\n\nWant me to map this version for your business? Reply with what you do and we can sort it out."), true);
assert.strictEqual(_test.isLearningReelGateEligibleOutbound({
    source: 'instagram_graph',
    text: "Yo @shan_n_sunny, here's that info about using ChatGPT for your Instagram content system: https://plantbased-balance.org/ig-system?ig=shan_n_sunny\n\nWant me to map this version for your business? Reply with what you do and we can sort it out.",
}), false);
assert.strictEqual(_test.isLearningReelGateEligibleOutbound({
    source: 'instagram_comment_private_reply',
    text: 'got you, here is the guide',
}), false);
assert.strictEqual(_test.isLearningReelGateEligibleOutbound({
    source: 'admin_dashboard_direct_instagram_graph',
    text: 'haha yeah i reckon try the easy one first and see how it feels',
}), true);
assert.strictEqual(_test.isLearningReelGateEligibleOutbound({
    source: 'admin_dashboard_direct_instagram_graph',
    text: 'save this for later https://www.youtube.com/shorts/test123',
}), false);

const expiredPrimaryState = _test.normalizeDripState({
    custom_data: {
        learning_reel_drip: {
            ...state,
            status: 'active',
            stopped_reason: null,
            stopped_at: null,
        },
    },
}, Date.parse('2026-06-22T09:00:00.000Z'));
assert.strictEqual(expiredPrimaryState.status, 'stopped');
assert.strictEqual(expiredPrimaryState.stopped_reason, 'primary_test_drip_window_closed');
assert.strictEqual(expiredPrimaryState.next_send_at, null);

const overduePilotState = {
    ...pilotState,
    plan: pilotState.plan.map(item => ({
        ...item,
        due_at: new Date(nowMs - ((item.index + 1) * 60 * 1000)).toISOString(),
    })),
};
const rolledPilotState = _test.updateClientPilotPlanItem(overduePilotState, 0, {
    status: 'sent',
    sent_at: new Date(nowMs).toISOString(),
    video_id: 'pilot-video-one',
}, nowMs);
assert.strictEqual(rolledPilotState.plan[0].status, 'sent');
assert.strictEqual(Date.parse(rolledPilotState.next_send_at) - nowMs, _test.CLIENT_PILOT_INTERVAL_MS);
assert.strictEqual(
    Date.parse(rolledPilotState.plan[2].due_at) - Date.parse(rolledPilotState.plan[1].due_at),
    _test.CLIENT_PILOT_INTERVAL_MS
);

const upgraded = _test.normalizeDripState({
    custom_data: {
        learning_reel_drip: {
            id: state.id,
            status: 'active',
            interval_ms: 12 * 60 * 60 * 1000,
            plan: plan.slice(0, 14),
            sent: [{ video_id: 'already-sent' }],
        },
    },
}, nowMs);
assert.strictEqual(upgraded.revision, 'hourly_168_v2');
assert.strictEqual(upgraded.previous_plan_count, 14);
assert.strictEqual(upgraded.plan.length, 168);
assert.strictEqual(upgraded.sent[0].video_id, 'already-sent');

const due = _test.nextDuePlanItem(state, nowMs);
assert.strictEqual(due.topic_id, 'plant_based_cooking');

const nextState = _test.updatePlanItem(state, due.index, {
    status: 'sent',
    sent_at: new Date(nowMs).toISOString(),
    video_id: 'video-one',
});
assert.strictEqual(nextState.plan[0].status, 'sent');
assert.strictEqual(nextState.status, 'active');
assert.strictEqual(nextState.next_send_at, state.plan[1].due_at);

assert.deepStrictEqual(_test.youtubeVideoIdsFromText(
    'save this for later https://www.youtube.com/shorts/czkGj5vJEFQ'
), ['czkGj5vJEFQ']);
assert.deepStrictEqual(_test.youtubeVideoIdsFromText(
    'watch https://youtu.be/AgPLP9iZnMo?t=1 and https://www.youtube.com/watch?v=F0BkuN8MPtQ'
), ['AgPLP9iZnMo', 'F0BkuN8MPtQ']);
const stateVideoIds = _test.sentVideoIdsFromState({
    sent: [{ video_id: 'czkGj5vJEFQ' }],
    plan: [{ video_id: 'AgPLP9iZnMo' }],
});
assert.ok(stateVideoIds.has('czkgj5vjefq'));
assert.ok(stateVideoIds.has('agplp9iznmo'));

assert.strictEqual(_test.sourceDiversityKey('Jeff Nippard'), 'jeff nippard');
assert.strictEqual(_test.learningReelSourceKey({
    source_id: 'jeff_nippard',
    channel_title: 'Jeff Nippard',
}), 'jeff nippard');
const recentSourceKeys = _test.recentLearningReelSourceKeys({
    custom_data: {
        learning_reels: {
            history: [{
                video_id: 'older-jeff',
                channel_title: 'Jeff Nippard',
                sent_at: '2026-06-02T00:00:00.000Z',
            }],
        },
    },
}, {
    sent: [
        {
            video_id: 'latest-jeff',
            source_id: 'jeff_nippard',
            sent_at: '2026-06-02T01:00:00.000Z',
        },
        {
            video_id: 'rp-one',
            source_id: 'renaissance_periodization',
            sent_at: '2026-06-01T23:00:00.000Z',
        },
    ],
});
assert.deepStrictEqual(recentSourceKeys.slice(0, 3), [
    'jeff nippard',
    'jeff nippard',
    'renaissance periodization',
]);
assert.strictEqual(_test.shouldDeferCandidateForSourceMix(
    { source_id: 'jeff_nippard', channel_title: 'Jeff Nippard' },
    recentSourceKeys
), true);
assert.strictEqual(_test.shouldDeferCandidateForSourceMix(
    { source_id: 'athlean_x', channel_title: 'ATHLEAN-X' },
    recentSourceKeys
), false);

assert.strictEqual(_test.shouldHoldPausedState({
    status: 'paused',
    next_send_at: new Date(nowMs + 60 * 60 * 1000).toISOString(),
}, nowMs), true);
assert.strictEqual(_test.shouldHoldPausedState({
    status: 'paused',
    next_send_at: new Date(nowMs - 60 * 1000).toISOString(),
}, nowMs), false);

const customData = _test.applyCocosThreadCustomData({}, {
    recipientId: 'recipient_1',
    accountId: 'account_1',
}, state);
assert.strictEqual(customData.bot_account, 'cocos_pt_studio');
assert.strictEqual(customData.algorithm_fork, 'cocos_acquisition_v1');
assert.strictEqual(customData.instagram_graph.bot_account, 'cocos_pt_studio');
assert.strictEqual(customData.instagram_graph.ig_graph_user_id, 'recipient_1');

const graph = _test.resolveThreadGraph({
    subscriber_id: 'ig_graph:account_1:recipient_1',
    custom_data: {},
});
assert.deepStrictEqual(graph, { accountId: 'account_1', recipientId: 'recipient_1' });

const candidate = _test.candidateFromResult({
    id: { videoId: 'abc123xyz' },
    snippet: {
        title: 'Fallback title',
        channelTitle: 'Fallback channel',
        channelId: 'fallback_channel',
        description: 'fallback description',
    },
}, {
    id: 'abc123xyz',
    snippet: {
        title: 'Protein explained #shorts',
        channelTitle: 'Jeff Nippard',
        channelId: 'UC68TLK0mAEzUyHx5x5k-S1Q',
        description: 'A useful explanation of protein intake and muscle growth.',
        publishedAt: '2026-05-01T00:00:00Z',
        thumbnails: { high: { url: 'https://img.youtube.com/high.jpg' } },
    },
    contentDetails: { duration: 'PT45S' },
    statistics: { viewCount: '120000' },
}, 'protein_science', 'Jeff Nippard protein intake');

assert.strictEqual(candidate.title, 'Protein explained #shorts');
assert.strictEqual(candidate.channel_title, 'Jeff Nippard');
assert.strictEqual(candidate.description, 'A useful explanation of protein intake and muscle growth.');
assert.strictEqual(candidate.duration_seconds, 45);
assert.strictEqual(candidate.view_count, 120000);
assert.strictEqual(candidate.thumbnail_url, 'https://img.youtube.com/high.jpg');

assert.ok(
    learningReelSources.buildCuratedLearningReelQueries('vegan_panettone')
        .some(query => /vegan panettone recipe shorts/i.test(query))
);
assert.ok(learningReelSources.scoreCuratedLearningReelCandidate({
    title: 'Easy Vegan Panettone Recipe #shorts',
    description: 'Egg free dairy free panettone with soft fluffy dough.',
    channelTitle: 'Italian Vegan Baker',
    durationSec: 52,
    viewCount: 45000,
}, 'vegan_panettone') > 100);
assert.strictEqual(learningReelSources.scoreCuratedLearningReelCandidate({
    title: 'Traditional Panettone Recipe',
    description: 'Classic Italian panettone with butter and eggs.',
    channelTitle: 'Italian Baker',
    durationSec: 52,
    viewCount: 45000,
}, 'vegan_panettone'), -1000);

const proteinMessage = _test.buildVisibleMessage(candidate, 0);
assert.ok(proteinMessage.includes('https://www.youtube.com/shorts/abc123xyz'));
assert.match(proteinMessage, /protein|nutrition/);
assert.ok(!proteinMessage.includes("this is cool, reckon you'll like this one"));

const proteinAbsorptionMessage = _test.buildVisibleMessage({
    topic_id: 'protein_science',
    topic_label: 'Protein',
    title: 'How Much Protein Can You Absorb In One Meal? (New Science)',
    url: 'https://www.youtube.com/shorts/agPLP9iZnMo',
    video_id: 'agPLP9iZnMo',
}, 0);
assert.ok(proteinAbsorptionMessage.includes('https://www.youtube.com/shorts/agPLP9iZnMo'));
assert.match(proteinAbsorptionMessage, /interesting|worth a look|protein|useful/);
assert.doesNotMatch(proteinAbsorptionMessage, /make me this|make this|eat this|looks yum|dinner/);
assert.doesNotMatch(proteinAbsorptionMessage, /per meal thing|food nerd side|this bit on/i);

const cookingMessage = _test.buildVisibleMessage({
    topic_id: 'plant_based_cooking',
    topic_label: 'Plant-based cooking',
    title: 'The BEST cucumber salad',
    url: 'https://www.youtube.com/shorts/xMdz4-AiYA4',
    video_id: 'xMdz4-AiYA4',
}, 0);
assert.match(cookingMessage, /looks yum|looks good|would eat|worth trying|yum/);
assert.ok(cookingMessage.includes('https://www.youtube.com/shorts/xMdz4-AiYA4'));
assert.ok(!cookingMessage.includes("this is cool, reckon you'll like this one"));
assert.doesNotMatch(cookingMessage, /cucumber salad|make me this/i);

const panettoneMessage = _test.buildVisibleMessage({
    topic_id: 'vegan_panettone',
    topic_label: 'Vegan panettone',
    title: 'Easy Vegan Panettone Recipe',
    url: 'https://www.youtube.com/shorts/b20A4MUVDI4',
    video_id: 'b20A4MUVDI4',
}, 0);
assert.match(panettoneMessage, /looks yum|looks good|would eat|worth trying|yum/i);
assert.match(panettoneMessage, /https:\/\/www\.youtube\.com\/shorts\/b20A4MUVDI4/i);
assert.doesNotMatch(panettoneMessage, /easy vegan panettone recipe|make me this/i);

const brainMessage = _test.buildVisibleMessage({
    topic_id: 'mindset_neuroscience',
    topic_label: 'Mindset and neuroscience',
    title: 'When did the first brain show up on Earth?',
    url: 'https://www.youtube.com/shorts/F0BkuN8MPtQ',
    video_id: 'F0BkuN8MPtQ',
}, 0);
assert.ok(brainMessage.includes('https://www.youtube.com/shorts/F0BkuN8MPtQ'));
assert.match(brainMessage, /interesting|worth a look/);
assert.doesNotMatch(brainMessage, /when did the first|this bit on|brain show up/i);

const veganThreadRequirement = _test.resolveVeganSafetyRequirement({
    custom_data: {
        learning_reel_drip: { vegan_safe_required: true },
    },
});
assert.strictEqual(veganThreadRequirement.required, true);
assert.ok(veganThreadRequirement.reasons.includes('thread_flag'));

const veganRouteRequirement = _test.resolveVeganSafetyRequirement({
    qualifier: { challenge_route: 'vegan' },
});
assert.strictEqual(veganRouteRequirement.required, true);
assert.ok(veganRouteRequirement.reasons.includes('qualifier_vegan_route'));

const nonVeganCorrectionRequirement = _test.resolveVeganSafetyRequirement({
    running_notes: 'Shannon asked vegan hey? They said no not vegan, I eat everything.',
});
assert.strictEqual(nonVeganCorrectionRequirement.required, false);

const unsafeJeffMilk = _test.assessCandidateVeganSafety({
    topic_id: 'protein_science',
    title: 'How I make my protein shake',
    description: 'Jeff uses milk and whey protein powder.',
    channelTitle: 'Jeff Nippard',
    source_kind: 'evidence_fitness',
}, { required: true });
assert.strictEqual(unsafeJeffMilk.status, 'unsafe');
assert.ok(unsafeJeffMilk.reasons.includes('animal_product_signal'));

const ambiguousJeffProtein = _test.assessCandidateVeganSafety({
    topic_id: 'protein_science',
    title: 'How Much Protein Can You Absorb In One Meal? (New Science)',
    description: 'How many grams of protein can you absorb in one meal?',
    channelTitle: 'Jeff Nippard',
    source_kind: 'evidence_fitness',
}, { required: true });
assert.strictEqual(ambiguousJeffProtein.status, 'unknown');
assert.ok(ambiguousJeffProtein.reasons.includes('food_or_nutrition_without_vegan_signal'));

const safePlantProtein = _test.assessCandidateVeganSafety({
    topic_id: 'protein_science',
    title: 'Plant based protein tips',
    description: 'Vegan protein intake using tofu, tempeh and pea protein.',
    channelTitle: 'Simnett Nutrition',
    source_kind: 'plant_based_fitness',
}, { required: true });
assert.strictEqual(safePlantProtein.status, 'safe');

const safeTechnique = _test.assessCandidateVeganSafety({
    topic_id: 'weight_training_technique',
    title: 'Fix your squat form',
    description: 'A technique cue for better squat depth.',
    channelTitle: 'Jeff Nippard',
    source_kind: 'evidence_fitness',
}, { required: true });
assert.strictEqual(safeTechnique.status, 'safe');
assert.ok(safeTechnique.reasons.includes('non_food_topic_no_animal_signal'));

const safeSoyMilk = _test.assessCandidateVeganSafety({
    topic_id: 'meal_prep_planning',
    title: 'High protein vegan smoothie',
    description: 'Uses soy milk, banana and pea protein.',
    channelTitle: 'Pick Up Limes',
    source_kind: 'plant_based_practical',
}, { required: true });
assert.strictEqual(safeSoyMilk.status, 'safe');

console.log('learning reel drip tests passed');
