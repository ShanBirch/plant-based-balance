import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import growthOutcomes from '../netlify/functions/_lib/growth-outcomes.js';

const {
    buildStoryCommentImportRows,
} = growthOutcomes;

const DEFAULT_JSONL = 'C:/Users/shann/OneDrive/Desktop/instagram_story_bot_from_hard_drive/story_comment_probe_candidates.jsonl';
const SUPABASE_URL = cleanEnv('SUPABASE_URL') || cleanEnv('VITE_SUPABASE_URL') || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = cleanEnv('SUPABASE_SERVICE_ROLE_KEY') || cleanEnv('SUPABASE_SERVICE_KEY');

function cleanEnv(name) {
    return String(process.env[name] || '').trim();
}

function argValue(name, fallback = '') {
    const prefix = `--${name}=`;
    const hit = process.argv.find(arg => arg.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : fallback;
}

function argFlag(name) {
    return process.argv.includes(`--${name}`);
}

function parseDate(value) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    const date = new Date(clean.includes('T') ? clean : `${clean}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) ? date : null;
}

function rowDate(row) {
    const raw = row?.created_at || row?.send_dedupe_local_date || '';
    const date = parseDate(raw);
    return date || null;
}

function shouldImport(row, { since, account, includeZero }) {
    if (account && String(row?.bot_account || '') !== account) return false;
    const date = rowDate(row);
    if (since && (!date || date < since)) return false;
    if (includeZero) return true;
    return ['sent', 'send_attempt_started', 'liked_story_fallback', 'already_liked_story_fallback', 'like_attempt_started']
        .includes(String(row?.send_status || ''));
}

async function supabase(pathname, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
    const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${pathname}`, {
        method,
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: prefer,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : [];
}

async function postBatch(pathname, rows) {
    if (!rows.length) return 0;
    await supabase(pathname, {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: rows,
    });
    return rows.length;
}

export async function importStoryCommentOutcomes(options = {}) {
    const file = options.file || DEFAULT_JSONL;
    const since = parseDate(options.since);
    const account = String(options.account || '').trim();
    const includeZero = Boolean(options.includeZero);
    const batchSize = Math.max(1, Math.min(500, Number(options.batchSize) || 200));
    const limit = Math.max(0, Number(options.limit) || 0);

    const outreachBatch = [];
    const outcomeBatch = [];
    const seenOutreachKeys = new Set();
    const seenOutcomeKeys = new Set();
    const counts = {
        file,
        scanned: 0,
        parsed: 0,
        skipped: 0,
        duplicate_keys: 0,
        outreach_upserts: 0,
        outcome_upserts: 0,
        bad_json: 0,
    };

    async function flush() {
        counts.outreach_upserts += await postBatch(
            'story_comment_outreach_events?on_conflict=event_key',
            outreachBatch.splice(0)
        );
        counts.outcome_upserts += await postBatch(
            'growth_outcome_events?on_conflict=event_key',
            outcomeBatch.splice(0)
        );
    }

    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line.trim()) continue;
        counts.scanned += 1;
        let row;
        try {
            row = JSON.parse(line);
        } catch {
            counts.bad_json += 1;
            continue;
        }
        counts.parsed += 1;
        if (!shouldImport(row, { since, account, includeZero })) {
            counts.skipped += 1;
            continue;
        }
        const { outreach, outcome } = buildStoryCommentImportRows(row);
        let duplicate = false;
        if (seenOutreachKeys.has(outreach.event_key)) {
            duplicate = true;
        } else {
            seenOutreachKeys.add(outreach.event_key);
            outreachBatch.push(outreach);
        }
        if (seenOutcomeKeys.has(outcome.event_key)) {
            duplicate = true;
        } else {
            seenOutcomeKeys.add(outcome.event_key);
            outcomeBatch.push(outcome);
        }
        if (duplicate) counts.duplicate_keys += 1;
        if (outreachBatch.length >= batchSize || outcomeBatch.length >= batchSize) await flush();
        if (limit && counts.outreach_upserts + outreachBatch.length >= limit) break;
    }
    await flush();
    return counts;
}

function usage() {
    const script = path.relative(process.cwd(), fileURLToPath(import.meta.url));
    return [
        `Usage: node ${script} [--file=<jsonl>] [--since=YYYY-MM-DD] [--account=shan_n_sunny] [--include-zero] [--limit=1000]`,
        '',
        'Defaults to the local story_comment_probe_candidates.jsonl path.',
        'Without --include-zero, imports only cap-counting sends and like fallbacks.',
    ].join('\n');
}

const isMain = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isMain) {
    if (argFlag('help')) {
        console.log(usage());
        process.exit(0);
    }
    importStoryCommentOutcomes({
        file: argValue('file', DEFAULT_JSONL),
        since: argValue('since', ''),
        account: argValue('account', 'shan_n_sunny'),
        includeZero: argFlag('include-zero'),
        batchSize: Number(argValue('batch-size', '200')),
        limit: Number(argValue('limit', '0')),
    }).then(result => {
        console.log(JSON.stringify(result, null, 2));
    }).catch(error => {
        console.error(error?.stack || error?.message || error);
        process.exit(1);
    });
}
