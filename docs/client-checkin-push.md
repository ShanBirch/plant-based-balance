# Client check-in reminders

Client-facing reminder for the Home / To Do Next reflection form, not a coach Needs You alert and not an unpublished coaching draft. Reuses native FCM/APNs and browser push through the existing dispatcher. Phone permission and a valid subscription remain required.

The scheduled worker checks every 15 minutes during Brisbane 08:00-20:45. It selects Wednesday (only explicitly assigned), or Friday-Sunday, after the first seven program days and onboarding completion. Each occurrence/week is claimed once in a service-only receipt table. Already submitted check-ins and test accounts are excluded. Twenty recipients per batch bounds runtime; the next run drains remaining eligible members. Existing subscription registration is the opt-in source.

Confirmed provider acceptance records sent_at. Ambiguous failures remain claimed to prevent double pushes; this is at-most-once dispatch, not a guarantee that the operating system displays the message. The diagnostic result remains available for repair; do not blindly clear receipts and resend.

Native remote and local foreground taps, browser service-worker taps and cold-start `?checkin=ready` all open the member form after user/profile readiness. Expired notifications show the normal availability message; completed actions show an already-completed message. The Wednesday opening gate now matches the assigned Wednesday form.

QA: focused Node tests plus existing check-in and admin push filter tests. Database rollback test selected 20 then 2 eligible members with zero overlap; authenticated users cannot claim notifications. No recipient records were retained by these dry runs. Browser fixture using the actual component verified cold URL entry, warm notification event, close/back/reopen, scrolling to Send, 320x568 light/dark and 568x320 dark. Screenshots show the existing 42px status-bar fallback and reachable bottom action; physical-device notification/tap confirmation remains separate.

Security advisor: the receipt table deliberately has RLS with no client policies and no anon/authenticated grants. Its informational no-policy notice is expected for this service-only table; see https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. Existing unrelated database findings were not changed.

Measurement: hypothesis is improved weekly reflection completion. Variant `client_checkin_ready_v1`; primary KPI submitted check-ins / eligible members, diagnostic provider-accepted / claimed and existing weekly_review_opened events, guardrails duplicate receipts and transport failures. Review after two weekly cycles (27 September 2026). No private reflection content is included in push copy.
