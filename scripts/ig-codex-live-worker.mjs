import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const DEFAULT_WORKSPACE = 'C:\\Users\\shann\\.gemini\\antigravity\\plant_based_balance';
const DEFAULT_POLL_MS = 1500;
const DEFAULT_COALESCE_MS = 2500;
const DEFAULT_TURN_TIMEOUT_MS = 4 * 60 * 1000;

export function isPaidMetaTestReset(text = '') {
    const normalized = String(text)
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return normalized === 'what is the founders pass' || normalized === 'whats the founders pass';
}

export function shouldStartFreshEpisode(alert, conversation) {
    return isPaidMetaTestReset(alert?.data?.message_preview)
        && conversation?.resetAlertId !== alert?.id;
}

export function parseArgs(argv = []) {
    const args = {
        workspace: process.env.BALANCE_WORKSPACE || DEFAULT_WORKSPACE,
        dryRun: false,
        once: false,
        openChat: false,
        testAppServer: false,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === '--dry-run') args.dryRun = true;
        else if (value === '--once') args.once = true;
        else if (value === '--open-chat') args.openChat = true;
        else if (value === '--test-app-server') args.testAppServer = true;
        else if (value === '--workspace' && argv[index + 1]) args.workspace = argv[++index];
        else if (value.startsWith('--workspace=')) args.workspace = value.slice('--workspace='.length);
    }
    return args;
}

