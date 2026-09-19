# Guided course handoff repair — 19 September 2026

The reported Home spotlight stayed on “Opening your next page…” instead of reaching the Course start button. The old Home action marked foundations_intro seen before loading succeeded, permanently retained a failed loader promise, and attempted a standalone learning-inline load without ensuring its prerequisites. Its fixed 360ms delay could also open the overview before initLearning finished, allowing the late library render to replace Start course.

The loader now resolves prerequisites, reuses pending requests, retries failed scripts, and releases unsuccessful attempts. Opening the overview waits for the real tab initialization promise and only marks the Home card seen after the visible Start button exists. Concurrent tour and Home requests share the same handoff. The tour reuses that opener and an already-visible start screen. No saved lesson completion data is cleared or rewritten by this change.

Verification uses the actual course modules, course styles and guided-tour code in a browser fixture with stubbed account responses. It covers a failed prerequisite download followed by retry; delayed account responses; Home → Course Start → welcome Start Week 1 → first lesson (Meet the Researchers) → guided reading; returning and reopening; and portrait 320×568, 390×844 and landscape 844×390 with both themes and simulated zero/44px top insets. Screenshots and results are in the task outputs. Browser checks do not complete quizzes or modify live accounts.

18 focused Node checks pass. The broader 50-check tour selection has 42 passes and eight existing failures; the same eight failures were verified at HEAD before these changes (stale source expectations and missing harness mocks). Syntax and whitespace checks pass.
