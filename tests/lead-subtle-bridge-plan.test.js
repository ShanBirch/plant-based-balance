const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    freshQualifier,
    normalizeQualifier,
    normalizeBridgePlan,
    normalizeConversationPsychology,
    buildQualifierRelationshipBlock,
} = require('../netlify/functions/_lib/qualifier-engine');

const fresh = freshQualifier();
assert.strictEqual(fresh.bridge_plan.current_stage, 'social_topic');
assert.strictEqual(fresh.bridge_plan.destination, 'fitness_context');
assert.strictEqual(fresh.bridge_plan.move_this_turn, 'hold');
assert.strictEqual(fresh.bridge_plan.distance_to_fitness, 3);
assert.strictEqual(fresh.bridge_plan.direct_fitness_question_allowed, false);

const plan = normalizeBridgePlan({
    current_anchor: 'their dog gets them outside before work',
    current_stage: 'life_rhythm',
    destination: 'fitness_context',
    next_adjacent_step: 'reflect that the morning walk anchors their day',
    move_this_turn: 'advance_one_step',
    distance_to_fitness: 2,
    evidence: 'they said the dog forces an early walk',
    direct_fitness_question_allowed: false,
});
assert.strictEqual(plan.current_stage, 'life_rhythm');
assert.strictEqual(plan.distance_to_fitness, 2);
assert.strictEqual(plan.direct_fitness_question_allowed, false);
assert.strictEqual(normalizeBridgePlan({
    current_stage: 'social_topic',
    direct_fitness_question_allowed: true,
}).direct_fitness_question_allowed, false, 'a social-stage plan cannot authorize a blunt fitness question');
assert.strictEqual(normalizeBridgePlan({
    current_stage: 'fitness_context',
    direct_fitness_question_allowed: true,
}).direct_fitness_question_allowed, true);

const psychology = normalizeConversationPsychology({
    need_right_now: 'confidence',
    change_talk_strength: 'moderate',
    confidence_signal: 'low',
    friction_type: 'overwhelm',
    allowed_move: 'affirm',
    objection_type: 'past_failure',
    decision_state: 'weighing',
    objection_evidence: 'I never stick with anything',
    change_talk_evidence: 'I really want to get back into it',
    confidence_evidence: 'I never stick with anything',
    desired_direction: 'feel active again',
    current_pattern: 'stops when the week gets chaotic',
});
assert.strictEqual(psychology.need_right_now, 'confidence');
assert.strictEqual(psychology.allowed_move, 'affirm');
assert.strictEqual(psychology.change_talk_strength, 'moderate');
assert.strictEqual(psychology.objection_type, 'past_failure');
assert.strictEqual(psychology.decision_state, 'weighing');
assert.strictEqual(normalizeConversationPsychology({
    need_right_now: 'diagnose_them',
    allowed_move: 'pressure',
}).allowed_move, 'reflect', 'unsafe or unknown psychology moves must fall back to reflection');
assert.strictEqual(normalizeConversationPsychology({
    allowed_move: 'invite',
    objection_type: 'price',
    decision_state: 'weighing',
}).allowed_move, 'clarify', 'an unresolved objection cannot authorize another invite');
assert.strictEqual(normalizeConversationPsychology({
    allowed_move: 'bridge',
    objection_type: 'needs_thinking_time',
    decision_state: 'autonomy_pause',
}).allowed_move, 'pause', 'thinking time must stop sales escalation');
assert.strictEqual(normalizeConversationPsychology({
    allowed_move: 'invite',
    decision_state: 'clear_no',
}).allowed_move, 'pause', 'a clear no must stop sales escalation');

const normalized = normalizeQualifier({
    bridge_plan: plan,
    facts: {},
});
assert.deepStrictEqual(normalized.bridge_plan, plan);

const relationshipBlock = buildQualifierRelationshipBlock({
    ...normalized,
    bridge_plan: plan,
    conversation_psychology: psychology,
});
assert(relationshipBlock.includes('Private subtle bridge plan'));
assert(relationshipBlock.includes('life_rhythm -> fitness_context'));
assert(relationshipBlock.includes('Direct fitness question allowed: no'));
assert(relationshipBlock.includes('planning only, do not recite'));
assert(relationshipBlock.includes('Private ethical conversation psychology'));
assert(relationshipBlock.includes('Need right now: confidence'));
assert(relationshipBlock.includes('Objection: past_failure'));
assert(relationshipBlock.includes('Decision state: weighing'));
assert(relationshipBlock.includes('Never use it to pressure an offer'));

const qualifierSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/_lib/qualifier-engine.js'),
    'utf8'
);
assert(qualifierSource.includes('SUBTLE BRIDGE PLANNING'));
assert(qualifierSource.includes('move at most one step per lead turn'));
assert(qualifierSource.includes('"direct_fitness_question_allowed": false'));
assert(qualifierSource.includes('ETHICAL CONVERSATION PSYCHOLOGY'));
assert(qualifierSource.includes('never diagnose personality, trauma, mental health'));
assert(qualifierSource.includes('"change_talk_strength": "none"'));
assert(qualifierSource.includes('OBJECTION RESPONSE'));

const draftSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/ig-instant-draft.js'),
    'utf8'
);
assert(draftSource.includes('Follow the private subtle bridge plan one adjacent step at a time'));
assert(draftSource.includes('If the bridge plan says direct fitness question allowed = no'));
assert(draftSource.includes('psychology layer cannot authorize a pitch'));
assert(draftSource.includes('Treat objections as information about the decision'));

console.log('lead subtle bridge-plan tests passed');