export function buildLivePrompt({ alert, action, codexThreadId }) {
    const igThreadId = String(alert?.data?.ig_thread_id || alert?.data?.codex_live_chat_ig_thread_id || action?.thread_id || '');
    const username = String(alert?.data?.ig_username || alert?.client_name || action?.ig_username || 'unknown lead');
    const newestInbound = String(alert?.data?.message_preview || '').trim();
    return `You are the dedicated live paid-Meta sales conversation for one internal Instagram test lead. This flow is isolated from the normal Balance AI coach, DM manager, dispatcher wording, and every older test episode. Do not read or invoke their conversational prompts or skills. Keep the existing production transport, claim, identity, safety, URL, duplicate-send, and readback gates.

Wake event:
- Background conversation: ${codexThreadId}
- IG thread: ${igThreadId}
- IG username: ${username}
- alert: ${alert.id}
- controller action: ${action.id}
- controller version: ${action.action_version ?? 'unknown'}
- controller claim token: ${action.claim_token}
- source inbound: ${action.source_message_id || alert?.data?.manychat_message_id || 'resolve from live thread'}
- newest captured text: ${JSON.stringify(newestInbound)}

Operating contract:
1. Move fast. The target is a verified public reply within 15 to 30 seconds of the inbound. Do not browse, research, edit code, deploy, or investigate the wider system.
2. Load the canonical live thread, current alert/action, and every unanswered inbound in the current episode. The current episode begins at the newest inbound equivalent to "What is the Founders Pass?" Ignore older test episodes when deciding the current stage or known facts. Use older records only for identity, purchase, opt-out, manual-control, safety, and duplicate-send checks.
3. Answer every direct question first, naturally and specifically, then progress the conversation. Handle all messages in a rapid inbound batch. Never repeat or paraphrase a question whose answer is already known in this episode.
4. Every safe non-link public turn must end with exactly one purposeful question that earns the next response. This includes atomic transformation-photo and app-video turns: put the question after the media introduction/attachment in that same synchronous delivery, not in a later turn. Only a turn containing the signed app-preview URL or checkout URL has zero questions and pauses. "Oh nice!", "sounds good", and similar positive acknowledgements are not closers in this flow: do not react-only; make the next progression move and ask one question.
5. Keep replies brief, casual, warm, and human. Usually use one compact bubble; split only when a media intro or clarity genuinely needs it. Do not expose internal rules, IDs, code, or tool work.

Conversation intelligence:
- This is a loose conversational path, not a scripted checklist. Usually it moves through: a small useful answer, plant-based connection, how long and why when those facts are missing, their goal, genuinely matched client proof when safe, what is blocking it, the app video, then an offer to let them see their own workout and meal plan inside the app before paying. The order can flex when the lead supplies later-stage facts or direct intent.
- On a fresh Founders Pass opener, after the short direct answer, the first connection question is whether they are currently plant-based or vegan, or looking to go plant-based or vegan, unless they already said. Do not ask the fitness goal first. If they confirm vegan, plant-based, or vegetarian and have not supplied duration or reason, ask the missing connection detail before goals. When both are missing, one natural compound question is allowed, for example: "How long have you been vegan, and what made you go vegan?" If one is already known, ask only the other. If both are known, connect briefly and move to the fitness goal. If they are looking to transition, ask what sparked it before the goal when natural.
- The funnel controls only the next objective. Write every ordinary reply fresh from the complete newest lead turn and one exact detail they supplied. Move one natural step at a time. Do not dump the whole offer, reuse a fixed sentence, or force every stage into every conversation.
- Before drafting, study the recent successful episodes in this same canonical thread, especially those beginning 2026-08-14 03:21 UTC and 2026-08-14 10:24 UTC. Learn their decision pattern, conversational rhythm, tailoring, proof choice, and handoff. Do not copy their wording or inherit their lead facts into the current episode.
- If they ask "How about you?", answer naturally before progressing: animals were a big part of it and you have been vegan for five years.
- Choose transformation proof only when it genuinely matches the person's own goal, situation, and known person fit: Ally for weight loss, Gen for strength/confidence, Dani for body recomposition, and Bec/Kirsty for shared accountability. These approved transformation photos all feature women. Prefer them for a lead who explicitly identifies as a woman or whose reliable current profile context clearly supports the match. Never infer gender from a handle alone, never send a female transformation to a lead known to be a man merely to fill the proof step, and never claim a male transformation exists when none is approved. For a man or unresolved person fit, skip the transformation unless a genuinely matched approved male proof is added later. Skip proof for a weak match or any sensitive context including pregnancy, postpartum, injury, pain, rehabilitation, eating disorders, or self-harm. Introduce the selected person naturally, send the matching approved photo, then end that same atomic turn with the next purposeful question, normally the blocker question.
- Use their stated blocker to explain how Balance would help them stick with it. Tailor the reasoning to their actual words instead of mapping them to canned copy.
- Treat food uncertainty such as "I don't know what to eat" as a concrete blocker. Explain briefly that their plant-based meal plan removes the daily guesswork and is set up around them. Do not open with the generic line "That's what Balance is for" or cram the whole offer into the video introduction. The clean turn is: one blocker-specific thought, a natural introduction to the native app video, the video attachment, then one short personalised-preview question.
- Send the existing 63-second evergreen app video after enough goal/blocker context makes the walkthrough relevant. Introduce it naturally, keep the delivery atomic, and end the same video turn with one setup question, normally whether they want a free personalised look at their own workout plan and meal plan before paying. Do not send a questionless video turn and wait for them to react.
- After relevant proof or a useful fit explanation, naturally offer a free personalised look inside the app so they can see their workout and meal plan before paying. Phrase the invitation for the live moment rather than reciting a template.
- After clear consent, send the signed personal app-preview link with no question. Send checkout only after explicit buyer intent.

Fixed offer facts:
- Founders Pass is a six-week setup inside Balance.
- It includes workouts built around their week, a plant-based meal plan, and weekly check-ins to review and adjust training and food.
- It is one AUD 89.99 payment, with no subscription and no auto-renewal.
- The evergreen app proof video is https://plantbased-balance.org/assets/balance-foundations-app-proof.mp4. This URL is transport-only: never paste it into public reply or draft text. Introduce the quick app video naturally and keep the alert's draft_video_attachment_url available so send-coach-reply delivers it as a native Instagram attachment.
- Approved proof photos: Ally https://plantbased-balance.org/photos/client-success/ally-cocos.png ; Gen https://plantbased-balance.org/photos/client-success/gen-cocos.jpg ; Dani https://plantbased-balance.org/photos/client-success/dani-front-mirror-8-weeks.png ; Bec/Kirsty https://plantbased-balance.org/photos/client-success/bec-kirsty-cocos.png
- They can see their profile, workout program, meal plan, and the full app before paying.
- Transformation proof is optional, must genuinely match the person's goal and situation, and must not be forced or hardcoded.

Execution:
1. Revalidate the supplied codex_live_worker controller claim and the exact live-thread safety gates. A non-blocking style warning must never leave this normal paid lead unanswered.
2. If a newer inbound arrived, respond to the whole unanswered batch. Draft from this contract, not from an existing generic draft.
3. Send through the existing approved production send-coach-reply transport with forceText and the manager source. For every text payload, always send replyTextUtf8Base64 and draftTextUtf8Base64 generated from the final UTF-8 strings; never interpolate the reply directly into a PowerShell, shell, or JavaScript command. If the transport reports outbound_text_encoding_corruption, confirm that no canonical outbound exists and retry once using those Base64 fields. Then verify the exact canonical ig_messages readback and complete the controller receipt. If a genuine safety, identity, opt-out, authenticity, manual-control, or transport block exists, route it precisely instead of guessing.
4. Record only a concise internal operator result in this background conversation.

Keep this background conversation state open while the lead conversation remains active. End your final operator result with exactly one of:
LIVE_CHAT_STATE: open
LIVE_CHAT_STATE: closed

Use closed only for a verified purchase/onboarding handoff, clear opt-out, permanent manual handoff, or another genuinely terminal conversation state.`;
}

