const test=require('node:test'),assert=require('node:assert/strict');const {timing}=require('../netlify/functions/meal-shop-schedule');
test('daytime shop gets a same-day 7 pm Brisbane check-in',()=>{assert.equal(timing('2026-10-10','10:00',Date.parse('2026-10-08')).follow_up_at,'2026-10-10T09:00:00.000Z');});
test('late shop gets an hour after shopping, without moving to another day',()=>{assert.equal(timing('2026-10-10','20:30',Date.parse('2026-10-08')).follow_up_at,'2026-10-10T11:30:00.000Z');assert.throws(()=>timing('2026-10-10','23:30',Date.parse('2026-10-08')));});
test('invalid and past dates cannot schedule a message',()=>{assert.throws(()=>timing('bad','10:00'));assert.throws(()=>timing('2020-10-10','10:00'));});
