const assert = require('node:assert/strict');
const test = require('node:test');

const { _test } = require('../netlify/functions/ig-instant-draft');

test('extracts the private semantic media summary without affecting message chunks', () => {
    const raw = JSON.stringify({
        messages: ['Hahaha that is such a random photo 😂'],
        media_summary: 'A smiling woman is holding a small crocodile while a crowd watches indoors.',
    });

    assert.equal(
        _test.extractMediaSummaryFromDraftRawText(raw),
        'A smiling woman is holding a small crocodile while a crowd watches indoors.'
    );
    assert.deepEqual(
        _test.finalizeDraftChunksFromRawText(raw),
        ['Hahaha that is such a random photo 😂']
    );
});

test('missing or malformed media summaries stay empty so media review remains required', () => {
    assert.equal(_test.extractMediaSummaryFromDraftRawText('{"messages":["Nice haha"]}'), '');
    assert.equal(_test.extractMediaSummaryFromDraftRawText('Nice haha'), '');
});
