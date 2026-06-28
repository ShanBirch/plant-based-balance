const assert = require('assert');

const {
    hasExerciseLibrarySupportIntent,
    findExerciseLibraryMatchDetails,
    findExerciseLibraryMatches,
    classifyExerciseLibrarySupport,
    buildExerciseLibrarySupportBlock,
} = require('../netlify/functions/_lib/exercise-library-search');

const mirandaThread = [
    'What can I list this machine under in the app?',
    'List that under seated Hip Abduction (machine).',
    'No seated option',
].join('\n');

assert.strictEqual(hasExerciseLibrarySupportIntent(mirandaThread), true);

const matches = findExerciseLibraryMatches(mirandaThread);
assert.ok(matches.includes('Machine Seated Abduction'), 'should find the exact seated machine abduction library name');
assert.ok(
    matches.indexOf('Machine Seated Abduction') < matches.indexOf('Cable Hip Abduction') || !matches.includes('Cable Hip Abduction'),
    'seated machine match should outrank cable substitute'
);

const block = buildExerciseLibrarySupportBlock({
    currentMessage: 'No seated option',
    conversationText: 'Shannon: List that under seated Hip Abduction (machine).',
});
assert.match(block, /APP EXERCISE LIBRARY CHECK/);
assert.match(block, /Machine Seated Abduction/);
assert.match(block, /Do not say an exercise is missing/);
assert.match(block, /Do not recommend a substitute/);

const torsoQuestion = 'What should I put "torso rotation machine" in as? [PHOTO:https://example.com/machine.jpg]';
assert.strictEqual(hasExerciseLibrarySupportIntent(torsoQuestion), true);
const torsoDetails = findExerciseLibraryMatchDetails(torsoQuestion);
assert.ok(torsoDetails.some(row => row.name === 'Trunk Rotation'), 'torso should map to trunk rotation candidates');

const torsoSupport = classifyExerciseLibrarySupport({
    currentMessage: torsoQuestion,
});
assert.strictEqual(torsoSupport.isSupport, true);
assert.strictEqual(torsoSupport.requiresVisualVerification, true);
assert.strictEqual(torsoSupport.confusedFollowup, false);

const torsoBlock = buildExerciseLibrarySupportBlock({
    currentMessage: torsoQuestion,
});
assert.match(torsoBlock, /candidate/i);
assert.match(torsoBlock, /name match is only a candidate/i);
assert.match(torsoBlock, /closest label to log it under/i);

const confusedSupport = classifyExerciseLibrarySupport({
    currentMessage: 'No seated option',
    conversationText: 'Miranda: What can I list this machine under in the app?\nShannon: List that under seated Hip Abduction (machine).',
});
assert.strictEqual(confusedSupport.isSupport, true);
assert.strictEqual(confusedSupport.confusedFollowup, true);
const confusedBlock = buildExerciseLibrarySupportBlock({
    currentMessage: 'No seated option',
    conversationText: 'Miranda: What can I list this machine under in the app?\nShannon: List that under seated Hip Abduction (machine).',
});
assert.match(confusedBlock, /do not keep guessing/i);
assert.match(confusedBlock, /hang on, i'll check properly/i);

const noSupportBlock = buildExerciseLibrarySupportBlock({
    currentMessage: 'haha got it',
    conversationText: 'Shannon: nice one',
});
assert.strictEqual(noSupportBlock, '');

console.log('exercise-library-search tests passed');
