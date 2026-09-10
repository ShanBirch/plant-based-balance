# Balance Neuroscience Fitness migration

Requested by Shannon on 10 September 2026.

## Website branding
The full website identity is Balance Neuroscience Fitness. Balance remains the short product name and the harmony logo is retained. Main public headers, homepage copy and page metadata have been updated. Actual plant-based nutrition content remains valid. Existing native app store names remain factual until separately updated in the stores.

## Domain and email, pending
- Current website: https://plantbased-balance.org, Netlify site future-balance.
- Current registrar: Squarespace (confirmed by domain purchase email).
- Current mail: Google Workspace, shannon@plantbased-balance.org.
- Candidate: balanceneurosciencefitness.com. Registry RDAP returned 404 and Squarespace offered it for registration at A$13.50 promotional pricing, A$27 displayed regular price on 10 September. Final billing, renewal and taxes are not verified. Domain is not purchased. Checkout reached Squarespace login.
- Prepared mailbox choice: shannon@balanceneurosciencefitness.com, retaining the existing Workspace inbox; hello@ can be an additional public alias. No new mail address is active. Workspace administrator sign-in for the existing domain currently requires its password. Do not reset credentials or publish unverified email addresses.

## Completion sequence
1. Complete the bank-required verification and the already-approved one-year domain purchase. Do not ask again for domain choice or ordinary payment approval. Respect any actual bank or platform verification requirement.
2. Add domain to the existing Google Workspace account using the appropriate alias/secondary-domain arrangement. Verify ownership and mail records; preserve the old mailbox and history. Verify inbound and outbound delivery, SPF, DKIM and DMARC before updating public contact details.
3. Add the new domain to the existing Netlify site, configure registrar DNS and verify HTTPS.
4. Audit host allowlists, auth redirects, payment return URLs, forms, email links and native app host dependencies before making it primary. Preserve existing callback/webhook/app routes.
5. Update canonical and social URLs, public contact links and form recipients only after the new destinations work. Verify form delivery explicitly.
6. Preserve old-domain URLs and query strings with carefully scoped redirects; do not blanket redirect native/auth/API routes without testing.
7. Verify login, password reset, checkout return, contact forms and the main public pages on both domains. Keep the old domain and mail active during the transition.

No new domain, email account or domain redirect has been activated in this change.

## Verified Netlify preparation

Netlify CLI is authenticated to the shanbot team. Existing site: future-balance, site ID bc25724f-5adb-4212-8d72-015545483d1e. Current primary domain is plantbased-balance.org, HTTPS is forced, and the API returned no additional domain aliases. Reuse this site; do not buy Squarespace hosting or create a second Netlify website.

After confirmed registration, attach the new apex and www names to this site. If retaining Squarespace DNS, use its supported DNS types: apex A record to 75.2.60.5 if ALIAS/ANAME is unavailable, and www CNAME to future-balance.netlify.app. Confirm site-specific values in Netlify before applying. Source: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/

Native dependencies explicitly reference the old domain in capacitor.config.ts (server URL and allowNavigation). Checkout host validation references it in netlify/edge-functions/lib/checkout-guard.js. Keep native, auth, webhook and payment paths on the old host until tested; do not introduce an unconditional old-to-new redirect.
