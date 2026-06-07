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
    dashboard.includes("const NEEDS_YOU_ALERT_TYPES = [...DM_ALERT_TYPES, 'onboarding_day_30', 'weekly_checkin'];"),
    'month-one milestones and actionable coach check-ins should be loaded into Needs You'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'weekly_checkin') return isCoachCheckinApprovalDraft(alert);"),
    'only actionable coach check-in approval drafts should enter Needs You'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'onboarding_day_30')"),
    'month-one milestones should have explicit Needs You operator-work handling'
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

console.log('admin Needs You AI confusion regex tests passed');
