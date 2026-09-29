# First-login client welcome

Updated 29 September 2026 after Shannon clarified that this is for clients arriving through the challenge, not a sales step.

Keep the guided app tour. End with Shannon saying hello, explaining his weekly review of workouts, meal plan, Learn progress and how the week went, and inviting the client to say hello back. Remove the call booking invitation and plan-sales language. The primary button opens the existing real Coach Shannon DM; the client writes and sends their own message. Do not auto-send, prefill a reply, require a purchase or grant entitlements. Keep exploring remains available.

The chat opener waits for the real conversation to open before dismissing the welcome. A failed chat lookup keeps the welcome visible with a retry message. Existing first-run suppression and dedicated repeat-onboarding test-account behavior are unchanged.

Diagnostics: coach_welcome_viewed, coach_welcome_reply_opened and coach_welcome_dismissed. Opening chat is not proof of a sent reply. The earlier booking KPI is retired. Evaluate first actual client replies after onboarding instead.

Validation: focused runtime tests cover paid/unpaid tour completion, opening chat, retry after failure, and event ingestion. Mobile layout retains bounded scrolling and the tested zero/nonzero safe-area fallbacks. Browser evidence belongs in ignored output/onboarding-coach. Emulated browser checks are not physical-device testing.
