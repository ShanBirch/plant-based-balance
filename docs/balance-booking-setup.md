# Balance call booking setup

The public page is `/book`. Shannon controls call windows and whether the page is live at `/booking-settings.html`, or from Conversion Operator through **Booking setup**.

## One-time Google Calendar connection

1. In Google Cloud Console, create an OAuth 2.0 Web application.
2. Add this authorised redirect URI:

   `https://future-balance.netlify.app/api/booking/google/callback`

   If the booking page is served from another domain, use that exact domain in both the redirect URI and `BALANCE_BOOKING_PUBLIC_ORIGIN`.
3. Add these environment variables in Netlify. Do not put them in the repo:

   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `BALANCE_BOOKING_PUBLIC_ORIGIN=https://future-balance.netlify.app`
   - `BALANCE_BOOKING_URL=https://future-balance.netlify.app/book`
4. Deploy, sign into Balance admin, then open **Conversion Operator → Booking setup → Connect Google**.
5. Choose the Google account and grant Calendar access. Balance stores the refresh token in the existing server-only `app_private_secrets` table. The public page never receives it.
6. Set weekly call windows, check the public preview, then turn on **Open call bookings**.

Once linked, busy Calendar windows are excluded from the page and each confirmed booking creates a Google Calendar event with the lead as an attendee.

## Branded confirmation email

Google sends the calendar invitation after a booking. To also send the Balance-styled email, set these Netlify environment variables:

- `RESEND_API_KEY`
- `BOOKING_EMAIL_FROM`, using a sender verified in Resend, for example `Balance <shannon@plantbased-balance.org>`.

The booking still works if Resend is not configured. The setup page shows whether the branded email sender is ready.

## Guardrails

- Bookings are off by default until Shannon opens them in the setup page.
- All public slots are displayed and stored in `Australia/Brisbane` time.
- The API reads Google free/busy time before showing slots and checks it again during booking.
- A database partial unique index prevents two confirmed bookings taking the same Balance slot.
- Booking data is private behind RLS. The public page only calls the dedicated Netlify function.
