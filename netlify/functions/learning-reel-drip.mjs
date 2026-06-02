import learningReelSources from './_lib/learning-reel-sources.js';
import clientContext from './_lib/client-context.js';
import metaIgAccounts from './_lib/meta-ig-accounts.js';

const {
    buildCuratedLearningReelQueries,
    findCuratedLearningReelSource,
    scoreCuratedLearningReelCandidate,
    LEARNING_REEL_TOPIC_LABELS,
} = learningReelSources;
const {
    findDuplicateLearningReels,
    mergeLearningReelContext,
    normalizeCoachDraftText,
    normalizeLearningReelItems,
    truncate,
} = clientContext;
const { resolveMetaIgAccessToken } = metaIgAccounts;

const DRIP_ID = 'shan_n_sunny_cocos_learning_drip_2026_06';
const DEFAULT_TARGET_HANDLE = 'shan_n_sunny';
const COCOS_BOT_ACCOUNT = 'cocos_pt_studio';
const COCOS_ALGORITHM_FORK = 'cocos_acquisition_v1';
const SOURCE = 'learning_reel_drip_instagram_graph';
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const LEGACY_GRAPH_SUBSCRIBER_PREFIX = 'meta_ig:';
const DEFAULT_AUTOSTART_UNTIL = '2026-06-10T00:00:00+10:00';
const DRIP_REVISION = 'hourly_168_v2';
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_DRIP_DAYS = 7;
const DEFAULT_TOTAL_SENDS = DEFAULT_DRIP_DAYS * 24;
const PAUSE_RECHECK_MS = 60 * 60 * 1000;
const MAX_SEARCH_QUERIES = 3;
const MAX_SEARCH_RESULTS_PER_QUERY = 12;
const MAX_DETAIL_IDS = 50;
const TOPIC_SEQUENCE = [
    'plant_based_cooking',
    'protein_science',
    'weight_training_technique',
    'workout_motivation',
    'macronutrient_science',
    'micronutrient_science',
    'mindset',
    'neuroscience',
    'longevity',
    'recovery_sleep_energy',
    'fat_loss_basics',
    'muscle_gain_basics',
    'supplements',
    'meal_prep_planning',
];

export const config = {
    schedule: '*/5 * * * *',
};

function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return String(netlifyValue);
    return typeof process !== 'undefined' ? String(process.env?.[name] || '') : '';
}

const SUPABASE_URL = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');
const YOUTUBE_API_KEY = getEnv('YOUTUBE_API_KEY');
const INSTAGRAM_GRAPH_API_VERSION = normalizeGraphApiVersion(
    getEnv('IG_GRAPH_API_VERSION')
    || getEnv('INSTAGRAM_GRAPH_API_VERSION')
    || getEnv('META_IG_API_VERSION')
    || getEnv('META_GRAPH_API_VERSION')
    || 'v25.0'
);

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function normalizeHandle(value) {
    return cleanString(value, 120).replace(/^@+/, '').toLowerCase();
}

function firstString(values = []) {
    return values.map(v => cleanString(v, 500)).find(Boolean) || '';
}

