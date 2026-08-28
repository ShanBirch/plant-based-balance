const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const premiumOverlays = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function featureTourSource() {
  const start = dashboard.indexOf('<!-- ========== GUIDED FEATURE TOUR ========== -->');
  const end = dashboard.indexOf('<!-- ========== END NEW FEATURE REVEAL ========== -->');
  assert.ok(start >= 0, 'guided feature tour marker should exist');
  assert.ok(end > start, 'feature reveal end marker should follow the guided tour');
  return dashboard.slice(start, end);
}

test('walkthrough keeps surrounding page context readable', () => {
  const source = featureTourSource();

  assert.match(source, /rgba\(26,24,20,\.34\)/);
  assert.match(source, /#guided-tour-overlay\.tour-page-view #guided-tour-spotlight[\s\S]*?rgba\(26,24,20,\.08\)/);
  assert.doesNotMatch(source, /rgba\(26,24,20,\.76\)/);
  assert.match(premiumOverlays, /rgba\(26, 24, 20, 0\.34\)/);
  assert.match(premiumOverlays, /#guided-tour-overlay\.tour-page-view #guided-tour-spotlight[\s\S]*?rgba\(26, 24, 20, 0\.08\)/);
  assert.doesNotMatch(premiumOverlays, /#guided-tour-spotlight[\s\S]*?rgba\(29, 15, 50, 0\.78\)/);
  assert.match(dashboard, /pbb-premium-overlays\.css\?v=97-foundations-actions/);
  assert.match(serviceWorker, /pbb-app-v382-capture-guided-taps/);
});

test('page-level stops opt into the softer context view', () => {
  const source = featureTourSource();

  for (const title of [
    'Your meal plan',
    'Check your workout week',
    'Follow the exercise card',
    'See every meal on Day 1',
    'One shopping list for the week',
    'Read, then take the quiz',
    'The Balance community'
  ]) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      source,
      new RegExp(`title:'${escapedTitle}'[^\\n]*pageView:true|pageView:true[^\\n]*title:'${escapedTitle}'`),
      `${title} should preserve the full-page context`
    );
  }
});

test('Meta preview opens the next strength workout and waits for real proof media', () => {
  const source = featureTourSource();

  assert.match(source, /function getMetaPreviewStrengthDayIndex\(\)/);
  assert.match(source, /workoutId !== 'rest'/);
  assert.match(source, /!workoutId\.startsWith\('yoga-'\)/);
  assert.match(source, /!workoutId\.startsWith\('recovery-'\)/);
  assert.match(source, /window\.openCalendarWorkout\(dayIndex\)/);
  assert.match(source, /title:'Open your first workout'/);
  assert.match(source, /title:'Follow the exercise card'/);
  assert.match(source, /data-thumbnail-state="ready"/);
  assert.match(source, /title:'Open your first workout'[^\n]*return !!\(await openMetaPreviewStrengthWorkout\(\)\)/);
  assert.doesNotMatch(source, /title:'Open your first workout'[^\n]*advanceAfterAction:true/);
  assert.match(source, /title:'Follow the exercise card'[^\n]*waitForMetaPreviewWorkoutProof\(\{ requireThumbnail:true, timeoutMs:8000 \}\)/);
  assert.doesNotMatch(source, /title:'Follow the exercise card'[^\n]*openMetaPreviewStrengthWorkout\(\)/);
  assert.match(source, /tour-transitioning #guided-tour-bubble/);
  assert.match(source, /overlay\.classList\.add\('tour-transitioning'\)/);
  assert.match(source, /overlay\.classList\.remove\('tour-transitioning'\)/);
});

test('Meta preview waits for the rendered meal photo and includes the guided community stops', () => {
  const source = featureTourSource();

  assert.match(source, /function waitForMetaPreviewMealPhoto\(timeoutMs\)/);
  assert.match(source, /photo\.complete && photo\.naturalWidth > 0/);
  assert.match(source, /await waitForMetaPreviewMealPhoto\(30000\)/);
  assert.match(source, /title:'The Balance community'[^\n]*metaPreview:true/);
  assert.match(source, /title:'Post when you need support'[^\n]*metaPreview:true/);
});

test('guided tours and returning-user reveals both reset and apply page-view mode', () => {
  const source = featureTourSource();

  assert.match(source, /function positionBubbleAndSpotlight\(target, step\)[\s\S]*?classList\.toggle\('tour-page-view', pageView\)/);
  assert.match(source, /function positionReveal\(target, step\)[\s\S]*?classList\.toggle\('tour-page-view', pageView\)/);
  assert.ok((source.match(/if \(pageView\) \{/g) || []).length >= 2);
});
