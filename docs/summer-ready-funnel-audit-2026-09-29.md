# Summer Ready Shred funnel alignment, 29 September 2026

## Source facts and scope

Shannon's campaign brief confirms Summer Ready Shred, ten weeks starting 5 October 2026, plant-based meal guidance, people of all genders, Instagram DMs first and calls when appropriate. Draft Meta setup is owned by the separate ads chat; this change does not edit or publish Meta. Campaign 120255351900570119, ad set 120255351900580119, initial ad 120255351900560119. Intended spend remains AUD 500 total, 29 September through 4 October, not verified or changed through this repo.

The already-published offer and `docs/summer-shred-website-2026-09-29.md` confirm AUD $75/week online coaching or AUD $125/week with one weekly live Zoom training session, plus one AUD $120 onboarding fee. Ten-week totals are AUD $870 and AUD $1,370. Both include the six-week Learn course, workout programming, plant-based meal support, weekly review/adjustments, app, community and accountability. No price or existing customer entitlement was changed. New Zoom session length, renewal/cancellation terms and billing dates are not established by the new offer; do not copy those from older packages.

## Fixes

- Public challenge, home hub, app, Learn, coaching and booking surfaces use Summer Ready Shred. The challenge, home hub, coaching and booking show 5 October 2026. Challenge copy explicitly welcomes all genders and does not require existing vegan/vegetarian status.
- The challenge DM route recognises the actual Summer Ready Shred name and this campaign/ad attribution, including free-written entry messages. Unrelated old campaigns, explicit old-product requests, purchases and linked-client safeguards retain their routes.
- Questions about the six-week course included within the challenge stay on the challenge route instead of switching to legacy preview/media/checkout.
- Writer and independent reviewer use published package rates, onboarding fee, minimum totals, ten-week duration and the six-week included course. They no longer claim price is unknown or assume a 30-minute training session. Policy version changes so stale drafts cannot reuse the previous content approval.
- Booking keeps the existing source `plant_based_challenge`, 60-minute video consultation, consent and real availability. The calendar event uses the current offer name.
- Shared navigation finds destinations by path, preserving query attribution and avoiding duplicate challenge links when attribution scripts run first. Changed script references are versioned.

## Verification and limits

84 targeted offline tests passed after integrating the concurrent practical-barrier and direct-question improvements across challenge routing/writer assembly/review/consent, booking source/calendar/availability, client handoff, worker/hybrid ownership and final transport conversation checks. Synthetic booking tests mock every external request; no appointment was created. New regression cases use the actual draft campaign and ad IDs.

Browser checks exercised 360x640 and 667x375, light/dark preferences, zero safe-area insets and 59px top/34px bottom insets. They cover opening, scrolling, menu close/reopen, challenge-to-booking and browser return, with screenshots under ignored `output/playwright/`. Header/menu controls clear the simulated status bar; bottom content remains scrollable. Additional hub/app/coaching/Learn captures verify the current name and a single navigation link. Local booking network calls are deliberately unavailable; live read-only production availability returned HTTP 200, five available dates and 60-minute calls. No booking submission or customer DM was sent.

The remote-model writer-only smoke suite was updated but cannot run without an available model credential; it is not reported as passed. Existing historical public-marketing tests asserting retired $149/Founders pages are not current-offer acceptance criteria. Meta creative frames and saved delivery/budget settings remain with the ads chat, and this audit does not certify the ads as launched. Native goal reactions have a separately documented Meta failure and are outside these offer corrections.

## Measurement

Hypothesis: consistent offer facts and campaign routing reduce wrong-offer handoffs and increase qualified challenge consultations. Keep `summer_shred_ten_week_v1` and existing booking events/source stable. Primary KPI: verified qualified challenge bookings and subsequent coaching sales. Diagnostics: wrong-offer/legacy-preview handoffs, clarification/price-question turns, booking availability/errors, CTA and booking progression. Guardrails: duplicate or protected-client sends, unsolicited cards, invented terms and attribution loss. Review 6 October 2026; do not infer sales from clicks or replies. Existing campaign IDs and UTM parameters survived the browser handoff.
