#!/usr/bin/env node
/**
 * Dry-run every coach-draft pipeline against REAL production data, print
 * the Vertex output, and make ZERO changes — no coach_alerts inserts, no
 * pushes, no memory writes. Use this to sanity-check what the scheduled
 * functions would produce tomorrow morning before they actually run.
 *
 * Usage:
 *   node scripts/dry-run-drafts.js
 *       Runs the default suite: Hannah (new client) + Danny (in challenge
 *       with Shannon). Exercises every draft type against both.
 *
 *   node scripts/dry-run-drafts.js --client=<uuid>
 *       Run every draft type for one specific client.
 *
 *   node scripts/dry-run-drafts.js --type=morning_pulse
 *       Run ONE draft type across the default clients. Valid types:
 *       morning_pulse, first_workout, onboarding_welcome,
 *       onboarding_day_3, weekly_checkin, weekly_digest, plateau
 *
 *   node scripts/dry-run-drafts.js --recent
 *       Print the last 24h of coach_alerts (no draft generation) so you can
 *       see what the system has already produced.
 *
 * Env required (matches Netlify's runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_SERVICE_ACCOUNT (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID)
 *   GEMINI_API_KEY (used only as fallback; optional if Vertex is available)
 *
 * Zero side effects: every network call either READs from Supabase or
 * POSTs to Vertex. Nothing is inserted into coach_alerts or nudges.
 */

const {
    supabaseQuery,
    loadClientMemory,
    buildMemoryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
} = require('../netlify/functions/_lib/client-context');

const DAY_MS = 24 * 60 * 60 * 1000;

// Default test clients
const DEFAULTS = {
    shannon: '00a6605e-8edb-4917-85ba-24a23f179059', // coach
    hannah:  'eb8e3523-9b9a-4886-9a45-6946ec59f68e', // new client, mid-conversation
    danny:   'aa243b50-e62d-4a7f-ab88-93ce3d37d952', // client, in challenge with Shannon
};

// ============================================================
// CLI parsing
// ============================================================

function parseArgs() {
    const out = { client: null, type: null, recent: false };
    for (const a of process.argv.slice(2)) {
        if (a === '--recent') out.recent = true;
        else if (a.startsWith('--client=')) out.client = a.slice('--client='.length);
        else if (a.startsWith('--type=')) out.type = a.slice('--type='.length);
    }
    return out;
}

// ============================================================
// Pretty printers
// ============================================================

const COLORS = {
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

function header(text) {
    const line = '━'.repeat(Math.max(60, text.length + 4));
    return `\n${COLORS.cyan}${COLORS.bold}${line}${COLORS.reset}\n${COLORS.cyan}${COLORS.bold}  ${text}${COLORS.reset}\n${COLORS.cyan}${COLORS.bold}${line}${COLORS.reset}\n`;
}

function sub(text) {
    return `\n${COLORS.magenta}▸ ${text}${COLORS.reset}\n`;
}

function ok(text)    { return `${COLORS.green}✓${COLORS.reset} ${text}`; }
function skip(text)  { return `${COLORS.gray}○ skipped: ${text}${COLORS.reset}`; }
function warn(text)  { return `${COLORS.yellow}⚠ ${text}${COLORS.reset}`; }
function err(text)   { return `${COLORS.red}✗ ${text}${COLORS.reset}`; }
function draftBlock(text) {
    if (!text) return err('(no draft text — Vertex + Gemini both failed)');
    return `${COLORS.green}┃${COLORS.reset} ${text.split('\n').join(`\n${COLORS.green}┃${COLORS.reset} `)}`;
}

// ============================================================
// Client context loading
// ============================================================

async function loadClientContext(clientId, coachId) {
    const [users, uf, memory] = await Promise.all([
        supabaseQuery(`users?select=id,name,email&id=eq.${clientId}&limit=1`).catch(() => []),
        supabaseQuery(`user_facts?select=personal_details&user_id=eq.${clientId}&limit=1`).catch(() => []),
        loadClientMemory(coachId, clientId),
    ]);
    const user = users[0];
    return {
        id: clientId,
        name: user?.name || user?.email?.split('@')[0] || 'Client',
        email: user?.email,
        personalDetails: uf[0]?.personal_details || {},
        memory,
        memoryBlock: buildMemoryBlock(memory),
    };
}

// ============================================================
// Generic draft runner
// ============================================================

async function runDraft(label, promptText, config = {}) {
    console.log(sub(label));
    const contents = [{ role: 'user', parts: [{ text: promptText }] }];
    const generationConfig = { maxOutputTokens: 320, temperature: 0.85, ...config };

    let draftText = '';
    let model = 'none';
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        draftText = stripLeadingGreeting(reply);
        model = 'vertex-v7';
    } catch (e) {
        try {
            const reply = await callGeminiFallback(contents, generationConfig);
            draftText = stripLeadingGreeting(reply);
            model = 'gemini-2.0-fallback';
        } catch (e2) {
            console.log(err(`Both Vertex and Gemini failed: ${e.message} / ${e2.message}`));
            return;
        }
    }
    console.log(ok(`model: ${model}`));
    console.log(draftBlock(draftText));
}

