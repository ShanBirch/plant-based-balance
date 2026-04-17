/**
 * Lunch Pulse — ~12:30 AEST (02:30 UTC)
 *
 * "Mid-day engagement" signal set. Focus: who's slipping off the tracking
 * rhythm, who still owes a check-in, who's carrying poor recovery into the
 * afternoon, and who sent a DM this morning that's been sitting unread.
 * This is the tightest window on message-latency — unread_message fires here
 * as a safety net for DMs the real-time push missed.
 */

const { runPulse } = require('./_lib/pulse-runner');

exports.handler = async () => {
    return runPulse({
        label: 'pulse-lunch',
        pulseOrigin: 'lunch',
        cohortSignals: [
            'unread_message',
            'checkin_due',
            'nutrition_gap',
            'meal_dropoff',
            'wearable_low',
        ],
        perClientSignals: [
            'quiet_client', // no DM 5d + no workout 3d
        ],
    });
};
