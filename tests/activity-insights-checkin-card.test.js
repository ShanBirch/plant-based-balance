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

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} should exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    throw new Error(`could not extract ${name}`);
}

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

test('Activity Insights keeps the weekly photo card simple', () => {
    const start = dashboard.indexOf('<div id="view-insights"');
    const end = dashboard.indexOf('<!-- ===== CHECK-IN PHOTO HISTORY VIEW ===== -->', start);
    const view = dashboard.slice(start, end);
    const cardStart = view.indexOf('<section id="insights-checkin-photo-card"');
    const cardEnd = view.indexOf('<!-- Body Weight Chart -->', cardStart);
    const card = view.slice(cardStart, cardEnd);

    assert.match(card, /id="insights-checkin-photo-card"/);
    assert.match(card, />Weekly check-in photos</);
    assert.match(card, />Take your photos</);
    assert.match(card, />View photo history</);
    assert.match(card, />View your photos</);
    assert.match(card, />Replace this week’s photos</);
    assert.doesNotMatch(card, />Front</);
    assert.doesNotMatch(card, />Side</);
    assert.doesNotMatch(card, />Back</);
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

    assert.doesNotMatch(dashboard, /class="insights-more-detail"/);
    assert.doesNotMatch(dashboard, /Journals and patterns/);
    assert.match(dashboard, /onclick="openWeeklyTrendsPage\('insights'\)"/);
});

test('the photo action is state-aware and refreshes after a successful save', () => {
    assert.match(insights, /getThisWeeksPhoto\(userId\)/);
    assert.match(insights, /dataset\.state = isComplete \? 'complete' : 'due'/);
    assert.match(insights, /Replace this week’s check-in photos\?/);
    assert.match(insights, /openCheckinPhotoHistoryView\(\)/);
    assert.match(photoFlow, /refreshInsightsCheckinPhotoCard/);
});

test('photo history is a dated full-screen view with linked weigh-ins', () => {
    assert.match(dashboard, /id="view-checkin-photo-history"/);
    assert.match(dashboard, /id="checkin-photo-history-list"/);
    assert.match(dashboard, /id="checkin-photo-lightbox"/);
    assert.match(insights, /notes\.saved_at/);
    assert.match(insights, /photo\.created_at/);
    assert.match(insights, /photo\.photo_week/);
    assert.match(insights, /progressPhotos\.getAll\(userId, 1000\)/);
    assert.match(insights, /weighIns\.getRecent\(userId, 1000\)/);
    assert.match(insights, /Same-day weight/);
    assert.match(insights, /Nearest weigh-in/);
    assert.match(insights, /days <= 3/);
    assert.match(insights, /pushNavigationState\('view-checkin-photo-history'/);
    assert.match(insights, /insightsView\.style\.display = 'block'/);
});

test('photo sets parse correctly and weight matching prefers the same date', () => {
    const helperNames = [
        '_parseCheckinPhotoNotes',
        '_getCheckinPhotoItems',
        '_getCheckinCaptureDate',
        '_getLocalDateKey',
        '_matchCheckinWeight'
    ];
    const helperSource = helperNames.map(name => extractFunction(insights, name)).join('\n');
    const helpers = new Function(`${helperSource}; return { ${helperNames.join(', ')} };`)();

    const notes = JSON.stringify({
        saved_at: '2026-09-01T02:00:00+10:00',
        shots: [
            { photo_url: 'front.jpg' },
            { photo_url: 'side.jpg' },
            { photo_url: 'back.jpg' }
        ]
    });
    const photo = { photo_week: '2026-08-31', photo_url: 'front.jpg', notes };
    const parsed = helpers._parseCheckinPhotoNotes(photo);
    assert.equal(helpers._getCheckinPhotoItems(photo, parsed).length, 3);

    const captureDate = helpers._getCheckinCaptureDate(photo, parsed);
    const exact = helpers._matchCheckinWeight(captureDate, [
        { weigh_in_date: '2026-09-01', weight_kg: 72.4 },
        { weigh_in_date: '2026-08-31', weight_kg: 72.8 }
    ]);
    assert.equal(exact.exact, true);
    assert.equal(exact.row.weight_kg, 72.4);

    const nearest = helpers._matchCheckinWeight(captureDate, [
        { weigh_in_date: '2026-08-31', weight_kg: 72.8 },
        { weigh_in_date: '2026-09-04', weight_kg: 72.2 }
    ]);
    assert.equal(nearest.exact, false);
    assert.equal(nearest.row.weigh_in_date, '2026-08-31');

    assert.equal(helpers._matchCheckinWeight(captureDate, [
        { weigh_in_date: '2026-09-05', weight_kg: 72.1 }
    ]), null);
});

test('the redesign stays inside the existing Home card entry', () => {
    assert.match(dashboard, /id="fitbit-performance-card" class="balance-insights-home-card" onclick="openInsightsView\(\)"/);
    assert.doesNotMatch(dashboard, /bottom-nav[^>]*insights|data-tab=["']insights/i);
});

test('feature discovery includes the photo card and new history screen', () => {
    assert.equal((dashboard.match(/activity-insights-checkin-photos-v1/g) || []).length, 1);
    assert.equal((dashboard.match(/checkin-photo-history-with-weight-v1/g) || []).length, 1);
    assert.ok((dashboard.match(/sel:\s*'#insights-checkin-photo-card'/g) || []).length >= 2);
    assert.ok((dashboard.match(/sel:\s*'#checkin-photo-history-list,#checkin-photo-history-empty,#checkin-photo-history-loading'/g) || []).length >= 2);
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
    assert.match(css, /html\[data-pbb-theme="light"\] #view-checkin-photo-history/);
    assert.match(css, /--pbb-insights-gold: #7a5918/);
    assert.match(css, /--pbb-insights-gold: #f5d98a/);
    assert.match(css, /--checkin-history-gold: #7a5918/);
    assert.match(css, /--checkin-history-gold: #f5d98a/);
});
