const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const bundle = require('../netlify/modern-runtime/vendor/web-push.bundle.cjs');
const source = fs.readFileSync('netlify/functions/send-dm-notification.js','utf8').split("const crypto = require('crypto');")[0];
test('actual production vendor bundle resolves push methods', () => {
 for (const dependency of [bundle, bundle.default]) {
  const context = { __PBB_WEB_PUSH_DEPENDENCY__: dependency };
  vm.runInNewContext(source + '\nglobalThis.resolved = webpush;', context);
  assert.equal(typeof context.resolved.setVapidDetails, 'function');
  assert.equal(typeof context.resolved.sendNotification, 'function');
  const keys = context.resolved.generateVAPIDKeys();
  assert.doesNotThrow(()=>context.resolved.setVapidDetails('mailto:test@example.com',keys.publicKey,keys.privateKey));
 }
});
