const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('WhatsApp inbox alerts remain visible and urgent in the incoming DM queue', () => {
    const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
    assert.match(
        dashboard,
        /incoming_dm:\s*\['incoming_dm',\s*'ig_incoming_dm',\s*'fb_incoming_dm',\s*'whatsapp_incoming_message'\]/
    );
    assert.match(dashboard, /whatsapp_incoming_message:\s*1/);
});
