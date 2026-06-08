const fs = require('fs');
const path = require('path');

let exerciseNamesCache = null;

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'without', 'into', 'from', 'that', 'this',
    'there', 'option', 'options', 'exercise', 'exercises', 'workout', 'app',
    'under', 'list', 'log', 'find', 'search', 'show', 'showing', 'shown',
    'what', 'where', 'which', 'when', 'your', 'mine', 'me', 'you', 'its',
    'it', 'in', 'on', 'to', 'of', 'a', 'an', 'is', 'are', 'was', 'were',
    'no', 'not', 'cant', 'cannot', 'can', 'could', 'would', 'should',
]);

const SUPPORT_INTENT_RE = /\b(no\s+(?:seated|machine|cable|standing|option)|no\s+exercises?|not\s+in\s+there|isn'?t\s+(?:in\s+there|showing|there)|doesn'?t\s+(?:show|come\s+up|pull\s+up)|can'?t\s+find|cannot\s+find|couldn'?t\s+find|search(?:ing)?|list\s+.*\s+under|log\s+.*\s+under|equivalent|custom\s+workout|clear\s+all\s+filters?|filters?\s+(?:hiding|on)|what\s+can\s+i\s+list|what\s+should\s+i\s+list)\b/i;
const EXERCISE_WORD_RE = /\b(machine|seated|standing|cable|dumbbell|barbell|smith|band|mini\s*band|hip|abduction|adduction|leg|curl|extension|press|row|pulldown|pull\s*down|squat|lunge|deadlift|rdl|glute|thruster|thrust|bench|chest|shoulder|bicep|tricep|calf|quad|hamstring|back|fly|raise|crunch|plank|push\s*up|pull\s*up)\b/i;

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

function loadExerciseNames() {
    if (exerciseNamesCache) return exerciseNamesCache;
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
        exerciseNamesCache = [];
        return exerciseNamesCache;
    }

    const names = [];
    const keyRe = /"((?:\\.|[^"\\])+)":\s*"/g;
    let match;
    while ((match = keyRe.exec(source))) {
        const name = decodeJsStringLiteral(match[1]).trim();
        if (name) names.push(name);
    }
    exerciseNamesCache = [...new Set(names)];
    return exerciseNamesCache;
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
    if (nameTokens.every(token => querySet.has(token))) score += 30;

    for (const important of ['machine', 'seated', 'cable', 'standing', 'hip', 'abduction', 'adduction']) {
        const queryHas = querySet.has(important);
        const nameHas = nameTokens.includes(important);
        if (queryHas && nameHas) score += 8;
        if (queryHas && !nameHas) score -= 6;
    }

    return score;
}

function findExerciseLibraryMatches(text, { limit = 6 } = {}) {
    const normalizedQuery = normalizeText(text);
    const queryTokens = tokenize(text).filter(token => !STOP_WORDS.has(token));
    if (!queryTokens.length) return [];

    return loadExerciseNames()
        .map(name => ({ name, score: scoreExerciseName(name, queryTokens, normalizedQuery) }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, limit)
        .map(row => row.name);
}

function buildExerciseLibrarySupportBlock({ currentMessage = '', conversationText = '', recentInboundMessages = [] } = {}) {
    const recentInboundText = (Array.isArray(recentInboundMessages) ? recentInboundMessages : [])
        .map(item => typeof item === 'string' ? item : (item?.text || item?.message || ''))
        .filter(Boolean)
        .join('\n');
    const combined = [conversationText, recentInboundText, currentMessage].filter(Boolean).join('\n');
    if (!hasExerciseLibrarySupportIntent(combined)) return '';

    const matches = findExerciseLibraryMatches(combined, { limit: 6 });
    const matchText = matches.length
        ? matches.map(name => `- ${name}`).join('\n')
        : '- No clear exercise-name match found from the available local library file.';

    return `

APP EXERCISE LIBRARY CHECK (deterministic support context):
The latest thread looks like an app exercise-search or "exercise is not in there" support issue. Check this before drafting the reply.
Matches found in Balance's exercise library:
${matchText}
Rules for the reply:
- If a listed match fits the exercise they mean, tell them the exact search term first. For example: "type in Machine Seated Abduction".
- Do not say an exercise is missing, not in the app, or unavailable when this check found a likely match.
- Do not recommend a substitute such as a cable/band/bodyweight version unless no suitable match is found or Shannon already checked and said to substitute it.
- If the match is uncertain, ask what appears when they search or say Shannon will check it, instead of inventing a replacement.`;
}

function _resetExerciseNameCacheForTests() {
    exerciseNamesCache = null;
}

module.exports = {
    loadExerciseNames,
    normalizeText,
    hasExerciseLibrarySupportIntent,
    findExerciseLibraryMatches,
    buildExerciseLibrarySupportBlock,
    _resetExerciseNameCacheForTests,
};
