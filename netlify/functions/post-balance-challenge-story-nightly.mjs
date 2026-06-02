import publisher from './_lib/ig-story-publisher.js';

const {
    defaultBalanceChallengeStoryUrl,
    publishBalanceChallengeStory,
} = publisher;

export default async (req) => {
    let nextRun = null;
    try {
        const body = await req.json();
        nextRun = body?.next_run || null;
    } catch {
        // Netlify scheduled invocations may not need the body for this job.
    }

    try {
        const result = await publishBalanceChallengeStory({
            source: 'nightly_7pm_brisbane',
            videoUrl: defaultBalanceChallengeStoryUrl(),
        });
        console.log('[post-balance-challenge-story-nightly] published', {
            mediaId: result.mediaId,
            creationId: result.creationId,
            nextRun,
        });
    } catch (error) {
        console.error('[post-balance-challenge-story-nightly] failed:', error);
        throw error;
    }
};

export const config = {
    schedule: '0 9 * * *',
};
