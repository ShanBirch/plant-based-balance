const assert = require('assert');

const sendCoach = require('../netlify/functions/send-coach-reply')._test;
const sendIg = require('../netlify/functions/send-ig-reply')._test;
const scheduleReply = require('../netlify/functions/schedule-coach-reply')._test;
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

const kayAlert = {
    alert_type: 'ig_incoming_dm',
    client_name: 'Kay',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        ig_username: 'kay_balance',
    },
};

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(fraAlert, 'scheduled_worker'),
    true,
    'general send endpoint must block Fra from scheduled auto-send'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(kayAlert, 'scheduled_worker'),
    true,
    'general send endpoint must block Kay from scheduled auto-send'
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
            scheduled_via: 'admin_dashboard',
            ig_username: 'cavazzanafrancesca',
        },
    }, 'scheduled_worker'),
    false,
    'Fra manual Send Later from the dashboard should still fire through the scheduled worker'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend({
        ...fraAlert,
        data: {
            channel: 'instagram',
            scheduled_via: 'send_later',
            ig_username: 'cavazzanafrancesca',
        },
    }, 'scheduled_worker'),
    false,
    'Fra manual Android Send Later should still fire through the scheduled worker'
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

assert.strictEqual(
    sendIg.shouldBlockPermanentNeedsYouAutomatedIgSend({
        alert: fraAlert,
        alertData: {
            channel: 'instagram',
            scheduled_via: 'admin_dashboard',
            ig_username: 'cavazzanafrancesca',
        },
        source: 'scheduled_worker',
    }),
    false,
    'IG sender must allow Fra replies that Shannon explicitly scheduled later'
);

assert.deepStrictEqual(
    scheduledWorker.buildPermanentNeedsYouHold(fraAlert),
    {
        code: 'always_needs_you_person',
        label: 'permanent Needs You client',
    },
    'scheduled worker should hold Fra before a queued auto-send reply is sent'
);

assert.deepStrictEqual(
    scheduledWorker.buildPermanentNeedsYouHold(kayAlert),
    {
        code: 'always_needs_you_person',
        label: 'permanent Needs You client',
    },
    'scheduled worker should hold Kay before a queued auto-send reply is sent'
);

assert.strictEqual(
    scheduledWorker.buildPermanentNeedsYouHold({
        ...fraAlert,
        data: {
            channel: 'instagram',
            scheduled_via: 'admin_dashboard',
            ig_username: 'cavazzanafrancesca',
        },
    }),
    null,
    'scheduled worker should allow Shannon-approved Send Later for Fra'
);

assert.strictEqual(
    scheduleReply.shouldBlockPermanentNeedsYouSchedule(fraAlert, 'auto_send'),
    true,
    'auto-send scheduling should still be blocked for Fra'
);

assert.strictEqual(
    scheduleReply.shouldBlockPermanentNeedsYouSchedule(fraAlert, 'admin_dashboard'),
    false,
    'manual dashboard Send Later should be allowed for Fra'
);

assert.strictEqual(
    scheduleReply.shouldBlockPermanentNeedsYouSchedule(fraAlert, 'send_later'),
    false,
    'manual Android Send Later should be allowed for Fra'
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
