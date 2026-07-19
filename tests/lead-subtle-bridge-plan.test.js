const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    freshQualifier,
    normalizeQualifier,
    normalizeBridgePlan,
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

const normalized = normalizeQualifier({
    bridge_plan: plan,
    facts: {},
});
assert.deepStrictEqual(normalized.bridge_plan, plan);

const relationshipBlock = buildQualifierRelationshipBlock({
    ...normalized,
    bridge_plan: plan,
});
assert(relationshipBlock.includes('Private subtle bridge plan'));
assert(relationshipBlock.includes('life_rhythm -> fitness_context'));
assert(relationshipBlock.includes('Direct fitness question allowed: no'));
assert(relationshipBlock.includes('planning only, do not recite'));

const qualifierSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/_lib/qualifier-engine.js'),
    'utf8'
);
assert(qualifierSource.includes('SUBTLE BRIDGE PLANNING'));
assert(qualifierSource.includes('move at most one step per lead turn'));
assert(qualifierSource.includes('"direct_fitness_question_allowed": false'));

const draftSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/ig-instant-draft.js'),
    'utf8'
);
assert(draftSource.includes('Follow the private subtle bridge plan one adjacent step at a time'));
assert(draftSource.includes('If the bridge plan says direct fitness question allowed = no'));

console.log('lead subtle bridge-plan tests passed');
