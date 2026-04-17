/**
 * Morning Pulse — Scheduled Daily Scan
 *
 * Once per day in the clients' morning, scan every active coach_clients row
 * for "worth reaching out about" signals and generate up to MAX_PULSES_PER_DAY
 * drafted check-ins. Each draft lands as a coach_draft_ready push so Shannon
 * can tap-and-send from the lockscreen with his morning coffee.
 *
 * Signals considered (in priority order):
 *   1. HIGH    — missed scheduled workout yesterday (training_calendar vs log)
 *   2. HIGH    — streak at risk (5+ day streak broken yesterday)
 *   3. HIGH    — challenge vs Shannon (client is in an active challenge with
 *               Shannon — trash talk / banter mode)
 *   4. MEDIUM  — low mood trend (avg mood_score < 5 over last 3 days)
 *   5. MEDIUM  — quiet client (no DM 5+ days AND no workout 3+ days)
 *   6. MEDIUM  — challenge solo (client is in an active challenge without
 *               Shannon — hype them on their competition)
 *   7. LOW     — cycle check-in (within 24h of period start, if cycle_sync=yes)
 *   8. LOW     — momentum reinforcement (2+ PBs or 5+ workouts in last 7 days)
 *
 * Caps at 10 pulses per day to avoid lockscreen fatigue. Dedups against:
 *   - any pending coach_alert for the same client (don't pile on)
 *   - any morning_pulse fired for the same client in the last 20 hours
 *
 * Schedule: daily at 19:17 UTC ≈ 5:17 AEST (April AEST; ~6:17 AEDT during DST).
 * Wired in netlify.toml.
 */

const {
    supabaseQuery,
    loadClientMemory,
    maybeAutoSendDraft,
    buildMemoryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    recentlyMessaged,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const MAX_PULSES_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Signal detection
// ============================================================

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function yesterdayDayName() {
    const d = new Date(Date.now() - DAY_MS);
    return DAY_NAMES[d.getDay()];
}

/**
 * Find the most "banter-worthy" active challenge this client is in.
 * Returns { challenge, participants, coachIn, leader, clientRow, coachRow, daysLeft } or null.
 *
 * Selection priority:
 *   1. If coach is in any active challenge with client → pick the one with the
 *      smallest absolute point gap (most trash-talkable)
 *   2. Otherwise pick the client's most recently-active challenge with ≥1
 *      other participant (so there's actual competition to talk about)
 */
async function findBanterChallenge(clientId, coachId) {
    // 1. Challenges the client is actively participating in. Valid
    // participant statuses are 'accepted' (in), 'invited', 'declined',
    // 'left'. 'accepted' is the only "currently competing" state.
    const myRows = await supabaseQuery(
        `challenge_participants?select=challenge_id,user_id,current_points,challenge_points,status&user_id=eq.${clientId}&status=eq.accepted&limit=20`
    ).catch(() => []);
    if (!myRows.length) return null;
    const challengeIds = myRows.map(r => r.challenge_id);
    if (!challengeIds.length) return null;

    // Filter to challenges that are currently active (the challenge itself,
    // not the participant row — uses challenges.status)
    const idList = challengeIds.map(id => `"${id}"`).join(',');
    const challenges = await supabaseQuery(
        `challenges?select=id,name,challenge_type,status,start_date,end_date&id=in.(${idList})&status=eq.active&limit=20`
    ).catch(() => []);
    if (!challenges.length) return null;

    // 2. Pull ALL accepted participants for those challenges to compute
    // leaderboards
    const activeIds = challenges.map(c => c.id);
    const activeIdList = activeIds.map(id => `"${id}"`).join(',');
    const allParticipants = await supabaseQuery(
        `challenge_participants?select=challenge_id,user_id,current_points,challenge_points,status&challenge_id=in.(${activeIdList})&status=eq.accepted&limit=500`
    ).catch(() => []);

    // Group by challenge + sort leaderboard desc by challenge_points (fallback current_points)
    const byChallenge = new Map();
    for (const p of allParticipants) {
        if (!byChallenge.has(p.challenge_id)) byChallenge.set(p.challenge_id, []);
        byChallenge.get(p.challenge_id).push(p);
    }
    for (const [, arr] of byChallenge) {
        arr.sort((a, b) => (b.challenge_points || b.current_points || 0) - (a.challenge_points || a.current_points || 0));
    }

    // 3. Rank each candidate challenge for banter-worthiness
    const scored = [];
    for (const c of challenges) {
        const participants = byChallenge.get(c.id) || [];
        if (participants.length < 2) continue; // no competition = no banter

        const clientRow = participants.find(p => p.user_id === clientId);
        if (!clientRow) continue;

        const coachRow = participants.find(p => p.user_id === coachId);
        const coachIn = !!coachRow;

        const leader = participants[0];
        const clientScore = clientRow.challenge_points || clientRow.current_points || 0;

        // Days left in challenge
        let daysLeft = null;
        if (c.end_date) {
            daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / DAY_MS));
        }

        let interestScore = 0;
        if (coachIn) {
            interestScore += 100; // coach-in challenges always top tier
            const coachScore = coachRow.challenge_points || coachRow.current_points || 0;
            const gap = Math.abs(coachScore - clientScore);
            // Smaller gap = more interesting (closer race = more banter fuel)
            interestScore += Math.max(0, 50 - gap);
        } else {
            // Client's rank in the field
            const rank = participants.findIndex(p => p.user_id === clientId) + 1;
            if (rank === 1) interestScore += 40; // client leading is always worth mentioning
            else if (rank === participants.length) interestScore += 15; // at the bottom, bit of hype
            else interestScore += 25;

            const gap = Math.abs((leader.challenge_points || leader.current_points || 0) - clientScore);
            interestScore += Math.max(0, 30 - gap);
        }

        // Final 3 days is always more interesting
        if (daysLeft !== null && daysLeft <= 3) interestScore += 25;

        scored.push({
            challenge: c,
            participants,
            coachIn,
            leader,
            clientRow,
            coachRow: coachRow || null,
            daysLeft,
            interestScore,
        });
    }

    if (!scored.length) return null;
    scored.sort((a, b) => b.interestScore - a.interestScore);
    return scored[0];
}

