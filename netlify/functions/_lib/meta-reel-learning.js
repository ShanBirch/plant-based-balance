const HOUR_MS = 3600000;
const WINDOWS = [
    { label: '24h', target: 24, tolerance: 6 },
    { label: '7d', target: 168, tolerance: 24 },
];

function measuredNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function perThousand(count, reach) {
    return count !== null && reach > 0 ? Math.round(1000 * count / reach * 10) / 10 : null;
}

function buildReelLearning(snapshots) {
    const reels = new Map();
    for (const row of snapshots) {
        if (!reels.has(row.platform_post_id)) {
            reels.set(row.platform_post_id, {
                media_id: row.platform_post_id,
                platform: 'instagram',
                permalink: row.platform_permalink,
                title: row.title,
                topic: row.content_lane,
                posted_at: row.posted_at,
                windows: {},
            });
        }

        const capturedAt = row.meta_collected_at;
        const age = (Date.parse(capturedAt) - Date.parse(row.posted_at)) / HOUR_MS;
        if (!row.insights || !Object.keys(row.insights).length) continue;
        const window = WINDOWS.find(({ target, tolerance }) => Math.abs(age - target) <= tolerance);
        if (!window) continue;
        const reel = reels.get(row.platform_post_id);
        const current = reel.windows[window.label];
        if (current && Math.abs(current.age_hours - window.target) <= Math.abs(age - window.target)) continue;

        const insights = row.insights || {};
        const reach = measuredNumber(insights.reach) ?? measuredNumber(row.reach);
        const shares = measuredNumber(insights.shares);
        const saves = measuredNumber(insights.saved ?? insights.saves);
        reel.windows[window.label] = {
            captured_at: capturedAt,
            age_hours: age,
            views: measuredNumber(insights.views ?? insights.plays ?? insights.ig_reels_aggregated_all_plays_count),
            reach,
            shares,
            saves,
            shares_per_1000_reached: perThousand(shares, reach),
            saves_per_1000_reached: perThousand(saves, reach),
            average_watch_seconds: measuredNumber(insights.ig_reels_avg_watch_time) === null
                ? null : insights.ig_reels_avg_watch_time / 1000,
            skip_rate: measuredNumber(insights.reels_skip_rate),
        };
    }

    return {
        generated_for: 'next_reel_batch',
        source: 'Instagram Insights',
        comparison_windows: WINDOWS,
        reels: [...reels.values()],
        review: [
            'Compare only reels measured at the same age. Group comparable runtimes and keep promoted or trial reels separate when known.',
            'Use skip rate to identify opening candidates. It does not locate the exact second a viewer left. Use the in-app retention curve when diagnosing a timestamp.',
            'Compare watch time, shares and saves per 1,000 reached alongside views. Missing values are unavailable, not zero.',
            'Look for a repeatable pattern across multiple reels. Review the linked opening footage before attributing a result to the hook.',
            'Keep the full-screen avatar opening. Test one change in the next batch, starting with payoff visible in frame one versus the current question-first opening.',
        ],
    };
}

module.exports = { buildReelLearning };
