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
| `/fitness-coaching.html` | `broad_pain` | Fully broad challenger for restarting, follow-through and busy-life pain, with no plant-based positioning in the ad, landing page or DM handoff |

Run both routes against the same AU$89.99 six-week Balance Foundations Founders Pass and broad Australia ad set. Keep the offer, budget and DM objective stable so the message route is the main experimental difference. The control keeps the plant-based identity end to end. The challenger stays broad end to end. Do not blend the copy after the click or inside DMs. Measure checkout completion as the primary conversion, week-one course starts as the activation guardrail, and week-six continuation into App + Community or Starter Coaching as the downstream value measure. Review the new offer after the first 20 paid checkouts or four weeks, whichever comes later.

## Launch checklist

1. Assign a stable `utm_content` to every creative.
2. Verify landing `page_view`, CTA, checkout and duration events reach `lp_events`.
3. Verify the correct landing variant is preserved in Stripe metadata.
4. Verify a confirmed Stripe purchase can be joined back to campaign and creative.
5. Verify account creation and onboarding events can be joined to the purchase.
6. Record the start date and freeze the test for the first 72 hours unless delivery or tracking is broken.
7. Review at seven days or once each creative has meaningful spend, whichever is later.

## Earned share celebration launch

- Launch date: 2026-07-28.
- Variant: `earned_share_celebration_v1`.
- Hypothesis: a brief earned celebration in Balance Feed, bolder Instagram artwork, and Instagram-safe content spacing will increase completed workout, PB, and activity shares without increasing share failures.
- Primary KPI: completed social shares per eligible completed workout, PB, or activity.
- Diagnostics: Balance Feed post views, reactions and comments; Instagram share-sheet opens and confirmed-return rewards; destination split; creative variant recorded with social-share rewards.
- Guardrail: upload, render, native-share, or share-sheet failure rate must not increase.
- Decision date: 2026-08-11, using the prior 14 days as the baseline and the first 14 live days as the comparison window.

## Earned motion share launch

- Launch date: 2026-07-28.
- Variant: `earned_share_motion_v1`.
- Hypothesis: a 4.2-second photo-and-results motion card will increase completed Instagram workout, PB, and activity shares over the still-card baseline.
- Primary KPI: confirmed Instagram shares per eligible completed workout, PB, or activity.
- Diagnostics: motion render success, native video handoff, share-sheet handoff, still fallback rate, destination split, and Feed engagement on the matching Balance post.
- Guardrail: users must always retain the still-card fallback, and median time from share tap to composer opening should remain under eight seconds.
- Decision date: 2026-08-11, comparing the motion variant with the prior still-card window.

## Sequential course library launch

- Launch date: 2026-08-04.
- Variant: `sequential_course_library_v1`.
- Curriculum version: `outcome_course_curriculum_v1`.
- Hypothesis: one ordered set of outcome-based courses, with Scholar progress first and clear prerequisite locks, will make the Course tab easier to understand and increase lesson starts.
- Primary KPI: Course visitors who start an available topic within seven days.
- Diagnostics: `course_card_toggled`, `course_topic_started`, `course_locked_tapped`, lesson completion, Foundations completion, and progression into the next unlocked course.
- Guardrail: existing lesson completions must remain credited, and course-navigation support or confusion reports must not increase.
- Decision date: 2026-08-18, comparing the first 14 live days with the prior 14 days.
