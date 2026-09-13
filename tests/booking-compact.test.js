const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('book.html','utf8'),js=fs.readFileSync('booking.js','utf8');
test('public booking removes introductory paragraph and duplicate details',()=>{
 const intro=html.match(/<section class="booking-intro[^]*?<\/section>/)[0];
 assert.ok(!intro.includes('<p'));assert.ok(!html.includes('booking-trust-row'));
 assert.ok(!intro.includes('Google Meet'));assert.ok(html.includes('booking-timezone-note'));
});
test('booking context and Google Meet remain inside selected-time form',()=>{
 const form=html.match(/<form id="booking-form"[^]*?<\/form>/)[0];
 assert.ok(form.includes('booking-intro-copy'));assert.ok(form.includes('Google Meet'));
 assert.ok(!js.includes("byId('booking-length-note')."));
});
