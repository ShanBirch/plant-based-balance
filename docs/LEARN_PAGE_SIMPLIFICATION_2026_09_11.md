# Learn page simplification, 11 September 2026

Shannon approved a shorter public Learn page after reviewing the proposed structure, and asked that the product be verified before implementation.

Product checked against CODEX.md, the six-week BALANCE_FOUNDATIONS curriculum in lib/learning-inline.js, docs/BALANCE_FOUR_PART_COURSES.md, lib/learn-course-pricing.js, the checkout guard, and lib/meta-ad-trial.js. Learn is the fixed six-week behaviour-change course with personalised workout and meal support, one weekly check-in and plan review from Shannon, and six weeks of app/community access. It is part one of Learn, Master, Become, Lead. The AUD $149 upfront offer ends without renewal; new upfront purchases become AUD $450 on 21 October 2026 Brisbane time. The separate AUD $24.83 weekly membership has six minimum payments (AUD $148.98), then continues weekly until cancellation. Product, billing and entitlements are unchanged.

The overview now contains the core promise, inclusions, weekly rhythm, two historical coaching examples, Shannon's introduction and the preview action. Curriculum, later stages, weekly terms, support boundaries and certificate details expand on demand. Installation help is collapsed next to the first action and opens when an iPhone visitor starts installation or recovers their signed return link. Existing account-first and signed attribution parameters remain intact. Pricing stays tied to the shared dated/server offer; only this page's deadline presentation is compact.

## Measurement

- Hypothesis: a shorter overview helps visitors understand the offer and begin a preview without losing access to important details.
- Page variant: learn_simple_v1. Keep meta_trial=facebook_5m_foundations_v3 as the existing functional preview contract.
- Primary KPI: confirmed Learn purchases per unique Learn landing visitor.
- Diagnostics: existing first-party page_view, cta_click, signup, preview and checkout progression, plus scroll depth.
- Guardrails: signup and iPhone return failures, pricing mismatches, and payment/renewal confusion.
- Decision date: 5 October 2026, after the planned 21 September launch. Compare with the prior period cautiously; this is a sequential change, not a randomised experiment.

## Verification

Desktop and phone layout review, expandable course/payment details, preview navigation, iPhone handoff unit checks, and launch-deadline pricing checks. The existing billing-schedule suite has two unrelated harness failures because its data-URL import cannot resolve the checkout guard's relative pricing import; those test/backend files are unchanged by this page revision.