// ============================================================
// Draft-type: morning pulse (with challenge detection)
// ============================================================

async function findBanterChallenge(clientId, coachId) {
    const myRows = await supabaseQuery(
        `challenge_participants?select=challenge_id,user_id,current_points,challenge_points,status&user_id=eq.${clientId}&status=eq.accepted&limit=20`
    ).catch(() => []);
    if (!myRows.length) return null;
    const idList = myRows.map(r => `"${r.challenge_id}"`).join(',');
    const challenges = await supabaseQuery(
        `challenges?select=id,name,challenge_type,status,end_date&id=in.(${idList})&status=eq.active&limit=20`
    ).catch(() => []);
    if (!challenges.length) return null;
    const active = challenges.map(c => c.id);
    const activeList = active.map(id => `"${id}"`).join(',');
    const allP = await supabaseQuery(
        `challenge_participants?select=challenge_id,user_id,current_points,challenge_points,status&challenge_id=in.(${activeList})&status=eq.accepted&limit=500`
    ).catch(() => []);
    const byC = new Map();
    for (const p of allP) {
        if (!byC.has(p.challenge_id)) byC.set(p.challenge_id, []);
        byC.get(p.challenge_id).push(p);
    }
    for (const [, arr] of byC) {
        arr.sort((a, b) => (b.challenge_points || b.current_points || 0) - (a.challenge_points || a.current_points || 0));
    }
    const scored = [];
    for (const c of challenges) {
        const ps = byC.get(c.id) || [];
        if (ps.length < 2) continue;
        const clientRow = ps.find(p => p.user_id === clientId);
        if (!clientRow) continue;
        const coachRow = ps.find(p => p.user_id === coachId);
        const coachIn = !!coachRow;
        const leader = ps[0];
        const clientScore = clientRow.challenge_points || clientRow.current_points || 0;
        const daysLeft = c.end_date ? Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / DAY_MS)) : null;
        let interest = 0;
        if (coachIn) {
            interest += 100;
            const coachScore = coachRow.challenge_points || coachRow.current_points || 0;
            interest += Math.max(0, 50 - Math.abs(coachScore - clientScore));
        } else {
            const rank = ps.findIndex(p => p.user_id === clientId) + 1;
            if (rank === 1) interest += 40;
            else if (rank === ps.length) interest += 15;
            else interest += 25;
            interest += Math.max(0, 30 - Math.abs((leader.challenge_points || leader.current_points || 0) - clientScore));
        }
        if (daysLeft !== null && daysLeft <= 3) interest += 25;
        scored.push({ challenge: c, participants: ps, coachIn, coachRow, clientRow, leader, daysLeft, interestScore: interest });
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.interestScore - a.interestScore);
    return scored[0];
}

