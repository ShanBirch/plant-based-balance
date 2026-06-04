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
const MAX_SEARCH_QUERIES = 8;
const MAX_SEARCH_RESULTS_PER_QUERY = 12;
const MAX_DETAIL_IDS = 50;
const RECENT_SOURCE_MIX_WINDOW = 8;
const MAX_RECENT_SAME_SOURCE = 2;
const CLIENT_PILOT_REVISION = 'vegan_food_3_per_week_v1';
const CLIENT_PILOT_INTERVAL_MS = Math.floor((7 * 24 * 60 * 60 * 1000) / 3);
const CLIENT_PILOT_TOTAL_SENDS = 12;
const CLIENT_PILOT_TOPICS = ['plant_based_cooking', 'meal_prep_planning'];
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
    },
].map(target => ({
    ...target,
    revision: CLIENT_PILOT_REVISION,
    interval_ms: CLIENT_PILOT_INTERVAL_MS,
    total_sends: CLIENT_PILOT_TOTAL_SENDS,
    topics: CLIENT_PILOT_TOPICS,
}));
const VEGAN_SAFE_FOOD_TOPIC_IDS = new Set([
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

async function hasNonLearningReelOutboundAfterLastInbound(thread = {}) {
    if (!hasCoachRepliedSinceLastInbound(thread)) return false;
    try {
        const rows = await supabase(
            `ig_messages?select=source,created_at&thread_id=eq.${encodeURIComponent(thread.id)}&direction=eq.out&created_at=gt.${encodeURIComponent(thread.last_inbound_at)}&order=created_at.desc&limit=20`
        );
        return (Array.isArray(rows) ? rows : []).some(row => !isLearningReelOutboundSource(row.source));
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

function buildClientPilotPlan(config, nowMs = Date.now()) {
    const topics = Array.isArray(config.topics) && config.topics.length ? config.topics : CLIENT_PILOT_TOPICS;
    const intervalMs = Number(config.interval_ms || CLIENT_PILOT_INTERVAL_MS);
    const totalSends = Number(config.total_sends || CLIENT_PILOT_TOTAL_SENDS);
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

function normalizeClientPilotState(thread, config, nowMs = Date.now()) {
    const customData = safeObject(thread.custom_data);
    const pilots = safeObject(customData.learning_reel_pilots);
    const existing = safeObject(pilots[config.id]);
    const intervalMs = Number(config.interval_ms || CLIENT_PILOT_INTERVAL_MS);
    const totalSends = Number(config.total_sends || CLIENT_PILOT_TOTAL_SENDS);
    const topics = Array.isArray(config.topics) && config.topics.length ? config.topics : CLIENT_PILOT_TOPICS;
    if (existing.id === config.id && Array.isArray(existing.plan)) {
        const existingTopics = Array.isArray(existing.topics) ? existing.topics : [];
        const topicsChanged = existingTopics.join(',') !== topics.join(',');
        if (
            existing.revision !== config.revision
            || Number(existing.interval_ms) !== intervalMs
            || Number(existing.total_sends) !== totalSends
            || topicsChanged
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
                vegan_safe_required: true,
                pilot_label: config.label,
                target_handle: config.handle,
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
            vegan_safe_required: true,
            pilot_label: existing.pilot_label || config.label,
            target_handle: existing.target_handle || config.handle,
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
        vegan_safe_required: true,
        vegan_safety_reasons: ['client_pilot_vegan_food_only'],
        require_coach_reply_after_inbound: true,
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
    return {
        ...base,
        bot_account: base.bot_account || COCOS_BOT_ACCOUNT,
        algorithm_fork: base.algorithm_fork || COCOS_ALGORITHM_FORK,
        vegan_safe_required: true,
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

async function persistClientPilotState(thread, config, state, extraPatch = {}) {
    const graph = resolveThreadGraph(thread);
    const customData = applyClientPilotThreadCustomData(thread.custom_data, graph, config, state);
    const patch = {
        custom_data: customData,
        ...extraPatch,
    };
    await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=minimal',
    });
    thread.custom_data = customData;
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

async function findReelForTopic({
    topicId,
    thread,
    state,
    veganSafetyRequirement = { required: false, reasons: [] },
    existingVideoIds = new Set(),
}) {
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
    const existingSentIds = new Set([
        ...sentVideoIdsFromState(state),
        ...[...(existingVideoIds || [])].map(normalizeVideoId).filter(Boolean),
    ]);
    let duplicateRejectedCount = 0;
    let veganRejectedCount = 0;
    let sourceMixDeferredCount = 0;
    const veganRejectedSamples = [];
    const recentSourceKeys = recentLearningReelSourceKeys(thread, state);
    const eligibleCandidates = rawCandidates.map(({ query, item }) => {
        const detail = details.get(item?.id?.videoId) || {};
        const candidate = candidateFromResult(item, detail, topicId, query);
        const veganSafety = assessCandidateVeganSafety(candidate, {
            required: veganSafetyRequirement.required,
            topicId,
        });
        return {
            ...candidate,
            vegan_safety: veganSafety,
            score: scoreCuratedLearningReelCandidate(candidate, topicId),
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

const COOKING_COPY_TOPIC_IDS = new Set(['plant_based_cooking', 'meal_prep_planning']);
const PRACTICAL_COOKING_RE = /\b(recipe|cook|cooking|make|made|bake|baked|roast|roasted|fry|fried|airfry|air fry|blend|blended|chop|chopped|salad|tofu|tempeh|lentil|beans?|chickpea|curry|dahl|dal|pasta|soup|sandwich|wrap|bowl|oats|smoothie|sauce|dressing|cucumber|breakfast|lunch|dinner|snack)\b/i;
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

function buildMessageOpener(reel, itemIndex = 0) {
    const topicId = cleanString(reel?.topic_id || reel?.topicId, 80);
    const topicLabel = cleanString(reel?.topic_label || reel?.topicLabel, 120).toLowerCase();
    const topicText = `${topicId} ${topicLabel} ${reel?.title || ''}`.toLowerCase();
    const optionsByTopic = (() => {
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

    const recentOutboundVideoIds = await loadRecentOutboundLearningReelVideoIds(thread.id);
    const reelResult = await findReelForTopic({
        topicId: item.topic_id,
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
        vegan_safe_required: veganSafetyRequirement.required || undefined,
        vegan_safety: reel.vegan_safety || undefined,
        graph_message_ids: graphMessageId ? [graphMessageId] : [],
        message_ids: messageId ? [messageId] : [],
    };
    let nextState = updatePlanItem(state, item.index, {
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
            vegan_safety: reel.vegan_safety || null,
        },
        graph_message_id: graphMessageId,
        message_id: messageId,
    };
}

async function sendDueClientPilotReel({ thread, config, state, item, nowMs = Date.now() }) {
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

    const lastInboundHours = hoursSinceIso(thread.last_inbound_at, nowMs);
    if (lastInboundHours === null || lastInboundHours > 24) {
        const next = patchState(state, {
            status: 'paused',
            paused_reason: 'standard_24h_messaging_window_closed_waiting_for_client_reply',
            last_inbound_hours: lastInboundHours,
            next_send_at: new Date(nowMs + PAUSE_RECHECK_MS).toISOString(),
        });
        await persistClientPilotState(thread, config, next);
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
        await persistClientPilotState(thread, config, next);
        return { sent: false, blocker: 'waiting_for_shannon_reply_after_latest_client_message', state: next };
    }

    const veganSafetyRequirement = {
        required: true,
        reasons: ['client_pilot_vegan_food_only'],
    };
    const recentOutboundVideoIds = await loadRecentOutboundLearningReelVideoIds(thread.id);
    const reelResult = await findReelForTopic({
        topicId: item.topic_id,
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
            vegan_safe_required: true,
            vegan_safety_reasons: veganSafetyRequirement.reasons,
        }, nowMs);
        next.skipped = [
            ...(Array.isArray(state.skipped) ? state.skipped : []),
            {
                topic_id: item.topic_id,
                topic_label: item.topic_label,
                skipped_at: skippedAt,
                reason: skipReason,
                vegan_safe_required: true,
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
        pilot_id: config.id,
        pilot_label: config.label,
        vegan_safe_required: true,
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
        vegan_safe_required: true,
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
                vegan_safe_required: true,
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

    let state = normalizeClientPilotState(thread, config, nowMs);
    state = {
        ...state,
        vegan_safe_required: true,
        vegan_safety_reasons: ['client_pilot_vegan_food_only'],
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

    const result = await sendDueClientPilotReel({ thread, config, state, item: due, nowMs });
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
        vegan_safe_required: true,
        vegan_safety_reasons: ['client_pilot_vegan_food_only'],
        reel: result.reel || null,
    };
}

async function runClientPilotDrips({ sendDue = true, nowMs = Date.now() } = {}) {
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
    const clientPilots = await runClientPilotDrips({ sendDue, nowMs });
    return {
        ...primary,
        client_pilots: clientPilots,
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
    buildVisibleMessage,
    candidateFromResult,
    CLIENT_PILOT_INTERVAL_MS,
    CLIENT_PILOT_TARGETS,
    hasCoachRepliedSinceLastInbound,
    isLearningReelOutboundSource,
    learningReelSourceKey,
    nextDuePlanItem,
    normalizeDripState,
    normalizeClientPilotState,
    recentLearningReelSourceKeys,
    respacePendingPlanItems,
    resolveVeganSafetyRequirement,
    resolveThreadGraph,
    sentVideoIdsFromState,
    shouldDeferCandidateForSourceMix,
    shouldHoldPausedState,
    sourceDiversityKey,
    updateClientPilotPlanItem,
    updatePlanItem,
    youtubeVideoIdsFromText,
};