async function supabase(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env missing');
    const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    }
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function parseIsoDuration(value) {
    const m = String(value || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return null;
    const days = Number(m[1] || 0);
    const hours = Number(m[2] || 0);
    const minutes = Number(m[3] || 0);
    const seconds = Number(m[4] || 0);
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function bestThumbnailUrl(thumbnails = {}) {
    return thumbnails.maxres?.url
        || thumbnails.standard?.url
        || thumbnails.high?.url
        || thumbnails.medium?.url
        || thumbnails.default?.url
        || '';
}

async function youtubeSearch(query, maxResults = MAX_SEARCH_RESULTS_PER_QUERY) {
    if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY missing');
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoDuration', 'short');
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('safeSearch', 'strict');
    url.searchParams.set('regionCode', 'AU');
    url.searchParams.set('relevanceLanguage', 'en');
    url.searchParams.set('q', `${query} shorts`);
    url.searchParams.set('key', YOUTUBE_API_KEY);
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) throw new Error(`YouTube search ${response.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    return Array.isArray(data.items) ? data.items : [];
}

async function youtubeVideoDetails(ids) {
    if (!YOUTUBE_API_KEY || !ids.length) return new Map();
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails,statistics,status');
    url.searchParams.set('id', ids.slice(0, MAX_DETAIL_IDS).join(','));
    url.searchParams.set('key', YOUTUBE_API_KEY);
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) throw new Error(`YouTube videos ${response.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    return new Map((Array.isArray(data.items) ? data.items : []).map(item => [item.id, item]));
}

function graphSubscriberParts(subscriberId = '') {
    const raw = cleanString(subscriberId, 300);
    if (raw.startsWith(GRAPH_SUBSCRIBER_PREFIX)) {
        const tail = raw.slice(GRAPH_SUBSCRIBER_PREFIX.length);
        const parts = tail.split(':').filter(Boolean);
        if (parts.length >= 2) return { accountId: parts[0], recipientId: parts[parts.length - 1] };
        return { accountId: '', recipientId: tail };
    }
    if (raw.startsWith(LEGACY_GRAPH_SUBSCRIBER_PREFIX)) {
        return { accountId: '', recipientId: raw.slice(LEGACY_GRAPH_SUBSCRIBER_PREFIX.length) };
    }
    return { accountId: '', recipientId: '' };
}

function resolveThreadGraph(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    const subscriberParts = graphSubscriberParts(thread.subscriber_id);
    const accountId = firstString([
        graph.ig_account_id,
        graph.account_id,
        graph.owner_id,
        customData.owner_ig_user_id,
        customData.ig_graph_account_id,
        customData.ig_account_id,
        subscriberParts.accountId,
        getEnv('META_IG_USER_ID'),
        getEnv('INSTAGRAM_GRAPH_ACCOUNT_ID'),
        getEnv('IG_GRAPH_BUSINESS_ACCOUNT_ID'),
    ]);
    const recipientId = firstString([
        graph.ig_graph_user_id,
        graph.recipient_id,
        customData.ig_graph_user_id,
        thread.ig_graph_recipient_id,
        subscriberParts.recipientId,
    ]);
    return { accountId, recipientId };
}

function hoursSinceIso(value, nowMs = Date.now()) {
    const ts = Date.parse(value || '');
    if (!Number.isFinite(ts)) return null;
    return (nowMs - ts) / (60 * 60 * 1000);
}

async function loadTargetThread(handle) {
    const encoded = encodeURIComponent(`*${handle}*`);
    const select = 'id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,last_inbound_at,last_outbound_at,custom_data,auto_send_enabled';
    const rows = await supabase(
        `ig_threads?select=${select}&channel=eq.instagram&ig_username=ilike.${encoded}&order=last_inbound_at.desc.nullslast&limit=20`
    );
    const exact = rows.find(row => normalizeHandle(row.ig_username) === handle);
    return exact || rows[0] || null;
}

function configuredTopics() {
    const raw = getEnv('LEARNING_REEL_DRIP_TOPICS');
    if (!raw) return TOPIC_SEQUENCE;
    const values = raw.split(',').map(value => value.trim()).filter(Boolean);
    const topics = values.filter(topicId => LEARNING_REEL_TOPIC_LABELS[topicId]);
    return topics.length ? topics : TOPIC_SEQUENCE;
}

function configuredIntervalMs() {
    return Math.max(60 * 60 * 1000, Number(getEnv('LEARNING_REEL_DRIP_INTERVAL_MS') || DEFAULT_INTERVAL_MS));
}

function configuredTotalSends() {
    const explicit = Number(getEnv('LEARNING_REEL_DRIP_TOTAL_SENDS') || 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(336, Math.floor(explicit));
    const days = Number(getEnv('LEARNING_REEL_DRIP_DAYS') || DEFAULT_DRIP_DAYS);
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(14, days) : DEFAULT_DRIP_DAYS;
    return Math.max(1, Math.floor(safeDays * 24));
}

function buildInitialPlan(nowMs = Date.now()) {
    const topics = configuredTopics();
    const intervalMs = configuredIntervalMs();
    const totalSends = configuredTotalSends();
    return Array.from({ length: totalSends }, (_, index) => {
        const topicId = topics[index % topics.length];
        return {
            index,
            topic_id: topicId,
            topic_label: LEARNING_REEL_TOPIC_LABELS[topicId] || topicId,
            due_at: new Date(nowMs + (index * intervalMs)).toISOString(),
            status: 'pending',
        };
    });
}

function autostartAllowed(nowMs = Date.now()) {
    const explicit = getEnv('LEARNING_REEL_DRIP_AUTOSTART');
    if (explicit && !['1', 'true', 'yes', 'on'].includes(explicit.toLowerCase())) return false;
    const until = Date.parse(getEnv('LEARNING_REEL_DRIP_AUTOSTART_UNTIL') || DEFAULT_AUTOSTART_UNTIL);
    return Number.isFinite(until) && nowMs <= until;
}

function normalizeDripState(thread, nowMs = Date.now()) {
    const customData = safeObject(thread.custom_data);
    const existing = safeObject(customData.learning_reel_drip);
    if (existing.id === DRIP_ID && Array.isArray(existing.plan)) {
        const totalSends = configuredTotalSends();
        const intervalMs = configuredIntervalMs();
        if (existing.revision !== DRIP_REVISION || existing.plan.length !== totalSends || Number(existing.interval_ms) !== intervalMs) {
            const replannedAt = new Date(nowMs).toISOString();
            const plan = buildInitialPlan(nowMs);
            return {
                ...existing,
                status: existing.status === 'stopped' ? 'stopped' : 'active',
                revision: DRIP_REVISION,
                previous_revision: existing.revision || 'initial_14_reels',
                previous_plan_count: existing.plan.length,
                replanned_at: replannedAt,
                updated_at: replannedAt,
                next_send_at: plan[0]?.due_at || null,
                interval_ms: intervalMs,
                total_sends: totalSends,
                plan,
            };
        }
        return {
            ...existing,
            status: existing.status || 'active',
            revision: existing.revision || DRIP_REVISION,
            plan: existing.plan,
        };
    }
    if (!autostartAllowed(nowMs)) {
        return {
            id: DRIP_ID,
            status: 'not_started',
            target_handle: DEFAULT_TARGET_HANDLE,
            reason: 'autostart_window_closed',
        };
    }
    const startedAt = new Date(nowMs).toISOString();
    const plan = buildInitialPlan(nowMs);
    return {
        id: DRIP_ID,
        status: 'active',
        revision: DRIP_REVISION,
        target_handle: DEFAULT_TARGET_HANDLE,
        bot_account: COCOS_BOT_ACCOUNT,
        algorithm_fork: COCOS_ALGORITHM_FORK,
        started_at: startedAt,
        updated_at: startedAt,
        next_send_at: plan[0]?.due_at || null,
        interval_ms: configuredIntervalMs(),
        total_sends: configuredTotalSends(),
        plan,
        sent: [],
        skipped: [],
    };
}

function nextDuePlanItem(state, nowMs = Date.now()) {
    if (!Array.isArray(state.plan)) return null;
    return state.plan
        .filter(item => item && item.status === 'pending')
        .sort((a, b) => (Date.parse(a.due_at || '') || 0) - (Date.parse(b.due_at || '') || 0))
        .find(item => (Date.parse(item.due_at || '') || 0) <= nowMs) || null;
}

function nextPendingSendAt(state) {
    const pending = Array.isArray(state.plan)
        ? state.plan.filter(item => item && item.status === 'pending')
        : [];
    if (!pending.length) return null;
    return pending
        .map(item => Date.parse(item.due_at || ''))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)[0] || null;
}

function updatePlanItem(state, index, patch) {
    const plan = Array.isArray(state.plan) ? state.plan : [];
    const updatedPlan = plan.map(item => item.index === index ? { ...item, ...patch } : item);
    const nextMs = nextPendingSendAt({ ...state, plan: updatedPlan });
    const complete = !updatedPlan.some(item => item.status === 'pending');
    return {
        ...state,
        status: complete ? 'completed' : 'active',
        updated_at: new Date().toISOString(),
        next_send_at: nextMs ? new Date(nextMs).toISOString() : null,
        completed_at: complete ? new Date().toISOString() : state.completed_at || null,
        plan: updatedPlan,
    };
}

function shouldHoldPausedState(state, nowMs = Date.now()) {
    if (state?.status !== 'paused') return false;
    const nextMs = Date.parse(state.next_send_at || '');
    return Number.isFinite(nextMs) && nextMs > nowMs;
}

function patchState(state, patch) {
    return {
        ...state,
        ...patch,
        updated_at: new Date().toISOString(),
    };
}

function applyCocosThreadCustomData(customData, graph, state) {
    const base = safeObject(customData);
    const currentGraph = safeObject(base.instagram_graph);
    return {
        ...base,
        bot_account: COCOS_BOT_ACCOUNT,
        algorithm_fork: COCOS_ALGORITHM_FORK,
        learning_reel_drip: state,
        instagram_graph: {
            ...currentGraph,
            bot_account: COCOS_BOT_ACCOUNT,
            algorithm_fork: COCOS_ALGORITHM_FORK,
            ig_graph_user_id: graph.recipientId || currentGraph.ig_graph_user_id || null,
            ig_account_id: graph.accountId || currentGraph.ig_account_id || null,
            send_ready: !!graph.recipientId,
        },
    };
}

async function persistThreadState(thread, state, extraPatch = {}) {
    const graph = resolveThreadGraph(thread);
    const customData = applyCocosThreadCustomData(thread.custom_data, graph, state);
    const patch = {
        auto_send_enabled: true,
        custom_data: customData,
        ...extraPatch,
    };
    await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=minimal',
    });
    thread.custom_data = customData;
    thread.auto_send_enabled = true;
    if (extraPatch.last_outbound_at) thread.last_outbound_at = extraPatch.last_outbound_at;
    return thread;
}

function sentVideoIdsFromState(state) {
    return new Set([
        ...(Array.isArray(state.sent) ? state.sent : []).map(item => item?.video_id),
        ...(Array.isArray(state.plan) ? state.plan : []).map(item => item?.video_id),
    ].map(value => cleanString(value, 120)).filter(Boolean));
}

function candidateFromResult(raw, detail, topicId, query) {
    const detailSnippet = safeObject(detail?.snippet);
    const searchSnippet = safeObject(raw?.snippet);
    const snippet = Object.keys(detailSnippet).length ? detailSnippet : searchSnippet;
    const durationSec = parseIsoDuration(detail?.contentDetails?.duration);
    const viewCount = Number(detail?.statistics?.viewCount || 0);
    const channelId = cleanString(snippet.channelId || searchSnippet.channelId || '', 120);
    const videoId = cleanString(raw?.id?.videoId || detail?.id || '', 120);
    const title = cleanString(snippet.title || searchSnippet.title || '', 300);
    const channelTitle = cleanString(snippet.channelTitle || searchSnippet.channelTitle || '', 180);
    const description = cleanString(snippet.description || searchSnippet.description || '', 5000);
    const source = findCuratedLearningReelSource({ channelTitle, channelId }, topicId);
    const url = `https://www.youtube.com/shorts/${videoId}`;
    const reasonParts = [
        source?.channelTitle ? `trusted source: ${source.channelTitle}` : '',
        `matched topic: ${LEARNING_REEL_TOPIC_LABELS[topicId] || topicId}`,
        viewCount ? `${viewCount.toLocaleString('en-US')} views` : '',
    ].filter(Boolean);
    return {
        topicId,
        topic_id: topicId,
        topicLabel: LEARNING_REEL_TOPIC_LABELS[topicId] || topicId,
        topic_label: LEARNING_REEL_TOPIC_LABELS[topicId] || topicId,
        query,
        youtube_query: query,
        videoId,
        video_id: videoId,
        title,
        channelTitle,
        channel_title: channelTitle,
        channelId,
        channel_id: channelId,
        description,
        publishedAt: snippet.publishedAt || null,
        published_at: snippet.publishedAt || null,
        durationSec,
        duration_seconds: durationSec || undefined,
        viewCount,
        view_count: viewCount || undefined,
        thumbnail_url: bestThumbnailUrl(snippet.thumbnails),
        url,
        source_id: source?.id || '',
        source_kind: source?.sourceKind || '',
        subscriber_tier: source?.subscriberTier || '',
        reason: reasonParts.join('. '),
    };
}

async function findReelForTopic({ topicId, thread, state }) {
    const queries = buildCuratedLearningReelQueries(topicId, { perSource: 1 }).slice(0, MAX_SEARCH_QUERIES);
    const seenIds = new Set();
    const rawCandidates = [];
    for (const query of queries) {
        const results = await youtubeSearch(query, MAX_SEARCH_RESULTS_PER_QUERY);
        for (const item of results) {
            const videoId = cleanString(item?.id?.videoId, 120);
            if (!videoId || seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            rawCandidates.push({ query, item });
        }
    }

    const details = await youtubeVideoDetails(rawCandidates.map(candidate => candidate.item?.id?.videoId).filter(Boolean));
    const existingSentIds = sentVideoIdsFromState(state);
    const candidates = rawCandidates.map(({ query, item }) => {
        const detail = details.get(item?.id?.videoId) || {};
        const candidate = candidateFromResult(item, detail, topicId, query);
        return {
            ...candidate,
            score: scoreCuratedLearningReelCandidate(candidate, topicId),
        };
    }).filter(candidate => {
        if (!candidate.video_id || existingSentIds.has(candidate.video_id)) return false;
        if (candidate.score < 0) return false;
        if (candidate.duration_seconds && candidate.duration_seconds > 240) return false;
        const normalized = normalizeLearningReelItems([candidate], {
            source: SOURCE,
            platform: 'youtube',
        });
        return !findDuplicateLearningReels(thread, normalized).length;
    }).sort((a, b) => b.score - a.score);

    return candidates[0] || null;
}

function messageVariantIndex(reel, itemIndex = 0, length = 1) {
    const seed = `${itemIndex}:${reel?.video_id || reel?.videoId || reel?.url || reel?.title || ''}`;
    const hash = Array.from(seed).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7);
    return hash % Math.max(1, length);
}

function cleanMessageCue(value, maxWords = 5) {
    const cleaned = cleanString(value, 180)
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/#[a-z0-9_]+/gi, ' ')
        .replace(/[^\w\s&+'-]/g, ' ')
        .replace(/\b(the best|best|easy|quick|simple|healthy|vegan|plant based|plant-based|recipe|shorts?|reels?|explained|fix your|how to|how much|how many|can you|can your body|new science|new study|new research|study says|stop doing|mistakes?)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length < 2) return '';
    return words.slice(0, maxWords).join(' ');
}

const COOKING_COPY_TOPIC_IDS = new Set(['plant_based_cooking', 'meal_prep_planning']);
const PRACTICAL_COOKING_RE = /\b(recipe|cook|cooking|make|made|bake|baked|roast|roasted|fry|fried|airfry|air fry|blend|blended|chop|chopped|salad|tofu|tempeh|lentil|beans?|chickpea|curry|dahl|dal|pasta|soup|sandwich|wrap|bowl|oats|smoothie|sauce|dressing|cucumber|breakfast|lunch|dinner|snack)\b/i;
const SCIENCE_EXPLAINER_RE = /\b(absorb|absorption|study|science|research|evidence|myth|explained|how much|how many|can you|grams?|per meal|one meal|muscle protein synthesis|protein timing)\b/i;

function isPracticalCookingReel(topicId, topicText) {
    if (!COOKING_COPY_TOPIC_IDS.has(topicId)) return false;
    if (SCIENCE_EXPLAINER_RE.test(topicText) && !PRACTICAL_COOKING_RE.test(topicText)) return false;
    return PRACTICAL_COOKING_RE.test(topicText);
}

function cookingMessage(reel, itemIndex = 0) {
    const cue = cleanMessageCue(reel?.title, 4);
    const withCue = [
        `mhmm make me this ${cue}`,
        `ok this ${cue} looks yum`,
        `need this ${cue} situation`,
        `would absolutely eat this ${cue}`,
        `this ${cue} looks very worth trying`,
    ];
    const fallback = [
        'mhmm make me this',
        'ok this looks yum',
        'need this for dinner',
        'would absolutely eat this',
        'this looks very worth trying',
    ];
    const options = cue ? withCue : fallback;
    return options[messageVariantIndex(reel, itemIndex, options.length)];
}

function buildMessageOpener(reel, itemIndex = 0) {
    const topicId = cleanString(reel?.topic_id || reel?.topicId, 80);
    const topicLabel = cleanString(reel?.topic_label || reel?.topicLabel, 120).toLowerCase();
    const topicText = `${topicId} ${topicLabel} ${reel?.title || ''}`.toLowerCase();
    const cue = cleanMessageCue(reel?.title, 4);
    const optionsByTopic = (() => {
        if (isPracticalCookingReel(topicId, topicText)) {
            return null;
        }
        if (/technique|weight_training|athlean|squat|deadlift|bench|form|training/.test(topicText)) {
            return [
                'this is a good technique one',
                cue ? `good little ${cue} cue` : 'good little form cue',
                'this one is handy for training',
                'worth saving this for the gym',
            ];
        }
        if (/motivation/.test(topicText)) {
            return [
                'good little hype watch',
                'save this for a flat training day',
                'this one has good training energy',
                'tiny motivation hit for later',
            ];
        }
        if (/protein/.test(topicText)) {
            if (/\b(absorb|absorption|per meal|one meal|muscle protein synthesis|protein timing)\b/.test(topicText)) {
                return [
                    'this answers that protein per meal thing pretty well',
                    'good little protein absorption one',
                    'worth a look for the protein myth bit',
                    'this clears up the protein per meal thing',
                ];
            }
            return [
                'good little protein one',
                'this makes the protein bit simpler',
                'worth a look for the food nerd side',
                'this one breaks the protein bit down nicely',
            ];
        }
        if (/macro|micro|nutrition|supplement/.test(topicText)) {
            return [
                cue ? `good little ${cue} one` : 'good little nutrition one',
                'this makes the nutrition bit simpler',
                'worth a look for the food nerd side',
                'this one breaks it down nicely',
            ];
        }
        if (/mindset|neuro|brain|behaviour|behavior|longevity/.test(topicText)) {
            return [
                'this is a good brain one',
                cue ? `this bit on ${cue} is interesting` : 'this bit is interesting',
                'worth a look for the mindset side',
                'this one explains it nicely',
            ];
        }
        return [
            'this one is worth a watch',
            cue ? `this bit on ${cue} is good` : 'this bit is good',
            'quick one for later',
            'saved this one for you',
        ];
    })();
    if (!optionsByTopic) return cookingMessage(reel, itemIndex);
    return optionsByTopic[messageVariantIndex(reel, itemIndex, optionsByTopic.length)];
}

function buildVisibleMessage(reel, itemIndex = 0) {
    const opener = buildMessageOpener(reel, itemIndex);
    return normalizeCoachDraftText(`${opener}\n${reel.url}`).trim();
}

async function postToInstagramGraph({ recipientId, accountId, token, text }) {
    if (!token) throw new Error('Instagram Graph access token missing');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');
    const targetAccount = accountId || 'me';
    const response = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
        }),
    });
    const body = await response.text();
    let parsed = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = { raw: body.slice(0, 300) }; }
    if (!response.ok) {
        const message = parsed?.error?.message || body;
        throw new Error(`Instagram Graph ${response.status}: ${String(message || '').slice(0, 300)}`);
    }
    return parsed;
}

