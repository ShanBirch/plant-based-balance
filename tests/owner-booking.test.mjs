import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/balance-booking.mts';

test('owner date exception requires authentication and retains calendar and hours protections', async () => {
    const originalFetch = globalThis.fetch, originalNetlify = globalThis.Netlify;
    const config = {SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',GOOGLE_CALENDAR_CLIENT_ID:'test',GOOGLE_CALENDAR_CLIENT_SECRET:'test'};
    globalThis.Netlify = {env:{get:key=>config[key] || ''}};
    const start = new Date(); start.setUTCDate(start.getUTCDate()+21); start.setUTCHours(7,0,0,0);
    const startsAt = start.toISOString(), end = new Date(+start+3600000).toISOString();
    const settings = {booking_enabled:true,duration_minutes:60,minimum_notice_hours:2,calendar_id:'primary',weekly_hours:Object.fromEntries([0,1,2,3,4,5,6].map(day=>[day,[{start:'07:00',end:'19:00'}]]))};
    let email = 'stranger@example.com', busy = [], disconnected = false, inserts = 0;
    globalThis.fetch = async (url, init={}) => {
        const target=String(url);
        if(target.endsWith('/auth/v1/user')) return Response.json({email});
        if(target.includes('balance_booking_settings')) return Response.json([settings]);
        if(target.includes('app_private_secrets')) return Response.json([{value:'mock-refresh'}]);
        if(target.includes('oauth2.googleapis.com')) return disconnected ? Response.json({error:'invalid_grant'},{status:400}) : Response.json({access_token:'mock'});
        if(target.includes('/freeBusy')) return Response.json({calendars:{primary:{busy}}});
        if(target.includes('/events?')) return Response.json({id:'mock-event'});
        if(target.endsWith('/balance_bookings') && init.method==='POST') { inserts++; return Response.json([{id:'mock-booking',...JSON.parse(init.body)[0]}]); }
        if(target.includes('balance_bookings')) return Response.json([]);
        throw new Error(target);
    };
    const request=(auth=true,mode='owner_booking',time=startsAt)=>new Request(`https://balance.test/api/booking?mode=${mode}`,{method:'POST',headers:auth?{Authorization:'Bearer mock'}:{},body:JSON.stringify({name:'Test',email:'test@example.com',phone:'0400000000',callType:'phone',source:'plant_based_challenge',startsAt:time})});
    try {
        assert.equal((await handler(request(false))).status,401);
        assert.equal((await handler(request())).status,403);
        email='shannonrhysbirch@gmail.com';
        assert.equal((await handler(request(true,'public'))).status,409);
        busy=[{start:startsAt,end}];
        assert.equal((await handler(request())).status,409);
        busy=[]; disconnected=true;
        assert.equal((await handler(request())).status,409);
        disconnected=false;
        assert.equal((await handler(request(true,'owner_booking',startsAt.replace('T07:','T12:')))).status,409);
        assert.equal(inserts,0);
        assert.equal((await handler(request())).status,201);
        assert.equal(inserts,1);
    } finally { globalThis.fetch=originalFetch; globalThis.Netlify=originalNetlify; }
});
