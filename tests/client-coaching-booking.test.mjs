import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/balance-booking.mts';

test('client coaching offers later weekdays, books 45 minutes, and rechecks busy time', async () => {
    const savedFetch = globalThis.fetch;
    const savedNetlify = globalThis.Netlify;
    const settings = { booking_enabled:true, duration_minutes:60, minimum_notice_hours:24,
        weekly_hours:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,d>0&&d<6?[{start:'07:00',end:'19:00'}]:[]])) };
    let busy = [];
    let inserted;
    globalThis.Netlify = { env:{get:n=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',GOOGLE_CALENDAR_CLIENT_ID:'fake',GOOGLE_CALENDAR_CLIENT_SECRET:'fake'}[n] || '')} };
    globalThis.fetch = async (url, init={}) => {
        const u=String(url);
        if(u.includes('balance_booking_settings')) return Response.json([settings]);
        if(u.includes('app_private_secrets')) return Response.json([{value:'fake-refresh'}]);
        if(u.includes('oauth2.googleapis.com')) return Response.json({access_token:'fake-access'});
        if(u.includes('/freeBusy')) return Response.json({calendars:{primary:{busy}}});
        if(u.includes('/events')) return Response.json({id:'fake-event',hangoutLink:'https://meet.google.com/fake'});
        if(u.includes('balance_bookings') && init.method==='POST') {
            inserted=JSON.parse(init.body)[0]; return Response.json([{id:'fake-booking',...inserted}]);
        }
        if(u.includes('balance_bookings')) return Response.json([]);
        throw new Error(`Unexpected request: ${u}`);
    };
    try {
        const normal=await (await handler(new Request('https://balance.test/api/booking'))).json();
        const client=await (await handler(new Request('https://balance.test/api/booking?source=client_coaching'))).json();
        assert.equal(normal.durationMinutes,60);
        assert.equal(normal.dates.length,5);
        assert.equal(client.durationMinutes,45);
        assert.equal(client.dates.length,10);
        assert(client.dates.at(-1).date > normal.dates.at(-1).date);
        const slot=client.dates.at(-1).slots[0];
        const body={source:'client_coaching',startsAt:slot.start,name:'Test client',email:'test@example.com',phone:'+61400000000',callType:'video'};
        const response=await handler(new Request('https://balance.test/api/booking',{method:'POST',body:JSON.stringify(body)}));
        assert.equal(response.status,201);
        assert.equal(Date.parse(inserted.ends_at)-Date.parse(inserted.starts_at),45*60*1000);
        assert.equal(inserted.metadata.source,'client_coaching');
        busy=[{start:slot.start,end:slot.end}];
        const conflict=await handler(new Request('https://balance.test/api/booking',{method:'POST',body:JSON.stringify(body)}));
        assert.equal(conflict.status,409);
        assert.equal((await conflict.json()).error,'slot_no_longer_available');
    } finally { globalThis.fetch=savedFetch; globalThis.Netlify=savedNetlify; }
});
