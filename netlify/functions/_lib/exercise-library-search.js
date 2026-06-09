const fs = require('fs');
const path = require('path');

let exerciseCatalogCache = null;

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'without', 'into', 'from', 'that', 'this',
    'there', 'option', 'options', 'exercise', 'exercises', 'workout', 'app',
    'under', 'list', 'log', 'find', 'search', 'show', 'showing', 'shown',
    'what', 'where', 'which', 'when', 'your', 'mine', 'me', 'you', 'its',
    'it', 'in', 'on', 'to', 'of', 'a', 'an', 'is', 'are', 'was', 'were',
    'no', 'not', 'cant', 'cannot', 'can', 'could', 'would', 'should',
]);

const SUPPORT_INTENT_RE = /\b(no\s+(?:seated|machine|cable|standing|option)|no\s+exercises?|not\s+in\s+there|isn'?t\s+(?:in\s+there|showing|there)|doesn'?t\s+(?:show|come\s+up|pull\s+up)|can'?t\s+find|cannot\s+find|couldn'?t\s+find|search(?:ing)?|list\s+.*\s+under|log\s+.*\s+under|equivalent|custom\s+workout|clear\s+all\s+filters?|filters?\s+(?:hiding|on)|what\s+(?:can|should)\s+i\s+(?:put|list|log|search|type|add)|what\s+(?:do|should)\s+i\s+search|put\s+.*\s+(?:in\s+)?as|log\s+.*\s+(?:in\s+)?as|add\s+.*\s+(?:in\s+)?as)\b/i;
const EXERCISE_WORD_RE = /\b(machine|seated|standing|cable|dumbbell|barbell|smith|band|mini\s*band|hip|abduction|adduction|leg|curl|extension|press|row|pulldown|pull\s*down|squat|lunge|deadlift|rdl|glute|thruster|thrust|bench|chest|shoulder|bicep|tricep|calf|quad|hamstring|back|fly|raise|crunch|plank|push\s*up|pull\s*up|torso|trunk|rotation|rotator|ab|abdominal)\b/i;
const MEDIA_MARKER_RE = /\[(?:PHOTO|VIDEO):|\b(?:photo|picture|pic|screenshot|image|video|clip)\b/i;
const MACHINE_OR_VISUAL_RE = /\b(machine|equipment|station|photo|picture|pic|screenshot|image|video|clip|looks?\s+like|equivalent|same\s+movement)\b/i;
const CONFUSED_FOLLOWUP_RE = /\b(no\s+(?:seated|machine|cable|standing|option)|no\s+exercises?|not\s+in\s+there|isn'?t\s+(?:in\s+there|showing|there)|doesn'?t\s+(?:show|come\s+up|pull\s+up)|can'?t\s+find|cannot\s+find|couldn'?t\s+find|sorry.*(?:not|isn'?t|cant|can'?t)|still\s+(?:not|no|cant|can'?t)|nothing\s+(?:comes|shows)|no\s+results?)\b/i;
const PRIOR_EXERCISE_ADVICE_RE = /\b(?:type|search|look\s+up|list|log|put|add)\b.{0,80}\b(?:under|as|in|called|search bar|option|exercise)\b|\b(?:machine|cable|seated|standing|abduction|crunch|rotation|trunk|torso|raise)\b.{0,80}\b(?:in\s+there|in\s+the\s+app|in\s+balance|search)\b/i;

function exerciseVideoPaths() {
    let resolvedRoot = '';
    try {
        resolvedRoot = require.resolve('../../../exercise_videos.js');
    } catch (_) {
        resolvedRoot = '';
    }
    return [
        resolvedRoot,
        path.join(process.cwd(), 'exercise_videos.js'),
        path.join(__dirname, '..', '..', '..', 'exercise_videos.js'),
        path.join(__dirname, '..', '..', 'exercise_videos.js'),
    ].filter(Boolean);
}

function decodeJsStringLiteral(raw) {
    try {
        return JSON.parse(`"${raw}"`);
    } catch (_) {
        return raw.replace(/\\(["\\/bfnrt])/g, '$1');
    }
}

function loadExerciseCatalog() {
    if (exerciseCatalogCache) return exerciseCatalogCache;
    let source = '';
    for (const candidate of exerciseVideoPaths()) {
        try {
            source = fs.readFileSync(candidate, 'utf8');
            if (source) break;
        } catch (_) {
            // Try the next known location. Netlify's function bundle path can differ locally.
        }
    }
    if (!source) {
        exerciseCatalogCache = [];
        return exerciseCatalogCache;
    }

    const rows = [];
    const keyRe = /"((?:\\.|[^"\\])+)":\s*"((?:\\.|[^"\\])*)"/g;
    let match;
    while ((match = keyRe.exec(source))) {
        const name = decodeJsStringLiteral(match[1]).trim();
        const videoUrl = decodeJsStringLiteral(match[2]).trim();
        if (name) rows.push({ name, videoUrl });
    }
    const seen = new Set();
    exerciseCatalogCache = rows.filter(row => {
        const key = row.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    return exerciseCatalogCache;
}

function loadExerciseNames() {
    return loadExerciseCatalog().map(row => row.name);
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function tokenize(value) {
    return normalizeText(value)
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t && t.length > 1);
}

function hasExerciseLibrarySupportIntent(text) {
    const raw = String(text || '');
    return SUPPORT_INTENT_RE.test(raw) && EXERCISE_WORD_RE.test(raw);
}

function expandQueryTokens(tokens) {
    const expanded = new Set(tokens);
    const addWhen = (from, to) => {
        if (expanded.has(from)) expanded.add(to);
    };
    addWhen('torso', 'trunk');
    addWhen('trunk', 'torso');
    addWhen('abdominal', 'ab');
    addWhen('ab', 'abdominal');
    addWhen('rotator', 'rotation');
    if (expanded.has('legs')) expanded.add('leg');
    if (expanded.has('arms')) expanded.add('arm');
    return [...expanded];
}

function scoreExerciseName(name, queryTokens, normalizedQuery) {
    const nameTokens = tokenize(name);
    if (!nameTokens.length || !queryTokens.length) return 0;
    const querySet = new Set(queryTokens);
    let overlap = 0;
    for (const token of nameTokens) {
        if (querySet.has(token)) overlap += 1;
    }
    if (!overlap) return 0;

    let score = overlap * 10;
    const normalizedName = normalizeText(name);
    if (normalizedQuery.includes(normalizedName)) score += 80;
    if (normalizedQuery.includes('abdominal crunch') && normalizedName === 'ab crunch') score += 80;
    if (normalizedQuery.includes('torso rotation') && normalizedName === 'trunk rotation') score += 80;
    if (nameTokens.every(token => querySet.has(token))) score += 30;
    if (nameTokens.length === 1 && queryTokens.length > 2) score -= 20;

    for (const important of ['machine', 'seated', 'cable', 'standing', 'hip', 'abduction', 'adduction', 'trunk', 'torso', 'rotation', 'crunch', 'raise']) {
        const queryHas = querySet.has(important);
        const nameHas = nameTokens.includes(important);
        if (queryHas && nameHas) score += 8;
        if (queryHas && !nameHas) score -= 6;
    }

    return score;
}

function findExerciseLibraryMatchDetails(text, { limit = 6 } = {}) {
    const normalizedQuery = normalizeText(text);
    const queryTokens = expandQueryTokens(tokenize(text).filter(token => !STOP_WORDS.has(token)));
    if (!queryTokens.length) return [];

    return loadExerciseCatalog()
        .map(row => ({
            name: row.name,
            videoUrl: row.videoUrl,
            score: scoreExerciseName(row.name, queryTokens, normalizedQuery),
        }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, limit);
}

function findExerciseLibraryMatches(text, { limit = 6 } = {}) {
    return findExerciseLibraryMatchDetails(text, { limit }).map(row => row.name);
}

function hasExerciseMediaOrMachineContext(text) {
    const raw = String(text || '');
    return MACHINE_OR_VISUAL_RE.test(raw) || MEDIA_MARKER_RE.test(raw);
}

function isConfusedExerciseLookupFollowup({ currentMessage = '', conversationText = '' } = {}) {
    const current = String(currentMessage || '');
    const conversation = String(conversationText || '');
    if (!CONFUSED_FOLLOWUP_RE.test(current)) return false;
    return PRIOR_EXERCISE_ADVICE_RE.test(conversation);
}

function classifyExerciseLibrarySupport({ currentMessage = '', conversationText = '', recentInboundMessages = [] } = {}) {
    const recentInboundText = (Array.isArray(recentInboundMessages) ? recentInboundMessages : [])
        .map(item => typeof item === 'string' ? item : (item?.text || item?.message || ''))
        .filter(Boolean)
        .join('\n');
    const combined = [conversationText, recentInboundText, currentMessage].filter(Boolean).join('\n');
    const currentPlusRecent = [recentInboundText, currentMessage].filter(Boolean).join('\n');
    const isSupport = hasExerciseLibrarySupportIntent(combined);
    if (!isSupport) {
        return {
            isSupport: false,
            matches: [],
            requiresVisualVerification: false,
            confusedFollowup: false,
            canFastTrack: false,
        };
    }
    const matches = findExerciseLibraryMatchDetails(combined, { limit: 6 });
    const requiresVisualVerification = hasExerciseMediaOrMachineContext(currentPlusRecent || combined);
    const confusedFollowup = isConfusedExerciseLookupFollowup({ currentMessage, conversationText });
    return {
        isSupport: true,
        matches,
        requiresVisualVerification,
        confusedFollowup,
        canFastTrack: !confusedFollowup,
    };
}

function buildExerciseLibrarySupportBlock({ currentMessage = '', conversationText = '', recentInboundMessages = [] } = {}) {
    const recentInboundText = (Array.isArray(recentInboundMessages) ? recentInboundMessages : [])
        .map(item => typeof item === 'string' ? item : (item?.text || item?.message || ''))
        .filter(Boolean)
        .join('\n');
    const classification = classifyExerciseLibrarySupport({ currentMessage, conversationText, recentInboundMessages });
    if (!classification.isSupport) return '';

    const matchText = classification.matches.length
        ? classification.matches.map(row => `- ${row.name}${row.videoUrl ? ` (${row.videoUrl})` : ''}`).join('\n')
        : '- No clear exercise-name match found from the available local library file.';
    const visualRule = classification.requiresVisualVerification ? `
- The client is asking about a machine or sent media. A name match is only a candidate, not proof. Compare the visible equipment/movement with the candidate demo/video/thumbnail before saying "search X".
- If you cannot verify the photo/video against a candidate, do not pretend the exact machine exists. Say Balance does not seem to have that exact machine, then give the closest label to log it under and tell them to use the same one next time so tracking stays consistent.` : '';
    const confusedRule = classification.confusedFollowup ? `
- This is a confused follow-up after a prior exercise-search instruction. Do not keep guessing or send another confident replacement. Use a holding reply like: "hang on, i'll check properly. give me a little bit, i'm a tad busy" and leave it for Shannon/Needs You.` : '';

    return `

APP EXERCISE LIBRARY CHECK (deterministic support context):
The latest thread looks like an app exercise-search or "exercise is not in there" support issue. Check this before drafting the reply.
Candidate matches found in Balance's exercise library:
${matchText}
Rules for the reply:
- If a listed match is visually/equipment-wise the same exercise, tell them the exact search term first. For example: "type in Machine Seated Abduction".
- Do not say an exercise is missing, not in the app, or unavailable when this check found a visually verified match.
- Do not recommend a substitute such as a cable/band/bodyweight version unless no suitable match is found or Shannon already checked and said to substitute it.
- If the match is uncertain, ask what appears when they search or say Shannon will check it, instead of inventing a replacement.${visualRule}${confusedRule}`;
}

function _resetExerciseNameCacheForTests() {
    exerciseCatalogCache = null;
}

module.exports = {
    loadExerciseCatalog,
    loadExerciseNames,
    normalizeText,
    hasExerciseLibrarySupportIntent,
    findExerciseLibraryMatchDetails,
    findExerciseLibraryMatches,
    classifyExerciseLibrarySupport,
    isConfusedExerciseLookupFollowup,
    buildExerciseLibrarySupportBlock,
    _resetExerciseNameCacheForTests,
};
