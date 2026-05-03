/**
 * Evening Pulse - ~19:00 AEST (09:00 UTC)
 *
 * Safety-net only. Keeps overdue in-app DMs and PB/win backup alerts,
 * removes inactive-client, challenge, comeback, and dropoff nudges.
 */

const { runPulse } = require('./_lib/pulse-runner');

exports.handler = async () => {
    return runPulse({
        label: 'pulse-evening',
        pulseOrigin: 'evening',
        cohortSignals: [
            'unread_message',
            'win_to_celebrate',
            'level_up',
        ],
        perClientSignals: [],
    });
};
