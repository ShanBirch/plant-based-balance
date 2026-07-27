const assert = require('assert');

const queue = require('../netlify/functions/_lib/ig-next-action-queue');

assert.strictEqual(
    queue.cleanOwner('browser_dispatcher'),
    'browser_dispatcher',
    'browser dispatcher must be a valid atomic next-action owner'
);
assert.throws(
    () => queue.cleanOwner('browser_dispatcher_and_dm_manager'),
    /Invalid IG next-action owner/,
    'combined owners must remain invalid so one responder owns the thread'
);

console.log('ig browser-dispatch owner tests passed');
