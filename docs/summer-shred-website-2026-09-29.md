# Summer Shred website, 29 September 2026

## Public offer and page roles (29 September 2026)

Shannon authorised publication of Plant-Based Summer Shred as the main acquisition offer: ten weeks with a ten-week commitment, replacing the normal three-month coaching commitment for challenge participants. Online coaching is AUD $75/week; one weekly Zoom training session with coaching is AUD $125/week. Each enrolment has one AUD $120 onboarding fee, not stacked challenge/coaching fees. Summer Shred minimum totals including that fee are AUD $870 and AUD $1,370 respectively. Coaching outside the challenge has a three-month commitment and the same weekly prices and onboarding fee. Do not invent the new package's session length, cancellation/renewal terms or exact billing dates; confirm these before payment. Public CTAs book a consultation. The current consultation calendar remains a 60-minute video call.

Learn remains the six-week lifestyle-change course, included in both coaching options. Its public page explains the course only: no app gallery, standalone upfront/weekly sale or preview checkout. Summer Shred shows the app and support; the app page explains app features; Coaching compares support and commitments. No standalone App Access is advertised for new enrolments. Existing subscriptions, prices, progress, lifetime entitlements and customer agreements remain unchanged. Preserve legacy checkout/backend records for existing customer handling; do not reinterpret them as the current new-customer offer. DM/onboarding implementations are separately owned. Details and measurement: docs/summer-shred-website-2026-09-29.md.


## Measurement

Hypothesis: distinct course, app and coaching pages with Summer Shred as the main entry increase qualified consultation bookings and reduce wrong-offer handoffs. Variant: summer_shred_ten_week_v1. Primary KPI: qualified challenge consultations, using verified balance_bookings source plant_based_challenge and eventual coaching sales; no claim of automated revenue linkage. Diagnostics: existing page_view, cta_click, booking_available/unavailable, booking_slot_selected, booking_started, booking_confirmed/error, plus named app_to_summer, learn_to_summer, summer_zoom and summer_online CTAs. Preserve first/last touch, UTM/click IDs and visitor/session IDs. Exclude analytics_test and test bookings. Guardrails: wrong-plan checkout, broken availability, mobile inaccessible controls and changes to existing entitlements. Review 6 October 2026; report low sample sizes rather than choosing a winner from clicks.

## Scope

Public pages/navigation and challenge booking description only. Existing signed-in member billing and historical Stripe products are preserved. No prices/subscriptions were mutated, no real appointment submitted and no customer message sent. The old broad fitness destination now presents current coaching. Legacy /founders remains the course information URL. No DM or onboarding implementation is duplicated.

## Verification

22 targeted tests passed: consultation availability/busy-time protection, source and attribution handling, booking copy, legacy price preservation, new public page roles and hub navigation. Browser review covered six primary routes with 360x640 and 667x375 layouts, simulated light/dark preference and zero or 59px/34px safe-area insets. Open, scroll, menu close/reopen and browser return were exercised. Visual screenshots captured course/menu, app/footer, hub/footer, challenge hero and offer cards, coaching and booking. The app header's zero-inset fallback was raised from 24px to 42px and rechecked across all eight configurations. Course-to-challenge-to-booking preserved UTM/ad IDs and the challenge source. No real booking was submitted. Public layouts intentionally retain their cream/light theme under both preferences.