export function shouldHandleAlert(alert, nowMs = Date.now(), coalesceMs = DEFAULT_COALESCE_MS) {
    if (!alert?.id || alert.status !== 'pending') return false;
    if (alert?.data?.codex_live_chat_required !== true) return false;
    if (!alert?.data?.ig_thread_id && !alert?.data?.codex_live_chat_ig_thread_id) return false;
    const createdMs = Date.parse(alert.created_at || '');
    return !Number.isFinite(createdMs) || nowMs - createdMs >= coalesceMs;
}

export function findCodexBinary({ localAppData = process.env.LOCALAPPDATA, explicit = process.env.CODEX_BIN } = {}) {
    if (explicit && fs.existsSync(explicit)) return explicit;
    if (localAppData) {
        const root = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
        if (fs.existsSync(root)) {
            const candidates = [];
            for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                if (!entry.isDirectory()) continue;
                const candidate = path.join(root, entry.name, 'codex.exe');
                if (fs.existsSync(candidate)) candidates.push(candidate);
            }
            candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
            if (candidates[0]) return candidates[0];
        }
    }
    return process.platform === 'win32' ? 'codex.exe' : 'codex';
}

class JsonRpcAppServer extends EventEmitter {
    constructor({ binary, workspace, logger }) {
        super();
        this.binary = binary;
        this.workspace = workspace;
        this.logger = logger;
        this.nextId = 1;
        this.pending = new Map();
        this.child = null;
    }

    async start() {
        if (this.child) return;
        this.child = spawn(this.binary, ['app-server', '--stdio'], {
            cwd: this.workspace,
            env: process.env,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        readline.createInterface({ input: this.child.stdout }).on('line', line => this.onLine(line));
        readline.createInterface({ input: this.child.stderr }).on('line', line => {
            if (line.trim()) this.logger(`app-server: ${line.trim()}`);
        });
        this.child.on('exit', (code, signal) => {
            const error = new Error(`Codex app-server exited (${code ?? signal ?? 'unknown'})`);
            for (const pending of this.pending.values()) pending.reject(error);
            this.pending.clear();
            this.child = null;
            this.emit('exit', error);
        });
        await this.request('initialize', {
            clientInfo: {
                name: 'balance_ig_live_worker',
                title: 'Balance IG Paid Lead Live Worker',
                version: '0.1.0',
            },
            capabilities: {},
        });
        this.notify('initialized', {});
    }

    onLine(line) {
        let message;
        try { message = JSON.parse(line); }
        catch {
            if (line.trim()) this.logger(`app-server non-json: ${line.trim()}`);
            return;
        }
        if (message.id !== undefined && this.pending.has(message.id)) {
            const pending = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
            else pending.resolve(message.result);
            return;
        }
        if (message.method) this.emit(message.method, message.params || {});
    }

    request(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
        });
    }

    notify(method, params = {}) {
        this.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
    }

    stop() {
        if (this.child && !this.child.killed) this.child.kill();
    }
}

function createLogger(logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    return message => {
        const line = `${new Date().toISOString()} ${message}`;
        fs.appendFileSync(logPath, `${line}\n`, 'utf8');
        process.stdout.write(`${line}\n`);
    };
}

