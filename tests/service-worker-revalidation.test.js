const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../sw.js'), 'utf8');

function worker(fail = false) {
  const handlers = {}, calls = [], writes = [];
  const response = { ok: true, clone() { return this; } };
  const offline = { offline: true };
  vm.runInNewContext(source, {
    self: { addEventListener(name, fn) { handlers[name] = fn; } }, URL,
    fetch: async (request, options) => { calls.push({ request, options }); if (fail) throw Error('offline'); return response; },
    caches: { open: async () => ({ put: async (...args) => writes.push(args) }), match: async () => offline }
  });
  return { calls, writes, response, offline, async request(path) {
    let pending;
    handlers.fetch({ request: { url: 'https://plantbased-balance.org' + path }, respondWith(p) { pending = p; } });
    return pending;
  } };
}

test('scripts and styles always revalidate while permitting unchanged HTTP cache bytes', async () => {
  for (const path of ['/js/dashboard/pbb-startup-shell.js?v=2-parallel-home', '/css/dashboard/dashboard-style-1.css?v=85']) {
    const w = worker();
    assert.equal(await w.request(path), w.response);
    assert.equal(w.calls[0].options.cache, 'no-cache');
    assert.equal(w.writes.length, 1);
  }
});
test('HTML still bypasses cache and offline fallback remains available', async () => {
  const w = worker(); await w.request('/dashboard.html');
  assert.equal(w.calls[0].options.cache, 'no-store');
  const offline = worker(true);
  assert.equal(await offline.request('/js/dashboard/pbb-startup-shell.js?v=2-parallel-home'), offline.offline);
});
