// Remove only the negated readiness phrase, preserving any later buying request.
function stripNegatedReadiness(value = '') {
    return String(value).replace(/[’‘]/g, "'").replace(/\b(?:i (?:don't|do not) think (?![^.!?]{0,60}\bbut\b)[a-z' ]{1,40}?|(?:[a-z]+(?:'s|'re)?\s+)?(?:isn't|aren't|am not|is not|are not|not)\s+)(?:quite\s+)?ready to (?:join|start|sign up)\b/gi, '[not-ready]');
}
module.exports = { stripNegatedReadiness };
