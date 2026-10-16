# Summer Ready relaunch: conversation and in-chat booking

Shannon authorised this change on 16 October 2026. Apply to future eligible genuine Summer Ready/programme enquiries in the existing Balance lead workflow. This is not authorisation to launch ads, contact silent leads, create test appointments, change an existing member's agreement or enable another sender. The existing live browser conversation operator remains the sole external sender; API compatibility prompts do not re-enable retired automatic API dispatch.

## Current offer

- Ten-week challenge, with no expired or newly invented start date. Food guidance is neutral, not plant-based positioning or diet-status qualification.
- The main package is AUD $125 a week: one weekly Zoom session with Shannon and programs written for the person. If they are not exercising, the session can be supervised training. If already exercising, it can be a lesson covering motivation, nutrition and exercise. Explain only the relevant distinction; do not promise a training session plus a separate weekly lesson.
- The previous confirmed AUD $120 onboarding fee has not been revoked. Preserve it and the ten-week commitment, minimum AUD $1,370. Answer direct price questions with all three amounts. Do not invent session length, billing/cancellation/renewal terms or guarantees. The initial consultation is separate from the paid Zoom sessions.
- Retain existing client agreements and other offer routes. A request for another service is not permission to force this challenge.

## Conversation shape

1. Answer the actual opening enquiry in a short message. For a generic challenge-details or tell-me-more enquiry, lead with what they can work towards: ten weeks to work towards their best shape while learning about motivation, nutrition and exercise. This is an aspiration, not a promised physical outcome; adapt to a goal already supplied and do not assume weight loss. Do not lead with written programs, weekly Zoom sessions, app features or a list of what they get. A specific inclusions question receives the relevant inclusions directly; price and home-training questions also receive direct answers without discovery or a call prerequisite. In the reviewed 42-thread candidate sample, 27 exact openings were `Send me the challenge details 😊`, three were home-training questions, and two used the longer Summer Ready prompt. The sample includes mixed paid/organic candidates and does not establish campaign-wide percentages or phrase effectiveness.
2. In a separate bubble, ask what they hope to achieve and what their current exercise routine looks like, only when both are unknown. This deliberately tests a paired opening despite the general one-question preference. Ask only the missing question if either answer is already present; skip both if already known. Do not restart old conversations.
3. Reflect their answer and ask their current struggle/support need when unknown. If they already supplied it, do not ask again. Connect relevant support to their own words, then offer an optional consultation.
4. Respect refusals, thinking time, requests to keep chatting, manual/person holds, authenticity questions and safety/support exceptions. Never turn illness, injury, body-image distress or vulnerability into a booking pitch. No manufactured urgency or automatic silence follow-up.

Use fresh wording, not a pasted sequence. Separate actual direct questions from the background recording in a voice handoff. Do not claim the paired opening has improved conversions; measure goal/routine replies, useful support discussions, explicit call acceptance, verified booking, attendance and sale separately.

Keep the existing active-conversation behavior: check roughly every 30 seconds, reset each person's five-minute idle deadline on every new inbound and do not finish just after sending a reply. Five minutes without a reply permits the session to become idle, not a follow-up nudge. Preserve the 25/28/30-minute invocation limits and durable continuation at the runtime wall, never an expired lease. Prompt replies are the goal, not a guarantee of zero latency.

## Readable message delivery

Send the overview and follow-up questions as separate actual messages, not one large composer block containing line breaks. Usually one to three short, complete bubbles are enough; a short answer can stay in one message. Do not split every sentence or word, manufacture typing claims or add long artificial delays.

Native Business Suite remains the sole live sending path. Each planned bubble gets one Send activation and its own durable delivery evidence under the existing owned reply sequence. The one-Send rule means once per bubble, never repeated attempts to obtain an echo. Do not mark the whole sequence complete after only its first bubble. If delivery is uncertain, stop and reconcile without repeating confirmed or uncertain bubbles. Re-read any new inbound before continuing remaining questions, and skip questions the person has now answered. The API compatibility sender also preserves the planned short bubbles, but its tests are not proof of an observed native live send. No test DM is authorised.

## Offer times and book inside the chat

This fresh authorisation supersedes the 10 October link-only/no-calendar-read/no-on-behalf-booking restriction for this scoped lead experiment. It does not change calendar settings or general sending permissions.

The existing operator can read live availability, offer two or three returned times, and book the selected consultation on the person's behalf after explicit consent. The prospect does not need to fill in the booking website. Use the existing booking service, not a standalone Calendar event, so conflict checks, database records, invitations, confirmation email and the existing questionnaire stay together.

The helper is `scripts/balance-dm-call-booking.mjs`. The installed operational copy belongs beside the live conversation contract under `C:/Users/shann/.codex/automations/balance-ig-browser-24-hour-shift-dispatcher-2/`. The operator reads this contract before eligible lead replies. The helper is an on-demand booking operation, not a sender, monitor or scheduled worker, and its boolean consent fields do not grant ownership or replace native consent evidence.

### Before any action

