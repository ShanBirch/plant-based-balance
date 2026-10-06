# Private menopause course review

The nine-week course is available in Learn for the verified owner account only. It contains 27 lessons and 216 questions, with teaching, evidence summaries, source links, simplified illustrations, existing credited photography, and optional weekly reflections. Weeks 7 and 8 complete the agreed outline; the recovered drafts for weeks 1–6 and 9 supply the other lessons.

## Access and persistence

The deployed JavaScript contains only the player integration. Curriculum lives in `private_learning_courses`; results and reflections live in `private_learning_progress`. Both tables enforce the owner UUID through constraints and row-level security. Anonymous users cannot read either table. Other authenticated users receive no course or progress rows and cannot write owner progress. The owner has read-only curriculum access and can insert/update their own progress.

Identity is verified with the auth server before loading. Account changes clear the in-memory content, lesson registry and feedback. Curriculum and reflections are not put into local storage or the service-worker cache. Private lessons are excluded from public quiz pools, course progression, XP and shared reflection APIs. No enrolments, prospect access, messages or announcements were created.

## Verification

- Production role probes verified owner read/write, nonowner isolation and anonymous denial in a transaction that was rolled back. No synthetic production progress remains.
- Eighteen focused automated checks and the existing answer-retry checks passed.
- The real learning player completed all 216 questions across six question types, including retry, save failure, reload persistence, reflection saving and identity switching, using an isolated browser fixture. This fixture does not substitute for the separate production database access checks.
- Forty-eight mobile layout observations covered light/dark, 320 × 568 portrait and 740 × 360 landscape, zero and nonzero top/bottom safe-area insets, opening, scrolling, returning and reopening. Screenshots were captured in ignored `output/menopause-qa/`. Answer visibility with reduced motion and feedback home-indicator clearance were repaired.

## Review limits

This is an owner-only educational review release. Clinical review is still required before wider release. The original requested video has not been recovered. Researcher profiles link to official institutional pages; researcher portraits have not been copied because reuse permission is unestablished. These limitations are also shown in the private course review notes. Do not describe the course as clinically approved or release it to other accounts without further authorization.

The seeded payload and source draft files remain in ignored `work/menopause/`, not deployed public assets. Future content edits must update the protected database row through an authorized operator workflow.
