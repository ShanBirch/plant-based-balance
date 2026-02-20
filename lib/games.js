// --- MULTIPLAYER GAMES FEATURE ---
// Chess, Checkers, Connect 4, Tic Tac Toe, Reversi, Battleships

// ============================================================
// GAME CONFIGURATION
// ============================================================

const GAME_CONFIG = {
  chess: {
    name: 'Chess',
    icon: '♟️',
    description: 'Classic strategy game',
    color: '#8B4513',
    gradient: 'linear-gradient(135deg, #8B4513, #D2691E)',
    minBet: 0,
    maxBet: 500
  },
  checkers: {
    name: 'Checkers',
    icon: '⛀',
    description: 'Jump and capture',
    color: '#DC2626',
    gradient: 'linear-gradient(135deg, #DC2626, #EF4444)',
    minBet: 0,
    maxBet: 300
  },
  connect4: {
    name: 'Connect 4',
    icon: '🔴',
    description: 'Four in a row',
    color: '#2563EB',
    gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)',
    minBet: 0,
    maxBet: 200
  },
  tic_tac_toe: {
    name: 'Tic Tac Toe',
    icon: '❌',
    description: 'Noughts and crosses',
    color: '#7C3AED',
    gradient: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
    minBet: 0,
    maxBet: 100
  },
  reversi: {
    name: 'Reversi',
    icon: '⚫',
    description: 'Flip to win',
    color: '#059669',
    gradient: 'linear-gradient(135deg, #059669, #10B981)',
    minBet: 0,
    maxBet: 300
  },
  battleships: {
    name: 'Battleships',
    icon: '🚢',
    description: 'Sink the fleet',
    color: '#0369A1',
    gradient: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
    minBet: 0,
    maxBet: 400
  }
};

const BET_OPTIONS = [0, 10, 25, 50, 100, 200, 500];

// ============================================================
// GAME STATE MANAGER
// ============================================================

let activeGameMatch = null; // Currently open game match data
let activeGameEngine = null; // Currently active game engine instance
let gamePollingInterval = null;
let aiMoveTimeout = null; // Timer for AI move delays

// ============================================================
// CHALLENGE FLOW
// ============================================================

async function openGameChallengeModal() {
  // Get friends list
  if (!window.currentUser) return;

  // Reset selections from any previous modal open
  selectedGameType = null;
  selectedFriendId = null;
  selectedFriendName = null;
  selectedGameBet = 0;

  let friends = [];
  try {
    friends = await db.friends.getFriendsWithFallback(window.currentUser.id);
  } catch (e) {
    console.error('Failed to load friends:', e);
  }

  const modal = document.createElement('div');
  modal.id = 'game-challenge-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const friendCards = friends.length > 0
    ? friends.map(f => `
      <div class="game-friend-card" data-friend-id="${f.friend_id}" onclick="selectGameFriend(this, '${f.friend_id}', '${(f.friend_name || 'Unknown').replace(/'/g, "\\'")}')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;cursor:pointer;transition:all 0.2s;border:2px solid transparent;">
        <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);display:flex;align-items:center;justify-content:center;color:#1a1a2e;font-weight:700;font-size:1rem;overflow:hidden;">
          ${f.friend_photo ? `<img src="${f.friend_photo}" style="width:100%;height:100%;object-fit:cover;">` : (f.friend_name || '?')[0].toUpperCase()}
        </div>
        <div style="flex:1;font-weight:600;font-size:0.95rem;color:rgba(255,255,255,0.9);">${f.friend_name || 'Unknown'}</div>
        <div class="game-friend-check" style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;transition:all 0.2s;"></div>
      </div>
    `).join('')
    : '<div style="text-align:center;padding:30px 20px;color:rgba(255,255,255,0.5);font-size:0.9rem;">Add friends from the Feed to challenge them!</div>';

  const gameCards = Object.entries(GAME_CONFIG).map(([key, game]) => `
    <div class="game-type-card" data-game="${key}" onclick="selectGameType(this, '${key}')" style="flex:0 0 auto;width:100px;padding:14px 10px;border-radius:14px;text-align:center;cursor:pointer;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);transition:all 0.2s;">
      <div style="font-size:1.8rem;margin-bottom:6px;">${game.icon}</div>
      <div style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.9);margin-bottom:2px;">${game.name}</div>
      <div style="font-size:0.65rem;color:rgba(255,255,255,0.5);">${game.description}</div>
    </div>
  `).join('');

  const betButtons = BET_OPTIONS.map(amt => `
    <button class="game-bet-btn" data-bet="${amt}" onclick="selectGameBet(this, ${amt})" style="padding:8px 14px;border-radius:20px;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.2s;color:white;">
      ${amt === 0 ? 'Free' : '🪙 ' + amt}
    </button>
  `).join('');

  modal.innerHTML = `
    <div style="background:linear-gradient(135deg, #1a1a2e 0%, #2e1a0e 50%, #3d2e0a 100%);border-radius:24px 24px 0 0;width:100%;max-width:500px;max-height:85vh;overflow-y:auto;padding:0;animation:slideUp 0.3s ease;box-shadow:0 -10px 40px rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.1);">
      <!-- Header -->
      <div style="padding:20px 20px 0;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:16px;">
        <div>
          <h3 style="margin:0;font-size:1.3rem;font-weight:800;color:#fbbf24;text-shadow:0 0 20px rgba(251,191,36,0.3);">Challenge a Friend</h3>
          <p style="margin:4px 0 0;font-size:0.75rem;color:rgba(255,255,255,0.5);">Pick a game, choose your opponent, place your bet</p>
        </div>
        <button onclick="document.getElementById('game-challenge-modal').remove()" style="background:rgba(255,255,255,0.1);border:none;width:32px;height:32px;border-radius:50%;font-size:1.2rem;cursor:pointer;color:rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;">×</button>
      </div>

      <!-- Step 1: Pick a game -->
      <div style="padding:16px 20px 8px;">
        <div style="font-size:0.75rem;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Pick a Game</div>
        <div id="game-type-selector" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;">
          ${gameCards}
        </div>
      </div>

      <!-- Step 2: VS Bot Option -->
      <div style="padding:8px 20px 0;">
        <div style="font-size:0.75rem;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Play vs Bot</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          ${Object.entries(window.GameAI ? window.GameAI.DIFFICULTY : {easy:{label:'Easy',icon:'🟢',description:'Learning the ropes',color:'#10b981'},medium:{label:'Medium',icon:'🟡',description:'A fair challenge',color:'#f59e0b'},hard:{label:'Hard',icon:'🔴',description:'Battle-hardened bot',color:'#ef4444'}}).map(([key, d]) => `
            <div onclick="startGameVsAI('${key}')" style="flex:1;padding:12px 8px;border-radius:12px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.06);border:2px solid rgba(255,255,255,0.1);transition:all 0.2s;" onmouseover="this.style.borderColor='${d.color}'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
              <div style="font-size:1.3rem;margin-bottom:4px;">${d.icon}</div>
              <div style="font-size:0.75rem;font-weight:700;color:white;">${d.label}</div>
              <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);margin-top:2px;">${d.description}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Step 3: Pick a friend -->
      <div style="padding:8px 20px;">
        <div style="font-size:0.75rem;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Or Challenge a Friend</div>
        <div id="game-friends-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
          ${friendCards}
        </div>
      </div>

      <!-- Step 3: Set bet -->
      <div style="padding:8px 20px;">
        <div style="font-size:0.75rem;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Wager (Optional)</div>
        <div id="game-bet-selector" style="display:flex;gap:8px;flex-wrap:wrap;">
          ${betButtons}
        </div>
      </div>

      <!-- Send Challenge Button -->
      <div style="padding:16px 20px 28px;border-top:1px solid rgba(255,255,255,0.08);margin-top:8px;">
        <button id="send-game-challenge-btn" onclick="sendGameChallenge()" disabled style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);color:white;font-size:0.95rem;font-weight:700;cursor:pointer;opacity:0.5;transition:all 0.2s;box-shadow:0 4px 15px rgba(245,158,11,0.3);">
          Select a game & friend
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Default select Free bet
  const freeBtn = modal.querySelector('.game-bet-btn[data-bet="0"]');
  if (freeBtn) selectGameBet(freeBtn, 0);
}

// Selection state
let selectedGameType = null;
let selectedFriendId = null;
let selectedFriendName = null;
let selectedGameBet = 0;

function selectGameType(el, gameType) {
  document.querySelectorAll('.game-type-card').forEach(c => {
    c.style.borderColor = 'rgba(255,255,255,0.1)';
    c.style.background = 'rgba(255,255,255,0.06)';
    c.querySelectorAll('div').forEach(d => {
      if (d.style.fontSize === '1.8rem') return; // skip icon
      d.style.color = d.style.fontSize === '0.65rem' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)';
    });
  });
  el.style.borderColor = 'rgba(251,191,36,0.6)';
  el.style.background = 'rgba(251,191,36,0.15)';
  el.querySelectorAll('div').forEach(d => d.style.color = 'white');
  selectedGameType = gameType;
  updateChallengeButton();
}

