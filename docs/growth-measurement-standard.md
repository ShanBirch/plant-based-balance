# Balance Growth Measurement Standard

## Master weekly actions, 10 September 2026

- Variant: `master_actions_v4`. Extends the same ten-week Master curriculum with 33 separately recorded practical actions, three or four per week. Quizzes and reflections remain separate requirements.
- Hypothesis: visible weekly actions and saved evidence help members complete practical work and help coaches identify unfinished work sooner.
- Primary KPI: eligible Master members completing every required action in an opened week, followed by verified whole-week completion.
- Source of truth: `balance_master_action_submissions` by member, week and action key. Count only `is_current=true`; preserve first and latest evidence dates. `balance_master_submissions` retains whole-week submissions. Exclude `users.is_test_account=true`.
- Baseline: zero real member Master projects at launch. Existing test projects are not outcomes. Do not claim a conversion improvement without an eligible cohort.
- Diagnostics: action counts per opened week; time from first saved action to week completion; most commonly unfinished actions; video submissions and saved workout/meal evidence. Frontend events use assessment version `master_actions_v4`.
- Guardrails: drafts cannot forge completion; required quiz reflections stay required; private action evidence is visible only to its owner, active assigned coach and super admin. Saved work and video submissions do not imply coach approval.
- Review date: 2026-09-24, comparing eligible opened weeks and completion latency after enough members enroll.

## Master required assessments — 10 September 2026

- Variant: `master_assessments_v3`. Course order: Learn, Master, Become, Lead.
- Outcome: members demonstrate their lifts, explain what they learn and submit usable workout and meal plans.
- Primary measure: verified weekly submissions per enrolled member, using `balance_master_submissions` joined to `balance_course_enrollments`.
- Diagnostics: weeks 2, 5 and 9 submitted; quiz reflections saved; draft saves, validation rejections and save failures. Existing `master_stage_completed` and `master_course_completed` events remain available.
- Baseline: zero non-test Master drafts and zero non-test legacy completions at the pre-release check on 10 September.
- Guardrails: a draft never produces a completion receipt; only owned workouts are accepted; all required quiz reflections and four uploaded lifts are checked; submitted work remains separate from later drafts. Video submission is not technique approval.
- Review: after 20 non-test submissions or on 24 September. Exclude `users.is_test_account` from all measures.

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
| `/founders` | `plant_based_control` | Clean public control route for people already identifying with plant-based fitness; internally rewrites to `/plant-based-fitness.html` |
| `/fitness` | `broad_pain` | Clean public broad challenger route; internally rewrites to `/fitness-coaching.html` with no plant-based positioning in the ad, landing page or DM handoff |

Run both routes against the same AU$149 six-week Balance Learn Founders Pass and broad Australia ad set. Keep the offer, budget and DM objective stable so the message route is the main experimental difference. The control keeps the plant-based identity end to end. The challenger stays broad end to end. Do not blend the copy after the click or inside DMs. Keep Meta campaign, ad-set, ad and creative identifiers on the canonical Instagram thread and handoff receipt rather than exposing them as a long query string in the customer-facing DM. Measure checkout completion as the primary conversion, week-one course starts as the activation guardrail, and week-six continuation into App + Community or Starter Coaching as the downstream value measure. Review the new offer after the first 20 paid checkouts or four weeks, whichever comes later.

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
- Outcome: superseded the same day by `foundations_gate_with_course_previews_v1` before a meaningful comparison window.

### Foundations-gated course previews

- Launch date: 2026-08-04.
- Variant: `foundations_gate_with_course_previews_v1`.
- Curriculum version: `outcome_course_curriculum_v2`.
- Hypothesis: letting members preview every course while using Foundations as the single start gate will make the full value of the curriculum clearer without creating an unclear learning path.
- Primary KPI: Foundations completion followed by a specialist-course topic start within seven days.
- Diagnostics: locked course previews, `course_locked_tapped`, Foundations completion, specialist-course starts, and progression between specialist courses.
- Guardrail: no specialist topic can start before Foundations is complete, and existing lesson completions remain credited.
- Decision date: 2026-08-18, comparing the first 14 live days with the prior 14 days.
