# Voice feedback playback

The client inbox records playback of received `[AUDIO:...]` nudges. It never records opening, loading metadata, or the sender previewing their own note as playback. The Quick Message client conversation shows the newest 50 voice notes, read receipts and separate playback receipts.

- `started_at` is the first `playing` event, not an attempted play or read receipt.
- Progress is the union of contiguous media-time intervals actually played. Replaying a section does not inflate progress; seeking over a section does not count it.
- Completion requires `ended` plus at least 95% unique coverage. Subsequent plays cannot remove completion or lower progress. Playback confirms player activity, not human attention, audible volume, or comprehension.
- Receipts are keyed to the exact nudge and audio URL. Replacing the URL begins a new receipt. Existing notes have no historical playback inference and record their future plays.
- Progress flushes about every ten seconds and on pause, buffering, end, close, visibility change and reload. Interrupted connections retry while that player remains mounted. Abrupt app termination/offline closure may lose unflushed intervals. There is no cross-device automatic playback-position restoration.
- The coach summary refreshes when the conversation is reopened. It does not send messages or alter read status.

The authenticated recipient alone can write through `record_voice_feedback_playback`. Definer internals reside outside the exposed API schema and validate the live recipient, message, URL and duration. Direct client writes are revoked. Participants can read their receipts; the summary RPC also permits existing `admin_users` to review clients. Anonymous access and unrelated-client access are denied.

Validation: `node tests/voice-feedback-playback.test.js`; real HTML audio start/progress/end browser payloads; production SQL transaction tests for merging, replay, seeking, completion, resume, mismatched audio, unrelated recipient, direct-write denial, anonymous denial and summary isolation, all rolled back. Phone layout proof uses the actual admin styles, markup and conversation renderer with fixtures, in 360x640 and 640x360, light/dark, 59px and zero top insets, opening, scrolling and reopening.
