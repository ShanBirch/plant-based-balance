import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const DEFAULT_WORKSPACE = 'C:\\Users\\shann\\.gemini\\antigravity\\plant_based_balance';
const DEFAULT_SKILL = 'C:\\Users\\shann\\.codex\\skills\\balance-lead-client-dm-manager\\SKILL.md';
const DEFAULT_POLL_MS = 1500;
const DEFAULT_COALESCE_MS = 2500;
const DEFAULT_TURN_TIMEOUT_MS = 4 * 60 * 1000;

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
    return `$balance-lead-client-dm-manager

You are the live paid-Meta conversation operator for exactly one Instagram/Facebook lead. This is conversation work, not a code-debugging or repo-editing task.

Wake event:
- Codex chat: ${codexThreadId}
- IG thread: ${igThreadId}
- IG username: ${username}
- alert: ${alert.id}
- controller action: ${action.id}
- controller version: ${action.action_version ?? 'unknown'}
- controller claim token: ${action.claim_token}
- source inbound: ${action.source_message_id || alert?.data?.manychat_message_id || 'resolve from live thread'}
- newest captured text: ${JSON.stringify(newestInbound)}

Required outcome:
1. Read CODEX.md, CLAUDE.md, and the Balance lead/client DM-manager skill completely.
2. Load the complete canonical live thread from Supabase, including every inbound newer than Shannon's last outbound, the current alert/draft/review, current attribution, qualifier, controller action, and recent outbound history.
3. Treat the live conversation as the authority. Answer questions before progressing. Never repeat a question already answered. Never let a non-blocking style warning leave a normal paid lead unanswered.
4. Revalidate the supplied dm_manager claim and run the normal stale-thread, identity, safety, media, URL, and no-double-send gates. If a newer inbound arrived, respond to the whole unanswered batch rather than the captured excerpt.
5. For a safe normal paid lead, repair or replace the draft as needed, send through the approved production transport, and verify exact canonical ig_messages readback plus the controller receipt. If the conversation is unsafe or genuinely requires Shannon, route it precisely instead of guessing.
6. Do not edit application code, create a worktree, change prompts, deploy, or investigate the wider pipeline in this chat. Record a concise operator result only.

Keep this Codex chat open while the lead conversation remains active. End your final operator result with exactly one of:
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
                p_owner: 'dm_manager',
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
        return this.request('rpc/complete_ig_next_action', {
            method: 'POST',
            body: JSON.stringify({
                p_action_id: action.id,
                p_claim_token: action.claim_token,
                p_status: 'waiting',
                p_safe_after: new Date(Date.now() + 30_000).toISOString(),
                p_receipt: {
                    codex_live_worker_failed: true,
                    outbound_attempted: false,
                    error: String(error?.message || error || 'unknown error').slice(0, 500),
                },
            }),
        });
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

async function ensureConversation({ appServer, state, statePath, workspace, skillPath, alert, openChat, logger }) {
    const igThreadId = String(alert.data.ig_thread_id || alert.data.codex_live_chat_ig_thread_id);
    const username = String(alert.data.ig_username || alert.client_name || 'paid lead');
    let conversation = state.conversations[igThreadId] || null;
    if (conversation?.codexThreadId) {
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
    conversation = {
        igThreadId,
        username,
        codexThreadId,
        status: 'open',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
    };
    state.conversations[igThreadId] = conversation;
    saveState(statePath, state);
    const name = `LIVE IG - ${username} - ${igThreadId.slice(0, 8)}`;
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
        skillPath: DEFAULT_SKILL,
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
        input: [
            { type: 'text', text: prompt },
            { type: 'skill', name: 'balance-lead-client-dm-manager', path: DEFAULT_SKILL },
        ],
        cwd: args.workspace,
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'dangerFullAccess' },
        model: process.env.IG_CODEX_LIVE_MODEL || 'gpt-5.6-terra',
        effort: process.env.IG_CODEX_LIVE_EFFORT || 'medium',
        summary: 'concise',
        personality: 'friendly',
    });
    const turnId = result?.turn?.id;
    if (!turnId) throw new Error('Codex app-server did not return a turn id');
    logger(`started Codex turn ${turnId} for alert ${alert.id}`);
    const completed = await waitForTurn(appServer, { threadId: conversation.codexThreadId, turnId });
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
                if (state.alerts[alert.id]?.status === 'completed') continue;
                const igThreadId = String(alert.data.ig_thread_id || alert.data.codex_live_chat_ig_thread_id);
                if (args.dryRun) {
                    logger(`dry-run eligible alert ${alert.id}, IG thread ${igThreadId}, ${alert.client_name || 'unknown'}`);
                    continue;
                }
                const runId = `codex-live:${process.pid}:${Date.now()}`;
                const action = await supabase.claimThread(igThreadId, runId);
                if (!action) {
                    logger(`no dm_manager claim available for alert ${alert.id}; fallback manager may own it`);
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
