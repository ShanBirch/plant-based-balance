# Saturday training registration

Public campaign link: https://plantbased-balance.org/saturday-training.html

One free session, Saturday 10 October 2026, 9–10 a.m. Brisbane. Eight confirmed spots, followed by a reserve list. No pricing or recurring offer.

The eight blocks show available/taken places without displaying identities. The session row is locked during registration, so competing bookings cannot exceed capacity. A visitor must explicitly choose reserve registration once the class is full; a race for the final spot does not silently turn a booking into a reserve. Email uniqueness prevents repeated registration, and a browser-held receipt token makes retries safe.

Private records: `balance_group_sessions`, `balance_group_registrations`. Both have RLS enabled and no browser grants. The registration RPC is SECURITY INVOKER and callable only by the server service role. Public availability contains counts only. Receipt URLs use an unguessable UUID and show only status/joining details.

Confirmation and Shannon notification emails use the existing `RESEND_API_KEY` and `BOOKING_EMAIL_FROM`. If email fails, the saved booking remains valid and the page asks the visitor to save their receipt. Reserve entries never get the joining link. Cancellations and offering a released spot to the oldest reserve are handled by Shannon; no automatic reserve promotion is promised.

This is a single external invitation page, not a new member app feature or app-wide announcement. It does not alter the existing one-to-one `/book` flow. The earlier Google Form is an unused draft superseded by this page.

Validation: API unit tests and a rolled-back database fixture test for eight-place capacity, ninth-place rejection, reserves, duplicate emails, idempotent retry and private access. Production smoke check plus mobile layout proof are required before sharing.
