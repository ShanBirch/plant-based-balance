const assert = require('assert');

const {
    hasExerciseLibrarySupportIntent,
    findExerciseLibraryMatches,
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

const noSupportBlock = buildExerciseLibrarySupportBlock({
    currentMessage: 'haha got it',
    conversationText: 'Shannon: nice one',
});
assert.strictEqual(noSupportBlock, '');

console.log('exercise-library-search tests passed');
