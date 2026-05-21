# Meta Human Agent Review Pack

Use this when submitting the `Human Agent` permission in Meta App Review.

## Permission

Request `Human Agent` from:

`Meta App Dashboard -> App Review -> Permissions & Features -> Human Agent`

Meta's stated use case is human support after the normal 24-hour messaging window, up to 7 days after the person's last message. Automated messages and unrelated/promotional messages are not allowed for this tag.

## Balance Use Case

Balance uses Instagram/Messenger DMs for coaching support and lead conversations. Sometimes Shannon needs to respond personally after the standard 24-hour window, for example when:

- a client asks a coaching/support question and Shannon replies the next day;
- a lead asks a genuine question and Shannon follows up manually;
- the message needs a human review because context, media, voice notes, or safety checks are involved.

Balance does not use the Human Agent permission for promotional broadcasts, cold outreach, auto-send, or scheduled automation.

## Implementation Summary

- The admin dashboard labels 24-hour-to-7-day drafts as `7-day manual`.
- Auto-send is hidden for Human Agent drafts.
- Send Later is hidden for Human Agent drafts.
- The AI recommended timing button is hidden for Human Agent drafts.
- If Human Agent approval is still pending, the draft can only be copied and marked manually sent.
- If Human Agent approval is granted, the only API send path is Shannon clicking `Send` in the admin DM card.
- Server-side guards reject `auto_send`, `send_later`, and `scheduled_worker` sources in the Human Agent window.
- The production feature flag remains off until approval:

```text
INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED=false
```

After Meta approval, enable:

```text
INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED=true
```

## Screenshot Checklist

Capture these screenshots for App Review:

- Admin dashboard DM inbox showing a 24-hour-to-7-day draft with the `7-day manual` strip.
- The same DM card showing `Send` and `Edit`, with no `Auto-send`, `Later`, or delayed timing button.
- Pending/unapproved state showing `Copy`, `Manual sent`, and `Open IG`.
- Auto DMs area showing this Human Agent draft is not queued there.
- Privacy Policy showing operator details: `Shannon Rhys Birch, ABN 90 855 738 343`.
- Terms/Refund page with the same operator identity.

## Suggested Review Notes

Balance requests Human Agent so Shannon Birch can personally answer user-initiated Instagram/Messenger conversations after 24 hours and within 7 days. The admin dashboard requires a human click for these sends. Automated sending, Send Later, and Auto-send are disabled for Human Agent drafts, and the backend rejects automated/scheduled sources in this window.

The app uses the tag only for direct replies to the user's existing inquiry, not for broadcasts, marketing campaigns, or unrelated promotional messages.
