const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
const match = dashboard.match(/const NEEDS_YOU_AI_CONFUSION_RE = (\/.+?\/i);/);

assert.ok(match, 'Needs You AI confusion regex should be present');

const regex = vm.runInNewContext(match[1]);

assert.ok(
    regex.test('Client explicitly asked whether this is AI/automated and the thread is too inconsistent for a safe self-reply.'),
    'stored Matty AI/automated reason should count as Needs You'
);

assert.ok(
    regex.test('Can you be straight with me...is this actually Shan replying, or is it an AI assistant trained to reply on your behalf?'),
    'direct AI authenticity question should count as Needs You'
);

assert.ok(
    dashboard.includes("const NEEDS_YOU_ALERT_TYPES = [...DM_ALERT_TYPES, 'general_idea', 'onboarding_day_30', 'weekly_checkin', 'first_workout', 'subscription_sale', 'custom_exercise_review'];"),
    'coach action receipts, month-one milestones, actionable weekly check-ins, first workouts, subscription sales, and exercise reviews should be loaded into Needs You'
);

assert.ok(
    dashboard.includes('function isCoachActionReceipt(alert)') &&
    dashboard.includes("data.subtype === 'coach_action_receipt'") &&
    dashboard.includes('if (isCoachActionReceipt(alert)) return true;') &&
    dashboard.includes('const directRows = [];') &&
    dashboard.includes('if (isCoachActionReceipt(row) || isAppSuggestionAlert(row)'),
    'completed coach action receipts should route into Needs You without opening all general ideas'
);

assert.ok(
    dashboard.includes('function isFormCheckNeedsYouAlert(alert)') &&
    dashboard.includes('if (isFormCheckNeedsYouAlert(alert)) return true;') &&
    dashboard.includes('isFormCheckNeedsYouAlert(row)'),
    'all form-check cards should route directly into Needs You'
);

assert.ok(
    dashboard.includes('function isCoachCheckinApprovalDraft(alert'),
    'coach check-in approval drafts should have a dedicated guard'
);

assert.ok(
    dashboard.includes('function isOverdueManualIgCheckin(alert'),
    'overdue manual IG check-ins should have a dedicated guard'
);

assert.ok(
    dashboard.includes('function normalizeClientManagerMarkerText(value)'),
    'client-manager review matching should normalize cron marker text'
);

assert.ok(
    dashboard.includes("String(value || '').toLowerCase().replace(/_/g, '-')"),
    'client-manager marker normalization should treat cron underscore sources like hyphenated markers'
);

assert.ok(
    dashboard.includes("].map(normalizeClientManagerMarkerText).join(' ');") &&
    dashboard.includes('markerText.includes(normalizeClientManagerMarkerText(marker))'),
    'client-manager review matching should normalize both alert source text and known marker text'
);

assert.ok(
    dashboard.includes("const explicitClientManagerNeedsYou = isDm && isExplicitClientManagerNeedsYou(alert);") &&
    dashboard.includes("return { allowed: true, reason: 'client_manager_review' };"),
    'explicit client-manager Needs You handoffs should be trusted by the Needs You reason gate'
);

assert.ok(
    dashboard.includes("const reviewRequiredFlag = data.client_manager_review_required === true || String(data.client_manager_review_required || '').toLowerCase() === 'true';") &&
    dashboard.includes('return needsYouFlag') &&
    dashboard.includes('|| reviewRequiredFlag'),
    'client-manager review-required flags should count as explicit Needs You routing'
);

assert.ok(
    dashboard.includes("reasonInfo.reason === 'client_media'"),
    'linked-client media handoffs should remain visible even when the alert has a draft'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'weekly_checkin') return isCoachCheckinApprovalDraft(alert) || isOverdueManualIgCheckin(alert);"),
    'only actionable weekly check-ins should move into Needs You'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'onboarding_day_30')"),
    'month-one milestones should have explicit Needs You operator-work handling'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'first_workout')"),
    'first workout alerts should have explicit Needs You operator-work handling'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'subscription_sale')") &&
    dashboard.includes("data.needs_you_reason === 'subscription_sale'") &&
    dashboard.includes("alert?.alert_type === 'subscription_sale' && needsYouHasOperatorWork(alert)"),
    'subscription sale alerts should explicitly route to Needs You'
);

