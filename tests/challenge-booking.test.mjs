import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {normalizeBookingSource, normalizeBookingAttribution} from '../netlify/functions/balance-booking.mts';

test('challenge consultation remains a distinct source without changing existing booking sources', () => {
    for (const source of ['plant_based_challenge', 'zoom_pt', 'weekly_checkin_pt', 'first_pt_session']) {
        assert.equal(normalizeBookingSource(source), source);
    }
    assert.equal(normalizeBookingSource('invented_source'), 'public_booking_page');
});

for (const callType of ['video','phone']) test(callType + ' challenge booking saves its campaign evidence and creates a consultation, retaining the configured duration', async () => {
    const savedFetch = globalThis.fetch, savedNetlify = globalThis.Netlify;
    const config = {SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',GOOGLE_CALENDAR_CLIENT_ID:'test',GOOGLE_CALENDAR_CLIENT_SECRET:'test'};
    globalThis.Netlify = {env:{get:name=>config[name] || ''}};
    const settings = {booking_enabled:true,event_name:'Call with Shannon',duration_minutes:60,minimum_notice_hours:1,booking_window_days:5,calendar_id:'primary',weekly_hours:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,[{start:'07:00',end:'15:00'}]]))};
    let inserted, calendar;
    globalThis.fetch = async (url, init = {}) => {
        const target = String(url);
        if (target.includes('balance_booking_settings')) return Response.json([settings]);
        if (target.includes('app_private_secrets')) return Response.json([{value:'test-refresh'}]);
        if (target.includes('oauth2.googleapis.com')) return Response.json({access_token:'test-access'});
        if (target.includes('/freeBusy')) return Response.json({calendars:{primary:{busy:[]}}});
        if (target.includes('/events?')) { calendar=JSON.parse(init.body);return Response.json({id:'test-event',hangoutLink:'https://meet.google.com/test'}); }
        if (target.endsWith('/balance_bookings') && init.method==='POST') { inserted=JSON.parse(init.body)[0];return Response.json([{id:'test-booking',...inserted}]); }
        if (target.includes('balance_bookings')) return Response.json([]);
        throw new Error('Unexpected request: '+target);
    };
    try {
        const availability = await (await handler(new Request('https://balance.test/api/booking?source=plant_based_challenge'))).json();
        assert.equal(availability.durationMinutes,60);
        const start = availability.dates[0].slots[0].start;
        const response = await handler(new Request('https://balance.test/api/booking',{method:'POST',body:JSON.stringify({source:'plant_based_challenge',name:'Test',email:'test@example.com',phone:'0400000000',callType,startsAt:start,attribution:{visitor_id:'visitor-test',utm_source:'instagram'},ptSessionsPerWeek:5})}));
        assert.equal(response.status,201);
        assert.equal(inserted.call_type,callType);
        assert.equal(Boolean(calendar.conferenceData),callType==='video');
        if(callType==='phone') assert.match(calendar.description,/Call this number:.*400000000/);
        assert.equal(inserted.metadata.source,'plant_based_challenge');
        assert.equal(inserted.metadata.attribution.visitor_id,'visitor-test');
        assert.equal(inserted.metadata.pt_sessions_per_week,null);
        assert.match(calendar.summary,/Summer Ready Shred consultation/);
        assert.equal(Date.parse(calendar.end.dateTime)-Date.parse(calendar.start.dateTime),60*60*1000);
    } finally { globalThis.fetch=savedFetch;globalThis.Netlify=savedNetlify; }
});

test('booking campaign evidence keeps browser identity and first/last touch but drops arbitrary fields', () => {
    const result = normalizeBookingAttribution({visitor_id:'visitor-123', session_id:'session-456',
        utm_campaign:'challenge', first_touch:{utm_source:'instagram', ad_id:'123', email:'private'},
        last_touch:{utm_source:'facebook'}, goal:'private', token:'secret', nested:{token:'secret'},
        utm_content:'x'.repeat(800), fbclid:{unexpected:'object'}});
    assert.equal(result.visitor_id, 'visitor-123');
    assert.equal(result.session_id, 'session-456');
    assert.deepEqual(result.first_touch, {utm_source:'instagram', ad_id:'123'});
    assert.deepEqual(result.last_touch, {utm_source:'facebook'});
    assert.equal(result.utm_content.length, 500);
    for (const key of ['goal','token','nested','fbclid']) assert.equal(result[key], undefined);
    for (const input of [null, [], 'invalid']) assert.deepEqual(normalizeBookingAttribution(input), {first_touch:{},last_touch:{}});
});

