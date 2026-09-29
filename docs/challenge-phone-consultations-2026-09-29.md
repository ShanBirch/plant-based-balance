# Summer Shred phone consultation choice

29 September 2026. Shannon requested normal phone calls for people who do not want a video consultation.

The challenge booking page offers **Video call (Google Meet)** or **Phone call (Shannon calls you)**. Both retain the configured 60-minute slots and existing availability. The form collects the number; the DM need not collect it. Phone selection changes the instructions and confirmation, persists `call_type=phone`, includes the number in Shannon's calendar event, and creates no Google Meet conference. Existing Zoom/PT routes retain video.

The shared challenge writer explains the phone option and respects people declining video. An explicit request to book a normal phone call permits the existing booking card. A preference alone does not give permission to send a card. Refusal of all calls, not-yet responses, medical gates, opt-outs, and personal/flirtatious conversation protections remain.

The first live Messenger test found a correct drafted phone reply held by the older personal-video-chat classifier. Explicit booking language now counts as business context; sexual/flirtatious wording still requires manual handling. The failed synthetic alert was canceled before a fresh test episode.

## Verification

- 57 focused checks passed across challenge booking, compact booking UI, challenge DM consent/content and personal-DM boundary tests.
- Mocked full booking requests verify both phone/video database values, 60-minute duration, calendar descriptions and conditional Meet creation. No real booking/calendar event was created by testing.
- Deployed booking page verified with the Phone call choice and matching instructions.
- Fresh live Messenger test at 20:17 Brisbane: "I don't want a video call. Can I book a normal phone call instead?" The automatic reply arrived at 20:18: "Yep, you can choose Phone call on the booking page. Shannon will call the mobile number you enter at your booked time." It was followed by the existing booking card. Review passed, with no send hold. Screenshot: `output/challenge-dm/facebook-phone-booking-reply.png`.
- Mobile form checked in small portrait and landscape, light/dark, zero and simulated nonzero top/bottom safe areas. Form can scroll to the confirmation control; header controls clear the status-bar region. Preview helpers were stopped afterward.
- Screenshot evidence is under ignored `output/challenge-dm/phone-production-mobile.png`, `phone-production-mobile-bottom.png`, `phone-portrait-notch.png` and `phone-landscape-dark-notch.png`.

Implementation: `3173f02b`; live-test boundary correction: `95eb6d06`.
