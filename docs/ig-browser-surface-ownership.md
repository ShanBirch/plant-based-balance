# Browser surface ownership — Shannon, 1 October 2026

This latest instruction supersedes the previous global browser queue, independent-profile requirement, idle-dispatcher handoff and shorter proactive runtime walls. Shared signed-in Chrome is supported via independently bound tab handles. Only tab-bound Playwright/DOM commands are permitted during parallel operation; no desktop coordinates, keyboard focus, profile-wide account changes or navigation of another worker's tab.

## Owners and schedule
Dispatcher: Meta Business Suite only, every five minutes, independent of Instagram. One owned dedicated Business Suite tab, Balance APP Page 561122130919678 / shan_n_sunny.
Outreach: native Instagram, 06:00, 09:30, 18:30 Brisbane.
Engagement: native Instagram, 06:30, 10:00, 19:00 Brisbane.
The two Instagram workers serialize on the Instagram surface lease. Each proactive run has up to thirty minutes: stop new claims at minute 25, reconcile at 28, finish/release by 30. A run may finish earlier when its useful work is complete. Preserve limits: outreach five follows and five verified follow-back welcomes/run, fifteen each/day; engagement twenty/run, sixty/day, no quota.

## Verified acquisition
Before acquisition, enumerate current tabs, use only your own assigned/created tab and inspect its DOM. Read current URL and verify the correct native account/Page. Do not infer account from cookies or browser name. Store evidence and timestamp in cursor_start.browser_surface:
{"kind":"meta_business_suite" or "instagram","browser_id":"actual browser ID","tab_id":"actual controlled tab ID","account":"shan_n_sunny","page_id":"561122130919678" for MBS,"url":"actual native URL","verified_at":"fresh UTC ISO timestamp"}.
Call start_ig_browser_shift with a fresh run_id and p_lease_seconds=300. Dispatcher lane missed_dm_audit, outreach plant_based_discovery_follows, engagement active_client_instagram_community. Proof older than five minutes, wrong host/account/Page/lane or missing binding fails closed.
Do not use request_ig_browser_work/acquire_ig_browser_work: the old queue is retired and kept only as historical receipts. Dispatcher does not yield to pending Instagram requests.
One MBS owner and one Instagram owner may coexist. A second owner of either surface or of the same tab cannot acquire. A healthy unclassified legacy lease excludes both surfaces until its own finalization/expiry; never force-release a foreign owner or silently relabel it.
Surface/tab binding is immutable for a run. A changed/reopened tab needs fresh identity verification and a new run after finalizing the old one. Do not replay an old approval batch; re-read current native/canonical state and all holds.

## Heartbeat, action and release
Heartbeat at least every two minutes, explicitly 300 seconds. Verify ig_browser_surface_owned(run_id, surface) before native work. Expired/legacy/over-thirty-minute runs cannot renew or claim.
Global atomic recipient/thread/source claims remain shared; the tab lease does not authorize touching an already claimed person. Existing subject_key and thread_id uniqueness, holds, cooldowns, recipient uncertainty and no-repeat receipts remain in force across both surfaces. No competing scans/actions for the same person.
Immediately before any native action call ig_browser_action_owned with exact run, surface, owned tab ID, action ID/version, token and exact source_message_id (null only when the action legitimately has no inbound message source). False means stop that action. Re-read newest native/canonical context, source, account, prior outbound/receipts, client/manual/opt-out and proactive pacing gates. One activation, durable delivery/follow evidence and canonical reconciliation; no retry to obtain attribution.
Browser claim_ig_next_actions validates the run surface and limits MBS to reactive replies; native Instagram gets the proactive/public-comment lanes. Non-browser senders retain their independent policies.
Finish only your own run with finish_ig_browser_shift, saving full cursor, exact receipts and continuation. Finalization preserves the other surface's owner. No global lock is needed to prevent duplicate replies: global exact recipient/source/action claims do that work.
Pricing guidance and all other scope/consent/manual protections remain unchanged.

