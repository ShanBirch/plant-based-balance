const assert = require('assert');

const {
    stripObviousMediaReceiptPreamble,
} = require('../netlify/functions/ig-instant-draft')._test;

assert.strictEqual(
    stripObviousMediaReceiptPreamble('just listened to your voice note', { hasDecodedMedia: true }),
    ''
);

assert.strictEqual(
    stripObviousMediaReceiptPreamble('just listened to your voice note\nwow 5:30am starts is hectic', { hasDecodedMedia: true }),
    'wow 5:30am starts is hectic'
);

assert.strictEqual(
    stripObviousMediaReceiptPreamble('saw your photo, that curry looks unreal', { hasDecodedMedia: true }),
    'that curry looks unreal'
);

assert.strictEqual(
    stripObviousMediaReceiptPreamble('watched the video. that looked brutal', { hasDecodedMedia: true }),
    'that looked brutal'
);

assert.strictEqual(
    stripObviousMediaReceiptPreamble('just listened to your voice note', { hasDecodedMedia: false }),
    'just listened to your voice note'
);

console.log('media receipt preamble tests passed');
