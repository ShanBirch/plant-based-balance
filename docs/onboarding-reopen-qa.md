# Onboarding reopen and Unlock routing — 12 September 2026

## Fix

- Restore account-first preview mode from its durable, account-owned state rather than requiring the original test/entry URL.
- Save account-scoped setup drafts, guided-tour steps and exercise position on changes and page hide. A new preview activation gets a separate checkpoint.
- Restore setup before completion shortcuts; restore the tour after the final startup Home switch, including when deferred code loads after startup.
- Unlock opens the existing payment dialog independently of the transient preview flag. The banner remains clickable above the tour, and opening checkout cancels pending tour rendering.
- Keep checkout as the resume destination until purchase is claimed. Checkpoints are navigation state, not payment or course entitlement authority.
- Maintain mobile status-bar clearance with both zero-inset fallback and reported safe-area insets. Do not prefill checkout with the synthetic guest email.

## Browser verification

Used the full local dashboard and actual wizard/tour/payment code, with isolated guest storage and local backend stubs. No real member was reset; no real post or purchase was submitted.

1. Started fresh setup, reached age, typed `34`, closed the tab and opened the plain dashboard URL without preview parameters. The same question and unfinished input returned.
2. Continued through height, weight, goal, barriers, training, diet, schedule and recommendations. Caught and fixed a missing resumed question label.
3. Entered the guided tour, reached step 2, closed the tab and reopened the plain dashboard. Step 2 returned; Back returned to step 1.
4. Clicked Unlock from the resumed tour. Caught and fixed the overlay intercepting that button. Payment then opened directly, with the saved setup summary.
5. Closed and reopened at payment. Payment returned without restarting setup or redirecting to sign-in.

## Mobile visual checks

- 375 × 667: resumed setup question, cream/gold card, top clearance 44px and reachable input.
- 320 × 568: resumed tour and working navigation. Dark payment with simulated 59px top / 34px bottom insets: panel top 79px; bottom 518.8px; payment button bottom 427px. Scrolling reached the end.
- 667 × 375: light payment with zero reported inset: panel top 44px, bottom 355.2px; payment button bottom 279.3px and passed hit testing after scrolling.
- Captured and visually reviewed browser screenshots. These are browser viewport simulations, not a physical iPhone or native-keyboard test.

## Automated checks

Focused regression coverage includes checkpoint scoping, new preview isolation, unavailable storage, restoration before startup shortcuts, setup answers and preferences, exact guided-tour step and exercise progress, payment routing, safe areas, exercise thumbnails, swipe navigation and FitGotchi visibility.

The broader legacy suites still contain pre-existing stale assertions: the giant meta-preview wiring test hardcodes obsolete script/version/copy patterns, and one continuity test expects retired calendar-minimum copy. These were not used as passing evidence or removed to hide failures.

## Remaining confirmation

Physical iPhone close/reopen remains a user/device confirmation. No purchase was made during testing.
