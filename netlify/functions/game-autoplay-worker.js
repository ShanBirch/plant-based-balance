/**
 * game-autoplay-worker - delayed human-ish game moves for Shannon.
 *
 * The first production use case is tightly scoped: Shannon's active games
 * against Abbey in Connect 4 and Tic Tac Toe. The worker never moves instantly.
 * It stamps a random future move time into game_state.auto_play, then only
 * makes the move once that timestamp is due.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const RULE_ID = 'abbey_connect4_tictactoe_v1';
const GAME_TYPES = ['connect4', 'tic_tac_toe'];
const GAME_NAMES = {
    connect4: 'Connect 4',
    tic_tac_toe: 'Tic Tac Toe',
};

const DEFAULT_OPPONENT_EMAILS = ['abbey-sarah@hotmail.com'];
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const MIN_DELAY_MS = readMs('GAME_AUTOPLAY_MIN_DELAY_MS', 5 * 60 * 1000);
const MAX_DELAY_MS = readMs('GAME_AUTOPLAY_MAX_DELAY_MS', 4 * 60 * 60 * 1000);
const WAKE_DELAY_MIN_MS = readMs('GAME_AUTOPLAY_WAKE_DELAY_MIN_MS', 15 * 60 * 1000);
const WAKE_DELAY_MAX_MS = readMs('GAME_AUTOPLAY_WAKE_DELAY_MAX_MS', 2 * 60 * 60 * 1000);
const QUIET_START_MINUTES = readClockMinutes(process.env.GAME_AUTOPLAY_QUIET_START || '22:30');
const QUIET_END_MINUTES = readClockMinutes(process.env.GAME_AUTOPLAY_QUIET_END || '07:00');
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const MAX_PER_RUN = 8;

function readMs(name, fallback) {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value) || value < 0) return fallback;
    return Math.round(value);
}

function readClockMinutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    const hours = Math.max(0, Math.min(23, Number(match[1])));
    const minutes = Math.max(0, Math.min(59, Number(match[2])));
    return hours * 60 + minutes;
}

function parseList(value) {
    return String(value || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function opponentEmails() {
    const configured = parseList(process.env.GAME_AUTOPLAY_OPPONENT_EMAILS);
    return configured.length ? configured : DEFAULT_OPPONENT_EMAILS;
}

function configuredAutoPlayerIds() {
    return parseList(process.env.GAME_AUTOPLAY_PLAYER_IDS || process.env.GAME_AUTOPLAY_PLAYER_ID);
}

function randomInt(min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(low + Math.random() * (high - low + 1));
}

function toBrisbaneDate(date) {
    return new Date(date.getTime() + BRISBANE_OFFSET_MS);
}

function fromBrisbaneParts(year, month, day, hour, minute) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - BRISBANE_OFFSET_MS);
}

function brisbaneParts(date) {
    const local = toBrisbaneDate(date);
    return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth() + 1,
        day: local.getUTCDate(),
        hour: local.getUTCHours(),
        minute: local.getUTCMinutes(),
    };
}

function isQuietMinute(minuteOfDay) {
    if (QUIET_START_MINUTES === QUIET_END_MINUTES) return false;
    if (QUIET_START_MINUTES < QUIET_END_MINUTES) {
        return minuteOfDay >= QUIET_START_MINUTES && minuteOfDay < QUIET_END_MINUTES;
    }
    return minuteOfDay >= QUIET_START_MINUTES || minuteOfDay < QUIET_END_MINUTES;
}

function isQuietTime(date) {
    const parts = brisbaneParts(date);
    return isQuietMinute(parts.hour * 60 + parts.minute);
}

function nextWakeTime(date) {
    const parts = brisbaneParts(date);
    const minuteOfDay = parts.hour * 60 + parts.minute;
    let wake = fromBrisbaneParts(
        parts.year,
        parts.month,
        parts.day,
        Math.floor(QUIET_END_MINUTES / 60),
        QUIET_END_MINUTES % 60
    );

    if (minuteOfDay >= QUIET_START_MINUTES) {
        wake = new Date(wake.getTime() + 24 * 60 * 60 * 1000);
    }
    if (wake <= date) {
        wake = new Date(wake.getTime() + 24 * 60 * 60 * 1000);
    }
    return wake;
}

function chooseScheduledFor(now = new Date()) {
    let delayMs = randomInt(MIN_DELAY_MS, MAX_DELAY_MS);
    let scheduledFor = new Date(now.getTime() + delayMs);
    let quietAdjusted = false;

    if (isQuietTime(now)) {
        const wake = nextWakeTime(now);
        const wakeDelay = randomInt(WAKE_DELAY_MIN_MS, WAKE_DELAY_MAX_MS);
        scheduledFor = new Date(wake.getTime() + wakeDelay);
        delayMs = scheduledFor.getTime() - now.getTime();
        quietAdjusted = true;
    } else if (isQuietTime(scheduledFor)) {
        const wake = nextWakeTime(scheduledFor);
        const wakeDelay = randomInt(WAKE_DELAY_MIN_MS, WAKE_DELAY_MAX_MS);
        scheduledFor = new Date(wake.getTime() + wakeDelay);
        delayMs = scheduledFor.getTime() - now.getTime();
        quietAdjusted = true;
    }

    return { scheduledFor, delayMs, quietAdjusted };
}

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function loadAutoPlayerIds() {
    const configured = configuredAutoPlayerIds();
    if (configured.length) return new Set(configured);

    const rows = await supabase(`users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
    return new Set((rows || []).map(row => row.id).filter(Boolean));
}

async function loadOpponentIds() {
    const ids = new Set(parseList(process.env.GAME_AUTOPLAY_OPPONENT_IDS));
    for (const email of opponentEmails()) {
        const rows = await supabase(`users?select=id,name,email&email=eq.${encodeURIComponent(email)}&limit=1`);
        if (rows[0]?.id) ids.add(rows[0].id);
    }
    return ids;
}

async function loadCandidateMatches(opponentIds) {
    const seen = new Set();
    const matches = [];
    for (const opponentId of opponentIds) {
        const rows = await supabase(
            `game_matches?select=*&status=eq.active&game_type=in.(${GAME_TYPES.join(',')})&or=(challenger_id.eq.${encodeURIComponent(opponentId)},opponent_id.eq.${encodeURIComponent(opponentId)})&limit=25`
        );
        for (const row of rows || []) {
            if (!seen.has(row.id)) {
                seen.add(row.id);
                matches.push(row);
            }
        }
    }
    return matches;
}

function otherPlayerId(match, playerId) {
    return match.challenger_id === playerId ? match.opponent_id : match.challenger_id;
}

function moveCount(match) {
    const value = Number(match.move_count);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function moveCountFilter(match) {
    if (match.move_count === null || typeof match.move_count === 'undefined') {
        return 'move_count=is.null';
    }
    return `move_count=eq.${moveCount(match)}`;
}

function isEligibleMatch(match, autoPlayerIds, opponentIds) {
    if (!match || match.status !== 'active') return false;
    if (!GAME_TYPES.includes(match.game_type)) return false;
    if (!autoPlayerIds.has(match.current_turn)) return false;
    return opponentIds.has(otherPlayerId(match, match.current_turn));
}

function currentAutoPlayState(match) {
    const state = match.game_state && typeof match.game_state === 'object' ? match.game_state : {};
    const autoPlay = state.auto_play && typeof state.auto_play === 'object' ? state.auto_play : {};
    return { state, autoPlay };
}

function existingScheduleForCurrentTurn(match) {
    const { autoPlay } = currentAutoPlayState(match);
    const scheduledAt = Date.parse(autoPlay.scheduled_for || '');
    if (!Number.isFinite(scheduledAt)) return null;
    if (autoPlay.scheduled_for_player_id !== match.current_turn) return null;
    if (Number(autoPlay.scheduled_for_move_count) !== moveCount(match)) return null;
    if (autoPlay.rule_id && autoPlay.rule_id !== RULE_ID) return null;
    return new Date(scheduledAt);
}

async function stampSchedule(match, now = new Date()) {
    const { state, autoPlay } = currentAutoPlayState(match);
    const timing = chooseScheduledFor(now);
    const nextState = {
        ...state,
        auto_play: {
            ...autoPlay,
            rule_id: RULE_ID,
            scheduled_for: timing.scheduledFor.toISOString(),
            scheduled_at: now.toISOString(),
            scheduled_delay_ms: timing.delayMs,
            scheduled_for_player_id: match.current_turn,
            scheduled_for_move_count: moveCount(match),
            quiet_adjusted: timing.quietAdjusted,
            min_delay_ms: MIN_DELAY_MS,
            max_delay_ms: MAX_DELAY_MS,
            quiet_start: process.env.GAME_AUTOPLAY_QUIET_START || '22:30',
            quiet_end: process.env.GAME_AUTOPLAY_QUIET_END || '07:00',
            skill: 'medium_human',
        },
    };

    const rows = await supabase(
        `game_matches?id=eq.${encodeURIComponent(match.id)}&status=eq.active&current_turn=eq.${encodeURIComponent(match.current_turn)}&${moveCountFilter(match)}`,
        {
            method: 'PATCH',
            body: { game_state: nextState },
            prefer: 'return=representation',
        }
    );
    return rows[0] || null;
}

function normalizeTicTacToeBoard(board) {
    const source = Array.isArray(board) ? board : [];
    const next = Array(9).fill(null);
    for (let i = 0; i < 9; i++) {
        next[i] = source[i] === 'X' || source[i] === 'O' ? source[i] : null;
    }
    return next;
}

function ticTacToeWinner(board, symbol) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    return lines.some(([a, b, c]) => board[a] === symbol && board[b] === symbol && board[c] === symbol);
}

function findTicTacToeWinningMove(board, symbol) {
    for (let i = 0; i < board.length; i++) {
        if (board[i] !== null) continue;
        const copy = board.slice();
        copy[i] = symbol;
        if (ticTacToeWinner(copy, symbol)) return i;
    }
    return -1;
}

function chooseTicTacToeMove(board, symbol) {
    const opponent = symbol === 'X' ? 'O' : 'X';
    const empty = board.map((cell, index) => cell === null ? index : -1).filter(index => index >= 0);
    if (!empty.length) return -1;

    const win = findTicTacToeWinningMove(board, symbol);
    if (win !== -1) return win;

    const block = findTicTacToeWinningMove(board, opponent);
    if (block !== -1 && Math.random() < 0.94) return block;

    const scored = empty.map(index => {
        let score = Math.random() * 1.4;
        if (index === 4) score += 5;
        if ([0, 2, 6, 8].includes(index)) score += 3;
        if ([1, 3, 5, 7].includes(index)) score += 1;
        return { index, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0].index;
}

function buildTicTacToeMove(match, playerId) {
    const isChallenger = playerId === match.challenger_id;
    const symbol = isChallenger ? 'X' : 'O';
    const board = normalizeTicTacToeBoard(match.game_state?.board);
    const index = chooseTicTacToeMove(board, symbol);
    if (index < 0) return null;

    board[index] = symbol;
    const opponentId = otherPlayerId(match, playerId);
    const result = ticTacToeWinner(board, symbol)
        ? { winnerId: playerId }
        : (board.every(Boolean) ? { draw: true } : null);

    return {
        board,
        nextTurn: opponentId,
        result,
        moveData: {
            index,
            symbol,
            source: 'game_autoplay_worker',
            skill: 'medium_human',
        },
    };
}

function normalizeConnect4Board(board) {
    const rows = 6;
    const cols = 7;
    const next = Array.from({ length: rows }, () => Array(cols).fill(null));
    if (!Array.isArray(board)) return next;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const value = board[r]?.[c];
            next[r][c] = value === 'R' || value === 'Y' ? value : null;
        }
    }
    return next;
}

function connect4DropRow(board, col) {
    for (let r = board.length - 1; r >= 0; r--) {
        if (board[r][col] === null) return r;
    }
    return -1;
}

function connect4Winner(board, row, col, color) {
    const rows = board.length;
    const cols = board[0]?.length || 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
        let count = 1;
        for (let d = 1; d <= 3; d++) {
            const nr = row + dr * d;
            const nc = col + dc * d;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === color) count++;
            else break;
        }
        for (let d = 1; d <= 3; d++) {
            const nr = row - dr * d;
            const nc = col - dc * d;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === color) count++;
            else break;
        }
        if (count >= 4) return true;
    }
    return false;
}

function validConnect4Columns(board) {
    const cols = board[0]?.length || 0;
    const valid = [];
    for (let col = 0; col < cols; col++) {
        if (board[0][col] === null) valid.push(col);
    }
    return valid;
}

function findConnect4WinningColumn(board, color) {
    for (const col of validConnect4Columns(board)) {
        const row = connect4DropRow(board, col);
        if (row < 0) continue;
        board[row][col] = color;
        const wins = connect4Winner(board, row, col, color);
        board[row][col] = null;
        if (wins) return col;
    }
    return -1;
}

function opponentCanWinNext(board, opponentColor) {
    return findConnect4WinningColumn(board, opponentColor) !== -1;
}

function countConnect4LinePotential(board, row, col, color) {
    const rows = board.length;
    const cols = board[0]?.length || 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let score = 0;
    for (const [dr, dc] of directions) {
        let own = 1;
        let open = 0;
        for (const sign of [1, -1]) {
            for (let d = 1; d <= 3; d++) {
                const nr = row + dr * d * sign;
                const nc = col + dc * d * sign;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
                if (board[nr][nc] === color) own++;
                else {
                    if (board[nr][nc] === null) open++;
                    break;
                }
            }
        }
        if (own >= 3 && open > 0) score += 7;
        else if (own === 2 && open > 0) score += 3;
    }
    return score;
}

function chooseConnect4Column(board, color) {
    const opponent = color === 'R' ? 'Y' : 'R';
    const valid = validConnect4Columns(board);
    if (!valid.length) return -1;

    const win = findConnect4WinningColumn(board, color);
    if (win !== -1) return win;

    const block = findConnect4WinningColumn(board, opponent);
    if (block !== -1 && Math.random() < 0.92) return block;

    const scored = valid.map(col => {
        const row = connect4DropRow(board, col);
        let score = Math.random() * 2;
        score += (3 - Math.abs(3 - col)) * 2.3;

        board[row][col] = color;
        score += countConnect4LinePotential(board, row, col, color);
        if (opponentCanWinNext(board, opponent)) score -= 12;
        board[row][col] = null;

        return { col, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0].col;
}

function buildConnect4Move(match, playerId) {
    const isChallenger = playerId === match.challenger_id;
    const color = isChallenger ? 'R' : 'Y';
    const board = normalizeConnect4Board(match.game_state?.board);
    const col = chooseConnect4Column(board, color);
    if (col < 0) return null;

    const row = connect4DropRow(board, col);
    if (row < 0) return null;

    board[row][col] = color;
    const opponentId = otherPlayerId(match, playerId);
    const result = connect4Winner(board, row, col, color)
        ? { winnerId: playerId }
        : (board[0].every(Boolean) ? { draw: true } : null);

    return {
        board,
        nextTurn: opponentId,
        result,
        moveData: {
            row,
            col,
            color,
            source: 'game_autoplay_worker',
            skill: 'medium_human',
        },
    };
}

function buildMove(match, playerId) {
    if (match.game_type === 'tic_tac_toe') return buildTicTacToeMove(match, playerId);
    if (match.game_type === 'connect4') return buildConnect4Move(match, playerId);
    return null;
}

async function insertGameNudge({ senderId, receiverId, matchId, message }) {
    await supabase('nudges', {
        method: 'POST',
        body: [{
            sender_id: senderId,
            receiver_id: receiverId,
            message,
            nudge_type: 'game_invite',
            reference_id: matchId,
        }],
        prefer: 'return=minimal',
    });
}

async function completeGame(matchId, winnerId, isDraw) {
    await supabase('rpc/complete_game', {
        method: 'POST',
        body: {
            p_match_id: matchId,
            p_winner_id: winnerId || null,
            p_is_draw: !!isDraw,
        },
        prefer: 'return=representation',
    });
}

async function applyMove(match, now = new Date()) {
    const playerId = match.current_turn;
    const opponentId = otherPlayerId(match, playerId);
    const built = buildMove(match, playerId);
    if (!built) return { ok: false, reason: 'no_move' };

    const oldMoveCount = moveCount(match);
    const newMoveCount = oldMoveCount + 1;
    const { state, autoPlay } = currentAutoPlayState(match);
    const nextState = {
        ...state,
        board: built.board,
        auto_play: {
            ...autoPlay,
            rule_id: RULE_ID,
            scheduled_for: null,
            scheduled_for_player_id: null,
            scheduled_for_move_count: null,
            last_moved_at: now.toISOString(),
            last_move_count: newMoveCount,
            last_move: built.moveData,
            skill: 'medium_human',
        },
    };

    const claimed = await supabase(
        `game_matches?id=eq.${encodeURIComponent(match.id)}&status=eq.active&current_turn=eq.${encodeURIComponent(playerId)}&${moveCountFilter(match)}`,
        {
            method: 'PATCH',
            body: {
                game_state: nextState,
                current_turn: built.nextTurn,
                move_count: newMoveCount,
                last_move_at: now.toISOString(),
            },
            prefer: 'return=representation',
        }
    );
    if (!claimed[0]) return { ok: false, reason: 'lost_race' };

    await supabase('game_moves', {
        method: 'POST',
        body: [{
            match_id: match.id,
            player_id: playerId,
            move_number: newMoveCount,
            move_data: built.moveData,
        }],
        prefer: 'return=minimal',
    });

    const gameName = GAME_NAMES[match.game_type] || 'the game';
    if (built.result?.winnerId) {
        await completeGame(match.id, built.result.winnerId, false);
        await insertGameNudge({
            senderId: playerId,
            receiverId: opponentId,
            matchId: match.id,
            message: `i won our ${gameName} game`,
        });
        return { ok: true, result: 'win' };
    }
    if (built.result?.draw) {
        await completeGame(match.id, null, true);
        await insertGameNudge({
            senderId: playerId,
            receiverId: opponentId,
            matchId: match.id,
            message: `${gameName} ended in a draw`,
        });
        return { ok: true, result: 'draw' };
    }

    await insertGameNudge({
        senderId: playerId,
        receiverId: opponentId,
        matchId: match.id,
        message: `your turn in ${gameName}`,
    });
    return { ok: true, result: 'moved' };
}

async function processMatch(match, now = new Date()) {
    const dueAt = existingScheduleForCurrentTurn(match);
    if (!dueAt) {
        const scheduled = await stampSchedule(match, now);
        return {
            action: scheduled ? 'scheduled' : 'schedule_lost_race',
            match_id: match.id,
            scheduled_for: scheduled?.game_state?.auto_play?.scheduled_for || null,
        };
    }

    if (dueAt > now) {
        return {
            action: 'waiting',
            match_id: match.id,
            scheduled_for: dueAt.toISOString(),
        };
    }

    const result = await applyMove(match, now);
    return {
        action: result.ok ? result.result : result.reason,
        match_id: match.id,
    };
}

exports.handler = async () => {
    const startedAt = Date.now();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    const now = new Date();
    let autoPlayerIds;
    let opponentIds;
    try {
        [autoPlayerIds, opponentIds] = await Promise.all([
            loadAutoPlayerIds(),
            loadOpponentIds(),
        ]);
    } catch (e) {
        console.error('[game-autoplay] identity lookup failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'identity_lookup_failed', details: e.message }) };
    }

    if (!autoPlayerIds.size || !opponentIds.size) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                checked_at: now.toISOString(),
                eligible: 0,
                reason: !autoPlayerIds.size ? 'no_auto_players' : 'no_opponents',
            }),
        };
    }

    let candidates = [];
    try {
        candidates = await loadCandidateMatches(opponentIds);
    } catch (e) {
        console.error('[game-autoplay] candidate query failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'candidate_query_failed', details: e.message }) };
    }

    const eligible = candidates
        .filter(match => isEligibleMatch(match, autoPlayerIds, opponentIds))
        .slice(0, MAX_PER_RUN);

    const actions = [];
    let moved = 0;
    let scheduled = 0;
    let waiting = 0;
    let failed = 0;

    for (const match of eligible) {
        try {
            const outcome = await processMatch(match, now);
            actions.push(outcome);
            if (['moved', 'win', 'draw'].includes(outcome.action)) moved++;
            else if (outcome.action === 'scheduled') scheduled++;
            else if (outcome.action === 'waiting') waiting++;
            else failed++;
        } catch (e) {
            console.error(`[game-autoplay] match ${match.id} failed:`, e.message);
            actions.push({ match_id: match.id, action: 'failed', error: e.message.slice(0, 180) });
            failed++;
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            checked_at: now.toISOString(),
            candidates: candidates.length,
            eligible: eligible.length,
            moved,
            scheduled,
            waiting,
            failed,
            actions,
            elapsed_ms: Date.now() - startedAt,
        }),
    };
};

exports._private = {
    chooseScheduledFor,
    isQuietTime,
    nextWakeTime,
    normalizeTicTacToeBoard,
    chooseTicTacToeMove,
    normalizeConnect4Board,
    chooseConnect4Column,
    buildTicTacToeMove,
    buildConnect4Move,
    existingScheduleForCurrentTurn,
};
