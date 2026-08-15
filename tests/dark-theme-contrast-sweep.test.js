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
    assert.match(dashboard, /pbb-premium-overlays\.css\?v=95/);
    assert.match(css, /Dark-theme contrast sweep/);
    assert.match(css, /#view-active-workout[^}]+\.exercise-note-input/s);
    assert.match(css, /#movement-archive #workout-list input/);
    assert.match(css, /#view-meals \.day-view \.hero-card/);
    assert.match(css, /#sleep \.recipe-card/);
    assert.match(css, /#coin-shop-modal \.coin-pack-option/);
    assert.match(css, /App-wide last line of defence for legacy inline light-mode fragments/);
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