function selectGameFriend(el, friendId, friendName) {
  document.querySelectorAll('.game-friend-card').forEach(c => {
    c.style.borderColor = 'transparent';
    c.style.background = 'transparent';
    const check = c.querySelector('.game-friend-check');
    if (check) { check.style.borderColor = 'rgba(255,255,255,0.2)'; check.style.background = 'transparent'; check.innerHTML = ''; }
  });
  el.style.borderColor = 'rgba(251,191,36,0.5)';
  el.style.background = 'rgba(251,191,36,0.1)';
  const check = el.querySelector('.game-friend-check');
  if (check) { check.style.borderColor = '#fbbf24'; check.style.background = '#fbbf24'; check.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#1a1a2e;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'; }
  selectedFriendId = friendId;
  selectedFriendName = friendName;
  updateChallengeButton();
}

function selectGameBet(el, amount) {
  document.querySelectorAll('.game-bet-btn').forEach(b => {
    b.style.borderColor = 'rgba(255,255,255,0.15)';
    b.style.background = 'rgba(255,255,255,0.08)';
    b.style.color = 'white';
  });
  el.style.borderColor = 'rgba(251,191,36,0.6)';
  el.style.background = 'rgba(251,191,36,0.2)';
  el.style.color = '#fbbf24';
  selectedGameBet = amount;
  updateChallengeButton();
}

function updateChallengeButton() {
  const btn = document.getElementById('send-game-challenge-btn');
  if (!btn) return;
  if (selectedGameType && selectedFriendId) {
    btn.disabled = false;
    btn.style.opacity = '1';
    const game = GAME_CONFIG[selectedGameType];
    const betText = selectedGameBet > 0 ? ` for 🪙 ${selectedGameBet}` : '';
    btn.textContent = `Challenge ${selectedFriendName} to ${game.name}${betText}`;
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = 'Select a game & friend';
  }
}

async function sendGameChallenge() {
  if (!selectedGameType || !selectedFriendId || !window.currentUser) return;

  const btn = document.getElementById('send-game-challenge-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending challenge...'; }

  try {
    const result = await db.games.createChallenge(
      window.currentUser.id,
      selectedFriendId,
      selectedGameType,
      selectedGameBet
    );

    if (!result || result.error) {
      alert(result?.message || 'Failed to create challenge. Please try again.');
      if (btn) { btn.disabled = false; updateChallengeButton(); }
      return;
    }

    // Close modal
    const modal = document.getElementById('game-challenge-modal');
    if (modal) modal.remove();

    // Show success toast
    showGameToast(`${GAME_CONFIG[selectedGameType].icon} Challenge sent to ${selectedFriendName}!`);

    // Reload coin balance if bet was placed
    if (selectedGameBet > 0 && typeof loadCoinBalance === 'function') {
      loadCoinBalance();
    }

    // Refresh games list
    if (typeof loadActiveGames === 'function') loadActiveGames();

    // Reset selections
    selectedGameType = null;
    selectedFriendId = null;
    selectedFriendName = null;
    selectedGameBet = 0;
  } catch (error) {
    console.error('Failed to send challenge:', error);
    alert('Failed to send challenge: ' + (error.message || 'Unknown error. Please try again.'));
    if (btn) { btn.disabled = false; updateChallengeButton(); }
  }
}

// ============================================================
// ACTIVE GAMES DISPLAY (in Feed)
// ============================================================

async function loadActiveGames() {
  if (!window.currentUser) return;

  const container = document.getElementById('active-games-container');
  if (!container) return;

  try {
    const games = await db.games.getUserGames(window.currentUser.id);

    if (!games || games.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <div style="padding:0 15px 8px;">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Active Games</div>
        <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;">
          ${games.map(g => renderActiveGameCard(g)).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load active games:', error);
  }
}

function renderActiveGameCard(game) {
  const config = GAME_CONFIG[game.game_type] || {};
  const isMyTurn = game.current_turn === window.currentUser.id;
  const isPending = game.status === 'pending';
  const isChallenger = game.challenger_id === window.currentUser.id;
  const opponentName = isChallenger ? game.opponent_name : game.challenger_name;
  const opponentPhoto = isChallenger ? game.opponent_photo : game.challenger_photo;

  let statusText = '';
  let statusColor = '';
  if (isPending && !isChallenger) {
    statusText = 'Accept?';
    statusColor = '#F59E0B';
  } else if (isPending && isChallenger) {
    statusText = 'Waiting...';
    statusColor = '#94A3B8';
  } else if (isMyTurn) {
    statusText = 'Your turn!';
    statusColor = '#10B981';
  } else {
    statusText = 'Their turn';
    statusColor = '#94A3B8';
  }

  const betBadge = game.coin_bet > 0 ? `<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.5);color:#FCD34D;font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:8px;">🪙 ${game.coin_bet}</div>` : '';

  return `
    <div onclick="${isPending && !isChallenger ? `handleGameInvite('${game.match_id}')` : `openGameBoard('${game.match_id}')`}"
         style="flex:0 0 auto;width:140px;border-radius:16px;overflow:hidden;cursor:pointer;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.08);position:relative;border:${isMyTurn ? '2px solid #10B981' : isPending && !isChallenger ? '2px solid #F59E0B' : '2px solid transparent'};">
      ${betBadge}
      <div style="height:60px;background:${config.gradient || '#666'};display:flex;align-items:center;justify-content:center;">
        <span style="font-size:2rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${config.icon || '🎮'}</span>
      </div>
      <div style="padding:10px;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-main);margin-bottom:2px;">${config.name}</div>
        <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">vs ${opponentName || 'Unknown'}</div>
        <div style="font-size:0.65rem;font-weight:700;color:${statusColor};display:flex;align-items:center;gap:4px;">
          ${isMyTurn ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10B981;animation:pulse 1.5s infinite;"></span>' : ''}
          ${statusText}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// GAME INVITE HANDLER
// ============================================================

async function handleGameInvite(matchId) {
  if (!window.currentUser) return;

  let match;
  try {
    match = await db.games.getMatch(matchId);
  } catch (e) {
    console.error('Failed to load match:', e);
    return;
  }

  const config = GAME_CONFIG[match.game_type] || {};

  // Get challenger info
  let challengerName = 'Someone';
  try {
    const { data } = await window.supabaseClient.from('users').select('name').eq('id', match.challenger_id).single();
    if (data) challengerName = data.name;
  } catch (e) {}

  const modal = document.createElement('div');
  modal.id = 'game-invite-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:white;border-radius:24px;width:90%;max-width:360px;overflow:hidden;animation:slideUp 0.3s ease;">
      <div style="height:80px;background:${config.gradient};display:flex;align-items:center;justify-content:center;">
        <span style="font-size:3rem;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3));">${config.icon}</span>
      </div>
      <div style="padding:24px;text-align:center;">
        <h3 style="margin:0 0 8px;font-family:'Playfair Display';font-size:1.3rem;color:var(--text-main);">${config.name} Challenge!</h3>
        <p style="margin:0 0 4px;color:var(--text-muted);font-size:0.9rem;">${challengerName} wants to play</p>
        ${match.coin_bet > 0 ? `<div style="margin:12px 0;padding:10px;background:#FEF3C7;border-radius:10px;font-weight:700;color:#92400E;font-size:0.9rem;">🪙 ${match.coin_bet} coin bet each</div>` : ''}
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="respondToInvite('${matchId}', false)" style="flex:1;padding:12px;border:2px solid #f1f5f9;border-radius:12px;background:white;font-size:0.9rem;font-weight:600;cursor:pointer;color:var(--text-muted);">Decline</button>
          <button onclick="respondToInvite('${matchId}', true)" style="flex:1;padding:12px;border:none;border-radius:12px;background:${config.gradient};color:white;font-size:0.9rem;font-weight:700;cursor:pointer;">Accept</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function respondToInvite(matchId, accept) {
  const modal = document.getElementById('game-invite-modal');
  if (!window.currentUser) return;

  try {
    if (accept) {
      const result = await db.games.acceptChallenge(matchId, window.currentUser.id);
      if (!result || result.error) {
        alert(result?.message || 'Failed to accept challenge. Please try again.');
        if (modal) modal.remove();
        return;
      }
      if (modal) modal.remove();
      showGameToast('Challenge accepted! Let\'s play!');
      if (typeof loadCoinBalance === 'function') loadCoinBalance();
      openGameBoard(matchId);
    } else {
      await db.games.declineChallenge(matchId, window.currentUser.id);
      if (modal) modal.remove();
      showGameToast('Challenge declined');
    }
    if (typeof loadActiveGames === 'function') loadActiveGames();
  } catch (error) {
    console.error('Failed to respond to invite:', error);
    alert('Something went wrong: ' + (error.message || 'Please try again.'));
    if (modal) modal.remove();
  }
}

// ============================================================
// GAME BOARD - MAIN GAME UI
// ============================================================

async function openGameBoard(matchId) {
  if (!window.currentUser) return;

  let match;
  try {
    match = await db.games.getMatch(matchId);
  } catch (e) {
    console.error('Failed to load match:', e);
    return;
  }

  if (!match || (match.status !== 'active' && match.status !== 'pending')) {
    showGameToast('This game is no longer active');
    return;
  }

  if (match.status === 'pending') {
    if (match.opponent_id === window.currentUser.id) {
      handleGameInvite(matchId);
    } else {
      showGameToast('Waiting for opponent to accept...');
    }
    return;
  }

  activeGameMatch = match;
  const config = GAME_CONFIG[match.game_type] || {};
  const isChallenger = match.challenger_id === window.currentUser.id;
  const myId = window.currentUser.id;
  const opponentId = isChallenger ? match.opponent_id : match.challenger_id;

  // Get player names
  let myName = 'You';
  let opponentName = 'Opponent';
  try {
    const { data: opp } = await window.supabaseClient.from('users').select('name').eq('id', opponentId).single();
    if (opp) opponentName = opp.name;
    const { data: me } = await window.supabaseClient.from('users').select('name').eq('id', myId).single();
    if (me) myName = me.name;
  } catch (e) {}

  // Create fullscreen game view
  const gameView = document.createElement('div');
  gameView.id = 'game-board-overlay';
  gameView.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:10001;display:flex;flex-direction:column;animation:fadeIn 0.2s ease;';

  const isMyTurn = match.current_turn === myId;
  const turnIndicator = isMyTurn ? 'Your Turn' : `${opponentName}'s Turn`;

  gameView.innerHTML = `
    <!-- Game Header -->
    <div style="padding:12px 16px;background:white;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
      <button onclick="closeGameBoard()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;padding:4px 8px;color:var(--text-muted);">
        <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <div style="text-align:center;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${config.name}</div>
        ${match.coin_bet > 0 ? `<div style="font-size:0.7rem;color:#F59E0B;font-weight:600;">🪙 ${match.coin_bet * 2} pot</div>` : ''}
      </div>
      <button onclick="confirmForfeit('${matchId}')" style="background:none;border:none;font-size:0.75rem;cursor:pointer;padding:4px 8px;color:#EF4444;font-weight:600;">Forfeit</button>
    </div>

    <!-- Turn Indicator -->
    <div id="game-turn-indicator" style="padding:8px 16px;text-align:center;font-size:0.85rem;font-weight:700;color:${isMyTurn ? '#10B981' : '#94A3B8'};background:${isMyTurn ? '#ECFDF5' : '#F8FAFC'};">
      ${isMyTurn ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px;animation:pulse 1.5s infinite;"></span>' : ''}${turnIndicator}
    </div>

    <!-- Player Names -->
    <div style="display:flex;justify-content:space-between;padding:8px 16px;background:white;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${isChallenger ? '#1E293B' : '#EF4444'};"></div>
        <span style="font-size:0.8rem;font-weight:600;color:var(--text-main);">${myName} (You)</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.8rem;font-weight:600;color:var(--text-main);">${opponentName}</span>
        <div style="width:8px;height:8px;border-radius:50%;background:${isChallenger ? '#EF4444' : '#1E293B'};"></div>
      </div>
    </div>

    <!-- Game Board Container -->
    <div id="game-board-container" style="flex:1;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;">
      <div id="game-board-inner" style="width:100%;max-width:400px;"></div>
    </div>

    <!-- Game Status Bar -->
    <div id="game-status-bar" style="padding:12px 16px;background:white;border-top:1px solid #f1f5f9;text-align:center;font-size:0.85rem;color:var(--text-muted);"></div>
  `;

  document.body.appendChild(gameView);

  // Hide bottom nav
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'none';

  // Initialize the appropriate game engine
  initGameEngine(match, myId, opponentId, isChallenger);

  // Start polling for opponent moves
  startGamePolling(matchId, myId);
}

function closeGameBoard() {
  const overlay = document.getElementById('game-board-overlay');
  if (overlay) overlay.remove();
  stopGamePolling();
  if (aiMoveTimeout) { clearTimeout(aiMoveTimeout); aiMoveTimeout = null; }
  activeGameMatch = null;
  activeGameEngine = null;
  // Restore bottom nav
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'flex';
  // Refresh games list
  if (typeof loadActiveGames === 'function') loadActiveGames();
}

async function confirmForfeit(matchId) {
  if (!confirm('Are you sure you want to forfeit? You\'ll lose the game and any coins bet.')) return;
  try {
    await db.games.forfeitGame(matchId, window.currentUser.id);
    showGameToast('You forfeited the game');
    closeGameBoard();
    if (typeof loadCoinBalance === 'function') loadCoinBalance();
  } catch (e) {
    console.error('Forfeit failed:', e);
  }
}

// ============================================================
// GAME POLLING (check for opponent moves)
// ============================================================

function startGamePolling(matchId, myId) {
  stopGamePolling();
  gamePollingInterval = setInterval(async () => {
    try {
      const match = await db.games.getMatch(matchId);
      if (!match) { stopGamePolling(); return; }

      if (match.status === 'completed' || match.status === 'draw' || match.status === 'forfeit') {
        stopGamePolling();
        showGameResult(match, myId);
        return;
      }

      // If the game state changed (opponent made a move), update the board
      if (activeGameMatch && match.move_count !== activeGameMatch.move_count) {
        activeGameMatch = match;
        if (activeGameEngine && activeGameEngine.updateFromState) {
          activeGameEngine.updateFromState(match.game_state, match.current_turn);
        }
        updateTurnIndicator(match.current_turn === myId, match);
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
}

function stopGamePolling() {
  if (gamePollingInterval) {
    clearInterval(gamePollingInterval);
    gamePollingInterval = null;
  }
}

function updateTurnIndicator(isMyTurn, match) {
  const indicator = document.getElementById('game-turn-indicator');
  if (!indicator) return;
  const pulse = isMyTurn ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px;animation:pulse 1.5s infinite;"></span>' : '';
  indicator.innerHTML = `${pulse}${isMyTurn ? 'Your Turn' : 'Their Turn'}`;
  indicator.style.color = isMyTurn ? '#10B981' : '#94A3B8';
  indicator.style.background = isMyTurn ? '#ECFDF5' : '#F8FAFC';
}

// ============================================================
// GAME RESULT
// ============================================================

function showGameResult(match, myId) {
  const isWinner = match.winner_id === myId;
  const isDraw = match.status === 'draw';
  const config = GAME_CONFIG[match.game_type] || {};
  const winnings = match.coin_bet * 2;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;';

  let title, subtitle, bgGradient, icon;
  if (isDraw) {
    title = 'Draw!';
    subtitle = match.coin_bet > 0 ? `🪙 ${match.coin_bet} coins refunded` : 'Well played!';
    bgGradient = 'linear-gradient(135deg, #6B7280, #9CA3AF)';
    icon = '🤝';
  } else if (isWinner) {
    title = 'You Won!';
    subtitle = match.coin_bet > 0 ? `🪙 +${winnings} coins won!` : 'Great game!';
    bgGradient = 'linear-gradient(135deg, #F59E0B, #FBBF24)';
    icon = '🏆';
  } else {
    title = 'You Lost';
    subtitle = match.coin_bet > 0 ? `🪙 ${match.coin_bet} coins lost` : 'Better luck next time!';
    bgGradient = 'linear-gradient(135deg, #6B7280, #9CA3AF)';
    icon = '😔';
  }

  overlay.innerHTML = `
    <div style="background:white;border-radius:24px;width:90%;max-width:340px;overflow:hidden;animation:slideUp 0.4s ease;text-align:center;">
      <div style="height:100px;background:${bgGradient};display:flex;align-items:center;justify-content:center;">
        <span style="font-size:4rem;">${icon}</span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px;font-family:'Playfair Display';font-size:1.6rem;color:var(--text-main);">${title}</h2>
        <p style="margin:0 0 20px;color:var(--text-muted);font-size:0.95rem;">${subtitle}</p>
        <button onclick="this.closest('div[style*=fixed]').remove(); closeGameBoard();" style="width:100%;padding:14px;border:none;border-radius:12px;background:${config.gradient || bgGradient};color:white;font-size:1rem;font-weight:700;cursor:pointer;">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  if (typeof loadCoinBalance === 'function') loadCoinBalance();
}

// ============================================================
// GAME ENGINE INITIALIZATION
// ============================================================

function initGameEngine(match, myId, opponentId, isChallenger) {
  const boardEl = document.getElementById('game-board-inner');
  if (!boardEl) return;

  // Initialize board from game_state or create new board
  const state = match.game_state || {};

  switch (match.game_type) {
    case 'tic_tac_toe':
      activeGameEngine = new TicTacToeEngine(boardEl, match, myId, isChallenger);
      break;
    case 'connect4':
      activeGameEngine = new Connect4Engine(boardEl, match, myId, isChallenger);
      break;
    case 'checkers':
      activeGameEngine = new CheckersEngine(boardEl, match, myId, isChallenger);
      break;
    case 'chess':
      activeGameEngine = new ChessEngine(boardEl, match, myId, isChallenger);
      break;
    case 'reversi':
      activeGameEngine = new ReversiEngine(boardEl, match, myId, isChallenger);
      break;
    case 'battleships':
      activeGameEngine = new BattleshipsEngine(boardEl, match, myId, isChallenger);
      break;
    default:
      boardEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Game not supported yet</div>';
  }
}

// ============================================================
// SHARED GAME UTILITIES
// ============================================================

async function makeGameMove(match, moveData, newBoard, nextTurn, checkResult) {
  // LOCAL AI GAME - skip all DB operations
  if (match.is_local) {
    match.move_count = (match.move_count || 0) + 1;
    match.game_state = { board: newBoard };

    if (checkResult && checkResult.winner) {
      showLocalGameResult(checkResult);
      return;
    }
    if (checkResult && checkResult.draw) {
      showLocalGameResult({ draw: true });
      return;
    }

    match.current_turn = nextTurn;
    activeGameMatch = match;
    updateTurnIndicator(nextTurn === match.challenger_id, match);

    // Schedule AI move if it's AI's turn
    if (nextTurn === 'ai-bot') {
      scheduleAIMove();
    }
    return;
  }

  // ONLINE GAME - normal DB flow
  const matchId = match.id;
  const myId = window.currentUser.id;

  try {
    // Record the move
    await db.games.recordMove(matchId, myId, (match.move_count || 0) + 1, moveData);

    // Check for win/draw
    if (checkResult && checkResult.winner) {
      const winnerId = checkResult.winner === 'me' ? myId : (match.challenger_id === myId ? match.opponent_id : match.challenger_id);
      await db.games.updateGameState(matchId, { board: newBoard }, nextTurn, (match.move_count || 0) + 1);
      await db.games.completeGame(matchId, winnerId, false);
      // Result will be shown by polling
      return;
    }

    if (checkResult && checkResult.draw) {
      await db.games.updateGameState(matchId, { board: newBoard }, nextTurn, (match.move_count || 0) + 1);
      await db.games.completeGame(matchId, null, true);
      return;
    }

    // Normal move - update state and switch turn
    const updatedMatch = await db.games.updateGameState(
      matchId,
      { board: newBoard },
      nextTurn,
      (match.move_count || 0) + 1
    );

    activeGameMatch = updatedMatch;
    updateTurnIndicator(nextTurn === myId, updatedMatch);
  } catch (error) {
    console.error('Failed to make move:', error);
    showGameToast('Failed to make move. Try again.');
  }
}

// ============================================================
// TIC TAC TOE ENGINE
// ============================================================

class TicTacToeEngine {
  constructor(container, match, myId, isChallenger) {
    this.container = container;
    this.match = match;
    this.myId = myId;
    this.mySymbol = isChallenger ? 'X' : 'O';
    this.opponentSymbol = isChallenger ? 'O' : 'X';
    this.board = (match.game_state && match.game_state.board) || Array(9).fill(null);
    this.render();
  }

  render() {
    const isMyTurn = this.match.current_turn === this.myId;
    this.container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:320px;margin:0 auto;aspect-ratio:1;">
        ${this.board.map((cell, i) => `
          <div onclick="${isMyTurn && !cell ? `activeGameEngine.makeMove(${i})` : ''}"
               style="background:white;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:800;
                      cursor:${isMyTurn && !cell ? 'pointer' : 'default'};
                      color:${cell === 'X' ? '#1E293B' : '#EF4444'};
                      box-shadow:0 2px 8px rgba(0,0,0,0.06);
                      transition:all 0.15s;
                      ${isMyTurn && !cell ? 'hover:shadow:0 4px 12px rgba(0,0,0,0.1);' : ''}">
            ${cell || ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  async makeMove(index) {
    if (this.board[index] || this.match.current_turn !== this.myId) return;

    this.board[index] = this.mySymbol;
    const opponentId = this.match.challenger_id === this.myId ? this.match.opponent_id : this.match.challenger_id;
    const nextTurn = opponentId;
    const result = this.checkWin();

    this.match.move_count = (this.match.move_count || 0) + 1;
    this.match.current_turn = nextTurn;

    this.render();
    await makeGameMove(this.match, { index, symbol: this.mySymbol }, this.board, nextTurn, result);
  }

  checkWin() {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of lines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return { winner: this.board[a] === this.mySymbol ? 'me' : 'opponent' };
      }
    }
    if (this.board.every(c => c !== null)) return { draw: true };
    return null;
  }

  updateFromState(state, currentTurn) {
    if (state && state.board) this.board = state.board;
    this.match.current_turn = currentTurn;
    this.match.game_state = state;
    this.render();
  }
}

// ============================================================
// CONNECT 4 ENGINE
// ============================================================

class Connect4Engine {
  constructor(container, match, myId, isChallenger) {
    this.container = container;
    this.match = match;
    this.myId = myId;
    this.rows = 6;
    this.cols = 7;
    this.myColor = isChallenger ? 'R' : 'Y'; // Red or Yellow
    this.opponentColor = isChallenger ? 'Y' : 'R';
    this.board = (match.game_state && match.game_state.board) || Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
    this.render();
  }

  render() {
    const isMyTurn = this.match.current_turn === this.myId;
    const cellSize = Math.min(48, (window.innerWidth - 60) / this.cols);

    // Column drop buttons
    let dropBtns = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px;">';
    for (let c = 0; c < this.cols; c++) {
      const canDrop = isMyTurn && this.board[0][c] === null;
      dropBtns += `<div onclick="${canDrop ? `activeGameEngine.dropPiece(${c})` : ''}" style="height:30px;border-radius:8px;cursor:${canDrop ? 'pointer' : 'default'};background:${canDrop ? 'rgba(123,168,131,0.15)' : 'transparent'};display:flex;align-items:center;justify-content:center;">
        ${canDrop ? '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:var(--primary);"><path d="M7 10l5 5 5-5z"/></svg>' : ''}
      </div>`;
    }
    dropBtns += '</div>';

    // Board grid
    let grid = `<div style="background:#2563EB;border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(${this.cols},1fr);gap:3px;">`;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        let color = '#E2E8F0';
        if (cell === 'R') color = '#EF4444';
        if (cell === 'Y') color = '#FBBF24';
        grid += `<div style="width:${cellSize}px;height:${cellSize}px;border-radius:50%;background:${color};transition:all 0.3s;box-shadow:inset 0 2px 4px rgba(0,0,0,0.15);"></div>`;
      }
    }
    grid += '</div>';

    this.container.innerHTML = `<div style="max-width:380px;margin:0 auto;">${dropBtns}${grid}</div>`;
  }

  async dropPiece(col) {
    if (this.match.current_turn !== this.myId) return;

    // Find lowest empty row
    let row = -1;
    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.board[r][col] === null) { row = r; break; }
    }
    if (row === -1) return; // Column full

    this.board[row][col] = this.myColor;
    const opponentId = this.match.challenger_id === this.myId ? this.match.opponent_id : this.match.challenger_id;
    const nextTurn = opponentId;
    const result = this.checkWin(row, col);

    this.match.move_count = (this.match.move_count || 0) + 1;
    this.match.current_turn = nextTurn;

    this.render();
    await makeGameMove(this.match, { col, row, color: this.myColor }, this.board, nextTurn, result);
  }

  checkWin(row, col) {
    const color = this.board[row][col];
    const directions = [[0,1],[1,0],[1,1],[1,-1]];

    for (const [dr, dc] of directions) {
      let count = 1;
      for (let d = 1; d <= 3; d++) {
        const nr = row + dr * d, nc = col + dc * d;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc] === color) count++;
        else break;
      }
      for (let d = 1; d <= 3; d++) {
        const nr = row - dr * d, nc = col - dc * d;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc] === color) count++;
        else break;
      }
      if (count >= 4) return { winner: color === this.myColor ? 'me' : 'opponent' };
    }

    // Check draw
    if (this.board[0].every(c => c !== null)) return { draw: true };
    return null;
  }

  updateFromState(state, currentTurn) {
    if (state && state.board) this.board = state.board;
    this.match.current_turn = currentTurn;
    this.match.game_state = state;
    this.render();
  }
}

