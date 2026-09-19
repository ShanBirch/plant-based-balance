# Loading and coach video repair, 19 September 2026

Variant: `onboarding_coach_video_handoff_v1`.

Hypothesis: removing fixed post-scroll pauses, fetching independent Home state concurrently, and revalidating unchanged web assets reduces waiting without dropping readiness checks. Opening the coach video for signed-in onboarding and retaining its week-one inbox card prevents a silent blank handoff after the first lesson.

Primary KPI: progression from `guided_tour_step` for the coach note through `onboarding_coach_video_completed` to `guided_tour_completed`. Compare completion among sessions that reach the coach step before and after deployment. Existing events and definitions remain unchanged.

Diagnostics: coach-step to video-completion time, video-completion to tour-completion time, failed opens, retry usage, and browser-measured highlight readiness. Review date: 22 September 2026. This is a repair, not an allocation-based A/B experiment.

Guardrails: no welcome text auto-send, no completion without the required lesson/video/goals/interactions, no stale data shown before Home is ready, preserved offline fallback, no mobile status-bar or home-indicator overlap.

## Changes

- Let signed-in guided onboarding use the existing coach video surface, even after an ad trial is claimed.
- Fall back to the actual coach inbox when preview opening declines; do not mark a no-op as seen.
- Require a visible video before hiding the guide. Failed opens restore the prompt for retry.
- Keep the inbox welcome video during week one after lesson completion.
- Validate required interaction gates before either signed-in or preview onboarding can finish.
- Replace fixed post-scroll waits with animation frames. Preserve tab stability checks and late-layout repositioning.
- Load independent journey and daily Home state together, retaining the shell until both finish.
- Revalidate JS/CSS with HTTP cache support instead of forcing full downloads. Native shells do not register this service worker; the highlighter and Home changes apply there too.

## Validation

Focused runtime tests cover the signed-in/preview video paths, no-op fallback, missing video, video errors, skipping prevention, successful watch, premature completion, concurrent Home readiness, HTTP revalidation and offline fallback. Existing geometry tests cover safe placement and keyboard behavior.

Headless Chrome fixtures execute the real tour code, coach action and preview markup with local navigation/data stubs. The actual 129.3-second coach video loads and plays. Captures cover 320x568, 390x844 and 844x390, light/dark, and zero/44px top insets with opening, scrolling and reopening. These are browser simulations, not a physical-phone or authenticated production-account test.

A full browser playback at 2x reached the real ended event, unlocked the continuation button and advanced to Weekly Goals. Attempting to finish before saving goals remained blocked.

One controlled highlighter comparison measured 406ms before and 274ms after; this is a local sample, not a claim about whole-app speed on every device.

The broader existing tour suite has eight failures that also reproduce on the unchanged baseline: stale source-pattern/version expectations and missing `trackTourProgress` in test stubs. No new failures appeared in that comparison.

## Course-cache investigation only

The Start/Continue marker is scoped by account. Lesson progress uses the shared `plant_based_learning_progress` key and merges cached completions into server results. Normal logout does not remove that key; admin view-as separately clears/restores it. This can explain apparent inherited lesson progress on a shared phone. The reported phone state was not inspected directly. Course caching was left unchanged at Shannon's request.