async function logOutbound(thread, text, graphMessageId) {
    const rows = await supabase('ig_messages', {
        method: 'POST',
        body: [{
            thread_id: thread.id,
            direction: 'out',
            text,
            source: SOURCE,
            manychat_message_id: graphMessageId ? `${GRAPH_SUBSCRIBER_PREFIX}${graphMessageId}` : null,
        }],
    });
    return rows?.[0]?.id || null;
}

async function sendDueReel({ thread, state, item, nowMs = Date.now() }) {
    const graph = resolveThreadGraph(thread);
    if (!graph.recipientId || !graph.accountId) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'graph_recipient_or_account_missing',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistThreadState(thread, next);
        return { sent: false, blocker: 'graph_recipient_or_account_missing', state: next };
    }

    const lastInboundHours = hoursSinceIso(thread.last_inbound_at, nowMs);
    if (lastInboundHours === null || lastInboundHours > 24) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'standard_24h_messaging_window_closed_waiting_for_test_reply',
            last_inbound_hours: lastInboundHours,
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistThreadState(thread, next);
        return { sent: false, blocker: 'standard_24h_messaging_window_closed', state: next };
    }

    const reel = await findReelForTopic({ topicId: item.topic_id, thread, state });
    if (!reel) {
        const next = updatePlanItem(state, item.index, {
            status: 'skipped_no_candidate',
            skipped_at: new Date(nowMs).toISOString(),
        });
        next.skipped = [
            ...(Array.isArray(state.skipped) ? state.skipped : []),
            { topic_id: item.topic_id, topic_label: item.topic_label, skipped_at: new Date(nowMs).toISOString(), reason: 'no_curated_candidate' },
        ].slice(-30);
        await persistThreadState(thread, next);
        return { sent: false, blocker: 'no_curated_candidate', state: next };
    }

    const { token, source: tokenSource } = await resolveMetaIgAccessToken(graph.accountId, supabase);
    if (!token) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'instagram_graph_token_missing',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistThreadState(thread, next);
        return { sent: false, blocker: 'instagram_graph_token_missing', state: next };
    }

    const message = buildVisibleMessage(reel, item.index);
    const response = await postToInstagramGraph({
        recipientId: graph.recipientId,
        accountId: graph.accountId,
        token,
        text: message,
    });
    const graphMessageId = response?.message_id || response?.id || null;
    const sentAt = new Date(nowMs).toISOString();
    const messageId = await logOutbound(thread, message, graphMessageId);

    const reelContext = {
        ...reel,
        sent_at: sentAt,
        sent_message: message,
        source: SOURCE,
        platform: 'youtube',
        graph_message_ids: graphMessageId ? [graphMessageId] : [],
        message_ids: messageId ? [messageId] : [],
    };
    let nextState = updatePlanItem(state, item.index, {
        status: 'sent',
        sent_at: sentAt,
        video_id: reel.video_id,
        title: reel.title,
        channel_title: reel.channel_title,
        url: reel.url,
        token_source: tokenSource,
    });
    nextState = {
        ...nextState,
        status: nextState.status === 'completed' ? 'completed' : 'active',
        paused_reason: null,
        sent: [
            ...(Array.isArray(state.sent) ? state.sent : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                sent_at: sentAt,
                video_id: reel.video_id,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
            },
        ].slice(-40),
    };

    const currentCustomData = applyCocosThreadCustomData(thread.custom_data, graph, nextState);
    const nextCustomData = mergeLearningReelContext(currentCustomData, [reelContext], {
        sentAt,
        sentMessage: message,
        source: SOURCE,
        graphMessageIds: graphMessageId ? [graphMessageId] : [],
        messageIds: messageId ? [messageId] : [],
        platform: 'youtube',
        topicLabel: reel.topic_label,
        reason: reel.reason,
    });

    await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: {
            last_outbound_at: sentAt,
            auto_send_enabled: true,
            custom_data: nextCustomData,
        },
        prefer: 'return=minimal',
    });
    return {
        sent: true,
        state: nextState,
        reel: {
            topic_id: item.topic_id,
            topic_label: item.topic_label,
            title: reel.title,
            channel_title: reel.channel_title,
            url: reel.url,
            description: truncate(reel.description || '', 260),
        },
        graph_message_id: graphMessageId,
        message_id: messageId,
    };
}

