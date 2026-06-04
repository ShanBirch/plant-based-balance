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
    !curatedLearningReelSourceNames('neuroscience').some(name => name === 'UCL'),
    'neuroscience should not include Karl Friston-specific sources'
);
assert.ok(
    !curatedLearningReelSourceNames('neuroscience').some(name => name === 'Serious Science'),
    'neuroscience should not include Friston-heavy academic sources'
);
assert.ok(
    curatedLearningReelSourceNames('weight_training_technique').some(name => name === 'ATHLEAN-X'),
    'weight training technique should include ATHLEAN-X'
);
assert.ok(
    curatedLearningReelSourceNames('workout_motivation').some(name => name === 'Andrew Huberman'),
    'workout motivation should include Huberman'
);
assert.ok(
    curatedLearningReelSourceNames('workout_motivation').some(name => name === 'BJ Fogg'),
    'workout motivation should include habit-science sources'
);
assert.ok(
    curatedLearningReelSourceNames('bunny_reels').some(name => name === 'Sincerely, Cinnabun'),
    'bunny reels should include rabbit-specific sources'
);
assert.ok(
    curatedLearningReelSourceNames('bunny_reels').some(name => name === 'Lennon The Bunny'),
    'bunny reels should include Lennon The Bunny'
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

const trustedBunnyCandidate = {
    topicId: 'bunny_reels',
    channelTitle: 'Lennon The Bunny',
    title: 'Cute free roam rabbit binky #shorts',
    description: 'A pet rabbit does a happy bunny binky and flop.',
    durationSec: 32,
    viewCount: 140000
};

assert.strictEqual(
    findCuratedLearningReelSource(trustedBunnyCandidate, 'bunny_reels').id,
    'lennon_the_bunny'
);
assert.ok(
    scoreCuratedLearningReelCandidate(trustedBunnyCandidate) > 100,
    'trusted bunny candidate should score strongly'
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
