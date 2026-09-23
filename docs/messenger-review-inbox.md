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
must use a permitted real Facebook test account and its own scoped conversation.
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

## Validation

`node --test scripts/test-messenger-review.cjs` tests grant isolation, expiry,
cross-site/client-ID rejection, linked-client exclusion, stale/window guards,
sender delegation and partial/unconfirmed delivery. Local UI fixtures are clearly
labelled and never used as review evidence. Check small portrait/landscape,
light/dark, zero/nonzero safe-area values, scroll and lock/reopen.