function loadState(statePath) {
    try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); }
    catch { return { version: 1, conversations: {}, alerts: {} }; }
}

function saveState(statePath, state) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const temporary = `${statePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, statePath);
}

function acquireProcessLock(lockPath) {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    try {
        const descriptor = fs.openSync(lockPath, 'wx');
        fs.writeFileSync(descriptor, String(process.pid), 'utf8');
        return () => {
            try { fs.closeSync(descriptor); } catch {}
            try { fs.unlinkSync(lockPath); } catch {}
        };
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let existingPid = 0;
        try { existingPid = Number(fs.readFileSync(lockPath, 'utf8')); } catch {}
        if (existingPid) {
            try { process.kill(existingPid, 0); throw new Error(`worker already running as PID ${existingPid}`); }
            catch (probeError) {
                if (!String(probeError.message || '').includes('worker already running')) {
                    try { fs.unlinkSync(lockPath); } catch {}
                    return acquireProcessLock(lockPath);
                }
                throw probeError;
            }
        }
        try { fs.unlinkSync(lockPath); } catch {}
        return acquireProcessLock(lockPath);
    }
}

function loadSupabaseCredentials(workspace) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return {
            url: process.env.SUPABASE_URL.replace(/\/$/, ''),
            key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
    }
    const netlifyScript = process.platform === 'win32' && process.env.APPDATA
        ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'netlify-cli', 'bin', 'run.js')
        : null;
    const executable = netlifyScript && fs.existsSync(netlifyScript) ? process.execPath : 'netlify';
    const commandArgs = netlifyScript && fs.existsSync(netlifyScript)
        ? [netlifyScript, 'env:list', '--json']
        : ['env:list', '--json'];
    const result = spawnSync(executable, commandArgs, {
        cwd: workspace,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
    });
    if (result.status !== 0) {
        throw new Error(`Could not load Netlify environment: ${(result.stderr || result.error?.message || '').trim()}`);
    }
    const values = JSON.parse(result.stdout || '{}');
    if (!values.SUPABASE_URL || !values.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    }
    return { url: values.SUPABASE_URL.replace(/\/$/, ''), key: values.SUPABASE_SERVICE_ROLE_KEY };
}

class SupabaseRest {
    constructor({ url, key }) {
        this.base = `${url}/rest/v1`;
        this.headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    }

    async request(relative, options = {}) {
        const response = await fetch(`${this.base}/${relative}`, {
            ...options,
            headers: { ...this.headers, ...(options.headers || {}) },
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
        return text ? JSON.parse(text) : null;
    }

    async pendingAlerts() {
        const query = new URLSearchParams({
            select: 'id,status,created_at,client_name,suggested_message,data',
            status: 'eq.pending',
            'data->>codex_live_chat_required': 'eq.true',
            order: 'created_at.asc',
            limit: '20',
        });
        return this.request(`coach_alerts?${query.toString()}`);
    }

    async claimThread(threadId, runId) {
        const rows = await this.request('rpc/claim_ig_next_actions', {
            method: 'POST',
            body: JSON.stringify({
                p_owner: 'codex_live_worker',
                p_limit: 1,
                p_lease_seconds: 300,
                p_run_id: runId,
                p_thread_ids: [threadId],
            }),
        });
        return Array.isArray(rows) ? rows[0] || null : rows;
    }

    async mergeAlertData(alertId, patch) {
        const rows = await this.request(`coach_alerts?select=id,data&id=eq.${encodeURIComponent(alertId)}&limit=1`);
        if (!rows?.[0]) return null;
        const merged = { ...(rows[0].data || {}), ...patch };
        const updated = await this.request(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ data: merged }),
        });
        return updated?.[0] || null;
    }

    async releaseClaim(action, error) {
        if (!action?.id || !action?.claim_token) return null;
        return this.request('rpc/release_paid_meta_live_codex_action', {
            method: 'POST',
            body: JSON.stringify({
                p_action_id: action.id,
                p_claim_token: action.claim_token,
                p_error: String(error?.message || error || 'unknown error').slice(0, 500),
            }),
        });
    }

    async actionById(actionId) {
        const query = new URLSearchParams({
            select: 'id,status,owner,source_message_id,receipt,updated_at',
            id: `eq.${actionId}`,
            limit: '1',
        });
        const rows = await this.request(`ig_next_actions?${query.toString()}`);
        return rows?.[0] || null;
    }

    async canonicalOutboundsForAlert(alertId, threadId) {
        const query = new URLSearchParams({
            select: 'id,created_at,text,alert_id,source',
            alert_id: `eq.${alertId}`,
            thread_id: `eq.${threadId}`,
            direction: 'eq.out',
            order: 'created_at.asc',
        });
        return this.request(`ig_messages?${query.toString()}`);
    }
}

function openCodexThread(threadId, logger) {
    if (process.platform !== 'win32') return;
    try {
        const child = spawn('explorer.exe', [`codex://threads/${threadId}`], {
            detached: true,
            windowsHide: true,
            stdio: 'ignore',
        });
        child.unref();
        logger(`opened Codex chat ${threadId}`);
    } catch (error) {
        logger(`could not open Codex chat ${threadId}: ${error.message}`);
    }
}

