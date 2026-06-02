const assert = require('assert');

const {
    LEARNING_REEL_TOPIC_LABELS,
    buildCuratedLearningReelQueries,
    curatedLearningReelSourceNames,
    findCuratedLearningReelSource,
    getCuratedLearningReelSources,
    learningReelCandidateRejectReason,
    scoreCuratedLearningReelCandidate
} = require('../netlify/functions/_lib/learning-reel-sources');

for (const topicId of Object.keys(LEARNING_REEL_TOPIC_LABELS)) {
    const sources = getCuratedLearningReelSources(topicId);
    assert.ok(
        sources.length >= 3,
        `${topicId} should have at least 3 curated reel sources`
    );
    const queries = buildCuratedLearningReelQueries(topicId, { perSource: 1 });
    assert.ok(
        queries.length >= sources.length,
        `${topicId} should generate source-specific YouTube queries`
    );
    assert.ok(
        queries.every(query => /shorts$/i.test(query)),
        `${topicId} queries should target shorts`
    );
}

assert.ok(
    curatedLearningReelSourceNames('neuroscience').some(name => name === 'Andrew Huberman'),
    'neuroscience should include Huberman'
);
assert.ok(
    curatedLearningReelSourceNames('neuroscience').some(name => name === 'Big Think'),
    'neuroscience should include a Lisa Feldman Barrett friendly source'
);
assert.ok(
    curatedLearningReelSourceNames('neuroscience').some(name => name === 'UCL'),
    'neuroscience should include a Karl Friston friendly academic source'
);

const trustedProteinCandidate = {
    topicId: 'protein_science',
    channelTitle: 'Jeff Nippard',
    channelId: 'UC68TLK0mAEzUyHx5x5k-S1Q',
    title: 'Protein Intake Explained for Muscle Growth #shorts',
    description: 'Evidence based protein intake basics for hypertrophy.',
    durationSec: 52,
    viewCount: 230000
};

assert.strictEqual(
    findCuratedLearningReelSource(trustedProteinCandidate, 'protein_science').id,
    'jeff_nippard'
);
assert.ok(
    scoreCuratedLearningReelCandidate(trustedProteinCandidate) > 100,
    'trusted protein candidate should score strongly'
);

const randomViralCandidate = {
    topicId: 'fat_loss_basics',
    channelTitle: 'Viral Fitness Hacks',
    title: 'Lose 10kg with this belly fat burner #shorts',
    description: 'Miracle detox cleanse for fast weight loss.',
    durationSec: 45,
    viewCount: 9000000
};

assert.strictEqual(
    learningReelCandidateRejectReason(randomViralCandidate, 'fat_loss_basics'),
    'blocked_topic_or_creator'
);
assert.strictEqual(
    scoreCuratedLearningReelCandidate(randomViralCandidate),
    -1000
);

const wrongTopicCandidate = {
    topicId: 'micronutrient_science',
    channelTitle: 'Jeff Nippard',
    title: 'Best Chest Exercise for Muscle Growth #shorts',
    description: 'Hypertrophy technique tips.',
    durationSec: 40,
    viewCount: 1200000
};

assert.strictEqual(
    learningReelCandidateRejectReason(wrongTopicCandidate, 'micronutrient_science'),
    'source_not_curated_for_topic'
);

console.log('learning reel source tests passed');
