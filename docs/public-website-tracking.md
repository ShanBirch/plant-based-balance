# Public website tracking

Released 22 September 2026. Hypothesis: recording the full public navigation path reveals where Instagram visitors leave before account setup or store handoff. Review after seven days (29 September); compare distinct browser IDs and sessions, not raw clicks. Primary KPI: unique browsers reaching an app-store handoff or account setup. Diagnostics: entry page, source, navigation destination, scroll milestones, elapsed page time. Guardrail: no new third-party tracking or collection of form answers on newly covered public pages.

## Coverage and definitions

- Bio, app/homepage, coaching, story, results, booking and legacy index now load the shared tracker. Existing Learn, contact and checkout routes retain their tracking.
- `page_view`, `scroll`, `click`, existing `cta_click` and `time_on_page` remain the original events. Time is elapsed time until first hide/exit, not proof of active attention.
- `app_download_click` is an additional event when a link or annotated button hands off to Apple App Store or Google Play. Metadata `platform` is `ios` or `android`. Do not count these as installations, or sum these and their accompanying CTA events as separate people.
- Click metadata includes `destination` (origin/path, no query) and `link_group` for the bio menu. The capture listener also catches buttons that stop propagation before redirecting.
- Existing browser/session identifiers match the onboarding tracker, which attaches account identity only after authentication. First touch remains unchanged; a new explicit source replaces old last-touch campaign identifiers. External referrers are marked `referral`, never assumed to be paid ads.
- Newly covered pages use `data-first-party-only="true"`; they do not load GA or a Meta pixel. This change does not create Meta remarketing audiences.

## Reporting and verification

Query `lp_events` by Brisbane-time reporting window. Exclude `metadata.test_mode=true`, `metadata.traffic_type='bot'` and known internal/test browsers. Browser IDs are not verified individual people. Only claim campaign attribution where campaign/ad identifiers or verified DM attribution exist.

Open a public entry page with `?analytics_test=1&utm_source=tracking_qa` for live QA. The test flag persists for that tab session and also marks the onboarding tracker. Close the QA tab afterwards. Read the corresponding events back from the database; an HTTP response alone is insufficient. The endpoint returns 503 instead of false success if storage is unavailable.

Coverage starts at deployment; missing historical visits cannot be reconstructed. Cross-device/store installation attribution is separate and cannot be inferred from a website click. Google authentication is a sign-in provider, not an acquisition source. No named-customer audience upload, email, DM or push campaign is authorized by this tracking change.