async function dryRunMorningPulse({ client, coachId }) {
    console.log(header(`MORNING PULSE — ${client.name}`));

    const banter = await findBanterChallenge(client.id, coachId);
    let challengeBlock = '', toneOverride = '', signalLine = '(no challenge signal — would fall through to other morning-pulse signals like streak, quiet, cycle, momentum)';

    if (banter) {
        const coachScore = banter.coachRow?.challenge_points || banter.coachRow?.current_points || 0;
        const clientScore = banter.clientRow.challenge_points || banter.clientRow.current_points || 0;
        const daysLeft = banter.daysLeft !== null ? `${banter.daysLeft}d left` : 'ongoing';

        const names = await supabaseQuery(
            `users?select=id,name,email&id=in.(${banter.participants.map(p => `"${p.user_id}"`).join(',')})`
        ).catch(() => []);
        const nameMap = new Map(names.map(u => [u.id, u.name || u.email?.split('@')[0] || 'Someone']));
        const leaderboard = banter.participants.slice(0, 3).map((p, i) => {
            const n = nameMap.get(p.user_id) || 'Someone';
            const pts = p.challenge_points || p.current_points || 0;
            return `${i + 1}. ${n} ${pts}pts`;
        }).join('  ');

        if (banter.coachIn) {
            const diff = coachScore - clientScore;
            signalLine = diff === 0
                ? `Neck-and-neck with ${client.name} in "${banter.challenge.name}" (${daysLeft}).`
                : diff > 0
                    ? `Shannon leads "${banter.challenge.name}" by ${diff}pts vs ${client.name} (${daysLeft}) — trash-talk mode.`
                    : `Behind in "${banter.challenge.name}" by ${Math.abs(diff)}pts (${daysLeft}) — rev them anyway.`;
            toneOverride = `\n\nTONE — TRASH TALK MODE: Shannon is IN this challenge with ${client.name}. Banter is EXPECTED — playful, a bit cocky when ahead, humbled when behind. Examples: "bro ur killing it but im still gonna whoop ya", "oi ur ahead of me, not for long", "3 days left don't let me take this". Aussie casual, under 2 sentences. Profanity welcome, never mean.`;
        } else {
            const rank = banter.participants.findIndex(p => p.user_id === client.id) + 1;
            signalLine = `In "${banter.challenge.name}" — rank ${rank}/${banter.participants.length}, ${daysLeft}.`;
            toneOverride = `\n\nTONE — HYPE MODE: Shannon is NOT in this challenge. Cheer from the sidelines, reference leaderboard position. 1-2 sentences. Do NOT pretend to compete.`;
        }

        challengeBlock = `\n\nCHALLENGE CONTEXT:\nName: "${banter.challenge.name}" (${banter.challenge.challenge_type})\n${daysLeft}\nLeaderboard: ${leaderboard}`;

        console.log(ok(`Challenge detected: "${banter.challenge.name}" — coachIn=${banter.coachIn}, interestScore=${banter.interestScore}`));
    } else {
        console.log(warn('No active challenge'));
    }

    const prompt = `Draft a SHORT morning check-in from Shannon to a client. This is a proactive good-morning ping — not a reply.

CRITICAL — DO NOT GREET with "hey [name]", "morning [name]", "hi". Jump straight into content with warm morning energy. Aussie casual, 1-2 sentences max.

CLIENT: ${client.name}${client.memoryBlock || ''}${challengeBlock}

WHY SHANNON IS REACHING OUT:
${signalLine}${toneOverride}

Reply with just the message text — no quotes, no commentary, no labels.`;

    await runDraft('Vertex draft →', prompt, { maxOutputTokens: 256 });
}

// ============================================================
// Draft-type: first workout celebration
// ============================================================

async function dryRunFirstWorkout({ client, coachId }) {
    console.log(header(`FIRST WORKOUT CELEBRATION — ${client.name}`));
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });
    const templateName = '[simulated] bw-upper'; // pretend they just logged this
    const prompt = `Draft a SHORT message celebrating a client logging their very first workout with Shannon.

CRITICAL — DO NOT GREET. Warm, not hype-level. 1-2 sentences.

They just logged their FIRST workout: "${templateName}".

CLIENT: ${client.name}${client.memoryBlock || ''}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;
    await runDraft('Vertex draft →', prompt, { maxOutputTokens: 256 });
}

// ============================================================
// Draft-type: onboarding welcome (day 0)
// ============================================================

async function dryRunOnboardingWelcome({ client, coachId }) {
    console.log(header(`ONBOARDING WELCOME (Day 0) — ${client.name}`));
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });
    const pd = client.personalDetails;
    const facts = [];
    if (pd.weight && pd.goal_weight) facts.push(`Weight: ${pd.weight}kg → goal ${pd.goal_weight}kg`);
    if (pd.training_frequency) facts.push(`Training: ${pd.training_frequency}x/week`);
    if (pd.equipment_access) facts.push(`Equipment: ${pd.equipment_access}`);
    if (pd.dietary_preference) facts.push(`Diet: ${pd.dietary_preference}`);
    if (pd.profile) facts.push(`Profile: ${pd.profile}`);

    const prompt = `Draft a SHORT welcome message for a brand new client.

CRITICAL — DO NOT GREET. Reference ONE specific thing from their onboarding or memory. Ask ONE open question. Aussie casual, max 2-3 sentences.

