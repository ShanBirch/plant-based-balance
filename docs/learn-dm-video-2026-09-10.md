# Balance Learn DM video — 10 September 2026

The ad message flow must send the dedicated **price-ending DM video**. The old `balance-foundations-course-first-v8.mp4` file is an Instagram-post edit with a “message BALANCE” CTA and must not be sent to Learn ad leads.

Approved delivery files:

- `assets/balance-learn-dm-149-v9.mp4`: AUD $149 for the full six weeks, used through 20 October 2026 Brisbane time.
- `assets/balance-learn-dm-450-v9.mp4`: AUD $450 for the full six weeks, used from midnight 21 October 2026 Brisbane time.

Launch is 21 September. The introductory window lasts one month after launch; the $450 change is in October. Upfront checkout and public offer copy follow the same dates. Weekly membership pricing is unchanged.

Both videos use the cream-and-gold DM ending, Balance Learn branding, larger lesson names and Actions bullet lists. Weekly Goals show three strength sessions, tracking protein on four days, and Feed posting on five days, with matching progress bars.

`resolveBalanceFoundationsAppProofVideoUrl` owns the date-based selection. The sender resolves known old attachments again at send time, so queued social-cut or expired-price drafts use the current DM file. The operator prompt in `scripts/ig-codex-live-worker.mjs` documents the same rule. Preserve the existing media-introduction and no-double-send checks.

Editable project: `C:/Users/shann/Documents/Codex/2026-09-10/when-someone-sends-us-a-message/work/balance-learn-video`. The $450 ending is in the sibling `balance-learn-standard-ending` project. HyperFrames 0.8.33; 1080 × 1920, 30 fps, 114.3 seconds. Delivery files are H.264/AAC and below 20 MB.
