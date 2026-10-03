import test from 'node:test';
import assert from 'node:assert/strict';
import { preCallConfirmationEmailContent } from '../netlify/functions/balance-booking.mts';
const details = { name: 'Lead', prettyDate: 'Tuesday', goal: 'Get stronger', callType: 'video', meetingUrl: 'https://meet.google.com/example', timezone: 'Australia/Brisbane' };
test('general booking emails include optional preparation and preserve meeting details', () => {
    const email = preCallConfirmationEmailContent(details);
    assert.match(email.html, /href="https:\/\/plantbased-balance.org\/pre-call.html"/);
    assert.match(email.text, /pre-call.html/);
    assert.match(email.text, /meet.google.com\/example/);
    assert.match(email.text, /only need to fill in one/);
});
test('explicit menopause or HRT context selects the menopause form', () => {
    for (const goal of ['I am menopausal', 'Perimenopause changes', 'Started HRT']) {
        const email = preCallConfirmationEmailContent({ ...details, goal });
        assert.match(email.html, /href="https:\/\/plantbased-balance.org\/menopause-pre-call.html"/);
        assert.doesNotMatch(email.html, /href="https:\/\/plantbased-balance.org\/pre-call.html"/);
    }
});
