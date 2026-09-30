# Conversation-led coaching calls

Shannon's direction, 30 September 2026: the model reads the complete exchange,
answers the actual latest turn and chooses a useful next question. Goals and
difficulties provide context; they are not required stage fields.

For unconverted Balance coaching enquiries, organic source and paid source can
share the objective of a consented call. The source remains true attribution.
A new follower asking to try online coaching is a lead without an ad referral.
A compliment or follow alone does not establish coaching interest.

Offer a call naturally when it helps the person understand fit or get to know
Shannon. Do not require a separate blocker answer or a minimum reply count.
Answer actual explanation requests directly instead of asking whether they
want an explanation. Choose ongoing online coaching, live Zoom training or
Summer Ready Shred from the person's needs; do not force a challenge on a
longer-term coaching enquiry. Shannon delivers his coaching from home.

Trust-first coaching interest can warrant an optional call with no commitment
to sign up. Explicit thinking time, no calls, a decline or a request to keep
chatting wins. Never repeat an unanswered call invitation. After call acceptance
or an explicit booking request, use the existing booking card without another
link-permission question. Agreement with a goal or generic enthusiasm is not
booking consent. A sent card is not a verified appointment.

## Implementation and validation

- Shared writer/reviewer/repair policy:
  `netlify/functions/_lib/coaching-conversation-policy.js`.
- The current enquiry writer assembles voice, facts, complete timeline, all
  unanswered messages and media evidence without the legacy course-sales prompt
  or qualifier's proposed question.
- Campaign facts and historic explicit Learn/preview/checkout promises remain
  separate. Campaign transport metadata stays compatible with queued v3 alerts.
- Consent recognition accepts natural call invitations, retaining refusal,
  social-call and already-sent-card checks.
- Regression scenarios cover organic coaching, trust-first discussion, absent
  blocker fields, call consent, refusals, generic enthusiasm, writer assembly,
  independent reviewer assembly and existing protected-contact/service gates.
- Assembly checks mock model transport; they prove which instructions and
  evidence reach the writer/reviewer, not guaranteed wording from a live model.
  No evaluation sends test DMs or re-enables a manual thread.

Safety, authenticity, linked clients, verified purchases, manual takeover,
essential unresolved media, controller claims, stale-thread protection and
canonical delivery readback keep their existing authority.
