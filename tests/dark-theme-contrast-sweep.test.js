const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const css = fs.readFileSync(
    path.join(root, 'css', 'dashboard', 'pbb-premium-overlays.css'),
    'utf8'
);

function channel(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
    return 0.2126 * channel(channels[0])
        + 0.7152 * channel(channels[1])
        + 0.0722 * channel(channels[2]);
}

function contrast(foreground, background) {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('loads the cache-busted dark-theme contrast sweep', () => {
    assert.match(dashboard, /pbb-premium-overlays\.css\?v=99-settings-redesign/);
    assert.match(css, /Dark-theme contrast sweep/);
    assert.match(css, /#view-active-workout[^}]+\.exercise-note-input/s);
    assert.match(css, /#movement-archive #workout-list input/);
    assert.match(css, /#view-meals \.day-view \.hero-card/);
    assert.match(css, /#sleep \.recipe-card/);
    assert.match(css, /#coin-shop-modal \.coin-pack-option/);
    assert.match(css, /App-wide last line of defence for legacy inline light-mode fragments/);
});

test('Add Exercise suggestion badges keep paired readable colours in both themes', () => {
    const workoutScript = fs.readFileSync(
        path.join(root, 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
        'utf8'
    );

    assert.match(workoutScript, /data-add-exercise-suggestion-badge/);
    assert.match(workoutScript, /--add-exercise-badge-light:\$\{badgeTextLight\}/);
    assert.match(workoutScript, /--add-exercise-badge-dark:\$\{badgeTextDark\}/);
    assert.match(workoutScript, /data-add-exercise-solid-badge>YOURS/);
    assert.match(workoutScript, /data-add-exercise-solid-badge>ADDED/);
    assert.match(workoutScript, /fill:currentColor/);
    assert.match(css, /#add-exercise-modal \[data-add-exercise-suggestion-badge\][^}]+background: #f8fafc !important;[^}]+-webkit-text-fill-color:/s);
    assert.match(css, /html:not\(\[data-pbb-theme="light"\]\) #add-exercise-modal \[data-add-exercise-suggestion-badge\][^}]+background: #2a2418 !important;[^}]+-webkit-text-fill-color:/s);

    const badgePairs = [
        ['#7c5b18', '#f8fafc'],
        ['#166534', '#f8fafc'],
        ['#92400e', '#f8fafc'],
        ['#f5d98a', '#2a2418'],
        ['#86efac', '#2a2418'],
        ['#fbbf24', '#2a2418'],
        ['#120c18', '#d8b25e']
    ];

    for (const [foreground, background] of badgePairs) {
        assert.ok(
            contrast(foreground, background) >= 4.5,
            `${foreground} on ${background} should meet 4.5:1`
        );
    }
});
test('uses explicit WebKit text fill for contrast-sensitive dark controls', () => {
    const sweep = css.slice(css.indexOf('Dark-theme contrast sweep'));
    assert.match(sweep, /\.coach-note-text[^}]+-webkit-text-fill-color/s);
    assert.match(sweep, /\.exercise-note-input[^}]+-webkit-text-fill-color/s);
    assert.match(sweep, /#water-entry-sheet \.water-amount-btn[^}]+-webkit-text-fill-color/s);
    assert.match(sweep, /#movement-archive #workout-list input[^}]+-webkit-text-fill-color/s);
});

test('core dark-theme text and action pairs meet WCAG AA contrast', () => {
    const pairs = [
        ['#fffaf2', '#121212'],
        ['#d8cfe0', '#241b31'],
        ['#aaa2b0', '#121212'],
        ['#f5d98a', '#191919'],
        ['#120c18', '#d8b25e'],
        ['#8edcff', '#12212b'],
        ['#ff9a9a', '#111111']
    ];

    for (const [foreground, background] of pairs) {
        assert.ok(
            contrast(foreground, background) >= 4.5,
            `${foreground} on ${background} should meet 4.5:1`
        );
    }
});
