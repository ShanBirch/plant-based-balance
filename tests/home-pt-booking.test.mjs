import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {normalizeBookingSource} from '../netlify/functions/balance-booking.mts';

for (const callType of ['phone', 'video']) for (const homePtPackage of ['session', 'balance']) test(callType + ' ' + homePtPackage + ' home PT consultation keeps campaign attribution and reserves a call', async () => {
    assert.equal(normalizeBookingSource('home_pt'), 'home_pt');
    const savedFetch=globalThis.fetch, savedNetlify=globalThis.Netlify;
    const config={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',GOOGLE_CALENDAR_CLIENT_ID:'test',GOOGLE_CALENDAR_CLIENT_SECRET:'test'};
    globalThis.Netlify={env:{get:name=>config[name] || ''}};
    const settings={booking_enabled:true,event_name:'Call with Shannon',duration_minutes:60,minimum_notice_hours:1,booking_window_days:5,calendar_id:'primary',weekly_hours:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,[{start:'07:00',end:'15:00'}]]))};
    let inserted, calendar;
    globalThis.fetch=async (url,init={})=>{
        const target=String(url);
        if(target.includes('balance_booking_settings'))return Response.json([settings]);
        if(target.includes('app_private_secrets'))return Response.json([{value:'test-refresh'}]);
        if(target.includes('oauth2.googleapis.com'))return Response.json({access_token:'test-access'});
        if(target.includes('/freeBusy'))return Response.json({calendars:{primary:{busy:[]}}});
        if(target.includes('/events?')){calendar=JSON.parse(init.body);return Response.json({id:'test-event'});}
        if(target.endsWith('/balance_bookings')&&init.method==='POST'){inserted=JSON.parse(init.body)[0];return Response.json([{id:'test-booking',...inserted}]);}
        if(target.includes('balance_bookings'))return Response.json([]);
        throw new Error('Unexpected request: '+target);
    };
    try {
        const availability=await(await handler(new Request('https://balance.test/api/booking?source=home_pt'))).json();
        const response=await handler(new Request('https://balance.test/api/booking',{method:'POST',body:JSON.stringify({source:'home_pt',homePtPackage,name:'Test',email:'test@example.com',phone:'0400000000',callType,startsAt:availability.dates[0].slots[0].start,goal:'Tugun, build strength',ptSessionsPerWeek:3,attribution:{visitor_id:'visitor-test',session_id:'session-test',utm_source:'facebook',utm_medium:'organic_group',utm_campaign:'tugun_home_pt',utm_content:'currumbin_tugun_intro'}})}));
        assert.equal(response.status,201);
        assert.equal(inserted.metadata.source,'home_pt');
        assert.equal(inserted.metadata.home_pt_package,homePtPackage);
        assert.equal(inserted.metadata.pt_sessions_per_week,null);
        assert.equal(inserted.metadata.attribution.utm_campaign,'tugun_home_pt');
        assert.equal(inserted.metadata.attribution.visitor_id,'visitor-test');
        assert.equal(inserted.metadata.attribution.session_id,'session-test');
        assert.match(calendar.summary,/At-home personal training consultation/);
        assert.match(calendar.description, homePtPackage === 'balance' ? /Home PT \+ Balance/ : /Home personal training session/);
        assert.equal(inserted.call_type,callType);
        assert.equal(Boolean(calendar.conferenceData),callType==='video');
        assert.equal(Date.parse(calendar.end.dateTime)-Date.parse(calendar.start.dateTime),60*60*1000);
    } finally {globalThis.fetch=savedFetch;globalThis.Netlify=savedNetlify;}
});
