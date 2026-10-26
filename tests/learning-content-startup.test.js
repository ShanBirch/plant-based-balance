const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('lib/learning-inline.js', 'utf8');
const player = source.slice(0, source.indexOf('    // STATE')) + 'window.loadedLessons = LESSONS; window.starts = (window.starts || 0) + 1;})();';
function harness(fail = false) {
  const window = {};
  const requests = [], warnings = [];
  const context = vm.createContext({ window, console: { warn: (...args) => warnings.push(args) }, setTimeout: () => 1, clearTimeout() {}, document: {
    createElement: () => ({ remove() {} }),
    head: { appendChild(script) {
      requests.push(script.src);
      queueMicrotask(() => {
        if (fail) { fail = false; script.onerror(); return; }
        vm.runInContext(fs.readFileSync(script.src.split('?')[0], 'utf8'), context);
        script.onload();
      });
    } }
  } });
  return {window, requests, warnings, start: () => vm.runInContext(player, context)};
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('cold iOS startup loads real content before evaluating the player and shares concurrent requests', async () => {
  const h = harness();
  h.start(); h.start();
  assert.equal(h.window.loadedLessons, undefined);
  await settle();
  assert.equal(h.window.starts, 1);
  assert.equal(h.requests.length, 3);
  assert.equal(h.warnings.length, 0);
  assert.ok(h.window.loadedLessons['mind-0'].length > 0);
  assert.equal(h.window._pbbLearningContentReady, null);
});
test('a failed content download does not throw an app error and a later attempt recovers', async () => {
  const h = harness(true);
  h.start(); await settle();
  assert.equal(h.window.starts, undefined);
  assert.equal(h.window._pbbLearningContentReady, null);
  assert.equal(h.warnings.length, 1);
  h.start(); await settle();
  assert.equal(h.window.starts, 1);
  assert.ok(h.window.loadedLessons['mind-0'].length > 0);
});
