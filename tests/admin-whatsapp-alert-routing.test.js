const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('WhatsApp inbox alerts remain visible and urgent in the incoming DM queue', () => {
    const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
    assert.match(dashboard, /const DM_ALERT_TYPES = \['incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm', 'whatsapp_incoming_message', 'unread_message'\]/);
    assert.match(
        dashboard,
        /incoming_dm:\s*\['incoming_dm',\s*'ig_incoming_dm',\s*'fb_incoming_dm',\s*'whatsapp_incoming_message'\]/
    );
    assert.match(dashboard, /const _VM_DM_ALERT_TYPES = new Set\(\['incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm', 'whatsapp_incoming_message', 'unread_message'\]\)/);
    assert.match(dashboard, /whatsapp_incoming_message:\s*1/);
});
