# Paid Facebook App Preview and Stripe Unlock

- Launch date: 2026-08-04
- Variant: `facebook_5m_paid_v2`
- Status: superseded on 2026-08-05 by `facebook_5m_foundations_v3` after the paid Meta offer was corrected to Balance Foundations.
- Destination: `https://plantbased-balance.org/meta-app-preview.html`
- Eligible traffic: attributed Facebook paid-social visitors only
- Offer: Balance App + Community at AU$19.99/month, charged immediately and monthly until cancelled
- Hypothesis: letting a Facebook lead complete onboarding and explore Balance for five minutes before presenting one compact paid unlock will convert more qualified visitors into paying App + Community members than asking for a free account first.
- Primary KPI: attributed paid App + Community subscriptions from `trial_started`.
- Diagnostic metrics: landing CTA rate, onboarding start and completion, preview start, timed gate reach, Stripe checkout start, Stripe purchase, account completion, subscription claim, and first planned/completed workout.
- Guardrails: organic traffic and existing members remain unchanged; the preview cannot write member activity; price and renewal are shown before Stripe; legal acceptance is recorded; Stripe payment is verified against the authenticated account email before app access is activated.
- Decision date: 2026-08-18, or after 100 attributed preview starts if that comes later.
- Keep/stop rule: keep the paid unlock only if paid subscription conversion and early product activation justify acquisition cost. Do not select it from clicks, onboarding completions, or Stripe opens alone.
- Native rollout: the browser flow is the live acquisition path. Keep the installed-app handoff hidden until the matching Android and iOS binaries are published, then enable it with `native_handoff=1`.

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