CLIENT: ${client.name}${client.memoryBlock || ''}

ONBOARDING FACTS:
${facts.length ? facts.join('\n') : '(none captured)'}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;
    await runDraft('Vertex draft →', prompt, { maxOutputTokens: 320 });
}

// ============================================================
// Draft-type: onboarding day 3
// ============================================================

async function dryRunOnboardingDay3({ client, coachId }) {
    console.log(header(`ONBOARDING DAY 3 — ${client.name}`));
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });
    const since = new Date(Date.now() - 3 * DAY_MS).toISOString();
    const workouts = await loadRecentWorkouts(client.id, since, 10);
    const activity = workouts.length
        ? `${workouts.length} workouts logged (${[...new Set(workouts.map(w => w.templateName))].slice(0, 3).join(', ')})`
        : '0 workouts logged';

    const prompt = `Draft a SHORT day-3 check-in from Shannon to a client 3 days into coaching.

CRITICAL — DO NOT GREET. Reference activity below if any. If they've logged something, acknowledge. If not, gentle nudge + open question. Aussie casual, 1-2 sentences.

CLIENT: ${client.name}${client.memoryBlock || ''}

ACTIVITY THIS PAST THREE DAYS:
${activity}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;
    await runDraft('Vertex draft →', prompt, { maxOutputTokens: 320 });
}

// ============================================================
// Draft-type: weekly check-in (post day-30)
// ============================================================

async function dryRunWeeklyCheckin({ client, coachId }) {
    console.log(header(`WEEKLY CHECK-IN (post day-30) — ${client.name}`));
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const [workouts, pbs, weighIns, mood] = await Promise.all([
        loadRecentWorkouts(client.id, since, 20),
        supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value&user_id=eq.${client.id}&achieved_at=gte.${since}&limit=10`).catch(() => []),
        supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${client.id}&created_at=gte.${since}&order=created_at.asc&limit=10`).catch(() => []),
        supabaseQuery(`mood_logs?select=mood_score&user_id=eq.${client.id}&created_at=gte.${since}&limit=10`).catch(() => []),
    ]);
    const lines = [];
    lines.push(workouts.length
        ? `${workouts.length} workouts${[...new Set(workouts.map(w => w.templateName))].slice(0, 3).join(', ') ? ' (' + [...new Set(workouts.map(w => w.templateName))].slice(0, 3).join(', ') + ')' : ''}`
        : '0 workouts logged');
    if (pbs.length) lines.push(`${pbs.length} PB(s): ${pbs.slice(0, 3).map(p => p.exercise_name).join(', ')}`);
    if (weighIns.length >= 2) {
        const diff = Math.round((weighIns[weighIns.length - 1].weight - weighIns[0].weight) * 10) / 10;
        if (Math.abs(diff) > 0) lines.push(`Weight: ${weighIns[0].weight}kg → ${weighIns[weighIns.length - 1].weight}kg (${diff > 0 ? '+' : ''}${diff}kg)`);
    }
    if (mood.length) {
        const avg = Math.round((mood.reduce((s, m) => s + (m.mood_score || 0), 0) / mood.length) * 10) / 10;
        lines.push(`Mood avg ${avg}/10`);
    }
    const activity = lines.join('\n');

    const prompt = `Draft a SHORT ongoing weekly check-in from Shannon to a client.

CRITICAL — DO NOT GREET. Reference specific activity below. Aussie casual, 2-3 sentences, end with ONE open question.

CLIENT: ${client.name}${client.memoryBlock || ''}

THIS WEEK'S ACTIVITY:
${activity}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;
    await runDraft('Vertex draft →', prompt, { maxOutputTokens: 320 });
}

// ============================================================
// Draft-type: weekly coach digest (COACH-FACING planning note)
// ============================================================

