# First-login coach message

Launched: 29 September 2026. Variant: `onboarding_coach_message_v1`.

Shannon requested this for the in-app first-login onboarding. Keep the app showcase, replace its ending video and payment request with a DM-style text introduction from Coach Shannon. This also replaces the older first-login welcome video rendered in his Inbox. Existing member billing and checkout recovery capabilities remain available independently.

Hypothesis: a clear coaching introduction and an optional call next step will increase qualified calls after onboarding without reducing setup completion.

Primary KPI: confirmed bookings attributed to `utm_campaign=onboarding_coach_message_v1`, per completed onboarding. Diagnostics: `coach_welcome_viewed`, `coach_welcome_call_clicked`, `coach_welcome_dismissed`, tour completion, and booking-start/confirmed events. Clicks are not bookings. Existing first-party visitor/session and original acquisition attribution remain on preview events; booking links identify this onboarding variant.

Guardrails: no automatic payment gate, no required welcome-video playback, no entitlement granted by reading the message, no claim that previews or app-only plans include weekly coaching, no automated DM sent from this UI event. Review results on 13 October 2026; do not call a winner without enough completed-onboarding and booking evidence.

Validation: runtime onboarding/checkout/reopen tests and event-ingestion tests; browser rendering of the actual dashboard styles, message markup and controller at 320x568, 390x844 and 844x390, light/dark, top/bottom insets 0/0 and 59/34, including scroll, close, back, reopen, member CTA visibility and booking click. Visual evidence is in ignored `output/onboarding-coach/`. These are emulated browser checks, not physical-device testing.

The broad historical `dashboard, signup, native handoffs, measurement, and both discovery systems are wired` test already failed on the starting main revision because it hard-codes an obsolete script version. It was excluded from the final focused run; all 43 remaining checks passed. Syntax checks passed for all changed JavaScript. The live `/book` destination returned HTTP 200 with the current booking script.
