# Automatic troubleshooting replay

Open `admin-session-replays.html` from **Balance Admin → Session replays**. Sign in as the existing Shannon administrator, search a member, select a session, then play, scrub or jump to an error marker. Search also accepts a member UUID. Refresh to see new uploads. These are masked DOM reconstructions of the signed-in dashboard, not screen videos.

## Capture and privacy

- `pbb-session-replay.js` starts automatically when the authenticated identity matches `currentUser`. Guest mode and admin impersonation are excluded. Capture stops in the background, at sign-out and on identity changes.
- Record with pinned, locally served rrweb **2.1.4**. Source: the `rrweb` 2.1.4 npm tarball (`dist/rrweb.umd.min.cjs`, `dist/style.min.css`); MIT license included beside the vendor assets. There is no external replay vendor/account.
- Mask text and block form fields, editable areas, images, SVG, audio, video, canvas, iframes and embedded content at capture. Only the exact navigation labels in `pbb-replay-privacy.js` are retained. A second pass strips arbitrary attributes, URLs and script content. The same pass runs before playback. Error markers contain timestamps, not messages/stacks. Existing app telemetry carries `replay_session_id` for correlation.
- No console/network payload recording, microphone/camera recording, or native/other-app screen capture. Supported WebViews need `CompressionStream` and `crypto.randomUUID`; unsupported browsers skip capture without affecting the app.
- The Settings control disables capture for that account on that device, including other open tabs through the storage event. Turning it off discards pending data; it does not retract already uploaded or in-flight data. Settings, both discovery arrays and the privacy policy explain the behavior.

## Storage and limits

`app_replay_chunks` stores gzip/base64 batches, keyed by `(user_id, session_id, seq)`. Upload roughly every 15 seconds and when an error/background event occurs. Successful batches are removed from memory; failures retain the same sequence for retry. A five-minute boundary starts a new independently playable session once the previous queue drains. An abrupt process kill can lose the latest unsent seconds. Offline capture is bounded in memory, not persisted to disk.

- Maximum raw event batch: 4 MB; queued raw events: 6 MB; encoded batch: 750 KB.
- Server-side serialized per-member rolling 24-hour cap: 12 MB or 600 chunks. Oversized or capped capture backs off; it must never block the app. Long/heavy use or unsupported surfaces may therefore have gaps.
- RLS permits only own authenticated append and the established administrator's read. Members cannot retrieve replay data, overwrite chunks or delete them. Admin retrieval uses the current authenticated client; no service credentials reach browsers.
- Rows become unreadable after seven days. `balance-replay-retention` removes expired rows hourly at minute 17. Account deletion cascades through the auth user foreign key. Standard infrastructure backup retention still applies.
- For a requested replay deletion, a trusted operator may delete from this table by the verified `user_id`. Do not broaden client delete grants.

The library is lazy loaded after signed-in app state exists. Failures are isolated from normal app use. Admin playback does not run app scripts and strips source URLs; the viewer additionally has a restrictive CSP and no image/font/media network loading. It never provides a public recording URL.

## Verification

`node --test tests/session-replay.test.js` covers sanitization, automatic authenticated capture, error markers, logout/account switching, opt-out, background/resume and failed-upload continuity. Browser QA used the real recorder and player with a synthetic auth/data transport, checked uploaded gzip for planted secret strings, and reviewed mobile portrait/landscape, light/dark, zero/nonzero safe-area fallback, and Settings link reachability. A full dashboard snapshot was approximately 2.20 MB raw / 261 KB gzip on desktop Chromium.

Production database transaction tests verified own append, admin retrieval, denied member list/read, denied cross-user append, denied client deletion and denied anonymous access; test rows were rolled back. Physical iOS/Android device recording still requires a member session from that device to verify device-specific behavior.
## Onboarding replay timeline (19 September 2026)

Signed-in setup and guided tours now start replay on their first progress event rather than waiting for the periodic check. The existing account preference, ownership checks, masking, upload limits and seven-day retention still apply. Signed-out signup/password entry remains outside replay.

Onboarding events attach the current replay session ID to first-party progress records. Balance Admin's onboarding report shows each recent person's last recorded step and a direct Watch replay link. The replay player adds seekable setup/tour/payment markers, taps outside the spotlight, background/return and page-exit markers. Outside-highlight taps are observations, not diagnoses of a broken or abandoned tour. Native/other apps remain unrecorded; a background marker says only that Balance became hidden.

Only enumerated phases/statuses/actions, step numbers and fixed setup question keys enter replay metadata. Answers, arbitrary titles, attributes, URLs and media remain excluded. Onboarding markers do not increase error counts. A replay startup failure or timeout still delivers the ordinary funnel event.

Verification for this extension: real rrweb capture → gzip upload transport fixture → actual admin player, including timeline seeking, outside-highlight taps, hidden/return, secret-value masking and linked progress; player opening/scroll/reopen at 320×568, 390×844 and 844×390, light/dark, zero and nonzero safe areas. Report links and contrast checked in small portrait and landscape. No real customer data or purchases were created for these browser checks. Existing production replay ingestion was verified read-only.
