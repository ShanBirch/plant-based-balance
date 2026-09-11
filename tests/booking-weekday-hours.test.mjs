import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {buildSlotsForDate, buildAvailableDates} from '../netlify/functions/balance-booking.mts';
const settings={booking_enabled:true,event_name:'Call with Shannon',duration_minutes:60,minimum_notice_hours:24,booking_window_days:5,timezone:'Australia/Brisbane',calendar_id:'primary',location:'Google Meet',weekly_hours:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,d>0&&d<6?[{start:'07:00',end:'15:00'}]:[]]))};
test('five available dates skip weekends and fully booked days',()=>{
 const now=new Date('2026-09-11T22:00:00Z');
 assert.deepEqual(buildAvailableDates(settings,[],now).map(d=>d.date),['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18']);
 const busy=[{start:'2026-09-13T21:00:00Z',end:'2026-09-14T05:00:00Z'}];
 assert.deepEqual(buildAvailableDates(settings,busy,now).map(d=>d.date),['2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-21']);
 assert.deepEqual(buildAvailableDates(settings,[{start:'2026-09-01T00:00:00Z',end:'2027-01-01T00:00:00Z'}],now),[]);
});
test('one-hour weekday calls stay within 7am–3pm Brisbane, with no weekends',()=>{
 for(let day=14;day<=18;day++){
 const slots=buildSlotsForDate(settings,`2026-09-${day}`,[],new Date('2026-09-11T00:00:00Z'));
 assert.equal(slots.length,8);assert.equal(slots[0].start,`2026-09-${day-1}T21:00:00.000Z`);
 assert.equal(slots.at(-1).end,`2026-09-${day}T05:00:00.000Z`);
 for(const slot of slots)assert.equal(Date.parse(slot.end)-Date.parse(slot.start),3600000);
 }
 assert.equal(buildSlotsForDate(settings,'2026-09-19',[],new Date('2026-09-11')).length,0);
 assert.equal(buildSlotsForDate(settings,'2026-09-20',[],new Date('2026-09-11')).length,0);
});
test('busy periods and minimum notice remove overlapping calls',()=>{
 const slots=buildSlotsForDate(settings,'2026-09-14',[{start:'2026-09-13T22:30:00Z',end:'2026-09-13T23:30:00Z'}],new Date('2026-09-12T22:00:00Z'));
 assert.equal(slots.length,5);assert.equal(slots[0].start,'2026-09-14T00:00:00.000Z');
});
test('outside-hours submission is refused, and PT retains its 30-minute slot length',async()=>{
 const savedFetch=globalThis.fetch; const savedNetlify=globalThis.Netlify;
 globalThis.Netlify={env:{get:n=>n==='SUPABASE_URL'?'https://test.invalid':n==='SUPABASE_SERVICE_ROLE_KEY'?'test-key':''}};
 globalThis.fetch=async url=>Response.json(String(url).includes('balance_booking_settings')?[settings]:[]);
 try{
 const response=await handler(new Request('https://balance.test/api/booking',{method:'POST',body:JSON.stringify({name:'Test',email:'test@example.com',startsAt:'2026-09-14T20:00:00Z',bookingMode:'outside_hours'})}));
 assert.equal(response.status,400);assert.equal((await response.json()).error,'outside_hours_unavailable');
 const normal=await (await handler(new Request('https://balance.test/api/booking'))).json();
 const pt=await (await handler(new Request('https://balance.test/api/booking?source=weekly_checkin_pt'))).json();
 const first=await (await handler(new Request('https://balance.test/api/booking?source=first_pt_session'))).json();
 assert.equal(first.durationMinutes,30);assert.equal(normal.durationMinutes,60);assert.equal(pt.durationMinutes,30);
 }finally{globalThis.fetch=savedFetch;globalThis.Netlify=savedNetlify;}
});
