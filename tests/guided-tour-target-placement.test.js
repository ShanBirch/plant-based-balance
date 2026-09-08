const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const start = html.indexOf('    if (pageView) {', html.indexOf('function positionBubbleAndSpotlight'));
const end = html.indexOf('    const spaceBelow', start);
const place = new Function('step', 'r', 'bubble', 'vh', 'bubbleH', `
  const pageView = true, safeTop = 40, bottomReserve = 90, vw = 390;
  ${html.slice(start, end)}
`);

test('calendar reading prompt stays above the highlighted week', () => {
  const bubble = { style: {}, offsetWidth: 320 };
  place({ pageView: true }, { top: 575, bottom: 755 }, bubble, 844, 230);
  assert.ok(parseFloat(bubble.style.top) + 230 <= 575 - 18);
});

test('course action prompts stay clear on different phone heights', () => {
  for (const vh of [568, 667, 844, 915]) {
    for (const y of [100, 250, vh - 170]) {
      const bubble = { style: {}, offsetWidth: 260 };
      const rect = { top: y, bottom: y + 52 };
      place({ pageView: true, requiresHighlightedClick: true }, rect, bubble, vh, 190);
      const top = parseFloat(bubble.style.top);
      const height = bubble.style.maxHeight ? parseFloat(bubble.style.maxHeight) : 190;
      assert.ok(top + height <= rect.top - 18 || top >= rect.bottom + 18, `${vh}/${y}`);
      assert.ok(top >= 40 && top + height <= vh - 90);
    }
  }
});

test('large reading targets do not collapse their explanation to zero height', () => {
  const bubble = { style: {}, offsetWidth: 320 };
  place({ pageView: true }, { top: 45, bottom: 760 }, bubble, 844, 230);
  assert.equal(bubble.style.maxHeight, undefined);
});

test('workout inputs and navigation targets remain separate from the tour card', () => {
  for (const vh of [400,568,667,844,915]) {
    for (const y of [80,150,vh-160]) {
      const bubble={style:{},offsetWidth:320};
      const r={top:y,bottom:y+52};
      place({pageView:true,spotlightExplanation:true},r,bubble,vh,210);
      const top=parseFloat(bubble.style.top);
      const height=bubble.style.maxHeight ? parseFloat(bubble.style.maxHeight) : 210;
      assert.ok(top+height<=r.top-18 || top>=r.bottom+18, `${vh}/${y}`);
      assert.ok(top>=40 && top+height<=vh-90);
    }
  }
});

test('tour and feature reveal scripts parse', () => {
  for (const marker of ['GUIDED FEATURE TOUR', 'NEW FEATURE REVEAL']) {
    const begin = html.indexOf('<script>', html.indexOf(`<!-- ========== ${marker}`)) + 8;
    assert.doesNotThrow(() => new Function(html.slice(begin, html.indexOf('</script>', begin))));
  }
});

test('preview feed copy pairs theme ink with WebKit text fill', () => {
  assert.match(styles, /html \.meta-preview-feed-post p,[\s\S]*?color: var\(--text-main\) !important;\s*-webkit-text-fill-color: var\(--text-main\) !important;/);
  assert.match(styles, /html \.meta-preview-feed-post span \{\s*color: var\(--text-muted\) !important;\s*-webkit-text-fill-color: var\(--text-muted\) !important;/);
});

test('weekly goal hero keeps its cream surface and dark ink together in both themes', () => {
  assert.match(styles, /html\[data-pbb-theme\] #weekly-goals-modal \.weekly-goal-hero \{\s*background: linear-gradient\(135deg, #fffdf8 0%, #f4e6c8 100%\) !important;\s*color: #181713 !important;\s*-webkit-text-fill-color: #181713 !important;/);
});
