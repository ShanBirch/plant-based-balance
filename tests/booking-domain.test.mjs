import test from 'node:test';
import assert from 'node:assert/strict';
import {currentBookingDomain} from '../netlify/functions/balance-booking.mts';
test('legacy booking configuration resolves to the current domain without rewriting other hosts',()=>{
 assert.equal(currentBookingDomain('https://plantbased-balance.org'),'https://balanceneurosciencefitness.com');
 assert.equal(currentBookingDomain('https://plantbased-balance.org/book'),'https://balanceneurosciencefitness.com/book');
 assert.equal(currentBookingDomain('https://plantbased-balance.org.example/book'),'https://plantbased-balance.org.example/book');
});
