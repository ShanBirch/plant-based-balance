/**
 * Morning Pulse — ~05:30 AEST (19:30 UTC)
 *
 * "Plan the day" signal set. Focus: what should Shannon notice before the
 * client opens the app? Missed sessions, streak status, banter on shared
 * challenges, cycle awareness, mood trends, momentum recognition.
 *
 * Real-time events (incoming DMs, PBs, first workouts) are NOT in this
 * pulse — they fire immediately via their own triggers and never wait.
 */

const { runPulse } = require('./_lib/pulse-runner');

exports.handler = async () => {
    return runPulse({
        label: 'pulse-morning',
        pulseOrigin: 'morning',
        // Cohort-level scans that look across all clients
        cohortSignals: [
            'mood_low',      // owns the mood signal (lunch/evening don't duplicate it)
            'new_user_idle', // early-morning catch before the day gets away
        ],
        // Per-client scans — loop in-scope clients. These rely on personal_details
        // (workout calendar, cycle sync) and recent-activity snapshots.
        perClientSignals: [
            'missed_scheduled_workout',
            'streak_break',
            'challenge_banter',
            'cycle_checkin',
            'momentum',
        ],
    });
};