/**
 * Fetch display names for a list of user ids. Returns a Map<userId, displayName>.
 * Best-effort; missing ids fall back to 'Someone'.
 */
async function loadUserNames(userIds) {
    const out = new Map();
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return out;
    const inList = unique.map(id => `"${id}"`).join(',');
    try {
        const rows = await supabaseQuery(
            `users?select=id,name,email&id=in.(${inList})&limit=200`
        );
        for (const r of rows) {
            out.set(r.id, r.name || (r.email ? r.email.split('@')[0] : 'Someone'));
        }
    } catch (e) { /* fall through */ }
    return out;
}

/**
 * Render a short leaderboard summary for the draft prompt.
 * Top 3 + client's row if not in top 3. E.g.:
 *   "1. Shannon 420pts  2. Danny 395pts  3. Hannah 210pts"
 */
function formatLeaderboard(participants, nameMap, clientId) {
    const slice = participants.slice(0, 3);
    const lines = slice.map((p, i) => {
        const name = nameMap.get(p.user_id) || 'Someone';
        const pts = p.challenge_points || p.current_points || 0;
        const you = p.user_id === clientId ? ' (client)' : '';
        return `${i + 1}. ${name} ${pts}pts${you}`;
    });
    const clientRank = participants.findIndex(p => p.user_id === clientId);
    if (clientRank >= 3) {
        const p = participants[clientRank];
        const name = nameMap.get(p.user_id) || 'Client';
        const pts = p.challenge_points || p.current_points || 0;
        lines.push(`${clientRank + 1}. ${name} ${pts}pts (client)`);
    }
    return lines.join('  ');
}

/**
 * Compute the signal (if any) that should trigger a morning pulse for this
 * client, and return { priority, reason, context } — or null if nothing.
 * priority: 'high' | 'medium' | 'low'.
 */
