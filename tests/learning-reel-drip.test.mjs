import assert from 'node:assert';

const { _test } = await import('../netlify/functions/learning-reel-drip.mjs');

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
assert.strictEqual(pilotState.plan.length, 12);

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