async function waitForTurn(appServer, { threadId, turnId, timeoutMs = DEFAULT_TURN_TIMEOUT_MS }) {
    let agentText = '';
    return new Promise((resolve, reject) => {
        const timer = setTimeout(async () => {
            cleanup();
            try { await appServer.request('turn/interrupt', { threadId, turnId }); } catch {}
            reject(new Error(`Codex turn ${turnId} timed out`));
        }, timeoutMs);
        const onDelta = params => {
            if (params.threadId === threadId && (!params.turnId || params.turnId === turnId)) {
                agentText += String(params.delta || '');
            }
        };
        const onCompleted = params => {
            if (params.threadId !== threadId || params.turn?.id !== turnId) return;
            cleanup();
            const status = params.turn?.status || 'unknown';
            if (!['completed', 'completedWithErrors'].includes(status)) {
                reject(new Error(`Codex turn ended with ${status}`));
            } else {
                resolve({ status, agentText });
            }
        };
        const cleanup = () => {
            clearTimeout(timer);
            appServer.off('item/agentMessage/delta', onDelta);
            appServer.off('turn/completed', onCompleted);
        };
        appServer.on('item/agentMessage/delta', onDelta);
        appServer.on('turn/completed', onCompleted);
    });
}

async function ensureConversation({ appServer, state, statePath, workspace, alert, openChat, logger }) {
    const igThreadId = String(alert.data.ig_thread_id || alert.data.codex_live_chat_ig_thread_id);
    const username = String(alert.data.ig_username || alert.client_name || 'paid lead');
    let conversation = state.conversations[igThreadId] || null;
    const freshEpisode = shouldStartFreshEpisode(alert, conversation);
    if (freshEpisode && conversation?.codexThreadId) {
        try { await appServer.request('thread/unsubscribe', { threadId: conversation.codexThreadId }); }
        catch (error) { logger(`could not unsubscribe prior episode ${conversation.codexThreadId}: ${error.message}`); }
        logger(`starting fresh paid-Meta test episode for alert ${alert.id}; prior Codex chat ${conversation.codexThreadId}`);
    }
    if (!freshEpisode && conversation?.codexThreadId) {
        try {
            await appServer.request('thread/resume', { threadId: conversation.codexThreadId });
            const wasClosed = conversation.status === 'closed';
            conversation.status = 'open';
            conversation.lastActivityAt = new Date().toISOString();
            state.conversations[igThreadId] = conversation;
            saveState(statePath, state);
            if (wasClosed && openChat) openCodexThread(conversation.codexThreadId, logger);
            return conversation;
        } catch (error) {
            logger(`could not resume ${conversation.codexThreadId}; creating a replacement: ${error.message}`);
        }
    }
    const result = await appServer.request('thread/start', {
        model: process.env.IG_CODEX_LIVE_MODEL || 'gpt-5.6-terra',
        cwd: workspace,
        approvalPolicy: 'never',
        sandbox: 'danger-full-access',
        personality: 'friendly',
        serviceName: 'balance_ig_live_worker',
    });
    const codexThreadId = result?.thread?.id;
    if (!codexThreadId) throw new Error('Codex app-server did not return a thread id');
    const previousCodexThreadId = freshEpisode ? conversation?.codexThreadId || null : null;
    conversation = {
        igThreadId,
        username,
        codexThreadId,
        status: 'open',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        episodeStartedAt: new Date().toISOString(),
        resetAlertId: isPaidMetaTestReset(alert?.data?.message_preview) ? alert.id : null,
        previousCodexThreadId,
    };
    state.conversations[igThreadId] = conversation;
    saveState(statePath, state);
    const name = `LIVE PAID META TEST - ${username} - ${igThreadId.slice(0, 8)}`;
    await appServer.request('thread/name/set', { threadId: codexThreadId, name });
    if (openChat) openCodexThread(codexThreadId, logger);
    logger(`created Codex chat ${codexThreadId} for ${username}`);
    return conversation;
}

