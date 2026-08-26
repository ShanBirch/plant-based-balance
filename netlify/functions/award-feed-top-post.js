const { createClient } = globalThis.__PBB_SUPABASE_DEPENDENCY__ || require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const TOP_POST_XP = 5;
const MAX_STORIES_TO_SCORE = 500;

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(statusCode, body) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(body)
    };
}

function getBearerToken(event) {
    const header = event.headers.authorization || event.headers.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

async function getAuthenticatedUser(token) {
    if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) return null;
    return response.json();
}

function isValidLocalDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function isValidAwardWindow(startAt, endAt) {
    const startMs = Date.parse(startAt);
    const endMs = Date.parse(endAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
    if (endMs <= startMs) return false;

    const durationMs = endMs - startMs;
    if (durationMs > 48 * 60 * 60 * 1000) return false;

    const now = Date.now();
    if (startMs < now - 72 * 60 * 60 * 1000) return false;
    if (endMs > now + 3 * 60 * 60 * 1000) return false;

    return true;
}

function countByStory(rows, storyAuthorById) {
    const counts = new Map();
    (rows || []).forEach((row) => {
        if (!row || !row.story_id) return;
        if (storyAuthorById && row.user_id && storyAuthorById.get(row.story_id) === row.user_id) return;
        counts.set(row.story_id, (counts.get(row.story_id) || 0) + 1);
    });
    return counts;
}

function pickUserWinningStory(stories, reactionCounts, commentCounts, userId) {
    const stats = (stories || []).map((story) => ({
        storyId: story.id,
        userId: story.user_id,
        createdAt: story.created_at,
        reactions: reactionCounts.get(story.id) || 0,
        comments: commentCounts.get(story.id) || 0
    }));

    if (!stats.length) return null;

    const maxReactions = Math.max(...stats.map((story) => story.reactions));
    const maxComments = Math.max(...stats.map((story) => story.comments));
    if (maxReactions <= 0 && maxComments <= 0) return null;

    const userWinners = stats
        .filter((story) => story.userId === userId)
        .filter((story) => (maxReactions > 0 && story.reactions === maxReactions)
            || (maxComments > 0 && story.comments === maxComments))
        .sort((a, b) => {
            const aBest = Math.max(a.reactions, a.comments);
            const bBest = Math.max(b.reactions, b.comments);
            if (bBest !== aBest) return bBest - aBest;
            return Date.parse(a.createdAt || '') - Date.parse(b.createdAt || '');
        });

    const winner = userWinners[0] || null;
    if (!winner) return null;

    const wonReactions = maxReactions > 0 && winner.reactions === maxReactions;
    const wonComments = maxComments > 0 && winner.comments === maxComments;
    const metric = wonReactions && wonComments
        ? 'reactions_and_comments'
        : wonComments ? 'comments' : 'reactions';

    return {
        ...winner,
        metric,
        metricCount: metric === 'comments'
            ? winner.comments
            : metric === 'reactions'
                ? winner.reactions
                : Math.max(winner.reactions, winner.comments)
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    if (event.httpMethod !== 'POST') {
        return json(405, { success: false, error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return json(500, { success: false, error: 'Supabase env missing' });
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (_) {
        return json(400, { success: false, error: 'Invalid JSON' });
    }

    const token = getBearerToken(event);
    const user = await getAuthenticatedUser(token);
    const userId = String(body.userId || '').trim();
    const targetDate = String(body.targetDate || '').trim();
    const startAt = String(body.startAt || '').trim();
    const endAt = String(body.endAt || '').trim();

    if (!user || !user.id) {
        return json(401, { success: false, error: 'Unauthorized' });
    }

    if (!userId || user.id !== userId) {
        return json(403, { success: false, error: 'Forbidden' });
    }

    if (!isValidLocalDate(targetDate) || !isValidAwardWindow(startAt, endAt)) {
        return json(400, { success: false, error: 'Invalid award window' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const referenceType = `feed_top_post:${targetDate}`;
    const transactionType = 'earn_feed_top_post';

    const { data: existingTx, error: existingError } = await supabase
        .from('point_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_type', transactionType)
        .eq('reference_type', referenceType)
        .limit(1)
        .maybeSingle();

    if (existingError) {
        return json(500, { success: false, error: existingError.message || 'Could not check award' });
    }

    if (existingTx) {
        return json(200, {
            success: false,
            alreadyAwarded: true,
            pointsAwarded: 0,
            reason: 'already_awarded'
        });
    }

    const { data: storyRows, error: storyError } = await supabase
        .from('stories')
        .select('id,user_id,created_at,user:users!user_id(is_test_account)')
        .gte('created_at', startAt)
        .lt('created_at', endAt)
        .order('created_at', { ascending: false })
        .limit(MAX_STORIES_TO_SCORE);

    if (storyError) {
        return json(500, { success: false, error: storyError.message || 'Could not load Feed posts' });
    }

    const stories = (storyRows || []).filter((story) => !story.user || story.user.is_test_account !== true);
    const storyIds = stories.map((story) => story.id).filter(Boolean);

    if (!storyIds.length) {
        return json(200, { success: false, pointsAwarded: 0, reason: 'no_posts' });
    }

    const [reactionResult, commentResult] = await Promise.all([
        supabase.from('feed_reactions').select('story_id,user_id').in('story_id', storyIds),
        supabase.from('feed_comments').select('story_id,user_id').in('story_id', storyIds)
    ]);

    if (reactionResult.error) {
        return json(500, { success: false, error: reactionResult.error.message || 'Could not load reactions' });
    }

    if (commentResult.error) {
        return json(500, { success: false, error: commentResult.error.message || 'Could not load comments' });
    }

    const storyAuthorById = new Map(stories.map((story) => [story.id, story.user_id]));
    const winner = pickUserWinningStory(
        stories,
        countByStory(reactionResult.data || [], storyAuthorById),
        countByStory(commentResult.data || [], storyAuthorById),
        userId
    );

    if (!winner) {
        return json(200, { success: false, pointsAwarded: 0, reason: 'not_top_post' });
    }

    const { data: tx, error: txError } = await supabase
        .from('point_transactions')
        .insert({
            user_id: userId,
            transaction_type: transactionType,
            points_amount: TOP_POST_XP,
            reference_id: winner.storyId,
            reference_type: referenceType,
            photo_verified: false,
            verification_method: 'feed_top_post',
            description: `Yesterday's top Feed ${winner.metric.replace(/_/g, ' ')}`
        })
        .select('id')
        .single();

    if (txError) {
        if (txError.code === '23505' || /duplicate key|already exists/i.test(String(txError.message || ''))) {
            return json(200, {
                success: false,
                alreadyAwarded: true,
                pointsAwarded: 0,
                reason: 'already_awarded'
            });
        }

        return json(500, { success: false, error: txError.message || 'Could not award XP' });
    }

    if (!tx) {
        return json(200, { success: false, pointsAwarded: 0, reason: 'award_not_created' });
    }

    const { data: newTotal, error: pointsError } = await supabase
        .rpc('increment_user_points', { p_user_id: userId, p_amount: TOP_POST_XP });

    if (pointsError) {
        return json(500, { success: false, error: pointsError.message || 'Could not update points' });
    }

    return json(200, {
        success: true,
        pointsAwarded: TOP_POST_XP,
        newTotal: Number(newTotal || 0),
        storyId: winner.storyId,
        metric: winner.metric,
        metricCount: winner.metricCount,
        targetDate
    });
};