async function dryRunWeeklyDigest({ client, coachId }) {
    console.log(header(`WEEKLY COACH DIGEST — ${client.name}`));
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const sincePrev = new Date(Date.now() - 14 * DAY_MS).toISOString();
    const [workouts, pbs, weighIns, mood, dms] = await Promise.all([
        loadRecentWorkouts(client.id, since, 30),
        supabaseQuery(`pb_history?select=id&user_id=eq.${client.id}&achieved_at=gte.${since}&limit=10`).catch(() => []),
        supabaseQuery(`daily_weigh_ins?select=weight&user_id=eq.${client.id}&created_at=gte.${sincePrev}&order=created_at.asc&limit=20`).catch(() => []),
        supabaseQuery(`mood_logs?select=mood_score&user_id=eq.${client.id}&created_at=gte.${since}&limit=20`).catch(() => []),
        supabaseQuery(`nudges?select=id&sender_id=eq.${client.id}&created_at=gte.${since}&limit=50`).catch(() => []),
    ]);
    const lines = [
        `Workouts this week: ${workouts.length}`,
        `PBs: ${pbs.length}`,
        `DMs from client: ${dms.length}`,
    ];
    if (weighIns.length >= 2) {
        const diff = Math.round((weighIns[weighIns.length - 1].weight - weighIns[0].weight) * 10) / 10;
        lines.push(`Weight: ${weighIns[0].weight}kg → ${weighIns[weighIns.length - 1].weight}kg (${diff > 0 ? '+' : ''}${diff}kg)`);
    }
    if (mood.length) {
        const avg = Math.round((mood.reduce((s, m) => s + (m.mood_score || 0), 0) / mood.length) * 10) / 10;
        lines.push(`Mood avg ${avg}/10`);
    }
    const snapshot = lines.join('\n');

    const prompt = `You're writing Shannon's weekly planning note about a coaching client — this goes in HIS Monday prep, NOT to the client.

Voice: Shannon's internal thinking-out-loud. Terse, bullet points.

Produce:
  1. 2-3 bullets ASSESSMENT
  2. ONE specific FOCUS NEXT WEEK
  3. Flag any ACTION

Under 120 words total.

CLIENT: ${client.name}${client.memoryBlock || ''}

LAST 7 DAYS:
${snapshot}

Return as plain text, use markdown bullets (- …).`;
    await runDraft('Vertex planning note →', prompt, { maxOutputTokens: 400, temperature: 0.55 });
}

// ============================================================
// Draft-type: plateau reassess
// ============================================================

