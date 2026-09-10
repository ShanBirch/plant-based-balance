const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/dashboard/pbb-premium-overlays.css'), 'utf8');

test('regular and in-page tour cards share one opaque gold/cream surface', () => {
  assert.match(css, /#guided-tour-overlay\.tour-page-view #guided-tour-bubble,\s*#guided-tour-bubble \{\s*background: var\(--pbb-tour-surface\) !important/);
  assert.match(css, /--pbb-tour-surface: linear-gradient\(145deg, #fffdf7, #f8f0de\)/);
  assert.doesNotMatch(css, /#guided-tour-bubble \{\s*background: #ffffff/);
  assert.match(css, /-webkit-text-fill-color: var\(--pbb-tour-ink\)/);
  assert.match(css, /#guided-tour-bubble #tour-gate-note,\s*#guided-tour-bubble \.tour-xp-note/);
  assert.match(css, /#guided-tour-bubble button:focus-visible/);
});

test('tour ink and progress labels meet contrast requirements in both themes', () => {
  const luminance = hex => {
    const c = hex.match(/\w\w/g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  for (const ink of ['151515','0c0c0c','795514']) {
    for (const surface of ['fffdf7','f8f0de','eee0bb']) {
      assert.ok((luminance(surface)+.05)/(luminance(ink)+.05) >= 4.5, `${ink} on ${surface}`);
    }
  }
});
