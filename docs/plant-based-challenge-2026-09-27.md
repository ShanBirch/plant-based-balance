# Eight-week plant-based challenge landing page

Shannon explicitly requested this eight-week offer on 27 September 2026. It is a separate consultation-led challenge, not a duration change to the six-week Balance Learn curriculum or existing Zoom PT terms. No ads, DM routing, prices, subscriptions or existing client entitlements change.

Public route: `/plant-based-challenge`. CTA: `/book?source=plant_based_challenge`.

The challenge includes Balance app workouts, nutrition/meal-plan support and Balance Learn. The consultation establishes goals and recommends appropriate support before package selection. Live sessions are not a universal inclusion. No guaranteed results, invented social proof or scarcity.

## Measurement contract

- Hypothesis: a clear eight-week plant-based offer with a consultation handoff increases suitable coaching enquiries.
- Variant: `eight_week_consultation_v1`.
- Primary KPI: distinct visitors with a confirmed challenge consultation, backed by `balance_bookings.metadata.source = 'plant_based_challenge'`; compare qualified consultations and eventual coaching sales manually until downstream attribution is verified.
- Diagnostics: landing `page_view`, `cta_click`, booking `page_view`, `booking_available`, `booking_unavailable`, `booking_slot_selected`, `booking_started`, `booking_confirmed`, `booking_error`. Email fallback clicks are enquiries, not confirmed bookings or sent emails.
- Guardrails: no third-party tracker added, no form answers in analytics, no bypass of Google busy checks, no forced package purchase. Exclude `metadata.test_mode=true` and bot traffic.
- Review: 4 October 2026; low volume or a disconnected calendar is not evidence that the offer failed.
- First/last touch and browser/session IDs use the existing first-party tracker. Genuine UTMs and ad/click/DM identifiers survive the link. Confirmed challenge booking metadata stores bounded campaign fields and IDs for joining to the funnel. Client-supplied attribution is evidence, not proof of ad billing or verified identity.

## Booking service dependency

Production inspection on 27 September returned `bookingEnabled: true`, `durationMinutes: 60`, no dates, `calendarConnected: false`, `calendarReconnectRequired: true`. The existing Google refresh authorization needs owner reconnection via `/booking-settings.html`. Calendar slots must remain unavailable until the service can verify busy time. The challenge route offers a prefilled email to the current business address in the meantime.

The 60-minute consultation setting is retained. Live workout sessions are separately configured for 30 minutes. The marketing page is outside the signed-in app; app Feature Drops and tours are unchanged.

Owner sign-in succeeded and Reconnect Google reached Google's "hasn't verified this app" warning. That warning is left for Shannon to review; no consent bypass or calendar switch was performed.

## Verification

- Eight browser scenarios: 360x640 and 667x375, light/dark, 0px and simulated 59px top/34px bottom insets. Opening, scrolling, booking handoff, browser return, drawer close/reopen and bottom navigation reachability passed; screenshots are in ignored `output/playwright`.
- Mocked browser submissions and the server handler verify consultation confirmation, source/attribution storage, Calendar event naming and retained 60-minute duration without creating real bookings or sending test messages.
- Existing booking protection, weekday hours, 30-minute PT, domain, compact-layout, Learn/Zoom routing and first-party tracking tests pass. No live appointment or invitation was created during QA.
