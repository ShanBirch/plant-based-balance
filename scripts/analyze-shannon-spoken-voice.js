#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ALLOWED_SENDERS = new Set(['Shan_n_Sunny', 'Shannon Birch']);

function parseCsv(input = '') {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        if (char === '"') {
            if (quoted && input[i + 1] === '"') {
                field += '"';
                i += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === ',' && !quoted) {
            row.push(field);
            field = '';
        } else if ((char === '\n' || char === '\r') && !quoted) {
            if (char === '\r' && input[i + 1] === '\n') i += 1;
            row.push(field);
            field = '';
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    const headers = rows.shift() || [];
    return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function words(text = '') {
    return (String(text).toLowerCase().replace(/’/g, "'").match(/[a-z0-9]+(?:'[a-z0-9]+)*/g) || []);
}

function phraseCount(tokens, phrase) {
    const target = words(phrase);
    let count = 0;
    for (let i = 0; i <= tokens.length - target.length; i += 1) {
        if (target.every((word, offset) => tokens[i + offset] === word)) count += 1;
    }
    return count;
}

function uniqueSpeakers(diarized = {}) {
    return [...new Set((Array.isArray(diarized.segments) ? diarized.segments : [])
        .map(segment => String(segment.speaker || '').trim())
        .filter(Boolean))];
}

function isSingleSpeaker(diarized = {}) {
    return uniqueSpeakers(diarized).length === 1;
}

function classifyOpening(tokens = []) {
    if (!tokens.length) return 'empty';
    if (tokens[0] === 'good' && tokens[1] === 'morning') return 'morning_or_good_morning';
    if (tokens[0] === 'morning') return 'morning_or_good_morning';
    if (tokens[0] === 'hey' || tokens[0] === 'heya') return 'hey_or_heya';
    if (['yo', 'yeah', 'so', 'okay', 'alright'].includes(tokens[0])) return tokens[0];
    return 'content_first_or_other';
}

function parseArgs(argv) {
    const result = {};
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (key.startsWith('--')) result[key.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
    }
    return result;
}

function analyze({ manifestPath, surfaceDir, diarizedDir, strictSingleSpeaker = true }) {
    const manifest = parseCsv(fs.readFileSync(manifestPath, 'utf8'));
    const manifestByBase = new Map(manifest.map(row => [
        path.basename(row.original_path || '', path.extname(row.original_path || '')),
        row,
    ]));
    const counters = new Map();
    const phraseCounters = new Map();
    const openings = new Map();
    const exclusions = { unapproved_sender: 0, missing_diarization: 0, multiple_speakers: 0, unreadable: 0 };
    const accepted = [];

    for (const file of fs.readdirSync(surfaceDir).filter(name => name.endsWith('.json'))) {
        const base = path.basename(file, '.json');
        const meta = manifestByBase.get(base);
        if (!meta || !ALLOWED_SENDERS.has(meta.sender)) {
            exclusions.unapproved_sender += 1;
            continue;
        }
        let surface;
        try {
            surface = JSON.parse(fs.readFileSync(path.join(surfaceDir, file), 'utf8'));
        } catch {
            exclusions.unreadable += 1;
            continue;
        }
        const diarizedPath = path.join(diarizedDir, file);
        if (!fs.existsSync(diarizedPath)) {
            exclusions.missing_diarization += 1;
            if (strictSingleSpeaker) continue;
        } else {
            let diarized;
            try {
                diarized = JSON.parse(fs.readFileSync(diarizedPath, 'utf8'));
            } catch {
                exclusions.unreadable += 1;
                continue;
            }
            if (!isSingleSpeaker(diarized)) {
                exclusions.multiple_speakers += 1;
                continue;
            }
        }
        const tokens = words(surface.text || '');
        if (!tokens.length) continue;
        accepted.push({ year: Number(String(meta.sent_at_utc || '').slice(0, 4)), tokens });
        for (const token of tokens) counters.set(token, (counters.get(token) || 0) + 1);
        const opening = classifyOpening(tokens);
        openings.set(opening, (openings.get(opening) || 0) + 1);
    }

    const flattened = accepted.flatMap(note => note.tokens);
    const trackedPhrases = [
        'how ya going', 'how ya goin', 'how are you going', 'so yeah', 'yeah so',
        'you know', 'i mean', 'i think', 'i feel like', 'and then', 'i dunno', "i don't know",
    ];
    for (const phrase of trackedPhrases) phraseCounters.set(phrase, phraseCount(flattened, phrase));
    const trackedForms = [
        'yeah', 'so', 'um', 'umm', 'uh', 'ah', 'ahh', 'ya', 'goin', 'gonna', 'wanna',
        'gotta', 'kinda', 'cos', 'dunno', 'reckon', 'bro', 'man', 'mate', 'just', 'right',
    ];
    const forms = Object.fromEntries(trackedForms.map(form => [form, counters.get(form) || 0]));

    const eras = {};
    for (const [label, predicate] of [
        ['2020-2022', year => year <= 2022],
        ['2023-2024', year => year >= 2023 && year <= 2024],
        ['2025-2026', year => year >= 2025],
    ]) {
        const tokens = accepted.filter(note => predicate(note.year)).flatMap(note => note.tokens);
        const counts = new Map();
        for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
        eras[label] = {
            notes: accepted.filter(note => predicate(note.year)).length,
            words: tokens.length,
            per_1000_words: Object.fromEntries(trackedForms.map(form => [
                form,
                Number((((counts.get(form) || 0) / Math.max(1, tokens.length)) * 1000).toFixed(2)),
            ])),
        };
    }

    return {
        generated_at: new Date().toISOString(),
        privacy: 'Aggregate output only. No transcript text or recipient names are emitted.',
        strict_single_speaker: strictSingleSpeaker,
        allowed_sender_labels: [...ALLOWED_SENDERS],
        accepted_notes: accepted.length,
        accepted_words: flattened.length,
        exclusions,
        forms,
        phrases: Object.fromEntries(phraseCounters),
        openings: Object.fromEntries(openings),
        eras,
    };
}

if (require.main === module) {
    const args = parseArgs(process.argv.slice(2));
    if (!args.manifest || !args['surface-dir'] || !args['diarized-dir']) {
        console.error('Usage: node scripts/analyze-shannon-spoken-voice.js --manifest <csv> --surface-dir <dir> --diarized-dir <dir> [--out <json>] [--allow-missing-diarization]');
        process.exit(2);
    }
    const result = analyze({
        manifestPath: path.resolve(args.manifest),
        surfaceDir: path.resolve(args['surface-dir']),
        diarizedDir: path.resolve(args['diarized-dir']),
        strictSingleSpeaker: !args['allow-missing-diarization'],
    });
    const output = `${JSON.stringify(result, null, 2)}\n`;
    if (args.out) fs.writeFileSync(path.resolve(args.out), output, 'utf8');
    else process.stdout.write(output);
}

module.exports = { ALLOWED_SENDERS, analyze, classifyOpening, isSingleSpeaker, parseCsv, phraseCount, uniqueSpeakers, words };
