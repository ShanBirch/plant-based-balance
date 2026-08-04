# Facebook Foundations Comeback Preview

- Launch date: 2026-08-05
- Variant: `facebook_5m_foundations_v3`
- Destination: `https://plantbased-balance.org/meta-app-preview.html`
- Eligible traffic: attributed Facebook paid-social visitors only
- Offer: Balance Foundations Founders Pass at AU$89.99 once for the fixed six-week course, six weeks of app and community access, and one weekly check-in plus workout and food review with Shannon. No automatic renewal.
- Hypothesis: a shorter comeback-style onboarding that assigns the first training and weekly goals, followed by five minutes inside the real app, will create more paid Foundations members than asking visitors to configure goals themselves.
- Primary KPI: attributed paid Foundations purchases from `trial_started`.
- Diagnostic metrics: onboarding start and completion, auto-goal assignment, preview start, timed gate reach, checkout start, purchase, authenticated purchase claim, first app open, first planned workout, and first completed workout.
- Guardrails: organic traffic and existing members remain unchanged; saved onboarding details survive Stripe; food restrictions and movement limitations are retained; the exact one-time price and no-renewal terms appear before checkout; a paid session must match the authenticated account email before entitlement is claimed.
- Decision date: 2026-08-19, or after 100 attributed preview starts if later.
- Keep/stop rule: keep the flow only if paid purchase conversion and week-one activation improve without more safety-support contacts or abandoned onboarding. Do not judge it from clicks or Stripe opens alone.

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
