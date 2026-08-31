const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('dashboard.html');
const css = read('css/dashboard/dashboard-style-1.css');
const insights = read('js/dashboard/dashboard-script-2-activity_insights_view.js');
const photoFlow = read('js/dashboard/pbb-deferred-progressphoto.js');
const performance = read('js/dashboard/pbb-deferred-performance.js');

function channel(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
    return 0.2126 * channel(channels[0])
        + 0.7152 * channel(channels[1])
        + 0.0722 * channel(channels[2]);
}

function contrast(foreground, background) {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('Activity Insights replaces the four hub cards with one weekly photo action', () => {
    const start = dashboard.indexOf('<div id="view-insights"');
    const end = dashboard.indexOf('<div id="view-progress"', start);
    const view = dashboard.slice(start, end);

    assert.match(view, /id="insights-checkin-photo-card"/);
    assert.match(view, />Check-in photos</);
    assert.match(view, />Take photos</);
    assert.match(view, />View photos</);
    assert.match(view, />Replace set</);
    assert.doesNotMatch(view, /Nutrition &amp; Fuel/);
    assert.doesNotMatch(view, /Movement &amp; Power/);
    assert.doesNotMatch(view, /transformation-hub-card/);
    assert.doesNotMatch(view, /activity-insights-hub-card/);
});

test('all graphs remain and optional detail links are compact at the bottom', () => {
    for (const id of [
        'insights-bodyweight-container',
        'insights-calories-burned-container',
        'insights-daily-calories-container',
        'insights-sleep-container',
        'insights-volume-container',
        'insights-steps-container'
    ]) {
        assert.match(dashboard, new RegExp(`id="${id}"`));
    }

    assert.match(dashboard, /class="insights-more-detail"/);
    assert.match(dashboard, /onclick="openWeeklyTrendsPage\(\)"/);
    assert.match(dashboard, /onclick="openMovementWeeklyTrendsPage\(\)"/);
    assert.match(dashboard, /onclick="openRecoveryTrendsPage\(\)"/);
});

test('the photo action is state-aware and refreshes after a successful save', () => {
    assert.match(insights, /getThisWeeksPhoto\(userId\)/);
    assert.match(insights, /dataset\.state = isComplete \? 'complete' : 'due'/);
    assert.match(insights, /Replace this week’s front, side and back photos\?/);
    assert.match(insights, /openProgressFromHome\(\{ source: 'insights' \}\)/);
    assert.match(photoFlow, /refreshInsightsCheckinPhotoCard/);
    assert.match(performance, /source === 'insights'/);
    assert.match(performance, /insightsView\.style\.display = 'block'/);
});

test('the redesign stays inside the existing Home card entry', () => {
    assert.match(dashboard, /id="fitbit-performance-card" class="balance-insights-home-card" onclick="openInsightsView\(\)"/);
    assert.doesNotMatch(dashboard, /bottom-nav[^>]*insights|data-tab=["']insights/i);
});

test('feature discovery includes the new photo card in both systems', () => {
    assert.equal((dashboard.match(/activity-insights-checkin-photos-v1/g) || []).length, 1);
    assert.ok((dashboard.match(/sel:\s*'#insights-checkin-photo-card'/g) || []).length >= 2);
});

test('Balance light and dark text pairs meet WCAG AA', () => {
    const pairs = [
        ['#f8f7f2', '#121212'],
        ['#b7b1a2', '#121212'],
        ['#f5d98a', '#11100d'],
        ['#151515', '#ffffff'],
        ['#6f6a61', '#ffffff'],
        ['#7a5918', '#fffdf8'],
        ['#171208', '#d8b25e']
    ];

    for (const [foreground, background] of pairs) {
        assert.ok(
            contrast(foreground, background) >= 4.5,
            `${foreground} on ${background} should meet 4.5:1`
        );
    }

    assert.match(css, /html\[data-pbb-theme="light"\] \.insights-checkin-photo-card/);
    assert.match(css, /--pbb-insights-gold: #7a5918/);
    assert.match(css, /--pbb-insights-gold: #f5d98a/);
});
