# Balance call booking setup

The public page is `/book`. Shannon controls call windows and whether the page is live at `/booking-settings.html`, or from Conversion Operator through **Booking setup**.

## One-time Google Calendar connection

1. In Google Cloud Console, create an OAuth 2.0 Web application.
2. Add this authorised redirect URI:

   `https://balanceneurosciencefitness.com/api/booking/google/callback`

   If the booking page is served from another domain, use that exact domain in both the redirect URI and `BALANCE_BOOKING_PUBLIC_ORIGIN`.
3. Add these environment variables in Netlify. Do not put them in the repo:

   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `BALANCE_BOOKING_PUBLIC_ORIGIN=https://balanceneurosciencefitness.com`
   - `BALANCE_BOOKING_URL=https://balanceneurosciencefitness.com/book`
4. Deploy, sign into Balance admin, then open **Conversion Operator → Booking setup → Connect Google**.
5. Choose the Google account and grant Calendar access. Balance stores the refresh token in the existing server-only `app_private_secrets` table. The public page never receives it.
6. Set weekly call windows, check the public preview, then turn on **Open call bookings**.

Once linked, busy Calendar windows are excluded from the page and each confirmed booking creates a Google Calendar event with the lead as an attendee. The lead chooses phone, video, or WhatsApp while booking. Video bookings request a Google Meet link for the calendar event; phone and WhatsApp bookings use the number the lead enters.

## Branded confirmation email

Google sends the calendar invitation after a booking. To also send the Balance-styled email, set these Netlify environment variables:

- `RESEND_API_KEY`
- `BOOKING_EMAIL_FROM`, using a sender verified in Resend, for example `Balance <shannon@plantbased-balance.org>`.

The booking still works if Resend is not configured. The setup page shows whether the branded email sender is ready.

The website and verified email sender are separate. Keep the existing verified email address unless a replacement sending domain is verified. On 16 October the controlled test recorded a booking without an email because `BOOKING_EMAIL_FROM` was missing, not because the recipient was Shannon's own address. The production sender setting has been added; verify acceptance/delivery on the next authorised confirmation without creating a duplicate appointment.

## Coach notifications

Set `BOOKING_NOTIFY_EMAIL` to Shannon's confirmed notification inbox. Each booking attempts one separate immediate coach email with contact details, Brisbane time and the Meet link, using a booking-specific idempotency key. `coachNotificationSent` reports provider acceptance only; failures are surfaced as `coach_notification_pending` without losing or recreating the booking. Successful acceptance is saved in booking metadata. New Calendar events have explicit pop-up reminders two hours and ten minutes before the call. Actual phone push still depends on Google Calendar notifications being enabled on Shannon's device.

The scheduled `booking-notification-recovery` function only processes an explicitly reconciled, unexpired server-side `metadata.notification_recovery` request on a confirmed future booking. An operator may request recovery with `state:requested`, `deliveryReconciled:true` and `expiresAt` within 24 hours after checking existing booking/provider receipts. Existing successful emails are skipped; missing emails use stable booking-specific idempotency keys. The claim is conditional on the row version, so parallel invocations cannot both send. Completed, failed, processing or uncertain requests are not automatically retried. This does not recreate the appointment or scan/send old unrequested confirmations. Verify provider delivery separately from acceptance.

## Guardrails

- Bookings are off by default until Shannon opens them in the setup page.
- All public slots are displayed and stored in `Australia/Brisbane` time.
- The API reads Google free/busy time before showing slots and checks it again during booking.
- A database partial unique index prevents two confirmed bookings taking the same Balance slot.
- Booking data is private behind RLS. The public page only calls the dedicated Netlify function.
- The DM manager only shares the booking link after a lead directly asks for or accepts a call. The booking page handles their preferred call format.
