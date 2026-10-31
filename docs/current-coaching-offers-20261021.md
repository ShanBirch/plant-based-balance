# Current public coaching offers

Confirmed by Shannon on 21 October 2026. These public offer facts supersede older course and challenge descriptions. This change updates the website and consultation journey; it does not migrate existing customers or change billing products, prices or subscriptions.

All prices are AUD including GST.

| Starting package | Weekly price | Upfront payment | Minimum | Total minimum |
| --- | --- | --- | --- | --- |
| Balance Learn | $125 | $120 | Ten weeks | $1,370 |
| Zoom Personal Training | $125 | $120 | Ten weeks | $1,370 |
| Programming & Nutrition | $75 | $120 | Ten weeks | $870 |

All three include a meal plan, a workout program updated weekly and a weekly voice-note check-in inside Balance. Learn includes the online course across ten learning sections and a weekly 45-minute Zoom teaching lesson, for people able to exercise independently. Zoom PT includes the same course and core support, replacing the teaching lesson with a weekly 45-minute supervised workout. Programming & Nutrition has no live session.

Separate ongoing coaching has a three-month minimum: Programming & Nutrition $75/week; coaching with a weekly 45-minute Zoom PT session $125/week. A repeat upfront payment and automatic renewal have not been agreed. Group coaching is future development, not a current purchase option. Existing client rates and terms remain intact. Local at-client-home PT offers were retired by Shannon on 1 November 2026; historical agreements/bookings are preserved.

## Public paths

- `/coaching` and `/fitness` compare the starting packages and separate ongoing coaching.
- `/founders` and `/plant-based-fitness.html` describe Learn and its teaching session.
- The former `/plant-based-challenge` landing page shows current individual starting packages and directs existing participants to Balance. Existing challenge delivery inside the app is untouched.
- The home hub, app page, learning page, resource-page promotions and shared menu lead to current offers. Terms, client agreement, refund and cancellation descriptions preserve legacy agreements while describing the new minimums.
- Offer CTAs open `/book?offer=...`, retain campaign parameters and analytics test mode, and carry the package name into the consultation goal. No new-offer CTA opens a legacy checkout. No actual consultation was booked during verification.

## Checkout boundary

Read-only production checks on 21 October 2026 found that `get-checkout-offer` still describes `balance_vegan_founders_pass` as $450 for six weeks and `balance_learn_weekly` as $24.83/week with a six-week minimum. Other legacy products also remain in checkout configuration. These are not the new offers. The website therefore uses consultation-led enrolment and removes legacy dynamic price replacement from current marketing and terms pages.

Before enabling payment for the new offers, Shannon must specify/authorise the corresponding checkout configuration, collection timing and cancellation/continuation arrangements. Do not infer a repeated onboarding charge or renewal. Existing billing and historical payment success handling are intentionally unchanged. DM automation and paid-ad creative are outside this website change and may still contain previous campaign wording.

## Measurement

- Hypothesis: accurate package distinctions and minimum totals increase suitable consultation enquiries and reduce price/inclusion confusion.
- Variant: `coaching_ten_week_20261021`; Learn: `learn_teaching_20261021`; former challenge entry: `starting_packages_20261021`.
- Primary KPI: suitable confirmed consultations per unique visitor to current offer pages.
- Diagnostics: package CTA clicks, booking availability, slot selection, booking start/confirmation/error and chosen package. Preserve visitor/session identity and first/last campaign touch; general public consultations now retain the existing sanitised attribution structure when saved.
- Guardrails: no new public CTA reaches a legacy price; existing billing and booking modes remain unchanged; mobile headers and menu controls clear the status bar, with bottom content reachable above the home indicator.
- Decision date: 4 November 2026, using actual consultation quality and confirmed enrolments; no conversion improvement is assumed before results exist.

## Verification

Run the focused marketing, funnel tracking, checkout hardening, legacy Learn pricing, client-session and public/home consultation booking tests. Browser QA covers small portrait, larger portrait, landscape and desktop; light/dark settings; zero and nonzero safe areas; opening, scrolling, return/reopen, package-to-booking navigation and attribution. Generated screenshots and reports belong in ignored `output/`, not the published source diff.

## New standard text membership, 1 November 2026
Shannon authorised a separate AUD49.99/week membership: meal plan, weekly programme updates, weekly text check-in and app access. The confirmed initial term is three months, implemented as 13 weekly payments (AUD649.87 minimum), then weekly until cancelled. No upfront fee or additional notice period. The AUD75 voice tier remains separate; the private AUD14.70 continuation keeps its own eligibility and terms. New exact Stripe price: price_1UWlnXCGCyRUsOfKeq1Kn01q, plan standard_text_coaching_weekly. Fulfilment creates only a normal coaching relationship after verified paid invoice and queues a setup review; it creates no free grant, outreach cohort, optional-message consent or auto-send entitlement. Existing agreements cannot buy through this self-serve route.
