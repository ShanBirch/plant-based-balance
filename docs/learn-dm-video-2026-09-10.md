# Balance Learn DM video — 10 September 2026

The ad message flow must send the dedicated **price-ending DM video**. The old `balance-foundations-course-first-v8.mp4` file is an Instagram-post edit with a “message BALANCE” CTA and must not be sent to Learn ad leads.

Approved delivery files:

- `assets/balance-learn-dm-149-v11.mp4`: AUD $149 for the full six weeks, used through 20 October 2026 Brisbane time.
- `assets/balance-learn-dm-450-v11.mp4`: AUD $450 for the full six weeks, used from midnight 21 October 2026 Brisbane time.

Launch is 21 September. The introductory window lasts one month after launch; the $450 change is in October. Upfront checkout and public offer copy follow the same dates. Weekly membership pricing is unchanged.

Both videos use the cream-and-gold DM ending, Balance Learn branding, larger lesson names and Actions bullet lists. Weekly Goals show three strength sessions, tracking protein on four days, and Feed posting on five days, with matching progress bars.

`resolveBalanceFoundationsAppProofVideoUrl` owns the date-based selection. The sender resolves known old attachments again at send time, so queued social-cut or expired-price drafts use the current DM file. The operator prompt in `scripts/ig-codex-live-worker.mjs` documents the same rule. Preserve the existing media-introduction and no-double-send checks.

Editable project: `C:/Users/shann/Documents/Codex/2026-09-10/when-someone-sends-us-a-message/work/balance-learn-video`. The $450 ending is in the sibling `balance-learn-standard-ending` project. HyperFrames 0.8.33; 1080 × 1920, 30 fps, 114.3 seconds. Delivery files are H.264/AAC and below 20 MB.

## v10 discount and sound revision

The launch ending shows standard AUD $450 crossed out, AUD $149 launch price and $301 saving. Reuses the same music; louder short effects and 27 additional synchronized cues include quiz selection at 57.52s, correct-answer confirmation at 58.78s, goal selections and Save goals. Standard-price ending remains undiscounted. All queued v9 links normalize to v10 at send time.

## v11 music balance

Music gain and every point in both music volume envelopes are 80% of v10 (20% quieter). Effects, voice, visuals and timing are unchanged. Both date-based delivery versions use this mix; queued v9/v10 attachments resolve to v11.
