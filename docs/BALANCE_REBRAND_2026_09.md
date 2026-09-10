# Balance Neuroscience Fitness migration

Requested by Shannon on 10 September 2026. Status updated 11 September 2026.

## Website branding
The full website identity is Balance Neuroscience Fitness. Balance remains the short product name and the harmony logo is retained. Main public headers, homepage copy and page metadata have been updated and deployed. Actual plant-based nutrition content remains valid. Existing native app store names remain factual until separately updated in the stores.

## Domain connected and verified
- Current working website: https://plantbased-balance.org, Netlify site future-balance.
- Purchased domain: balanceneurosciencefitness.com, Squarespace. Shannon completed payment. Checkout displayed success and A$20.79 paid (A$18.90 plus A$1.89 GST), one year. Domain management displayed expiry 11 September 2027, automatic renewal enabled at A$27, WHOIS privacy and domain lock enabled.
- Registrant contact email verified on 11 September. Squarespace returned Email Successfully Verified.
- Both balanceneurosciencefitness.com and www.balanceneurosciencefitness.com were added to the existing Netlify site's domain aliases and read back through the API.
- Shannon completed reauthentication and removed Squarespace Defaults. Saved apex A @ to 75.2.60.5 and www CNAME to future-balance.netlify.app, TTL 4 hours. Squarespace rejected ALIAS because DNSSEC is enabled; DNSSEC was preserved. Authoritative DNS confirms the new records. Netlify renewed the certificate successfully, covering both new names and the existing domain; expiry 9 December 2026. HTTPS GETs returned 200 for new apex homepage, new www bio and old-domain bio. The new apex bio was also verified in the browser.
- Current mail: Google Workspace, shannon@plantbased-balance.org.
- Prepared mailbox choice: shannon@balanceneurosciencefitness.com, retaining the existing Workspace inbox; hello@ can be an additional public alias. No new mail address is active. Workspace administrator sign-in for the existing domain currently requires its password. Do not reset credentials or publish unverified email addresses.

## Instagram
Shannon explicitly requested the new website in the Instagram profile on 11 September. Intended Balance profile is shan_n_sunny. The desktop Instagram editor states that website links can only be edited in the mobile app. The current Chrome session was goldcoast_ai_solutions, so no account profile was changed. The verified destination is https://balanceneurosciencefitness.com/bio. This link is ready for the Instagram mobile profile editor; the profile link itself is not changed yet.

## Completion sequence
1. Domain purchase, reauthentication and registrant email verification are complete; do not purchase it again.
2. Registrar DNS and HTTPS are complete. Some recursive resolvers may temporarily cache old records for up to the previous 4-hour TTL.
3. Add the domain to the existing Google Workspace account using the appropriate alias/secondary-domain arrangement. Verify ownership and mail records; preserve the old mailbox and history. Verify inbound and outbound delivery, SPF, DKIM and DMARC before updating public contact details. Existing Squarespace email-security defaults must be reconciled with the actual mail provider's records.
4. Audit host allowlists, auth redirects, payment return URLs, forms, email links and native app host dependencies before making the domain primary. Preserve existing callback/webhook/app routes.
5. Update canonical and social URLs, public contact links and form recipients only after the new destinations work. Verify form delivery explicitly. Complete Instagram's mobile link change.
6. Preserve old-domain URLs and query strings with carefully scoped redirects; do not blanket redirect native/auth/API routes without testing.
7. Verify login, password reset, checkout return, contact forms and the main public pages on both domains. Keep the old domain and mail active during the transition.

## Verified Netlify preparation
Netlify CLI is authenticated to the shanbot team. Existing site: future-balance, site ID bc25724f-5adb-4212-8d72-015545483d1e. Current primary domain remains plantbased-balance.org and HTTPS is forced. Reuse this site; do not buy Squarespace hosting or create a second Netlify website.

For Squarespace external DNS, apex A record to 75.2.60.5 if ALIAS/ANAME is unavailable, and www CNAME to future-balance.netlify.app. Source: https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/

Native dependencies explicitly reference the old domain in capacitor.config.ts (server URL and allowNavigation). Checkout host validation references it in netlify/edge-functions/lib/checkout-guard.js. Keep native, auth, webhook and payment paths on the old host until tested; do not introduce an unconditional old-to-new redirect.
## Email activation update, 11 September
The new domain is a verified user alias domain for plantbased-balance.org in the existing Workspace tenant, with no extra user subscription. Google confirmed Gmail activation. Authoritative MX is smtp.google.com, priority 1. SPF is v=spf1 include:_spf.google.com ~all. A 2048-bit DKIM TXT record at google._domainkey was saved and confirmed in authoritative DNS; Google completed its SPF/DKIM setup successfully. Squarespace removed its incompatible Email Security preset during the mail setup. DMARC has not yet been configured for active mail.

The address shannon@balanceneurosciencefitness.com maps to the existing inbox. Continue signing into Google with shannon@plantbased-balance.org. Gmail's Send mail as list still only shows the old address. Add another email address is available, but its popup did not open through automation. The Gmail Accounts settings tab is left ready for this final sender configuration. End-to-end inbound/outbound delivery has not yet been tested; website contact email remains old until tested.

Shannon explicitly reaffirmed permission to complete these setup and sign-in steps without repeated approval. Repeated Squarespace reauthentication was a browser-control limitation, not lack of user permission.
