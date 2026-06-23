const assert = require('assert');

const sendCoach = require('../netlify/functions/send-coach-reply')._test;
const sendIg = require('../netlify/functions/send-ig-reply')._test;
const scheduledWorker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

const fraAlert = {
    alert_type: 'ig_incoming_dm',
    client_name: 'Francesca Cavazzana',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        ig_username: 'cavazzanafrancesca',
    },
};

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(fraAlert, 'scheduled_worker'),
    true,
    'general send endpoint must block Fra from scheduled auto-send'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(fraAlert, 'auto_send'),
    true,
    'general send endpoint must block Fra from direct auto-send'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend({
        ...fraAlert,
        data: {
            channel: 'instagram',
            ig_username: 'cavazzanafrancesca',
        },
    }, 'admin_dashboard_alert_send'),
    false,
    'manual dashboard approval should still send a normal pending Fra draft'
);

assert.strictEqual(
    sendIg.shouldBlockPermanentNeedsYouAutomatedIgSend({
        alert: fraAlert,
        alertData: fraAlert.data,
        source: 'scheduled_worker',
    }),
    true,
    'IG sender must block Fra from scheduled auto-send'
);

assert.strictEqual(
    sendIg.shouldBlockPermanentNeedsYouAutomatedIgSend({
        alert: fraAlert,
        alertData: fraAlert.data,
        source: 'admin_dashboard_alert_send',
    }),
    true,
    'auto-send scheduled rows stay blocked even if forwarded with a manual-looking source'
);

assert.deepStrictEqual(
    scheduledWorker.buildPermanentNeedsYouHold(fraAlert),
    {
        code: 'always_needs_you_person',
        label: 'permanent Needs You client',
    },
    'scheduled worker should hold Fra before any queued reply is sent'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend({
        alert_type: 'ig_incoming_dm',
        client_name: 'Sarah',
        data: { channel: 'instagram', scheduled_via: 'auto_send' },
    }, 'scheduled_worker'),
    false,
    'guard should stay scoped to permanent Needs You people'
);

console.log('permanent Needs You auto-send block tests passed');
