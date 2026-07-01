import learningReelSources from './_lib/learning-reel-sources.js';
import clientContext from './_lib/client-context.js';
import metaIgAccounts from './_lib/meta-ig-accounts.js';

const {
    buildCuratedLearningReelQueries,
    findCuratedLearningReelSource,
    scoreCuratedLearningReelCandidate,
    LEARNING_REEL_BLOCKLIST_RE,
    LEARNING_REEL_TOPIC_LABELS,
} = learningReelSources;
const {
    findDuplicateLearningReels,
    insertCoachAlert,
    isAiAutomationOptedOut,
    isAlwaysNeedsYouPerson,
    isTestAccount,
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
const LEARNING_REEL_APPROVAL_REASON = 'learning_reel_approval_required';
const MAX_SEARCH_QUERIES = 8;
const MAX_SEARCH_RESULTS_PER_QUERY = 12;
const MAX_DETAIL_IDS = 50;
const RECENT_SOURCE_MIX_WINDOW = 8;
const MAX_RECENT_SAME_SOURCE = 2;
const PRIMARY_DRIP_STOPPED_REASON = 'primary_test_drip_window_closed';
const CLIENT_PILOT_REVISION = 'vegan_food_3_per_week_v1';
const CLIENT_PILOT_INTERVAL_MS = Math.floor((7 * 24 * 60 * 60 * 1000) / 3);
const CLIENT_PILOT_TOTAL_SENDS = 12;
const CLIENT_PILOT_TOPICS = ['plant_based_cooking', 'meal_prep_planning'];
const PERSONAL_MUSIC_TOPIC_ID = 'personal_music';
const PERSONAL_MUSIC_TOPIC_LABEL = 'Music';
const DYNAMIC_LEAD_DRIP_ID = 'lead_conversation_reels';
const DYNAMIC_LEAD_DRIP_REVISION = 'conversation_reel_3_per_week_v1';
const DYNAMIC_LEAD_TOTAL_SENDS = 12;
const DYNAMIC_LEAD_LOOKBACK_DAYS = 45;
const DYNAMIC_LEAD_DEFAULT_MAX_THREADS = 12;
const DYNAMIC_LEAD_DEFAULT_MIN_LAST_INBOUND_HOURS = 22;
const DYNAMIC_LEAD_DEFAULT_MAX_LAST_INBOUND_HOURS = 23.75;
const DYNAMIC_LEAD_DEFAULT_MIN_QUIET_HOURS = 22;
const DYNAMIC_LEAD_WEEKLY_CAP = 3;
const DYNAMIC_LEAD_LATEST_CONTEXT_HOURS = 36;
const DYNAMIC_LEAD_LATEST_CONTEXT_MAX_MESSAGES = 8;
const CLIENT_PILOT_TARGETS = [
    {
        id: 'mon_vegan_food_pilot',
        label: 'Mon',
        handle: 'monica.l.sheekey',
    },
    {
        id: 'francesca_vegan_food_pilot',
        label: 'Francesca',
        handle: 'cavazzanafrancesca',
        revision: 'francesca_vegan_panettone_approval_v1',
        topics: ['vegan_panettone', 'plant_based_cooking', 'meal_prep_planning'],
        review_reason: 'francesca_panettone_reel_review',
    },
    {
        id: 'lil_bunny_reel_pilot',
        label: 'Lil',
        handle: 'liligrace_h',
        revision: 'bunny_reels_3_per_week_v1',
        topics: ['bunny_reels'],
        caption_mode: 'url_only',
        vegan_safe_required: false,
    },
    {
        id: 'miranda_core_pelvic_tilt_pilot',
        label: 'Miranda',
        handle: 'miranda_laree_is_me',
        revision: 'core_pelvic_tilt_review_3_per_week_v1',
        topics: ['pelvic_tilt_balance', 'core_training_technique', 'weight_training_technique'],
        vegan_safe_required: false,
        review_before_send: true,
        review_reason: 'miranda_core_pelvic_tilt_review',
    },
].map(target => ({
    ...target,
    revision: target.revision || CLIENT_PILOT_REVISION,
    interval_ms: CLIENT_PILOT_INTERVAL_MS,
    total_sends: CLIENT_PILOT_TOTAL_SENDS,
    topics: target.topics || CLIENT_PILOT_TOPICS,
    vegan_safe_required: target.vegan_safe_required !== false,
    review_before_send: target.review_before_send !== false,
}));
const VEGAN_SAFE_FOOD_TOPIC_IDS = new Set([
    'vegan_panettone',
    'plant_based_cooking',
    'meal_prep_planning',
    'protein_science',
    'macronutrient_science',
    'micronutrient_science',
    'supplements',
    'fat_loss_basics',
    'muscle_gain_basics',
]);
const VEGAN_SAFE_SOURCE_KIND_RE = /\b(plant_based|vegan|wfpb)\b/i;
const VEGAN_SAFE_POSITIVE_RE = /\b(vegan|plant[-\s]?based|wfpb|whole[-\s]?food[-\s]?plant[-\s]?based|dairy[-\s]?free|egg[-\s]?free|meat[-\s]?free|animal[-\s]?free|no dairy|no eggs|no meat|tofu|tempeh|seitan|lentils?|chickpeas?|beans?|legumes?|edamame|soy|pea protein|soy protein|hemp protein|algae omega|nutritional yeast)\b/i;
const VEGAN_SAFE_ANIMAL_PRODUCT_RE = /\b(whey|casein|collagen|gelatin|gelatine|dairy|milk|yogh?urt|greek yoghurt|greek yogurt|cheese|cottage cheese|egg|eggs|chicken|beef|steak|turkey|fish|salmon|tuna|prawn|prawns|shrimp|pork|bacon|ham|lamb|meat|bone broth|honey|animal protein|carnivore)\b/i;
const VEGAN_SAFE_SAFE_MILK_RE = /\b(?:soy|soya|almond|oat|coconut|rice|cashew|hemp|pea|plant[-\s]?based|vegan|dairy[-\s]?free|non[-\s]?dairy)\s+milk\b/gi;
const VEGAN_SAFE_SAFE_CHEESE_RE = /\b(?:vegan|plant[-\s]?based|dairy[-\s]?free|non[-\s]?dairy)\s+cheese\b/gi;
const VEGAN_SAFE_NUTRITION_CONTEXT_RE = /\b(food|meal|recipe|cook|cooking|prep|protein|macro|nutrition|diet|dieting|calorie|supplement|creatine|b12|iron|omega|fat loss|muscle gain|hypertrophy)\b/i;
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

function cleanStringArray(value, maxItems = 20, maxLength = 120) {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(list
        .map(item => cleanString(item, maxLength))
        .filter(Boolean))]
        .slice(0, maxItems);
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

function hasCoachRepliedSinceLastInbound(thread = {}) {
    const inboundMs = Date.parse(thread.last_inbound_at || '');
    const outboundMs = Date.parse(thread.last_outbound_at || '');
    return Number.isFinite(inboundMs) && Number.isFinite(outboundMs) && outboundMs > inboundMs;
}

function isLearningReelOutboundSource(source) {
    return /^learning_reel/i.test(cleanString(source, 180));
}

const LINK_HANDOFF_SOURCE_RE = /\b(comment|private[_\s-]?reply|giveaway|keyword|automation|auto[_\s-]?reply|ig[_\s-]?growth)\b/i;
const LINK_HANDOFF_URL_RE = /\bhttps?:\/\/(?:future-balance\.netlify\.app|(?:www\.)?plantbased-balance\.org)\/(?:bio(?:\.html)?|ig-system|dms|coaching(?:\.html)?|clients(?:\.html)?|vegan-challenge(?:\.html)?|transform-challenge(?:\.html)?)(?:[?#]\S*)?/i;
const LINK_HANDOFF_COPY_RE = /\b(here'?s\s+(?:that\s+)?(?:info|link)|using\s+chatgpt\s+for\s+your\s+instagram\s+content\s+system|reply\s+with\s+what\s+you\s+do|map\s+this\s+version\s+for\s+your\s+business|quick\s+challenge\/app\s+info|download\s+the\s+app|come\s+back\s+(?:and\s+)?chat)\b/i;

function isLinkHandoffOutboundText(text = '') {
    const value = cleanString(text, 4000);
    if (!value) return false;
    if (LINK_HANDOFF_URL_RE.test(value)) return true;
    return LINK_HANDOFF_COPY_RE.test(value) && /\b(?:link|info|reply|download|app|chatgpt|instagram|challenge)\b/i.test(value);
}

function isLearningReelGateEligibleOutbound(row = {}) {
    const source = cleanString(row.source, 180);
    const sourceWords = source.replace(/[_-]+/g, ' ');
    const text = cleanString(row.text, 4000);
    if (isLearningReelOutboundSource(source)) return false;
    if (LINK_HANDOFF_SOURCE_RE.test(sourceWords)) return false;
    if (isLinkHandoffOutboundText(text)) return false;
    if (youtubeVideoIdsFromText(text).length) return false;
    return Boolean(source || text);
}

async function hasNonLearningReelOutboundAfterLastInbound(thread = {}) {
    if (!hasCoachRepliedSinceLastInbound(thread)) return false;
    try {
        const rows = await supabase(
            `ig_messages?select=source,text,created_at&thread_id=eq.${encodeURIComponent(thread.id)}&direction=eq.out&created_at=gt.${encodeURIComponent(thread.last_inbound_at)}&order=created_at.desc&limit=20`
        );
        return (Array.isArray(rows) ? rows : []).some(isLearningReelGateEligibleOutbound);
    } catch (error) {
        console.warn('[learning-reel-drip] coach reply gate lookup failed:', error?.message || error);
        return false;
    }
}

async function loadTargetThread(handle) {
    const encoded = encodeURIComponent(`*${handle}*`);
    const select = 'id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,last_inbound_at,last_outbound_at,custom_data,goals,personal_context,running_notes,qualifier,auto_send_enabled';
    const rows = await supabase(
        `ig_threads?select=${select}&channel=eq.instagram&ig_username=ilike.${encoded}&order=last_inbound_at.desc.nullslast&limit=20`
    );
    const exact = rows.find(row => normalizeHandle(row.ig_username) === handle);
    return exact || rows[0] || null;
}

function envNumber(name, fallback, { min = -Infinity, max = Infinity } = {}) {
    const raw = getEnv(name).trim();
    const parsed = raw ? Number(raw) : NaN;
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, value));
}

function dynamicLeadDripsEnabled() {
    const raw = getEnv('LEARNING_REEL_DYNAMIC_LEADS_ENABLED');
    if (!raw) return true;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(raw.toLowerCase());
}

function clientPilotDripsEnabled() {
    const raw = getEnv('LEARNING_REEL_CLIENT_PILOTS_ENABLED');
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(raw.toLowerCase());
}

function dynamicLeadMaxThreadsPerRun() {
    return Math.floor(envNumber('LEARNING_REEL_DYNAMIC_LEAD_MAX_THREADS', DYNAMIC_LEAD_DEFAULT_MAX_THREADS, {
        min: 1,
        max: 50,
    }));
}

function dynamicLeadMinLastInboundHours() {
    return envNumber('LEARNING_REEL_DYNAMIC_LEAD_MIN_LAST_INBOUND_HOURS', DYNAMIC_LEAD_DEFAULT_MIN_LAST_INBOUND_HOURS, {
        min: 0,
        max: 23.9,
    });
}

function dynamicLeadMaxLastInboundHours() {
    return envNumber('LEARNING_REEL_DYNAMIC_LEAD_MAX_LAST_INBOUND_HOURS', DYNAMIC_LEAD_DEFAULT_MAX_LAST_INBOUND_HOURS, {
        min: 1,
        max: 24,
    });
}

function dynamicLeadMinQuietHours() {
    return envNumber('LEARNING_REEL_DYNAMIC_LEAD_MIN_QUIET_HOURS', DYNAMIC_LEAD_DEFAULT_MIN_QUIET_HOURS, {
        min: 0,
        max: 24,
    });
}

function latestThreadActivityMs(thread = {}) {
    return Math.max(
        Date.parse(thread.last_inbound_at || '') || 0,
        Date.parse(thread.last_outbound_at || '') || 0
    );
}

async function loadDynamicLeadThreads(nowMs = Date.now()) {
    const maxInboundHours = dynamicLeadMaxLastInboundHours();
    const minInboundHours = dynamicLeadMinLastInboundHours();
    const fromIso = new Date(nowMs - maxInboundHours * 60 * 60 * 1000).toISOString();
    const toIso = new Date(nowMs - minInboundHours * 60 * 60 * 1000).toISOString();
    const select = [
        'id',
        'subscriber_id',
        'coach_id',
        'channel',
        'ig_username',
        'profile_name',
        'lead_stage',
        'linked_user_id',
        'last_inbound_at',
        'last_outbound_at',
        'custom_data',
        'goals',
        'personal_context',
        'running_notes',
        'qualifier',
        'auto_send_enabled',
    ].join(',');
    const limit = dynamicLeadMaxThreadsPerRun();
    return supabase(
        `ig_threads?select=${select}&channel=eq.instagram&last_inbound_at=gte.${encodeURIComponent(fromIso)}&last_inbound_at=lte.${encodeURIComponent(toIso)}&order=last_inbound_at.asc&limit=${limit}`
    );
}

async function loadRecentThreadMessages(threadId, nowMs = Date.now()) {
    if (!threadId) return [];
    const sinceIso = new Date(nowMs - DYNAMIC_LEAD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    return supabase(
        `ig_messages?select=id,direction,text,source,created_at&thread_id=eq.${encodeURIComponent(threadId)}&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=80`
    ).catch(error => {
        console.warn('[learning-reel-drip] dynamic lead message lookup failed:', error?.message || error);
        return [];
    });
}

const DYNAMIC_LEAD_CLIENT_STAGE_RE = /\b(client|coaching|paid|starter|accepted|subscribed|subscription|member|customer)\b/i;
const DYNAMIC_LEAD_CLOSED_STAGE_RE = /\b(churned|lost|closed|dead|blocked|opted[_\s-]?out|do[_\s-]?not[_\s-]?contact)\b/i;

function isDynamicLeadStage(thread = {}) {
    const stage = cleanString(thread.lead_stage || '', 120).replace(/[_-]+/g, ' ');
    if (!stage) return true;
    if (DYNAMIC_LEAD_CLIENT_STAGE_RE.test(stage)) return false;
    if (DYNAMIC_LEAD_CLOSED_STAGE_RE.test(stage)) return false;
    return true;
}

async function hasActiveCoachClientForThread(thread = {}) {
    const clientId = cleanString(thread.linked_user_id || '', 120);
    if (!clientId) return false;
    try {
        const rows = await supabase(
            `coach_clients?select=client_id,status&client_id=eq.${encodeURIComponent(clientId)}&status=eq.active&limit=1`
        );
        return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
        console.warn('[learning-reel-drip] active client lookup failed:', error?.message || error);
        return true;
    }
}

const LEAD_REEL_TOPIC_RULES = [
    {
        topic_id: 'pelvic_tilt_balance',
        label: 'pelvic tilt / balance',
        re: /\b(pelvic tilt|anterior pelvic|posterior pelvic|pelvis|rib cage|centre of mass|center of mass|centre of gravity|center of gravity|posture|stacked)\b/i,
        priority: 96,
    },
    {
        topic_id: 'core_training_technique',
        label: 'core technique',
        re: /\b(core|abs?|brace|bracing|dead bug|plank|trunk|anti[-\s]?extension|neutral spine)\b/i,
        priority: 92,
    },
    {
        topic_id: 'weight_training_technique',
        label: 'lifting technique',
        re: /\b(squat|deadlift|rdl|hinge|bench|press|row|lunge|split squat|hip thrust|glute bridge|form|technique|gym)\b/i,
        priority: 84,
    },
    {
        topic_id: 'plant_based_cooking',
        label: 'plant-based food',
        re: /\b(vegan|plant[-\s]?based|tofu|tempeh|lentils?|chickpeas?|beans?|recipe|cook|cooking|meal ideas?)\b/i,
        priority: 78,
    },
    {
        topic_id: 'meal_prep_planning',
        label: 'meal prep',
        re: /\b(meal prep|meal planning|batch cook|weekly meals?|food prep|go[-\s]?to meal|routine eating)\b/i,
        priority: 76,
    },
    {
        topic_id: 'protein_science',
        label: 'protein',
        re: /\b(protein|plant protein|protein powder|amino|leucine|muscle protein)\b/i,
        priority: 75,
    },
    {
        topic_id: 'workout_motivation',
        label: 'training consistency',
        re: /\b(motivation|discipline|consistency|show up|getting back into it|routine|habit|stuck|fell off)\b/i,
        priority: 68,
    },
    {
        topic_id: 'recovery_sleep_energy',
        label: 'recovery',
        re: /\b(sleep|recovery|fatigue|tired|sore|doms|deload|energy|stress)\b/i,
        priority: 64,
    },
    {
        topic_id: 'fat_loss_basics',
        label: 'fat loss',
        re: /\b(fat loss|weight loss|lose weight|calorie deficit|dieting|leaner|drop weight)\b/i,
        priority: 62,
    },
    {
        topic_id: 'muscle_gain_basics',
        label: 'muscle growth',
        re: /\b(build muscle|muscle gain|hypertrophy|strength|stronger|progressive overload)\b/i,
        priority: 62,
    },
    {
        topic_id: 'bunny_reels',
        label: 'bunny reels',
        re: /\b(bunny|bunnies|rabbit|rabbits|free[-\s]?roam|sunshine)\b/i,
        priority: 50,
    },
];

const DYNAMIC_LEAD_PET_SOCIAL_CONTEXT_RE = /\b(dog|dogs|doggo|puppy|puppies|cat|cats|kitten|kittens|pet|pets|animal|animals|rabbit|rabbits|bunny|bunnies|horse|horses|zoomies?|full speed|open field|cute name|what(?:'s| is) (?:their|her|his) name)\b/i;
const DYNAMIC_LEAD_HEALTH_REEL_CONTEXT_RE = /\b(workout|workouts|gym|lift|lifting|squat|deadlift|bench|rdl|lunge|core|abs?|brace|bracing|protein|meal prep|meal plan|vegan|plant[-\s]?based|recipe|cook|cooking|calorie|fat loss|weight loss|muscle|hypertrophy|strength|sleep|recovery|sore|doms|deload|stress|fatigue|motivation|discipline|consistency|habit|routine)\b/i;

function compactLeadText(value, max = 7000) {
    return cleanString(value, max).replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, ' video ');
}

function leadConversationText(thread = {}, messages = []) {
    const customData = safeObject(thread.custom_data);
    const inboundText = messages
        .filter(message => message?.direction === 'in')
        .map(message => message.text)
        .join('\n');
    return compactLeadText([
        thread.lead_stage,
        thread.goals,
        thread.personal_context,
        thread.running_notes,
        veganContextText(thread.qualifier),
        veganContextText(customData.learning_interests),
        veganContextText(customData.lead_profile),
        veganContextText(customData.reel_preferences),
        inboundText,
    ].filter(Boolean).join('\n'));
}

function recentDynamicLeadContextMessages(messages = [], nowMs = Date.now()) {
    const maxAgeMs = DYNAMIC_LEAD_LATEST_CONTEXT_HOURS * 60 * 60 * 1000;
    return [...(Array.isArray(messages) ? messages : [])]
        .filter(message => cleanString(message?.text, 4000))
        .filter(message => !isLearningReelOutboundSource(message?.source || ''))
        .filter(message => !youtubeVideoIdsFromText(message?.text || '').length)
        .sort((a, b) => {
            const aMs = Date.parse(a?.created_at || '');
            const bMs = Date.parse(b?.created_at || '');
            return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
        })
        .filter(message => {
            const ts = Date.parse(message?.created_at || '');
            return !Number.isFinite(ts) || nowMs - ts <= maxAgeMs;
        })
        .slice(0, DYNAMIC_LEAD_LATEST_CONTEXT_MAX_MESSAGES)
        .reverse();
}

function dynamicLeadLatestContextText(messages = [], nowMs = Date.now()) {
    const recentMessages = recentDynamicLeadContextMessages(messages, nowMs);
    return compactLeadText(recentMessages.map(message => {
        const speaker = message?.direction === 'in' ? 'Lead' : 'Shannon';
        return `${speaker}: ${message.text}`;
    }).join('\n'), 2500);
}

function dynamicLeadLatestContextReview({ item = {}, messages = [], nowMs = Date.now() } = {}) {
    const itemTopic = cleanString(item.topic_id || item.topicId, 80);
    const recentMessages = recentDynamicLeadContextMessages(messages, nowMs);
    const contextText = dynamicLeadLatestContextText(recentMessages, nowMs);
    if (!itemTopic) {
        return { ok: false, blocker: 'latest_context_missing_plan_topic', context_text: contextText };
    }
    if (!contextText) {
        return { ok: false, blocker: 'latest_context_missing_recent_messages', context_text: '' };
    }

    if (itemTopic === PERSONAL_MUSIC_TOPIC_ID) {
        const songSignals = uniqueSongSignals(extractSongSignalsFromMessages(recentMessages));
        if (songSignals.length) {
            return { ok: true, topic_ids: [PERSONAL_MUSIC_TOPIC_ID], context_text: contextText };
        }
        return {
            ok: false,
            blocker: 'latest_context_topic_mismatch',
            topic_ids: [],
            expected_topic_id: itemTopic,
            context_text: contextText,
        };
    }

    const topicEntries = topicEntriesFromLeadText(contextText);
    const topicIds = [...new Set(topicEntries.map(entry => entry.topic_id).filter(Boolean))];
    const petSocialContext = DYNAMIC_LEAD_PET_SOCIAL_CONTEXT_RE.test(contextText)
        && !DYNAMIC_LEAD_HEALTH_REEL_CONTEXT_RE.test(contextText);
    if (petSocialContext) {
        if (itemTopic === 'bunny_reels' && topicIds.includes('bunny_reels')) {
            return { ok: true, topic_ids: topicIds, context_text: contextText };
        }
        return {
            ok: false,
            blocker: 'latest_context_pet_social_chat',
            topic_ids: topicIds,
            expected_topic_id: itemTopic,
            context_text: contextText,
        };
    }
    if (!topicIds.length) {
        return {
            ok: false,
            blocker: 'latest_context_no_reel_topic',
            topic_ids: [],
            expected_topic_id: itemTopic,
            context_text: contextText,
        };
    }
    if (!topicIds.includes(itemTopic)) {
        return {
            ok: false,
            blocker: 'latest_context_topic_mismatch',
            topic_ids: topicIds,
            expected_topic_id: itemTopic,
            context_text: contextText,
        };
    }
    return { ok: true, topic_ids: topicIds, context_text: contextText };
}

function stableShortHash(value = '') {
    const text = cleanString(value, 8000);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function normalizeSongSignal(value = '') {
    return cleanString(value, 140)
        .replace(/\b(original audio|audio original|official audio|official music video|lyrics?|sped up|slowed|remix)\b/gi, ' ')
        .replace(/[#"*_`]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[-:|•\s]+|[-:|•\s]+$/g, '')
        .trim();
}

function collectStoryMusicSignals(value, out = [], depth = 0) {
    if (!value || depth > 5 || out.length >= 8) return out;
    if (Array.isArray(value)) {
        for (const item of value) collectStoryMusicSignals(item, out, depth + 1);
        return out;
    }
    if (typeof value !== 'object') return out;
    const label = normalizeSongSignal(value.story_music_label || value.storyMusicLabel || '');
    const title = normalizeSongSignal(value.story_music_title || value.storyMusicTitle || '');
    const artist = normalizeSongSignal(value.story_music_artist || value.storyMusicArtist || '');
    const combined = normalizeSongSignal(label || [artist, title].filter(Boolean).join(' '));
    if (combined && !/^(?:music|audio|song)$/i.test(combined)) {
        out.push({
            label: combined,
            source: 'story_music',
            evidence: {
                story_id: value.story_id || value.storyId || null,
                story_url: value.story_url || value.storyUrl || null,
                story_music_label: label || null,
                story_music_artist: artist || null,
                story_music_title: title || null,
            },
        });
    }
    for (const [key, item] of Object.entries(value)) {
        if (/token|secret|password|credential|signature/i.test(key)) continue;
        collectStoryMusicSignals(item, out, depth + 1);
    }
    return out;
}

function extractSongSignalsFromMessages(messages = []) {
    const signals = [];
    const inbound = messages
        .filter(message => message?.direction === 'in')
        .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
    const patterns = [
        /\b(?:i\s+)?(?:love|like|liked|am into|i'?m into|obsessed with|favourite|favorite)\s+(?:the\s+)?(?:song|track|tune|audio|music)\s+(?:called\s+|named\s+|is\s+|was\s+)?["']?([^"'\n.!?]{2,90})/i,
        /\b(?:song|track|tune|audio)\s+(?:called|named|is|was)\s+["']?([^"'\n.!?]{2,90})/i,
        /\b(?:love|like|liked|obsessed with)\s+["']([^"']{2,90})["']\s+(?:as\s+)?(?:a\s+)?(?:song|track|tune|audio)?/i,
    ];
    for (const message of inbound) {
        const text = cleanString(message.text, 1000);
        for (const pattern of patterns) {
            const match = text.match(pattern);
            const label = normalizeSongSignal(match?.[1] || '');
            if (!label || /\b(?:song|track|music|audio|this|that|it)\b$/i.test(label)) continue;
            signals.push({
                label,
                source: 'inbound_message',
                evidence: {
                    message_id: message.id || null,
                    created_at: message.created_at || null,
                    text: truncate(text, 220),
                },
            });
            break;
        }
        if (signals.length >= 3) break;
    }
    return signals;
}

function songSearchQueries(songLabel = '') {
    const song = normalizeSongSignal(songLabel);
    if (!song) return [];
    return [
        `${song} shorts`,
        `${song} fitness shorts`,
        `${song} workout shorts`,
        `${song} reels`,
    ];
}

function uniqueSongSignals(signals = []) {
    const seen = new Set();
    const out = [];
    for (const signal of signals) {
        const label = normalizeSongSignal(signal?.label || '');
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        out.push({ ...signal, label });
    }
    return out;
}

function topicEntriesFromLeadText(text = '') {
    const hits = LEAD_REEL_TOPIC_RULES
        .map(rule => {
            const match = compactLeadText(text).match(rule.re);
            if (!match) return null;
            return {
                topic_id: rule.topic_id,
                topic_label: learningTopicLabel(rule.topic_id),
                signal_label: rule.label,
                evidence: { matched_text: truncate(match[0], 120) },
                score: rule.priority,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
    const seen = new Set();
    return hits.filter(hit => {
        if (seen.has(hit.topic_id)) return false;
        seen.add(hit.topic_id);
        return true;
    }).slice(0, 4).map(({ score, ...entry }) => entry);
}

function buildDynamicLeadReelConfig(thread = {}, messages = [], nowMs = Date.now()) {
    const customData = safeObject(thread.custom_data);
    const songSignals = uniqueSongSignals([
        ...extractSongSignalsFromMessages(messages),
        ...collectStoryMusicSignals(customData),
    ]);
    const text = leadConversationText(thread, messages);
    const topicEntries = topicEntriesFromLeadText(text);
    const planTopics = [
        ...songSignals.slice(0, 2).map(signal => ({
            topic_id: PERSONAL_MUSIC_TOPIC_ID,
            topic_label: PERSONAL_MUSIC_TOPIC_LABEL,
            search_queries: songSearchQueries(signal.label),
            open_search: true,
            caption_mode: 'song',
            intent: 'song',
            signal_label: `song: ${signal.label}`,
            evidence: signal.evidence,
        })),
        ...topicEntries,
    ].filter(entry => entry.search_queries?.length || LEARNING_REEL_TOPIC_LABELS[entry.topic_id]);

    if (!planTopics.length) return null;

    const veganSafety = resolveVeganSafetyRequirement(thread);
    const signature = stableShortHash(JSON.stringify({
        planTopics: planTopics.map(entry => ({
            topic_id: entry.topic_id,
            search_queries: entry.search_queries || [],
            signal_label: entry.signal_label || '',
        })),
        vegan_safe_required: veganSafety.required,
    }));
    const label = firstString([thread.profile_name, thread.ig_username, 'Lead']);
    return {
        id: DYNAMIC_LEAD_DRIP_ID,
        label,
        handle: thread.ig_username || '',
        revision: `${DYNAMIC_LEAD_DRIP_REVISION}_${signature}`,
        interval_ms: CLIENT_PILOT_INTERVAL_MS,
        total_sends: DYNAMIC_LEAD_TOTAL_SENDS,
        plan_topics: planTopics,
        vegan_safe_required: veganSafety.required,
        vegan_safety_reasons: veganSafety.required ? veganSafety.reasons : [],
        review_before_send: false,
        dynamic_lead_drip: true,
        skip_when_window_closed: true,
        max_sends_per_7_days: DYNAMIC_LEAD_WEEKLY_CAP,
        min_last_inbound_hours: dynamicLeadMinLastInboundHours(),
        max_last_inbound_hours: dynamicLeadMaxLastInboundHours(),
        min_quiet_hours_since_last_activity: dynamicLeadMinQuietHours(),
        built_from_conversation_at: new Date(nowMs).toISOString(),
    };
}

async function dynamicLeadThreadSkipReason(thread = {}, nowMs = Date.now()) {
    if (!thread?.id) return 'missing_thread';
    if (isAiAutomationOptedOut(thread)) return 'ai_automation_opt_out';
    if (thread.linked_user_id && await isTestAccount(thread.linked_user_id)) return 'test_account';
    if (!isDynamicLeadStage(thread)) return 'not_lead_stage';
    if (await hasActiveCoachClientForThread(thread)) return 'active_coach_client';
    const graph = resolveThreadGraph(thread);
    if (!graph.recipientId || !graph.accountId) return 'graph_recipient_or_account_missing';
    const lastInboundHours = hoursSinceIso(thread.last_inbound_at, nowMs);
    if (lastInboundHours === null) return 'no_last_inbound';
    if (lastInboundHours < dynamicLeadMinLastInboundHours()) return 'too_recent_since_inbound';
    if (lastInboundHours > dynamicLeadMaxLastInboundHours()) return 'standard_24h_messaging_window_closed';
    const latestActivity = latestThreadActivityMs(thread);
    const quietHours = latestActivity ? (nowMs - latestActivity) / (60 * 60 * 1000) : null;
    if (quietHours !== null && quietHours < dynamicLeadMinQuietHours()) return 'too_recent_since_latest_activity';
    if (!await hasNonLearningReelOutboundAfterLastInbound(thread)) return 'waiting_for_shannon_reply_after_latest_client_message';
    return '';
}

function veganContextText(value, depth = 0) {
    if (value == null || depth > 4) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return ` ${String(value)} `;
    }
    if (Array.isArray(value)) return value.map(item => veganContextText(item, depth + 1)).join(' ');
    if (typeof value === 'object') {
        return Object.entries(value)
            .filter(([key]) => !/token|secret|key|password|credential/i.test(key))
            .map(([key, item]) => ` ${key} ${veganContextText(item, depth + 1)} `)
            .join(' ');
    }
    return '';
}

function textHasVeganRequiredSignal(text) {
    const value = cleanString(text, 8000);
    if (!value) return false;
    if (/\b(not vegan|isn't vegan|isnt vegan|not plant[-\s]?based|omnivore|eats everything|eat everything)\b/i.test(value)) {
        return false;
    }
    return /\b(vegan|plant[-\s]?based|plantbased|whole[-\s]?food[-\s]?plant[-\s]?based|wfpb|plant_based_30|vegan_challenge|vegan challenge)\b/i.test(value);
}

function resolveVeganSafetyRequirement(thread = {}, linkedContext = {}) {
    const customData = safeObject(thread.custom_data);
    const drip = safeObject(customData.learning_reel_drip);
    const qualifier = safeObject(thread.qualifier || customData.qualifier);
    const reasons = [];

    if (customData.vegan_safe_required === true || drip.vegan_safe_required === true) {
        reasons.push('thread_flag');
    }
    if (qualifier.challenge_route === 'vegan') {
        reasons.push('qualifier_vegan_route');
    }

    const quizRows = Array.isArray(linkedContext.quizRows) ? linkedContext.quizRows : [];
    if (quizRows.some(row => /\b(vegan|plant[-_\s]?based|plantbased|wfpb)\b/i.test(veganContextText(row)))) {
        reasons.push('linked_quiz_diet');
    }

    const challengeRows = Array.isArray(linkedContext.challengeRows) ? linkedContext.challengeRows : [];
    if (challengeRows.some(row => /\b(plant_based_30|vegan[_\s-]?challenge|plant[-_\s]?based)\b/i.test(veganContextText(row)))) {
        reasons.push('plant_based_challenge');
    }

    const threadText = veganContextText({
        lead_stage: thread.lead_stage,
        goals: thread.goals,
        personal_context: thread.personal_context,
        running_notes: thread.running_notes,
        custom_data: {
            dietary_preference: customData.dietary_preference,
            dietary_requirements: customData.dietary_requirements,
            diet_type: customData.diet_type,
            onboarding: customData.onboarding,
            learning_interests: customData.learning_interests,
            lead_context: customData.lead_context,
        },
        qualifier,
    });
    if (textHasVeganRequiredSignal(threadText)) {
        reasons.push('thread_text_signal');
    }

    return {
        required: reasons.length > 0,
        reasons: [...new Set(reasons)],
    };
}

async function loadLinkedVeganContext(thread = {}) {
    const linkedUserId = cleanString(thread.linked_user_id, 120);
    if (!linkedUserId) return { quizRows: [], challengeRows: [] };
    const encoded = encodeURIComponent(linkedUserId);
    const [quizRows, challengeRows] = await Promise.all([
        supabase(`quiz_results?select=dietary_preference,created_at&user_id=eq.${encoded}&order=created_at.desc&limit=3`).catch(error => {
            console.warn('[learning-reel-drip] quiz vegan context lookup failed:', error.message);
            return [];
        }),
        supabase(`challenge_participants?select=status,challenge:challenges(cohort_type,name,is_system_cohort)&user_id=eq.${encoded}&limit=20`).catch(error => {
            console.warn('[learning-reel-drip] challenge vegan context lookup failed:', error.message);
            return [];
        }),
    ]);
    return { quizRows, challengeRows };
}

async function loadVeganSafetyRequirement(thread = {}) {
    const linkedContext = await loadLinkedVeganContext(thread);
    return resolveVeganSafetyRequirement(thread, linkedContext);
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

function learningTopicLabel(topicId) {
    if (topicId === PERSONAL_MUSIC_TOPIC_ID) return PERSONAL_MUSIC_TOPIC_LABEL;
    return LEARNING_REEL_TOPIC_LABELS[topicId] || topicId;
}

function normalizePlanTopicEntry(entry) {
    if (typeof entry === 'string') {
        const topicId = cleanString(entry, 100);
        if (!topicId) return null;
        return {
            topic_id: topicId,
            topic_label: learningTopicLabel(topicId),
        };
    }
    const source = safeObject(entry);
    const topicId = cleanString(source.topic_id || source.topicId || source.id || '', 100);
    if (!topicId) return null;
    const searchQueries = cleanStringArray(source.search_queries || source.searchQueries, 6, 180);
    return {
        topic_id: topicId,
        topic_label: cleanString(source.topic_label || source.topicLabel || source.label || learningTopicLabel(topicId), 120),
        search_queries: searchQueries.length ? searchQueries : undefined,
        open_search: source.open_search === true || source.openSearch === true || topicId === PERSONAL_MUSIC_TOPIC_ID || undefined,
        caption_mode: cleanString(source.caption_mode || source.captionMode || '', 80) || undefined,
        intent: cleanString(source.intent || '', 80) || undefined,
        signal_label: cleanString(source.signal_label || source.signalLabel || '', 160) || undefined,
        evidence: source.evidence || undefined,
    };
}

function planTopicEntriesForConfig(config = {}) {
    const raw = Array.isArray(config.plan_topics) && config.plan_topics.length
        ? config.plan_topics
        : (Array.isArray(config.topics) && config.topics.length ? config.topics : CLIENT_PILOT_TOPICS);
    const entries = raw.map(normalizePlanTopicEntry).filter(Boolean);
    return entries.length ? entries : CLIENT_PILOT_TOPICS.map(normalizePlanTopicEntry).filter(Boolean);
}

function clientPlanTopicSignature(entries = []) {
    return JSON.stringify(entries.map(entry => ({
        topic_id: entry.topic_id,
        search_queries: entry.search_queries || [],
        open_search: entry.open_search === true,
        caption_mode: entry.caption_mode || '',
        intent: entry.intent || '',
        signal_label: entry.signal_label || '',
    })));
}

function buildClientPilotPlan(config, nowMs = Date.now()) {
    const planTopics = planTopicEntriesForConfig(config);
    const intervalMs = Number(config.interval_ms || CLIENT_PILOT_INTERVAL_MS);
    const totalSends = Number(config.total_sends || CLIENT_PILOT_TOTAL_SENDS);
    return Array.from({ length: totalSends }, (_, index) => {
        const entry = planTopics[index % planTopics.length];
        const topicId = entry.topic_id;
        return {
            ...entry,
            index,
            topic_id: topicId,
            topic_label: entry.topic_label || learningTopicLabel(topicId),
            due_at: new Date(nowMs + (index * intervalMs)).toISOString(),
            status: 'pending',
        };
    });
}

function clientPilotRequiresVeganSafety(config = {}) {
    return config.vegan_safe_required !== false;
}

function clientPilotVeganSafetyReasons(config = {}) {
    if (!clientPilotRequiresVeganSafety(config)) return [];
    const configured = cleanStringArray(config.vegan_safety_reasons || config.veganSafetyReasons, 8, 120);
    return configured.length ? configured : ['client_pilot_vegan_food_only'];
}

function autostartAllowed(nowMs = Date.now()) {
    const explicit = getEnv('LEARNING_REEL_DRIP_AUTOSTART');
    if (explicit && !['1', 'true', 'yes', 'on'].includes(explicit.toLowerCase())) return false;
    const until = Date.parse(getEnv('LEARNING_REEL_DRIP_AUTOSTART_UNTIL') || DEFAULT_AUTOSTART_UNTIL);
    return Number.isFinite(until) && nowMs <= until;
}

function primaryDripWindowOpen(nowMs = Date.now()) {
    const explicit = getEnv('LEARNING_REEL_DRIP_AUTOSTART');
    if (explicit && !['1', 'true', 'yes', 'on'].includes(explicit.toLowerCase())) return false;
    const force = getEnv('LEARNING_REEL_DRIP_FORCE_ACTIVE');
    if (['1', 'true', 'yes', 'on'].includes(force.toLowerCase())) return true;
    const until = Date.parse(getEnv('LEARNING_REEL_DRIP_AUTOSTART_UNTIL') || DEFAULT_AUTOSTART_UNTIL);
    return Number.isFinite(until) && nowMs <= until;
}

function stopExpiredPrimaryDripState(existing = {}, nowMs = Date.now()) {
    const stoppedAt = new Date(nowMs).toISOString();
    return {
        ...existing,
        id: existing.id || DRIP_ID,
        status: 'stopped',
        stopped_reason: existing.stopped_reason || PRIMARY_DRIP_STOPPED_REASON,
        stopped_at: existing.stopped_at || stoppedAt,
        updated_at: stoppedAt,
        next_send_at: null,
    };
}

function normalizeDripState(thread, nowMs = Date.now()) {
    const customData = safeObject(thread.custom_data);
    const existing = safeObject(customData.learning_reel_drip);
    if (existing.id === DRIP_ID && Array.isArray(existing.plan)) {
        if (!['completed', 'stopped'].includes(existing.status) && !primaryDripWindowOpen(nowMs)) {
            return stopExpiredPrimaryDripState(existing, nowMs);
        }
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

function normalizeClientPilotState(thread, config, nowMs = Date.now()) {
    const customData = safeObject(thread.custom_data);
    const pilots = safeObject(customData.learning_reel_pilots);
    const existing = safeObject(pilots[config.id]);
    const intervalMs = Number(config.interval_ms || CLIENT_PILOT_INTERVAL_MS);
    const totalSends = Number(config.total_sends || CLIENT_PILOT_TOTAL_SENDS);
    const planTopics = planTopicEntriesForConfig(config);
    const topics = planTopics.map(entry => entry.topic_id);
    const planTopicSignature = clientPlanTopicSignature(planTopics);
    const veganSafeRequired = clientPilotRequiresVeganSafety(config);
    const veganSafetyReasons = clientPilotVeganSafetyReasons(config);
    if (existing.id === config.id && Array.isArray(existing.plan)) {
        const existingTopics = Array.isArray(existing.topics) ? existing.topics : [];
        const topicsChanged = existingTopics.join(',') !== topics.join(',');
        const planTopicsChanged = cleanString(existing.plan_topic_signature || '', 4000) !== planTopicSignature;
        if (
            existing.revision !== config.revision
            || Number(existing.interval_ms) !== intervalMs
            || Number(existing.total_sends) !== totalSends
            || topicsChanged
            || planTopicsChanged
        ) {
            const replannedAt = new Date(nowMs).toISOString();
            const plan = buildClientPilotPlan(config, nowMs);
            return {
                ...existing,
                status: existing.status === 'stopped' ? 'stopped' : 'active',
                revision: config.revision,
                previous_revision: existing.revision || null,
                previous_plan_count: existing.plan.length,
                replanned_at: replannedAt,
                updated_at: replannedAt,
                next_send_at: plan[0]?.due_at || null,
                interval_ms: intervalMs,
                total_sends: totalSends,
                topics,
                plan_topic_signature: planTopicSignature,
                vegan_safe_required: veganSafeRequired,
                vegan_safety_reasons: veganSafetyReasons,
                pilot_label: config.label,
                target_handle: config.handle,
                review_before_send: config.review_before_send === true,
                review_reason: config.review_reason || null,
                plan,
            };
        }
        return {
            ...existing,
            status: existing.status || 'active',
            revision: existing.revision || config.revision,
            interval_ms: Number(existing.interval_ms || intervalMs),
            total_sends: Number(existing.total_sends || totalSends),
            topics: existingTopics.length ? existingTopics : topics,
            plan_topic_signature: existing.plan_topic_signature || planTopicSignature,
            vegan_safe_required: veganSafeRequired,
            vegan_safety_reasons: veganSafetyReasons,
            pilot_label: existing.pilot_label || config.label,
            target_handle: existing.target_handle || config.handle,
            review_before_send: config.review_before_send === true,
            review_reason: config.review_reason || existing.review_reason || null,
            plan: existing.plan,
        };
    }

    const startedAt = new Date(nowMs).toISOString();
    const plan = buildClientPilotPlan(config, nowMs);
    return {
        id: config.id,
        status: 'active',
        revision: config.revision,
        target_handle: config.handle,
        pilot_label: config.label,
        bot_account: COCOS_BOT_ACCOUNT,
        algorithm_fork: COCOS_ALGORITHM_FORK,
        started_at: startedAt,
        updated_at: startedAt,
        next_send_at: plan[0]?.due_at || null,
        interval_ms: intervalMs,
        total_sends: totalSends,
        topics,
        plan_topic_signature: planTopicSignature,
        vegan_safe_required: veganSafeRequired,
        vegan_safety_reasons: veganSafetyReasons,
        require_coach_reply_after_inbound: true,
        review_before_send: config.review_before_send === true,
        review_reason: config.review_reason || null,
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

function respacePendingPlanItems(state, startMs = Date.now(), intervalMs = CLIENT_PILOT_INTERVAL_MS) {
    const pending = (Array.isArray(state.plan) ? state.plan : [])
        .filter(item => item && item.status === 'pending')
        .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
    const dueByIndex = new Map(pending.map((item, position) => [
        item.index,
        new Date(startMs + ((position + 1) * intervalMs)).toISOString(),
    ]));
    const plan = (Array.isArray(state.plan) ? state.plan : []).map(item => (
        dueByIndex.has(item.index) ? { ...item, due_at: dueByIndex.get(item.index) } : item
    ));
    const nextMs = nextPendingSendAt({ ...state, plan });
    return {
        ...state,
        plan,
        next_send_at: nextMs ? new Date(nextMs).toISOString() : null,
    };
}

function updateClientPilotPlanItem(state, index, patch, nowMs = Date.now()) {
    const plan = Array.isArray(state.plan) ? state.plan : [];
    const updatedPlan = plan.map(item => item.index === index ? { ...item, ...patch } : item);
    const complete = !updatedPlan.some(item => item.status === 'pending');
    const next = {
        ...state,
        status: complete ? 'completed' : 'active',
        paused_reason: null,
        updated_at: new Date(nowMs).toISOString(),
        completed_at: complete ? new Date(nowMs).toISOString() : state.completed_at || null,
        plan: updatedPlan,
    };
    if (complete) return { ...next, next_send_at: null };
    return respacePendingPlanItems(next, nowMs, Number(state.interval_ms || CLIENT_PILOT_INTERVAL_MS));
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

function applyClientPilotThreadCustomData(customData, graph, config, state) {
    const base = safeObject(customData);
    const currentGraph = safeObject(base.instagram_graph);
    const pilots = safeObject(base.learning_reel_pilots);
    const veganSafeRequired = clientPilotRequiresVeganSafety(config);
    return {
        ...base,
        bot_account: base.bot_account || COCOS_BOT_ACCOUNT,
        algorithm_fork: base.algorithm_fork || COCOS_ALGORITHM_FORK,
        vegan_safe_required: veganSafeRequired || base.vegan_safe_required === true || undefined,
        learning_reel_pilots: {
            ...pilots,
            [config.id]: state,
        },
        instagram_graph: {
            ...currentGraph,
            bot_account: currentGraph.bot_account || COCOS_BOT_ACCOUNT,
            algorithm_fork: currentGraph.algorithm_fork || COCOS_ALGORITHM_FORK,
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
        auto_send_enabled: false,
        custom_data: customData,
        ...extraPatch,
    };
    await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=minimal',
    });
    thread.custom_data = customData;
    thread.auto_send_enabled = patch.auto_send_enabled === true;
    if (extraPatch.last_outbound_at) thread.last_outbound_at = extraPatch.last_outbound_at;
    return thread;
}

async function persistClientPilotState(thread, config, state, extraPatch = {}) {
    const graph = resolveThreadGraph(thread);
    const customData = applyClientPilotThreadCustomData(thread.custom_data, graph, config, state);
    const patch = {
        auto_send_enabled: false,
        custom_data: customData,
        ...extraPatch,
    };
    await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=minimal',
    });
    thread.custom_data = customData;
    thread.auto_send_enabled = patch.auto_send_enabled === true;
    if (extraPatch.last_outbound_at) thread.last_outbound_at = extraPatch.last_outbound_at;
    return thread;
}

function normalizeVideoId(value) {
    return cleanString(value, 120).toLowerCase();
}

function sentVideoIdsFromState(state) {
    return new Set([
        ...(Array.isArray(state.sent) ? state.sent : []).map(item => item?.video_id),
        ...(Array.isArray(state.plan) ? state.plan : []).map(item => item?.video_id),
    ].map(normalizeVideoId).filter(Boolean));
}

function youtubeVideoIdsFromText(value) {
    const text = cleanString(value, 8000);
    const matches = [];
    const patterns = [
        /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/gi,
        /youtube\.com\/watch\?[^#\s]*\bv=([A-Za-z0-9_-]{6,})/gi,
        /youtu\.be\/([A-Za-z0-9_-]{6,})/gi,
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text))) {
            const videoId = cleanString(match[1], 120);
            if (videoId) matches.push({ videoId, index: match.index });
        }
    }
    const ids = [];
    const seen = new Set();
    for (const match of matches.sort((a, b) => a.index - b.index)) {
        const key = normalizeVideoId(match.videoId);
        if (seen.has(key)) continue;
        seen.add(key);
        ids.push(match.videoId);
    }
    return ids;
}

async function loadRecentOutboundLearningReelVideoIds(threadId, limit = 100) {
    if (!threadId) return new Set();
    try {
        const rows = await supabase(
            `ig_messages?select=text,source,created_at&thread_id=eq.${encodeURIComponent(threadId)}&direction=eq.out&order=created_at.desc&limit=${limit}`
        );
        return new Set((Array.isArray(rows) ? rows : [])
            .flatMap(row => youtubeVideoIdsFromText(row?.text))
            .map(normalizeVideoId)
            .filter(Boolean));
    } catch (error) {
        console.warn('[learning-reel-drip] could not load recent outbound reel ids:', error?.message || error);
        return new Set();
    }
}

function sourceDiversityKey(value) {
    return cleanString(value, 180)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function learningReelSourceKey(item = {}) {
    return sourceDiversityKey(
        item.source_id
        || item.sourceId
        || item.channel_id
        || item.channelId
        || item.channel_title
        || item.channelTitle
        || item.channel
        || item.source
        || ''
    );
}

function learningReelTimestampMs(item = {}) {
    const ts = Date.parse(
        item.sent_at
        || item.sentAt
        || item.created_at
        || item.createdAt
        || item.updated_at
        || item.updatedAt
        || ''
    );
    return Number.isFinite(ts) ? ts : 0;
}

function collectLearningReelItems(value, output = [], depth = 0) {
    if (!value || depth > 3) return output;
    if (Array.isArray(value)) {
        for (const item of value) collectLearningReelItems(item, output, depth + 1);
        return output;
    }
    if (typeof value !== 'object') return output;

    if (
        value.video_id
        || value.videoId
        || value.url
        || value.channel_title
        || value.channelTitle
        || value.source_id
        || value.sourceId
    ) {
        output.push(value);
    }

    for (const key of ['history', 'items', 'recent', 'sent', 'reels', 'videos', 'learning_reels', 'learningReels']) {
        if (value[key]) collectLearningReelItems(value[key], output, depth + 1);
    }
    return output;
}

function recentLearningReelSourceKeys(thread = {}, state = {}, limit = RECENT_SOURCE_MIX_WINDOW) {
    const customData = safeObject(thread.custom_data);
    const drip = safeObject(customData.learning_reel_drip);
    const items = [
        ...collectLearningReelItems(Array.isArray(state.sent) ? state.sent : []),
        ...collectLearningReelItems((Array.isArray(state.plan) ? state.plan : []).filter(item => item?.status === 'sent')),
        ...collectLearningReelItems(drip.sent),
        ...collectLearningReelItems((Array.isArray(drip.plan) ? drip.plan : []).filter(item => item?.status === 'sent')),
        ...collectLearningReelItems(customData.learning_reels),
        ...collectLearningReelItems(customData.learningReels),
        ...collectLearningReelItems(customData.learning_reel_context),
        ...collectLearningReelItems(customData.learningReelContext),
    ];
    const seen = new Set();
    return items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => learningReelSourceKey(item))
        .sort((a, b) => {
            const delta = learningReelTimestampMs(b.item) - learningReelTimestampMs(a.item);
            return delta || b.index - a.index;
        })
        .filter(({ item }) => {
            const identity = normalizeVideoId(item.video_id || item.videoId || item.url || `${learningReelSourceKey(item)}:${learningReelTimestampMs(item)}`);
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
        })
        .map(({ item }) => learningReelSourceKey(item))
        .slice(0, Math.max(1, limit));
}

function shouldDeferCandidateForSourceMix(candidate = {}, recentSourceKeys = []) {
    const key = learningReelSourceKey(candidate);
    if (!key) return false;
    const recent = recentSourceKeys.slice(0, RECENT_SOURCE_MIX_WINDOW);
    if (recent[0] === key) return true;
    return recent.filter(sourceKey => sourceKey === key).length >= MAX_RECENT_SAME_SOURCE;
}

function recentLearningReelSendCount(thread = {}, state = {}, nowMs = Date.now(), windowMs = 7 * 24 * 60 * 60 * 1000) {
    const customData = safeObject(thread.custom_data);
    const pilots = safeObject(customData.learning_reel_pilots);
    const items = [
        ...collectLearningReelItems(Array.isArray(state.sent) ? state.sent : []),
        ...collectLearningReelItems((Array.isArray(state.plan) ? state.plan : []).filter(item => item?.status === 'sent')),
        ...collectLearningReelItems(customData.learning_reels),
        ...collectLearningReelItems(customData.learningReels),
        ...Object.values(pilots).flatMap(pilot => collectLearningReelItems(safeObject(pilot).sent)),
        ...Object.values(pilots).flatMap(pilot => collectLearningReelItems((Array.isArray(safeObject(pilot).plan) ? safeObject(pilot).plan : []).filter(item => item?.status === 'sent'))),
    ];
    const cutoff = nowMs - windowMs;
    const seen = new Set();
    return items.filter(item => {
        const ts = learningReelTimestampMs(item);
        if (!ts || ts < cutoff || ts > nowMs + 60 * 1000) return false;
        const identity = normalizeVideoId(item.video_id || item.videoId || item.url || `${learningReelSourceKey(item)}:${ts}`);
        if (identity && seen.has(identity)) return false;
        if (identity) seen.add(identity);
        return true;
    }).length;
}

function clientPilotTimingBlocker(thread = {}, config = {}, nowMs = Date.now()) {
    const lastInboundHours = hoursSinceIso(thread.last_inbound_at, nowMs);
    if (lastInboundHours === null) {
        return { blocker: 'no_last_inbound', nextMs: nowMs + PAUSE_RECHECK_MS };
    }
    const maxLastInbound = Number(config.max_last_inbound_hours || 0);
    if (maxLastInbound > 0 && lastInboundHours > maxLastInbound) {
        return { blocker: 'standard_24h_messaging_window_closed', nextMs: nowMs + PAUSE_RECHECK_MS };
    }
    const minLastInbound = Number(config.min_last_inbound_hours || 0);
    if (minLastInbound > 0 && lastInboundHours < minLastInbound) {
        return {
            blocker: 'waiting_for_reel_window',
            nextMs: Date.parse(thread.last_inbound_at || '') + minLastInbound * 60 * 60 * 1000,
        };
    }
    const minQuietHours = Number(config.min_quiet_hours_since_last_activity || 0);
    if (minQuietHours > 0) {
        const latestActivity = latestThreadActivityMs(thread);
        const quietHours = latestActivity ? (nowMs - latestActivity) / (60 * 60 * 1000) : null;
        if (quietHours !== null && quietHours < minQuietHours) {
            return {
                blocker: 'waiting_for_quiet_window',
                nextMs: latestActivity + minQuietHours * 60 * 60 * 1000,
            };
        }
    }
    return null;
}

function veganSafetyTextForCandidate(candidate = {}) {
    return [
        candidate.title,
        candidate.description,
        candidate.channelTitle,
        candidate.channel_title,
        candidate.query,
        candidate.youtube_query,
        ...(Array.isArray(candidate.tags) ? candidate.tags : []),
    ].map(value => cleanString(value, 1000)).filter(Boolean).join(' ');
}

function stripVeganSafeAnimalProductPhrases(text) {
    return cleanString(text, 8000)
        .replace(VEGAN_SAFE_SAFE_MILK_RE, ' plant drink ')
        .replace(VEGAN_SAFE_SAFE_CHEESE_RE, ' plant slice ')
        .replace(/\b(?:vegan|plant[-\s]?based|dairy[-\s]?free|non[-\s]?dairy)\s+yogh?urt\b/gi, ' plant cultured food ')
        .replace(/\b(?:vegan|plant[-\s]?based|egg[-\s]?free)\s+eggs?\b/gi, ' plant scramble ')
        .replace(/\b(?:vegan|plant[-\s]?based|meat[-\s]?free)\s+(?:meat|chicken|beef|pork|bacon|ham|fish|tuna|salmon)\b/gi, ' vegan protein ');
}

function candidateHasAnimalProductSignal(candidate = {}) {
    const text = stripVeganSafeAnimalProductPhrases(veganSafetyTextForCandidate(candidate));
    return VEGAN_SAFE_ANIMAL_PRODUCT_RE.test(text);
}

function candidateHasVeganPositiveSignal(candidate = {}) {
    return VEGAN_SAFE_POSITIVE_RE.test(veganSafetyTextForCandidate(candidate));
}

function isPlantBasedSourceCandidate(candidate = {}) {
    return VEGAN_SAFE_SOURCE_KIND_RE.test(candidate.source_kind || candidate.sourceKind || '');
}

function isFoodOrNutritionCandidate(candidate = {}, topicId = candidate.topic_id || candidate.topicId || '') {
    const topic = cleanString(topicId, 100);
    if (VEGAN_SAFE_FOOD_TOPIC_IDS.has(topic)) return true;
    return VEGAN_SAFE_NUTRITION_CONTEXT_RE.test(veganSafetyTextForCandidate(candidate));
}

function assessCandidateVeganSafety(candidate = {}, context = {}) {
    if (!context.required) {
        return { required: false, status: 'not_required', reasons: [] };
    }

    const reasons = [];
    const topicId = candidate.topic_id || candidate.topicId || context.topicId || context.topic_id || '';
    if (candidateHasAnimalProductSignal(candidate)) {
        return {
            required: true,
            status: 'unsafe',
            reasons: ['animal_product_signal'],
        };
    }

    if (isPlantBasedSourceCandidate(candidate)) {
        reasons.push('plant_based_source');
    }
    if (candidateHasVeganPositiveSignal(candidate)) {
        reasons.push('vegan_metadata_signal');
    }

    const foodOrNutrition = isFoodOrNutritionCandidate(candidate, topicId);
    if (foodOrNutrition && !reasons.length) {
        return {
            required: true,
            status: 'unknown',
            reasons: ['food_or_nutrition_without_vegan_signal'],
        };
    }

    if (!foodOrNutrition) {
        reasons.push('non_food_topic_no_animal_signal');
    }

    return {
        required: true,
        status: 'safe',
        reasons: [...new Set(reasons)],
    };
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
    const tags = cleanStringArray(snippet.tags || detailSnippet.tags || searchSnippet.tags, 30, 120);
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
        tags,
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

function scoreOpenSearchLearningReelCandidate(candidate = {}, { item = {}, topicId = '' } = {}) {
    const text = [
        candidate.title,
        candidate.description,
        candidate.channel_title,
        candidate.query,
    ].map(value => cleanString(value, 1000)).join(' ');
    if (LEARNING_REEL_BLOCKLIST_RE?.test?.(text)) return -1000;
    const durationSec = Number(candidate.duration_seconds || candidate.durationSec || 0);
    if (durationSec && (durationSec < 8 || durationSec > 240)) return -1000;

    let score = topicId === PERSONAL_MUSIC_TOPIC_ID ? 62 : 54;
    const signalLabel = cleanString(item.signal_label || item.signalLabel || '', 180)
        .replace(/^song:\s*/i, '')
        .trim();
    const signalWords = signalLabel
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word.length >= 3)
        .slice(0, 8);
    const lower = text.toLowerCase();
    if (signalWords.length) {
        const matchedWords = signalWords.filter(word => lower.includes(word)).length;
        score += matchedWords * 12;
        if (matchedWords >= Math.min(2, signalWords.length)) score += 16;
    }
    if (/\b(shorts?|reels?|clip|dance|trend|workout|training|fitness)\b/i.test(text)) score += 8;
    if (durationSec >= 10 && durationSec <= 90) score += 18;
    else if (durationSec > 90 && durationSec <= 150) score += 8;
    const views = Number(candidate.view_count || candidate.viewCount || 0);
    if (views > 1000000) score += 14;
    else if (views > 100000) score += 10;
    else if (views > 10000) score += 5;
    return score;
}

async function findReelForTopic({
    topicId,
    item: planItem = {},
    thread,
    state,
    veganSafetyRequirement = { required: false, reasons: [] },
    existingVideoIds = new Set(),
}) {
    const customQueries = cleanStringArray(planItem.search_queries || planItem.searchQueries, MAX_SEARCH_QUERIES, 180);
    const openSearch = planItem.open_search === true || planItem.openSearch === true || topicId === PERSONAL_MUSIC_TOPIC_ID;
    const queries = (customQueries.length
        ? customQueries
        : buildCuratedLearningReelQueries(topicId, { perSource: 1 })
    )
        .map(query => (/\bshorts?\b/i.test(query) ? query : `${query} shorts`))
        .slice(0, MAX_SEARCH_QUERIES);
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
    const existingSentIds = new Set([
        ...sentVideoIdsFromState(state),
        ...[...(existingVideoIds || [])].map(normalizeVideoId).filter(Boolean),
    ]);
    let duplicateRejectedCount = 0;
    let veganRejectedCount = 0;
    let sourceMixDeferredCount = 0;
    const veganRejectedSamples = [];
    const recentSourceKeys = recentLearningReelSourceKeys(thread, state);
    const eligibleCandidates = rawCandidates.map(({ query, item: rawItem }) => {
        const detail = details.get(rawItem?.id?.videoId) || {};
        const candidate = candidateFromResult(rawItem, detail, topicId, query);
        const veganSafety = assessCandidateVeganSafety(candidate, {
            required: veganSafetyRequirement.required,
            topicId,
        });
        return {
            ...candidate,
            caption_mode: planItem.caption_mode || undefined,
            intent: planItem.intent || undefined,
            signal_label: planItem.signal_label || undefined,
            personalization_evidence: planItem.evidence || undefined,
            vegan_safety: veganSafety,
            score: openSearch
                ? scoreOpenSearchLearningReelCandidate(candidate, { item: planItem, topicId })
                : scoreCuratedLearningReelCandidate(candidate, topicId),
        };
    }).filter(candidate => {
        if (!candidate.video_id) return false;
        if (existingSentIds.has(normalizeVideoId(candidate.video_id))) {
            duplicateRejectedCount += 1;
            return false;
        }
        if (candidate.score < 0) return false;
        if (candidate.duration_seconds && candidate.duration_seconds > 240) return false;
        if (veganSafetyRequirement.required && candidate.vegan_safety?.status !== 'safe') {
            veganRejectedCount += 1;
            if (veganRejectedSamples.length < 5) {
                veganRejectedSamples.push({
                    video_id: candidate.video_id,
                    title: candidate.title,
                    channel_title: candidate.channel_title,
                    status: candidate.vegan_safety?.status || 'unknown',
                    reasons: candidate.vegan_safety?.reasons || [],
                });
            }
            return false;
        }
        const normalized = normalizeLearningReelItems([candidate], {
            source: SOURCE,
            platform: 'youtube',
        });
        const threadDuplicates = findDuplicateLearningReels(thread, normalized);
        if (threadDuplicates.length) {
            duplicateRejectedCount += 1;
            return false;
        }
        return true;
    });
    const sourceMixedCandidates = eligibleCandidates.filter(candidate => {
        const defer = shouldDeferCandidateForSourceMix(candidate, recentSourceKeys);
        if (defer) sourceMixDeferredCount += 1;
        return !defer;
    });
    const candidates = (sourceMixedCandidates.length ? sourceMixedCandidates : eligibleCandidates)
        .sort((a, b) => b.score - a.score);

    return {
        candidate: candidates[0] || null,
        raw_count: rawCandidates.length,
        duplicate_rejected_count: duplicateRejectedCount,
        source_mix_deferred_count: sourceMixedCandidates.length ? sourceMixDeferredCount : 0,
        vegan_rejected_count: veganRejectedCount,
        vegan_rejected_samples: veganRejectedSamples,
    };
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

const COOKING_COPY_TOPIC_IDS = new Set(['vegan_panettone', 'plant_based_cooking', 'meal_prep_planning']);
const PRACTICAL_COOKING_RE = /\b(recipe|cook|cooking|make|made|bake|baked|baking|panettone|roast|roasted|fry|fried|airfry|air fry|blend|blended|chop|chopped|salad|tofu|tempeh|lentil|beans?|chickpea|curry|dahl|dal|pasta|soup|sandwich|wrap|bowl|oats|smoothie|sauce|dressing|cucumber|breakfast|lunch|dinner|snack)\b/i;
const SCIENCE_EXPLAINER_RE = /\b(absorb|absorption|study|science|research|evidence|myth|explained|how much|how many|can you|grams?|per meal|one meal|muscle protein synthesis|protein timing)\b/i;

function isPracticalCookingReel(topicId, topicText) {
    if (!COOKING_COPY_TOPIC_IDS.has(topicId)) return false;
    if (SCIENCE_EXPLAINER_RE.test(topicText) && !PRACTICAL_COOKING_RE.test(topicText)) return false;
    return PRACTICAL_COOKING_RE.test(topicText);
}

function cookingMessage(reel, itemIndex = 0) {
    const options = [
        'ok this looks yum',
        'this looks good',
        'would eat this',
        'this looks worth trying',
        'yum, this one',
    ];
    return options[messageVariantIndex(reel, itemIndex, options.length)];
}

function musicMessage(reel, itemIndex = 0) {
    const options = [
        'this came up with that song',
        'this has your song on it',
        'saw this with that song',
        'this song made me think of you',
    ];
    return options[messageVariantIndex(reel, itemIndex, options.length)];
}

function buildMessageOpener(reel, itemIndex = 0) {
    const topicId = cleanString(reel?.topic_id || reel?.topicId, 80);
    const topicLabel = cleanString(reel?.topic_label || reel?.topicLabel, 120).toLowerCase();
    const topicText = `${topicId} ${topicLabel} ${reel?.title || ''}`.toLowerCase();
    const optionsByTopic = (() => {
        if (topicId === PERSONAL_MUSIC_TOPIC_ID || reel?.intent === 'song' || reel?.caption_mode === 'song') {
            return null;
        }
        if (isPracticalCookingReel(topicId, topicText)) {
            return null;
        }
        if (/technique|weight_training|athlean|squat|deadlift|bench|form|training/.test(topicText)) {
            return [
                'good little technique one',
                'worth saving this one',
                'this one is useful',
                'good one for later',
            ];
        }
        if (/motivation/.test(topicText)) {
            return [
                'tiny hype watch',
                'save this for later',
                'good little training boost',
                'this one is good',
            ];
        }
        if (/protein/.test(topicText)) {
            if (/\b(absorb|absorption|per meal|one meal|muscle protein synthesis|protein timing)\b/.test(topicText)) {
                return [
                    'this is interesting',
                    'worth a look',
                    'good little protein one',
                    'this one is useful',
                ];
            }
            return [
                'good little protein one',
                'this is interesting',
                'worth a look',
                'this one is useful',
            ];
        }
        if (/macro|micro|nutrition|supplement/.test(topicText)) {
            return [
                'good little nutrition one',
                'this is interesting',
                'worth a look',
                'this one is useful',
            ];
        }
        if (/mindset|neuro|brain|behaviour|behavior|longevity/.test(topicText)) {
            return [
                'worth a look',
                'this one is interesting',
                'interesting little watch',
                'this is interesting',
            ];
        }
        return [
            'this is interesting',
            'worth a look',
            'quick one for later',
            'saved this one for you',
        ];
    })();
    if (!optionsByTopic) {
        if (topicId === PERSONAL_MUSIC_TOPIC_ID || reel?.intent === 'song' || reel?.caption_mode === 'song') {
            return musicMessage(reel, itemIndex);
        }
        return cookingMessage(reel, itemIndex);
    }
    return optionsByTopic[messageVariantIndex(reel, itemIndex, optionsByTopic.length)];
}

function buildVisibleMessage(reel, itemIndex = 0) {
    const opener = buildMessageOpener(reel, itemIndex);
    return normalizeCoachDraftText(`${opener}\n${reel.url}`).trim();
}

function buildClientPilotVisibleMessage(reel, itemIndex = 0, config = {}, item = {}) {
    const captionMode = item.caption_mode || item.captionMode || reel?.caption_mode || config.caption_mode;
    if (captionMode === 'url_only') {
        return normalizeCoachDraftText(reel?.url || '').trim();
    }
    return buildVisibleMessage(reel, itemIndex);
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

async function sendDueReel({ thread, state, item, nowMs = Date.now(), veganSafetyRequirement = { required: false, reasons: [] } }) {
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

    if (!await hasNonLearningReelOutboundAfterLastInbound(thread)) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'waiting_for_shannon_reply_after_latest_client_message',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
            last_inbound_at: thread.last_inbound_at || null,
            last_outbound_at: thread.last_outbound_at || null,
        });
        await persistThreadState(thread, next);
        return { sent: false, blocker: 'waiting_for_shannon_reply_after_latest_client_message', state: next };
    }

    const recentOutboundVideoIds = await loadRecentOutboundLearningReelVideoIds(thread.id);
    const reelResult = await findReelForTopic({
        topicId: item.topic_id,
        item,
        thread,
        state,
        veganSafetyRequirement,
        existingVideoIds: recentOutboundVideoIds,
    });
    const reel = reelResult.candidate;
    if (!reel) {
        let skipReason = 'no_curated_candidate';
        if (reelResult.duplicate_rejected_count > 0) {
            skipReason = 'no_non_duplicate_candidate';
        } else if (veganSafetyRequirement.required && reelResult.vegan_rejected_count > 0) {
            skipReason = 'no_vegan_safe_candidate';
        }
        const next = updatePlanItem(state, item.index, {
            status: `skipped_${skipReason}`,
            skipped_at: new Date(nowMs).toISOString(),
            vegan_safe_required: veganSafetyRequirement.required || undefined,
            vegan_safety_reasons: veganSafetyRequirement.reasons || undefined,
        });
        next.skipped = [
            ...(Array.isArray(state.skipped) ? state.skipped : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                skipped_at: new Date(nowMs).toISOString(),
                reason: skipReason,
                vegan_safe_required: veganSafetyRequirement.required || undefined,
                vegan_safety_reasons: veganSafetyRequirement.reasons || undefined,
                duplicate_rejected_count: reelResult.duplicate_rejected_count || undefined,
                vegan_rejected_count: reelResult.vegan_rejected_count || undefined,
                vegan_rejected_samples: reelResult.vegan_rejected_samples || undefined,
            },
        ].slice(-30);
        await persistThreadState(thread, next);
        return { sent: false, blocker: skipReason, state: next };
    }

    const latestOutboundVideoIds = await loadRecentOutboundLearningReelVideoIds(thread.id);
    if (latestOutboundVideoIds.has(normalizeVideoId(reel.video_id))) {
        const skippedAt = new Date(nowMs).toISOString();
        const next = updatePlanItem(state, item.index, {
            status: 'skipped_duplicate_reel',
            skipped_at: skippedAt,
            video_id: reel.video_id,
            title: reel.title,
            channel_title: reel.channel_title,
            url: reel.url,
            duplicate_source: 'ig_messages_pre_send',
        });
        next.skipped = [
            ...(Array.isArray(state.skipped) ? state.skipped : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                skipped_at: skippedAt,
                reason: 'duplicate_learning_reel',
                duplicate_source: 'ig_messages_pre_send',
                video_id: reel.video_id,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
            },
        ].slice(-30);
        await persistThreadState(thread, next);
        return { sent: false, blocker: 'duplicate_learning_reel', state: next };
    }

    const message = buildVisibleMessage(reel, item.index);
    const alertResult = await createManualLearningReelNeedsYouAlert({
        thread,
        config: {
            id: DRIP_ID,
            label: thread.profile_name || thread.ig_username || DEFAULT_TARGET_HANDLE,
            handle: thread.ig_username || DEFAULT_TARGET_HANDLE,
        },
        item,
        reel,
        message,
        blocker: LEARNING_REEL_APPROVAL_REASON,
        nowMs,
        manualRequired: false,
    });
    const reviewedAt = new Date(nowMs).toISOString();
    let nextState = updatePlanItem(state, item.index, {
        status: 'manual_review_created',
        manual_review_at: reviewedAt,
        manual_alert_id: alertResult.alertId || null,
        manual_alert_deduped: alertResult.deduped || undefined,
        video_id: reel.video_id,
        title: reel.title,
        source_id: reel.source_id,
        source_kind: reel.source_kind,
        channel_title: reel.channel_title,
        channel_id: reel.channel_id,
        url: reel.url,
        suggested_message: message,
        review_reason: LEARNING_REEL_APPROVAL_REASON,
        vegan_safe_required: veganSafetyRequirement.required || undefined,
        vegan_safety: reel.vegan_safety || undefined,
    });
    nextState = {
        ...nextState,
        status: 'paused',
        paused_reason: null,
        next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        manual_reviews: [
            ...(Array.isArray(state.manual_reviews) ? state.manual_reviews : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                created_at: reviewedAt,
                manual_alert_id: alertResult.alertId || null,
                manual_alert_deduped: alertResult.deduped || false,
                reason: LEARNING_REEL_APPROVAL_REASON,
                video_id: reel.video_id,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
                suggested_message: message,
            },
        ].slice(-40),
    };

    await persistThreadState(thread, nextState, { auto_send_enabled: false });
    return {
        sent: false,
        blocker: LEARNING_REEL_APPROVAL_REASON,
        state: nextState,
        reel: {
            topic_id: item.topic_id,
            topic_label: item.topic_label,
            title: reel.title,
            channel_title: reel.channel_title,
            url: reel.url,
            description: truncate(reel.description || '', 260),
            vegan_safety: reel.vegan_safety || null,
        },
        manual_alert_id: alertResult.alertId || null,
        manual_alert_deduped: alertResult.deduped || false,
    };
}

function buildClientPilotReelPayload({ reel, item, config, message, nowIso }) {
    const veganSafeRequired = clientPilotRequiresVeganSafety(config);
    return {
        ...reel,
        content_type: 'learning_reel',
        platform: 'youtube',
        proposed_at: nowIso,
        topic_id: item.topic_id,
        topic_label: item.topic_label || reel.topic_label,
        sent_message: message,
        source: SOURCE,
        pilot_id: config.id,
        pilot_label: config.label,
        vegan_safe_required: veganSafeRequired || undefined,
        vegan_safety: reel.vegan_safety || undefined,
    };
}

async function createManualLearningReelNeedsYouAlert({
    thread,
    config = {},
    item,
    reel,
    message,
    blocker,
    nowMs = Date.now(),
    manualRequired = true,
}) {
    const nowIso = new Date(nowMs).toISOString();
    const graph = resolveThreadGraph(thread);
    const clientName = firstString([thread.profile_name, config.label, thread.ig_username, config.handle]) || 'Client';
    const approvalReason = blocker || LEARNING_REEL_APPROVAL_REASON;
    const permanentDraftOnly = isAlwaysNeedsYouPerson({
        name: clientName,
        client_name: clientName,
        profile_name: thread.profile_name,
        ig_username: thread.ig_username,
        username: thread.ig_username,
    });
    const reelPayload = buildClientPilotReelPayload({ reel, item, config, message, nowIso });
    const idempotencyKey = [
        manualRequired ? 'learning_reel_manual_needs_you' : 'learning_reel_approval_needs_you',
        config.id || DRIP_ID,
        thread.id,
        item.index,
        reel.video_id || youtubeVideoIdsFromText(reel.url || '')[0] || reel.url || reel.title || nowIso,
    ].map(part => cleanString(part, 180).replace(/\s+/g, '_')).join(':');
    const needsYouReasons = [
        approvalReason,
        LEARNING_REEL_APPROVAL_REASON,
        manualRequired ? 'learning_reel_manual_send_required' : '',
        permanentDraftOnly ? 'always_needs_you_person' : '',
    ].filter(Boolean);
    const alertRow = {
        client_id: thread.linked_user_id || null,
        client_name: clientName,
        coach_id: thread.coach_id || null,
        alert_type: 'ig_incoming_dm',
        priority: manualRequired ? 'medium' : 'high',
        title: manualRequired
            ? `Send ${clientName} this learning reel manually`
            : `Review YouTube reel for ${clientName}`,
        description: manualRequired
            ? `${clientName} is outside the Instagram messaging window. Suggested reel: ${truncate(reel.title || reel.url || 'learning reel', 180)}`
            : `${item.topic_label || reel.topic_label || 'YouTube Short'}: ${truncate(reel.title || reel.url || 'learning reel', 180)}`,
        suggested_message: message || reel.url || null,
        status: 'pending',
        data: {
            channel: 'instagram',
            delivery_channel: 'instagram_graph',
            client_manager_review_required: true,
            needs_you_required: true,
            operator_queue: 'needs_you',
            needs_you_reason: approvalReason,
            needs_you_reasons: needsYouReasons,
            needs_you_label: 'Watch the YouTube reel before sending',
            permanent_needs_you_draft_only: permanentDraftOnly,
            manual_ig_required: manualRequired || undefined,
            manual_reason: manualRequired ? approvalReason : undefined,
            manual_ig_handle: manualRequired ? (thread.ig_username || config.handle || null) : undefined,
            ig_thread_id: thread.id,
            ig_username: thread.ig_username || config.handle || null,
            ig_graph_recipient_id: graph.recipientId || undefined,
            ig_graph_account_id: graph.accountId || undefined,
            instagram_graph: {
                ig_graph_user_id: graph.recipientId || null,
                ig_account_id: graph.accountId || null,
                send_ready: !!graph.recipientId,
            },
            bot_account: COCOS_BOT_ACCOUNT,
            algorithm_fork: COCOS_ALGORITHM_FORK,
            message_preview: truncate(message || reel.url || '', 400),
            draft_text: message || reel.url || '',
            draft_messages: message ? [message] : [],
            auto_send_enabled_at_draft: false,
            auto_send_stopped: true,
            outbound_attempted: false,
            learning_reel_approval_required: true,
            learning_reel_preview_required: true,
            learning_reel_source: SOURCE,
            learning_reel: reelPayload,
            learning_reels: {
                recent: [reelPayload],
                last_sent: reelPayload,
                items: [reelPayload],
                manual_send_required: manualRequired || undefined,
                approval_required: true,
            },
            learning_reel_manual_send: {
                required: manualRequired,
                reason: approvalReason,
                pilot_id: config.id || DRIP_ID,
                pilot_label: config.label,
                topic_id: item.topic_id,
                topic_label: item.topic_label || reel.topic_label || null,
                title: reel.title || null,
                channel_title: reel.channel_title || null,
                url: reel.url || null,
                video_id: reel.video_id || null,
                suggested_message: message || reel.url || '',
                created_at: nowIso,
            },
            auto_send_review_hold: {
                code: LEARNING_REEL_APPROVAL_REASON,
                label: 'YouTube reel must be watched before sending',
                held_at: nowIso,
            },
            codex_review: {
                source: SOURCE,
                decision: 'needs_you_learning_reel_approval',
                queue: 'needs_you',
                needs_shannon_approval: true,
                reason: approvalReason,
                evidence_ids: [
                    thread.id ? `ig_threads:${thread.id}` : '',
                    thread.linked_user_id ? `users:${thread.linked_user_id}` : '',
                    reel.video_id ? `youtube:${reel.video_id}` : '',
                ].filter(Boolean),
                reviewed_at: nowIso,
                automation_id: SOURCE,
            },
        },
    };

    try {
        return await insertCoachAlert(alertRow, idempotencyKey);
    } catch (error) {
        console.warn('[learning-reel-drip] manual Needs You alert insert failed:', error?.message || error);
        return { alertId: null, deduped: false, error: error?.message || String(error) };
    }
}

async function sendDueClientPilotReel({ thread, config, state, item, nowMs = Date.now(), messages = null }) {
    const graph = resolveThreadGraph(thread);
    if (!graph.recipientId || !graph.accountId) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'graph_recipient_or_account_missing',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: 'graph_recipient_or_account_missing', state: next };
    }

    const weeklyCap = Number(config.max_sends_per_7_days || 0);
    if (weeklyCap > 0 && recentLearningReelSendCount(thread, state, nowMs) >= weeklyCap) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'weekly_learning_reel_cap_reached',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: 'weekly_learning_reel_cap_reached', state: next };
    }

    if (config.dynamic_lead_drip === true || config.skip_when_window_closed === true) {
        const timingBlock = clientPilotTimingBlocker(thread, config, nowMs);
        if (timingBlock) {
            const nextMs = Number.isFinite(timingBlock.nextMs) && timingBlock.nextMs > nowMs
                ? timingBlock.nextMs
                : nowMs + PAUSE_RECHECK_MS;
            const next = patchState(state, {
                status: 'paused',
                paused_reason: timingBlock.blocker,
                last_inbound_hours: hoursSinceIso(thread.last_inbound_at, nowMs),
                next_send_at: new Date(nextMs).toISOString(),
            });
            await persistClientPilotState(thread, config, next);
            return { sent: false, blocker: timingBlock.blocker, state: next };
        }
    }

    if (config.dynamic_lead_drip === true) {
        const contextMessages = Array.isArray(messages) ? messages : await loadRecentThreadMessages(thread.id, nowMs);
        const contextReview = dynamicLeadLatestContextReview({ item, messages: contextMessages, nowMs });
        if (!contextReview.ok) {
            const next = patchState(state, {
                status: 'paused',
                paused_reason: contextReview.blocker,
                latest_context_review: {
                    blocker: contextReview.blocker,
                    expected_topic_id: contextReview.expected_topic_id || item.topic_id,
                    topic_ids: contextReview.topic_ids || [],
                    context_text: truncate(contextReview.context_text || '', 500),
                    checked_at: new Date(nowMs).toISOString(),
                },
                next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
            });
            await persistClientPilotState(thread, config, next);
            return { sent: false, blocker: contextReview.blocker, state: next };
        }
    }

    const veganSafetyRequirement = {
        required: clientPilotRequiresVeganSafety(config),
        reasons: clientPilotVeganSafetyReasons(config),
    };
    const recentOutboundVideoIds = await loadRecentOutboundLearningReelVideoIds(thread.id);
    const reelResult = await findReelForTopic({
        topicId: item.topic_id,
        item,
        thread,
        state,
        veganSafetyRequirement,
        existingVideoIds: recentOutboundVideoIds,
    });
    const reel = reelResult.candidate;
    if (!reel) {
        let skipReason = 'no_curated_candidate';
        if (reelResult.duplicate_rejected_count > 0) {
            skipReason = 'no_non_duplicate_candidate';
        } else if (reelResult.vegan_rejected_count > 0) {
            skipReason = 'no_vegan_safe_candidate';
        }
        const skippedAt = new Date(nowMs).toISOString();
        const next = updateClientPilotPlanItem(state, item.index, {
            status: `skipped_${skipReason}`,
            skipped_at: skippedAt,
            vegan_safe_required: veganSafetyRequirement.required || undefined,
            vegan_safety_reasons: veganSafetyRequirement.reasons,
        }, nowMs);
        next.skipped = [
            ...(Array.isArray(state.skipped) ? state.skipped : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                skipped_at: skippedAt,
                reason: skipReason,
                vegan_safe_required: veganSafetyRequirement.required || undefined,
                vegan_safety_reasons: veganSafetyRequirement.reasons,
                duplicate_rejected_count: reelResult.duplicate_rejected_count || undefined,
                vegan_rejected_count: reelResult.vegan_rejected_count || undefined,
                vegan_rejected_samples: reelResult.vegan_rejected_samples || undefined,
            },
        ].slice(-30);
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: skipReason, state: next };
    }

    const latestOutboundVideoIds = await loadRecentOutboundLearningReelVideoIds(thread.id);
    if (latestOutboundVideoIds.has(normalizeVideoId(reel.video_id))) {
        const skippedAt = new Date(nowMs).toISOString();
        const next = updateClientPilotPlanItem(state, item.index, {
            status: 'skipped_duplicate_reel',
            skipped_at: skippedAt,
            video_id: reel.video_id,
            title: reel.title,
            source_id: reel.source_id,
            source_kind: reel.source_kind,
            channel_title: reel.channel_title,
            channel_id: reel.channel_id,
            url: reel.url,
            duplicate_source: 'ig_messages_pre_send',
        }, nowMs);
        next.skipped = [
            ...(Array.isArray(state.skipped) ? state.skipped : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                skipped_at: skippedAt,
                reason: 'duplicate_learning_reel',
                duplicate_source: 'ig_messages_pre_send',
                video_id: reel.video_id,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
            },
        ].slice(-30);
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: 'duplicate_learning_reel', state: next };
    }

    const message = buildClientPilotVisibleMessage(reel, item.index, config, item);
    const lastInboundHours = hoursSinceIso(thread.last_inbound_at, nowMs);
    if (lastInboundHours === null || lastInboundHours > 24) {
        const blocker = 'standard_24h_messaging_window_closed';
        const alertResult = await createManualLearningReelNeedsYouAlert({
            thread,
            config,
            item,
            reel,
            message,
            blocker,
            nowMs,
            manualRequired: true,
        });
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'standard_24h_messaging_window_closed_manual_needs_you_created',
            last_inbound_hours: lastInboundHours,
            pending_manual_alert_id: alertResult.alertId || state.pending_manual_alert_id || null,
            pending_manual_alert_deduped: alertResult.deduped || undefined,
            pending_manual_reel: {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                video_id: reel.video_id,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
                suggested_message: message,
                created_at: new Date(nowMs).toISOString(),
            },
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistClientPilotState(thread, config, next);
        return {
            sent: false,
            blocker,
            state: next,
            manual_alert_id: alertResult.alertId || null,
            manual_alert_deduped: alertResult.deduped || false,
            reel: {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
                description: truncate(reel.description || '', 260),
                vegan_safety: reel.vegan_safety || null,
            },
        };
    }

    if (!await hasNonLearningReelOutboundAfterLastInbound(thread)) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'waiting_for_shannon_reply_after_latest_client_message',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
            last_inbound_at: thread.last_inbound_at || null,
            last_outbound_at: thread.last_outbound_at || null,
        });
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: 'waiting_for_shannon_reply_after_latest_client_message', state: next };
    }

    if (config.review_before_send === true) {
        const blocker = config.review_reason || LEARNING_REEL_APPROVAL_REASON;
        const alertResult = await createManualLearningReelNeedsYouAlert({
            thread,
            config,
            item,
            reel,
            message,
            blocker,
            nowMs,
            manualRequired: false,
        });
        const reviewedAt = new Date(nowMs).toISOString();
        let next = updateClientPilotPlanItem(state, item.index, {
            status: 'manual_review_created',
            manual_review_at: reviewedAt,
            manual_alert_id: alertResult.alertId || null,
            manual_alert_deduped: alertResult.deduped || undefined,
            video_id: reel.video_id,
            title: reel.title,
            source_id: reel.source_id,
            source_kind: reel.source_kind,
            channel_title: reel.channel_title,
            channel_id: reel.channel_id,
            url: reel.url,
            suggested_message: message,
            review_reason: blocker,
            vegan_safe_required: veganSafetyRequirement.required || undefined,
            vegan_safety: reel.vegan_safety || undefined,
        }, nowMs);
        next = {
            ...next,
            manual_reviews: [
                ...(Array.isArray(state.manual_reviews) ? state.manual_reviews : []),
                {
                    topic_id: item.topic_id,
                    topic_label: item.topic_label,
                    created_at: reviewedAt,
                    manual_alert_id: alertResult.alertId || null,
                    manual_alert_deduped: alertResult.deduped || false,
                    reason: blocker,
                    video_id: reel.video_id,
                    title: reel.title,
                    channel_title: reel.channel_title,
                    url: reel.url,
                    suggested_message: message,
                },
            ].slice(-40),
        };
        await persistClientPilotState(thread, config, next);
        return {
            sent: false,
            blocker,
            state: next,
            manual_alert_id: alertResult.alertId || null,
            manual_alert_deduped: alertResult.deduped || false,
            reel: {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                title: reel.title,
                channel_title: reel.channel_title,
                url: reel.url,
                description: truncate(reel.description || '', 260),
                vegan_safety: reel.vegan_safety || null,
            },
        };
    }

    const { token, source: tokenSource } = await resolveMetaIgAccessToken(graph.accountId, supabase);
    if (!token) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'instagram_graph_token_missing',
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: 'instagram_graph_token_missing', state: next };
    }

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
        pilot_id: config.id,
        pilot_label: config.label,
        vegan_safe_required: veganSafetyRequirement.required || undefined,
        vegan_safety: reel.vegan_safety || undefined,
        graph_message_ids: graphMessageId ? [graphMessageId] : [],
        message_ids: messageId ? [messageId] : [],
    };
    let nextState = updateClientPilotPlanItem(state, item.index, {
        status: 'sent',
        sent_at: sentAt,
        video_id: reel.video_id,
        title: reel.title,
        source_id: reel.source_id,
        source_kind: reel.source_kind,
        channel_title: reel.channel_title,
        channel_id: reel.channel_id,
        url: reel.url,
        token_source: tokenSource,
        vegan_safe_required: veganSafetyRequirement.required || undefined,
        vegan_safety: reel.vegan_safety || undefined,
    }, nowMs);
    nextState = {
        ...nextState,
        sent: [
            ...(Array.isArray(state.sent) ? state.sent : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                sent_at: sentAt,
                video_id: reel.video_id,
                title: reel.title,
                source_id: reel.source_id,
                source_kind: reel.source_kind,
                channel_title: reel.channel_title,
                channel_id: reel.channel_id,
                url: reel.url,
                vegan_safe_required: veganSafetyRequirement.required || undefined,
                vegan_safety: reel.vegan_safety || undefined,
            },
        ].slice(-40),
    };

    const currentCustomData = applyClientPilotThreadCustomData(thread.custom_data, graph, config, nextState);
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
            vegan_safety: reel.vegan_safety || null,
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
    const veganSafetyRequirement = await loadVeganSafetyRequirement(thread);
    state = {
        ...state,
        vegan_safe_required: veganSafetyRequirement.required || undefined,
        vegan_safety_reasons: veganSafetyRequirement.reasons || undefined,
        vegan_safety_checked_at: new Date(nowMs).toISOString(),
    };
    await persistThreadState(thread, state);
    if (state.status === 'not_started') {
        return { ok: true, target_handle: handle, status: state.status, reason: state.reason };
    }
    if (state.status === 'completed' || state.status === 'stopped') {
        return { ok: true, target_handle: handle, status: state.status, next_send_at: state.next_send_at || null };
    }
    if (!sendDue) {
        return {
            ok: true,
            target_handle: handle,
            status: state.status,
            next_send_at: state.next_send_at || null,
            vegan_safe_required: veganSafetyRequirement.required,
            vegan_safety_reasons: veganSafetyRequirement.reasons,
            plan: state.plan,
        };
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

    const result = await sendDueReel({ thread, state, item: due, nowMs, veganSafetyRequirement });
    return {
        ok: true,
        target_handle: handle,
        due: true,
        sent: result.sent,
        blocker: result.blocker || null,
        status: result.state?.status || state.status,
        next_send_at: result.state?.next_send_at || null,
        vegan_safe_required: veganSafetyRequirement.required,
        vegan_safety_reasons: veganSafetyRequirement.reasons,
        reel: result.reel || null,
    };
}

async function runClientPilotDrip(config, { sendDue = true, nowMs = Date.now() } = {}) {
    const handle = normalizeHandle(config.handle);
    const thread = await loadTargetThread(handle);
    if (!thread) {
        return {
            ok: false,
            pilot_id: config.id,
            pilot_label: config.label,
            target_handle: handle,
            error: 'target_thread_not_found',
        };
    }

    return runClientPilotDripForThread(thread, config, { sendDue, nowMs });
}

async function runClientPilotDripForThread(thread, config, { sendDue = true, nowMs = Date.now(), messages = null } = {}) {
    const handle = normalizeHandle(config.handle || thread.ig_username || thread.profile_name || '');
    let state = normalizeClientPilotState(thread, config, nowMs);
    const veganSafetyRequirement = {
        required: clientPilotRequiresVeganSafety(config),
        reasons: clientPilotVeganSafetyReasons(config),
    };
    state = {
        ...state,
        vegan_safe_required: veganSafetyRequirement.required,
        vegan_safety_reasons: veganSafetyRequirement.reasons,
        vegan_safety_checked_at: new Date(nowMs).toISOString(),
    };
    await persistClientPilotState(thread, config, state);

    if (state.status === 'completed' || state.status === 'stopped') {
        return {
            ok: true,
            pilot_id: config.id,
            pilot_label: config.label,
            target_handle: handle,
            status: state.status,
            next_send_at: state.next_send_at || null,
        };
    }
    if (!sendDue) {
        return {
            ok: true,
            pilot_id: config.id,
            pilot_label: config.label,
            target_handle: handle,
            status: state.status,
            next_send_at: state.next_send_at || null,
            topics: state.topics,
            total_sends: state.total_sends,
            interval_ms: state.interval_ms,
            require_coach_reply_after_inbound: true,
            latest_inbound_has_non_learning_reel_outbound: await hasNonLearningReelOutboundAfterLastInbound(thread),
            plan: state.plan,
        };
    }
    if (shouldHoldPausedState(state, nowMs)) {
        return {
            ok: true,
            pilot_id: config.id,
            pilot_label: config.label,
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
        await persistClientPilotState(thread, config, state);
        return {
            ok: true,
            pilot_id: config.id,
            pilot_label: config.label,
            target_handle: handle,
            status: state.status,
            next_send_at: state.next_send_at,
            due: false,
        };
    }

    const result = await sendDueClientPilotReel({ thread, config, state, item: due, nowMs, messages });
    return {
        ok: true,
        pilot_id: config.id,
        pilot_label: config.label,
        target_handle: handle,
        due: true,
        sent: result.sent,
        blocker: result.blocker || null,
        status: result.state?.status || state.status,
        next_send_at: result.state?.next_send_at || null,
        manual_alert_id: result.manual_alert_id || null,
        manual_alert_deduped: result.manual_alert_deduped || false,
        vegan_safe_required: veganSafetyRequirement.required,
        vegan_safety_reasons: veganSafetyRequirement.reasons,
        reel: result.reel || null,
    };
}

async function runDynamicLeadDrips({ sendDue = true, nowMs = Date.now() } = {}) {
    if (!dynamicLeadDripsEnabled()) {
        return { enabled: false, scanned: 0, results: [], skipped: { disabled: 1 } };
    }
    const skipped = {};
    const bumpSkipped = reason => {
        const key = reason || 'unknown';
        skipped[key] = (skipped[key] || 0) + 1;
    };
    let threads = [];
    try {
        threads = await loadDynamicLeadThreads(nowMs);
    } catch (error) {
        console.warn('[learning-reel-drip] dynamic lead thread scan failed:', error?.message || error);
        return {
            enabled: true,
            scanned: 0,
            results: [],
            skipped: { thread_scan_failed: 1 },
            error: error?.message || String(error),
        };
    }

    const results = [];
    for (const thread of threads) {
        const skipReason = await dynamicLeadThreadSkipReason(thread, nowMs);
        if (skipReason) {
            bumpSkipped(skipReason);
            continue;
        }
        const messages = await loadRecentThreadMessages(thread.id, nowMs);
        const config = buildDynamicLeadReelConfig(thread, messages, nowMs);
        if (!config) {
            bumpSkipped('no_conversation_reel_profile');
            continue;
        }
        try {
            results.push(await runClientPilotDripForThread(thread, config, { sendDue, nowMs, messages }));
        } catch (error) {
            console.error(`[learning-reel-drip] dynamic lead drip failed for ${thread.ig_username || thread.id}:`, error);
            results.push({
                ok: false,
                pilot_id: DYNAMIC_LEAD_DRIP_ID,
                pilot_label: thread.profile_name || thread.ig_username || 'Lead',
                target_handle: thread.ig_username || null,
                ig_thread_id: thread.id,
                error: error.message || String(error),
            });
        }
    }

    return {
        enabled: true,
        scanned: threads.length,
        eligible: results.length,
        results,
        skipped,
    };
}

async function runClientPilotDrips({ sendDue = true, nowMs = Date.now() } = {}) {
    if (!clientPilotDripsEnabled()) return [];
    const results = [];
    for (const config of CLIENT_PILOT_TARGETS) {
        try {
            results.push(await runClientPilotDrip(config, { sendDue, nowMs }));
        } catch (error) {
            console.error(`[learning-reel-drip] client pilot failed for ${config.handle}:`, error);
            results.push({
                ok: false,
                pilot_id: config.id,
                pilot_label: config.label,
                target_handle: config.handle,
                error: error.message || String(error),
            });
        }
    }
    return results;
}

async function runAllDrips({ sendDue = true } = {}) {
    const nowMs = Date.now();
    const primary = await runDrip({ sendDue });
    const clientPilotsEnabled = clientPilotDripsEnabled();
    const clientPilots = await runClientPilotDrips({ sendDue, nowMs });
    const dynamicLeads = await runDynamicLeadDrips({ sendDue, nowMs });
    return {
        ...primary,
        client_pilots_enabled: clientPilotsEnabled,
        client_pilots: clientPilots,
        dynamic_lead_drips: dynamicLeads,
    };
}

export default async function handler(req) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { ok: false, error: 'Supabase env missing' });

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';
    const token = url.searchParams.get('token') || '';
    const expectedToken = getEnv('LEARNING_REEL_DRIP_TOKEN');

    if (!YOUTUBE_API_KEY) return json(500, { ok: false, error: 'YOUTUBE_API_KEY missing' });

    if (action === 'status' || action === 'dry_run') {
        if (!expectedToken || token !== expectedToken) return json(404, { ok: false, error: 'not_found' });
        const result = await runAllDrips({ sendDue: false });
        return json(result.ok === false ? 404 : 200, result);
    }

    try {
        const result = await runAllDrips({ sendDue: true });
        return json(result.ok === false ? 404 : 200, result);
    } catch (error) {
        console.error('[learning-reel-drip] failed:', error);
        return json(500, { ok: false, error: error.message || String(error) });
    }
}

