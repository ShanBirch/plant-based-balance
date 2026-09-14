# Photo-led bio, 13 September 2026

Variant: `bio_photo_v1`. Hypothesis: full-photo destinations with Learn first make the bio easier to explore and improve qualified Learn visits. Primary KPI: paid Learn purchases per bio visitor. Diagnostics: `bio_landing` views and `bio_learn`, `bio_app`, `bio_coaching`, `bio_story`, `bio_results`, `bio_call` entry completions in the existing first-party onboarding funnel, mode `bio_photo_v1`. Guardrails: broken links, load weight, mobile overflow and CTA readability. Review 27 September 2026. UTMs and click identifiers are forwarded without replacing original first-touch storage; existing visitor/session identifiers are reused.

The five photos were supplied by Shannon on 13 September and copied unchanged as shannon-panel-1 through 5. Their display crops remove the screenshot letterboxing without altering the originals. Learn, App, Coaching, My Story and Results each have one photo panel. Booking, account and contact remain in the accessible native dialog menu over the first photo; the separate masthead/footer backgrounds are removed. No app entitlements, checkout prices or payment routes changed.

QA: 320x568 and 390x844 portrait, cream/dark menus, open/close and scrolling. The first release also checked 568x320 landscape and simulated 59px top/34px bottom notch spacing; repeat those checks for the menu release. Five real-image links remain visible without JavaScript; initial image eager, later images lazy. Focus outline, reduced motion, contrast and attribution behavior checked. Physical Instagram in-app browser remains a device-specific follow-up.


## Shared website menu, 14 September 2026

The original photo-overlay masthead is preserved: circular menu button at left, white Balance / Shannon Birch identity at right, no separate background bar. Only the opened drawer uses the inner pages' light surface, left position, link order, wording and spacing. The theme switcher remains removed. Existing photo links and attribution events remain in place. Shared navigation restores focus on close and closes restored menus when returning with browser Back.

This is a navigation consistency fix to `bio_photo_v1`, with the same KPI and review date above. Guardrails: menu destinations, attribution preservation, keyboard focus, browser return, mobile safe-area clearance and reachable final menu item. Browser checks cover 320x568, 390x844, 568x320 and 1440x1000 with light/dark browser preferences and simulated 0px or 59px top / 34px bottom safe areas. Physical-device verification is not implied by browser simulation.


Photo restoration: Shannon requested the original photo presentation rather than enlarged wide-screen crops. Restored the exact photo CSS from before this task, retaining only the shared drawer and theme-switcher removal. Compare photo geometry and fitting against the pre-task revision `b2038917`; do not reinterpret the original photo layout.
