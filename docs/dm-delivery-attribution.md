# DM delivery attribution

Use `balance_dm_delivery_attribution(start_utc,end_utc)` for the daily conversation
review's outbound denominator. Brisbane midnight is 14:00 UTC on the preceding
date. The end is exclusive. Windows must be at most 31 days.

The service-only, read-only function joins all four historical outbound-ID
spellings across current actions and archived action versions. Story receipts
with no action-row thread must have an exact canonical thread and matching
username. Confirmed native proof, completed action and a recorded operator run
are required. Conflicting references, wrong direction/thread/source, uncertain
delivery, duplicate action claims and unproven authorship stay unknown.

Group verified sends by `operator_lane`: Story openers, follower welcomes and
reactive conversation replies are different cohorts. `author_type=shannon` on a
native import does not prove manual or AI authorship. Unknown does not mean failed.
The function never creates messages, modifies existing receipts, changes model
training eligibility, sends, or changes A/B/C assignments.

Future dispatcher completion receipts should consistently include
`canonical_outbound_message_id`, `source_message_id`, `claim_run_id`,
`native_verified:true`, `no_repeat:true`, actual `sent_at`, proof reference and
the conversation policy/review revision. Fill these only after exact native and
canonical readback. Save uncertain receipts immediately through the existing
completion path, without asserting verified delivery or retrying Send.

Daily review should save a versioned attribution result alongside its report,
including counts by lane, unknown count, exact window and function version.
Amend historical report metrics with dated corrections; preserve the original
report and never turn an improved join into claimed conversion improvement.
Keep full-history/media coverage gaps explicit and separate from attribution.

The approved A/B/C pilot still controls first/second/third reciprocal-conversation
timing. Reply-review or learning changes must record their effective revision
and be compared within the same assignment/lane and mature outcome window.
Neither a receipt nor an AI review score proves interest, enrolment or purchase.
