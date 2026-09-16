# Balance Learn DM video — 10 September 2026

The ad message flow must send the dedicated **price-ending DM video**. The old `balance-foundations-course-first-v8.mp4` file is an Instagram-post edit with a “message BALANCE” CTA and must not be sent to Learn ad leads.

Approved delivery files:

- `assets/balance-learn-dm-149-v14-energy-context.mp4`: AUD $149 for the full six weeks, used through 20 October 2026 Brisbane time.
- `assets/balance-learn-dm-450-v14-energy-context.mp4`: AUD $450 for the full six weeks, used from midnight 21 October 2026 Brisbane time.

Launch is 21 September. The introductory window lasts one month after launch; the $450 change is in October. Upfront checkout and public offer copy follow the same dates. Weekly membership pricing is unchanged.

Both videos use the cream-and-gold DM ending, Balance Learn branding, larger lesson names and Actions bullet lists. Weekly Goals show three strength sessions, tracking protein on four days, and Feed posting on five days, with matching progress bars.

`resolveBalanceFoundationsAppProofVideoUrl` owns the date-based selection. The sender resolves known old attachments again at send time, so queued social-cut or expired-price drafts use the current DM file. The operator prompt in `scripts/ig-codex-live-worker.mjs` documents the same rule. Preserve the existing media-introduction and no-double-send checks.

Current editable project: `C:/Users/shann/Documents/Codex/2026-09-16/with-the-video-that-we-sent/work/dm-course`. HyperFrames 0.8.38; 1080 × 1920 master, 720 × 1280 delivery, 30 fps, 223.4 seconds. Both H.264/AAC delivery files stay below 20 MB. Earlier revisions below are historical.

## v10 discount and sound revision

The launch ending shows standard AUD $450 crossed out, AUD $149 launch price and $301 saving. Reuses the same music; louder short effects and 27 additional synchronized cues include quiz selection at 57.52s, correct-answer confirmation at 58.78s, goal selections and Save goals. Standard-price ending remains undiscounted. All queued v9 links normalize to v10 at send time.

## v11 music balance

Music gain and every point in both music volume envelopes are 80% of v10 (20% quieter). Effects, voice, visuals and timing are unchanged. Both date-based delivery versions use this mix; queued v9/v10 attachments resolve to v11.


## Final polished-cards edit - 16 September delivery update

Shannon selected the final edit completed on 15 September: `Balance-Learn-DM-Polished-Cards.mp4` (223.4 seconds). Source: `C:/Users/shann/Documents/Codex/2026-09-14/can-you-find-the-raw-edit/outputs/Balance-Learn-DM-Polished-Cards.mp4`. Editable composition: the same task's `work/dm-course/index.html`. Drive archive: https://drive.google.com/file/d/1GchKn1xpYvK1frXCGJCUhyx7sjJZ0t6f/view.

The v13 delivery copy retains all content and timing, including real community examples, the ten polished lesson cards, the check-in ending and the $149 six-week offer. It is encoded at 720 x 1280, H.264/AAC with MP4 faststart for native DM delivery. This supersedes the historical 114.3-second launch edit described above.

The canonical selector and operator prompt use v13 immediately. Queued v11 launch URLs are recognized, upgraded at send time and stripped from message text. Existing introduction and prior-video guards remain active. Because this final edit shows $149, the existing approved $450 v11 fallback still takes over on 21 October Brisbane time; v13 is not valid for that later price. No lead messages are sent as part of deployment verification.

## 16 September: v14 connected energy lesson

Supersedes the v13 launch file and v11 standard-price fallback above. Both v14 editions retain the 223.4-second polished-cards sequence, with the correct $149 or $450 ending. Learn explains body signals, context and past experience; the quiz tests whether sleepiness must persist from bed to gym; the illustrative reflection describes entering a workout space and observing alertness after starting gently. The separate weekly check-in keeps its existing questions and shows an illustrative report on trying the gym experiment. No reflection or lead message is submitted in verification.

Editable project: C:/Users/shann/Documents/Codex/2026-09-16/with-the-video-that-we-sent/work/dm-course/index.html. Copy and evidence: ENERGY-REVISION.md alongside it. Deliverables: the task outputs folder. Both former current URLs remain recognized for send-time upgrading and text stripping. Video-history recognition includes v14 to preserve no-double-send behavior.

Experiment: energy_context_v14. Hypothesis: one connected science/quiz/application example improves understanding and movement from video to app preview. Primary KPI: verified video recipients reaching app preview; diagnostics: clarification replies and checkout starts; guardrail: duplicate video sends and unsupported promises. Decision date: 23 September 2026, compare with v13 subject to available recipient attribution and sample size.

Reusable production rule: keep the science card, quiz feedback and application form on one concept. Present information first, then use a personal example to test and apply it. Describe environmental influence as possible, not guaranteed or a substitute for physiological needs.