async function dryRunPlateau({ client, coachId }) {
    console.log(header(`PLATEAU REASSESS — ${client.name}`));
    const since14 = new Date(Date.now() - 14 * DAY_MS).toISOString();
    const since21 = new Date(Date.now() - 21 * DAY_MS).toISOString();
    const [weighIns, pbs21, workouts21] = await Promise.all([
        supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${client.id}&created_at=gte.${since14}&order=created_at.asc&limit=30`).catch(() => []),
        supabaseQuery(`pb_history?select=id&user_id=eq.${client.id}&achieved_at=gte.${since21}&limit=10`).catch(() => []),
        loadRecentWorkouts(client.id, since21, 30),
    ]);

    // Re-detect signal
    const goalWeight = client.personalDetails?.goal_weight;
    let signal = null;
    if (weighIns.length >= 3 && goalWeight != null) {
        const weights = weighIns.map(w => Number(w.weight)).filter(n => !isNaN(n));
        if (weights.length >= 3) {
            const range = Math.round((Math.max(...weights) - Math.min(...weights)) * 10) / 10;
            const movedToward = Math.abs(weights[0] - goalWeight) - Math.abs(weights[weights.length - 1] - goalWeight);
            if (range <= 0.5 && Math.abs(movedToward) <= 0.3 && pbs21.length === 0) {
                signal = { type: 'weight_plateau', reason: `${weighIns.length} weigh-ins, range ${range}kg, 0 PBs in 14d` };
            }
        }
    }
    if (!signal && workouts21.length >= 8 && pbs21.length === 0) {
        signal = { type: 'strength_plateau', reason: `${workouts21.length} workouts in 21d, 0 PBs` };
    }
    if (!signal) {
        console.log(skip(`${client.name} has no plateau signal (workouts=${workouts21.length}, pbs21d=${pbs21.length}, weighIns=${weighIns.length}, goal=${goalWeight ?? 'n/a'})`));
        return;
    }
    console.log(ok(`Signal: ${signal.type} — ${signal.reason}`));

    const typeBrief = signal.type === 'weight_plateau'
        ? `Weight stuck. 2 weeks no movement toward goal. Reassess moment.`
        : `Training hard but 0 PBs in 3 weeks. Program probably needs a change.`;

    const prompt = `Draft a SHORT "let's reassess" message from Shannon to a plateaued client.

CRITICAL — DO NOT GREET. Honest observation + invite to reassess, NOT blame. 2-3 sentences.

${typeBrief}

THE DATA: ${signal.reason}

CLIENT: ${client.name}${client.memoryBlock || ''}

Reply with just the message text — no quotes, no commentary, no labels.`;
    await runDraft('Vertex draft →', prompt, { maxOutputTokens: 320, temperature: 0.75 });
}

// ============================================================
// Show recent coach_alerts (no draft generation)
// ============================================================

async function showRecentAlerts() {
    console.log(header('RECENT COACH ALERTS (last 24h)'));
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const alerts = await supabaseQuery(
        `coach_alerts?select=id,alert_type,priority,status,title,client_name,created_at,suggested_message&created_at=gte.${since}&order=created_at.desc&limit=50`
    );
    if (!alerts.length) {
        console.log(skip('No alerts in the last 24h'));
        return;
    }
    for (const a of alerts) {
        const t = new Date(a.created_at).toISOString().slice(11, 16) + 'Z';
        const status = a.status === 'sent' ? COLORS.green + '[sent]' + COLORS.reset
            : a.status === 'dismissed' ? COLORS.gray + '[dismissed]' + COLORS.reset
            : COLORS.yellow + '[pending]' + COLORS.reset;
        console.log(`${t}  ${status}  ${a.alert_type.padEnd(22)} ${(a.client_name || '').padEnd(16)} ${a.title}`);
        if (a.suggested_message) {
            const preview = a.suggested_message.length > 80 ? a.suggested_message.slice(0, 77) + '…' : a.suggested_message;
            console.log(`           ${COLORS.gray}→ ${preview}${COLORS.reset}`);
        }
    }
    console.log(`\n${alerts.length} alerts total.`);
}

// ============================================================
// Dispatcher
// ============================================================

const DRAFT_TYPES = {
    morning_pulse:        dryRunMorningPulse,
    first_workout:        dryRunFirstWorkout,
    onboarding_welcome:   dryRunOnboardingWelcome,
    onboarding_day_3:     dryRunOnboardingDay3,
    weekly_checkin:       dryRunWeeklyCheckin,
    weekly_digest:        dryRunWeeklyDigest,
    plateau:              dryRunPlateau,
};

async function main() {
    const args = parseArgs();

    // Preflight env check
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error(err('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env.'));
        console.error(`\nSet them before running:\n  SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/dry-run-drafts.js`);
        process.exit(2);
    }

    if (args.recent) {
        await showRecentAlerts();
        return;
    }

    const coachId = DEFAULTS.shannon;
    const typesToRun = args.type ? [args.type] : Object.keys(DRAFT_TYPES);
    for (const t of typesToRun) {
        if (!DRAFT_TYPES[t]) {
            console.error(err(`Unknown --type=${t}. Valid: ${Object.keys(DRAFT_TYPES).join(', ')}`));
            process.exit(2);
        }
    }

    const clientIds = args.client ? [args.client] : [DEFAULTS.hannah, DEFAULTS.danny];

    console.log(`\n${COLORS.bold}Coach Draft Dry-Run${COLORS.reset}`);
    console.log(`${COLORS.gray}coach: ${coachId}${COLORS.reset}`);
    console.log(`${COLORS.gray}clients: ${clientIds.join(', ')}${COLORS.reset}`);
    console.log(`${COLORS.gray}types: ${typesToRun.join(', ')}${COLORS.reset}`);
    console.log(`${COLORS.gray}side effects: NONE (no alert inserts, no pushes)${COLORS.reset}`);

    for (const clientId of clientIds) {
        const client = await loadClientContext(clientId, coachId);
        console.log(`\n${COLORS.bold}${COLORS.cyan}════ ${client.name} (${clientId.slice(0, 8)}) ════${COLORS.reset}`);
        if (client.memory) {
            console.log(ok(`Memory loaded: ${[client.memory.goals && 'goals', client.memory.communication_style && 'style', client.memory.running_notes && `running_notes (${client.memory.running_notes.split('\n').length} lines)`].filter(Boolean).join(', ') || '(empty)'}`));
        } else {
            console.log(warn('No client_memory row yet'));
        }

        for (const type of typesToRun) {
            try {
                await DRAFT_TYPES[type]({ client, coachId });
            } catch (e) {
                console.log(err(`${type} threw: ${e.message}`));
            }
        }
    }

    console.log(`\n${COLORS.green}Done. All drafts generated against real data, zero side effects.${COLORS.reset}\n`);
}

main().catch(e => {
    console.error(err(`FATAL: ${e.message}`));
    console.error(e.stack);
    process.exit(1);
});
