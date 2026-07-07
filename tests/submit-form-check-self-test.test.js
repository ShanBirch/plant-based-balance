const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'netlify/functions/submit-form-check-request.js'), 'utf8');

assert.ok(
  !source.includes("Cannot send form check to yourself"),
  'Shannon admin self-tests should not be blocked by the form-check submit function'
);

assert.match(
  source,
  /if \(coachEmail !== BALANCE_ADMIN_EMAIL\) return json\(400, \{ error: 'Receiver is not a coach admin' \}\);[\s\S]*const isSelfTest = coachId === verified\.userId;/,
  'self-test detection should happen only after the receiver is verified as the Balance admin'
);

assert.match(
  source,
  /selfTest: isSelfTest/,
  'form-check submit response should identify Shannon self-test submissions'
);

console.log('submit form-check self-test guard passed');
