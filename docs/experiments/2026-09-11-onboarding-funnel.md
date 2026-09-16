# Ad to onboarding progress

Hypothesis: observing specific setup and walkthrough exits will identify the step limiting ad visitor activation, so the next onboarding improvement targets a measured bottleneck.

Variant/event contract: `onboarding_funnel_v1`, stored as first-party `lp_events.event_type=onboarding_progress`. Do not rename step keys within a comparison. Setup question keys and slide IDs are stable; tour copy changes that rename titles require preserving the original analytics key or starting a new version.

Primary KPI: setup completions among tracked entrants from ads. The initial report shows observed counts, not a historical or strictly sequential conversion rate. Date filters cover activity in the selected period, so returning participants can appear without their original entry.

Diagnostics: question/screen/tour views and completions; last recorded step; elapsed time on completed steps; payment gate/opened milestones; campaign and ad. Optional and transferred paths remain separate. Browser IDs are joined to authenticated accounts only when the browser maps unambiguously to one account in the window. Different anonymous devices can remain separate visitors. Test accounts, admin activity and browsers marked as test are excluded.

Attribution: retain allowlisted first and last UTMs and ad IDs. Resolve signed Meta handoff references against the canonical thread when valid; never infer verified paid attribution from a generic preview link. The From ads filter includes either verified Meta attribution or an explicit paid UTM medium. Unknown campaign/ad details remain unknown. Report campaigns use the entry attribution observed in the selected activity window. This is not a revenue ledger: a browser payment-open event is not a confirmed purchase.

Guardrails: do not collect onboarding answers, health values, names, email addresses, raw page URLs, or send these operational events to advertising pixels. Public events cannot supply authenticated user identity. Admin report requires server-verified Shannon login. Recording failure must not block onboarding; duplicate retries keep the event ID. No new client-facing overlays or onboarding behavior changes.

Decision date: 2026-09-25, or after at least 100 genuine ad entrants if later. No scheduled follow-up is created by this document. Do not treat quiet for 24 hours as confirmed abandonment, or old missing detail as zero drop-off. The report is Admin > Metrics > Ad to onboarding progress.

## 16 September course tracking audit

Course open/start/week/lesson/topic hooks now use the same authenticated first-party transport as onboarding. They were previously wired to an analytics function absent from the dashboard (and their event names were not accepted by the public landing-page collector).

Course events are stored separately as `lp_events.event_type=course_progress`, with `phase=course`, stable event/step, course ID, optional lesson/topic ID and week number. Account identity comes from the verified session; a valid signed handoff resolves the DM thread. No answers or ad pixel forwarding. Existing lesson completion and learning progress tables remain authoritative for completion. The onboarding report continues to select only onboarding_progress, so course activity does not change onboarding conversion counts. Course events are available in the database; this patch does not add a course analytics screen.

The selected Learn alternative's two-hour reminder also checks authenticated onboarding/course records linked to its thread before sending. Lookup failure stops the reminder. It does not retroactively infer that an anonymous page view is a signup.

Limits: event tracing, not session video/replay; anonymous cross-device visits may not join. In the seven-day audit there were 381 onboarding events, 260 authenticated, nine linked to a DM thread (entry events only). The completion tables held 529 lesson completions across 19 accounts, including tests. This does not establish a fully verified live DM-to-paid-course journey. Historical course starts missing before this fix cannot be recovered. Subscription events exist, but the five inspected in the seven-day window had no DM thread ID; do not report these as attributed DM conversions.

Validation: browser VM exercises the actual course adapters and authenticated transport; endpoint tests check server-owned identity and rejected invalid sessions; reminder tests check signup suppression, concurrent dispatch and incoming replies. Production acceptance is checked using a synthetic event marked test_mode, without creating lesson completions or sending DMs.
