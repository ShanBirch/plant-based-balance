const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'ig_client_inactivity_checkins_migration.sql'),
    'utf8'
);
const businessDaysFix = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'ig_client_inactivity_business_days_fix.sql'),
    'utf8'
);

assert.match(migration, /client_inactivity_checkin/);
assert.match(migration, /INTERVAL '3 days'/);
assert.match(migration, /INTERVAL '7 days'/);
assert.match(migration, /INTERVAL '14 days'/);
assert.match(migration, /touch_count < 3/);
assert.match(migration, /p_now < s\.inactivity_anchor_at \+ INTERVAL '7 days'/);
assert.match(migration, /Australia\/Brisbane/);
assert.match(migration, /v_dow = 6/);
assert.match(migration, /v_dow = 0/);
assert.match(migration, /TIME '09:00'/);
assert.match(migration, /p_now - INTERVAL '72 hours'/);
assert.match(migration, /'browser_dispatcher'/);
assert.match(migration, /'instagram_native'/);
assert.match(migration, /'approval_required', FALSE/);
assert.match(migration, /'app_delivery_forbidden', TRUE/);
assert.match(migration, /canonical Instagram outbound readback does not match/);
assert.doesNotMatch(migration, /INSERT INTO public\.nudges/i);
assert.doesNotMatch(migration, /INSERT INTO public\.coach_alerts/i);

assert.match(businessDaysFix, /ig_add_business_days/);
assert.match(businessDaysFix, /ig_business_days_between/);
assert.match(businessDaysFix, /NOT IN \(0, 6\)/);
assert.match(businessDaysFix, /ig_add_business_days\(h\.inactivity_anchor_at, 3\)/);
assert.match(businessDaysFix, /ig_add_business_days\(h\.inactivity_anchor_at, 7\)/);
assert.match(businessDaysFix, /ig_add_business_days\(h\.inactivity_anchor_at, 14\)/);
assert.match(businessDaysFix, /ig_add_business_days\(h\.last_touch_at, 3\)/);
assert.match(businessDaysFix, /business_days_australia_brisbane/);
assert.match(businessDaysFix, /weekends_do_not_advance_count/);

console.log('IG client inactivity check-in migration contract verified');
