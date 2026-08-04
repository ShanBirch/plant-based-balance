#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROFILE_PATH = path.join(__dirname, '..', 'content-lab', 'data', 'shannon-spoken-voice-profile.json');

function countWords(text = '') {
    return (String(text).match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g) || []).length;
}

function countMatches(text, pattern) {
    return (String(text).match(pattern) || []).length;
}

function sentenceWordCounts(text = '') {
    return String(text)
        .split(/(?<=[.!?])\s+|\n+/)
        .map(value => countWords(value))
        .filter(Boolean);
}

function issue({ severity = 'warning', code, message, suggestion = '' }) {
    return { severity, code, message, suggestion };
}

function analyzeScript(text = '', { context = 'spoken' } = {}) {
    const value = String(text || '').trim();
    const lower = value.toLowerCase();
    const wordCount = countWords(value);
    const issues = [];

    const exactRules = [
        [/\bhow are you going\b/gi, 'formal_greeting', 'Shannon’s confirmed greeting is “How ya going?”', 'Replace with “How ya going?”'],
        [/\bthis demonstrates\b/gi, 'formal_transition', '“This demonstrates” sounds like presenter copy.', 'State the point directly.'],
        [/\bit is important to understand\b/gi, 'formal_transition', '“It is important to understand” sounds formal and padded.', 'Say the important point itself.'],
        [/\bthe practical takeaway is\b/gi, 'formal_transition', '“The practical takeaway is” sounds scripted.', 'Move straight to the action.'],
        [/\bi would be happy to help\b/gi, 'generic_assistant', '“I would be happy to help” does not sound like Shannon.', 'Answer directly or offer the concrete next step.'],
    ];
    for (const [pattern, code, message, suggestion] of exactRules) {
        if (pattern.test(value)) issues.push(issue({ severity: 'error', code, message, suggestion }));
    }

    const contractionRules = [
        [/\bI will\b/g, "I'll"], [/\bI am\b/g, "I'm"], [/\bI have\b/g, "I've"],
        [/\byou are\b/gi, "you're"], [/\byou have\b/gi, "you've"], [/\bwe are\b/gi, "we're"],
        [/\bit is\b/gi, "it's"], [/\bthat is\b/gi, "that's"], [/\bthere is\b/gi, "there's"],
        [/\bdo not\b/gi, "don't"], [/\bdoes not\b/gi, "doesn't"], [/\bdid not\b/gi, "didn't"],
        [/\bcannot\b/gi, "can't"], [/\bcan not\b/gi, "can't"], [/\bwill not\b/gi, "won't"],
        [/\bis not\b/gi, "isn't"], [/\bare not\b/gi, "aren't"], [/\bhave not\b/gi, "haven't"],
    ];
    for (const [pattern, replacement] of contractionRules) {
        const matches = value.match(pattern) || [];
        if (matches.length) {
            issues.push(issue({
                severity: 'error',
                code: 'expanded_contraction',
                message: `${matches.length} expanded form${matches.length === 1 ? '' : 's'} matched ${pattern}.`,
                suggestion: `Use ${replacement} unless this is an exact quotation.`,
            }));
        }
    }

    const coreHesitations = countMatches(lower, /\b(?:um+|ah+)\b/g);
    const thinkingBeats = countMatches(lower, /\b(?:um+|ah+|yeah|okay|alright|honestly|anyway|you know|i mean)\b/g);
    const stackedHesitations = countMatches(lower, /\b(?:um+|ah+)\b(?:[\s,.…-]+\w+){0,2}[\s,.…-]+\b(?:um+|ah+)\b/g);
    const targetCore = context === 'dm'
        ? (wordCount >= 34 ? 1 : 0)
        : (wordCount >= 70 ? 2 : (wordCount >= 34 ? 1 : 0));
    if (coreHesitations < targetCore) {
        issues.push(issue({
            severity: 'warning',
            code: 'missing_core_hesitation',
            message: `This ${wordCount}-word ${context} script has ${coreHesitations} core hesitation beat${coreHesitations === 1 ? '' : 's'}.`,
            suggestion: `Add ${targetCore - coreHesitations} genuine, drawn-out “ummm” at a real thought change. Use “ahh” only for actual relief or realisation.`,
        }));
    }
    if (stackedHesitations) {
        issues.push(issue({
            severity: 'error',
            code: 'stacked_hesitations',
            message: 'Hesitation sounds are stacked too closely and read as an imitation.',
            suggestion: 'Keep one hesitation, finish the thought, then let the next imperfect beat happen later.',
        }));
    }

    const sentences = sentenceWordCounts(value);
    const longSentences = sentences.filter(words => words > 40).length;
    const shortSentences = sentences.filter(words => words <= 4).length;
    if (longSentences) {
        issues.push(issue({
            severity: 'warning',
            code: 'long_sentence',
            message: `${longSentences} sentence${longSentences === 1 ? '' : 's'} exceed the measured 40-word upper style range.`,
            suggestion: 'Break the explanation into one causal line and a short landing fragment.',
        }));
    }
    if (wordCount >= 80 && sentences.length >= 4 && shortSentences === 0) {
        issues.push(issue({
            severity: 'warning',
            code: 'no_landing_fragments',
            message: 'The script has no short landing fragments.',
            suggestion: 'Let one or two important thoughts land in four words or fewer.',
        }));
    }

    const relationshipWords = countMatches(lower, /\b(?:bro|broski|mate)\b/g);
    if (relationshipWords && context === 'new_lead') {
        issues.push(issue({
            severity: 'warning',
            code: 'unearned_relationship_word',
            message: 'Bro, broski, or mate needs evidence from the live relationship.',
            suggestion: 'Remove it unless Shannon already uses that address word with this person.',
        }));
    }

    const errors = issues.filter(entry => entry.severity === 'error').length;
    const warnings = issues.filter(entry => entry.severity === 'warning').length;
    const score = Math.max(0, 100 - (errors * 18) - (warnings * 7));
    return {
        valid: errors === 0,
        score,
        context,
        metrics: {
            words: wordCount,
            sentences: sentences.length,
            shortSentences,
            longSentences,
            coreHesitations,
            thinkingBeats,
            relationshipWords,
        },
        issues,
    };
}

function parseArgs(argv) {
    const args = { context: 'spoken', json: false, file: '' };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--file') args.file = argv[++i] || '';
        else if (argv[i] === '--context') args.context = argv[++i] || 'spoken';
        else if (argv[i] === '--json') args.json = true;
        else if (argv[i] === '--profile') args.profile = true;
    }
    return args;
}

if (require.main === module) {
    const args = parseArgs(process.argv.slice(2));
    if (args.profile) {
        process.stdout.write(`${fs.readFileSync(PROFILE_PATH, 'utf8').trim()}\n`);
        process.exit(0);
    }
    const input = args.file
        ? fs.readFileSync(path.resolve(args.file), 'utf8')
        : fs.readFileSync(0, 'utf8');
    const result = analyzeScript(input, { context: args.context });
    if (args.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
        process.stdout.write(`Shannon voice score: ${result.score}/100 (${result.valid ? 'pass' : 'rewrite'})\n`);
        for (const entry of result.issues) {
            process.stdout.write(`- ${entry.severity.toUpperCase()} ${entry.code}: ${entry.message}`);
            if (entry.suggestion) process.stdout.write(` ${entry.suggestion}`);
            process.stdout.write('\n');
        }
    }
    process.exitCode = result.valid ? 0 : 1;
}

module.exports = { analyzeScript, countWords, sentenceWordCounts };