async function detectSignals({ clientId, coachId, personalDetails }) {
    const since7d  = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const since3d  = new Date(Date.now() - 3 * DAY_MS).toISOString();
    const since24h = new Date(Date.now() - DAY_MS).toISOString();
    const since5d  = new Date(Date.now() - 5 * DAY_MS).toISOString();

    // Pull everything in parallel
    const [workouts7d, moodLogs3d, lastDmFromClient, pbs7d] = await Promise.all([
        loadRecentWorkouts(clientId, since7d, 30),
        supabaseQuery(`mood_logs?select=mood_score,created_at&user_id=eq.${clientId}&created_at=gte.${since3d}&order=created_at.desc&limit=15`).catch(() => []),
        supabaseQuery(`nudges?select=created_at&sender_id=eq.${clientId}&order=created_at.desc&limit=1`).catch(() => []),
        supabaseQuery(`pb_history?select=id&user_id=eq.${clientId}&achieved_at=gte.${since7d}&limit=10`).catch(() => []),
    ]);

    // Normalise — loadRecentWorkouts returns { templateName, completedAt, ... }
    // with one entry per (template, date) so the set is already day-unique.
    const workoutDaysSet = new Set(
        workouts7d.map(w => (w.completedAt || '').slice(0, 10))
    );
    const yest = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
    const workedOutYesterday = workoutDaysSet.has(yest);

    // Signal 1 — missed scheduled workout yesterday
    try {
        const calRaw = personalDetails?.workout_calendar;
        if (calRaw) {
            const cal = typeof calRaw === 'string' ? JSON.parse(calRaw) : calRaw;
            const scheduled = cal[yesterdayDayName()];
            // Treat "rest", "off", "yoga-rest*" etc. as not-a-workout — anything
            // starting with "yoga-rest" or named "rest"/"off"
            const isRestDay = !scheduled || /^(rest|off)$/i.test(scheduled) || /^yoga-rest/i.test(scheduled);
            if (!isRestDay && !workedOutYesterday) {
                return {
                    priority: 'high',
                    reason: `Skipped yesterday's scheduled ${scheduled} workout.`,
                    context: `Scheduled ${scheduled}, nothing logged for ${yest}.`,
                };
            }
        }
    } catch (e) { /* fall through */ }

    // Signal 2 — streak break (had 5+ consecutive days of workouts, then missed yesterday)
    if (!workedOutYesterday && workouts7d.length >= 5) {
        // Compute streak ending before yesterday
        let streak = 0;
        for (let i = 2; i <= 10; i++) { // check 2 days ago back through 10 days ago
            const d = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
            if (workoutDaysSet.has(d)) streak++;
            else break;
        }
        if (streak >= 5) {
            return {
                priority: 'high',
                reason: `Had a ${streak}-day workout streak going — skipped yesterday.`,
                context: `${streak} consecutive days of workouts, broken ${yest}.`,
            };
        }
    }

    // Signal 3 — challenge vs Shannon (trash talk / banter mode).
    // Only fires when the coach is actually a participant in an active
    // challenge with the client — otherwise we fall through to the softer
    // challenge_solo signal in the MEDIUM tier below.
    const banter = coachId ? await findBanterChallenge(clientId, coachId) : null;
    if (banter && banter.coachIn) {
        const coachScore = banter.coachRow?.challenge_points || banter.coachRow?.current_points || 0;
        const clientScore = banter.clientRow.challenge_points || banter.clientRow.current_points || 0;
        const diff = coachScore - clientScore;
        const coachAhead = diff > 0;
        const tied = diff === 0;
        const daysLeftStr = banter.daysLeft !== null ? `${banter.daysLeft}d left` : 'ongoing';
        return {
            priority: 'high',
            reason: tied
                ? `Neck-and-neck with ${banter.challenge.name} (${daysLeftStr}).`
                : coachAhead
                    ? `Leading ${banter.challenge.name} by ${Math.abs(diff)}pts vs client (${daysLeftStr}) — trash-talk mode.`
                    : `Behind in ${banter.challenge.name} by ${Math.abs(diff)}pts vs client (${daysLeftStr}) — client's winning, rev them anyway.`,
            context: `Challenge: "${banter.challenge.name}" (${banter.challenge.challenge_type}). Shannon ${coachScore}pts vs client ${clientScore}pts. ${tied ? 'Tied.' : (coachAhead ? `Shannon +${diff}.` : `Client +${Math.abs(diff)}.`)} ${daysLeftStr}.`,
            challenge: banter, // full context for the prompt builder
        };
    }

    // Signal 4 — low mood trend (avg < 5 over last 3 days, need at least 2 logs)
    if (moodLogs3d.length >= 2) {
        const avg = moodLogs3d.reduce((s, m) => s + (m.mood_score || 0), 0) / moodLogs3d.length;
        if (avg > 0 && avg < 5) {
            return {
                priority: 'medium',
                reason: `Mood has been low (avg ${Math.round(avg * 10) / 10}/10 over last 3 days).`,
                context: `${moodLogs3d.length} mood logs in last 3d, average ${Math.round(avg * 10) / 10}/10.`,
            };
        }
    }

    // Signal 4 — quiet client (no DM from them 5+ days AND no workout 3+ days)
    const lastDmAt = lastDmFromClient[0]?.created_at;
    const noDm5d = !lastDmAt || new Date(lastDmAt) < new Date(since5d);
    const hasWorkoutLast3d = workouts7d.some(w => (w.completedAt || '') >= since3d);
    if (noDm5d && !hasWorkoutLast3d) {
        const daysSinceDm = lastDmAt
            ? Math.floor((Date.now() - new Date(lastDmAt).getTime()) / DAY_MS)
            : null;
        return {
            priority: 'medium',
            reason: `Quiet — ${daysSinceDm !== null ? `${daysSinceDm} days since last message, ` : ''}no workout logged in 3+ days.`,
            context: `Last DM: ${daysSinceDm !== null ? daysSinceDm + ' days ago' : 'never'}. Workouts last 3d: 0.`,
        };
    }

    // Signal 6 — challenge solo (client is in an active challenge WITHOUT
    // Shannon — hype them on their competition with friends).
    // `banter` was computed above; if we got here it means coachIn was false
    // (otherwise we'd already have returned the HIGH-priority variant).
    if (banter && !banter.coachIn) {
        const clientRank = banter.participants.findIndex(p => p.user_id === clientId) + 1;
        const daysLeftStr = banter.daysLeft !== null ? `${banter.daysLeft}d left` : 'ongoing';
        const leaderPts = banter.leader.challenge_points || banter.leader.current_points || 0;
        const clientPts = banter.clientRow.challenge_points || banter.clientRow.current_points || 0;
        const gapToLeader = leaderPts - clientPts;
        const isLeading = banter.leader.user_id === clientId;
        return {
            priority: 'medium',
            reason: isLeading
                ? `Leading "${banter.challenge.name}" — ${daysLeftStr}, keep them pushing.`
                : `In "${banter.challenge.name}" — rank ${clientRank}/${banter.participants.length}, ${gapToLeader}pts from 1st, ${daysLeftStr}.`,
            context: `Challenge: "${banter.challenge.name}" (${banter.challenge.challenge_type}). Shannon NOT in this one — hype mode, not trash talk. ${daysLeftStr}.`,
            challenge: banter,
        };
    }

    // Signal 7 — cycle check-in (period starting within 24h, cycle sync enabled)
    try {
        if (personalDetails?.cycle_sync_preference === 'yes' && personalDetails?.last_period_start) {
            const cycleLen = personalDetails.cycle_length || 28;
            const lastStart = new Date(personalDetails.last_period_start);
            // Find the next predicted period date
            let next = new Date(lastStart);
            while (next.getTime() < Date.now() - DAY_MS) {
                next = new Date(next.getTime() + cycleLen * DAY_MS);
            }
            const hoursUntil = (next.getTime() - Date.now()) / (60 * 60 * 1000);
            if (hoursUntil >= -24 && hoursUntil <= 24) {
                return {
                    priority: 'low',
                    reason: `Period is due around now (cycle-sync enabled${personalDetails.period_energy_response === 'low' ? ', she tends to have low energy' : ''}).`,
                    context: `Predicted period start within 24h. Cycle length ${cycleLen}d.`,
                };
            }
        }
    } catch (e) { /* ignore cycle parse errors */ }

    // Signal 6 — momentum reinforcement (2+ PBs OR 5+ workouts last 7 days)
    if (pbs7d.length >= 2) {
        return {
            priority: 'low',
            reason: `Momentum — ${pbs7d.length} PBs in the last 7 days.`,
            context: `${pbs7d.length} PBs logged in last 7d, ${workouts7d.length} workouts.`,
        };
    }
    if (workouts7d.length >= 5) {
        return {
            priority: 'low',
            reason: `Consistency — ${workouts7d.length} workouts this week.`,
            context: `${workouts7d.length} workouts logged in last 7d.`,
        };
    }

    return null;
}

