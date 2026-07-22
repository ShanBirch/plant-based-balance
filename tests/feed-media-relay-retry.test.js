const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'netlify', 'edge-functions', 'upload-story-media.js'),
    'utf8'
);

assert.match(source, /const B2_UPLOAD_MAX_ATTEMPTS = 3/);
assert.match(source, /const B2_UPLOAD_ATTEMPT_TIMEOUT_MS = 8000/);
assert.match(source, /for \(let attempt = 1; attempt <= B2_UPLOAD_MAX_ATTEMPTS && !uploadData; attempt \+= 1\)/);
assert.match(source, /get a fresh upload URL for each attempt/i);
assert.match(source, /fetchB2WithTimeout\(`\$\{apiUrl\}\/b2api\/v2\/b2_get_upload_url`/);
assert.match(source, /fetchB2WithTimeout\(uploadUrl/);
assert.match(source, /return jsonResponse\(502, \{/);

const helpersSource = source.slice(0, source.indexOf('export default'));
const sandbox = {
    module: { exports: {} },
    setTimeout: (callback) => callback()
};
vm.runInNewContext(
    `${helpersSource}\nmodule.exports = { isRetryableB2UploadFailure };`,
    sandbox
);

const { isRetryableB2UploadFailure } = sandbox.module.exports;
assert.strictEqual(isRetryableB2UploadFailure(500, ''), true);
assert.strictEqual(isRetryableB2UploadFailure(503, 'service_unavailable'), true);
assert.strictEqual(isRetryableB2UploadFailure(429, 'too_many_requests'), true);
assert.strictEqual(isRetryableB2UploadFailure(401, 'expired_auth_token'), true);
assert.strictEqual(isRetryableB2UploadFailure(400, 'bad_request'), true);
assert.strictEqual(isRetryableB2UploadFailure(403, 'unauthorized'), true);
assert.strictEqual(isRetryableB2UploadFailure(413, 'file_too_large'), false);

console.log('feed media relay retry contract passed');