// ============================================================
// CHECKERS ENGINE
// ============================================================

class CheckersEngine {
  constructor(container, match, myId, isChallenger) {
    this.container = container;
    this.match = match;
    this.myId = myId;
    this.isChallenger = isChallenger;
    // Challenger plays dark (bottom), opponent plays light (top)
    this.myPiece = isChallenger ? 'D' : 'L';
    this.opponentPiece = isChallenger ? 'L' : 'D';
    this.board = (match.game_state && match.game_state.board) || this.initBoard();
    this.selectedPiece = null;
    this.validMoves = [];
    this.render();
  }

  initBoard() {
    // 8x8 board, D = dark piece, L = light piece, DK/LK = kings
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    // Light pieces (top 3 rows, on dark squares)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) board[r][c] = 'L';
      }
    }
    // Dark pieces (bottom 3 rows, on dark squares)
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) board[r][c] = 'D';
      }
    }
    return board;
  }

  render() {
    const isMyTurn = this.match.current_turn === this.myId;
    const cellSize = Math.min(44, (window.innerWidth - 48) / 8);

    // Flip board if opponent (plays from top perspective)
    const displayBoard = this.isChallenger ? this.board : [...this.board].reverse().map(r => [...r].reverse());

    let grid = '<div style="border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:inline-block;">';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const actualR = this.isChallenger ? r : 7 - r;
        const actualC = this.isChallenger ? c : 7 - c;
        const isDark = (r + c) % 2 === 1;
        const cell = displayBoard[r][c];
        const isSelected = this.selectedPiece && this.selectedPiece[0] === actualR && this.selectedPiece[1] === actualC;
        const isValidTarget = this.validMoves.some(m => m.to[0] === actualR && m.to[1] === actualC);

        let bgColor = isDark ? '#8B6C42' : '#F5DEB3';
        if (isSelected) bgColor = '#FBBF24';
        if (isValidTarget) bgColor = '#86EFAC';

        let piece = '';
        if (cell) {
          const isMyPiece = (cell === this.myPiece || cell === this.myPiece + 'K');
          const isKing = cell.includes('K');
          const pieceColor = cell.startsWith('D') ? '#1E293B' : '#EF4444';
          piece = `<div style="width:${cellSize * 0.7}px;height:${cellSize * 0.7}px;border-radius:50%;background:${pieceColor};box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;border:2px solid ${pieceColor === '#1E293B' ? '#475569' : '#F87171'};${isMyPiece && isMyTurn ? 'cursor:pointer;' : ''}">
            ${isKing ? '<span style="color:gold;font-size:0.7rem;">&#9813;</span>' : ''}
          </div>`;
        }

        const clickHandler = isMyTurn ? `activeGameEngine.handleClick(${actualR},${actualC})` : '';

        grid += `<div onclick="${clickHandler}" style="width:${cellSize}px;height:${cellSize}px;background:${bgColor};display:inline-flex;align-items:center;justify-content:center;${isDark && isMyTurn ? 'cursor:pointer;' : ''}">${piece}</div>`;
      }
      grid += '<br>';
    }
    grid += '</div>';

    const statusBar = document.getElementById('game-status-bar');
    if (statusBar) {
      const myCount = this.countPieces(this.myPiece);
      const oppCount = this.countPieces(this.opponentPiece);
      statusBar.innerHTML = `You: ${myCount} pieces | Opponent: ${oppCount} pieces`;
    }

    this.container.innerHTML = `<div style="text-align:center;">${grid}</div>`;
  }

  countPieces(piece) {
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] && this.board[r][c].startsWith(piece[0])) count++;
      }
    }
    return count;
  }

  handleClick(r, c) {
    if (this.match.current_turn !== this.myId) return;

    const cell = this.board[r][c];

    // If clicking a valid move target
    if (this.selectedPiece && this.validMoves.some(m => m.to[0] === r && m.to[1] === c)) {
      const move = this.validMoves.find(m => m.to[0] === r && m.to[1] === c);
      this.executeMove(move);
      return;
    }

    // If clicking own piece, select it
    if (cell && (cell === this.myPiece || cell === this.myPiece + 'K')) {
      this.selectedPiece = [r, c];
      this.validMoves = this.getValidMoves(r, c);
      this.render();
      return;
    }

    // Deselect
    this.selectedPiece = null;
    this.validMoves = [];
    this.render();
  }

  getValidMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const isKing = piece.includes('K');
    const moves = [];

    // Direction: D moves up (-1), L moves down (+1), kings both
    let dirs = [];
    if (piece.startsWith('D')) dirs.push(-1);
    if (piece.startsWith('L')) dirs.push(1);
    if (isKing) dirs = [-1, 1];

    // Check captures first (forced captures)
    const captures = this.getCaptures(r, c, piece, dirs);
    if (captures.length > 0) return captures;

    // Check if any piece has a capture (forced capture rule)
    if (this.hasAnyCapture()) return [];

    // Simple moves
    for (const dr of dirs) {
      for (const dc of [-1, 1]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !this.board[nr][nc]) {
          moves.push({ from: [r, c], to: [nr, nc], captures: [] });
        }
      }
    }

    return moves;
  }

  getCaptures(r, c, piece, dirs) {
    const captures = [];
    for (const dr of dirs) {
      for (const dc of [-1, 1]) {
        const mr = r + dr, mc = c + dc; // middle (captured)
        const nr = r + dr * 2, nc = c + dc * 2; // landing
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const middle = this.board[mr][mc];
          if (middle && middle[0] !== piece[0] && !this.board[nr][nc]) {
            captures.push({ from: [r, c], to: [nr, nc], captures: [[mr, mc]] });
          }
        }
      }
    }
    return captures;
  }

  hasAnyCapture() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.board[r][c];
        if (cell && (cell === this.myPiece || cell === this.myPiece + 'K')) {
          const isKing = cell.includes('K');
          let dirs = [];
          if (cell.startsWith('D')) dirs.push(-1);
          if (cell.startsWith('L')) dirs.push(1);
          if (isKing) dirs = [-1, 1];
          if (this.getCaptures(r, c, cell, dirs).length > 0) return true;
        }
      }
    }
    return false;
  }

  async executeMove(move) {
    const piece = this.board[move.from[0]][move.from[1]];
    this.board[move.from[0]][move.from[1]] = null;
    this.board[move.to[0]][move.to[1]] = piece;

    // Remove captured pieces
    for (const [cr, cc] of move.captures) {
      this.board[cr][cc] = null;
    }

    // King promotion
    if (piece === 'D' && move.to[0] === 0) this.board[move.to[0]][move.to[1]] = 'DK';
    if (piece === 'L' && move.to[0] === 7) this.board[move.to[0]][move.to[1]] = 'LK';

    const opponentId = this.match.challenger_id === this.myId ? this.match.opponent_id : this.match.challenger_id;
    const nextTurn = opponentId;
    const result = this.checkWin();

    this.match.move_count = (this.match.move_count || 0) + 1;
    this.match.current_turn = nextTurn;
    this.selectedPiece = null;
    this.validMoves = [];

    this.render();
    await makeGameMove(this.match, { from: move.from, to: move.to, captures: move.captures }, this.board, nextTurn, result);
  }

  checkWin() {
    const myCount = this.countPieces(this.myPiece);
    const oppCount = this.countPieces(this.opponentPiece);
    if (oppCount === 0) return { winner: 'me' };
    if (myCount === 0) return { winner: 'opponent' };
    return null;
  }

  updateFromState(state, currentTurn) {
    if (state && state.board) this.board = state.board;
    this.match.current_turn = currentTurn;
    this.match.game_state = state;
    this.selectedPiece = null;
    this.validMoves = [];
    this.render();
  }
}

