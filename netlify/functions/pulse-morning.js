/**
 * Morning Pulse - ~05:30 AEST (19:30 UTC)
 *
 * Kept intentionally quiet. Shannon only wants notifications for DMs,
 * scheduled check-ins, onboarding milestones, and PB/win celebrations.
 */

const { runPulse } = require('./_lib/pulse-runner');

exports.handler = async () => {
    return runPulse({
        label: 'pulse-morning',
        pulseOrigin: 'morning',
        cohortSignals: [],
        perClientSignals: [],
    });
};