async function runAlert({ alert, action, appServer, supabase, state, statePath, args, logger }) {
    const conversation = await ensureConversation({
        appServer,
        state,
        statePath,
        workspace: args.workspace,
        alert,
        openChat: args.openChat,
        logger,
    });
    const prompt = buildLivePrompt({ alert, action, codexThreadId: conversation.codexThreadId });
    await supabase.mergeAlertData(alert.id, {
        codex_live_chat_status: 'active',
        codex_live_chat_codex_thread_id: conversation.codexThreadId,
        codex_live_chat_action_id: action.id,
        codex_live_chat_action_version: action.action_version ?? null,
        codex_live_chat_started_at: new Date().toISOString(),
    });
    const result = await appServer.request('turn/start', {
        threadId: conversation.codexThreadId,
        input: [{ type: 'text', text: prompt }],
        cwd: args.workspace,
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'dangerFullAccess' },
        model: process.env.IG_CODEX_LIVE_MODEL || 'gpt-5.6-terra',
        effort: process.env.IG_CODEX_LIVE_EFFORT || 'low',
        summary: 'concise',
        personality: 'friendly',
    });
    const turnId = result?.turn?.id;
    if (!turnId) throw new Error('Codex app-server did not return a turn id');
    logger(`started Codex turn ${turnId} for alert ${alert.id}`);
    const completed = await waitForTurn(appServer, { threadId: conversation.codexThreadId, turnId });
    await new Promise(resolve => setTimeout(resolve, 1500));
    const [finalAction, canonicalOutbounds] = await Promise.all([
        supabase.actionById(action.id),
        supabase.canonicalOutboundsForAlert(alert.id, action.thread_id),
    ]);
    const delivered = Array.isArray(canonicalOutbounds) && canonicalOutbounds.length > 0;
    const actionClosed = ['completed', 'cancelled'].includes(String(finalAction?.status || ''));
    if (!delivered) {
        const transportCode = finalAction?.receipt?.transport_code || null;
        throw new Error(`Codex turn finished without verified Instagram delivery (action=${finalAction?.status || 'missing'}, transport=${transportCode || 'none'}, outbound=${delivered})`);
    }
    if (!actionClosed) {
        logger(`verified Instagram delivery for alert ${alert.id}, but controller readback is ${finalAction?.status || 'missing'}; preserving the no-repeat outbound as authoritative`);
    }
    const closed = /LIVE_CHAT_STATE:\s*closed\b/i.test(completed.agentText);
    conversation.status = closed ? 'closed' : 'open';
    conversation.lastActivityAt = new Date().toISOString();
    conversation.lastAlertId = alert.id;
    conversation.lastTurnId = turnId;
    state.alerts[alert.id] = { status: 'completed', completedAt: new Date().toISOString(), turnId };
    saveState(statePath, state);
    await supabase.mergeAlertData(alert.id, {
        codex_live_chat_status: closed ? 'closed' : 'turn_completed',
        codex_live_chat_completed_at: new Date().toISOString(),
        codex_live_chat_codex_thread_id: conversation.codexThreadId,
        codex_live_chat_turn_id: turnId,
    });
    if (closed) {
        await appServer.request('thread/unsubscribe', { threadId: conversation.codexThreadId });
    }
    logger(`completed Codex turn ${turnId} for alert ${alert.id}; conversation ${conversation.status}`);
}

