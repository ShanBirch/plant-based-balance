# Balance public domain policy

Confirmed by Shannon on 1 November 2026: use **https://balanceneurosciencefitness.com** for every new Balance website, landing page, public link and generated customer destination. The short product name remains Balance; the website brand is Balance Neuroscience Fitness.

Netlify project future-balance has this domain configured as primary with a valid HTTPS certificate. plantbased-balance.org stays connected for compatibility. Public marketing routes redirect permanently to the corresponding new-domain path; query parameters and fragments must survive. Search canonical URLs, social metadata, sitemap and robots use the new domain.

Do not cancel the old registration or remove its DNS/email. Existing installed native apps, authenticated app storage, API callers, OAuth callbacks, webhooks, signed links and email have separate migration requirements. Keep their current technical endpoints functioning until each integration is verified. A public-brand change does not authorize changing email recipients or deleting old records.

Future work must use the new public domain even when historical documentation, templates or screenshots show the old one. Do not publish a new independent Balance website on the legacy domain.

Validation: check HTTPS, old/new marketing routes, path/query/fragment preservation, canonical metadata, sitemap and continued legacy API/app access. This change has no layout or mobile overlay changes.
