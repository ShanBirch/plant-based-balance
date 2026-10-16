import { recoverRequestedBookingNotifications } from "./balance-booking.mts";

export default async function bookingNotificationRecovery(): Promise<void> {
    const outcomes = await recoverRequestedBookingNotifications();
    if (outcomes.length) console.log("[booking-notification-recovery]", JSON.stringify(outcomes));
}

export const config = { schedule: "* * * * *" };