assert.ok(
    dashboard.includes('function renderManualHandleActions(alert, hasMessage)') &&
    dashboard.includes("manual_ig_history_skipped: 'handle_only_no_linked_thread'"),
    'handle-only IG cards should support copy/open/manual-sent handling'
);

assert.ok(
    dashboard.includes("if (view === 'all') return true;"),
    'All DMs should include both client and lead DM alerts'
);

assert.ok(
    !dashboard.includes(".filter(a => !isNeedsYouRoutedDmAlert(a) && !needsYouHasOperatorWork(a, activeClientIds))"),
    'Needs You-routed DMs should remain visible in the DM unread list'
);

assert.ok(
    !dashboard.includes("if (isDmAlert && isNeedsYouRoutedDmAlert(alert))"),
    'New routed DM notifications should open the DM inbox, not bypass it'
);

assert.ok(
    dashboard.includes("const pending = alertsCache.filter(a => a.status === 'pending' && DM_ALERT_TYPES.includes(a.alert_type) && !isCocosDmAlert(a));"),
    'DM unread badge should count routed DMs while excluding the Cocos lane'
);

assert.ok(
    dashboard.includes("if (isNeedsYouRoutedDmAlert(alert) && reasonInfo.allowed && needsYouHasSuggestedDraft(alert)) return true;"),
    'explicitly routed DM drafts with allowed reasons should remain visible in Needs You'
);

assert.ok(
    dashboard.includes('function isFormCheckSelfTestNeedsYouAlert(alert)') &&
    dashboard.includes("data.is_form_check === true") &&
    dashboard.includes("data.self_test === true") &&
    dashboard.includes('if (isFormCheckSelfTestNeedsYouAlert(alert)) return true;') &&
    dashboard.includes('|| isFormCheckSelfTestNeedsYouAlert(row)) directRows.push(row);'),
    'Shannon form-check self-tests should remain visible in Needs You while the video draft is still pending'
);

assert.ok(
    dashboard.includes('&& !isNeedsYouRoutedDmAlert(alert)') &&
    dashboard.includes('&& isCocosMetaPayload(alert.data || {})'),
    'legacy Cocos classification should not hide DMs explicitly routed to Needs You'
);

const handoffMatch = dashboard.match(/function isLeadOnboardingHandoff\(alert\) \{[\s\S]+?\r?\n        \}\r?\n\s*\r?\n        function isClientManagerReviewedClientMessage/);
assert.ok(handoffMatch, 'lead onboarding handoff detector should be present');

const handoffContext = {
    DM_ALERT_TYPES: ['incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm'],
    FOLLOW_UP_ALERT_TYPES: ['dm_follow_up', 'ig_follow_up', 'fb_follow_up'],
    getSignupLinkHandoffUrl(alert) {
        const data = alert?.data || {};
        return String(data.signup_link_handoff_url || '').trim();
    },
    needsYouLatestText(alert) {
        const data = alert?.data || {};
        return String(data.message_preview || alert?.description || '');
    },
    getResolvedAlertMessage(alert) {
        const data = alert?.data || {};
        return String(alert?.suggested_message || data.suggested_message || data.draft_text || '');
    },
};

vm.runInNewContext(handoffMatch[0].replace(/\r?\n\s*function isClientManagerReviewedClientMessage[\s\S]*$/, ''), handoffContext);

assert.strictEqual(
    handoffContext.isLeadOnboardingHandoff({
        alert_type: 'ig_incoming_dm',
        suggested_message: 'a win is a win haha',
        data: {
            message_preview: 'a win is a win',
            qualifier: { stage: 'won', warmth_score: 96 },
            ig_thread_id: 'thread-kennedy',
            signup_link_handoff_url: 'https://future-balance.netlify.app/coaching.html',
        },
    }),
    false,
    'stored signup URL plus won stage should not turn normal banter into a Needs You link handoff'
);

assert.strictEqual(
    handoffContext.isLeadOnboardingHandoff({
        alert_type: 'ig_incoming_dm',
        suggested_message: "yeah sounds good, here's the link: https://future-balance.netlify.app/coaching.html",
        data: {
            message_preview: 'send me the link',
            qualifier: { stage: 'won', warmth_score: 96 },
            ig_thread_id: 'thread-ready',
            signup_link_handoff_url: 'https://future-balance.netlify.app/coaching.html',
        },
    }),
    true,
    'current link intent or a draft URL should still count as a live handoff'
);

console.log('admin Needs You AI confusion regex tests passed');