async function runDrip({ sendDue = true } = {}) {
    const nowMs = Date.now();
    const handle = normalizeHandle(getEnv('LEARNING_REEL_DRIP_TARGET_HANDLE') || DEFAULT_TARGET_HANDLE);
    const thread = await loadTargetThread(handle);
    if (!thread) return { ok: false, error: 'target_thread_not_found', target_handle: handle };

    let state = normalizeDripState(thread, nowMs);
    await persistThreadState(thread, state);
    if (state.status === 'not_started') {
        return { ok: true, target_handle: handle, status: state.status, reason: state.reason };
    }
    if (state.status === 'completed' || state.status === 'stopped') {
        return { ok: true, target_handle: handle, status: state.status, next_send_at: state.next_send_at || null };
    }
    if (!sendDue) {
        return { ok: true, target_handle: handle, status: state.status, next_send_at: state.next_send_at || null, plan: state.plan };
    }
    if (shouldHoldPausedState(state, nowMs)) {
        return {
            ok: true,
            target_handle: handle,
            status: state.status,
            paused_reason: state.paused_reason || null,
            next_send_at: state.next_send_at || null,
            due: false,
        };
    }

    const due = nextDuePlanItem(state, nowMs);
    if (!due) {
        const nextMs = nextPendingSendAt(state);
        state = patchState(state, {
            status: 'active',
            paused_reason: null,
            next_send_at: nextMs ? new Date(nextMs).toISOString() : null,
        });
        await persistThreadState(thread, state);
        return { ok: true, target_handle: handle, status: state.status, next_send_at: state.next_send_at, due: false };
    }

    const result = await sendDueReel({ thread, state, item: due, nowMs });
    return {
        ok: true,
        target_handle: handle,
        due: true,
        sent: result.sent,
        blocker: result.blocker || null,
        status: result.state?.status || state.status,
        next_send_at: result.state?.next_send_at || null,
        reel: result.reel || null,
    };
}

export default async function handler(req) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { ok: false, error: 'Supabase env missing' });
    if (!YOUTUBE_API_KEY) return json(500, { ok: false, error: 'YOUTUBE_API_KEY missing' });

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';
    const token = url.searchParams.get('token') || '';
    const expectedToken = getEnv('LEARNING_REEL_DRIP_TOKEN');

    if (action === 'status' || action === 'dry_run') {
        if (!expectedToken || token !== expectedToken) return json(404, { ok: false, error: 'not_found' });
        const result = await runDrip({ sendDue: false });
        return json(result.ok === false ? 404 : 200, result);
    }

    try {
        const result = await runDrip({ sendDue: true });
        return json(result.ok === false ? 404 : 200, result);
    } catch (error) {
        console.error('[learning-reel-drip] failed:', error);
        return json(500, { ok: false, error: error.message || String(error) });
    }
}

export const _test = {
    applyCocosThreadCustomData,
    buildInitialPlan,
    buildVisibleMessage,
    candidateFromResult,
    nextDuePlanItem,
    normalizeDripState,
    resolveThreadGraph,
    shouldHoldPausedState,
    updatePlanItem,
};
