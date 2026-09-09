const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../dashboard.html'), 'utf8');
const positioning = html.slice(html.indexOf('  function positionBubbleAndSpotlight'), html.indexOf('    if (step && step.featureView)', html.indexOf('  function positionBubbleAndSpotlight')));
test('workout positioning never scrolls the user back to the highlighted control', () => {
  assert.doesNotMatch(positioning, /scrollTourTargetBy\(|scrollIntoView\(|scrollTo\(|scrollBy\(/);
});
test('browse uses an in-flow guide and full workout viewport, with guarded continuation', () => {
  assert.match(positioning, /!workoutBrowse && step/);
  assert.match(positioning, /pager.before\(guide\)/);
  assert.match(positioning, /window.tourNext\(\)/);
  assert.match(positioning, /hidden = !\(activeTourGate && activeTourGate.complete\)/);
  assert.match(positioning, /target.classList.add\('tour-workout-arrow'\)/);
  assert.match(html, /tour-workout-browse #guided-tour-bubble,[\s\S]*?display:none !important/);
});
test('temporary browsing guide and glow are removed when the step exits', () => {
  const cleanup = html.slice(html.indexOf('  function resetTourTemporaryTargets'), html.indexOf('    var ptr', html.indexOf('  function resetTourTemporaryTargets')));
  assert.match(cleanup, /tour-workout-browse-guide.*remove\(\)/);
  assert.match(cleanup, /classList.remove\('tour-workout-arrow'\)/);
  assert.match(cleanup, /classList.remove\('tour-workout-browse'\)/);
});
