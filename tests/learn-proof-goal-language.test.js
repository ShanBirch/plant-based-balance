const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePaidMetaTransformationProof } = require('../netlify/functions/_lib/paid-meta-proof-media');

test('losing interest or track does not become a weight-loss goal', () => {
    for (const goalText of ["I want to get fitter. The kids aren't stopping me, they actually join in. I lose interest when everything feels repetitive.", 'I want strength but lose track of my workouts.']) {
        assert.equal(resolvePaidMetaTransformationProof({ goalText })?.id, 'gen_strength_confidence');
    }
    assert.equal(resolvePaidMetaTransformationProof({ goalText: 'I lose interest in routines.' }), null);
});

test('explicit weight-loss and strength goals retain matching proof', () => {
    assert.equal(resolvePaidMetaTransformationProof({ goalText: 'I want to lose weight.' })?.id, 'ally_busy_weight_loss');
    assert.equal(resolvePaidMetaTransformationProof({ goalText: 'I want to lose 5kg.' })?.id, 'ally_busy_weight_loss');
    assert.equal(resolvePaidMetaTransformationProof({ goalText: 'I want to get stronger.' })?.id, 'gen_strength_confidence');
});
