# Startup error debugging

Added 26 October 2026 after Jess's 13:08 Brisbane ReferenceError at dashboard.html:1:25 in the Instagram iPhone browser. The original missing symbol was not captured; its cause remains unconfirmed. Do not label it the separate Learn content-loading failure.

The privacy helper and app telemetry load first in dashboard.html. app_client_error records include missing_symbol, source_file/line/column and diagnostic startup-v1: safe stack file coordinates, browser family, elapsed time, document state and startup readiness flags. Raw messages, raw stacks, URLs, device identifiers and screen content are excluded. Errors before account availability remain queued in memory and flush through the existing authenticated activity path once ready; closing the page before login can still lose them.

Inspect subsequent production records with a read-only query:

```sql
select occurred_at, activity_data
from public.user_activity
where activity_type = 'app_client_error'
  and occurred_at > now() - interval '24 hours'
  and activity_data->'diagnostic'->>'debug_version' = 'startup-v1'
order by occurred_at desc
limit 30
```

Correlate by user_id and session_id with page_view/device records and surrounding activity. A line-1 dashboard error is insufficient to blame either Balance or an injected browser script. Use missing_symbol, safe stack coordinates and browser family before choosing a repair. No live client errors or messages should be generated as a test. Verification: node --test tests/telemetry-privacy.test.js tests/learning-content-startup.test.js.


## App-wide diagnostics v2

From 26 October, the same early-installed collector covers runtime errors,
unhandled promise rejections, failed first-party/Supabase HTTP requests,
network rejections, pending requests after 15 seconds, failed resources, and
caught Error objects passed to console.error. Explicit caught failures can use:

```js
window.reportBalanceAppError?.('save_workout', error, { code: error.code });
```

Operation names are static identifiers. Never pass client text or dynamic URLs.
Only the operation and validated code are accepted from the optional facts.
Request/response bodies, raw error/log messages, URL queries, headers, stored
credentials and form values are never collected. Resource/media failures are
signals, not proof an action was blocked; a slow request can subsequently succeed.

Each report has error_kind, issue_key, diagnostic release revision, last eight
control/navigation/connectivity breadcrumbs, startup state, screen, online state,
safe stack coordinates, usage-session and optional masked-replay IDs. Build stamps
come from Netlify COMMIT_REF. The existing admin replay page's error markers also
include request and handled-error signals; capture still respects its opt-out.

Repeated identical failures are sampled at most once per five seconds, with a
30-report/minute ceiling and bounded queues. Counts therefore mean recorded
reports, not all attempted actions. The most recent 25 identified error reports
survive a same-tab refresh in sessionStorage for up to 24 hours. Reports are
isolated by member; guests/admin previews are not uploaded. Closing the tab or
ending a WebView can lose pending records. Startup errors before identification
are held in memory, then attributed to the first identified account. Authenticated
uploads reuse event UUIDs with ON CONFLICT DO NOTHING so uncertain retries do not
duplicate stored events. No new database tables, public endpoints, client messages,
email notifications or competing monitoring automation are introduced.

Read current grouped issues through the authenticated admin connection:

```sql
select activity_data->>'issue_key' as issue_key,
       activity_data->>'error_kind' as kind,
       activity_data->>'operation' as operation,
       activity_data->>'source_file' as source_file,
       activity_data->>'missing_symbol' as missing_symbol,
       activity_data->>'status' as status,
       count(*) as recorded_reports,
       count(distinct user_id) as affected_members,
       min(occurred_at) as first_seen, max(occurred_at) as last_seen
from public.user_activity
where activity_type = 'app_client_error'
  and occurred_at > now() - interval '24 hours'
  and activity_data->'diagnostic'->>'debug_version' = 'app-diagnostics-v2'
group by 1,2,3,4,5,6
order by last_seen desc
limit 30
```

Inspect exact rows, client_time, release, trail and replay_session_id for a group
before choosing a cause. A 4xx can be an expected validation/auth/permission outcome;
never automatically mark it a confirmed product defect or auto-repair member data.
This browser collector cannot detect every silent wrong result, OS/native crash,
a browser killed before upload, or backend work that fails after returning success.
Correlate server failures with the endpoint/time and existing Netlify logs.

Validation: node --test tests/app-diagnostics.test.js tests/telemetry-privacy.test.js tests/session-replay.test.js.
