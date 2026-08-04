# Paid Facebook App Preview Test

- Launch date: 2026-08-04
- Variant: `facebook_5m_v1`
- Destination: `https://plantbased-balance.org/meta-app-preview.html`
- Eligible traffic: attributed Facebook paid-social visitors only
- Hypothesis: letting a Facebook lead complete onboarding and explore Balance for five minutes before account creation will increase qualified account creation without weakening paid conversion quality.
- Primary KPI: attributed account creation rate from `trial_started`.
- Diagnostic metrics: onboarding start rate, onboarding completion rate, preview start rate, signup-gate reach rate, signup CTA rate, completed signup count, and later checkout/purchase events joined through visitor/session and Meta identifiers.
- Guardrails: organic traffic is unchanged; existing signed-in members are never replaced by preview mode; preview actions cannot write workouts, meals, messages, purchases, or social activity; the gate clearly says account creation is free and takes no payment.
- Decision date: 2026-08-18, or after 100 attributed preview starts if that comes later.
- Keep/stop rule: keep the variant only if attributed account creation improves and downstream qualified or paid conversion does not fall materially versus the paid-Meta control. Do not select a winner from clicks or cheap preview starts alone.
- Native rollout: keep the `Already installed?` handoff hidden for normal traffic until the Android and iOS binaries containing the Meta trial bridge are published. After both releases are live, add `native_handoff=1` to the ad destination to expose it.

Required ad parameters:

```text
utm_source=facebook
utm_medium=paid_social
utm_campaign=<campaign>
utm_content=<creative>
campaign_id=<meta campaign id>
adset_id=<meta ad set id>
ad_id=<meta ad id>
creative_id=<creative id>
placement=<placement>
fbclid=<Meta click id when supplied>
```
