/**
 * Lunch Pulse - ~12:30 AEST (02:30 UTC)
 *
 * DM safety-net only. Real-time DM notifications still fire immediately;
 * this catches in-app DMs that have been waiting without a coach reply.
 */

const { runPulse } = require('./_lib/pulse-runner');

exports.handler = async () => {
    return runPulse({
        label: 'pulse-lunch',
        pulseOrigin: 'lunch',
        cohortSignals: [
            'unread_message',
        ],
        perClientSignals: [],
    });
};