// ============================================================
// CHESS ENGINE (Simplified)
// ============================================================

class ChessEngine {
  constructor(container, match, myId, isChallenger) {
    this.container = container;
    this.match = match;
    this.myId = myId;
    this.isChallenger = isChallenger;
    this.myColor = isChallenger ? 'w' : 'b';
    this.opponentColor = isChallenger ? 'b' : 'w';
    this.board = (match.game_state && match.game_state.board) || this.initBoard();
    this.selectedPiece = null;
    this.validMoves = [];
    this.render();
  }

  initBoard() {
    // Standard chess setup: lowercase = black, uppercase = white
    return [
      ['br','bn','bb','bq','bk','bb','bn','br'],
      ['bp','bp','bp','bp','bp','bp','bp','bp'],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      ['wp','wp','wp','wp','wp','wp','wp','wp'],
      ['wr','wn','wb','wq','wk','wb','wn','wr']
    ];
  }

  getPieceSymbol(piece) {
    if (!piece) return '';
    const symbols = {
      'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
      'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
    };
    return symbols[piece] || '';
  }

  render() {
    const isMyTurn = this.match.current_turn === this.myId;
    const cellSize = Math.min(44, (window.innerWidth - 48) / 8);

    // Flip board for black player
    const displayBoard = this.isChallenger ? this.board : [...this.board].reverse().map(r => [...r].reverse());

    let grid = '<div style="border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:inline-block;">';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const actualR = this.isChallenger ? r : 7 - r;
        const actualC = this.isChallenger ? c : 7 - c;
        const isDark = (r + c) % 2 === 1;
        const cell = displayBoard[r][c];
        const isSelected = this.selectedPiece && this.selectedPiece[0] === actualR && this.selectedPiece[1] === actualC;
        const isValidTarget = this.validMoves.some(m => m[0] === actualR && m[1] === actualC);

        let bgColor = isDark ? '#779556' : '#EBECD0';
        if (isSelected) bgColor = '#FBBF24';
        if (isValidTarget) bgColor = isDark ? '#86EFAC' : '#BBF7D0';

        const clickHandler = isMyTurn ? `activeGameEngine.handleClick(${actualR},${actualC})` : '';

        grid += `<div onclick="${clickHandler}" style="width:${cellSize}px;height:${cellSize}px;background:${bgColor};display:inline-flex;align-items:center;justify-content:center;font-size:${cellSize * 0.65}px;cursor:${isMyTurn ? 'pointer' : 'default'};user-select:none;">${this.getPieceSymbol(cell)}</div>`;
      }
      grid += '<br>';
    }
    grid += '</div>';

    this.container.innerHTML = `<div style="text-align:center;">${grid}</div>`;

    // Update status bar
    const statusBar = document.getElementById('game-status-bar');
    if (statusBar) {
      statusBar.innerHTML = this.selectedPiece ? 'Tap a highlighted square to move' : (isMyTurn ? 'Tap a piece to select it' : 'Waiting for opponent...');
    }
  }

  handleClick(r, c) {
    if (this.match.current_turn !== this.myId) return;

    const cell = this.board[r][c];

    // If clicking a valid move target
    if (this.selectedPiece && this.validMoves.some(m => m[0] === r && m[1] === c)) {
      this.executeMove(this.selectedPiece, [r, c]);
      return;
    }

    // If clicking own piece
    if (cell && cell[0] === this.myColor) {
      this.selectedPiece = [r, c];
      this.validMoves = this.getValidMoves(r, c);
      this.render();
      return;
    }

    this.selectedPiece = null;
    this.validMoves = [];
    this.render();
  }

  getValidMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece) return [];
    const type = piece[1];
    const color = piece[0];
    const moves = [];

    switch (type) {
      case 'p': { // Pawn
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        // Forward one
        if (r + dir >= 0 && r + dir < 8 && !this.board[r + dir][c]) {
          moves.push([r + dir, c]);
          // Forward two from start
          if (r === startRow && !this.board[r + dir * 2][c]) {
            moves.push([r + dir * 2, c]);
          }
        }
        // Captures
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (this.board[nr][nc] && this.board[nr][nc][0] !== color) {
              moves.push([nr, nc]);
            }
          }
        }
        break;
      }
      case 'r': // Rook
        this.addSlidingMoves(r, c, color, [[0,1],[0,-1],[1,0],[-1,0]], moves);
        break;
      case 'b': // Bishop
        this.addSlidingMoves(r, c, color, [[1,1],[1,-1],[-1,1],[-1,-1]], moves);
        break;
      case 'q': // Queen
        this.addSlidingMoves(r, c, color, [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]], moves);
        break;
      case 'n': // Knight
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (!this.board[nr][nc] || this.board[nr][nc][0] !== color) moves.push([nr, nc]);
          }
        }
        break;
      case 'k': // King
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              if (!this.board[nr][nc] || this.board[nr][nc][0] !== color) moves.push([nr, nc]);
            }
          }
        }
        break;
    }

    return moves;
  }

  addSlidingMoves(r, c, color, directions, moves) {
    for (const [dr, dc] of directions) {
      for (let d = 1; d < 8; d++) {
        const nr = r + dr * d, nc = c + dc * d;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
        if (this.board[nr][nc]) {
          if (this.board[nr][nc][0] !== color) moves.push([nr, nc]);
          break;
        }
        moves.push([nr, nc]);
      }
    }
  }

  async executeMove(from, to) {
    const piece = this.board[from[0]][from[1]];
    const captured = this.board[to[0]][to[1]];

    this.board[from[0]][from[1]] = null;
    this.board[to[0]][to[1]] = piece;

    // Pawn promotion (auto queen)
    if (piece[1] === 'p' && (to[0] === 0 || to[0] === 7)) {
      this.board[to[0]][to[1]] = piece[0] + 'q';
    }

    const opponentId = this.match.challenger_id === this.myId ? this.match.opponent_id : this.match.challenger_id;
    const nextTurn = opponentId;

    // Check if king was captured
    let result = null;
    if (captured && captured[1] === 'k') {
      result = { winner: 'me' };
    }

    // Check for stalemate (opponent has no pieces)
    if (!result) {
      let oppPieceCount = 0;
      for (let rr = 0; rr < 8; rr++) {
        for (let cc = 0; cc < 8; cc++) {
          if (this.board[rr][cc] && this.board[rr][cc][0] === this.opponentColor) oppPieceCount++;
        }
      }
      if (oppPieceCount === 0) result = { winner: 'me' };
    }

    this.match.move_count = (this.match.move_count || 0) + 1;
    this.match.current_turn = nextTurn;
    this.selectedPiece = null;
    this.validMoves = [];

    this.render();
    await makeGameMove(this.match, { from, to, piece, captured }, this.board, nextTurn, result);
  }

  updateFromState(state, currentTurn) {
    if (state && state.board) this.board = state.board;
    this.match.current_turn = currentTurn;
    this.match.game_state = state;
    this.selectedPiece = null;
    this.validMoves = [];
    this.render();
  }
}

