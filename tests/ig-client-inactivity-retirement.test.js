const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'supabase',
        'migrations',
        '20260729005712_retire_ig_client_inactivity_checkins.sql'
    ),
    'utf8'
);

assert.match(migration, /action_type = 'client_inactivity_checkin'/);
assert.match(migration, /status IN \('ready', 'waiting', 'claimed', 'needs_you', 'blocked'\)/);
assert.match(migration, /status = 'cancelled'/);
assert.match(migration, /client_inactivity_outreach_retired/);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.refresh_ig_client_inactivity_checkins/);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.complete_ig_client_inactivity_checkin/);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.ig_client_checkin_delivery_time/);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.ig_add_business_days/);
assert.match(migration, /DROP FUNCTION IF EXISTS public\.ig_business_days_between/);
assert.doesNotMatch(migration, /DELETE FROM public\.conversion_operator_events/i);
assert.doesNotMatch(migration, /DELETE FROM public\.ig_messages/i);

console.log('IG client inactivity outreach retirement contract verified');
