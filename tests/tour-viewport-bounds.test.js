const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const source = html.slice(html.indexOf('  function getTourViewportBounds(){'), html.indexOf('  function layoutTourBubbleAndSpotlight('));

function fixture({ height = 568, inset = 0, bannerBottom = 134, viewport } = {}) {
  const properties = {};
  const overlay = {};
  const banner = { getBoundingClientRect: () => ({ bottom: bannerBottom }), getClientRects: () => bannerBottom ? [1] : [] };
  const bubble = { style: {}, getClientRects: () => [1], getBoundingClientRect() {
    return { top: 10, left: -20, width: Math.min(320, parseFloat(this.style.maxWidth)), height: Math.min(500, parseFloat(this.style.maxHeight)) };
  } };
  const ctx = {
    window: { innerHeight: height, innerWidth: 320, visualViewport: viewport,
      getComputedStyle: el => el === banner ? { visibility: 'visible' } : { paddingTop: Math.max(48, inset) + 'px', paddingBottom: '34px', paddingLeft: '18px', paddingRight: '18px' } },
    document: { getElementById: id => ({ 'guided-tour-overlay': overlay, 'guest-mode-banner': banner, 'guided-tour-bubble': bubble })[id],
      documentElement: { style: { setProperty: (key, value) => properties[key] = value } } },
    layoutTourBubbleAndSpotlight: () => { bubble.style.maxHeight = ''; }
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, properties, bubble, setBanner: bottom => { bannerBottom = bottom; } };
}

test('welcome remeasures wrapped, resized, hidden and reopened banners', () => {
  const f = fixture();
  assert.equal(f.ctx.syncTourViewport().top, 146);
  assert.equal(f.properties['--pbb-tour-available-height'], '388px');
  f.setBanner(176);
  assert.equal(f.ctx.syncTourViewport().top, 188);
  f.setBanner(0);
  assert.equal(f.ctx.syncTourViewport().top, 48);
  f.setBanner(134);
  assert.equal(f.ctx.syncTourViewport().top, 146);
});

test('all guide placements fit small portrait and landscape screens with safe-area fallbacks', () => {
  for (const height of [320, 375, 568, 667]) for (const inset of [0, 59]) for (const bannerBottom of [0, 110, 134]) {
    const f = fixture({ height, inset, bannerBottom });
    f.ctx.positionBubbleAndSpotlight(null, {});
    const bounds = f.ctx.getTourViewportBounds();
    assert.ok(parseFloat(f.bubble.style.top) >= bounds.top);
    assert.ok(parseFloat(f.bubble.style.top) + parseFloat(f.bubble.style.maxHeight) <= height - 90);
    assert.ok(parseFloat(f.bubble.style.left) >= bounds.left);
    assert.ok(parseFloat(f.bubble.style.left) + parseFloat(f.bubble.style.maxWidth) <= bounds.right);
    assert.equal(f.bubble.style.overflowY, 'auto');
  }
});

test('keyboard and browser-toolbar viewport changes reduce available height', () => {
  const f = fixture({ viewport: { offsetTop: 20, offsetLeft: 0, width: 320, height: 320 }, bannerBottom: 100 });
  const bounds = f.ctx.syncTourViewport();
  assert.equal(bounds.top, 112);
  assert.equal(bounds.bottom, 306);
  assert.equal(f.properties['--pbb-tour-available-height'], '194px');
});

test('welcome and full-page tour stops share bounds and react to banner size changes', () => {
  assert.match(html, /showMetaTourWelcome\(\)[\s\S]*?syncTourViewport\(\)/);
  assert.match(html, /new ResizeObserver\(function\(\)\{ if \(resizeHandler\) resizeHandler\(\); \}\)/);
  assert.match(html, /tourBannerObserver\.disconnect\(\)/);
  for (const id of ['coach-checkin-explainer', 'meta-ad-trial-inbox-preview', 'weekly-goals-modal']) {
    assert.ok(html.includes(`body:has(#guided-tour-overlay.active) #${id}`));
  }
});
