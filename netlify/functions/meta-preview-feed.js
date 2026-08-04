/**
 * Read-only community preview for the paid Meta guest walkthrough.
 *
 * This endpoint deliberately exposes only posts owned by Shannon's verified
 * Balance accounts. It never returns arbitrary member content and it never
 * sends the Supabase service-role key to the browser.
 */
const { supabaseQuery } = require('./_lib/client-context');

const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const SHANNON_ACCOUNT_IDS = [
    'bd1bccd6-56b6-4975-b708-7404c910d1a2',
    '00a6605e-8edb-4917-85ba-24a23f179059',
];
const MAX_POSTS = 4;

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=60, s-maxage=120',
        },
        body: JSON.stringify(body),
    };
}

function safeMediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        return parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch (_) {
        return '';
    }
}

function safeCaption(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const card = JSON.parse(raw);
        const candidate = card.caption || card.text || card.title || card.meal_name || card.workout_name || '';
        return String(candidate).replace(/\s+/g, ' ').trim().slice(0, 280);
    } catch (_) {
        return raw.replace(/\s+/g, ' ').trim().slice(0, 280);
    }
}

async function loadShannonAccountIds() {
    const rows = await supabaseQuery(
        `users?select=id,email&id=in.(${SHANNON_ACCOUNT_IDS.join(',')})&limit=${SHANNON_ACCOUNT_IDS.length}`
    ).catch(() => []);
    const verified = rows
        .filter(row => SHANNON_ACCOUNT_IDS.includes(String(row.id || '')))
        .map(row => String(row.id));

    if (verified.length) return verified;

    const byEmail = await supabaseQuery(
        `users?select=id,email&email=eq.${encodeURIComponent(SHANNON_EMAIL)}&limit=1`
    ).catch(() => []);
    return byEmail[0]?.id ? [String(byEmail[0].id)] : [];
}

async function loadPreviewPosts() {
    const accountIds = await loadShannonAccountIds();
    if (!accountIds.length) return [];

    const rows = await supabaseQuery(
        `stories?select=id,user_id,media_type,media_url,thumbnail_url,caption,created_at&user_id=in.(${accountIds.join(',')})&order=created_at.desc&limit=12`
    );

    return rows
        .filter(row => accountIds.includes(String(row.user_id || '')))
        .map(row => ({
            id: String(row.id || ''),
            author: 'Coach Shan',
            caption: safeCaption(row.caption),
            media_type: row.media_type === 'video' ? 'video' : 'image',
            media_url: safeMediaUrl(row.media_url) || safeMediaUrl(row.thumbnail_url),
            created_at: row.created_at || null,
        }))
        .filter(row => row.id && (row.caption || row.media_url))
        .slice(0, MAX_POSTS);
}

async function handler(event = {}) {
    if (event.httpMethod && event.httpMethod !== 'GET') {
        return response(405, { error: 'Method not allowed' });
    }
    try {
        return response(200, { posts: await loadPreviewPosts() });
    } catch (error) {
        console.error('[meta-preview-feed] could not load preview posts', error);
        return response(200, { posts: [] });
    }
}

module.exports = {
    handler,
    loadPreviewPosts,
    safeCaption,
    safeMediaUrl,
};
