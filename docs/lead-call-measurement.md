# Lead-to-call measurement

Shannon confirmed on 11 October 2026 that the current acquisition objective is a consented call, including remote prospects. The 3 October organic follower direction in the shared coaching conversation policy controls. Goal and blocker fields describe progress; they are not compulsory call gates.

## Weekly read-only report

`scripts/report-lead-call-funnel.mjs` emits one bounded SELECT for the authenticated Supabase connector, or renders its JSON result to Markdown. It contains no database mutation, sender or credentials. Save generated SQL, snapshots and reports in ignored `.codex-artifacts/lead-call/`, never public site assets. Running this utility does not schedule a recurring job.

Example:

```powershell
node scripts/report-lead-call-funnel.mjs --start 2026-10-04T00:00:00+10:00 --end 2026-10-11T15:12:00+10:00 --output .codex-artifacts/lead-call/query.sql
```

Execute that SELECT against the production project with the authenticated connector. Extract the returned `report` object into an ignored JSON file, then:

```powershell
node scripts/report-lead-call-funnel.mjs --snapshot .codex-artifacts/lead-call/snapshot.json --output .codex-artifacts/lead-call/report.md
```

For regular reporting use completed Monday-to-Monday Brisbane periods. For an interim audit state the exact cutoff and compare an equal-length previous period. Do not compare a partial week with an entire prior week. The report separates saved acquisition lanes, accounts, channels and transport provenance. Current metadata may misclassify old acquisition and client relationships; manually review eligibility before calculating conversion rates. Thread counts are not unique-person counts. Include unanswered outreach and declines; do not select only conversations that replied.

This diagnostic query filters both periods using current relationship metadata. It consequently excludes prospects linked as clients since acquisition. For eventual booking/purchase conversion use a frozen eligible acquisition cohort, retain every original assignee, and observe outcomes after assignment. Do not divide this report's purchases or bookings by its current unlinked activity counts.

## Evidence contract

Use complete, source-linked episodes. Keep recipient identifiers, exact message IDs, source receipts and raw excerpts in private ignored output. Committed learning contains aggregates and anonymised scenarios only.

Record these distinct observations: relevant fitness/nutrition context; explicit desired change; real blocker; openness to coaching; call invitation; explicit acceptance; booking handoff; actual confirmed booking; attended/no-show/cancelled; paid outcome. Count each person once per stage within a defined cohort, using verified identity rather than display-name joins. An old goal mentioned again is not a newly acquired goal. Do not treat a medical detail alone as a blocker or buyer intent. Do not count generated Story-context instructions as the lead's words.

`growth_outcome_events` already supports goal and blocker records. Before relying on any event, require its source message and exact supporting words. Missing event rows are a tracking gap, not zero outcomes. Qualifier stages and compressed memory may be stale or incorrect. Native Graph echoes can label automated browser messages as Shannon; automation attribution requires exact operator receipts, not the author label alone.

Confirmed bookings come from `balance_bookings`; signed DM attribution is saved in `metadata.ig_thread_id`. Reconcile calendar event IDs and reschedules. Report bookings created in the period separately from appointments scheduled in it. A calendar event confirms scheduling, not attendance. A lead saying yes or supplying a time confirms agreement, not a booking. Do not join on similar names or create bookings merely to make counts reconcile. Unknown attendance and paid-after-call outcomes stay unknown.

For global prospects preserve their actual timezone and phone/video preference. Resolve the timezone before confirming a time; Brisbane stays on UTC+10 while other locations can change offset. An appointment shown in a calendar's display timezone is not necessarily the prospect's local time.

## First experiment specification

Status: proposed, not launched. First verify capture, eligibility and call attribution. Do not alter sending, ownership, manual holds or personal-contact boundaries to run a test.

Hypothesis: a grounded desired-change question moves an eligible organic business conversation from training context toward a useful coaching conversation more often than another routine-only question.

- A: current short, contextual routine question.
- B: short reflection of the same training detail plus one desired-change question.
- Eligible cohort: verified organic business prospects at training-context stage with no already answered goal question, interview fatigue, call decline, existing client relationship, personal/manual hold or unresolved media context. Geography is not an exclusion by itself.
- Randomise 50/50 at canonical person level and persist experiment ID, variant, assignment time, starting stage and operator/prompt version across all operators. Unknown identity stays outside a unique-person experiment; never switch variants halfway through a conversation.
- Hold timing, offer facts, media and invitation policy constant. Keep fresh person-specific wording; test the conversational move, not a repeated script. Log crossovers and Shannon's manual interventions without dropping their assigned cohort.
- Primary pilot measure: proportion of assigned eligible prospects who state a relevant desired change within seven days. Diagnostic: relevant reply and voluntary blocker disclosure. Business follow-through: call acceptance, verified booking within fourteen days, attendance, purchase and Shannon's time. Keep a route that improves the pilot only provisionally until downstream results mature.
- Guardrails: declines, question fatigue, repeat invitations, unanswered price/inclusion questions, opt-outs and support/safety issues. Both variants must answer direct commercial questions; do not test withholding prices.
- Choose the minimum meaningful effect and sample target from the verified baseline before launch. Set the launch date, fixed decision date and observation window then. Review quality weekly without stopping merely because one arm briefly leads. With insufficient evidence report inconclusive.

Before launch the receipt must contain actual assignment checks, the primary KPI and denominator, sample calculation, guardrails, decision date and a verified end-to-end booking trace. The initial observational audit is not an A/B test.
