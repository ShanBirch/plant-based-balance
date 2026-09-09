const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../dashboard.html'), 'utf8');
const positioning = html.slice(html.indexOf('  function positionBubbleAndSpotlight'), html.indexOf('    if (step && step.featureView)', html.indexOf('  function positionBubbleAndSpotlight')));
test('workout positioning never scrolls the user back to the highlighted control', () => {
  assert.doesNotMatch(positioning, /scrollTourTargetBy\(|scrollIntoView\(|scrollTo\(|scrollBy\(/);
});
test('all workout steps reuse the floating card without a dock or replacement card', () => {
  assert.match(positioning, /step && step.workoutEducation/);
  assert.doesNotMatch(positioning, /createElement\(|anchor.before|pager.before/);
  assert.doesNotMatch(positioning, /setProperty\('--tour-workout-dock'/);
  assert.match(positioning, /target.classList.add\('tour-workout-arrow'\)/);
  assert.doesNotMatch(html, /#view-active-workout\.tour-workout-docked\s*\{/);
  assert.doesNotMatch(html, /#tour-workout-browse-guide\s*\{/);
});
test('temporary browsing guide and glow are removed when the step exits', () => {
  const cleanup = html.slice(html.indexOf('  function resetTourTemporaryTargets'), html.indexOf('    var ptr', html.indexOf('  function resetTourTemporaryTargets')));
  assert.match(cleanup, /tour-workout-browse-guide.*remove\(\)/);
  assert.match(cleanup, /classList.remove\('tour-workout-arrow'\)/);
  assert.match(cleanup, /classList.remove\('tour-workout-browse'\)/);
});