- Retain the existing active dispatcher lease and exact owned source/action claim. Read complete native history and canonical source identity, newest inbound/outbound, hold flags and previous delivery/booking receipts. A foreign healthy claim or uncertain prior booking means stop/reconcile, never compete.
- Confirm the lead's timezone or explicitly label the offered times as Australia/Brisbane. Do not infer their timezone from profile name, presumed age or location. Reuse a timezone only when genuinely verified in this conversation.
- Keep all private input files and receipts in an ignored task folder or the private automation directory, never in Git or public previews. Store ordinary fitness-goal context only in the booking goal/email, not unrelated sensitive disclosures.

### Availability

Run `node <installed-helper> availability --timezone Australia/Brisbane --output <private-offer.json>` with their verified IANA timezone substituted. This calls the existing prospect endpoint, verifies booking enabled, calendar connected and no connection/reconnect errors, and returns up to three exact slots with labelled recipient timezone. The read is authorised; no live booking is created by this command.

If fewer slots exist, offer only those. Zero slots is not permission to invent times or change operating hours. A failed check uses the existing consented booking link only as a fallback and explains that current times could not be checked. A returned slot is not held. Re-read availability when the evidence is over five minutes old or before claiming that specific times remain available.

### Selected slot and contact details

After explicit acceptance of a specific date/time, confirm only missing name, email, mobile, timezone and phone/video preference. Prefer an optional Google Meet video consultation if they are comfortable, asking whether that suits rather than silently selecting video. Accept phone without persuasion if they prefer it or are not comfortable with video. Google Meet is the consultation platform; the paid weekly sessions remain Zoom. Usually only email and mobile are missing; do not ask known identity/timezone details again. Tell them the confirmation email includes the questionnaire and ask them to fill it out before the call. Do not claim email delivery in advance. The confirmation email and calendar invitation go to that supplied address, and a phone consultation uses the supplied mobile. Do not submit information to another destination or collect extra medical history in DMs.

Use a private JSON booking input containing the verified UUID `actionId`, `threadId`, `sourceMessageId`, `ownershipVerified:true`, `selectionConfirmed:true`, `contactConfirmed:true`, `name`, `email`, `phone`, `timezone`, `callType` (`phone` or `video`), `startsAt`, the helper's fresh `offer`, a brief ordinary `goal`, and existing bounded campaign `attribution` when verified. These booleans record checks already performed, not a way to bypass them.

Run `node <installed-helper> book --input <private-input.json> --receipts-dir <absolute-private-receipts-directory>`. The helper freshly rechecks availability, atomically creates a per-action no-repeat receipt, and uses the existing booking endpoint. The service rechecks the slot again and rejects a conflicting appointment. Do not alter settings or use client/PT/outside-hours source variants to obtain extra times.

### Readback and truthful confirmation

- `confirmed`: verify the returned booking time, timezone and call type against the chosen slot. Record the booking ID on the source/action receipt. Then compose the ordinary confirmed-booking reply through the same existing owned native sending path.
- `confirmationEmailSent:true` means the email service accepted the confirmation containing the pre-call form, not guaranteed inbox delivery or a completed questionnaire. If false, truthfully say the booking is recorded but the email needs attention; surface that to Shannon. Do not send duplicate confirmations through a second tool.
- `booking_recorded_calendar_pending`: a database booking exists but the calendar step needs reconciliation. Surface to Shannon and do not claim a completed calendar invitation.
- `rejected`: explain a taken slot or missing detail, refresh alternatives and wait for a new decision. Never silently substitute another appointment.
- `pending_no_repeat` or `uncertain_no_repeat`: do not submit again, even after a timeout. Reconcile the private receipt, existing booking record and calendar/email outcome through read-only checks first. Do not change action IDs to retry the same uncertain booking.
- A replay of the same completed action returns its previous receipt without another POST. Changed details on the same action are rejected. Rescheduling/cancellation require the existing appropriate workflow, not a second unrelated appointment.

The existing general pre-call questionnaire is `https://plantbased-balance.org/pre-call.html`. The booking email already includes it, with the existing specialised form option when relevant. No new questionnaire or email automation is needed. Keep the normal booking confirmation separate from a paid enrolment or completed sale.

## Verification

## Same-day call scheduling, 16 October update

After explicit call acceptance, send a short separate acknowledgement that availability will be checked, then call the existing calendar-backed availability service. Offer the earliest real eligible time today where possible, then one option on each of the next two available days. If today is unavailable, start with the next available morning/day. Keep existing weekday/open-hour restrictions; do not invent tomorrow or weekend availability. The scoped prospect endpoint requires two hours' notice and clips configured hours to a 7pm Brisbane finish, both when reading availability and creating bookings. Other booking sources retain their configured notice. The helper independently enforces notice and finish times and rechecks before creating the appointment. A calendar conflict check is not permission to disclose private event details. Existing prospect SMS/email is not a verified notification to Shannon; coach notification delivery remains a separate outstanding setup item.

Use mocked calls for booking tests: availability failure/reconnect, correct timezone, stale/unsupported slot, missing consent, busy slot, duplicate/concurrent actions, timeout/no-repeat, partial calendar/email outcomes and successful confirmation. Keep the existing pre-call-email, calendar-fail-closed, source/attribution and consent/safety tests. One read-only live prospect-availability check on 16 October succeeded with booking enabled and calendar connected; that is not permanent availability evidence and no real appointment was created.