async function testAppServer({ args, appServer, logger }) {
    const result = await appServer.request('thread/start', {
        model: process.env.IG_CODEX_LIVE_MODEL || 'gpt-5.6-terra',
        cwd: args.workspace,
        approvalPolicy: 'never',
        sandbox: 'read-only',
        serviceName: 'balance_ig_live_worker_smoke',
    });
    const threadId = result?.thread?.id;
    const turn = await appServer.request('turn/start', {
        threadId,
        input: [{ type: 'text', text: 'Do not use tools. Reply with exactly LIVE_WORKER_OK.' }],
        cwd: args.workspace,
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly' },
        model: process.env.IG_CODEX_LIVE_MODEL || 'gpt-5.6-terra',
        effort: 'low',
    });
    const completed = await waitForTurn(appServer, { threadId, turnId: turn.turn.id });
    if (!completed.agentText.includes('LIVE_WORKER_OK')) throw new Error(`Unexpected app-server reply: ${completed.agentText}`);
    await appServer.request('thread/archive', { threadId });
    logger('Codex app-server smoke test passed');
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    const localRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'Balance', 'CodexLiveWorker');
    const statePath = path.join(localRoot, 'state.json');
    const logPath = path.join(localRoot, 'worker.log');
    const lockPath = path.join(localRoot, 'worker.lock');
    const logger = createLogger(logPath);
    const releaseLock = acquireProcessLock(lockPath);
    const state = loadState(statePath);
    const appServer = new JsonRpcAppServer({
        binary: findCodexBinary(),
        workspace: args.workspace,
        logger,
    });
    const stop = () => {
        appServer.stop();
        releaseLock();
    };
    process.once('SIGINT', () => { stop(); process.exit(0); });
    process.once('SIGTERM', () => { stop(); process.exit(0); });
    try {
        await appServer.start();
        if (args.testAppServer) {
            await testAppServer({ args, appServer, logger });
            return;
        }
        const supabase = new SupabaseRest(loadSupabaseCredentials(args.workspace));
        logger(`${args.dryRun ? 'dry-run ' : ''}worker started for ${args.workspace}`);
        do {
            const alerts = await supabase.pendingAlerts();
            for (const alert of alerts || []) {
                if (!shouldHandleAlert(alert)) continue;
                if (state.alerts[alert.id]?.status === 'completed') {
                    logger(`rechecking pending alert ${alert.id}; local turn completion is not delivery proof`);
                    delete state.alerts[alert.id];
                    saveState(statePath, state);
                }
                const igThreadId = String(alert.data.ig_thread_id || alert.data.codex_live_chat_ig_thread_id);
                if (args.dryRun) {
                    logger(`dry-run eligible alert ${alert.id}, IG thread ${igThreadId}, ${alert.client_name || 'unknown'}`);
                    continue;
                }
                const runId = `codex-live:${process.pid}:${Date.now()}`;
                const action = await supabase.claimThread(igThreadId, runId);
                if (!action) {
                    logger(`no codex_live_worker claim available for alert ${alert.id}; it may still be routing or already handled`);
                    continue;
                }
                try {
                    await runAlert({ alert, action, appServer, supabase, state, statePath, args, logger });
                } catch (error) {
                    state.alerts[alert.id] = {
                        status: 'failed',
                        failedAt: new Date().toISOString(),
                        error: error.message,
                    };
                    saveState(statePath, state);
                    await supabase.mergeAlertData(alert.id, {
                        codex_live_chat_status: 'failed_waiting_for_manager_fallback',
                        codex_live_chat_failed_at: new Date().toISOString(),
                        codex_live_chat_error: String(error.message || error).slice(0, 500),
                    });
                    try {
                        await supabase.releaseClaim(action, error);
                        logger(`released controller claim for alert ${alert.id}; manager fallback may retry after 30 seconds`);
                    } catch (releaseError) {
                        logger(`could not release controller claim for alert ${alert.id}: ${releaseError.message}`);
                    }
                    logger(`alert ${alert.id} failed: ${error.stack || error.message}`);
                }
            }
            if (!args.once) await new Promise(resolve => setTimeout(resolve, Number(process.env.IG_CODEX_LIVE_POLL_MS || DEFAULT_POLL_MS)));
        } while (!args.once);
    } finally {
        stop();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        process.stderr.write(`${error.stack || error.message}\n`);
        process.exitCode = 1;
    });
}
