# Guided course handoff repair — 19 September 2026

The reported Home spotlight stayed on “Opening your next page…” instead of reaching the Course start button. The old Home action marked foundations_intro seen before loading succeeded, permanently retained a failed loader promise, and attempted a standalone learning-inline load without ensuring its prerequisites. Its fixed 360ms delay could also open the overview before initLearning finished, allowing the late library render to replace Start course.

The loader now resolves prerequisites, reuses pending requests, retries failed scripts, and releases unsuccessful attempts. Opening the overview waits for the real tab initialization promise and only marks the Home card seen after the visible Start button exists. Concurrent tour and Home requests share the same handoff. The tour reuses that opener and an already-visible start screen. No saved lesson completion data is cleared or rewritten by this change.

Verification uses the actual course modules, course styles and guided-tour code in a browser fixture with stubbed account responses. It covers a failed prerequisite download followed by retry; delayed account responses; Home → Course Start → welcome Start Week 1 → first lesson (Meet the Researchers) → guided reading; returning and reopening; and portrait 320×568, 390×844 and landscape 844×390 with both themes and simulated zero/44px top insets. Screenshots and results are in the task outputs. Browser checks do not complete quizzes or modify live accounts.

18 focused Node checks pass. The broader 50-check tour selection has 42 passes and eight existing failures; the same eight failures were verified at HEAD before these changes (stale source expectations and missing harness mocks). Syntax and whitespace checks pass.

## Follow-up: welcome disappears before Start

Shannon's next phone test reached the welcome correctly, but a subsequent update dismissed it. Reproduced in the real-module browser fixture by calling refreshLearningCourseHome after the guided welcome appeared: it replaced the course-detail DOM, removing the welcome child. Social journey rendering calls this refresh asynchronously as progress arrives. The background refresh now leaves an existing welcome untouched. Start Week 1 still reads current progress and opens the week normally; explicit close still works. No automatic course start or tour advancement was added.

The browser regression fails before the guard and passes after it, checking the same welcome DOM node survives a delayed background update, then continuing through Start and the first lesson. The focused suite now contains 20 passing checks, including repeated background refreshes and normal refresh after closing the welcome.

Shannon also requested an explicit week-selection stop: after Start Week 1, guided onboarding shows the course overview with Week 1 collapsed and highlights “Why change feels hard.” Only tapping that week reveals “Meet the Researchers” and advances the spotlight. Normal course starts outside the guided tour retain their existing week-page behavior. The first-week and first-lesson controls have stable identifiers, and interrupted tours can restore the overview. Browser checks now exercise this additional click before opening the lesson.
