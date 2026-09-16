# Original Learn lessons restored, 16 September 2026

The audit at C:/Users/shann/Documents/Codex/2026-09-10/what-s-our-post-for-tomorrow/outputs/quiz-change-audit/details.json was compared field for field with bc3a149a^:lib/learning-inline.js. All 22 before entries match. The original definitions remain intact in learning-inline.js; the expansion override is now restricted to the specifically approved social lesson.

## Restored exactly

Original titles, all content fields and all eight quiz questions (including answer mappings and feedback) restored for these 21 lessons:

| ID | Original title |
|---|---|
| mind-1-2 | Your Brain Guesses First |
| mind-1-3 | Prediction Errors = Learning |
| mind-3-1 | Concepts Are Constructed |
| mind-3-2 | Emotion Categories Are Learned |
| mind-3-3 | Your Past Writes Your Present |
| mind-3-4 | Context Changes Everything |
| mind-3-5 | You Can Reshape Experience |
| mind-4-2 | The Power of Consistency |
| mind-4-5 | Why Streaks Matter Neurologically |
| mind-6-1 | Willpower Isn't Real |
| mind-6-2 | All Behavior Is Prediction |
| mind-7-1 | Your Brain Minimizes Surprise |
| mind-7-2 | Two Ways to Minimize Surprise |
| mind-7-3 | Precision: What Your Brain Listens To |
| mind-7-4 | Your Body Budget Drives Everything |
| mind-7-5 | You and Your Environment Are One System |
| mind-8-1 | Learning Costs Energy |
| mind-8-2 | Confirmation Bias Is the Operating System |
| mind-8-3 | Your Brain Builds Reality to Match |
| mind-8-4 | Why People Refuse New Information |
| mind-8-5 | Making Learning Less Expensive |

Original punctuation is retained intentionally, including historical em dashes, because this request requires exact restoration rather than another copy edit.

## Approved exception and preserved behaviour

mind-6-5, People Are Your Strongest Environment, retains its exact current explanation and six questions from c9753849/33971e56. This includes the qualified 57% relative observational association, no causal brain-mechanism claim, three meal/workout/walk Feed posts, meaningful comments on three other posts, and a check-in describing changed or unchanged motivation/behaviour. A PB can count as one post; there is no PB requirement.

No lesson IDs, underlying lesson definitions, progress code, database rows, evidence review, tracking, weekly action rules or assignments changed. All other lesson objects match the pre-restoration runtime. All 45 lessons remain in the six-week layout (10,10,10,5,5,5); legacy and individually assigned eight-week continuation paths remain intact. Both dashboard loaders request the new override asset version.

## Verification

- Historical equality checked independently against the audit and Git; regression tests pin SHA-256 digests of all 21 complete original lesson objects.
- Catalog titles match restored lesson titles.
- 60 focused tests pass: course membership/layout, continuation paths and retained completion IDs, weekly actions, action/evidence review, quiz completion XP, retry behaviour, pair matching and course presentation contracts.
- Five pre-existing failures reproduced with original HEAD assets: four weekly-report-save fixture failures and one learning-balance-theme assertion expecting the retired eight-weeks-v1 asset URL. No affected code was changed in this restoration.
- Headless Edge ran the actual lesson renderers and answer handlers for all 168 restored questions plus the approved six-question social quiz. Every lesson completed with 100%; seeded prior completion remained intact. This used isolated local progress, not writes to real member accounts.
- Eight browser presentation cases passed: light/dark, 375x667 portrait/667x375 landscape, zero safe-area and simulated 59px top/34px bottom insets. Opening, scrolling to answers and returning/reopening retained status-bar clearance and reachable bottom controls. Screenshots visually reviewed; proof in ignored output/learn-restoration/. This is browser emulation, not a physical-device test.
- The existing exact completion-ID architecture is unchanged; there are no database migrations, assignment writes or live member-progress resets.

## Science review

Potential corrections are documented separately in learn-science-proposals-2026-09-16.md. None are applied to the restored lessons or quizzes.