// ============================================================
// Dedup
// ============================================================

async function shouldSkipDueToDedup(coachId, clientId) {
    // Skip if client has ANY pending coach_alert (don't pile morning push on top of an existing one)
    try {
        const pending = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.pending&limit=1`
        );
        if (pending.length > 0) return 'pending_alert_exists';
    } catch (e) { /* continue */ }

    // Skip if a morning_pulse already fired for this client in the last 20h
    try {
        const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
        const recent = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.morning_pulse&created_at=gte.${twentyHoursAgo}&limit=1`
        );
        if (recent.length > 0) return 'pulse_today';
    } catch (e) { /* continue */ }

    // Skip if the coach already DM'd this client in the last 24h — covers the
    // "talked to them on IG / replied manually" case where a morning pulse is
    // a double-message.
    if (await recentlyMessaged({ coachId, clientId, hours: 24 })) {
        return 'recently_messaged';
    }

    return null;
}

// ============================================================
// Draft + alert + push for one candidate
// ============================================================

async function draftAndQueue({ coachId, clientId, clientName, signal }) {
    const [memory, editExamples] = await Promise.all([
        loadClientMemory(coachId, clientId),
        loadEditExamples({ lookback: 15, max: 4 }),
    ]);
    const memoryBlock = buildMemoryBlock(memory);

    // Challenge-specific section — only populated when signal came from
    // findBanterChallenge. Different tone depending on whether Shannon is
    // in the same challenge (trash talk allowed) or not (hype only).
    let challengeBlock = '';
    let toneOverride = '';
    if (signal.challenge) {
        const b = signal.challenge;
        const participantIds = b.participants.map(p => p.user_id);
        const nameMap = await loadUserNames(participantIds);
        if (!nameMap.has(coachId)) nameMap.set(coachId, 'Shannon');
        if (!nameMap.has(clientId)) nameMap.set(clientId, clientName);
        const leaderboard = formatLeaderboard(b.participants, nameMap, clientId);
        const clientRank = b.participants.findIndex(p => p.user_id === clientId) + 1;
        const coachRank = b.coachIn
            ? b.participants.findIndex(p => p.user_id === coachId) + 1
            : null;
        const daysLeftStr = b.daysLeft !== null ? `${b.daysLeft} days left` : 'ongoing';

        challengeBlock = `

CHALLENGE CONTEXT:
Name: "${b.challenge.name}" (${b.challenge.challenge_type})
${daysLeftStr}
Leaderboard: ${leaderboard}
Client rank: ${clientRank}/${b.participants.length}${coachRank ? `; Shannon rank: ${coachRank}/${b.participants.length}` : '; Shannon is NOT in this challenge.'}`;

        if (b.coachIn) {
            toneOverride = `

TONE — TRASH TALK MODE: Shannon is IN this challenge with the client. Banter is EXPECTED and encouraged. Short, playful, a little cocky if Shannon is ahead, a bit humbled if he's behind. Examples of what the vibe looks like: "bro ur killing it but im still gonna whoop ya", "oi ur ahead of me, not for long", "3 days left don't let me take this from ya". Aussie casual, under 2 sentences. Do NOT be saccharine, do NOT say "great job", do NOT give advice. Pure competitive banter — playful, never mean. Profanity is welcome in Shannon's voice but keep it light.`;
        } else {
            toneOverride = `

TONE — HYPE MODE: Shannon is NOT in this challenge — client is competing with friends/others. Shannon is cheering from the sidelines. Warm, specific, reference the actual leaderboard position or challenge type. 1-2 sentences. Do NOT pretend to be competing against them. Examples: "saw u cracking ${b.challenge.challenge_type} leaderboard, keep that lead", "3rd place in [challenge], push today and u'll catch em". Aussie casual.`;
        }
    }

    const prompt = `Draft a SHORT morning check-in from Shannon to a client. This is a proactive good-morning ping — not a reply.

CRITICAL — DO NOT GREET with "hey [name]", "morning [name]", "hi". Jump straight into content with warm morning energy. Aussie casual, 1-2 sentences max, lowercase-friendly, no corporate fluff.

Reference the SPECIFIC signal below so the message feels tailored to today — not a generic "morning, hope you're well". If relevant, suggest one small action or invite a reply.

CLIENT: ${clientName}${memoryBlock || ''}${challengeBlock}

WHY SHANNON IS REACHING OUT THIS MORNING:
${signal.reason}

SUPPORTING CONTEXT:
${signal.context}${toneOverride}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    // 512 tokens so the fine-tuned model has room to finish a 1-2 sentence
    // message after the memory/challenge/edit-example preamble. 256 was
    // clipping drafts mid-sentence ("...MIA, what", "...i know").
    const generationConfig = { maxOutputTokens: 512, temperature: 0.85 };

    let draftText = '';
    let draftModel = 'none';
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        draftText = stripLeadingGreeting(reply);
        draftModel = 'vertex-v7';
    } catch (err) {
        console.warn(`[morning-pulse] Vertex failed for ${clientId}: ${err.message}`);
        try {
            const reply = await callGeminiFallback(contents, generationConfig);
            draftText = stripLeadingGreeting(reply);
            draftModel = 'gemini-2.0-fallback';
        } catch (err2) {
            console.error(`[morning-pulse] Gemini fallback failed for ${clientId}: ${err2.message}`);
        }
    }

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'morning_pulse',
        priority: signal.priority,
        title: `🌅 ${clientName} — morning pulse`,
        description: truncate(signal.reason, 240),
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            signal_reason: signal.reason,
            signal_context: signal.context,
            signal_priority: signal.priority,
            draft_model: draftModel,
            drafted_at: new Date().toISOString(),
            ...(signal.challenge && {
                challenge_id: signal.challenge.challenge.id,
                challenge_name: signal.challenge.challenge.name,
                challenge_type: signal.challenge.challenge.challenge_type,
                coach_in_challenge: signal.challenge.coachIn,
                client_rank: signal.challenge.participants.findIndex(p => p.user_id === clientId) + 1,
                participants_count: signal.challenge.participants.length,
                days_left: signal.challenge.daysLeft,
            }),
        },
    };

    let alertId = null;
    try {
        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [alertRow],
            prefer: 'return=representation',
        });
        alertId = inserted?.[0]?.id || null;
        console.log(`[morning-pulse] alert ${alertId} created for ${clientId} (${signal.priority})`);
    } catch (err) {
        console.error(`[morning-pulse] alert insert failed for ${clientId}: ${err.message}`);
        return null;
    }

    // Auto-send for trusted clients, otherwise push the approve-gate
    // notification.
    let autoSent = false;
    if (draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId,
            clientName,
            alertId,
            alertType: 'morning_pulse',
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: '🌅 Auto-sent pulse',
        });
    }

    if (!autoSent && draftText && alertId) {
        try {
            const title = `🌅 ${clientName} — morning pulse`;
            const body = `${truncate(signal.reason, 80)}\n→ ${truncate(draftText, 140)}`;
            const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
            await fetch(pushUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: coachId,
                    senderId: clientId,
                    senderName: title,
                    messageText: body,
                    type: 'coach_draft_ready',
                    alertId,
                    clientId,
                    clientName,
                    draftText,
                    isSimpleReply: false,
                }),
            }).catch(e => console.warn(`[morning-pulse] push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn(`[morning-pulse] push failed: ${err.message}`);
        }
    }

    return alertId;
}

