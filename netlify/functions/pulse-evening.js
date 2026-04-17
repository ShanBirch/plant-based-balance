/**
 * Evening Pulse — ~19:00 AEST (09:00 UTC)
 *
 * "Reflect + reset" signal set. Focus: who disappeared today, who's stalling
 * in a challenge, who's not in any challenge at all, and a safety-net sweep
 * for wins that didn't catch the real-time celebration trigger earlier in
 * the day (PBs, streaks, level-ups, comebacks).
 *
 * Unread_message also fires here — a DM sitting >4h from this morning should
 * absolutely get caught by end of day.
 */

const { runPulse } = require('./_lib/pulse-runner');

exports.handler = async () => {
    return runPulse({
        label: 'pulse-evening',
        pulseOrigin: 'evening',
        cohortSignals: [
            'unread_message',
            'inactive_client',
            'challenge_dropout',
            'not_in_challenge',
            'workout_dropoff',
            'win_to_celebrate', // PB/streak backup — real-time pb-celebration-draft usually beats this
            'level_up',
            'comeback',
        ],
        perClientSignals: [],
    });
};
