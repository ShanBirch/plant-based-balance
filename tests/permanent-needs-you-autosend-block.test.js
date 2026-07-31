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

const jazzAlert = {
    alert_type: 'ig_incoming_dm',
    client_name: 'Jazz',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        ig_username: 'jazz',
    },
};

const kayProgramUpdateAlert = {
    ...kayAlert,
    suggested_message: 'Yep, I can tweak that program for next week.',
    data: {
        ...kayAlert.data,
        message_preview: 'Can you update my program for next week?',
        scheduled_reply_text: 'Yep, I can tweak that program for next week.',
    },
};

const fraAppSupportFixAlert = {
    ...fraAlert,
    data: {
        ...fraAlert.data,
        support_exception: true,
        support_exception_reason: 'app_support_fast_fix',
        support_automation_authorized: true,
        support_issue_key: 'fra:program:exercise-swap:2026-07-31',
        support_reply_kind: 'verified_fix_complete',
        support_state: 'verified_fix_reply_ready',
        repair_verified_at: '2026-07-31T01:00:00.000Z',
        repair_verification_summary: 'Canonical program readback shows the requested exercise.',
        completion_reply_used: false,
        outbound_attempted: false,
    },
};
const fraFailedFixAckAlert = {
    ...fraAlert,
    data: {
        ...fraAlert.data,
        support_exception: true,
        support_exception_reason: 'app_support_fast_fix',
        support_automation_authorized: true,
        support_issue_key: 'fra:program:exercise-swap:2026-07-31',
        support_reply_kind: 'failed_fix_ack',
        support_state: 'failed_fix_ack_ready',
        completion_reply_sent_at: '2026-07-31T01:00:00.000Z',
        client_reported_still_broken_at: '2026-07-31T02:00:00.000Z',
        failed_fix_ack_used: false,
        outbound_attempted: false,
    },
};

const currentClientAlert = {
    alert_type: 'ig_incoming_dm',
    client_id: 'client-current',
    client_name: 'Current Client',
    data: {
        channel: 'instagram',
        ig_thread_id: 'thread-current',
        linked_user_id: 'client-current',
        scheduled_via: 'auto_send',
    },
};

const managerOwnedMirandaAlert = {
    alert_type: 'ig_incoming_dm',
    client_id: 'client-miranda',
    client_name: 'Miranda',
    data: {
        channel: 'instagram',
        ig_thread_id: 'thread-miranda',
        linked_user_id: 'client-miranda',
        client_manager_auto_reply_enabled: true,
        client_manager_browser_dispatch_enabled: true,
        custom_data: {
            client_manager_auto_reply_enabled: true,
            client_manager_browser_dispatch_enabled: true,
        },
    },
};
const managerOwnedMirandaThread = {
    id: 'thread-miranda',
    linked_user_id: 'client-miranda',
    custom_data: {
        client_manager_auto_reply_enabled: true,
        client_manager_browser_dispatch_enabled: true,
    },
};

assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(currentClientAlert, 'scheduled_worker'),
    true,
    'general send endpoint must block every current client from automated sending'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend({
        ...currentClientAlert,
        data: { ...currentClientAlert.data, scheduled_via: 'admin_dashboard' },
    }, 'admin_dashboard_alert_send'),
    false,
    'Shannon can still approve and send a current-client draft manually'
);
assert.strictEqual(
    scheduleReply.shouldBlockCurrentClientAutomatedSchedule(currentClientAlert, 'auto_send'),
    true,
    'automated scheduling must be blocked for every current client'
);
assert.strictEqual(
    scheduleReply.shouldBlockCurrentClientAutomatedSchedule(currentClientAlert, 'admin_dashboard'),
    false,
    'Shannon-approved Send Later remains available for current clients'
);
assert.strictEqual(
    sendIg.shouldBlockLinkedClientAutomatedIgSend({
        alert: currentClientAlert,
        alertData: currentClientAlert.data,
        source: 'balance_lead_client_manager_cron',
    }),
    true,
    'final Instagram transport must block every linked client from manager sending'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        managerOwnedMirandaAlert,
        'balance_lead_client_manager_cron',
        managerOwnedMirandaThread
    ),
    false,
    'the manager may send for an explicitly opted-in linked client'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        {
            ...managerOwnedMirandaAlert,
            data: { ...managerOwnedMirandaAlert.data, scheduled_via: 'auto_send' },
        },
        'scheduled_worker',
        managerOwnedMirandaThread
    ),
    true,
    'the linked-client exception must not open the scheduled worker lane'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        fraAppSupportFixAlert,
        'balance_app_repair_worker',
        { id: 'thread-fra', linked_user_id: 'client-fra' }
    ),
    false,
    'a repair worker may send one completion reply only after a verified support fix'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        fraFailedFixAckAlert,
        'balance_lead_client_manager_cron',
        { id: 'thread-fra', linked_user_id: 'client-fra' }
    ),
    false,
    'the DM manager may send the one failed-fix ownership acknowledgement'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        {
            ...fraAppSupportFixAlert,
            data: { ...fraAppSupportFixAlert.data, repair_verification_summary: '' },
        },
        'balance_app_repair_worker',
        { id: 'thread-fra', linked_user_id: 'client-fra' }
    ),
    true,
    'support completion must stay blocked when proof of repair is missing'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        {
            ...fraAppSupportFixAlert,
            data: { ...fraAppSupportFixAlert.data, support_automation_authorized: false },
        },
        'balance_app_repair_worker',
        { id: 'thread-fra', linked_user_id: 'client-fra' }
    ),
    true,
    'an explicit live support authorization is required for every automated completion'
);
assert.strictEqual(
    sendCoach.shouldBlockCurrentClientAutomatedSend(
        {
            ...fraFailedFixAckAlert,
            data: { ...fraFailedFixAckAlert.data, failed_fix_ack_used: true },
        },
        'balance_lead_client_manager_cron',
        { id: 'thread-fra', linked_user_id: 'client-fra' }
    ),
    true,
    'the failed-fix acknowledgement cannot be reused'
);
assert.strictEqual(
    sendIg.shouldBlockLinkedClientAutomatedIgSend({
        alert: managerOwnedMirandaAlert,
        alertData: managerOwnedMirandaAlert.data,
        thread: managerOwnedMirandaThread,
        source: 'balance_lead_client_manager_cron',
    }),
    false,
    'the final Instagram transport may send only for the manager-owned exception'
);
assert.strictEqual(
    sendIg.shouldBlockLinkedClientAutomatedIgSend({
        alert: {
            ...managerOwnedMirandaAlert,
            data: { ...managerOwnedMirandaAlert.data, scheduled_via: 'auto_send' },
        },
        alertData: { ...managerOwnedMirandaAlert.data, scheduled_via: 'auto_send' },
        thread: managerOwnedMirandaThread,
        source: 'scheduled_worker',
    }),
    true,
    'the final Instagram transport still blocks scheduled-worker delivery'
);
assert.strictEqual(
    sendIg.isManagerOwnedLinkedClientBrowserDispatch({
        alertData: managerOwnedMirandaAlert.data,
        thread: managerOwnedMirandaThread,
        source: 'balance_lead_client_manager_cron',
        lastInboundAt: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(),
    }),
    true,
    'the manager-owned Miranda reply may hand off to browser dispatch after the 24-hour API window'
);
assert.strictEqual(
    sendIg.isManagerOwnedLinkedClientBrowserDispatch({
        alertData: managerOwnedMirandaAlert.data,
        thread: managerOwnedMirandaThread,
        source: 'balance_lead_client_manager_cron',
        lastInboundAt: new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)).toISOString(),
    }),
    true,
    'native browser dispatch remains available when the inbound is older than Meta Human Agent seven-day coverage'
);
assert.strictEqual(
    sendIg.isManagerOwnedLinkedClientBrowserDispatch({
        alertData: managerOwnedMirandaAlert.data,
        thread: managerOwnedMirandaThread,
        source: 'balance_lead_client_manager_cron',
        lastInboundAt: new Date(Date.now() - (23 * 60 * 60 * 1000)).toISOString(),
    }),
    false,
    'the browser dispatcher must not compete while Miranda is still inside the API window'
);
assert.strictEqual(
    sendIg.isManagerOwnedLinkedClientBrowserDispatch({
        alertData: managerOwnedMirandaAlert.data,
        thread: {
            ...managerOwnedMirandaThread,
            last_outbound_at: new Date().toISOString(),
        },
        source: 'balance_lead_client_manager_cron',
        lastInboundAt: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(),
    }),
    false,
    'a newer Shannon outbound cancels browser fallback even when the old inbound is outside the API window'
);
assert.strictEqual(
    sendIg.isManagerOwnedLinkedClientBrowserDispatch({
        alertData: managerOwnedMirandaAlert.data,
        thread: {
            ...managerOwnedMirandaThread,
            custom_data: { client_manager_auto_reply_enabled: true },
        },
        source: 'balance_lead_client_manager_cron',
        lastInboundAt: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(),
    }),
    false,
    'browser dispatch still requires the separate live Miranda fallback flag'
);
const browserDispatchData = sendIg.markManagerBrowserDispatchFallback(managerOwnedMirandaAlert.data, {
    alertId: 'alert-miranda',
    actionId: 'action-miranda',
    lastInboundAt: new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString(),
    requestedAt: '2026-07-27T03:30:00.000Z',
});
assert.strictEqual(browserDispatchData.delivery_channel, 'instagram_browser_dispatcher');
assert.strictEqual(browserDispatchData.manual_ig_required, false);
assert.strictEqual(browserDispatchData.browser_dispatch_owner, 'browser_dispatcher');
assert.strictEqual(browserDispatchData.browser_dispatch_action_id, 'action-miranda');

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
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(jazzAlert, 'scheduled_worker'),
    true,
    'general send endpoint must block Jazz from scheduled auto-send'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(kayProgramUpdateAlert, 'scheduled_worker'),
    false,
    'general send endpoint should allow Kay program updates through auto-send'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(fraAlert, 'auto_send'),
    true,
    'general send endpoint must block Fra from direct auto-send'
);

assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend(fraAppSupportFixAlert, 'balance_app_repair_worker'),
    false,
    'general send endpoint should allow verified app-support fixes for permanent Needs You clients'
);
assert.strictEqual(
    sendCoach.shouldBlockPermanentNeedsYouAutomatedSend({
        ...fraAppSupportFixAlert,
        data: {
            ...fraAppSupportFixAlert.data,
            support_state: 'fix_attempted_client_confirmation_pending',
        },
    }, 'balance_app_repair_worker'),
    true,
    'a generic app-support flag must not bypass Needs You without the exact send-ready state'
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
        alert: jazzAlert,
        alertData: jazzAlert.data,
        source: 'scheduled_worker',
    }),
    true,
    'IG sender must block Jazz from scheduled auto-send'
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

assert.strictEqual(
    sendIg.shouldBlockPermanentNeedsYouAutomatedIgSend({
        alert: kayProgramUpdateAlert,
        alertData: kayProgramUpdateAlert.data,
        source: 'scheduled_worker',
    }),
    false,
    'IG sender should allow Kay program updates through auto-send'
);

assert.strictEqual(
    sendIg.shouldBlockPermanentNeedsYouAutomatedIgSend({
        alert: fraAppSupportFixAlert,
        alertData: fraAppSupportFixAlert.data,
        source: 'balance_app_repair_worker',
    }),
    false,
    'IG sender should allow verified app-support fixes for permanent Needs You clients'
);
assert.strictEqual(
    sendIg.shouldBlockLinkedClientAutomatedIgSend({
        alert: { ...fraAppSupportFixAlert, client_id: 'client-fra' },
        alertData: fraAppSupportFixAlert.data,
        thread: { id: 'thread-fra', linked_user_id: 'client-fra' },
        source: 'balance_app_repair_worker',
    }),
    false,
    'final Instagram transport should allow a strictly verified support completion'
);
assert.strictEqual(
    sendIg.shouldBlockLinkedClientAutomatedIgSend({
        alert: { ...fraFailedFixAckAlert, client_id: 'client-fra' },
        alertData: fraFailedFixAckAlert.data,
        thread: { id: 'thread-fra', linked_user_id: 'client-fra' },
        source: 'balance_lead_client_manager_cron',
    }),
    false,
    'final Instagram transport should allow one failed-fix acknowledgement'
);
assert.strictEqual(
    sendIg.shouldBlockLinkedClientAutomatedIgSend({
        alert: { ...fraFailedFixAckAlert, client_id: 'client-fra' },
        alertData: { ...fraFailedFixAckAlert.data, support_loop_guard: true },
        thread: { id: 'thread-fra', linked_user_id: 'client-fra' },
        source: 'balance_lead_client_manager_cron',
    }),
    true,
    'the support loop guard must close the final Instagram transport'
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

assert.deepStrictEqual(
    scheduledWorker.buildPermanentNeedsYouHold(jazzAlert),
    {
        code: 'always_needs_you_person',
        label: 'permanent Needs You client',
    },
    'scheduled worker should hold Jazz before a queued auto-send reply is sent'
);

assert.strictEqual(
    scheduledWorker.buildPermanentNeedsYouHold(kayProgramUpdateAlert),
    null,
    'scheduled worker should allow Kay program updates through auto-send'
);

assert.strictEqual(
    scheduledWorker.buildPermanentNeedsYouHold(fraAppSupportFixAlert),
    null,
    'legacy scheduled-worker support handling should not invent a permanent-person hold'
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
    scheduleReply.shouldBlockPermanentNeedsYouSchedule(jazzAlert, 'auto_send'),
    true,
    'auto-send scheduling should still be blocked for Jazz'
);

assert.strictEqual(
    scheduleReply.shouldBlockPermanentNeedsYouSchedule(kayProgramUpdateAlert, 'auto_send'),
    false,
    'auto-send scheduling should allow Kay program updates'
);

assert.strictEqual(
    scheduleReply.shouldBlockPermanentNeedsYouSchedule(fraAppSupportFixAlert, 'balance_lead_client_manager_cron'),
    false,
    'existing support exceptions may still be manually scheduled, while direct automated delivery has stricter proof gates'
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
