# WhatsApp Cloud API setup

Balance receives WhatsApp messages at:

`https://plantbased-balance.org/.netlify/functions/whatsapp-webhook`

It creates a high-priority, approval-only **WhatsApp** card in Needs You. Sending from that card uses the Cloud API, records the exact sent copy, and refuses free-form replies after Meta's 24-hour customer-service window has ended. There is no WhatsApp auto-send path.

## One-time Meta setup

1. In Meta for Developers, add **WhatsApp** to the existing Balance Meta app, or create a dedicated Balance app if there is not one.
2. Add the business phone number that clients should contact. Do not attach Shannon's personal WhatsApp number unless he intends to move that account to the WhatsApp Business Platform.
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
