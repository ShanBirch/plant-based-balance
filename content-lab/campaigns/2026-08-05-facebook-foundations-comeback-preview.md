# Facebook Foundations Comeback Preview

- Launch date: 2026-08-05
- Variant: `facebook_5m_foundations_v3`
- Destination: `https://plantbased-balance.org/founders?utm_source=facebook&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<creative>&campaign_id=<meta campaign id>&adset_id=<meta ad set id>&ad_id=<Meta ad id>`
- Eligible traffic: attributed Facebook paid-social visitors only
- Offer: Balance Foundations Founders Pass at AU$89.99 once for the fixed six-week course, six weeks of app and community access, and one weekly check-in plus workout and food review with Shannon. No automatic renewal.
- Journey: the ad first opens the full Balance Foundations Pass page. Its paid-Facebook action opens guest setup, automatically assigns the first Weekly Goals and meal plan, then gives a compact walkthrough of Goals, workout, photo-based vegan meals, the live read-only Shannon/Balance Feed and Thoughts. The five-minute look-around begins only when that walkthrough ends, before the AU$89.99 Foundations unlock. The previous `/meta-app-preview.html` link redirects here with attribution retained.
- Hypothesis: explaining the complete Pass on the trusted website before a shorter comeback-style onboarding, assigned first training and weekly goals, and five minutes inside the real app will create more paid Foundations members than asking visitors to configure goals themselves.
- Primary KPI: attributed paid Foundations purchases from `trial_started`.
- Diagnostic metrics: onboarding start and completion, auto-goal assignment, walkthrough completion, preview start, timed gate reach, checkout start, purchase, authenticated purchase claim, first app open, first planned workout, and first completed workout.
- Guardrails: organic traffic and existing members remain unchanged; saved onboarding details survive Stripe; food restrictions and movement limitations are retained; the exact one-time price and no-renewal terms appear before checkout; a paid session must match the authenticated account email before entitlement is claimed.
- Decision date: 2026-08-19, or after 100 attributed preview starts if later.
- Keep/stop rule: keep the flow only if paid purchase conversion and week-one activation improve without more safety-support contacts or abandoned onboarding. Do not judge it from clicks or Stripe opens alone.

## Gentle soundtrack refinement, 2026-08-27

- Hypothesis: a very quiet, warm soundtrack during setup and the guided app preview will make the experience feel calmer and more complete without distracting from the actions that lead to checkout.
- Variant: `facebook_5m_foundations_v3_gentle_audio`
- Primary KPI: attributed paid Foundations purchases from `guided_tour_started`.
- Diagnostic metrics: soundtrack starts, mute toggles, walkthrough completion, voice-note completion, checkout start, and time from walkthrough start to checkout.
- Guardrails: music is limited to the attributed paid preview, starts only after a user gesture, has a persistent visible mute control, fades to silence for Shannon's voice note, stays almost silent during the first course lesson, and stops if the preview is skipped.
- Decision date: 2026-09-10, or after 100 attributed guided-tour starts if later.

Required ad parameters:

```text
utm_source=facebook
utm_medium=paid_social
utm_campaign=<campaign>
utm_content=<creative>
campaign_id=<meta campaign id>
adset_id=<meta ad set id>
ad_id=<Meta ad id>
creative_id=<creative id>
placement=<placement>
fbclid=<Meta click id when supplied>
```