export const _test = {
    applyCocosThreadCustomData,
    applyClientPilotThreadCustomData,
    assessCandidateVeganSafety,
    buildInitialPlan,
    buildClientPilotPlan,
    buildClientPilotReelPayload,
    buildClientPilotVisibleMessage,
    buildDynamicLeadReelConfig,
    buildVisibleMessage,
    candidateFromResult,
    clientPilotTimingBlocker,
    CLIENT_PILOT_INTERVAL_MS,
    CLIENT_PILOT_TARGETS,
    DYNAMIC_LEAD_DRIP_ID,
    dynamicLeadLatestContextReview,
    dynamicLeadLatestContextText,
    extractSongSignalsFromMessages,
    hasCoachRepliedSinceLastInbound,
    isDynamicLeadStage,
    isLearningReelGateEligibleOutbound,
    isLearningReelOutboundSource,
    isLinkHandoffOutboundText,
    learningReelSourceKey,
    nextDuePlanItem,
    normalizePlanTopicEntry,
    normalizeDripState,
    normalizeClientPilotState,
    recentLearningReelSourceKeys,
    recentLearningReelSendCount,
    respacePendingPlanItems,
    resolveVeganSafetyRequirement,
    resolveThreadGraph,
    scoreOpenSearchLearningReelCandidate,
    sentVideoIdsFromState,
    shouldDeferCandidateForSourceMix,
    shouldHoldPausedState,
    songSearchQueries,
    sourceDiversityKey,
    topicEntriesFromLeadText,
    updateClientPilotPlanItem,
    updatePlanItem,
    youtubeVideoIdsFromText,
};