// ============================================================
// REVERSI (OTHELLO) ENGINE
// ============================================================

class ReversiEngine {
  constructor(container, match, myId, isChallenger) {
    this.container = container;
    this.match = match;
    this.myId = myId;
    this.myColor = isChallenger ? 'B' : 'W'; // Black goes first
    this.opponentColor = isChallenger ? 'W' : 'B';
    this.board = (match.game_state && match.game_state.board) || this.initBoard();
    this.render();
  }

  initBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    board[3][3] = 'W'; board[3][4] = 'B';
    board[4][3] = 'B'; board[4][4] = 'W';
    return board;
  }

  render() {
    const isMyTurn = this.match.current_turn === this.myId;
    const cellSize = Math.min(42, (window.innerWidth - 56) / 8);
    const validMoves = isMyTurn ? this.getAllValidMoves(this.myColor) : [];

    let grid = '<div style="background:#059669;border-radius:12px;padding:6px;display:inline-block;box-shadow:0 4px 12px rgba(0,0,0,0.15);">';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = this.board[r][c];
        const isValid = validMoves.some(m => m[0] === r && m[1] === c);

        let content = '';
        if (cell === 'B') {
          content = `<div style="width:${cellSize * 0.75}px;height:${cellSize * 0.75}px;border-radius:50%;background:#1E293B;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`;
        } else if (cell === 'W') {
          content = `<div style="width:${cellSize * 0.75}px;height:${cellSize * 0.75}px;border-radius:50%;background:white;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`;
        } else if (isValid) {
          content = `<div style="width:${cellSize * 0.35}px;height:${cellSize * 0.35}px;border-radius:50%;background:rgba(255,255,255,0.3);"></div>`;
        }

        const clickHandler = isValid ? `activeGameEngine.makeMove(${r},${c})` : '';

        grid += `<div onclick="${clickHandler}" style="width:${cellSize}px;height:${cellSize}px;background:#15803D;border:1px solid #059669;display:inline-flex;align-items:center;justify-content:center;cursor:${isValid ? 'pointer' : 'default'};">${content}</div>`;
      }
      grid += '<br>';
    }
    grid += '</div>';

    // Score
    let bCount = 0, wCount = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (this.board[r][c] === 'B') bCount++;
      if (this.board[r][c] === 'W') wCount++;
    }

    const myCount = this.myColor === 'B' ? bCount : wCount;
    const oppCount = this.myColor === 'B' ? wCount : bCount;

    this.container.innerHTML = `<div style="text-align:center;">${grid}</div>`;

    const statusBar = document.getElementById('game-status-bar');
    if (statusBar) {
      statusBar.innerHTML = `You: ${myCount} | Opponent: ${oppCount}`;
    }
  }

  getAllValidMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === null && this.getFlips(r, c, color).length > 0) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  }

  getFlips(r, c, color) {
    const opp = color === 'B' ? 'W' : 'B';
    const flips = [];
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    for (const [dr, dc] of dirs) {
      const lineFlips = [];
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && this.board[nr][nc] === opp) {
        lineFlips.push([nr, nc]);
        nr += dr; nc += dc;
      }
      if (lineFlips.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && this.board[nr][nc] === color) {
        flips.push(...lineFlips);
      }
    }
    return flips;
  }

  async makeMove(r, c) {
    if (this.match.current_turn !== this.myId) return;

    const flips = this.getFlips(r, c, this.myColor);
    if (flips.length === 0) return;

    this.board[r][c] = this.myColor;
    for (const [fr, fc] of flips) {
      this.board[fr][fc] = this.myColor;
    }

    const opponentId = this.match.challenger_id === this.myId ? this.match.opponent_id : this.match.challenger_id;
    let nextTurn = opponentId;

    // Check if opponent has valid moves, if not skip their turn
    const oppMoves = this.getAllValidMoves(this.opponentColor);
    if (oppMoves.length === 0) {
      const myMoves = this.getAllValidMoves(this.myColor);
      if (myMoves.length === 0) {
        // Game over - count pieces
        let bCount = 0, wCount = 0;
        for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
          if (this.board[rr][cc] === 'B') bCount++;
          if (this.board[rr][cc] === 'W') wCount++;
        }
        const myCount = this.myColor === 'B' ? bCount : wCount;
        const oppCount = this.myColor === 'B' ? wCount : bCount;
        let result;
        if (myCount > oppCount) result = { winner: 'me' };
        else if (oppCount > myCount) result = { winner: 'opponent' };
        else result = { draw: true };

        this.match.move_count = (this.match.move_count || 0) + 1;
        this.render();
        await makeGameMove(this.match, { row: r, col: c, flips }, this.board, nextTurn, result);
        return;
      }
      nextTurn = this.myId; // Skip opponent's turn
    }

    this.match.move_count = (this.match.move_count || 0) + 1;
    this.match.current_turn = nextTurn;
    this.render();
    await makeGameMove(this.match, { row: r, col: c, flips }, this.board, nextTurn, null);
  }

  updateFromState(state, currentTurn) {
    if (state && state.board) this.board = state.board;
    this.match.current_turn = currentTurn;
    this.match.game_state = state;
    this.render();
  }
}

