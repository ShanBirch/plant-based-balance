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
