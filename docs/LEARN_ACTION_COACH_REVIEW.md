# Learn weekly actions: recording and confirmation

The six practical actions use `lib/learn-weekly-actions.js` as their shared instructions and completion criteria. This replaces the v2 self-confirmation checkbox. Meal, workout, community, setup and existing historical credits remain separate.

See the [live browser verification record](LEARN_ACTION_COACH_REVIEW_QA_2026_09_12.md).

| Week | Member records | Evidence required for coach confirmation |
| --- | --- | --- |
| 1 | Repeating pattern, situation/time and what immediately preceded it | Observation; no behaviour change required |
| 2 | Sleep/hunger/stress circumstances, choice and one possible change | A proposal; trying it is not required |
| 3 | Pattern from week 1/2, a change actually tried on an existing routine and outcome | Actual attempt; neither improvement nor three attempts required |
| 4 | Craving sequence, one routine change actually tried and outcome | Craving may be unchanged, different or absent |
| 5 | Discussion with one non-coach, feelings afterwards and motivation/support change or no change | Neutral or difficult conversations count; no identifying details required |
| 6 | Own saved tracker meal and explanation of its macros against personal daily targets | Snapshot of saved meal protein/carbohydrate/fat and daily targets; saving does not log eating |

## Member flow

Course → Balance Learn → Your Week → View the practical action. Save a reflection/plan here or after the selected lesson's perfect quiz. Other lesson reflections remain open-ended. Week 3 can display the earlier week 1/2 evidence.

Open the existing Friday–Sunday weekly check-in and select the course action week. Complete its report fields and send the check-in. An incomplete report is saved without completion; a full report becomes **Submitted — awaiting review**. The weekly check-in itself remains valid without a completed action. A coach request is **More information needed**, with the saved note visible to the member. Resubmit through the same check-in.

Only an authorized coach's **Confirm completion** moves a submitted record to **Completed** and gives the practical action its course tick. Reopening refreshes the saved record. Completed evidence remains viewable and immutable. Historic v2 completions are visibly retained as earlier credit.

## Normal coach check-in flow

Needs You → the member's weekly check-in → **Review Learn actions**. The same control is available in the client record. The panel shows instructions, reflection, actual report, saved meal/targets where applicable, criteria, status and review note. Review every required detail, then enter a reason and choose **Confirm completion** or **Request more information**. Sending a chat reply does not confirm an action. No new scheduler or outbound-message queue is introduced.

## Durable records and authorization

`learn_action_enrollments` scopes course runs by member, course and enrollment. `learn_action_reviews` additionally keys week and versioned action. `learn_action_review_events` preserves before/after evidence and actor. Re-enrollment creates a separate run; earlier runs remain reviewable. Member read access is owner-only; assigned active coaches and super-admins can review. Direct member writes and RPC execution are revoked. Server operations use authenticated identity and compare the expected revision under a row lock; stale reviews cannot approve changed evidence.

Authenticated endpoint: `GET /.netlify/functions/learn-action-review` (coach adds `client_id`, optional `enrollment_id`). Review `POST` includes `operation` (`approve` or `request_information`), exact `client_id`, `enrollment_id`, `week`, current `revision` and `note`. Members submit reports only through `submit-weekly-checkin`, using `learn_action` with `enrollment_id`, `week`, `revision`, `answers` and optional `meal_id`. The server resolves saved meal ownership and daily targets; client-supplied macros cannot replace them.

## Shannon-requested check-ins

The weekly-client-checkin skill must inspect these records alongside lessons and weekly reports. Preserve the exact member, enrollment, week, revision, review criteria and report dates. An older week reported during the current weekly check-in is labelled as an older course action, never silently mixed into current-week activity. Where Shannon authorizes completion review, confirm supported submitted actions through the normal authenticated review operation and read back the result. Otherwise include the proposed confirmation or information request in the draft. A request to draft a message does not authorize modifying course completion or sending it.

Do not infer actual attempts from an intention, empty report, lesson open, quiz result or checkbox. No action is auto-approved by an AI draft or a scheduled job.
