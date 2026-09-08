const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../dashboard.html'), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .find(match => match[1].includes('function recoverQaTourStartup'))[1];

for (const mode of ['normal visit', 'already initialized', 'missing initializer']) {
  test(`QA recovery: ${mode}`, () => {
    let added = 0;
    const overlay = { dataset: {} };
    const context = {
      URLSearchParams,
      location: { search: mode === 'normal visit' ? '' : '?guidedTourQa=1' },
      window: mode === 'already initialized' ? { startFeatureTour() {} } : {},
      document: {
        readyState: 'complete',
        currentScript: { previousElementSibling: { tagName: 'SCRIPT', textContent: 'existing initializer' } },
        getElementById: id => id === 'guided-tour-overlay' ? overlay : null,
        createElement: () => ({}),
        body: { appendChild(script) {
          assert.equal(script.textContent, 'existing initializer');
          added++;
          context.window.startFeatureTour = () => {};
        } }
      }
    };
    vm.runInNewContext(source, context);
    assert.equal(added, mode === 'missing initializer' ? 1 : 0);
    assert.equal(overlay.dataset.qaStartup, mode === 'normal visit' ? undefined : mode === 'already initialized' ? 'available' : 'recovered');
  });
}
