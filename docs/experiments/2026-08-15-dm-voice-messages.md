# DM voice messages v1

- Launch date: 2026-08-15
- Variant name: `dm_voice_messages_v1`
- Hypothesis: Letting members send a voice note from the existing DM composer will make detailed check-ins easier and increase useful member-to-coach communication.
- Primary KPI: successfully sent voice messages per member who starts a recording.
- Diagnostic metrics: recording starts, cancellations, recording or upload failures, sent duration, and uploaded byte size.
- Guardrail: no duplicate messages, no send after cancel or closing the DM, five-minute and 12 MB limits, authenticated uploads only, and text/photo DMs remain unchanged.
- Decision date: 2026-09-12
- Decision rule: keep the feature if most recording starts result in a successful send and there is no material delivery, permission, mobile-layout, or coach-review regression. Rework the recorder or upload path if failures exceed 10% of recording starts.

The dashboard emits `dm_voice_record_started`, `dm_voice_record_cancelled`, `dm_voice_record_failed`, and `dm_voice_message_sent` into the first-party event stream under `page_variant=dm_voice_messages_v1`.
