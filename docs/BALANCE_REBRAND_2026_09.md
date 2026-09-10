# Balance Neuroscience Fitness migration

Requested by Shannon on 10 September 2026.

## Website branding
The full website identity is Balance Neuroscience Fitness. Balance remains the short product name and the harmony logo is retained. Main public headers, homepage copy and page metadata have been updated. Actual plant-based nutrition content remains valid. Existing native app store names remain factual until separately updated in the stores.

## Domain and email, pending
- Current website: https://plantbased-balance.org, Netlify site future-balance.
- Current registrar: Squarespace (confirmed by domain purchase email).
- Current mail: Google Workspace, shannon@plantbased-balance.org.
- Candidate: balanceneurosciencefitness.com. Registry RDAP returned 404 and Squarespace offered it for registration at A$13.50 promotional pricing, A$27 displayed regular price on 10 September. Final billing, renewal and taxes are not verified. Domain is not purchased. Checkout reached Squarespace login.
- Candidate mailbox: shannon@balanceneurosciencefitness.com, with hello@ as an optional alias. User preference pending. Do not publish these as active addresses.

## Completion sequence
1. Confirm domain choice and purchase with a reviewed total/renewal; sign in to the existing Squarespace account.
2. Add domain to the existing Google Workspace account using the appropriate alias/secondary-domain arrangement. Verify ownership and mail records; preserve the old mailbox and history. Verify inbound and outbound delivery, SPF, DKIM and DMARC before updating public contact details.
3. Add the new domain to the existing Netlify site, configure registrar DNS and verify HTTPS.
4. Audit host allowlists, auth redirects, payment return URLs, forms, email links and native app host dependencies before making it primary. Preserve existing callback/webhook/app routes.
5. Update canonical and social URLs, public contact links and form recipients only after the new destinations work. Verify form delivery explicitly.
6. Preserve old-domain URLs and query strings with carefully scoped redirects; do not blanket redirect native/auth/API routes without testing.
7. Verify login, password reset, checkout return, contact forms and the main public pages on both domains. Keep the old domain and mail active during the transition.

No new domain, email account or domain redirect has been activated in this change.
