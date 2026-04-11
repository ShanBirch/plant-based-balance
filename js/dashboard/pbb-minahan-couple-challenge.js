/* ==========================================================================
   MINAHAN COUPLE CHALLENGE
   --------------------------------------------------------------------------
   A one-off tailored Team Volume Challenge for Dani Minahan & Shane Minahan
   vs. Coach Shan. Their combined lifting volume (kg) over 30 days must
   beat Coach Shan's solo volume. If they win — both get 2 weeks free.

   Flow:
     1. On app open, detect if currentUser is Dani/Shane Minahan or Coach Shan.
     2. If the Minahan hasn't seen the invite yet → show a big exciting modal
        with confetti, haptics, "Coach Shan invites you into a Team Volume
        Challenge" and Accept / Maybe Later buttons.
     3. Once accepted, pin a persistent scoreboard card to the top of the
        home feed: Team Minahan (combined kg) vs Coach Shan (solo kg), days
        remaining, live progress bar, prize callout.
     4. Coach Shan sees the same scoreboard card so he can track his rivals.

   Volume is read directly from the `workouts` table (weight_kg * reps for
   rows with workout_type='history') during the challenge window. No new DB
   schema required — uses what the regular volume challenge already uses.
   ========================================================================== */

(function () {
  'use strict';

  // ----- Config ----------------------------------------------------------
  const LS_KEY              = 'pbb_minahan_couple_challenge_v1';
  const COACH_EMAIL         = 'shannonbirch@cocospersonaltraining.com';
  const DURATION_DAYS       = 30;
  const CHALLENGE_NAME      = 'Team Minahan vs Coach Shan';
  const CHALLENGE_PRIZE     = '2 Weeks Free — For Both of You';
  const MINAHAN_NAME_MATCH  = /minahan/i;

  // ----- State helpers ---------------------------------------------------
  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveState(patch) {
    const current = loadState() || {};
    const next = Object.assign({}, current, patch);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch (e) {}
    return next;
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function addDaysISO(startISO, days) {
    const d = new Date(startISO + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(aISO, bISO) {
    const a = new Date(aISO + 'T00:00:00').getTime();
    const b = new Date(bISO + 'T00:00:00').getTime();
    return Math.round((b - a) / 86400000);
  }

  // ----- Identity detection ---------------------------------------------
  function getCurrentName() {
    const u = window.currentUser || {};
    return (u.user_metadata?.name || u.user_metadata?.full_name || u.name || '').trim();
  }

  function isMinahan() {
    const u = window.currentUser || {};
    const name = getCurrentName();
    const email = (u.email || '').toLowerCase();
    return MINAHAN_NAME_MATCH.test(name) || email.includes('minahan');
  }

  function isCoachShan() {
    const u = window.currentUser || {};
    return (u.email || '').toLowerCase() === COACH_EMAIL;
  }

  function isInChallengeCast() {
    return isMinahan() || isCoachShan();
  }

  // ----- Find the three user IDs ----------------------------------------
  // Uses friend search RPC to look up Dani, Shane and Coach Shan by name.
  // Results cached in localStorage so we only hit the network once.
  async function resolveCastIds() {
    const state = loadState() || {};
    if (state.cast && state.cast.dani_id && state.cast.shane_id && state.cast.coach_id) {
      return state.cast;
    }

    if (!window.db || !window.db.friends || !window.currentUser) return null;

    const cast = Object.assign({}, state.cast || {});

    // Coach Shan — easy if I'm him, otherwise search
    if (isCoachShan()) {
      cast.coach_id = window.currentUser.id;
    } else if (!cast.coach_id) {
      try {
        const results = await window.db.friends.searchUsers('Shannon', window.currentUser.id);
        const match = (results || []).find(r =>
          (r.user_email || '').toLowerCase() === COACH_EMAIL
        );
        if (match) cast.coach_id = match.user_id;
      } catch (e) { console.warn('[minahan] coach lookup failed', e); }
    }

    // Dani & Shane — search by surname
    try {
      const results = await window.db.friends.searchUsers('Minahan', window.currentUser.id);
      (results || []).forEach(r => {
        const n = (r.user_name || '').toLowerCase();
        if (n.includes('dani')) cast.dani_id = r.user_id;
        else if (n.includes('shane') || n.includes('shan')) cast.shane_id = r.user_id;
      });
    } catch (e) { console.warn('[minahan] minahan lookup failed', e); }

    // If I'm one of the Minahans, fill in my own slot from currentUser
    if (isMinahan()) {
      const myName = getCurrentName().toLowerCase();
      if (myName.includes('dani')) cast.dani_id = window.currentUser.id;
      else if (myName.includes('shane') || myName.includes('shan')) cast.shane_id = window.currentUser.id;
    }

    saveState({ cast });
    return cast;
  }

  // ----- Volume fetch ----------------------------------------------------
  async function fetchVolumeFor(userId, startISO, endISO) {
    if (!userId || !window.supabaseClient) return 0;
    try {
      const { data, error } = await window.supabaseClient
        .from('workouts')
        .select('weight_kg, reps')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .gte('workout_date', startISO)
        .lte('workout_date', endISO);
      if (error) throw error;
      let total = 0;
      (data || []).forEach(row => {
        const w = parseFloat(row.weight_kg);
        const r = parseInt(row.reps, 10);
        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) total += w * r;
      });
      return Math.round(total);
    } catch (e) {
      console.warn('[minahan] volume fetch failed for', userId, e);
      return 0;
    }
  }

  async function fetchScoreboard() {
    const state = loadState() || {};
    if (!state.accepted || !state.start_date || !state.end_date) return null;
    const cast = await resolveCastIds();
    if (!cast) return null;

    const [daniVol, shaneVol, coachVol] = await Promise.all([
      fetchVolumeFor(cast.dani_id,  state.start_date, state.end_date),
      fetchVolumeFor(cast.shane_id, state.start_date, state.end_date),
      fetchVolumeFor(cast.coach_id, state.start_date, state.end_date)
    ]);

    return {
      dani: daniVol,
      shane: shaneVol,
      team: daniVol + shaneVol,
      coach: coachVol,
      start_date: state.start_date,
      end_date: state.end_date
    };
  }

  // ----- Confetti / sparkles (lightweight, self-contained) --------------
  function fireConfetti(count) {
    const colors = ['#f59e0b','#ef4444','#22d3ee','#a855f7','#10b981','#fbbf24','#ec4899'];
    for (let i = 0; i < count; i++) {
      (function (delay) {
        setTimeout(function () {
          const el = document.createElement('div');
          el.style.cssText = 'position:fixed;top:-12px;width:10px;height:10px;pointer-events:none;z-index:100050;border-radius:2px;';
          el.style.left = (Math.random() * 100) + 'vw';
          el.style.background = colors[Math.floor(Math.random() * colors.length)];
          el.style.transition = 'transform 2.8s linear, opacity 2.8s linear';
          document.body.appendChild(el);
          requestAnimationFrame(function () {
            el.style.transform = 'translateY(110vh) rotate(' + (Math.random() * 720) + 'deg)';
            el.style.opacity = '0';
          });
          setTimeout(function () { try { el.remove(); } catch (e) {} }, 3200);
        }, delay);
      })(Math.random() * 700);
    }
  }

  function haptic() {
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 200, 60, 180]); } catch (e) {}
  }

  // ----- Invitation modal ------------------------------------------------
  function buildInviteModal() {
    if (document.getElementById('minahan-invite-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'minahan-invite-modal';
    modal.style.cssText = [
      'position:fixed','inset:0','z-index:100040','display:none',
      'align-items:center','justify-content:center',
      'background:rgba(0,0,0,0.88)','backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)','padding:20px',
      'opacity:0','transition:opacity 0.4s ease'
    ].join(';') + ';';

    modal.innerHTML = [
      '<div id="minahan-invite-card" style="',
        'max-width:420px;width:100%;border-radius:28px;overflow:hidden;',
        'background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 45%,#4c1d95 100%);',
        'box-shadow:0 30px 80px rgba(124,58,237,0.5),0 0 0 1px rgba(251,146,60,0.4) inset;',
        'transform:scale(0.7);opacity:0;',
        'transition:transform 0.55s cubic-bezier(.175,.885,.32,1.275),opacity 0.4s ease;',
      '">',
        // Glowing header band
        '<div style="position:relative;padding:28px 24px 18px;text-align:center;background:linear-gradient(135deg,#fb923c 0%,#f59e0b 50%,#ef4444 100%);overflow:hidden;">',
          '<div style="position:absolute;inset:-40%;background:radial-gradient(circle,rgba(255,255,255,0.35),transparent 60%);animation:mhnPulse 2.4s ease-in-out infinite;"></div>',
          '<div style="position:relative;">',
            '<div style="display:inline-block;padding:5px 14px;border-radius:99px;background:rgba(0,0,0,0.35);color:#fff;font-size:0.65rem;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Exclusive Invite</div>',
            '<div style="font-size:3.4rem;line-height:1;margin-bottom:6px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));">🏋️‍♀️🏋️</div>',
            '<div style="color:#fff;font-weight:900;font-size:1.35rem;line-height:1.2;text-shadow:0 2px 8px rgba(0,0,0,0.35);">TEAM VOLUME CHALLENGE</div>',
          '</div>',
        '</div>',
        // Body
        '<div style="padding:22px 24px 6px;color:#fff;text-align:center;">',
          '<div id="minahan-invite-hello" style="font-size:1.05rem;font-weight:700;color:#fbbf24;margin-bottom:6px;">Hey Team Minahan!</div>',
          '<div style="font-size:1.15rem;font-weight:800;line-height:1.35;margin-bottom:14px;">Coach Shan invites you into a <span style="color:#fb923c;">Team Volume Challenge</span></div>',
          '<div style="font-size:0.88rem;line-height:1.5;color:rgba(255,255,255,0.82);margin-bottom:18px;">',
            'You and your partner team up. Every kg you both lift over the next <strong style="color:#fbbf24;">30 days</strong> adds together as one combined score — Team Minahan vs Coach Shan, head-to-head.',
          '</div>',

          // Prize callout
          '<div style="border-radius:16px;padding:14px 14px 12px;background:linear-gradient(135deg,rgba(251,191,36,0.18),rgba(251,146,60,0.18));border:1px solid rgba(251,191,36,0.5);margin-bottom:16px;">',
            '<div style="font-size:0.62rem;font-weight:800;letter-spacing:1.4px;color:#fbbf24;text-transform:uppercase;margin-bottom:4px;">🏆 If You Win</div>',
            '<div style="font-size:1rem;font-weight:800;color:#fff;line-height:1.3;">2 Weeks Free — both of you</div>',
            '<div style="font-size:0.72rem;color:rgba(255,255,255,0.7);margin-top:2px;">Beat Coach Shan\'s total volume over 30 days</div>',
          '</div>',

          // Rules strip
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px;">',
            '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 4px;">',
              '<div style="font-size:1.25rem;margin-bottom:2px;">⏱️</div>',
              '<div style="font-size:0.62rem;font-weight:800;color:#fbbf24;letter-spacing:0.5px;">30 DAYS</div>',
            '</div>',
            '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 4px;">',
              '<div style="font-size:1.25rem;margin-bottom:2px;">💪</div>',
              '<div style="font-size:0.62rem;font-weight:800;color:#fbbf24;letter-spacing:0.5px;">COMBINED KG</div>',
            '</div>',
            '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 4px;">',
              '<div style="font-size:1.25rem;margin-bottom:2px;">🤝</div>',
              '<div style="font-size:0.62rem;font-weight:800;color:#fbbf24;letter-spacing:0.5px;">1 TEAM</div>',
            '</div>',
          '</div>',

          // Coach quote
          '<div style="font-size:0.8rem;font-style:italic;color:rgba(255,255,255,0.75);border-left:3px solid #fb923c;padding:6px 12px;text-align:left;margin:0 6px 18px;">',
            '"I\'m going all in on my volume the next 30 days. You two together should be able to take me down — prove it." — Coach Shan',
          '</div>',
        '</div>',
        // CTA buttons
        '<div style="padding:0 20px 22px;">',
          '<button id="minahan-invite-accept" style="',
            'width:100%;padding:16px;border:none;border-radius:16px;cursor:pointer;',
            'background:linear-gradient(135deg,#fb923c,#ef4444);color:#fff;',
            'font-weight:900;font-size:1rem;letter-spacing:0.5px;',
            'box-shadow:0 12px 30px rgba(239,68,68,0.45);',
            'transition:transform 0.15s ease;',
          '">🔥 ACCEPT THE CHALLENGE</button>',
          '<button id="minahan-invite-later" style="',
            'display:block;margin:12px auto 0;background:none;border:none;',
            'color:rgba(255,255,255,0.5);font-size:0.78rem;font-weight:600;',
            'cursor:pointer;padding:6px 14px;',
          '">Maybe later</button>',
        '</div>',
      '</div>',
      // Inline animations
      '<style>',
        '@keyframes mhnPulse { 0%,100% { transform:scale(1); opacity:0.55; } 50% { transform:scale(1.1); opacity:0.85; } }',
        '#minahan-invite-accept:active { transform:scale(0.97); }',
      '</style>'
    ].join('');

    document.body.appendChild(modal);

    // Swallow accept/later clicks so they can't ghost-click through to the
    // home "Start a Challenge" card underneath when the modal hides.
    const acceptBtn = modal.querySelector('#minahan-invite-accept');
    const laterBtn  = modal.querySelector('#minahan-invite-later');
    const swallow = function (fn) {
      return function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        fn();
      };
    };
    acceptBtn.addEventListener('click',      swallow(acceptChallenge), true);
    acceptBtn.addEventListener('touchend',   swallow(acceptChallenge), true);
    laterBtn.addEventListener('click',       swallow(closeInviteModal), true);
    laterBtn.addEventListener('touchend',    swallow(closeInviteModal), true);
    // Also block any stray clicks landing on the backdrop itself during
    // the fade-out window.
    modal.addEventListener('click', function (e) {
      if (e.target === modal) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // Personalize greeting
    const nm = getCurrentName();
    const firstName = nm ? nm.split(/\s+/)[0] : '';
    const helloEl = modal.querySelector('#minahan-invite-hello');
    if (helloEl) {
      if (isMinahan() && firstName) helloEl.textContent = 'Hey ' + firstName + '!';
      else if (isCoachShan()) helloEl.textContent = 'Coach Shan — preview your invite';
    }
  }

  function openInviteModal() {
    buildInviteModal();
    const modal = document.getElementById('minahan-invite-modal');
    if (!modal) return;
    const card = modal.querySelector('#minahan-invite-card');
    modal.style.display = 'flex';
    // Force reflow so the initial opacity:0 / scale(0.7) paints before we
    // transition to the visible state. Without this the browser batches
    // both states and the transition never runs.
    void modal.offsetWidth;
    // Toggle visibility by writing the inline styles directly — this
    // dodges any specificity fight between class selectors and the inline
    // styles we set at build time.
    modal.style.opacity = '1';
    if (card) {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    }
    haptic();
    setTimeout(function () { fireConfetti(55); }, 200);

    if (typeof pushNavigationState === 'function') {
      try { pushNavigationState('minahan-invite', closeInviteModal); } catch (e) {}
    }
  }

  // Guard so ghost-clicks landing on whatever's behind the modal shortly
  // after we close it get eaten instead of opening the Start a Challenge
  // picker on iOS.
  function installGhostClickGuard(durationMs) {
    const guard = document.createElement('div');
    guard.id = 'minahan-ghost-guard';
    guard.style.cssText = [
      'position:fixed','inset:0','z-index:100041',
      'background:transparent','pointer-events:auto'
    ].join(';') + ';';
    const stop = function (e) { e.preventDefault(); e.stopPropagation(); };
    guard.addEventListener('click',      stop, true);
    guard.addEventListener('touchstart', stop, true);
    guard.addEventListener('touchend',   stop, true);
    document.body.appendChild(guard);
    setTimeout(function () {
      try { guard.remove(); } catch (e) {}
    }, durationMs);
  }

  function closeInviteModal() {
    const modal = document.getElementById('minahan-invite-modal');
    if (!modal) return;
    const card = modal.querySelector('#minahan-invite-card');
    // Start the fade-out
    modal.style.opacity = '0';
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.7)';
    }
    // Install a transparent shield over the whole page for ~500ms so any
    // synthesized click fired after our tap doesn't hit the home "Start a
    // Challenge" card underneath.
    installGhostClickGuard(500);
    // Fully remove the modal from the DOM once the fade is done — not
    // just display:none, so it can't intercept or leak events later.
    setTimeout(function () {
      try { modal.remove(); } catch (e) {}
    }, 400);
    saveState({ invite_dismissed_at: Date.now() });
  }

  function acceptChallenge() {
    const existing = loadState() || {};
    const start = existing.start_date || todayISO();
    const end   = existing.end_date   || addDaysISO(start, DURATION_DAYS);
    saveState({
      accepted: true,
      accepted_at: Date.now(),
      start_date: start,
      end_date: end
    });
    closeInviteModal();
    // Big celebration
    fireConfetti(120);
    haptic();
    // Make sure the observer is live (it will also auto re-inject on
    // subsequent re-renders) and paint the card now.
    installListObserver();
    renderHomeCard(true);
  }

  // ----- Home scoreboard card -------------------------------------------
  function formatKg(n) {
    if (!n) return '0 kg';
    if (n >= 1000) return (n / 1000).toFixed(1) + 't';
    return Math.round(n).toLocaleString() + ' kg';
  }

  function buildScoreboardHTML(scores, state) {
    const team = scores ? scores.team : 0;
    const coach = scores ? scores.coach : 0;
    const teamLeads = team > coach;
    const diff = Math.abs(team - coach);
    const maxVal = Math.max(team, coach, 1);
    const teamPct = Math.max(4, Math.round((team / maxVal) * 100));
    const coachPct = Math.max(4, Math.round((coach / maxVal) * 100));

    const today = todayISO();
    const total = daysBetween(state.start_date, state.end_date);
    const elapsed = Math.max(0, Math.min(total, daysBetween(state.start_date, today)));
    const remaining = Math.max(0, total - elapsed);
    const finished = remaining === 0;

    const statusBadge = finished
      ? (teamLeads
          ? '<span style="background:#10b981;color:#fff;padding:3px 10px;border-radius:999px;font-size:0.6rem;font-weight:800;letter-spacing:1px;">🎉 YOU WON — 2 WEEKS FREE</span>'
          : '<span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:999px;font-size:0.6rem;font-weight:800;letter-spacing:1px;">FINISHED</span>')
      : '<span style="background:rgba(0,0,0,0.35);color:#fbbf24;padding:3px 10px;border-radius:999px;font-size:0.6rem;font-weight:800;letter-spacing:1px;">⏱ ' + remaining + 'd LEFT</span>';

    const leadingCopy = scores
      ? (teamLeads
          ? 'Team Minahan leading by ' + formatKg(diff) + ' 🔥'
          : (team === coach
              ? 'Dead even — every set counts'
              : 'Coach Shan ahead by ' + formatKg(diff)))
      : 'Loading your team volume...';

    const daniVol = scores ? scores.dani : 0;
    const shaneVol = scores ? scores.shane : 0;

    return [
      '<div id="minahan-home-card" style="',
        'margin-bottom:12px;margin-top:12px;border-radius:22px;overflow:hidden;',
        'box-shadow:0 8px 32px rgba(239,68,68,0.35),0 0 0 1px rgba(251,191,36,0.3) inset;',
        'background:linear-gradient(135deg,#0f172a 0%,#4c1d95 50%,#9a1c1c 100%);position:relative;',
      '">',
        // Top ribbon
        '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,rgba(251,146,60,0.25),rgba(239,68,68,0.25));">',
          '<div style="display:flex;align-items:center;gap:10px;">',
            '<div style="width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🏋️</div>',
            '<div>',
              '<div style="font-size:0.58rem;font-weight:800;letter-spacing:1.4px;color:#fbbf24;text-transform:uppercase;">Tailored Challenge</div>',
              '<div style="font-size:0.95rem;font-weight:800;color:#fff;line-height:1.2;">' + CHALLENGE_NAME + '</div>',
            '</div>',
          '</div>',
          statusBadge,
        '</div>',

        // Scoreboard
        '<div style="padding:14px 18px 6px;">',
          // Team Minahan row
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">',
            '<div style="font-size:0.78rem;font-weight:800;color:#fff;">👥 Team Minahan</div>',
            '<div style="font-size:1rem;font-weight:900;color:' + (teamLeads ? '#22d3ee' : '#fff') + ';">' + formatKg(team) + '</div>',
          '</div>',
          '<div style="height:10px;border-radius:99px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:3px;">',
            '<div style="height:100%;width:' + teamPct + '%;border-radius:99px;background:linear-gradient(90deg,#22d3ee,#3b82f6);transition:width 0.6s ease;"></div>',
          '</div>',
          '<div style="font-size:0.62rem;color:rgba(255,255,255,0.55);margin-bottom:10px;">Dani ' + formatKg(daniVol) + ' · Shane ' + formatKg(shaneVol) + '</div>',

          // Coach Shan row
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">',
            '<div style="font-size:0.78rem;font-weight:800;color:#fff;">🎯 Coach Shan</div>',
            '<div style="font-size:1rem;font-weight:900;color:' + (!teamLeads && team !== coach ? '#fbbf24' : '#fff') + ';">' + formatKg(coach) + '</div>',
          '</div>',
          '<div style="height:10px;border-radius:99px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:6px;">',
            '<div style="height:100%;width:' + coachPct + '%;border-radius:99px;background:linear-gradient(90deg,#fb923c,#ef4444);transition:width 0.6s ease;"></div>',
          '</div>',

          '<div style="font-size:0.75rem;color:rgba(255,255,255,0.75);text-align:center;font-weight:700;margin:10px 0 4px;">' + leadingCopy + '</div>',
        '</div>',

        // Prize footer
        '<div style="padding:10px 18px 14px;display:flex;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,0.08);">',
          '<div style="font-size:1.1rem;">🏆</div>',
          '<div style="flex:1;min-width:0;">',
            '<div style="font-size:0.6rem;font-weight:800;letter-spacing:1px;color:#fbbf24;text-transform:uppercase;">Prize if team wins</div>',
            '<div style="font-size:0.78rem;color:#fff;font-weight:700;">' + CHALLENGE_PRIZE + '</div>',
          '</div>',
          '<button id="minahan-refresh-btn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:0.68rem;font-weight:700;padding:6px 12px;border-radius:10px;cursor:pointer;">Refresh</button>',
        '</div>',
      '</div>'
    ].join('');
  }

  // Cache the last-seen scoreboard so re-injections after loadHomeChallenges
  // wipes the list are instant — no "Loading..." flicker.
  let _lastScores = null;
  let _fetchInFlight = false;

  function injectCardOnly(state) {
    const list = document.getElementById('home-challenges-list');
    if (!list) return;
    // Remove any existing instance, then re-inject at the top.
    const old = document.getElementById('minahan-home-card');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    list.insertAdjacentHTML('afterbegin', buildScoreboardHTML(_lastScores, state));
    wireRefreshButton();
  }

  async function renderHomeCard(forceFetch) {
    if (!isInChallengeCast()) return;
    const state = loadState();
    if (!state || !state.accepted) return;
    if (!document.getElementById('home-challenges-list')) return;

    // Paint immediately using whatever we already know (cached or null).
    injectCardOnly(state);

    // Fetch fresh numbers in the background if we don't have any yet,
    // or if the caller explicitly asked for a refresh.
    if ((forceFetch || !_lastScores) && !_fetchInFlight) {
      _fetchInFlight = true;
      try {
        const scores = await fetchScoreboard();
        if (scores) _lastScores = scores;
      } catch (e) {
        console.warn('[minahan] scoreboard fetch failed', e);
      } finally {
        _fetchInFlight = false;
      }
      // Re-inject so the card reflects the new numbers.
      injectCardOnly(state);
    }
  }

  function wireRefreshButton() {
    const btn = document.getElementById('minahan-refresh-btn');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      btn.textContent = '...';
      renderHomeCard(true); // force a fresh fetch
    });
  }

  // ----- Should we show the invite modal now? ---------------------------
  function shouldShowInvite() {
    if (!isMinahan() && !isCoachShan()) return false;
    const state = loadState() || {};
    if (state.accepted) return false;
    // If dismissed, don't nag every open — show again only after 24h
    if (state.invite_dismissed_at) {
      const hoursSince = (Date.now() - state.invite_dismissed_at) / 36e5;
      if (hoursSince < 24) return false;
    }
    return true;
  }

  // Watch the home challenges list for any external re-renders and
  // re-inject our card whenever it disappears. This is more robust than
  // monkey-patching loadHomeChallenges because it catches every code path
  // that mutates the list (there are a dozen+ call sites).
  let _listObserver = null;
  let _reinjectTimer = null;
  function installListObserver() {
    if (_listObserver) return;
    const list = document.getElementById('home-challenges-list');
    if (!list) {
      // List not in DOM yet — try again shortly.
      setTimeout(installListObserver, 500);
      return;
    }
    _listObserver = new MutationObserver(function () {
      const state = loadState();
      if (!state || !state.accepted) return;
      // If our card isn't in the list anymore, re-inject it. Debounce so
      // we don't thrash during an innerHTML = ... flurry.
      if (!document.getElementById('minahan-home-card')) {
        clearTimeout(_reinjectTimer);
        _reinjectTimer = setTimeout(function () {
          try { injectCardOnly(state); } catch (e) {}
        }, 60);
      }
    });
    _listObserver.observe(list, { childList: true, subtree: false });
  }

  // ----- Main init -------------------------------------------------------
  async function init() {
    if (!window.currentUser) return;
    if (!isInChallengeCast()) return;

    // Warm up the user-ID cache in the background so the scoreboard is
    // snappy the moment they accept.
    resolveCastIds().catch(function () {});

    // Start watching the home challenges list so our card survives
    // any refresh that wipes the innerHTML.
    installListObserver();

    // Render scoreboard if already accepted
    if ((loadState() || {}).accepted) {
      renderHomeCard(true);
    }

    // Show the invite modal if they haven't responded yet
    if (shouldShowInvite()) {
      // Wait a beat so the dashboard settles first
      setTimeout(openInviteModal, 1800);
    }
  }

  // ----- Expose + wire up ------------------------------------------------
  window.MinahanCoupleChallenge = {
    init: init,
    openInvite: openInviteModal,
    accept: acceptChallenge,
    render: renderHomeCard,
    state: loadState,
    reset: function () { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
  };

  function boot() {
    init();
  }

  if (window.currentUser) {
    boot();
  } else {
    // Wait for the app to report init complete, or poll briefly as a fallback.
    window.addEventListener('pbbInitComplete', function () { setTimeout(boot, 400); }, { once: true });
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      if (window.currentUser) { clearInterval(poll); boot(); }
      else if (tries > 40) { clearInterval(poll); }
    }, 500);
  }

  // Also re-run on visibility change so returning users get a fresh card
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && window.currentUser && isInChallengeCast()) {
      const s = loadState();
      if (s && s.accepted) renderHomeCard();
    }
  });
})();
