# Balance Growth Measurement Standard

## Decision this system supports

Decide which ad message, landing experience, DM path, and onboarding flow produces paying members who activate inside Balance, without optimising for cheap but low-quality conversations.

## Primary KPIs

1. **Customer acquisition cost**
   - Calculation: attributed paid media spend divided by first-time purchasers.
   - Source: Meta spend plus Stripe-confirmed purchases.
   - Decision: scale, hold, or stop an ad route.

2. **Qualified conversation to purchase rate**
   - Calculation: purchasers divided by ad-attributed conversations that show a genuine goal, blocker, package question, or start intent.
   - Source: Instagram lead state and Stripe purchase attribution.
   - Decision: distinguish useful ads from ads that merely create cheap DMs.

3. **Seven-day activation rate**
   - Calculation: purchasers who complete onboarding, set weekly goals, create or confirm a meal plan, and plan or complete a first workout within seven days divided by purchasers.
   - Source: app and onboarding events linked to checkout or user id.
   - Decision: assess whether the promise and handoff create real product use.

## Diagnostic metrics

- Landing view to CTA rate.
- CTA to checkout-start rate.
- Checkout-start to purchase rate.
- Purchase to account-creation rate.
- Time from purchase to first login.
- Onboarding completion rate and step-level drop-off.
- Weekly-goal, meal-plan, first-workout-plan and first-workout-completion rates.
- Cost per messaging conversation and cost per qualified conversation.

## Guardrails

- Refund, chargeback and explicit mismatch rate by message variant.
- Unqualified or confused conversation rate, especially for broad ads.
- Support incidents during checkout and onboarding.
- Do not declare a winner from clicks, page engagement or cheap DMs alone.

## Stable attribution fields

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `campaign_id`, `adset_id`, `ad_id`, `placement`, `site_source_name`
- `fbclid`, `_fbc`, `_fbp`
- `visitor_id`, `session_id`, `page_variant`, `landing_page`
- Stripe checkout session, Instagram thread/lead id, and Balance user id when each becomes available

## Current Founders Pass experiment

| Route | Variant | Purpose |
| --- | --- | --- |
| `/plant-based-fitness.html` | `plant_based_control` | Control message for people already identifying with plant-based fitness |
| `/fitness-coaching.html` | `broad_pain` | Challenger message for restarting, follow-through and busy-life pain while clearly disclosing the plant-based product |

Run both routes against the same AU$99 Founders Pass and broad Australia ad set. Keep the offer, budget and DM objective stable so the message route is the main experimental difference.

## Launch checklist

1. Assign a stable `utm_content` to every creative.
2. Verify landing `page_view`, CTA, checkout and duration events reach `lp_events`.
3. Verify the correct landing variant is preserved in Stripe metadata.
4. Verify a confirmed Stripe purchase can be joined back to campaign and creative.
5. Verify account creation and onboarding events can be joined to the purchase.
6. Record the start date and freeze the test for the first 72 hours unless delivery or tracking is broken.
7. Review at seven days or once each creative has meaningful spend, whichever is later.