// ============================================================
// Main handler
// ============================================================

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

exports.handler = async () => {
    const started = Date.now();
    console.log(`[morning-pulse] starting at ${new Date().toISOString()}`);

    // 1. Pull all active coach_clients with their client info + onboarding details
    let assignments = [];
    try {
        assignments = await supabaseQuery(
            `coach_clients?select=coach_id,client_id,client:users!coach_clients_client_id_fkey(id,name,email,is_test_account)&status=eq.active`
        );
    } catch (err) {
        console.error(`[morning-pulse] coach_clients query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    // Drop accounts flagged as test/fake — Shannon's second accounts etc.
    const beforeFilter = assignments.length;
    assignments = assignments.filter(a => !a.client?.is_test_account);
    if (assignments.length !== beforeFilter) {
        console.log(`[morning-pulse] filtered ${beforeFilter - assignments.length} test account(s)`);
    }

    // Bulk-load user_facts.personal_details for all candidates in one query
    const clientIds = assignments.map(a => a.client_id);
    let factsByClient = {};
    if (clientIds.length > 0) {
        try {
            const inList = clientIds.map(id => `"${id}"`).join(',');
            const facts = await supabaseQuery(
                `user_facts?select=user_id,personal_details&user_id=in.(${inList})`
            );
            factsByClient = Object.fromEntries(facts.map(f => [f.user_id, f.personal_details || {}]));
        } catch (e) { /* continue without facts */ }
    }

    // 2. For each assignment, compute signal (if any)
    const candidates = [];
    for (const a of assignments) {
        try {
            const signal = await detectSignals({
                clientId: a.client_id,
                coachId: a.coach_id,
                personalDetails: factsByClient[a.client_id] || {},
            });
            if (signal) {
                candidates.push({
                    coachId: a.coach_id,
                    clientId: a.client_id,
                    clientName: a.client?.name || a.client?.email?.split('@')[0] || 'Client',
                    signal,
                });
            }
        } catch (err) {
            console.warn(`[morning-pulse] signal detection failed for ${a.client_id}: ${err.message}`);
        }
    }

    console.log(`[morning-pulse] ${assignments.length} active clients, ${candidates.length} signals detected`);

    // 3. Deduplicate by (coach_id, client_id) — if coach_clients has multiple
    // active rows for the same pair (or this handler races with itself) we
    // must never queue two pulses for the same client in one run. Keep the
    // highest-priority candidate.
    const bestByPair = new Map();
    for (const c of candidates) {
        const key = `${c.coachId}|${c.clientId}`;
        const existing = bestByPair.get(key);
        if (!existing || PRIORITY_WEIGHT[c.signal.priority] > PRIORITY_WEIGHT[existing.signal.priority]) {
            bestByPair.set(key, c);
        }
    }
    const deduped = Array.from(bestByPair.values());

    // 4. Sort by priority desc (high → low) and cap
    deduped.sort((a, b) => PRIORITY_WEIGHT[b.signal.priority] - PRIORITY_WEIGHT[a.signal.priority]);
    const selected = deduped.slice(0, MAX_PULSES_PER_DAY);

    // 5. Dedup + draft + queue
    const summary = {
        active_clients: assignments.length,
        signals_detected: candidates.length,
        unique_clients: deduped.length,
        cap: MAX_PULSES_PER_DAY,
        fired: 0,
        skipped_dedup: 0,
        failed: 0,
        by_priority: { high: 0, medium: 0, low: 0 },
    };

    for (const c of selected) {
        try {
            const skipReason = await shouldSkipDueToDedup(c.coachId, c.clientId);
            if (skipReason) {
                summary.skipped_dedup++;
                continue;
            }
            const alertId = await draftAndQueue(c);
            if (alertId) {
                summary.fired++;
                summary.by_priority[c.signal.priority]++;
            } else {
                summary.failed++;
            }
        } catch (err) {
            console.error(`[morning-pulse] error processing ${c.clientId}: ${err.message}`);
            summary.failed++;
        }
    }

    const elapsed = Date.now() - started;
    console.log(`[morning-pulse] done in ${elapsed}ms — ${JSON.stringify(summary)}`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...summary, elapsed_ms: elapsed, started_at: new Date(started).toISOString() }),
    };
};