// ============================================================
// BATTLESHIPS ENGINE
// ============================================================

class BattleshipsEngine {
  constructor(container, match, myId, isChallenger) {
    this.container = container;
    this.match = match;
    this.myId = myId;
    this.isChallenger = isChallenger;
    this.gridSize = 8;

    const state = match.game_state || {};
    if (state.board && state.board.myShips) {
      // Existing game - load state for current player perspective
      const playerKey = isChallenger ? 'challenger' : 'opponent';
      const oppKey = isChallenger ? 'opponent' : 'challenger';
      this.myShips = state.board[playerKey + 'Ships'] || [];
      this.myGrid = state.board[playerKey + 'Grid'] || Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
      this.attackGrid = state.board[playerKey + 'Attacks'] || Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
      this.placementDone = true;
      this.phase = 'battle';
    } else {
      // New game - start with placement
      this.ships = [
        { name: 'Carrier', size: 4, placed: false },
        { name: 'Cruiser', size: 3, placed: false },
        { name: 'Destroyer', size: 2, placed: false },
        { name: 'Sub', size: 2, placed: false }
      ];
      this.myShips = [];
      this.myGrid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
      this.attackGrid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
      this.placementDone = false;
      this.currentShipIndex = 0;
      this.isHorizontal = true;
      this.phase = 'placement';
    }

    this.viewingMyBoard = false;
    this.render();
  }

  render() {
    if (this.phase === 'placement') {
      this.renderPlacement();
    } else {
      this.renderBattle();
    }
  }

