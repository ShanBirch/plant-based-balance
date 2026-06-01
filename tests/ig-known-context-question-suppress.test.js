const assert = require('assert');

const {
    suppressAlreadyKnownContextQuestionsInDraftChunks,
} = require('../netlify/functions/ig-instant-draft')._test;

const context = `
Recent timestamped Instagram timeline:
Shannon: oh so cute, whats their name?
Pam: They are the dogs I house sat. Specter and Ocean
Shannon: Haha nice, Specter and Ocean are solid names.
`;

assert.deepStrictEqual(
    suppressAlreadyKnownContextQuestionsInDraftChunks([
        'Haha nice, Specter and Ocean are solid names. How long were you house sitting them for?',
    ], { contextText: context }),
    ['Haha nice, Specter and Ocean are solid names.'],
    'drafts should not ask house-sitting duration again in a solved pet thread'
);

assert.deepStrictEqual(
    suppressAlreadyKnownContextQuestionsInDraftChunks([
        'puppy love haha. what are their names?',
    ], { contextText: context }),
    ['puppy love haha.'],
    'drafts should not ask pet names again when the thread already knows them'
);

assert.deepStrictEqual(
    suppressAlreadyKnownContextQuestionsInDraftChunks([
        'so cute, whats their name?',
    ], { contextText: 'Them: a puppy just jumped on my couch' }),
    ['so cute, whats their name?'],
    'first-time pet name questions should still survive when there is no known pet context'
);

console.log('ig known-context question suppression tests passed');
