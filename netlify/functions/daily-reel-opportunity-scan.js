/**
 * Daily Reel Opportunity Scan
 *
 * Mines recent client conversations for one useful learning reel Shannon can
 * approve that day. This never sends directly. It creates a Needs You card with
 * the suggested caption, YouTube URL, reel metadata, and conversation evidence.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    truncate,
    normalizeLearningReelItems,
    findDuplicateLearningReels,
} = require('./_lib/client-context');
const {
    LEARNING_REEL_TOPIC_LABELS,
    buildCuratedLearningReelQueries,
    findCuratedLearningReelSource,
    getCuratedLearningReelSources,
    scoreCuratedLearningReelCandidate,
} = require('./_lib/learning-reel-sources');

const SOURCE = 'daily-reel-opportunity-scan';
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LOOKBACK_HOURS = Number(process.env.DAILY_REEL_RECENT_HOURS || 42);
const MAX_ALERTS_PER_RUN = Number(process.env.DAILY_REEL_MAX_ALERTS || 1);
const MAX_SEARCH_QUERIES = Number(process.env.DAILY_REEL_MAX_SEARCH_QUERIES || 6);
const MAX_SEARCH_RESULTS_PER_QUERY = Number(process.env.DAILY_REEL_MAX_SEARCH_RESULTS || 8);
const MAX_DETAIL_IDS = 50;
const COOLDOWN_DAYS = Number(process.env.DAILY_REEL_COOLDOWN_DAYS || 3);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const VEGAN_SAFE_SOURCE_KIND_RE = /\b(plant_based|vegan|wfpb)\b/i;
const VEGAN_SAFE_POSITIVE_RE = /\b(vegan|plant[-\s]?based|wfpb|whole[-\s]?food[-\s]?plant[-\s]?based|dairy[-\s]?free|egg[-\s]?free|meat[-\s]?free|animal[-\s]?free|no dairy|no eggs|no meat|tofu|tempeh|seitan|lentils?|chickpeas?|beans?|legumes?|edamame|soy|pea protein|soy protein|hemp protein|algae omega|nutritional yeast)\b/i;
const VEGAN_SAFE_ANIMAL_PRODUCT_RE = /\b(whey|casein|collagen|gelatin|gelatine|dairy|milk|yogh?urt|greek yoghurt|greek yogurt|cheese|cottage cheese|egg|eggs|chicken|beef|steak|turkey|fish|salmon|tuna|prawn|prawns|shrimp|pork|bacon|ham|lamb|meat|bone broth|honey|animal protein|carnivore)\b/i;
const VEGAN_SAFE_SAFE_MILK_RE = /\b(?:soy|soya|almond|oat|coconut|rice|cashew|hemp|pea|plant[-\s]?based|vegan|dairy[-\s]?free|non[-\s]?dairy)\s+milk\b/gi;
const VEGAN_SAFE_SAFE_CHEESE_RE = /\b(?:vegan|plant[-\s]?based|dairy[-\s]?free|non[-\s]?dairy)\s+cheese\b/gi;
const FOOD_TOPIC_IDS = new Set([
    'plant_based_cooking',
    'meal_prep_planning',
    'protein_science',
    'macronutrient_science',
    'micronutrient_science',
    'supplements',
    'fat_loss_basics',
    'muscle_gain_basics',
]);

const SIGNALS = [
    {
        id: 'front_squat_technique',
        topicId: 'weight_training_technique',
        priority: 96,
        re: /\bfront\s+squats?\b/i,
        searchPhrase: 'front squat technique',
        label: 'front squat technique',
        caption: 'this could help with front squats',
    },
    {
        id: 'squat_technique',
        topicId: 'weight_training_technique',
        priority: 84,
        re: /\b(?:back\s+squat|goblet\s+squat|squat\s+form|squats?)\b/i,
        searchPhrase: 'squat technique',
        label: 'squat technique',
        caption: 'this is a useful one for squat form',
    },
    {
        id: 'deadlift_technique',
        topicId: 'weight_training_technique',
        priority: 84,
        re: /\b(?:deadlift|rdl|romanian\s+deadlift|hinge)\b/i,
        searchPhrase: 'deadlift hinge technique',
        label: 'deadlift/hinge technique',
        caption: 'this is good for the hinge pattern',
    },
    {
        id: 'hip_thrust_glutes',
        topicId: 'weight_training_technique',
        priority: 82,
        re: /\b(?:hip\s+thrust|glute\s+bridge|glutes?|split\s+squat|bulgarian)\b/i,
        searchPhrase: 'glute exercise technique hip thrust split squat',
        label: 'glute technique',
        caption: 'save this for glute technique',
    },
    {
        id: 'core_bracing',
        topicId: 'core_training_technique',
        priority: 88,
        re: /\b(?:core|brace|bracing|dead\s+bug|plank|trunk|neutral\s+spine|abs?)\b/i,
        searchPhrase: 'core bracing technique',
        label: 'core/bracing',
        caption: 'this is a good one for bracing',
    },
    {
        id: 'pelvic_tilt_balance',
        topicId: 'pelvic_tilt_balance',
        priority: 92,
        re: /\b(?:posterior\s+pelvic\s+tilt|anterior\s+pelvic\s+tilt|pelvic\s+tilt|pelvis|centre\s+of\s+mass|center\s+of\s+mass|centre\s+of\s+gravity|center\s+of\s+gravity|rib\s+cage|stacked)\b/i,
        searchPhrase: 'pelvic tilt centre of mass',
        label: 'pelvic tilt / balance',
        caption: 'this explains the pelvis bit well',
    },
    {
        id: 'plant_based_meals',
        topicId: 'plant_based_cooking',
        priority: 78,
        re: /\b(?:vegan|plant[-\s]?based|tofu|tempeh|lentils?|chickpeas?|beans?|recipe|cooking|meal\s+ideas?)\b/i,
        searchPhrase: 'high protein vegan meal',
        label: 'plant-based meals',
        caption: 'would eat this',
    },
    {
        id: 'meal_prep_planning',
        topicId: 'meal_prep_planning',
        priority: 76,
        re: /\b(?:meal\s+prep|meal\s+planning|batch\s+cook|weekly\s+meals?|go[-\s]?to\s+meal|simple\s+meals?|routine\s+eating)\b/i,
        searchPhrase: 'vegan meal prep planning',
        label: 'meal prep',
        caption: 'this could be handy for food prep',
    },
    {
        id: 'protein_science',
        topicId: 'protein_science',
        priority: 80,
        re: /\b(?:protein|plant\s+protein|protein\s+powder|amino|leucine|muscle\s+protein)\b/i,
        searchPhrase: 'protein intake explained',
        label: 'protein',
        caption: 'this is a solid protein one',
    },
    {
        id: 'workout_motivation',
        topicId: 'workout_motivation',
        priority: 62,
        re: /\b(?:motivation|discipline|consistency|show\s+up|getting\s+back\s+into\s+it|first\s+session|routine)\b/i,
        searchPhrase: 'workout consistency motivation',
        label: 'workout motivation',
        caption: 'good one for the training mindset',
    },
    {
        id: 'mindset',
        topicId: 'mindset',
        priority: 58,
        re: /\b(?:mindset|confidence|self[-\s]?image|mental\s+block|emotion|stress|overwhelmed|anxious)\b/i,
        searchPhrase: 'mindset behaviour change exercise',
        label: 'mindset',
        caption: 'this is interesting',
    },
    {
        id: 'recovery_sleep_energy',
        topicId: 'recovery_sleep_energy',
        priority: 60,
        re: /\b(?:sleep|recovery|fatigue|tired|sore|doms|deload|energy|stress)\b/i,
        searchPhrase: 'recovery sleep energy training',
        label: 'recovery',
        caption: 'this is useful for recovery',
    },
    {
        id: 'bunny_reels',
        topicId: 'bunny_reels',
        priority: 50,
        re: /\b(?:bunny|bunnies|rabbit|rabbits|sunshine|free[-\s]?roam)\b/i,
        searchPhrase: 'cute rabbit bunny',
        label: 'bunny reel',
        caption: '',
    },
];

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clean(value, max = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function displayName(assignment = {}) {
    return assignment.client?.name
        || assignment.client?.email?.split('@')[0]
        || assignment.client_name
        || 'Client';
}

function cleanFirstName(value = '') {
    return clean(value, 80).split(/\s+/)[0].replace(/^@+/, '') || 'there';
}

function hoursBetween(laterMs, earlierIso) {
    const earlierMs = Date.parse(earlierIso || '');
    if (!Number.isFinite(earlierMs)) return null;
    return (laterMs - earlierMs) / (60 * 60 * 1000);
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

function normalizeVideoId(value = '') {
    const raw = clean(value, 200);
    const m = raw.match(/(?:shorts\/|watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : raw;
}

function graphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return clean(graph.ig_graph_user_id || graph.recipient_id || customData.ig_graph_user_id || '', 160);
}

function threadDeliveryData(thread = null, nowMs = Date.now()) {
    if (!thread?.id) {
        return { channel: 'in_app', delivery_channel: 'in_app' };
    }
    const recipientId = graphRecipientId(thread);
    const lastInboundAt = thread.last_inbound_at || null;
    const hoursSinceInbound = lastInboundAt ? hoursBetween(nowMs, lastInboundAt) : null;
    const graphCanSend = !!recipientId && hoursSinceInbound !== null && hoursSinceInbound <= 24;
    const graph = safeObject(safeObject(thread.custom_data).instagram_graph);
    return {
        channel: graphCanSend ? 'instagram' : 'manual_ig',
        delivery_channel: graphCanSend ? 'instagram_graph' : 'manual_ig',
        manual_ig_required: !graphCanSend,
        manual_reason: graphCanSend ? undefined : 'Daily Reel found this, but Instagram Graph is outside the safe send window. Approve the idea, then copy/send manually in Instagram.',
        ig_thread_id: thread.id,
        ig_username: thread.ig_username || thread.profile_name || null,
        profile_name: thread.profile_name || thread.ig_username || null,
        subscriber_id: thread.subscriber_id || null,
        ig_graph_recipient_id: recipientId || undefined,
        ig_graph_account_id: graph.ig_account_id || graph.account_id || undefined,
        instagram_graph: recipientId ? {
            ...graph,
            ig_graph_user_id: recipientId,
            send_ready: graphCanSend,
            last_inbound_at: lastInboundAt,
        } : graph,
    };
}

function asText(value, depth = 0) {
    if (value == null || depth > 4) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return ` ${String(value)} `;
    if (Array.isArray(value)) return value.map(item => asText(item, depth + 1)).join(' ');
    if (typeof value === 'object') {
        return Object.entries(value)
            .filter(([key]) => !/token|secret|key|password|credential|signature|lookaside|cdn/i.test(key))
            .map(([key, item]) => ` ${key} ${asText(item, depth + 1)} `)
            .join(' ');
    }
    return '';
}

function veganRequiredFromContext({ thread = {}, assignment = {}, messages = [] } = {}) {
    const text = [
        thread.lead_stage,
        asText(thread.goals),
        asText(thread.personal_context),
        asText(thread.running_notes),
        asText(thread.qualifier),
        asText(safeObject(thread.custom_data).learning_interests),
        messages.map(m => m.text).join(' '),
    ].join(' ');
    if (/\b(not vegan|isn't vegan|isnt vegan|omnivore|eats everything|eat everything)\b/i.test(text)) return false;
    return /\b(vegan|plant[-\s]?based|plantbased|wfpb|vegetarian|vego|plant_based_30|vegan challenge)\b/i.test(text);
}

function candidateVeganText(candidate = {}) {
    return [
        candidate.title,
        candidate.description,
        candidate.channel_title,
        candidate.source_kind,
        Array.isArray(candidate.tags) ? candidate.tags.join(' ') : '',
    ].join(' ');
}

function animalProductUnsafeText(candidate = {}) {
    return candidateVeganText(candidate)
        .replace(VEGAN_SAFE_SAFE_MILK_RE, 'plant based milk')
        .replace(VEGAN_SAFE_SAFE_CHEESE_RE, 'vegan cheese');
}

function assessCandidateVeganSafety(candidate = {}, { required = false, topicId = '' } = {}) {
    if (!required) return { required: false, status: 'not_required', reasons: [] };
    if (VEGAN_SAFE_ANIMAL_PRODUCT_RE.test(animalProductUnsafeText(candidate))) {
        return { required: true, status: 'unsafe', reasons: ['animal_product_signal'] };
    }
    const source = findCuratedLearningReelSource(candidate, topicId);
    const reasons = [];
    if (VEGAN_SAFE_SOURCE_KIND_RE.test(candidate.source_kind || source?.sourceKind || '')) reasons.push('plant_based_source');
    if (VEGAN_SAFE_POSITIVE_RE.test(candidateVeganText(candidate))) reasons.push('vegan_metadata_signal');
    if (!FOOD_TOPIC_IDS.has(topicId)) reasons.push('non_food_topic_no_animal_signal');
    if (FOOD_TOPIC_IDS.has(topicId) && !reasons.length) {
        return { required: true, status: 'unknown', reasons: ['food_or_nutrition_without_vegan_signal'] };
    }
    return { required: true, status: 'safe', reasons: [...new Set(reasons)] };
}

function messagesToContext(messages = []) {
    return messages
        .slice()
        .sort((a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || ''))
        .map(message => `${message.direction === 'in' ? 'Client' : 'Shannon'}: ${clean(message.text, 260)}`)
        .join('\n');
}

function evidenceForSignal(messages = [], signal) {
    const sorted = messages
        .filter(m => clean(m.text) && signal.re.test(m.text))
        .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
    const direct = sorted[0] || null;
    if (direct) {
        return {
            message_id: direct.id || null,
            source: direct.source || null,
            direction: direct.direction || null,
            text: truncate(direct.text || '', 260),
            created_at: direct.created_at || null,
        };
    }
    return null;
}

function classifyConversation({ assignment, thread, messages, nowMs = Date.now() }) {
    const recentMessages = messages.filter(message => {
        const age = hoursBetween(nowMs, message.created_at);
        return age !== null && age <= RECENT_LOOKBACK_HOURS && clean(message.text);
    });
    if (!recentMessages.length) return null;

    const context = messagesToContext(recentMessages);
    const hits = SIGNALS
        .map(signal => {
            if (!signal.re.test(context)) return null;
            const evidence = evidenceForSignal(recentMessages, signal);
            const latestAge = evidence?.created_at ? hoursBetween(nowMs, evidence.created_at) : RECENT_LOOKBACK_HOURS;
            const inboundBoost = evidence?.direction === 'in' ? 8 : 0;
            const linkedBoost = assignment.client_id ? 8 : 0;
            const graphBoost = graphRecipientId(thread) ? 4 : 0;
            const recencyBoost = latestAge !== null ? Math.max(0, 12 - Math.floor(latestAge / 4)) : 0;
            return {
                ...signal,
                score: signal.priority + inboundBoost + linkedBoost + graphBoost + recencyBoost,
                evidence,
                context: truncate(context, 1200),
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
    return hits[0] || null;
}

function sourceSpecificQueries(topicId, searchPhrase) {
    const sourceQueries = getCuratedLearningReelSources(topicId)
        .slice(0, MAX_SEARCH_QUERIES)
        .map(source => `${source.channelTitle} ${searchPhrase} shorts`);
    const genericQueries = buildCuratedLearningReelQueries(topicId, { perSource: 1 });
    return [...new Set([...sourceQueries, ...genericQueries])].slice(0, MAX_SEARCH_QUERIES);
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
    url.searchParams.set('q', query);
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

function candidateFromResult(raw, detail, topicId, query) {
    const detailSnippet = safeObject(detail?.snippet);
    const searchSnippet = safeObject(raw?.snippet);
    const snippet = Object.keys(detailSnippet).length ? detailSnippet : searchSnippet;
    const durationSec = parseIsoDuration(detail?.contentDetails?.duration);
    const viewCount = Number(detail?.statistics?.viewCount || 0);
    const channelId = clean(snippet.channelId || searchSnippet.channelId || '', 120);
    const videoId = clean(raw?.id?.videoId || detail?.id || '', 120);
    const title = clean(snippet.title || searchSnippet.title || '', 300);
    const channelTitle = clean(snippet.channelTitle || searchSnippet.channelTitle || '', 180);
    const description = clean(snippet.description || searchSnippet.description || '', 5000);
    const tags = Array.isArray(snippet.tags) ? snippet.tags.map(tag => clean(tag, 120)).filter(Boolean).slice(0, 30) : [];
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

async function findReelForOpportunity({ signal, thread, veganSafeRequired = false }) {
    const topicId = signal.topicId;
    const queries = sourceSpecificQueries(topicId, signal.searchPhrase);
    const seenIds = new Set();
    const rawCandidates = [];
    for (const query of queries) {
        const results = await youtubeSearch(query, MAX_SEARCH_RESULTS_PER_QUERY);
        for (const item of results) {
            const videoId = clean(item?.id?.videoId, 120);
            if (!videoId || seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            rawCandidates.push({ query, item });
        }
    }

    const details = await youtubeVideoDetails(rawCandidates.map(candidate => candidate.item?.id?.videoId).filter(Boolean));
    const candidates = rawCandidates
        .map(({ query, item }) => {
            const detail = details.get(item?.id?.videoId) || {};
            const candidate = candidateFromResult(item, detail, topicId, query);
            const veganSafety = assessCandidateVeganSafety(candidate, { required: veganSafeRequired, topicId });
            return {
                ...candidate,
                vegan_safety: veganSafety,
                score: scoreCuratedLearningReelCandidate(candidate, topicId),
            };
        })
        .filter(candidate => {
            if (!candidate.video_id || candidate.score < 0) return false;
            if (candidate.duration_seconds && candidate.duration_seconds > 240) return false;
            if (veganSafeRequired && candidate.vegan_safety?.status !== 'safe') return false;
            const normalized = normalizeLearningReelItems([candidate], {
                source: SOURCE,
                platform: 'youtube',
            });
            if (findDuplicateLearningReels(thread, normalized).length) return false;
            return true;
        })
        .sort((a, b) => b.score - a.score);

    return {
        reel: candidates[0] || null,
        raw_count: rawCandidates.length,
        eligible_count: candidates.length,
        queries,
    };
}

function buildDraftMessage(signal, reel) {
    const caption = clean(signal.caption, 90);
    if (!caption) return reel.url;
    return `${caption}\n${reel.url}`;
}

function learningReelContext(reel, signal, now = new Date()) {
    return {
        url: reel.url,
        title: reel.title,
        channel_title: reel.channel_title,
        channel_id: reel.channel_id,
        video_id: reel.video_id,
        topic_id: signal.topicId,
        topic_label: LEARNING_REEL_TOPIC_LABELS[signal.topicId] || signal.topicId,
        reason: reel.reason,
        description: reel.description,
        thumbnail_url: reel.thumbnail_url,
        duration_seconds: reel.duration_seconds,
        view_count: reel.view_count,
        source_id: reel.source_id,
        source_kind: reel.source_kind,
        platform: 'youtube',
        source: SOURCE,
        suggested_at: now.toISOString(),
    };
}

function buildNeedsYouAlert({ assignment, thread, signal, reel, searchMeta = {}, now = new Date() }) {
    const clientName = displayName(assignment);
    const draft = buildDraftMessage(signal, reel);
    const reelContext = learningReelContext(reel, signal, now);
    const delivery = threadDeliveryData(thread, now.getTime());
    const data = {
        subtype: 'daily_reel_opportunity',
        daily_reel_opportunity: true,
        daily_reel_opportunity_source: SOURCE,
        daily_reel_signal: signal.id,
        daily_reel_label: signal.label,
        daily_reel_evidence: signal.evidence,
        daily_reel_context: signal.context,
        daily_reel_search: {
            topic_id: signal.topicId,
            search_phrase: signal.searchPhrase,
            raw_count: searchMeta.raw_count || 0,
            eligible_count: searchMeta.eligible_count || 0,
            queries: searchMeta.queries || [],
        },
        learning_reels: [reelContext],
        learning_reel_context: `${reelContext.topic_label}: "${reel.title}" by ${reel.channel_title}. ${reel.reason || ''}`.trim(),
        drafted_at: now.toISOString(),
        draft_text: draft,
        draft_messages: [draft],
        operator_queue: 'needs_you',
        needs_you_required: true,
        needs_you_reason: 'daily_reel_opportunity',
        needs_you_reasons: ['daily_reel_opportunity', signal.id],
        client_manager_review_required: true,
        needs_shannon_approval: true,
        non_challenge_checkin: true,
        manual_checkin_roster: true,
        linked_client_name: clientName,
        ...delivery,
        codex_review: {
            source: SOURCE,
            decision: 'needs_you_daily_reel_opportunity',
            queue: 'needs_you',
            reason: signal.id,
            needs_shannon_approval: true,
            reviewed_at: now.toISOString(),
            automation_id: SOURCE,
            evidence_ids: [
                assignment.client_id ? `users:${assignment.client_id}` : '',
                thread?.id ? `ig_threads:${thread.id}` : '',
                signal.evidence?.message_id ? `${signal.evidence.source || 'message'}:${signal.evidence.message_id}` : '',
                reel.video_id ? `youtube:${reel.video_id}` : '',
            ].filter(Boolean),
        },
    };
    return {
        coach_id: assignment.coach_id,
        client_id: assignment.client_id,
        client_name: clientName,
        alert_type: 'weekly_checkin',
        priority: signal.priority >= 85 ? 'high' : 'medium',
        title: `Reel for ${clientName}: ${signal.label}`,
        description: `${clientName} was recently chatting about ${signal.label}. Suggested reel: "${reel.title}" by ${reel.channel_title}. Shannon approval required before send.`,
        suggested_message: draft,
        status: 'pending',
        data,
    };
}

function reelOpportunityIdempotencyKey({ assignment, signal, now = new Date() }) {
    const dayKey = now.toISOString().slice(0, 10);
    return `daily_reel:${assignment.coach_id}:${assignment.client_id}:${dayKey}:${signal.id}`;
}

async function loadShannonCoachId() {
    const rows = await supabaseQuery(`users?select=id,email&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
    return rows[0]?.id || null;
}

async function loadActiveAssignments(coachId) {
    return supabaseQuery(
        `coach_clients?select=coach_id,client_id,assigned_at,client:users!coach_clients_client_id_fkey(id,name,email,last_login,is_test_account)&coach_id=eq.${coachId}&status=eq.active&limit=500`
    );
}

async function loadLatestThreads(clientIds = []) {
    if (!clientIds.length) return new Map();
    const out = new Map();
    const chunks = [];
    for (let i = 0; i < clientIds.length; i += 80) chunks.push(clientIds.slice(i, i + 80));
    for (const chunk of chunks) {
        const inList = chunk.map(id => `"${id}"`).join(',');
        const rows = await supabaseQuery(
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,linked_user_id,last_inbound_at,last_outbound_at,custom_data,lead_stage,goals,personal_context,running_notes,qualifier&linked_user_id=in.(${inList})&order=last_inbound_at.desc.nullslast&limit=300`
        ).catch(() => []);
        for (const row of rows) {
            if (!out.has(row.linked_user_id)) out.set(row.linked_user_id, row);
        }
    }
    return out;
}

async function loadConversationMessages({ assignment, thread, sinceIso }) {
    const messages = [];
    if (thread?.id) {
        const igRows = await supabaseQuery(
            `ig_messages?select=id,direction,text,source,created_at&thread_id=eq.${thread.id}&created_at=gte.${sinceIso}&order=created_at.desc&limit=80`
        ).catch(() => []);
        messages.push(...igRows.map(r => ({ ...r, source: r.source || 'instagram' })));
    }
    const nudgeRows = await supabaseQuery(
        `nudges?select=id,sender_id,receiver_id,message,created_at,nudge_type&or=(and(sender_id.eq.${assignment.client_id},receiver_id.eq.${assignment.coach_id}),and(sender_id.eq.${assignment.coach_id},receiver_id.eq.${assignment.client_id}))&created_at=gte.${sinceIso}&order=created_at.desc&limit=80`
    ).catch(() => []);
    for (const row of nudgeRows) {
        if (String(row.nudge_type || '').toLowerCase() === 'game_invite') continue;
        messages.push({
            id: row.id,
            direction: row.sender_id === assignment.client_id ? 'in' : 'out',
            text: row.message || '',
            source: 'in_app',
            created_at: row.created_at,
        });
    }
    return messages.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
}

async function hasPendingReelOpportunity({ coachId, clientId }) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.pending&created_at=gte.${encodeURIComponent(new Date(Date.now() - 7 * DAY_MS).toISOString())}&limit=30`
    ).catch(() => []);
    return rows.some(row => {
        const data = safeObject(row.data);
        return data.daily_reel_opportunity === true
            || data.learning_reels
            || data.learning_reel_context;
    });
}

async function hasRecentReelOpportunity({ coachId, clientId, signalId, now = new Date() }) {
    const cutoff = new Date(now.getTime() - COOLDOWN_DAYS * DAY_MS).toISOString();
    const rows = await supabaseQuery(
        `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&created_at=gte.${encodeURIComponent(cutoff)}&data->>daily_reel_signal=eq.${encodeURIComponent(signalId)}&limit=1`
    ).catch(() => []);
    return rows.length > 0;
}

async function runDailyReelOpportunityScan({ maxAlerts = MAX_ALERTS_PER_RUN, now = new Date() } = {}) {
    const coachId = await loadShannonCoachId();
    if (!coachId) return { scanned: 0, inserted: 0, skipped: { no_coach: 1 } };
    if (!YOUTUBE_API_KEY) return { scanned: 0, inserted: 0, skipped: { youtube_api_key_missing: 1 } };

    const assignmentsRaw = await loadActiveAssignments(coachId);
    const assignments = assignmentsRaw.filter(a => !a.client?.is_test_account);
    const threadsByClient = await loadLatestThreads(assignments.map(a => a.client_id));
    const sinceIso = new Date(now.getTime() - RECENT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const skipped = {
        no_thread: 0,
        pending_exists: 0,
        cooldown: 0,
        no_signal: 0,
        no_reel: 0,
        cap: 0,
    };
    const candidates = [];

    for (const assignment of assignments) {
        const thread = threadsByClient.get(assignment.client_id) || null;
        if (!thread?.id) {
            skipped.no_thread++;
            continue;
        }
        if (await hasPendingReelOpportunity({ coachId: assignment.coach_id, clientId: assignment.client_id })) {
            skipped.pending_exists++;
            continue;
        }
        const messages = await loadConversationMessages({ assignment, thread, sinceIso });
        const signal = classifyConversation({ assignment, thread, messages, nowMs: now.getTime() });
        if (!signal) {
            skipped.no_signal++;
            continue;
        }
        if (await hasRecentReelOpportunity({ coachId: assignment.coach_id, clientId: assignment.client_id, signalId: signal.id, now })) {
            skipped.cooldown++;
            continue;
        }
        candidates.push({
            assignment,
            thread,
            messages,
            signal,
            veganSafeRequired: veganRequiredFromContext({ thread, assignment, messages }),
        });
    }

    candidates.sort((a, b) => b.signal.score - a.signal.score);
    const inserted = [];
    const selected = [];
    for (const candidate of candidates) {
        if (selected.length >= Math.max(0, maxAlerts)) break;
        const search = await findReelForOpportunity({
            signal: candidate.signal,
            thread: candidate.thread,
            veganSafeRequired: candidate.veganSafeRequired,
        });
        if (!search.reel) {
            skipped.no_reel++;
            continue;
        }
        selected.push({ ...candidate, reel: search.reel, searchMeta: search });
    }
    skipped.cap = Math.max(0, candidates.length - selected.length);

    for (const item of selected) {
        const alertRow = buildNeedsYouAlert({ ...item, now });
        const key = reelOpportunityIdempotencyKey({ assignment: item.assignment, signal: item.signal, now });
        const result = await insertCoachAlert(alertRow, key);
        if (result.alertId && !result.deduped) {
            inserted.push({
                alertId: result.alertId,
                clientId: item.assignment.client_id,
                clientName: displayName(item.assignment),
                signal: item.signal.id,
                reel: item.reel.url,
            });
        }
    }

    return {
        scanned: assignments.length,
        candidates: candidates.length,
        inserted: inserted.length,
        inserted_alerts: inserted,
        skipped,
    };
}

exports.handler = async () => {
    try {
        const result = await runDailyReelOpportunityScan();
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, ...result }),
        };
    } catch (error) {
        console.error('[daily-reel-opportunity] failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: error.message || String(error) }),
        };
    }
};

exports._test = {
    SIGNALS,
    assessCandidateVeganSafety,
    buildDraftMessage,
    buildNeedsYouAlert,
    classifyConversation,
    reelOpportunityIdempotencyKey,
    threadDeliveryData,
    veganRequiredFromContext,
};
