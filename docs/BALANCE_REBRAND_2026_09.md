# Balance Neuroscience Fitness migration

Requested by Shannon on 10 September 2026. Status updated 11 September 2026.

## Website branding
The full website identity is Balance Neuroscience Fitness. Balance remains the short product name and the harmony logo is retained. Main public headers, homepage copy and page metadata have been updated and deployed. Actual plant-based nutrition content remains valid. Existing native app store names remain factual until separately updated in the stores.

## Domain purchased; connection pending
- Current working website: https://plantbased-balance.org, Netlify site future-balance.
- Purchased domain: balanceneurosciencefitness.com, Squarespace. Shannon completed payment. Checkout displayed success and A$20.79 paid (A$18.90 plus A$1.89 GST), one year. Domain management displayed expiry 11 September 2027, automatic renewal enabled at A$27, WHOIS privacy and domain lock enabled.
- Squarespace displayed contact email verification required within 15 days. Verification remains pending; do not assume purchase alone completed it.
- Both balanceneurosciencefitness.com and www.balanceneurosciencefitness.com were added to the existing Netlify site's domain aliases and read back through the API.
- Registrar DNS still contains the Squarespace Defaults preset. Removing/replacing it requires fresh Google authentication. The in-app Continue control had no effect. Chrome opened the Google account chooser, but account-selection controls timed out. The sign-in tabs were left for Shannon; no DNS change was made.
- Current mail: Google Workspace, shannon@plantbased-balance.org.
- Prepared mailbox choice: shannon@balanceneurosciencefitness.com, retaining the existing Workspace inbox; hello@ can be an additional public alias. No new mail address is active. Workspace administrator sign-in for the existing domain currently requires its password. Do not reset credentials or publish unverified email addresses.

## Instagram
Shannon explicitly requested the new website in the Instagram profile on 11 September. Intended Balance profile is shan_n_sunny. The desktop Instagram editor states that website links can only be edited in the mobile app. The current Chrome session was goldcoast_ai_solutions, so no account profile was changed. Once HTTPS and the bio route are verified, the intended destination is https://balanceneurosciencefitness.com/bio. Do not publish the pending link before it works.

## Completion sequence
1. Complete Squarespace's Google reauthentication and registrant email verification. Domain purchase is already complete; do not purchase it again.
2. Replace Squarespace web defaults with the Netlify DNS values below, then verify public DNS and HTTPS.
3. Add the domain to the existing Google Workspace account using the appropriate alias/secondary-domain arrangement. Verify ownership and mail records; preserve the old mailbox and history. Verify inbound and outbound delivery, SPF, DKIM and DMARC before updating public contact details. Existing Squarespace email-security defaults must be reconciled with the actual mail provider's records.
4. Audit host allowlists, auth redirects, payment return URLs, forms, email links and native app host dependencies before making the domain primary. Preserve existing callback/webhook/app routes.
5. Update canonical and social URLs, public contact links and form recipients only after the new destinations work. Verify form delivery explicitly. Complete Instagram's mobile link change.
6. Preserve old-domain URLs and query strings with carefully scoped redirects; do not blanket redirect native/auth/API routes without testing.
7. Verify login, password reset, checkout return, contact forms and the main public pages on both domains. Keep the old domain and mail active during the transition.

## Verified Netlify preparation
Netlify CLI is authenticated to the shanbot team. Existing site: future-balance, site ID bc25724f-5adb-4212-8d72-015545483d1e. Current primary domain remains plantbased-balance.org and HTTPS is forced. Reuse this site; do not buy Squarespace hosting or create a second Netlify website.

For Squarespace external DNS, apex A record to 75.2.60.5 if ALIAS/ANAME is unavailable, and www CNAME to future-balance.netlify.app. Source: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/

Native dependencies explicitly reference the old domain in capacitor.config.ts (server URL and allowNavigation). Checkout host validation references it in netlify/edge-functions/lib/checkout-guard.js. Keep native, auth, webhook and payment paths on the old host until tested; do not introduce an unconditional old-to-new redirect.
