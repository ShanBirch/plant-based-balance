# WhatsApp Cloud API setup

Balance receives WhatsApp messages at:

`https://plantbased-balance.org/.netlify/functions/whatsapp-webhook`

It creates a high-priority, approval-only **WhatsApp** card in Needs You. The authenticated `whatsapp-draft-background` worker generates a contextual answer using the shared coach voice model, fallback, app grounding and draft reviewer. It reads captured inbound messages and actual sent replies for the same business phone/contact pair. It does not infer client identity from a display name or inherit Instagram/in-app auto-send permissions. Media remains for manual review until its contents can be decoded reliably. Failed generation leaves the inbound visible with no fabricated acknowledgement.

Sending from the card uses the Cloud API, records the exact sent copy, and refuses free-form replies after Meta's 24-hour customer-service window has ended. There is no WhatsApp auto-send path yet. Production auto-send remains blocked until the correct phone is connected, client/manual identities and phone-app echoes can be reconciled, and an authorized end-to-end test passes.

## Account inspection, 27 September 2026

- Balance app `2059731324926909` is published with the WhatsApp use case, but its webhook callback is blank.
- Its owner portfolio `438978263608090` lists an older COCO'S CONNECTED account with an offline US number ending 8102. Do not register or replace this as the requested Balance number.
- The separate Balance - Fitness Gamified portfolio has no WhatsApp accounts.
- Shannon confirmed the existing Balance mobile number ending 9395. Connect that existing account while preserving the phone app. Do not delete its WhatsApp account or migrate it to Cloud-only registration without discussing the consequences.
- Netlify site access works locally, but its environment-variable API returned 401. Credential configuration is not verified by this inspection.

## Rollout measurement

Hypothesis: contextual WhatsApp drafts reduce manual writing time while preserving approval safeguards. Variant: `whatsapp_shared_coach_drafts_v1`. Primary KPI: approved drafts sent unchanged / WhatsApp drafts actioned. Diagnostics: draft failure count, inbound-to-draft latency and sent receipts. Guardrails: no unintended automatic sends, duplicate sends or expired-window sends. Review seven days after the first verified production inbound. Current status: connection and live message verification pending.

## One-time Meta setup

1. In Meta for Developers, add **WhatsApp** to the existing Balance Meta app, or create a dedicated Balance app if there is not one.
2. Connect the existing confirmed Balance WhatsApp Business number through a supported coexistence flow. Ordinary Cloud registration may require moving a phone-app account; do not delete, disconnect or migrate the existing account to bypass that restriction.
3. In WhatsApp > Configuration, set the callback URL to the endpoint above and use the same value for the Verify Token as the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` Netlify environment variable.
4. Subscribe the app to the `messages` webhook field.
5. Create a permanent system-user access token with the WhatsApp messaging permissions and save it in Netlify as `WHATSAPP_ACCESS_TOKEN`.
6. Save Meta's App Secret in Netlify as `WHATSAPP_APP_SECRET`. Do not put either secret in the repository.
7. Optionally set `WHATSAPP_GRAPH_API_VERSION` when Meta requires a version different from the default configured by the app.

## Required Netlify environment variables

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Permanent system-user token used to send replies. |
| `WHATSAPP_APP_SECRET` | Verifies Meta's `X-Hub-Signature-256` webhook signature. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Private value used only during Meta's webhook verification GET request. |
| `WHATSAPP_GRAPH_API_VERSION` | Optional Graph version override. |

The webhook stores the phone-number ID delivered by Meta on each incoming message, so no phone-number ID environment variable is needed.

## Outside the 24-hour window

Meta only permits regular free-form replies in the customer-service window. The Balance sender blocks an expired reply rather than risking a policy breach. Re-engagement after that point must use an approved WhatsApp template from WhatsApp Manager.
