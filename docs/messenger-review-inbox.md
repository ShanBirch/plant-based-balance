# Restricted Messenger review inbox

Added 23 September 2026 for the pages_messaging recording and review preparation.

URL: https://plantbased-balance.org/messenger-review.html

The page has no customer list, admin login, browser Supabase connection, analytics,
or persistent credential storage. A high-entropy bearer code authorizes one exact
unlinked Messenger test thread, Page and Page-scoped participant. The server reads
only messages from the configured review-session start time. Sending delegates to
the existing guarded Messenger sender after checking the latest inbound, draft
revision and standard 24-hour window. Only a complete Messenger delivery receipt
is shown as success. Locking/navigation clears the browser's in-memory access.

## Provisioning

Use a cryptographically random 32-byte hex code. Store only its SHA-256 hash in the
key `messenger_review_<hash>` of the existing RLS-protected `app_private_secrets`
table. The value is JSON with `enabled`, `thread_id`, `page_id`, `psid`, `since`,
and `expires_at`. Use a short operator expiry; create a separate scoped grant for
reviewers when their participant identity and review duration are known. Never
commit access codes, put them in a URL, or distribute production admin access.
Set enabled=false or expire the grant to revoke access. Missing/invalid grants
fail closed. No new database schema or anonymous policies are required.

The current controlled conversation belongs to the existing app-role participant.
It is suitable for Shannon's recording. It does NOT give a Meta reviewer a Facebook
login or let them impersonate that participant. Independent reviewer reproduction
must use the reviewer's own permitted Messenger identity and scoped conversation.
Do not claim that public users or Facebook ad referrals have been approved/tested.

## Recording checklist

Shannon operates the recorder. Do a 10-second preflight and play it back to confirm
that visible browser switches are actually captured. Hide unrelated conversations,
notifications, passwords, access codes and tokens. Use only the controlled test.

1. Show Balance's Page connection/settings, Page name and ID, and relevant granted
   permissions. If Meta requires the OAuth flow, capture the existing connection
   authorization without revoking the working Page or adding unrelated scopes.
2. In the real participant's Facebook Messenger, send a new ordinary question to
   Balance APP, such as "Can you explain what Balance Learn includes?"
3. Open the restricted inbox, already unlocked before recording. Refresh until
   the same incoming message and its genuine generated draft appear.
4. Review/edit the draft and use Send reviewed reply. Show the reply arriving in
   the real Messenger conversation, including any preview button actually sent.
5. Ask a follow-up, refresh/review/send again, and show the follow-up arriving.
6. Stop and inspect the MP4. It must show the real round trip, not just typing or
   a draft. No screenshot montage, mock messages or unrelated customer inboxes.

Recording evidence, reviewer access, allowed-usage declarations and final submission
are separate steps. The inbox deployment alone does not submit or approve App Review.

## Reviewer self-pairing (23 September 2026)

Meta's general submission guide (updated 30 June 2026) says its reviewers use their
own test accounts and says not to supply personal Meta login credentials. The live
pages_messaging form separately instructs a real Facebook account with the Tester
role, rather than an App Roles generated Test User. This specific requirement has
not been waived or conclusively reconciled. Pairing cannot override Meta's gates.

An invitation is stored under the same SHA-256 key convention with
`{kind:"invitation", enabled:true, page_id, expires_at}`. It can remain valid for
Meta's required duration (the form currently specifies one year). Distribute it
only in Meta's private reviewer-access field after authorization. It cannot read
or send messages itself. Opening it creates a fresh random session and independent
128-bit pairing phrase. Maximum 20 sessions per UTC day, allocated atomically.
Sessions last at most two hours and must pair within 30 minutes. Parent revocation
and expiry invalidate child sessions on access.

The reviewer sends the exact phrase from their own Messenger account. Only an
private receipt written by the signature-verified Facebook webhook can pair the session.
Pairing rejects linked clients, wrong Pages, mismatched identities, old/future events,
echoes and other sources. It binds the exact Page, PSID and thread on the server
using compare-and-swap; the browser cannot choose an identity. Reading starts after
the pairing message. Pairing phrases do not enter the sales draft pipeline. Every
later send retains identity, draft revision, 24-hour, duplicate and receipt guards.
The first signed pairing receipt is immutable; arbitrary message-table inserts cannot prove identity. Lock/navigation clears the session from browser memory.

Reviewer steps: enter the invitation, copy the phrase, open Balance APP in
Messenger, send the phrase yourself, return and Check connection, send a normal
question in Messenger, Refresh conversation, review and send its draft, and verify
the reply in Messenger. Repeat with a request for program details. A missing webhook
while pairing is a Meta access issue, not proof of successful independent review.

Sources:
- https://developers.facebook.com/documentation/resp-plat-initiatives/individual-processes/app-review/submission-guide
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/app-review

## Validation

`node --test scripts/test-messenger-review.cjs` tests grant isolation, expiry,
cross-site/client-ID rejection, linked-client exclusion, stale/window guards,
sender delegation and partial/unconfirmed delivery. Local UI fixtures are clearly
labelled and never used as review evidence. Check small portrait/landscape,
light/dark, zero/nonzero safe-area values, scroll and lock/reopen.

