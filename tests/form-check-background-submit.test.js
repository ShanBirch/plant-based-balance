const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-formcheck.js'), 'utf8');

assert.match(
    source,
    /function queueFormCheckBackgroundSubmit\(job\)[\s\S]*setTimeout\(function \(\) \{[\s\S]*submitFormCheckInBackground\(job\);/,
    'form check videos should upload/send from a delayed background task'
);

assert.match(
    source,
    /function submitFormCheck\(\)[\s\S]*const pendingFile = formCheckState\.file;[\s\S]*closeFormCheck\(\);[\s\S]*queueFormCheckBackgroundSubmit\(\{/,
    'form check submit should snapshot the selected file, close the modal, then queue background submit'
);

assert.match(
    source,
    /Video uploading\. You can keep working out\./,
    'form check submit should tell workout users they can keep working out while upload runs'
);

assert.match(
    source,
    /async function submitFormCheckInBackground\(job\)[\s\S]*uploadFormCheckClip\(job\.userId, job\.file, job\.requestId\)[\s\S]*submitFormCheckRequest\(/,
    'background form check task should upload the clip and then send the form-check request'
);

console.log('form-check background submit test passed');
