# Ten-week Balance Learn, practical tasks retired

Approved by Shannon, 8 October 2026. Supersedes the earlier six-week pacing and compulsory practical-action rules. Preserve the current lesson/quiz styling.

## Delivery

All 49 lesson IDs and their flattened order match six_v2 exactly. The app's active course is ten_v1, independent of the historical action calendar.

| Week | Topic | Lessons |
| --- | --- | --- |
| 1 | Meet your brain: researchers, brain, cells, body messages, senses | 5 |
| 2 | How your brain predicts | 4 |
| 3 | Experience shapes reality | 5 |
| 4 | Work with your energy | 5 |
| 5 | The prediction-action loop and free energy | 5 |
| 6 | Build a rhythm that sticks | 5 |
| 7 | What actually is learning? | 5 |
| 8 | Take the fight out of food | 5 |
| 9 | Make progress easier to repeat | 5 |
| 10 | Build your sustainable way forward | 5 |

Week progress, next unfinished lesson and full course completion use saved lesson quiz IDs. Retired actions, reflections and calendar dates cannot block Learn. Someone who completed the original first two keeps both and sees mind-0-1 next. The public course page uses the same ten topics. Existing customer billing, support durations, prices and lifetime entitlements stay as agreed; the suggested learning pace does not invent new sale terms.

## Retirement boundaries

The shared actionsEnabled flag is false. Retained historical versions still describe the original action week and its evidence.

- Course pages hide practical/setup lists and omit tasks from progress totals.
- Home removes practical Learn reminders; the course route opens the next lesson. Other normal app/coaching activities remain available.
- Check-in retains the optional lesson takeaway but hides practical-action forms and does not create reports from old client payloads.
- Perfect Learn quiz results do not require a reflection form; other course reflections remain intact.
- The action endpoint rejects writes with 410 before creating or changing an enrollment. Read access still respects member/coach authorization; archived reads do not create enrollment rows or run automatic reviews.
- Learn practical-task reminders are paused. Other journey/course calendars retain their historical meaning.
- The Feed lesson uses an optional example, with its existing quiz questions unchanged.

No task definitions, API implementations, tables, member completions, XP, action reports, calendar settings or certificate records were deleted/reset. No bulk member migration is required. Restoration requires coordinated product review of the flag, completion rules and current/historical calendars, not merely showing old action controls.

## Verification and evaluation

192 focused checks pass and eight browser cases pass. Focused checks cover exact order/count, saved first-two progress, 100% completion without tasks, Home suppression, quiet retired forms, stale submissions, archived evidence access, ordinary coaching check-in persistence and historical calendar/action behavior. The lesson and quiz CSS has no diff.

Browser proof uses the real renderers and production CSS in isolated local fixtures: small portrait/landscape, light/dark and both zero and nonzero top/bottom safe-area reports. It checks course reopening/scrolling, Week 1/10, original first-two credit, wrong-answer retry and perfect quiz completion. Proof: output/learn-ten-week-proof in the managed task worktree. These are emulated checks rather than physical-device tests.

Review completion by lesson count and member feedback on 22 October 2026. A lower per-week workload should help continuation; do not compare old and new week-completion percentages without accounting for the different schedule.
