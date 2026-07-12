const assert = require('assert');

const { _test } = require('../netlify/functions/instagram-webhook');

assert.deepStrictEqual(
    _test.graphMessageTrainingMetadata({
        direction: 'out',
        source: _test.IG_NATIVE_INBOX_MESSAGE_SOURCE,
    }),
    {
        author_type: 'shannon',
        delivery_origin: 'instagram_native_inbox',
        training_eligible: true,
        training_provenance: 'graph_echo_verified',
    },
    'native inbox echoes must be explicit, high-quality Shannon training data'
);

assert.deepStrictEqual(
    _test.graphMessageTrainingMetadata({
        direction: 'out',
        source: 'instagram_graph_food_photo_ack',
        metadata: _test.IG_GRAPH_SYSTEM_MESSAGE_LABEL,
    }),
    {
        author_type: 'balance_system',
        delivery_origin: 'instagram_graph_api',
        training_eligible: false,
        training_provenance: 'system_generated',
    },
    'Balance-generated Graph sends must stay out of Shannon training data'
);

assert.deepStrictEqual(
    _test.graphMessageTrainingMetadata({ direction: 'in', source: 'instagram_graph' }),
    {
        author_type: 'lead',
        delivery_origin: 'instagram_graph_webhook',
        training_eligible: false,
        training_provenance: null,
    },
    'lead messages must remain distinguishable from Shannon examples'
);

console.log('instagram native inbox training label checks passed');
