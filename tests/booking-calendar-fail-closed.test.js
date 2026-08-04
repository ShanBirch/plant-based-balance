const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('public booking fails closed when Google Calendar cannot be verified', () => {
    const bookingFunction = read('netlify/functions/balance-booking.mts');

    assert.match(bookingFunction, /if \(!google\.connected\) \{[\s\S]*?dates: \[\][\s\S]*?calendarConnected: false/);
    assert.match(bookingFunction, /if \(!google\.connected\) return null;/);
    assert.match(bookingFunction, /calendarReconnectRequired: google\.reconnectRequired/);
    assert.match(bookingFunction, /calendarConnectionIssue: google\.connectionIssue/);
});

test('booking settings validates the live Google connection and offers reconnection', () => {
    const bookingFunction = read('netlify/functions/balance-booking.mts');
    const settingsUi = read('booking-settings.js');

    assert.match(bookingFunction, /const calendarCheck = await googleBusyRanges/);
    assert.match(bookingFunction, /googleCalendarConnected: calendarCheck\.connected/);
    assert.doesNotMatch(bookingFunction, /googleCalendarConnected: Boolean\(refreshToken\)/);
    assert.match(settingsUi, /Google Calendar needs to be reconnected/);
    assert.match(settingsUi, /Reconnect Google/);
    assert.match(settingsUi, /New times are paused until Balance can protect your busy periods/);
});

test('both verified Shannon owner accounts can manage booking settings', () => {
    const bookingFunction = read('netlify/functions/balance-booking.mts');
    const settingsUi = read('booking-settings.js');

    assert.match(bookingFunction, /const ADMIN_EMAILS = new Set/);
    assert.match(bookingFunction, /shannonbirch@cocospersonaltraining\.com/);
    assert.match(bookingFunction, /shannonrhysbirch@gmail\.com/);
    assert.match(bookingFunction, /ADMIN_EMAILS\.has\(trimText\(user\.email/);
    assert.match(settingsUi, /signed in, but not with a Balance owner account/);
});