  renderPlacement() {
    const cellSize = Math.min(38, (window.innerWidth - 56) / this.gridSize);
    const ship = this.ships[this.currentShipIndex];

    let grid = `<div style="display:inline-block;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const hasShip = this.myGrid[r][c] === 'S';
        grid += `<div onclick="activeGameEngine.placeShip(${r},${c})" style="width:${cellSize}px;height:${cellSize}px;background:${hasShip ? '#0369A1' : '#E0F2FE'};border:1px solid #BAE6FD;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;">
          ${hasShip ? '<div style="width:60%;height:60%;border-radius:3px;background:#0EA5E9;"></div>' : ''}
        </div>`;
      }
      grid += '<br>';
    }
    grid += '</div>';

    this.container.innerHTML = `
      <div style="text-align:center;">
        <div style="margin-bottom:12px;padding:10px;background:#E0F2FE;border-radius:10px;">
          <div style="font-size:0.85rem;font-weight:700;color:#0369A1;margin-bottom:4px;">Place your ${ship ? ship.name : ''} (${ship ? ship.size : 0} cells)</div>
          <button onclick="activeGameEngine.toggleOrientation()" style="background:white;border:1px solid #BAE6FD;border-radius:8px;padding:6px 14px;font-size:0.8rem;font-weight:600;cursor:pointer;color:#0369A1;">
            ${this.isHorizontal ? '↔️ Horizontal' : '↕️ Vertical'}
          </button>
        </div>
        ${grid}
        ${this.currentShipIndex > 0 ? '<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">Ships placed: ' + this.currentShipIndex + '/' + this.ships.length + '</div>' : ''}
      </div>
    `;
  }

  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
    this.render();
  }

  placeShip(r, c) {
    if (this.currentShipIndex >= this.ships.length) return;
    const ship = this.ships[this.currentShipIndex];

    // Check if placement is valid
    const cells = [];
    for (let i = 0; i < ship.size; i++) {
      const nr = this.isHorizontal ? r : r + i;
      const nc = this.isHorizontal ? c + i : c;
      if (nr >= this.gridSize || nc >= this.gridSize || this.myGrid[nr][nc] === 'S') return;
      cells.push([nr, nc]);
    }

    // Place ship
    for (const [sr, sc] of cells) {
      this.myGrid[sr][sc] = 'S';
    }
    this.myShips.push({ name: ship.name, cells, hits: 0 });
    this.currentShipIndex++;

    if (this.currentShipIndex >= this.ships.length) {
      this.phase = 'battle';
      this.placementDone = true;
      this.saveShipPlacement();
    }

    this.render();
  }

  async saveShipPlacement() {
    const playerKey = this.isChallenger ? 'challenger' : 'opponent';
    const state = this.match.game_state || { board: {} };
    if (!state.board) state.board = {};
    state.board[playerKey + 'Ships'] = this.myShips;
    state.board[playerKey + 'Grid'] = this.myGrid;
    state.board[playerKey + 'Attacks'] = this.attackGrid;

    // LOCAL AI GAME - just save locally
    if (this.match.is_local) {
      this.match.game_state = state;
      showGameToast('Ships placed! Fire away!');
      return;
    }

    try {
      await db.games.updateGameState(this.match.id, state, this.match.current_turn, this.match.move_count || 0);
      this.match.game_state = state;
      showGameToast('Ships placed! Attack when it\'s your turn.');
    } catch (e) {
      console.error('Failed to save ship placement:', e);
    }
  }

  renderBattle() {
    const isMyTurn = this.match.current_turn === this.myId;
    const cellSize = Math.min(36, (window.innerWidth - 56) / this.gridSize);

    // Attack grid (opponent's board from our perspective)
    let attackGridHtml = `<div style="display:inline-block;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = this.attackGrid[r][c];
        let bg = '#E0F2FE';
        let content = '';
        if (cell === 'hit') { bg = '#FCA5A5'; content = '<div style="color:#EF4444;font-weight:900;font-size:0.9rem;">X</div>'; }
        if (cell === 'miss') { bg = '#CBD5E1'; content = '<div style="width:6px;height:6px;border-radius:50%;background:#94A3B8;"></div>'; }
        const canAttack = isMyTurn && !cell;

        attackGridHtml += `<div onclick="${canAttack ? `activeGameEngine.attack(${r},${c})` : ''}" style="width:${cellSize}px;height:${cellSize}px;background:${bg};border:1px solid #BAE6FD;display:inline-flex;align-items:center;justify-content:center;cursor:${canAttack ? 'pointer' : 'default'};transition:background 0.15s;">${content}</div>`;
      }
      attackGridHtml += '<br>';
    }
    attackGridHtml += '</div>';

    // My grid (defense view)
    let myGridHtml = `<div style="display:inline-block;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const isShip = this.myGrid[r][c] === 'S';
        const isHit = this.myGrid[r][c] === 'H';
        const isMiss = this.myGrid[r][c] === 'M';
        let bg = isShip ? '#0369A1' : '#E0F2FE';
        let content = '';
        if (isHit) { bg = '#FCA5A5'; content = '<div style="color:#EF4444;font-weight:900;font-size:0.9rem;">X</div>'; }
        if (isMiss) { bg = '#CBD5E1'; content = '<div style="width:6px;height:6px;border-radius:50%;background:#94A3B8;"></div>'; }
        if (isShip && !isHit) { content = '<div style="width:60%;height:60%;border-radius:3px;background:#0EA5E9;"></div>'; }

        myGridHtml += `<div style="width:${cellSize}px;height:${cellSize}px;background:${bg};border:1px solid #BAE6FD;display:inline-flex;align-items:center;justify-content:center;">${content}</div>`;
      }
      myGridHtml += '<br>';
    }
    myGridHtml += '</div>';

    this.container.innerHTML = `
      <div style="text-align:center;">
        <div style="display:flex;justify-content:center;gap:8px;margin-bottom:10px;">
          <button onclick="activeGameEngine.viewingMyBoard=false;activeGameEngine.render();" style="padding:6px 16px;border-radius:8px;border:2px solid ${!this.viewingMyBoard ? '#0369A1' : '#E2E8F0'};background:${!this.viewingMyBoard ? '#E0F2FE' : 'white'};font-size:0.8rem;font-weight:600;cursor:pointer;color:${!this.viewingMyBoard ? '#0369A1' : 'var(--text-muted)'};">Attack</button>
          <button onclick="activeGameEngine.viewingMyBoard=true;activeGameEngine.render();" style="padding:6px 16px;border-radius:8px;border:2px solid ${this.viewingMyBoard ? '#0369A1' : '#E2E8F0'};background:${this.viewingMyBoard ? '#E0F2FE' : 'white'};font-size:0.8rem;font-weight:600;cursor:pointer;color:${this.viewingMyBoard ? '#0369A1' : 'var(--text-muted)'};">My Fleet</button>
        </div>
        ${this.viewingMyBoard ? myGridHtml : attackGridHtml}
        <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">${this.viewingMyBoard ? 'Your fleet' : (isMyTurn ? 'Tap to fire!' : 'Waiting for opponent...')}</div>
      </div>
    `;
  }

  async attack(r, c) {
    if (this.match.current_turn !== this.myId) return;
    if (this.attackGrid[r][c]) return;

    // Check opponent's grid from saved state
    const oppKey = this.isChallenger ? 'opponent' : 'challenger';
    const state = this.match.game_state || {};
    const oppGrid = state.board && state.board[oppKey + 'Grid'];

    if (!oppGrid) {
      showGameToast('Opponent hasn\'t placed ships yet');
      return;
    }

    const isHit = oppGrid[r][c] === 'S' || oppGrid[r][c] === 'H';
    this.attackGrid[r][c] = isHit ? 'hit' : 'miss';

    // Update opponent's grid to mark hit
    if (isHit) {
      oppGrid[r][c] = 'H';
    } else {
      oppGrid[r][c] = 'M';
    }

    // Save updated state
    const playerKey = this.isChallenger ? 'challenger' : 'opponent';
    state.board[playerKey + 'Attacks'] = this.attackGrid;
    state.board[oppKey + 'Grid'] = oppGrid;

    const opponentId = this.match.challenger_id === this.myId ? this.match.opponent_id : this.match.challenger_id;
    const nextTurn = opponentId;

    // Check if all opponent ships sunk
    let oppShipCells = 0;
    for (let rr = 0; rr < this.gridSize; rr++) {
      for (let cc = 0; cc < this.gridSize; cc++) {
        if (oppGrid[rr][cc] === 'S') oppShipCells++; // Unhit ship cells remaining
      }
    }

    let result = null;
    if (oppShipCells === 0) {
      result = { winner: 'me' };
    }

    this.match.move_count = (this.match.move_count || 0) + 1;
    this.match.current_turn = nextTurn;
    this.match.game_state = state;

    this.render();
    showGameToast(isHit ? 'Hit!' : 'Miss!');

    // LOCAL AI GAME - skip DB, trigger AI move
    if (this.match.is_local) {
      activeGameMatch = this.match;
      if (result) {
        showLocalGameResult(result);
      } else {
        updateTurnIndicator(false, this.match);
        scheduleAIMove();
      }
      return;
    }

    try {
      await db.games.recordMove(this.match.id, this.myId, this.match.move_count, { row: r, col: c, result: isHit ? 'hit' : 'miss' });
      const updatedMatch = await db.games.updateGameState(this.match.id, state, nextTurn, this.match.move_count);
      activeGameMatch = updatedMatch;

      if (result) {
        const winnerId = result.winner === 'me' ? this.myId : opponentId;
        await db.games.completeGame(this.match.id, winnerId, false);
      }
    } catch (e) {
      console.error('Failed to record attack:', e);
    }
  }

  updateFromState(state, currentTurn) {
    if (state && state.board) {
      const playerKey = this.isChallenger ? 'challenger' : 'opponent';
      if (state.board[playerKey + 'Grid']) this.myGrid = state.board[playerKey + 'Grid'];
      if (state.board[playerKey + 'Attacks']) this.attackGrid = state.board[playerKey + 'Attacks'];
      if (state.board[playerKey + 'Ships']) this.myShips = state.board[playerKey + 'Ships'];
    }
    this.match.current_turn = currentTurn;
    this.match.game_state = state;
    if (this.placementDone) this.phase = 'battle';
    this.render();
  }
}

// ============================================================
// AI OPPONENT - LOCAL GAME FLOW
// ============================================================

async function startGameVsAI(difficulty) {
  if (!selectedGameType) {
    showGameToast('Pick a game first!');
    return;
  }

  // Close challenge modal
  const modal = document.getElementById('game-challenge-modal');
  if (modal) modal.remove();

  const gameType = selectedGameType;
  const config = GAME_CONFIG[gameType] || {};
  const diffConfig = (window.GameAI && window.GameAI.DIFFICULTY[difficulty]) || { label: difficulty, icon: '🤖', color: '#7c3aed' };

  showGameToast(`${config.icon} Starting ${config.name} vs ${diffConfig.icon} ${diffConfig.label} Bot`);

  // Create local match (no DB)
  const myId = window.currentUser?.id || 'player';
  const aiId = 'ai-bot';
  const match = {
    id: 'local-' + Date.now(),
    game_type: gameType,
    challenger_id: myId,
    opponent_id: aiId,
    current_turn: myId,
    coin_bet: 0,
    status: 'active',
    game_state: null,
    move_count: 0,
    is_local: true,
    ai_difficulty: difficulty
  };

  // For battleships, pre-place AI ships
  if (gameType === 'battleships' && window.GameAI) {
    const aiPlacement = window.GameAI.Battleships.placeShips(8);
    match.game_state = {
      board: {
        opponentShips: aiPlacement.ships,
        opponentGrid: aiPlacement.grid,
        opponentAttacks: Array(8).fill(null).map(() => Array(8).fill(null))
      }
    };
  }

  activeGameMatch = match;

  // Open the game board UI (reuse existing openGameBoard UI but skip DB)
  openLocalGameBoard(match, myId, difficulty);
}

function openLocalGameBoard(match, myId, difficulty) {
  const config = GAME_CONFIG[match.game_type] || {};
  const diffConfig = (window.GameAI && window.GameAI.DIFFICULTY[difficulty]) || { label: difficulty };
  const opponentName = `${diffConfig.icon || '🤖'} ${diffConfig.label || 'Bot'}`;

  const gameView = document.createElement('div');
  gameView.id = 'game-board-overlay';
  gameView.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:10001;display:flex;flex-direction:column;animation:fadeIn 0.2s ease;';

  const myName = window.currentUser?.user_metadata?.name || window.currentUser?.email?.split('@')[0] || 'You';

  gameView.innerHTML = `
    <!-- Game Header -->
    <div style="padding:12px 16px;background:white;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
      <button onclick="closeGameBoard()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;padding:4px 8px;color:var(--text-muted);">
        <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      </button>
      <div style="text-align:center;">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">${config.name} vs AI</div>
        <div style="font-size:0.7rem;color:${diffConfig.color || '#7c3aed'};font-weight:600;">${opponentName}</div>
      </div>
      <div style="width:60px;"></div>
    </div>

    <!-- Turn Indicator -->
    <div id="game-turn-indicator" style="padding:8px 16px;text-align:center;font-size:0.85rem;font-weight:700;color:#10B981;background:#ECFDF5;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px;animation:pulse 1.5s infinite;"></span>Your Turn
    </div>

    <!-- Player Names -->
    <div style="display:flex;justify-content:space-between;padding:8px 16px;background:white;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#1E293B;"></div>
        <span style="font-size:0.8rem;font-weight:600;color:var(--text-main);">${myName} (You)</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.8rem;font-weight:600;color:var(--text-main);">${opponentName}</span>
        <div style="width:8px;height:8px;border-radius:50%;background:#EF4444;"></div>
      </div>
    </div>

    <!-- Game Board Container -->
    <div id="game-board-container" style="flex:1;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;">
      <div id="game-board-inner" style="width:100%;max-width:400px;"></div>
    </div>

    <!-- Game Status Bar -->
    <div id="game-status-bar" style="padding:12px 16px;background:white;border-top:1px solid #f1f5f9;text-align:center;font-size:0.85rem;color:var(--text-muted);"></div>
  `;

  document.body.appendChild(gameView);

  // Hide bottom nav
  const nav = document.querySelector('.bottom-nav');
  if (nav) nav.style.display = 'none';

  // Initialize game engine (player is always challenger)
  initGameEngine(match, myId, 'ai-bot', true);
}

// Called after player makes a move in a local AI game
function scheduleAIMove() {
  if (!activeGameMatch || !activeGameMatch.is_local) return;
  if (activeGameMatch.status !== 'active') return;
  if (activeGameMatch.current_turn !== 'ai-bot') return;

  const difficulty = activeGameMatch.ai_difficulty || 'medium';
  const thinkDelay = difficulty === 'easy' ? 1200 : difficulty === 'medium' ? 800 : 400;

  // Show thinking indicator
  updateTurnIndicator(false, activeGameMatch);
  const statusBar = document.getElementById('game-status-bar');
  if (statusBar) statusBar.innerHTML = '🤖 Bot is thinking...';

  aiMoveTimeout = setTimeout(() => {
    if (!activeGameMatch || !activeGameMatch.is_local) return;
    executeAIMove(difficulty);
  }, thinkDelay);
}

function executeAIMove(difficulty) {
  if (!activeGameEngine || !activeGameMatch) return;
  const match = activeGameMatch;
  const gameType = match.game_type;
  const AI = window.GameAI;
  if (!AI) return;

  switch (gameType) {
    case 'tic_tac_toe': {
      const engine = activeGameEngine;
      const aiSymbol = engine.opponentSymbol;
      const moveIdx = AI.TicTacToe.getMove([...engine.board], aiSymbol, difficulty);
      if (moveIdx === -1 || moveIdx === undefined) return;
      // Apply AI move
      engine.board[moveIdx] = aiSymbol;
      const result = engine.checkWin();
      match.move_count = (match.move_count || 0) + 1;
      match.current_turn = match.challenger_id;
      engine.match.current_turn = match.challenger_id;
      engine.render();
      if (result) { showLocalGameResult(result); return; }
      updateTurnIndicator(true, match);
      break;
    }
    case 'connect4': {
      const engine = activeGameEngine;
      const aiColor = engine.opponentColor;
      const col = AI.Connect4.getMove(engine.board.map(r => [...r]), aiColor, difficulty, engine.rows, engine.cols);
      if (col === -1 || col === undefined) return;
      let row = -1;
      for (let r = engine.rows - 1; r >= 0; r--) {
        if (engine.board[r][col] === null) { row = r; break; }
      }
      if (row === -1) return;
      engine.board[row][col] = aiColor;
      const result = engine.checkWin(row, col);
      match.move_count = (match.move_count || 0) + 1;
      match.current_turn = match.challenger_id;
      engine.match.current_turn = match.challenger_id;
      engine.render();
      if (result) { showLocalGameResult(result); return; }
      updateTurnIndicator(true, match);
      break;
    }
    case 'checkers': {
      const engine = activeGameEngine;
      const aiPiece = engine.opponentPiece;
      const move = AI.Checkers.getMove(engine.board.map(r => [...r]), aiPiece, difficulty);
      if (!move) { showLocalGameResult({ winner: 'me' }); return; }
      // Apply move
      const piece = engine.board[move.from[0]][move.from[1]];
      engine.board[move.from[0]][move.from[1]] = null;
      engine.board[move.to[0]][move.to[1]] = piece;
      for (const [cr, cc] of move.captures) engine.board[cr][cc] = null;
      // King promotion
      if (piece === 'D' && move.to[0] === 0) engine.board[move.to[0]][move.to[1]] = 'DK';
      if (piece === 'L' && move.to[0] === 7) engine.board[move.to[0]][move.to[1]] = 'LK';
      const result = engine.checkWin();
      match.move_count = (match.move_count || 0) + 1;
      match.current_turn = match.challenger_id;
      engine.match.current_turn = match.challenger_id;
      engine.selectedPiece = null;
      engine.validMoves = [];
      engine.render();
      if (result) { showLocalGameResult(result); return; }
      updateTurnIndicator(true, match);
      break;
    }
    case 'chess': {
      const engine = activeGameEngine;
      const aiColor = engine.opponentColor;
      const move = AI.Chess.getMove(engine.board.map(r => [...r]), aiColor, difficulty);
      if (!move) { showLocalGameResult({ winner: 'me' }); return; }
      const captured = engine.board[move.to[0]][move.to[1]];
      engine.board[move.from[0]][move.from[1]] = null;
      engine.board[move.to[0]][move.to[1]] = move.piece;
      // Pawn promotion
      if (move.piece[1] === 'p' && (move.to[0] === 0 || move.to[0] === 7)) {
        engine.board[move.to[0]][move.to[1]] = move.piece[0] + 'q';
      }
      let result = null;
      if (captured && captured[1] === 'k') result = { winner: 'opponent' };
      match.move_count = (match.move_count || 0) + 1;
      match.current_turn = match.challenger_id;
      engine.match.current_turn = match.challenger_id;
      engine.selectedPiece = null;
      engine.validMoves = [];
      engine.render();
      if (result) { showLocalGameResult(result); return; }
      updateTurnIndicator(true, match);
      break;
    }
    case 'reversi': {
      const engine = activeGameEngine;
      const aiColor = engine.opponentColor;
      const moveCoord = AI.Reversi.getMove(engine.board.map(r => [...r]), aiColor, difficulty);
      if (!moveCoord) {
        // AI can't move, skip turn back to player
        match.current_turn = match.challenger_id;
        engine.match.current_turn = match.challenger_id;
        // Check if player also has no moves
        const playerMoves = engine.getAllValidMoves(engine.myColor);
        if (playerMoves.length === 0) {
          // Game over
          let bCount = 0, wCount = 0;
          for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            if (engine.board[r][c] === 'B') bCount++;
            if (engine.board[r][c] === 'W') wCount++;
          }
          const myCount = engine.myColor === 'B' ? bCount : wCount;
          const oppCount = engine.myColor === 'B' ? wCount : bCount;
          let result;
          if (myCount > oppCount) result = { winner: 'me' };
          else if (oppCount > myCount) result = { winner: 'opponent' };
          else result = { draw: true };
          showLocalGameResult(result);
          return;
        }
        engine.render();
        updateTurnIndicator(true, match);
        return;
      }
      const [r, c] = moveCoord;
      const flips = engine.getFlips(r, c, aiColor);
      engine.board[r][c] = aiColor;
      for (const [fr, fc] of flips) engine.board[fr][fc] = aiColor;

      // Check if player has moves
      const playerMoves = engine.getAllValidMoves(engine.myColor);
      if (playerMoves.length === 0) {
        // Check if AI has more moves
        const aiMoves2 = AI.Reversi._getAllValidMoves(engine.board, aiColor);
        if (aiMoves2.length === 0) {
          // Game over
          let bCount = 0, wCount = 0;
          for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
            if (engine.board[rr][cc] === 'B') bCount++;
            if (engine.board[rr][cc] === 'W') wCount++;
          }
          const myCount = engine.myColor === 'B' ? bCount : wCount;
          const oppCount = engine.myColor === 'B' ? wCount : bCount;
          let result;
          if (myCount > oppCount) result = { winner: 'me' };
          else if (oppCount > myCount) result = { winner: 'opponent' };
          else result = { draw: true };
          showLocalGameResult(result);
          return;
        }
        // AI plays again
        match.move_count = (match.move_count || 0) + 1;
        match.current_turn = 'ai-bot';
        engine.match.current_turn = 'ai-bot';
        engine.render();
        scheduleAIMove();
        return;
      }

      match.move_count = (match.move_count || 0) + 1;
      match.current_turn = match.challenger_id;
      engine.match.current_turn = match.challenger_id;
      engine.render();
      updateTurnIndicator(true, match);
      break;
    }
    case 'battleships': {
      const engine = activeGameEngine;
      // AI attacks player's grid
      const playerKey = 'challenger';
      const state = match.game_state || {};
      const playerGrid = state.board && state.board[playerKey + 'Grid'];
      if (!playerGrid) return;

      // Build AI's attack grid from state
      const aiAttacks = (state.board && state.board.opponentAttacks) || Array(8).fill(null).map(() => Array(8).fill(null));

      const target = AI.Battleships.getAttack(aiAttacks, engine.gridSize, difficulty);
      if (!target) return;
      const [r, c] = target;

      const isHit = playerGrid[r][c] === 'S' || playerGrid[r][c] === 'H';
      aiAttacks[r][c] = isHit ? 'hit' : 'miss';
      if (isHit) playerGrid[r][c] = 'H';
      else playerGrid[r][c] = 'M';

      // Update engine's local grid view
      engine.myGrid = playerGrid;
      state.board.opponentAttacks = aiAttacks;
      state.board[playerKey + 'Grid'] = playerGrid;

      // Check if all player ships sunk
      let playerShipCells = 0;
      for (let rr = 0; rr < engine.gridSize; rr++) {
        for (let cc = 0; cc < engine.gridSize; cc++) {
          if (playerGrid[rr][cc] === 'S') playerShipCells++;
        }
      }
      if (playerShipCells === 0) {
        showLocalGameResult({ winner: 'opponent' });
        return;
      }

      match.move_count = (match.move_count || 0) + 1;
      match.current_turn = match.challenger_id;
      engine.match.current_turn = match.challenger_id;
      match.game_state = state;
      engine.render();
      showGameToast(isHit ? 'Bot hit your ship!' : 'Bot missed!');
      updateTurnIndicator(true, match);
      break;
    }
  }
}

function showLocalGameResult(result) {
  if (!activeGameMatch) return;
  const config = GAME_CONFIG[activeGameMatch.game_type] || {};
  const difficulty = activeGameMatch.ai_difficulty || 'medium';
  const diffConfig = (window.GameAI && window.GameAI.DIFFICULTY[difficulty]) || {};

  const isWinner = result.winner === 'me';
  const isDraw = result.draw;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease;';

  let title, subtitle, bgGradient, icon;
  if (isDraw) {
    title = 'Draw!';
    subtitle = 'Well played!';
    bgGradient = 'linear-gradient(135deg, #6B7280, #9CA3AF)';
    icon = '🤝';
  } else if (isWinner) {
    title = 'You Won!';
    subtitle = `You beat the ${diffConfig.label || 'Bot'}!`;
    bgGradient = 'linear-gradient(135deg, #F59E0B, #FBBF24)';
    icon = '🏆';
  } else {
    title = 'You Lost';
    subtitle = `The ${diffConfig.label || 'Bot'} got you this time!`;
    bgGradient = 'linear-gradient(135deg, #6B7280, #9CA3AF)';
    icon = '😤';
  }

  overlay.innerHTML = `
    <div style="background:white;border-radius:24px;width:90%;max-width:340px;overflow:hidden;animation:slideUp 0.4s ease;text-align:center;">
      <div style="height:100px;background:${bgGradient};display:flex;align-items:center;justify-content:center;">
        <span style="font-size:4rem;">${icon}</span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 8px;font-family:'Playfair Display';font-size:1.6rem;color:var(--text-main);">${title}</h2>
        <p style="margin:0 0 20px;color:var(--text-muted);font-size:0.95rem;">${subtitle}</p>
        <div style="display:flex;gap:10px;">
          <button onclick="this.closest('div[style*=fixed]').remove(); closeGameBoard(); setTimeout(() => openGameChallengeModal(), 300);" style="flex:1;padding:14px;border:2px solid #f1f5f9;border-radius:12px;background:white;font-size:0.9rem;font-weight:600;cursor:pointer;color:var(--text-muted);">Play Again</button>
          <button onclick="this.closest('div[style*=fixed]').remove(); closeGameBoard();" style="flex:1;padding:14px;border:none;border-radius:12px;background:${config.gradient || bgGradient};color:white;font-size:0.9rem;font-weight:700;cursor:pointer;">Done</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeGameMatch.status = 'completed';
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showGameToast(message) {
  const existing = document.getElementById('game-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'game-toast';
  toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#1E293B;color:white;padding:10px 20px;border-radius:12px;font-size:0.85rem;font-weight:600;z-index:10003;animation:slideDown 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2500);
}

// ============================================================
// EXPOSE GLOBALS
// ============================================================

window.openGameChallengeModal = openGameChallengeModal;
window.selectGameType = selectGameType;
window.selectGameFriend = selectGameFriend;
window.selectGameBet = selectGameBet;
window.sendGameChallenge = sendGameChallenge;
window.loadActiveGames = loadActiveGames;
window.handleGameInvite = handleGameInvite;
window.respondToInvite = respondToInvite;
window.openGameBoard = openGameBoard;
window.closeGameBoard = closeGameBoard;
window.confirmForfeit = confirmForfeit;
window.showGameToast = showGameToast;
window.startGameVsAI = startGameVsAI;
window.GAME_CONFIG = GAME_CONFIG;
