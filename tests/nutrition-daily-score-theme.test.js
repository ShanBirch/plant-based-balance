const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const guidance = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');

assert.match(css, /html\[data-pbb-theme\] \.score-popup-modal[\s\S]*-webkit-text-fill-color:\s*var\(--pbb-readable-text\)/);
assert.match(css, /\.score-popup-modal :where\([\s\S]*\.daily-insight-item[\s\S]*#popup-finish-hint[\s\S]*-webkit-text-fill-color:\s*var\(--pbb-readable-muted\)/);
assert.match(css, /\.score-popup-modal :where\(#popup-claim-btn, #popup-finish-day-btn\)[\s\S]*-webkit-text-fill-color:\s*var\(--pbb-readable-action-text\)/);
assert.match(css, /html\[data-pbb-theme="light"\][\s\S]*--pbb-readable-text:\s*#151515/);
assert.match(css, /html\[data-pbb-theme="dark"\][\s\S]*--pbb-readable-text:\s*#fffaf2/);
assert.match(dashboard, /pbb-premium-overlays\.css\?v=109-meal-tabs-no-top-divider/);
assert.match(guidance, /Every UI change must be checked in both light and dark mode\./);

console.log('nutrition daily score popup theme guards passed');
