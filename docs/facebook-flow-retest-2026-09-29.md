# Facebook live retest, 29 September 2026

Shannon requested another complete Facebook run with edge cases. Used only Shannon's existing Balance APP Messenger test conversation, subscriber `3259915884123945`, thread `cd6aace6-b5a5-443f-a89c-9561a1dd5248`. No other contact was messaged. Native history is retained; test resets use an explicit episode timestamp.

## Setup correction

The existing reset was Instagram-only, so the first attempt included earlier test messages and failed to represent a fresh enquiry. Commit `e9a407df` extends isolation to explicitly enabled, verified Balance ManyChat test contacts, preserving linked-client and non-test history. Added the test-flow flag and current challenge routing to this older test contact; its creation date predates the new-customer campaign route. Deployment was ready at 09:54:01 UTC. Reset at 09:56 before the clean run. This does not establish that every historical contact automatically changes campaign.

## Live results

| Scenario | Verified outcome | First reply |
| --- | --- | --- |
| Free-written home/dumbbell enquiry, no keyword | Hey :) opener, direct home-training answer, ten-week goal question | 27.4 s |
| Strength and weight goal | Brief acknowledgment and relevant consistency/barrier question; no repeated inclusions | 36.7 s |
| Two rapid messages: changing shifts, three home sessions, accountability and price | One reply sequence addressed both messages; AUD 75/125 weekly, AUD 120 onboarding, ten-week minimum totals 870/1370; relevant support plus natural booking invitation | 28.6 s |
| Not yet; must I be vegan? | Answered plant-based flexibility, no booking link or repeated invitation | 28.5 s |
| Explicit booking request after earlier refusal | Native booking button delivered automatically; click opened the correct 60-minute video-call calendar, Brisbane timezone and available slots | 25.9 s |
| Separate synthetic medical-disclosure case | Conditional response deferred to treating-clinician guidance and asked about exercise restrictions; no prescription or booking pitch | 28.6 s |
| Stop messaging; not interested | `dm_opt_out` hold, no scheduled send and no outbound; held acknowledgment was canceled as completed test cleanup | No send, expected |

The medical response was “Potentially, yes, but I'd want to follow any guidance from your treating clinician first. Have they given you any exercise restrictions?” This is a routing/conversation test, not clinical validation or medical clearance. No actual booking was made.

Sent alert IDs in table order: `1f175d67-5c98-4255-8eb6-94ac6180087f`, `1772bec9-d640-4e55-89d2-46b49c12e9aa`, `2cc7e2af-7fc0-4794-8918-03282d7622ec`, `2c106bc4-2ff6-4d16-a938-70bce6f6f32e`, `77013e9c-ce5e-40c4-b44c-ce6b13852a8f`, `fb347000-5c24-4e36-985e-87180936173b`. Every sent turn passed review and canonical outbound readback matched Messenger. Stop alert: `6ead6e33-36b8-4d9f-9e36-3e8549f913da`.

No duplicate reply sequences appeared in this run. First replies were 25.9–36.7 seconds; no casual 15-minute delay. The full conversation completed automatically without manually releasing a draft. The initial setup attempts are separate from this clean run.

## Automated checks and evidence

36 reset/challenge checks and 27 sender, stale-conversation, health and timing checks passed. These include explicit opt-in isolation, linked-client/non-test preservation, expired messaging windows, channel mismatch, duplicate-send rejection, booking text payloads and newer-message invalidation. They are focused checks, not a full-repository suite.

Ignored evidence: `output/challenge-dm/facebook-reset-tests.log`, `facebook-edge-guards.log`, `facebook-retest-full-flow.png`, `facebook-retest-health-and-stop.png`. Native typing on the ManyChat Facebook/WhatsApp path remains unimplemented; this test does not change that limitation.
