(function () {
  'use strict';

  var PILOT_EMAIL = 'shannonbirch@cocospersonaltraining.com';
  var active = null;
  var renderTimer = null;
  var renderSequence = 0;
  var FILTERS = [
    { id: 'original', label: 'Original', css: 'none' },
    { id: 'warm', label: 'Warm', css: 'saturate(1.08) contrast(1.04) sepia(.12)' },
    { id: 'clean', label: 'Clean', css: 'brightness(1.07) saturate(.9) contrast(1.02)' },
    { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.12)' },
    { id: 'film', label: 'Film', css: 'sepia(.24) saturate(.78) contrast(1.08)' },
    { id: 'cool', label: 'Cool', css: 'hue-rotate(8deg) saturate(.92) contrast(1.03)' },
    { id: 'punch', label: 'Punch', css: 'saturate(1.3) contrast(1.13)' },
    { id: 'soft', label: 'Soft', css: 'brightness(1.06) contrast(.92) saturate(.88)' }
  ];
  var EMOJIS = ['🔥', '💪', '🌱', '🏆', '⭐', '✨', '❤️', '🥗', '🏃', '📈', '🙌', '😮‍💨'];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function svgIcon(name) {
    var icons = {
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      undo: '<path d="M9 7H4v-5M4 7c2-3 5-4 8-4a8 8 0 1 1-7 14"/>',
      save: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
      text: '<path d="M4 6V4h16v2M12 4v16M8 20h8"/>',
      sticker: '<path d="M12 3a9 9 0 1 0 9 9v-1a8 8 0 0 1-8-8h-1Z"/><path d="M8 11h.01M15 11h.01M8.5 15c2 2 5 2 7 0"/>',
      workout: '<path d="M6 9v6M3 11v2M18 9v6M21 11v2M6 12h12"/>',
      adjust: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',
      filter: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c3-2 3-5 0-7s-3-6 0-11Z"/>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (icons[name] || '') + '</svg>';
  }

  function accountEmail() {
    return String(window.currentUser && window.currentUser.email || '').trim().toLowerCase();
  }

  function isEnabled() {
    return accountEmail() === PILOT_EMAIL;
  }

  function ensureWorkoutCompleteStyles() {
    if (document.getElementById('pbb-private-workout-complete-styles')) return;
    var style = document.createElement('style');
    style.id = 'pbb-private-workout-complete-styles';
    style.textContent = `
      #view-workout-success.pbb-private-complete-active{background:#f5eee1!important;color:#121927!important;-webkit-text-fill-color:currentColor;overflow:hidden!important;padding:0!important}
      #view-workout-success.pbb-private-complete-active>div:not(#pbb-private-workout-complete){display:none!important}
      .pbb-private-workout-complete{--pwc-bg:#f5eee1;--pwc-surface:#fffaf2;--pwc-text:#121927;--pwc-muted:#726a5d;--pwc-line:#ded0b6;--pwc-gold:#e4b227;--pwc-gold-ink:#121927;width:100%;height:100%;min-height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--pwc-bg);color:var(--pwc-text);-webkit-text-fill-color:currentColor;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);font-family:Inter,system-ui,sans-serif}
      body.dark-mode .pbb-private-workout-complete,html[data-theme="dark"] .pbb-private-workout-complete{--pwc-bg:#0c0d0f;--pwc-surface:#151619;--pwc-text:#f8f1e4;--pwc-muted:#b9ae9c;--pwc-line:#363027;--pwc-gold:#f3d87c;--pwc-gold-ink:#16130d}
      body.dark-mode #view-workout-success.pbb-private-complete-active,html[data-theme="dark"] #view-workout-success.pbb-private-complete-active{background:#0c0d0f!important;color:#f8f1e4!important}
      .pbb-private-workout-complete *{box-sizing:border-box}.pbb-private-workout-complete button{font:inherit;cursor:pointer}.pwc-shell{width:min(100%,520px);min-height:0;margin:0 auto;background:var(--pwc-surface)}
      .pwc-topbar{min-height:54px;padding:8px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.pwc-close{width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;display:grid;place-items:center;border:1px solid var(--pwc-line)!important;border-radius:50%!important;background:transparent!important;color:var(--pwc-text)!important;-webkit-text-fill-color:var(--pwc-text)!important;box-shadow:none!important;font-size:1.2rem;line-height:1}.pwc-kicker,.pwc-label{color:var(--pwc-muted);-webkit-text-fill-color:var(--pwc-muted);font-size:.7rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}
      .pwc-main{padding:4px 18px 16px}.pwc-workout-name{display:block;margin-bottom:10px}.pwc-time{margin:0 0 5px;font-size:clamp(3rem,14vw,4.1rem);line-height:.92;font-weight:500;letter-spacing:-.065em;color:var(--pwc-text);-webkit-text-fill-color:var(--pwc-text)}.pwc-time small{color:var(--pwc-muted);-webkit-text-fill-color:var(--pwc-muted);font-size:.95rem;letter-spacing:0}.pwc-copy{margin:0;color:var(--pwc-muted);-webkit-text-fill-color:var(--pwc-muted);font-size:.84rem}.pwc-progress{height:7px;margin:16px 0 8px;overflow:hidden;border-radius:99px;background:var(--pwc-line)}.pwc-progress span{display:block;height:100%;border-radius:inherit;background:var(--pwc-gold)}.pwc-inline{display:flex;justify-content:space-between;color:var(--pwc-muted);-webkit-text-fill-color:var(--pwc-muted);font-size:.72rem}
      .pwc-section{padding:14px 18px;border-top:1px solid var(--pwc-line)}.pwc-stats{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px}.pwc-stat strong{display:block;color:var(--pwc-text);-webkit-text-fill-color:var(--pwc-text);font-size:1.02rem;font-weight:750}.pwc-stat span,.pwc-pb-copy span{color:var(--pwc-muted);-webkit-text-fill-color:var(--pwc-muted);font-size:.72rem}.pwc-pb-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px}.pwc-pb-copy{min-width:0}.pwc-pb-copy strong{display:block;color:var(--pwc-text);-webkit-text-fill-color:var(--pwc-text);font-size:.9rem;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwc-pb-gain{flex:0 0 auto;color:#8c6811;-webkit-text-fill-color:#8c6811;font-size:.75rem;font-weight:850}body.dark-mode .pwc-pb-gain,html[data-theme="dark"] .pwc-pb-gain{color:var(--pwc-gold);-webkit-text-fill-color:var(--pwc-gold)}
      .pwc-actions{margin:0;padding:14px 18px calc(16px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1.6fr;gap:9px;border-top:1px solid var(--pwc-line)}.pwc-primary,.pwc-secondary{min-height:48px;border-radius:14px;padding:0 14px;font-weight:850}.pwc-primary{border:0;background:var(--pwc-gold);color:var(--pwc-gold-ink);-webkit-text-fill-color:var(--pwc-gold-ink)}.pwc-secondary{border:1px solid var(--pwc-line);background:transparent;color:var(--pwc-text);-webkit-text-fill-color:var(--pwc-text)}
      @media(min-width:521px){.pwc-shell{box-shadow:0 0 60px rgba(61,46,19,.12)}}
    `;
    document.head.appendChild(style);
  }

  function formatWorkoutPb(pb) {
    if (!pb) return { result: '', gain: '' };
    var result = pb.type === 'weight'
      ? String(pb.value || 0) + ' kg × ' + String(pb.reps || 0) + ' reps'
      : String(pb.value || 0) + ' reps @ ' + String(pb.weight || 0) + ' kg';
    var gain = pb.improvement ? '+' + String(pb.improvement) + (pb.type === 'weight' ? ' kg' : ' reps') : 'New best';
    return { result: result, gain: gain };
  }

  function renderWorkoutCompletePage(data) {
    var view = document.getElementById('view-workout-success');
    if (!view) return false;
    if (!isEnabled()) {
      view.classList.remove('pbb-private-complete-active');
      var oldPrivatePage = document.getElementById('pbb-private-workout-complete');
      if (oldPrivatePage) oldPrivatePage.remove();
      return false;
    }

    ensureWorkoutCompleteStyles();
    data = data || {};
    var rows = Array.isArray(data.workoutData) ? data.workoutData : [];
    var completedSets = rows.length;
    var plannedSets = document.querySelectorAll('#workout-exercises-list .workout-set-row').length || completedSets;
    plannedSets = Math.max(plannedSets, completedSets, 1);
    var completion = Math.max(0, Math.min(100, Math.round((completedSets / plannedSets) * 100)));
    var exercises = new Set(rows.map(function (row) { return String(row.exercise || row.exercise_name || '').trim(); }).filter(Boolean));
    var volume = rows.reduce(function (sum, row) { return sum + ((Number(row.kg) || 0) * (Number(row.reps) || 0)); }, 0);
    var durationParts = String(data.duration || '0:00').split(':').map(function (value) { return parseInt(value, 10) || 0; });
    var minutes = durationParts.length >= 3 ? (durationParts[0] * 60) + durationParts[1] : durationParts[0];
    var seconds = durationParts.length >= 3 ? durationParts[2] : (durationParts[1] || 0);
    var durationValue = minutes > 0 ? minutes : seconds;
    var durationUnit = minutes > 0 || seconds === 0 ? 'min' : 'sec';
    var pbs = Array.isArray(data.newPBs) ? data.newPBs : [];
    var firstPb = pbs[0] || null;
    var pbValue = formatWorkoutPb(firstPb);
    var page = document.getElementById('pbb-private-workout-complete');
    if (!page) {
      page = document.createElement('section');
      page.id = 'pbb-private-workout-complete';
      page.className = 'pbb-private-workout-complete';
      view.prepend(page);
    }
    page.innerHTML = `
      <div class="pwc-shell">
        <div class="pwc-topbar"><button type="button" class="pwc-close" onclick="closeSuccessScreen()" aria-label="Close workout saved page">×</button><span class="pwc-kicker">Workout saved</span><span style="width:40px" aria-hidden="true"></span></div>
        <main class="pwc-main">
          <span class="pwc-kicker pwc-workout-name"></span>
          <div class="pwc-time"><span data-pwc-minutes></span><small data-pwc-unit></small></div>
          <p class="pwc-copy" data-pwc-copy></p>
          <div class="pwc-progress" role="progressbar" aria-label="Planned sets completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${completion}"><span style="width:${completion}%"></span></div>
          <div class="pwc-inline"><span>Workout complete</span><span>${completion}%</span></div>
        </main>
        <section class="pwc-section"><span class="pwc-label">Today’s work</span><div class="pwc-stats"><div class="pwc-stat"><strong data-pwc-volume></strong><span>Total volume</span></div><div class="pwc-stat"><strong>${exercises.size || 0} exercise${exercises.size === 1 ? '' : 's'}</strong><span>Completed</span></div></div></section>
        <section class="pwc-section" data-pwc-pb-section style="display:${firstPb ? 'block' : 'none'}"><span class="pwc-label">${pbs.length === 1 ? 'One new best' : pbs.length + ' new bests'}</span><div class="pwc-pb-row"><div class="pwc-pb-copy"><strong data-pwc-pb-name></strong><span data-pwc-pb-result></span></div><div class="pwc-pb-gain" data-pwc-pb-gain></div></div></section>
        <div class="pwc-actions"><button type="button" class="pwc-secondary" onclick="closeSuccessScreen()">Done</button><button type="button" class="pwc-primary" onclick="if(typeof beginPostWorkoutCompositeShare==='function'){beginPostWorkoutCompositeShare(buildWorkoutShareCardPayload(),'workout')}else if(typeof captureWorkoutSharePhoto==='function'){captureWorkoutSharePhoto()}">Share a photo</button></div>
      </div>`;
    page.querySelector('.pwc-workout-name').textContent = String(data.workoutName || 'Workout');
    page.querySelector('[data-pwc-minutes]').textContent = String(durationValue);
    page.querySelector('[data-pwc-unit]').textContent = ' ' + durationUnit;
    page.querySelector('[data-pwc-copy]').textContent = 'You completed ' + completedSets + ' of ' + plannedSets + ' planned sets.';
    page.querySelector('[data-pwc-volume]').textContent = Math.round(volume).toLocaleString('en-AU') + ' kg';
    if (firstPb) {
      page.querySelector('[data-pwc-pb-name]').textContent = String(firstPb.exercise || 'Personal best');
      page.querySelector('[data-pwc-pb-result]').textContent = pbValue.result;
      page.querySelector('[data-pwc-pb-gain]').textContent = pbValue.gain;
    }
    view.classList.add('pbb-private-complete-active');
    var bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';
    window.dispatchEvent(new CustomEvent('pbb:private-workout-complete-shown'));
    if (typeof window._crumb === 'function') window._crumb('private_workout_complete_shown');
    return true;
  }

  function ensureStylesLegacy() {
    if (document.getElementById('pbb-private-share-studio-styles')) return;
    var style = document.createElement('style');
    style.id = 'pbb-private-share-studio-styles';
    style.textContent = `
      .pbb-share-studio{--ps-canvas:#f8f5ee;--ps-soft:#f4f0e7;--ps-ink:#151515;--ps-muted:#6f6a61;--ps-border:#ded7c9;--ps-gold:#d8b25e;position:fixed;inset:0;z-index:100120;display:none;overflow:hidden;background:#111;color:#fff;-webkit-text-fill-color:currentColor;font-family:inherit}
      .pbb-share-studio.is-open{display:block}.pbb-share-studio *{box-sizing:border-box}.pbb-share-studio button,.pbb-share-studio textarea{font:inherit}
      .pbb-share-studio__stage{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:#111;touch-action:none}.pbb-share-studio__photo{display:block;width:100%;height:100%;object-fit:contain;background:#111}.pbb-share-studio__loading{position:absolute;inset:0;display:grid;place-items:center;background:rgba(17,17,17,.3);font-size:.82rem;font-weight:800;pointer-events:none}.pbb-share-studio__loading[hidden]{display:none}
      .pbb-share-studio__top{position:absolute;z-index:4;top:0;left:0;right:0;min-height:calc(66px + env(safe-area-inset-top));display:flex;align-items:flex-end;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:linear-gradient(to bottom,rgba(0,0,0,.76),rgba(0,0,0,.12));pointer-events:none}.pbb-share-studio__top-group{display:flex;align-items:center;gap:8px;pointer-events:auto}
      .pbb-share-studio__icon{min-width:42px;height:42px;padding:0 12px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(10,10,10,.48);color:#fff;-webkit-text-fill-color:#fff;font-size:1.12rem;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.pbb-share-studio__done{min-height:42px;border:1px solid var(--ps-gold);border-radius:999px;background:var(--ps-gold);color:var(--ps-ink);-webkit-text-fill-color:var(--ps-ink);padding:0 16px;font-size:.82rem;font-weight:900;cursor:pointer}.pbb-share-studio__done[hidden]{display:none}
      .pbb-share-studio__caption{position:absolute;left:50%;top:22%;max-width:82%;transform:translate(-50%,-50%);padding:5px 9px;border-radius:8px;color:#fff;-webkit-text-fill-color:#fff;text-align:center;font-size:clamp(1.15rem,5vw,2rem);line-height:1.08;font-weight:900;white-space:pre-wrap;overflow-wrap:anywhere;text-shadow:0 2px 10px rgba(0,0,0,.82);cursor:grab;touch-action:none;user-select:none}.pbb-share-studio__caption[data-style="label"]{background:rgba(17,17,17,.82);padding:9px 13px;text-shadow:none}.pbb-share-studio__caption[data-style="gold"]{background:var(--ps-gold);color:var(--ps-ink);-webkit-text-fill-color:var(--ps-ink);text-shadow:none}.pbb-share-studio__caption:empty{display:none}
      .pbb-share-studio__tools{position:absolute;z-index:5;inset:0;pointer-events:none}.pbb-share-studio__tool-rail{position:absolute;top:calc(86px + env(safe-area-inset-top));right:12px;display:flex;flex-direction:column;gap:9px;pointer-events:auto}.pbb-share-studio__tool{width:50px;min-height:52px;padding:5px 3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1px solid rgba(255,255,255,.28);border-radius:15px;background:rgba(10,10,10,.48);color:#fff;-webkit-text-fill-color:#fff;font-size:.62rem;font-weight:800;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);cursor:pointer}.pbb-share-studio__tool strong{font-size:1rem;line-height:1}.pbb-share-studio__tool.is-active,.pbb-share-studio__tool[aria-pressed="true"]{background:var(--ps-gold);border-color:var(--ps-gold);color:var(--ps-ink);-webkit-text-fill-color:var(--ps-ink)}
      .pbb-share-studio__text-panel{pointer-events:auto;position:absolute;left:12px;right:12px;bottom:calc(146px + env(safe-area-inset-bottom));max-height:min(42dvh,330px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px;border:1px solid rgba(255,255,255,.28);border-radius:17px;background:rgba(12,12,12,.88);color:#fff;-webkit-text-fill-color:#fff;box-shadow:0 18px 60px rgba(0,0,0,.34);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.pbb-share-studio__text-panel[hidden]{display:none}.pbb-share-studio__panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px}.pbb-share-studio__label{font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.76);-webkit-text-fill-color:rgba(255,255,255,.76)}.pbb-share-studio__panel-done{border:0;border-radius:10px;background:var(--ps-gold);color:var(--ps-ink);-webkit-text-fill-color:var(--ps-ink);padding:7px 12px;font-size:.78rem;font-weight:900;cursor:pointer}
      .pbb-share-studio__input{width:100%;min-height:44px;max-height:88px;resize:none;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(255,255,255,.1);color:#fff;-webkit-text-fill-color:#fff;padding:11px 12px;font-size:.92rem;line-height:1.3;outline:none}.pbb-share-studio__input:focus{border-color:var(--ps-gold);box-shadow:0 0 0 3px rgba(216,178,94,.2)}.pbb-share-studio__input::placeholder{color:rgba(255,255,255,.65);-webkit-text-fill-color:rgba(255,255,255,.65)}
      .pbb-share-studio__row{display:flex;gap:7px;overflow-x:auto;padding-top:9px;scrollbar-width:none}.pbb-share-studio__row::-webkit-scrollbar{display:none}.pbb-share-studio__chip{flex:0 0 auto;min-height:34px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:transparent;color:#fff;-webkit-text-fill-color:#fff;padding:0 12px;font-size:.75rem;font-weight:850;cursor:pointer}.pbb-share-studio__chip.is-active{border-color:var(--ps-gold);color:var(--ps-gold);-webkit-text-fill-color:var(--ps-gold)}
      .pbb-share-studio__bottom{position:absolute;left:0;right:0;bottom:0;padding:52px 12px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(to top,rgba(0,0,0,.9),rgba(0,0,0,.34),transparent);pointer-events:none}.pbb-share-studio__style-row{display:flex;justify-content:center;gap:12px;margin-bottom:12px;pointer-events:auto}.pbb-share-studio__style{width:58px;height:50px;border:2px solid transparent;border-radius:14px;background:rgba(10,10,10,.56);color:#fff;-webkit-text-fill-color:#fff;font-size:.68rem;font-weight:850;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);cursor:pointer}.pbb-share-studio__style[aria-pressed="true"]{border-color:var(--ps-gold);color:var(--ps-gold);-webkit-text-fill-color:var(--ps-gold)}
      .pbb-share-studio__actions{pointer-events:auto;display:grid;grid-template-columns:1fr 1fr 1.12fr;gap:8px}.pbb-share-studio__action{min-height:50px;border:1px solid rgba(255,255,255,.28);border-radius:14px;background:rgba(10,10,10,.56);color:#fff;-webkit-text-fill-color:#fff;font-size:.76rem;font-weight:900;cursor:pointer;box-shadow:0 10px 32px rgba(0,0,0,.28);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.pbb-share-studio__action--share{background:var(--ps-gold);border-color:var(--ps-gold);color:var(--ps-ink);-webkit-text-fill-color:var(--ps-ink)}.pbb-share-studio__action:disabled{opacity:.55;cursor:wait}
      .pbb-photo-source{position:fixed;inset:0;z-index:100119;display:grid;align-items:end;background:rgba(15,12,7,.55);padding:18px;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.pbb-photo-source__card{width:min(100%,480px);margin:0 auto;background:#f8f5ee;color:#151515;-webkit-text-fill-color:#151515;border:1px solid #ded7c9;border-radius:22px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.pbb-photo-source__title{font-size:1.05rem;font-weight:900;margin-bottom:4px}.pbb-photo-source__copy{font-size:.82rem;color:#6f6a61;margin-bottom:14px}.pbb-photo-source__button{width:100%;min-height:50px;border:0;border-radius:14px;background:#111;color:#fff;-webkit-text-fill-color:#fff;font:inherit;font-weight:900;margin-top:8px}.pbb-photo-source__button--gold{background:#d8b25e;color:#151515;-webkit-text-fill-color:#151515}.pbb-photo-source__button--cancel{background:transparent;color:#151515;-webkit-text-fill-color:#151515;border:1px solid #ded7c9}
      html[data-theme="light"] .pbb-share-studio__style[aria-pressed="true"],body.light-mode .pbb-share-studio__style[aria-pressed="true"]{border-color:#f5d98a;color:#f5d98a;-webkit-text-fill-color:#f5d98a}html[data-theme="dark"] .pbb-share-studio__style[aria-pressed="true"],body.dark-mode .pbb-share-studio__style[aria-pressed="true"]{border-color:#d8b25e;color:#d8b25e;-webkit-text-fill-color:#d8b25e}
      @media(max-height:680px){.pbb-share-studio__top{min-height:calc(58px + env(safe-area-inset-top))}.pbb-share-studio__tool-rail{top:calc(70px + env(safe-area-inset-top));gap:6px}.pbb-share-studio__tool{min-height:46px}.pbb-share-studio__bottom{padding-top:36px}.pbb-share-studio__style-row{margin-bottom:8px}.pbb-share-studio__style{height:42px}.pbb-share-studio__action{min-height:44px}.pbb-share-studio__text-panel{bottom:calc(126px + env(safe-area-inset-bottom));max-height:46dvh}}
    `;
    document.head.appendChild(style);
  }

  function ensureStyles() {
    if (document.getElementById('pbb-private-share-studio-styles-v3')) return;
    var style = document.createElement('style');
    style.id = 'pbb-private-share-studio-styles-v3';
    style.textContent = `
      .pbb-share-studio{--gold:#d8b25e;--cream:#f8f5ee;--ink:#111;position:fixed;inset:0;z-index:100120;display:none;overflow:hidden;background:#090909;color:#fff;-webkit-text-fill-color:currentColor;font-family:Inter,system-ui,sans-serif}
      .pbb-share-studio.is-open{display:block}.pbb-share-studio *{box-sizing:border-box}.pbb-share-studio button,.pbb-share-studio textarea,.pbb-share-studio input{font:inherit}.pbb-share-studio button{cursor:pointer}
      .pbb-share-studio__stage{position:absolute;inset:0;overflow:hidden;background:#090909;touch-action:none}.pbb-share-studio__photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 50%;will-change:transform,filter;pointer-events:none;user-select:none}
      .pbb-share-studio__shade{position:absolute;inset:42% 0 0;background:linear-gradient(transparent,rgba(0,0,0,.12) 30%,rgba(0,0,0,.72));pointer-events:none}.pbb-share-studio__brand{position:absolute;left:5%;top:15%;display:flex;align-items:center;gap:8px;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none}.pbb-share-studio__brand-mark{width:34px;height:34px;border:2px solid #fff;border-radius:50%;display:grid;place-items:center;font-size:.75rem;font-weight:950}.pbb-share-studio__brand strong{display:block;font-size:.78rem;letter-spacing:.04em}.pbb-share-studio__brand small{display:block;font-size:.43rem;font-weight:800;opacity:.82;letter-spacing:.04em}
      .pbb-share-studio__top{position:absolute;z-index:20;top:0;left:0;right:0;min-height:calc(70px + env(safe-area-inset-top));display:flex;align-items:flex-end;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;background:linear-gradient(rgba(0,0,0,.78),transparent);pointer-events:none}.pbb-share-studio__top-group{display:flex;gap:8px;pointer-events:auto}.pbb-share-studio__top-button{height:44px;min-width:44px;padding:0 12px;border:1px solid rgba(255,255,255,.32);border-radius:999px;background:rgba(8,8,8,.5);color:#fff;-webkit-text-fill-color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;backdrop-filter:blur(14px)}.pbb-share-studio__top-button svg{width:21px;height:21px}.pbb-share-studio__next{background:var(--gold);border-color:var(--gold);color:var(--ink);-webkit-text-fill-color:var(--ink);font-weight:900;padding-inline:18px}
      .pbb-share-studio__rail{position:absolute;z-index:21;right:10px;top:calc(82px + env(safe-area-inset-top));display:flex;flex-direction:column;gap:8px}.pbb-share-studio__tool{width:66px;min-height:62px;padding:7px 4px;border:1px solid rgba(255,255,255,.3);border-radius:17px;background:rgba(10,10,10,.56);color:#fff;-webkit-text-fill-color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;backdrop-filter:blur(14px);font-size:.66rem;font-weight:850}.pbb-share-studio__tool svg{width:22px;height:22px;flex:0 0 auto}.pbb-share-studio__tool span{display:block;line-height:1.05;white-space:nowrap}.pbb-share-studio__tool.is-active{background:var(--gold);border-color:var(--gold);color:var(--ink);-webkit-text-fill-color:var(--ink)}
      .pbb-share-studio__layer{position:absolute;z-index:6;touch-action:none;user-select:none;cursor:grab;transform-origin:center}.pbb-share-studio__layer.is-selected{outline:1px dashed rgba(255,255,255,.8);outline-offset:8px}.pbb-share-studio__workout{left:7%;top:58%;width:78%;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.9)}.pbb-share-studio__workout-kicker{font-size:.62rem;font-weight:950;letter-spacing:.08em;color:var(--gold);-webkit-text-fill-color:var(--gold)}.pbb-share-studio__workout-title{margin:8px 0 14px;font-size:clamp(1.8rem,10vw,3.4rem);line-height:.9;font-weight:950;letter-spacing:-.05em;text-transform:uppercase}.pbb-share-studio__metrics{display:grid;grid-template-columns:repeat(3,1fr);border-top:2px solid var(--gold);padding-top:12px}.pbb-share-studio__metric{padding:0 10px;border-left:1px solid rgba(255,255,255,.48)}.pbb-share-studio__metric:first-child{padding-left:0;border-left:0}.pbb-share-studio__metric strong{display:block;font-size:clamp(.8rem,4.7vw,1.35rem);white-space:nowrap}.pbb-share-studio__metric small{font-size:.48rem;font-weight:900;letter-spacing:.05em;opacity:.82}.pbb-share-studio__caption{left:50%;top:26%;max-width:78%;padding:7px 11px;border-radius:9px;color:#fff;-webkit-text-fill-color:#fff;text-align:center;font-size:clamp(1.25rem,6vw,2.3rem);line-height:1.06;font-weight:900;white-space:pre-wrap;overflow-wrap:anywhere;text-shadow:0 2px 12px rgba(0,0,0,.9)}.pbb-share-studio__caption:empty{display:none}.pbb-share-studio__caption[data-style=label]{background:rgba(17,17,17,.86);text-shadow:none}.pbb-share-studio__caption[data-style=gold]{background:var(--gold);color:var(--ink);-webkit-text-fill-color:var(--ink);text-shadow:none}.pbb-share-studio__sticker{font-size:clamp(2rem,11vw,4.5rem);line-height:1;filter:drop-shadow(0 3px 8px rgba(0,0,0,.38))}.pbb-share-studio__delete-sticker{position:absolute;right:-19px;top:-19px;width:27px;height:27px;border:1px solid #fff;border-radius:50%;background:#111;color:#fff;-webkit-text-fill-color:#fff;display:none;place-items:center;font-size:.85rem}.pbb-share-studio__sticker.is-selected .pbb-share-studio__delete-sticker{display:grid}
      .pbb-share-studio__workout[data-layout=scorecard]{padding:18px;border:1px solid var(--gold);border-radius:22px;background:rgba(8,8,8,.72);text-shadow:none}.pbb-share-studio__workout[data-layout=scorecard] .pbb-share-studio__workout-title{font-size:clamp(1.55rem,8vw,2.8rem)}.pbb-share-studio__workout[data-layout=simple] .pbb-share-studio__metrics{display:none}.pbb-share-studio__workout[data-layout=simple] .pbb-share-studio__workout-title{font-size:clamp(2.1rem,12vw,4rem)}.pbb-share-studio__workout[data-layout=receipt]{padding:16px 18px;background:rgba(8,8,8,.76);color:#fff;-webkit-text-fill-color:#fff;text-shadow:none;border:1px solid rgba(216,178,94,.72);border-radius:18px;box-shadow:0 10px 35px rgba(0,0,0,.3)}.pbb-share-studio__workout[data-layout=receipt] .pbb-share-studio__workout-title{font-size:clamp(1.45rem,7.6vw,2.5rem)}.pbb-share-studio__lifts{display:none;margin-top:10px}.pbb-share-studio__workout[data-layout=receipt] .pbb-share-studio__lifts{display:grid;gap:5px}.pbb-share-studio__lifts div{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.1);font-size:.55rem}.pbb-share-studio__lifts strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pbb-share-studio__lifts span{flex:0 0 auto;color:var(--gold);-webkit-text-fill-color:var(--gold)}
      .pbb-share-studio__drawer{position:absolute;z-index:22;left:10px;right:10px;bottom:calc(74px + env(safe-area-inset-bottom));min-height:104px;max-height:39dvh;padding:13px;border:1px solid rgba(255,255,255,.25);border-radius:20px;background:rgba(10,10,10,.88);box-shadow:0 18px 60px rgba(0,0,0,.4);backdrop-filter:blur(20px);overflow:auto}.pbb-share-studio__drawer[hidden]{display:none}.pbb-share-studio__drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.pbb-share-studio__drawer-title{font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.pbb-share-studio__drawer-done{min-height:34px;padding:0 13px;border:0;border-radius:999px;background:var(--gold);color:var(--ink);-webkit-text-fill-color:var(--ink);font-weight:900;font-size:.72rem}.pbb-share-studio__scroll-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none}.pbb-share-studio__scroll-row::-webkit-scrollbar{display:none}.pbb-share-studio__filter{flex:0 0 62px;border:0;background:transparent;color:#fff;-webkit-text-fill-color:#fff;padding:0;font-size:.66rem;font-weight:800;text-align:center}.pbb-share-studio__filter-preview{width:52px;height:52px;margin:0 auto 5px;border:2px solid transparent;border-radius:50%;background-position:center;background-size:cover}.pbb-share-studio__filter.is-active .pbb-share-studio__filter-preview{border-color:var(--gold);box-shadow:0 0 0 2px #111,0 0 0 4px var(--gold)}
      .pbb-share-studio__input{width:100%;min-height:54px;resize:none;border:1px solid rgba(255,255,255,.3);border-radius:13px;background:rgba(255,255,255,.09);color:#fff;-webkit-text-fill-color:#fff;padding:12px;font-size:1rem;outline:none}.pbb-share-studio__input:focus{border-color:var(--gold)}.pbb-share-studio__chip-row{display:flex;gap:8px;overflow-x:auto;margin-top:10px;scrollbar-width:none}.pbb-share-studio__chip{flex:0 0 auto;min-height:36px;padding:0 13px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:transparent;color:#fff;-webkit-text-fill-color:#fff;font-size:.72rem;font-weight:850}.pbb-share-studio__chip.is-active{border-color:var(--gold);color:var(--gold);-webkit-text-fill-color:var(--gold)}.pbb-share-studio__colour{width:36px;height:36px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.5);flex:0 0 36px}.pbb-share-studio__colour.is-active{box-shadow:0 0 0 2px #111,0 0 0 4px var(--gold)}.pbb-share-studio__range-row{display:grid;grid-template-columns:58px 1fr 46px;align-items:center;gap:9px;margin-top:12px;font-size:.7rem;font-weight:850}.pbb-share-studio__range{accent-color:var(--gold);width:100%}.pbb-share-studio__emoji{flex:0 0 50px;width:50px;height:50px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(255,255,255,.08);font-size:1.65rem}.pbb-share-studio__hint{margin:8px 0 0;color:rgba(255,255,255,.72);font-size:.67rem;line-height:1.35}
      .pbb-share-studio__actions{position:absolute;z-index:24;left:10px;right:10px;bottom:calc(9px + env(safe-area-inset-bottom));height:56px;display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:8px}.pbb-share-studio__action{border:1px solid rgba(255,255,255,.3);border-radius:16px;background:rgba(10,10,10,.74);color:#fff;-webkit-text-fill-color:#fff;font-size:.76rem;font-weight:900;backdrop-filter:blur(14px)}.pbb-share-studio__action--gold{background:var(--gold);border-color:var(--gold);color:var(--ink);-webkit-text-fill-color:var(--ink)}.pbb-share-studio__loading{position:absolute;z-index:30;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.45);font-weight:900}.pbb-share-studio__loading[hidden]{display:none}
      .pbb-photo-source{position:fixed;inset:0;z-index:100119;display:grid;align-items:end;background:rgba(15,12,7,.55);padding:18px calc(18px + env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) calc(18px + env(safe-area-inset-left))}.pbb-photo-source__card{width:min(100%,480px);margin:auto;background:var(--cream,#f8f5ee);color:#151515;-webkit-text-fill-color:#151515;border-radius:22px;padding:18px}.pbb-photo-source__title{font-size:1.05rem;font-weight:900}.pbb-photo-source__copy{font-size:.82rem;color:#6f6a61;margin:4px 0 12px}.pbb-photo-source__button{width:100%;min-height:50px;border:0;border-radius:14px;background:#111;color:#fff;-webkit-text-fill-color:#fff;font-weight:900;margin-top:8px}.pbb-photo-source__button--gold{background:#d8b25e;color:#151515;-webkit-text-fill-color:#151515}.pbb-photo-source__button--cancel{background:transparent;color:#151515;-webkit-text-fill-color:#151515;border:1px solid #ded7c9}
      @media(max-height:700px){.pbb-share-studio__rail{top:calc(70px + env(safe-area-inset-top));gap:5px}.pbb-share-studio__tool{min-height:54px}.pbb-share-studio__drawer{bottom:calc(68px + env(safe-area-inset-bottom));max-height:34dvh}.pbb-share-studio__actions{height:50px}.pbb-share-studio__workout{top:52%}}
    `;
    document.head.appendChild(style);
  }

  function ensureElementLegacy() {
    ensureStyles();
    var el = document.getElementById('pbb-private-share-studio-v3') || document.getElementById('pbb-private-share-studio');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'pbb-private-share-studio';
    el.className = 'pbb-share-studio';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Edit your share photo');
    el.innerHTML = `
      <div class="pbb-share-studio__top">
        <div class="pbb-share-studio__top-group"><button type="button" class="pbb-share-studio__icon" data-share-close aria-label="Close editor">×</button><button type="button" class="pbb-share-studio__icon" data-share-undo aria-label="Undo changes">↶</button></div>
        <div class="pbb-share-studio__top-group"><button type="button" class="pbb-share-studio__icon" data-share-download aria-label="Save image">↓</button><button type="button" class="pbb-share-studio__done" data-share-done>Next</button></div>
      </div>
      <div class="pbb-share-studio__stage" data-share-stage>
        <img class="pbb-share-studio__photo" data-share-image alt="Your share preview">
        <div class="pbb-share-studio__caption" data-share-caption data-style="plain"></div>
        <div class="pbb-share-studio__loading" data-share-loading hidden>Updating preview...</div>
      </div>
      <div class="pbb-share-studio__tools">
        <aside class="pbb-share-studio__tool-rail" aria-label="Photo editing tools">
          <button type="button" class="pbb-share-studio__tool" data-share-text-toggle aria-expanded="false" aria-controls="pbb-share-text-panel"><strong>Aa</strong><span>Text</span></button>
          <button type="button" class="pbb-share-studio__tool" data-share-toggle-pb aria-pressed="true"><strong>★</strong><span>PB</span></button>
          <button type="button" class="pbb-share-studio__tool" data-share-toggle-stats aria-pressed="true"><strong>▥</strong><span>Stats</span></button>
          <button type="button" class="pbb-share-studio__tool" data-share-cycle-layout><strong>▤</strong><span>Layout</span></button>
        </aside>
        <div id="pbb-share-text-panel" class="pbb-share-studio__text-panel" data-share-text-panel hidden>
          <div class="pbb-share-studio__panel-head"><label class="pbb-share-studio__label" for="pbb-share-caption-input">Add text</label><button type="button" class="pbb-share-studio__panel-done" data-share-text-done>Done</button></div>
          <textarea id="pbb-share-caption-input" class="pbb-share-studio__input" data-share-input rows="1" maxlength="120" placeholder="Type your caption..."></textarea>
          <div class="pbb-share-studio__row" aria-label="Text style and position">
            <button type="button" class="pbb-share-studio__chip is-active" data-caption-style="plain">Plain</button>
            <button type="button" class="pbb-share-studio__chip" data-caption-style="label">Label</button>
            <button type="button" class="pbb-share-studio__chip" data-caption-style="gold">Gold</button>
            <button type="button" class="pbb-share-studio__chip" data-caption-position="top">Top</button>
            <button type="button" class="pbb-share-studio__chip" data-caption-position="middle">Middle</button>
            <button type="button" class="pbb-share-studio__chip" data-caption-position="bottom">Bottom</button>
          </div>
        </div>
        <div class="pbb-share-studio__bottom">
          <div class="pbb-share-studio__style-row" aria-label="Share design style">
            <button type="button" class="pbb-share-studio__style" data-share-preset="gold" aria-pressed="true">Gold</button>
            <button type="button" class="pbb-share-studio__style" data-share-preset="cream" aria-pressed="false">Cream</button>
            <button type="button" class="pbb-share-studio__style" data-share-preset="minimal" aria-pressed="false">Minimal</button>
          </div>
          <div class="pbb-share-studio__actions" data-share-actions>
            <button type="button" class="pbb-share-studio__action" data-share-feed>Community</button>
            <button type="button" class="pbb-share-studio__action" data-share-instagram>Story</button>
            <button type="button" class="pbb-share-studio__action pbb-share-studio__action--share" data-share-native>Share</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    bindElement(el);
    return el;
  }

  function ensureElement() {
    ensureStyles();
    var el = document.getElementById('pbb-private-share-studio-v3');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'pbb-private-share-studio-v3';
    el.className = 'pbb-share-studio';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Edit your share photo');
    el.innerHTML = `
      <div class="pbb-share-studio__stage" data-share-stage>
        <img class="pbb-share-studio__photo" data-share-image alt="Your share photo">
        <div class="pbb-share-studio__shade" data-share-shade></div>
        <div class="pbb-share-studio__brand" data-share-brand><span class="pbb-share-studio__brand-mark">和</span><span><strong>BALANCE</strong><small>SHOW UP. KEEP THE RECEIPTS.</small></span></div>
        <div class="pbb-share-studio__layer pbb-share-studio__workout" data-share-workout-layer>
          <div class="pbb-share-studio__workout-kicker" data-share-kicker>WORKOUT COMPLETE</div>
          <div class="pbb-share-studio__workout-title" data-share-title>WORKOUT</div>
          <div class="pbb-share-studio__metrics" data-share-metrics></div>
          <div class="pbb-share-studio__lifts" data-share-lifts></div>
        </div>
        <div class="pbb-share-studio__layer pbb-share-studio__caption" data-share-caption data-style="plain"></div>
        <div data-share-stickers></div>
      </div>
      <div class="pbb-share-studio__top">
        <div class="pbb-share-studio__top-group"><button type="button" class="pbb-share-studio__top-button" data-share-close aria-label="Close editor">${svgIcon('close')}</button><button type="button" class="pbb-share-studio__top-button" data-share-undo aria-label="Undo changes">${svgIcon('undo')}</button></div>
        <div class="pbb-share-studio__top-group"><button type="button" class="pbb-share-studio__top-button" data-share-download>${svgIcon('save')}<span>Save</span></button><button type="button" class="pbb-share-studio__top-button pbb-share-studio__next" data-share-done>Next</button></div>
      </div>
      <aside class="pbb-share-studio__rail" aria-label="Editing tools">
        <button type="button" class="pbb-share-studio__tool" data-share-tool="adjust">${svgIcon('adjust')}<span>Photo</span></button>
        <button type="button" class="pbb-share-studio__tool" data-share-tool="workout">${svgIcon('workout')}<span data-share-layer-label>Workout</span></button>
      </aside>
      <section class="pbb-share-studio__drawer" data-share-drawer hidden></section>
      <div class="pbb-share-studio__actions" data-share-actions>
        <button type="button" class="pbb-share-studio__action" data-share-feed>Community</button>
        <button type="button" class="pbb-share-studio__action" data-share-instagram>IG Story</button>
        <button type="button" class="pbb-share-studio__action pbb-share-studio__action--gold" data-share-native>Share</button>
      </div>
      <div class="pbb-share-studio__loading" data-share-loading hidden>Making your photo…</div>`;
    document.body.appendChild(el);
    bindElement(el);
    return el;
  }

  function customizationLegacy() {
    if (!active) return null;
    return {
      caption: active.caption || '',
      captionStyle: active.captionStyle || 'plain',
      captionX: active.captionX == null ? 0.5 : active.captionX,
      captionY: active.captionY == null ? 0.22 : active.captionY,
      overlayStyle: active.overlayStyle || 'gold',
      textStyle: active.textStyle || 'bold',
      editorPreset: active.editorPreset || 'gold',
      showPB: active.showPB !== false,
      showStats: active.showStats !== false
    };
  }

  function saveCustomizationLegacy() {
    if (!active) return;
    window.__balanceShareStudioCustomizations = window.__balanceShareStudioCustomizations || {};
    window.__balanceShareStudioCustomizations[active.context] = customization();
  }

  function renderCaptionOverlayLegacy(el) {
    if (!active) return;
    var caption = el.querySelector('[data-share-caption]');
    caption.textContent = active.caption || '';
    caption.dataset.style = active.captionStyle || 'plain';
    caption.style.left = Math.round(active.captionX * 100) + '%';
    caption.style.top = Math.round(active.captionY * 100) + '%';
    el.querySelectorAll('[data-caption-style]').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.captionStyle === active.captionStyle);
    });
    saveCustomization();
  }

  function syncEditorControlsLegacy(el) {
    if (!active) return;
    el.querySelectorAll('[data-share-preset]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.sharePreset === active.editorPreset ? 'true' : 'false');
    });
    var pbButton = el.querySelector('[data-share-toggle-pb]');
    var statsButton = el.querySelector('[data-share-toggle-stats]');
    var layoutButton = el.querySelector('[data-share-cycle-layout]');
    var styleRow = el.querySelector('.pbb-share-studio__style-row');
    var workoutTools = active.context === 'workout';
    var designedCard = !active.rawPhoto && !!active.cardPayload;
    pbButton.style.display = workoutTools ? '' : 'none';
    statsButton.style.display = workoutTools ? '' : 'none';
    layoutButton.style.display = designedCard ? '' : 'none';
    styleRow.style.display = designedCard ? 'flex' : 'none';
    pbButton.setAttribute('aria-pressed', active.showPB === false ? 'false' : 'true');
    statsButton.setAttribute('aria-pressed', active.showStats === false ? 'false' : 'true');
  }

  async function renderPreviewLegacy(el) {
    if (!active) return;
    var sequence = ++renderSequence;
    var loading = el.querySelector('[data-share-loading]');
    loading.hidden = false;
    try {
      var output = active.photoDataUrl;
      if (!active.rawPhoto && active.cardPayload && typeof window.renderBalanceShareCardImage === 'function') {
        var previewPayload = Object.assign({}, active.cardPayload);
        if (active.showPB === false) {
          previewPayload.pbs = null;
          previewPayload.improvement = null;
          previewPayload.exercises = (previewPayload.exercises || []).map(function (exercise) {
            return Object.assign({}, exercise, {
              has_pb: false,
              set_details: (exercise.set_details || []).map(function (set) { return Object.assign({}, set, { is_pb: false }); })
            });
          });
        }
        previewPayload.studio_hide_stats = active.showStats === false;
        output = await window.renderBalanceShareCardImage(previewPayload, {
          target: active.previewTarget || 'story',
          photoDataUrl: active.photoDataUrl,
          overlayStyle: active.overlayStyle || 'gold',
          textStyle: active.textStyle || 'bold',
          suppressCustomCaption: true
        });
      }
      if (sequence === renderSequence && active) {
        active.renderedDataUrl = output;
        el.querySelector('[data-share-image]').src = output;
      }
      return output;
    } catch (error) {
      console.warn('Could not update private share studio preview:', error);
      if (active) el.querySelector('[data-share-image]').src = active.photoDataUrl;
    } finally {
      if (sequence === renderSequence) loading.hidden = true;
    }
  }

  function schedulePreviewLegacy(el) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { renderPreview(el); }, 90);
  }

  function editorState() {
    if (!active) return null;
    return {
      version: 3,
      filter: active.filter || 'original',
      photoScale: clamp(active.photoScale || 1, .72, 2.4),
      photoX: clamp(active.photoX || 0, -.45, .45),
      photoY: clamp(active.photoY || 0, -.45, .45),
      overlayX: clamp(active.overlayX == null ? .5 : active.overlayX, .08, .92),
      overlayY: clamp(active.overlayY == null ? .68 : active.overlayY, .16, .88),
      overlayScale: clamp(active.overlayScale || 1, .5, 1.55),
      caption: active.caption || '',
      captionStyle: active.captionStyle || 'plain',
      captionFont: active.captionFont || 'strong',
      captionColour: active.captionColour || '#ffffff',
      captionAlign: active.captionAlign || 'center',
      captionSize: clamp(active.captionSize || 1, .65, 1.65),
      captionX: clamp(active.captionX == null ? .5 : active.captionX, .08, .92),
      captionY: clamp(active.captionY == null ? .26 : active.captionY, .1, .9),
      stickers: (active.stickers || []).map(function (sticker) {
        return { id: sticker.id, emoji: sticker.emoji, x: sticker.x, y: sticker.y, scale: sticker.scale || 1, rotation: sticker.rotation || 0 };
      }),
      overlayStyle: active.overlayStyle || 'gold',
      textStyle: active.textStyle || 'bold',
      editorPreset: active.editorPreset || 'gold',
      showPB: active.showPB !== false,
      showStats: active.showStats !== false
    };
  }

  function customization() { return editorState(); }

  function saveCustomization() {
    if (!active) return;
    window.__balanceShareStudioCustomizations = window.__balanceShareStudioCustomizations || {};
    window.__balanceShareStudioCustomizations[active.context] = editorState();
    if (active.cardPayload) active.cardPayload.studio_editor = editorState();
    active.renderedDataUrl = '';
  }

  function filterById(id) {
    return FILTERS.find(function (filter) { return filter.id === id; }) || FILTERS[0];
  }

  function photoTransform() {
    return 'translate(' + Math.round(active.photoX * 100) + '%, ' + Math.round(active.photoY * 100) + '%) scale(' + active.photoScale + ')';
  }

  function layerTransform(x, y, scale) {
    return 'translate(-50%,-50%) scale(' + scale + ')';
  }

  function metricValues() {
    var payload = active && active.cardPayload || {};
    var context = active && active.context || 'workout';
    if (context === 'workout') return [
      [payload.duration || '00:00', 'DURATION'],
      [String(payload.total_sets || 0), 'SETS'],
      [String(payload.total_volume || '—'), 'VOLUME']
    ];
    if (context === 'activity') return [[payload.duration || '—', 'DURATION'], [String(payload.calories || '—'), 'KCAL'], [String(payload.distance_km || payload.intensity || '—'), payload.distance_km ? 'KM' : 'INTENSITY']];
    if (context === 'meal' || context === 'nutrition') return [[String(payload.calories || payload.total_calories || '—'), 'CALORIES'], [String(payload.protein || '—'), 'PROTEIN'], [String(payload.meal_count || 1), 'MEALS']];
    return [['BALANCE', 'PROGRESS'], ['SHOW UP', 'TODAY'], ['KEEP IT', 'REAL']];
  }

  function titleValues() {
    var payload = active && active.cardPayload || {};
    var context = active && active.context || 'feed';
    if (context === 'workout') return ['WORKOUT COMPLETE', payload.workout_name || 'WORKOUT'];
    if (context === 'activity') return ['ACTIVITY COMPLETE', payload.activity_label || 'ACTIVITY'];
    if (context === 'meal') return ['MEAL LOGGED', payload.title || payload.meal_name || 'MEAL'];
    if (context === 'nutrition') return ['NUTRITION CHECK-IN', payload.title || 'TODAY'];
    if (context === 'progress_photo') return ['PROGRESS', payload.title || 'CHECK-IN'];
    return ['BALANCE', payload.title || 'YOUR UPDATE'];
  }

  function renderLayers(el) {
    if (!active) return;
    var photo = el.querySelector('[data-share-image]');
    photo.src = active.photoDataUrl;
    photo.style.transform = photoTransform();
    photo.style.filter = filterById(active.filter).css;
    var titles = titleValues();
    var card = el.querySelector('[data-share-workout-layer]');
    card.dataset.layout = active.textStyle === 'full' ? 'receipt' : active.textStyle;
    card.style.left = Math.round(active.overlayX * 100) + '%';
    card.style.top = Math.round(active.overlayY * 100) + '%';
    card.style.transform = layerTransform(active.overlayX, active.overlayY, active.overlayScale);
    card.querySelector('[data-share-kicker]').textContent = titles[0];
    card.querySelector('[data-share-title]').textContent = titles[1];
    card.querySelector('[data-share-metrics]').innerHTML = active.showStats === false ? '' : metricValues().map(function (metric) { return '<div class="pbb-share-studio__metric"><strong></strong><small></small></div>'; }).join('');
    card.querySelectorAll('.pbb-share-studio__metric').forEach(function (node, index) {
      node.querySelector('strong').textContent = metricValues()[index][0];
      node.querySelector('small').textContent = metricValues()[index][1];
    });
    var lifts = card.querySelector('[data-share-lifts]');
    lifts.innerHTML = active.textStyle === 'full' ? (active.cardPayload && active.cardPayload.exercises || []).slice(0, 3).map(function (exercise) {
      var details = (exercise.set_details || []).slice(0, 3).map(function (set) { return String(set.reps || 0) + '×' + String(set.kg != null ? set.kg : set.weight_kg || 0) + 'kg'; }).join(' · ');
      return '<div><strong></strong><span></span></div>';
    }).join('') : '';
    if (active.textStyle === 'full') lifts.querySelectorAll('div').forEach(function (row, index) { var exercise = (active.cardPayload.exercises || [])[index] || {}; var details = (exercise.set_details || []).slice(0, 3).map(function (set) { return String(set.reps || 0) + '×' + String(set.kg != null ? set.kg : set.weight_kg || 0) + 'kg'; }).join(' · '); row.querySelector('strong').textContent = exercise.name || 'Exercise'; row.querySelector('span').textContent = details; });
    card.style.display = active.rawPhoto && active.context === 'feed' ? 'none' : '';
    var caption = el.querySelector('[data-share-caption]');
    caption.textContent = active.caption || '';
    caption.dataset.style = active.captionStyle;
    caption.style.left = Math.round(active.captionX * 100) + '%';
    caption.style.top = Math.round(active.captionY * 100) + '%';
    caption.style.transform = layerTransform(active.captionX, active.captionY, active.captionSize);
    caption.style.color = active.captionColour;
    caption.style.webkitTextFillColor = active.captionColour;
    caption.style.textAlign = active.captionAlign;
    caption.style.fontFamily = active.captionFont === 'serif' ? 'Georgia,serif' : active.captionFont === 'mono' ? 'ui-monospace,monospace' : 'Inter,Arial,sans-serif';
    caption.style.fontWeight = active.captionFont === 'modern' ? '650' : '900';
    var stickerHost = el.querySelector('[data-share-stickers]');
    stickerHost.innerHTML = '';
    (active.stickers || []).forEach(function (sticker) {
      var node = document.createElement('div');
      node.className = 'pbb-share-studio__layer pbb-share-studio__sticker' + (active.selectedSticker === sticker.id ? ' is-selected' : '');
      node.dataset.stickerId = sticker.id;
      node.style.left = Math.round(sticker.x * 100) + '%';
      node.style.top = Math.round(sticker.y * 100) + '%';
      node.style.transform = 'translate(-50%,-50%) scale(' + (sticker.scale || 1) + ') rotate(' + (sticker.rotation || 0) + 'deg)';
      node.innerHTML = '<span data-sticker-handle></span><button type="button" class="pbb-share-studio__delete-sticker" data-delete-sticker aria-label="Delete sticker">×</button>';
      node.querySelector('[data-sticker-handle]').textContent = sticker.emoji;
      stickerHost.appendChild(node);
    });
    el.querySelector('[data-share-shade]').style.display = active.rawPhoto && active.context === 'feed' ? 'none' : '';
    el.querySelector('[data-share-brand]').style.display = active.rawPhoto && active.context === 'feed' ? 'none' : '';
    saveCustomization();
  }

  function renderPreview(el) {
    renderLayers(el);
    return Promise.resolve(active && active.photoDataUrl);
  }

  function schedulePreview(el) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { renderLayers(el); }, 16);
  }

  function filterDrawer(el) {
    return '<div class="pbb-share-studio__drawer-head"><span class="pbb-share-studio__drawer-title">Swipe or choose a filter</span><button class="pbb-share-studio__drawer-done" data-drawer-close>Done</button></div><div class="pbb-share-studio__scroll-row">' + FILTERS.map(function (filter) {
      return '<button type="button" class="pbb-share-studio__filter' + (active.filter === filter.id ? ' is-active' : '') + '" data-filter="' + filter.id + '"><span class="pbb-share-studio__filter-preview" style="background-image:url(&quot;' + active.photoDataUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '&quot;);filter:' + filter.css + '"></span><span>' + filter.label + '</span></button>';
    }).join('') + '</div><p class="pbb-share-studio__hint">Quickly swipe the photo left or right to move through these filters.</p>';
  }

  function textDrawer() {
    return '<div class="pbb-share-studio__drawer-head"><span class="pbb-share-studio__drawer-title">Add your text</span><button class="pbb-share-studio__drawer-done" data-drawer-close>Done</button></div>' +
      '<textarea class="pbb-share-studio__input" data-share-input maxlength="140" placeholder="Type something…"></textarea>' +
      '<div class="pbb-share-studio__chip-row"><button class="pbb-share-studio__chip" data-text-style="plain">Plain</button><button class="pbb-share-studio__chip" data-text-style="label">Label</button><button class="pbb-share-studio__chip" data-text-style="gold">Gold</button><button class="pbb-share-studio__chip" data-text-font="strong">Strong</button><button class="pbb-share-studio__chip" data-text-font="modern">Modern</button><button class="pbb-share-studio__chip" data-text-font="serif">Serif</button><button class="pbb-share-studio__chip" data-text-font="mono">Mono</button></div>' +
      '<div class="pbb-share-studio__chip-row"><button class="pbb-share-studio__colour" style="background:#fff" data-text-colour="#ffffff" aria-label="White text"></button><button class="pbb-share-studio__colour" style="background:#111" data-text-colour="#111111" aria-label="Black text"></button><button class="pbb-share-studio__colour" style="background:#d8b25e" data-text-colour="#d8b25e" aria-label="Gold text"></button><button class="pbb-share-studio__colour" style="background:#f8f5ee" data-text-colour="#f8f5ee" aria-label="Cream text"></button><button class="pbb-share-studio__chip" data-text-align="left">Left</button><button class="pbb-share-studio__chip" data-text-align="center">Centre</button><button class="pbb-share-studio__chip" data-text-align="right">Right</button></div>' +
      '<label class="pbb-share-studio__range-row"><span>Size</span><input class="pbb-share-studio__range" data-text-size type="range" min="65" max="165" value="' + Math.round(active.captionSize * 100) + '"><output>' + Math.round(active.captionSize * 100) + '%</output></label><p class="pbb-share-studio__hint">Drag the text anywhere on the photo. Pinch it with two fingers to resize.</p>';
  }

  function stickerDrawer() {
    return '<div class="pbb-share-studio__drawer-head"><span class="pbb-share-studio__drawer-title">Stickers and emoji</span><button class="pbb-share-studio__drawer-done" data-drawer-close>Done</button></div><div class="pbb-share-studio__scroll-row">' + EMOJIS.map(function (emoji) { return '<button type="button" class="pbb-share-studio__emoji" data-add-emoji="' + emoji + '">' + emoji + '</button>'; }).join('') + '</div><p class="pbb-share-studio__hint">Tap to add one, then drag it anywhere. Pinch to resize. Tap × to remove it.</p>';
  }

  function adjustDrawer() {
    return '<div class="pbb-share-studio__drawer-head"><span class="pbb-share-studio__drawer-title">Move and resize photo</span><button class="pbb-share-studio__drawer-done" data-drawer-close>Done</button></div><label class="pbb-share-studio__range-row"><span>Zoom</span><input class="pbb-share-studio__range" data-photo-scale type="range" min="72" max="240" value="' + Math.round(active.photoScale * 100) + '"><output>' + Math.round(active.photoScale * 100) + '%</output></label><div class="pbb-share-studio__chip-row"><button class="pbb-share-studio__chip" data-photo-reset>Reset photo</button><button class="pbb-share-studio__chip" data-photo-fit>Fit smaller</button></div><p class="pbb-share-studio__hint">Drag the photo to reframe it. Pinch with two fingers to zoom in or out.</p>';
  }

  function workoutDrawer() {
    return '<div class="pbb-share-studio__drawer-head"><span class="pbb-share-studio__drawer-title">Design your ' + (active.context === 'workout' ? 'workout' : 'share card') + '</span><button class="pbb-share-studio__drawer-done" data-drawer-close>Done</button></div><div class="pbb-share-studio__chip-row"><button class="pbb-share-studio__chip" data-card-layout="bold">Bold</button><button class="pbb-share-studio__chip" data-card-layout="scorecard">Scorecard</button><button class="pbb-share-studio__chip" data-card-layout="simple">Title only</button><button class="pbb-share-studio__chip" data-card-layout="full">Full workout</button></div><label class="pbb-share-studio__range-row"><span>Size</span><input class="pbb-share-studio__range" data-overlay-scale type="range" min="50" max="155" value="' + Math.round(active.overlayScale * 100) + '"><output>' + Math.round(active.overlayScale * 100) + '%</output></label><div class="pbb-share-studio__chip-row"><button class="pbb-share-studio__chip" data-toggle-stats>' + (active.showStats === false ? 'Show stats' : 'Hide stats') + '</button>' + (active.context === 'workout' ? '<button class="pbb-share-studio__chip" data-toggle-pb>' + (active.showPB === false ? 'Show PBs' : 'Hide PBs') + '</button>' : '') + '<button class="pbb-share-studio__chip" data-card-theme="gold">Gold</button><button class="pbb-share-studio__chip" data-card-theme="cream">Cream</button><button class="pbb-share-studio__chip" data-card-theme="minimal">Minimal</button></div><p class="pbb-share-studio__hint">Drag the whole workout card anywhere on the photo. Pinch it with two fingers to resize.</p>';
  }

  function openDrawer(tool, el) {
    if (!active) return;
    active.activeTool = tool;
    var drawer = el.querySelector('[data-share-drawer]');
    var makers = { filters: filterDrawer, text: textDrawer, stickers: stickerDrawer, adjust: adjustDrawer, workout: workoutDrawer };
    drawer.innerHTML = makers[tool] ? makers[tool](el) : '';
    drawer.hidden = !makers[tool];
    el.querySelectorAll('[data-share-tool]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.shareTool === tool); });
    bindDrawer(el);
  }

  function closeDrawer(el) {
    active.activeTool = 'photo';
    el.querySelector('[data-share-drawer]').hidden = true;
    el.querySelectorAll('[data-share-tool]').forEach(function (button) { button.classList.remove('is-active'); });
  }

  function bindDrawer(el) {
    var drawer = el.querySelector('[data-share-drawer]');
    var closeButton = drawer.querySelector('[data-drawer-close]');
    if (closeButton) closeButton.addEventListener('click', function () { closeDrawer(el); });
    var input = drawer.querySelector('[data-share-input]');
    if (input) { input.value = active.caption; input.focus(); input.addEventListener('input', function () { active.caption = input.value; renderLayers(el); }); }
    drawer.querySelectorAll('[data-filter]').forEach(function (button) { button.addEventListener('click', function () { active.filter = button.dataset.filter; openDrawer('filters', el); renderLayers(el); }); });
    drawer.querySelectorAll('[data-add-emoji]').forEach(function (button) { button.addEventListener('click', function () { var id = 'sticker-' + Date.now() + '-' + Math.round(Math.random() * 999); active.stickers.push({ id: id, emoji: button.dataset.addEmoji, x: .5, y: .42, scale: 1, rotation: 0 }); active.selectedSticker = id; renderLayers(el); }); });
    drawer.querySelectorAll('[data-text-style]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.textStyle === active.captionStyle); button.addEventListener('click', function () { active.captionStyle = button.dataset.textStyle; openDrawer('text', el); renderLayers(el); }); });
    drawer.querySelectorAll('[data-text-font]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.textFont === active.captionFont); button.addEventListener('click', function () { active.captionFont = button.dataset.textFont; openDrawer('text', el); renderLayers(el); }); });
    drawer.querySelectorAll('[data-text-colour]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.textColour === active.captionColour); button.addEventListener('click', function () { active.captionColour = button.dataset.textColour; renderLayers(el); }); });
    drawer.querySelectorAll('[data-text-align]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.textAlign === active.captionAlign); button.addEventListener('click', function () { active.captionAlign = button.dataset.textAlign; renderLayers(el); }); });
    function range(selector, key, divisor) { var control = drawer.querySelector(selector); if (!control) return; control.addEventListener('input', function () { active[key] = Number(control.value) / divisor; control.nextElementSibling.value = Math.round(active[key] * divisor) + '%'; renderLayers(el); }); }
    range('[data-text-size]', 'captionSize', 100); range('[data-photo-scale]', 'photoScale', 100); range('[data-overlay-scale]', 'overlayScale', 100);
    var reset = drawer.querySelector('[data-photo-reset]'); if (reset) reset.addEventListener('click', function () { active.photoScale = 1; active.photoX = 0; active.photoY = 0; openDrawer('adjust', el); renderLayers(el); });
    var fit = drawer.querySelector('[data-photo-fit]'); if (fit) fit.addEventListener('click', function () { active.photoScale = .78; active.photoX = 0; active.photoY = 0; openDrawer('adjust', el); renderLayers(el); });
    var stats = drawer.querySelector('[data-toggle-stats]'); if (stats) stats.addEventListener('click', function () { active.showStats = active.showStats === false; openDrawer('workout', el); renderLayers(el); });
    var pb = drawer.querySelector('[data-toggle-pb]'); if (pb) pb.addEventListener('click', function () { active.showPB = active.showPB === false; openDrawer('workout', el); renderLayers(el); });
    drawer.querySelectorAll('[data-card-layout]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.cardLayout === active.textStyle); button.addEventListener('click', function () { active.textStyle = button.dataset.cardLayout; openDrawer('workout', el); renderLayers(el); }); });
    drawer.querySelectorAll('[data-card-theme]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.cardTheme === active.editorPreset); button.addEventListener('click', function () { active.editorPreset = button.dataset.cardTheme; active.overlayStyle = active.editorPreset === 'gold' ? 'gold' : active.editorPreset === 'minimal' ? 'midnight' : 'classic'; openDrawer('workout', el); renderLayers(el); }); });
  }

  function close(result) {
    var el = document.getElementById('pbb-private-share-studio');
    if (!active) return;
    var finish = active.resolve;
    active = null;
    renderSequence += 1;
    clearTimeout(renderTimer);
    if (el) el.classList.remove('is-open');
    document.body.style.overflow = '';
    finish(result || { action: 'closed' });
  }

  function loadImage(source) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = source;
    });
  }

  async function makeRawOutputLegacy(state) {
    var image = await loadImage(state.photoDataUrl);
    var canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    var text = String(state.caption || '').trim();
    if (text) {
      var fontSize = Math.max(32, Math.round(canvas.width * 0.058));
      var lineHeight = Math.round(fontSize * 1.12);
      var maxWidth = canvas.width * 0.78;
      var lines = [];
      var line = '';
      ctx.font = '900 ' + fontSize + 'px Arial, sans-serif';
      text.split(/\s+/).filter(Boolean).forEach(function (word) {
        var candidate = line ? line + ' ' + word : word;
        if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
        else line = candidate;
      });
      if (line) lines.push(line);
      lines = lines.slice(0, 4);
      var textWidth = Math.min(maxWidth, Math.max.apply(Math, lines.map(function (value) { return ctx.measureText(value).width; }).concat([1])));
      var blockHeight = lines.length * lineHeight;
      var centerX = canvas.width * state.captionX;
      var top = Math.max(24, Math.min(canvas.height - blockHeight - 24, (canvas.height * state.captionY) - (blockHeight / 2)));
      if (state.captionStyle === 'label' || state.captionStyle === 'gold') {
        ctx.fillStyle = state.captionStyle === 'gold' ? '#e9c87e' : 'rgba(20,18,13,0.82)';
        ctx.fillRect(centerX - textWidth / 2 - 24, top - 16, textWidth + 48, blockHeight + 32);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = state.captionStyle === 'gold' ? '#241d10' : '#ffffff';
      if (state.captionStyle === 'plain') { ctx.shadowColor = 'rgba(0,0,0,0.82)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4; }
      lines.forEach(function (value, index) { ctx.fillText(value, centerX, top + index * lineHeight); });
    }
    var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    var response = await fetch(dataUrl);
    var blob = await response.blob();
    return { dataUrl: dataUrl, file: new File([blob], 'balance-share-' + Date.now() + '.jpg', { type: 'image/jpeg' }) };
  }

  function drawCoverTransformed(ctx, image, width, height, state) {
    var base = Math.max(width / image.width, height / image.height);
    var scale = base * clamp(state.photoScale || 1, .72, 2.4);
    var drawW = image.width * scale;
    var drawH = image.height * scale;
    var x = (width - drawW) / 2 + (state.photoX || 0) * width;
    var y = (height - drawH) / 2 + (state.photoY || 0) * height;
    ctx.save();
    ctx.filter = filterById(state.filter).css;
    ctx.drawImage(image, x, y, drawW, drawH);
    ctx.restore();
  }

  function drawRawCaption(ctx, width, height, state) {
    var text = String(state.caption || '').trim();
    if (!text) return;
    var fontSize = Math.round(width * .058 * clamp(state.captionSize || 1, .65, 1.65));
    var family = state.captionFont === 'serif' ? 'Georgia, serif' : state.captionFont === 'mono' ? 'monospace' : 'Arial, sans-serif';
    var weight = state.captionFont === 'modern' ? 650 : 900;
    var maxWidth = width * .78;
    var words = text.split(/\s+/).filter(Boolean), lines = [], line = '';
    ctx.save(); ctx.font = weight + ' ' + fontSize + 'px ' + family;
    words.forEach(function (word) { var next = line ? line + ' ' + word : word; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next; });
    if (line) lines.push(line); lines = lines.slice(0, 5);
    var lineHeight = fontSize * 1.1, x = width * state.captionX, top = height * state.captionY - lines.length * lineHeight / 2;
    var widest = Math.max.apply(Math, lines.map(function (value) { return ctx.measureText(value).width; }).concat([1]));
    if (state.captionStyle === 'label' || state.captionStyle === 'gold') { ctx.fillStyle = state.captionStyle === 'gold' ? '#d8b25e' : 'rgba(17,17,17,.86)'; ctx.fillRect(x - widest / 2 - 24, top - 16, widest + 48, lines.length * lineHeight + 32); }
    ctx.textAlign = state.captionAlign || 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = state.captionStyle === 'gold' ? '#111111' : (state.captionColour || '#ffffff');
    if (state.captionStyle === 'plain') { ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4; }
    lines.forEach(function (value, index) { ctx.fillText(value, x, top + index * lineHeight); }); ctx.restore();
  }

  function drawRawStickers(ctx, width, height, state) {
    (state.stickers || []).forEach(function (sticker) { ctx.save(); ctx.translate(width * sticker.x, height * sticker.y); ctx.rotate((sticker.rotation || 0) * Math.PI / 180); var size = Math.round(width * .1 * (sticker.scale || 1)); ctx.font = size + 'px Apple Color Emoji,Segoe UI Emoji,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sticker.emoji, 0, 0); ctx.restore(); });
  }

  async function makeRawOutput(state) {
    var image = await loadImage(state.photoDataUrl);
    var portrait = image.height >= image.width;
    var canvas = document.createElement('canvas');
    canvas.width = portrait ? 1080 : 1350;
    canvas.height = portrait ? 1920 : 1080;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#090909'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCoverTransformed(ctx, image, canvas.width, canvas.height, state);
    drawRawCaption(ctx, canvas.width, canvas.height, state);
    drawRawStickers(ctx, canvas.width, canvas.height, state);
    var dataUrl = canvas.toDataURL('image/jpeg', .92);
    var blob = await (await fetch(dataUrl)).blob();
    return { dataUrl: dataUrl, file: new File([blob], 'balance-share-' + Date.now() + '.jpg', { type: 'image/jpeg' }) };
  }

  async function currentRenderedFile(el) {
    if (!active) throw new Error('Share editor is closed');
    var output;
    if (active.rawPhoto || !active.cardPayload || typeof window.renderBalanceShareCardImage !== 'function') output = await makeRawOutput(active);
    else {
      saveCustomization();
      output = { dataUrl: await window.renderBalanceShareCardImage(active.cardPayload, { target: active.previewTarget || 'story', photoDataUrl: active.photoDataUrl, overlayStyle: active.overlayStyle, textStyle: active.textStyle }) };
    }
    var dataUrl = output.dataUrl;
    var response = await fetch(dataUrl);
    var blob = await response.blob();
    return { dataUrl: dataUrl, file: new File([blob], 'balance-share-' + Date.now() + '.jpg', { type: 'image/jpeg' }) };
  }

  async function downloadCurrentImage(el) {
    try {
      var output = await currentRenderedFile(el);
      var link = document.createElement('a');
      link.href = output.dataUrl;
      link.download = output.file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Could not save share image:', error);
      if (typeof window.showToast === 'function') window.showToast('Could not save that image. Please try again.', 'error');
    }
  }

  async function shareCurrentImage(el) {
    try {
      var output = await currentRenderedFile(el);
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [output.file] }))) {
        await navigator.share({ files: [output.file], title: 'Balance' });
        return;
      }
      await downloadCurrentImage(el);
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      console.error('Could not open native share:', error);
      if (typeof window.showToast === 'function') window.showToast('Could not open sharing. Please try again.', 'error');
    }
  }

  async function runAction(kind, el) {
    if (!active) return;
    var fn = kind === 'feed' ? active.onFeed : kind === 'instagram' ? active.onInstagram : active.onDone;
    if (typeof fn !== 'function') {
      close({ action: kind, customization: customization() });
      return;
    }
    el.querySelectorAll('[data-share-feed],[data-share-instagram],[data-share-done]').forEach(function (button) { button.disabled = true; });
    try {
      saveCustomization();
      var state = active;
      if (state.cardPayload) {
        state.cardPayload.studio_hide_pb = state.showPB === false;
        state.cardPayload.studio_hide_stats = state.showStats === false;
      }
      if (typeof window.selectBalanceShareOverlayStyle === 'function') {
        window.selectBalanceShareOverlayStyle(state.context, state.overlayStyle || 'gold');
      }
      if (typeof window.selectBalanceShareTextStyle === 'function') {
        window.selectBalanceShareTextStyle(state.context, state.textStyle || 'bold');
      }
      var rawOutput = state.rawPhoto ? await makeRawOutput(state) : null;
      window.dispatchEvent(new CustomEvent('pbb:share-studio-action', { detail: { context: state.context, action: kind } }));
      if (typeof window._crumb === 'function') window._crumb('private_share_studio_' + state.context + '_' + kind);
      close({ action: kind, customization: customization() });
      await fn({
        customization: window.__balanceShareStudioCustomizations[state.context],
        photoDataUrl: rawOutput ? rawOutput.dataUrl : state.photoDataUrl,
        file: rawOutput ? rawOutput.file : null
      });
    } catch (error) {
      console.error('Private share studio action failed:', error);
      if (typeof window.showToast === 'function') window.showToast('Could not share that photo. Please try again.', 'error');
    } finally {
      el.querySelectorAll('[data-share-feed],[data-share-instagram],[data-share-done]').forEach(function (button) { button.disabled = false; });
    }
  }

  function bindElementLegacy(el) {
    function setTextPanelOpen(openPanel, focusInput) {
      var panel = el.querySelector('[data-share-text-panel]');
      var toggle = el.querySelector('[data-share-text-toggle]');
      panel.hidden = !openPanel;
      toggle.classList.toggle('is-active', openPanel);
      toggle.setAttribute('aria-expanded', openPanel ? 'true' : 'false');
      if (openPanel && focusInput) {
        setTimeout(function () { el.querySelector('[data-share-input]').focus(); }, 40);
      }
    }

    el.querySelector('[data-share-close]').addEventListener('click', function () { close({ action: 'closed' }); });
    el.querySelector('[data-share-done]').addEventListener('click', function () {
      if (active && typeof active.onDone === 'function') runAction('done', el);
      else el.querySelector('[data-share-native]').focus();
    });
    el.querySelector('[data-share-undo]').addEventListener('click', function () {
      if (!active || !active.initial) return;
      Object.assign(active, active.initial);
      el.querySelector('[data-share-input]').value = active.caption || '';
      renderCaptionOverlay(el);
      syncEditorControls(el);
      schedulePreview(el);
    });
    el.querySelector('[data-share-download]').addEventListener('click', function () { downloadCurrentImage(el); });
    el.querySelector('[data-share-feed]').addEventListener('click', function () { runAction('feed', el); });
    el.querySelector('[data-share-instagram]').addEventListener('click', function () { runAction('instagram', el); });
    el.querySelector('[data-share-native]').addEventListener('click', function () { shareCurrentImage(el); });
    el.querySelector('[data-share-text-toggle]').addEventListener('click', function () {
      var panel = el.querySelector('[data-share-text-panel]');
      setTextPanelOpen(panel.hidden, panel.hidden);
    });
    el.querySelector('[data-share-text-done]').addEventListener('click', function () {
      setTextPanelOpen(false, false);
      el.querySelector('[data-share-input]').blur();
    });
    el.querySelector('[data-share-toggle-pb]').addEventListener('click', function () {
      if (!active) return;
      active.showPB = active.showPB === false;
      syncEditorControls(el);
      schedulePreview(el);
    });
    el.querySelector('[data-share-toggle-stats]').addEventListener('click', function () {
      if (!active) return;
      active.showStats = active.showStats === false;
      syncEditorControls(el);
      schedulePreview(el);
    });
    el.querySelector('[data-share-cycle-layout]').addEventListener('click', function () {
      if (!active) return;
      var layouts = active.context === 'workout' ? ['bold', 'scorecard', 'simple', 'full'] : ['bold', 'scorecard', 'simple'];
      var index = Math.max(0, layouts.indexOf(active.textStyle));
      active.textStyle = layouts[(index + 1) % layouts.length];
      schedulePreview(el);
    });
    el.querySelectorAll('[data-share-preset]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!active) return;
        active.editorPreset = button.dataset.sharePreset;
        active.overlayStyle = active.editorPreset === 'gold' ? 'gold' : active.editorPreset === 'minimal' ? 'midnight' : 'classic';
        syncEditorControls(el);
        schedulePreview(el);
      });
    });
    el.querySelector('[data-share-stage]').addEventListener('click', function (event) {
      if (event.target.matches('[data-share-stage],[data-share-image]')) setTextPanelOpen(false, false);
    });
    el.querySelector('[data-share-input]').addEventListener('input', function (event) {
      if (!active) return;
      active.caption = event.target.value;
      renderCaptionOverlay(el);
      schedulePreview(el);
    });
    el.querySelectorAll('[data-caption-style]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!active) return;
        active.captionStyle = button.dataset.captionStyle;
        renderCaptionOverlay(el);
        schedulePreview(el);
      });
    });
    el.querySelectorAll('[data-caption-position]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!active) return;
        active.captionY = button.dataset.captionPosition === 'top' ? 0.2 : button.dataset.captionPosition === 'middle' ? 0.5 : 0.8;
        renderCaptionOverlay(el);
        schedulePreview(el);
      });
    });

    var caption = el.querySelector('[data-share-caption]');
    var drag = null;
    caption.addEventListener('pointerdown', function (event) {
      if (!active) return;
      drag = { pointerId: event.pointerId };
      caption.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    caption.addEventListener('pointermove', function (event) {
      if (!active || !drag || drag.pointerId !== event.pointerId) return;
      var bounds = el.querySelector('[data-share-stage]').getBoundingClientRect();
      active.captionX = Math.max(0.1, Math.min(0.9, (event.clientX - bounds.left) / bounds.width));
      active.captionY = Math.max(0.1, Math.min(0.9, (event.clientY - bounds.top) / bounds.height));
      renderCaptionOverlay(el);
    });
    caption.addEventListener('pointerup', function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      schedulePreview(el);
    });
  }

  function bindElement(el) {
    el.querySelector('[data-share-close]').addEventListener('click', function () { close({ action: 'closed' }); });
    el.querySelector('[data-share-undo]').addEventListener('click', function () { if (!active || !active.initial) return; Object.assign(active, JSON.parse(JSON.stringify(active.initial))); closeDrawer(el); renderLayers(el); });
    el.querySelector('[data-share-download]').addEventListener('click', function () { downloadCurrentImage(el); });
    el.querySelector('[data-share-done]').addEventListener('click', function () { if (active && typeof active.onInstagram === 'function') runAction('instagram', el); else el.querySelector('[data-share-native]').focus(); });
    el.querySelector('[data-share-feed]').addEventListener('click', function () { runAction('feed', el); });
    el.querySelector('[data-share-instagram]').addEventListener('click', function () { runAction('instagram', el); });
    el.querySelector('[data-share-native]').addEventListener('click', function () { shareCurrentImage(el); });
    el.querySelectorAll('[data-share-tool]').forEach(function (button) { button.addEventListener('click', function () { openDrawer(button.dataset.shareTool, el); }); });

    var stage = el.querySelector('[data-share-stage]');
    var photoPointers = new Map();
    var photoStart = null;
    function distance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    stage.addEventListener('pointerdown', function (event) {
      if (!active || event.target.closest('.pbb-share-studio__layer') || event.target.closest('button')) return;
      stage.setPointerCapture(event.pointerId);
      photoPointers.set(event.pointerId, event);
      if (photoPointers.size === 1) photoStart = { x: event.clientX, y: event.clientY, photoX: active.photoX, photoY: active.photoY, time: Date.now() };
      if (photoPointers.size === 2) { var pair = Array.from(photoPointers.values()); photoStart = { distance: distance(pair[0], pair[1]), scale: active.photoScale, photoX: active.photoX, photoY: active.photoY }; }
      event.preventDefault();
    });
    stage.addEventListener('pointermove', function (event) {
      if (!active || !photoPointers.has(event.pointerId)) return;
      photoPointers.set(event.pointerId, event);
      var bounds = stage.getBoundingClientRect();
      if (photoPointers.size >= 2) { var pair = Array.from(photoPointers.values()); active.photoScale = clamp(photoStart.scale * distance(pair[0], pair[1]) / Math.max(20, photoStart.distance), .72, 2.4); }
      else if (photoStart && photoStart.x != null) { active.photoX = clamp(photoStart.photoX + (event.clientX - photoStart.x) / bounds.width, -.45, .45); active.photoY = clamp(photoStart.photoY + (event.clientY - photoStart.y) / bounds.height, -.45, .45); }
      renderLayers(el); event.preventDefault();
    });
    function endPhoto(event) { photoPointers.delete(event.pointerId); if (!photoPointers.size) photoStart = null; }
    stage.addEventListener('pointerup', endPhoto); stage.addEventListener('pointercancel', endPhoto);
    stage.addEventListener('wheel', function (event) { if (!active) return; active.photoScale = clamp(active.photoScale - event.deltaY * .001, .72, 2.4); renderLayers(el); event.preventDefault(); }, { passive: false });

    var layerPointers = new Map();
    var layerGesture = null;
    function layerState(node) {
      if (node.matches('[data-share-workout-layer]')) return { kind: 'overlay', x: active.overlayX, y: active.overlayY, scale: active.overlayScale };
      if (node.matches('[data-share-caption]')) return { kind: 'caption', x: active.captionX, y: active.captionY, scale: active.captionSize };
      var sticker = (active.stickers || []).find(function (item) { return item.id === node.dataset.stickerId; });
      return sticker ? { kind: 'sticker', item: sticker, x: sticker.x, y: sticker.y, scale: sticker.scale || 1 } : null;
    }
    stage.addEventListener('pointerdown', function (event) {
      var node = event.target.closest('.pbb-share-studio__layer');
      if (!active || !node) return;
      if (event.target.closest('[data-delete-sticker]')) return;
      var state = layerState(node); if (!state) return;
      node.setPointerCapture(event.pointerId); layerPointers.set(event.pointerId, { event: event, node: node });
      if (state.kind === 'sticker') active.selectedSticker = state.item.id;
      layerGesture = { node: node, state: state, startX: event.clientX, startY: event.clientY, x: state.x, y: state.y, scale: state.scale };
      var same = Array.from(layerPointers.values()).filter(function (entry) { return entry.node === node; });
      if (same.length === 2) layerGesture.distance = distance(same[0].event, same[1].event);
      renderLayers(el); event.preventDefault(); event.stopPropagation();
    });
    stage.addEventListener('pointermove', function (event) {
      var entry = layerPointers.get(event.pointerId); if (!active || !entry || !layerGesture) return;
      entry.event = event; var node = entry.node; var state = layerGesture.state; var bounds = stage.getBoundingClientRect();
      var same = Array.from(layerPointers.values()).filter(function (item) { return item.node === node; });
      if (same.length >= 2 && layerGesture.distance) state.scale = clamp(layerGesture.scale * distance(same[0].event, same[1].event) / Math.max(20, layerGesture.distance), .45, 1.8);
      else { state.x = clamp(layerGesture.x + (event.clientX - layerGesture.startX) / bounds.width, .07, .93); state.y = clamp(layerGesture.y + (event.clientY - layerGesture.startY) / bounds.height, .1, .9); }
      if (state.kind === 'overlay') { active.overlayX = state.x; active.overlayY = state.y; active.overlayScale = state.scale; }
      else if (state.kind === 'caption') { active.captionX = state.x; active.captionY = state.y; active.captionSize = state.scale; }
      else { state.item.x = state.x; state.item.y = state.y; state.item.scale = state.scale; }
      renderLayers(el); event.preventDefault(); event.stopPropagation();
    });
    function endLayer(event) { layerPointers.delete(event.pointerId); if (!layerPointers.size) layerGesture = null; }
    stage.addEventListener('pointerup', endLayer); stage.addEventListener('pointercancel', endLayer);
    stage.addEventListener('click', function (event) { var remove = event.target.closest('[data-delete-sticker]'); if (!remove || !active) return; var node = remove.closest('[data-sticker-id]'); active.stickers = active.stickers.filter(function (item) { return item.id !== node.dataset.stickerId; }); active.selectedSticker = ''; renderLayers(el); });
  }

  function openLegacy(options) {
    if (!isEnabled() || !options || !options.photoDataUrl) return Promise.resolve({ action: 'unavailable' });
    var el = ensureElement();
    if (active) close({ action: 'replaced' });
    var context = String(options.context || 'feed').toLowerCase();
    var previous = window.__balanceShareStudioCustomizations && window.__balanceShareStudioCustomizations[context] || {};
    return new Promise(function (resolve) {
      active = {
        context: context,
        photoDataUrl: options.photoDataUrl,
        cardPayload: options.cardPayload || null,
        rawPhoto: !!options.rawPhoto,
        previewTarget: options.previewTarget || 'story',
        overlayStyle: previous.overlayStyle || options.overlayStyle || 'gold',
        textStyle: previous.textStyle || options.textStyle || 'bold',
        editorPreset: previous.editorPreset || 'gold',
        showPB: previous.showPB !== false,
        showStats: previous.showStats !== false,
        caption: options.caption != null ? options.caption : (previous.caption || ''),
        captionStyle: previous.captionStyle || 'plain',
        captionX: previous.captionX == null ? 0.5 : previous.captionX,
        captionY: previous.captionY == null ? 0.22 : previous.captionY,
        onFeed: options.onFeed,
        onInstagram: options.onInstagram,
        onDone: options.onDone,
        resolve: resolve
      };
      active.initial = {
        caption: active.caption,
        captionStyle: active.captionStyle,
        captionX: active.captionX,
        captionY: active.captionY,
        overlayStyle: active.overlayStyle,
        textStyle: active.textStyle,
        editorPreset: active.editorPreset,
        showPB: active.showPB,
        showStats: active.showStats
      };
      el.querySelector('[data-share-input]').value = active.caption;
      el.querySelector('[data-share-text-panel]').hidden = true;
      el.querySelector('[data-share-text-toggle]').classList.remove('is-active');
      el.querySelector('[data-share-text-toggle]').setAttribute('aria-expanded', 'false');
      el.querySelector('[data-share-feed]').style.display = typeof active.onFeed === 'function' ? '' : 'none';
      el.querySelector('[data-share-instagram]').style.display = typeof active.onInstagram === 'function' ? '' : 'none';
      el.querySelector('[data-share-done]').hidden = false;
      el.querySelector('[data-share-actions]').style.display = 'grid';
      el.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      renderCaptionOverlay(el);
      syncEditorControls(el);
      renderPreview(el);
      if (typeof window.pushNavigationState === 'function') {
        try { window.pushNavigationState('private-share-studio', function () { close({ action: 'closed' }); }); } catch (_) {}
      }
      if (typeof window.enableSwipeBackNavigation === 'function') {
        try { window.enableSwipeBackNavigation('pbb-private-share-studio', function () { close({ action: 'closed' }); }); } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent('pbb:share-studio-opened', { detail: { context: context } }));
      if (typeof window._crumb === 'function') window._crumb('private_share_studio_' + context + '_opened');
    });
  }

  function open(options) {
    if (!isEnabled() || !options || !options.photoDataUrl) return Promise.resolve({ action: 'unavailable' });
    var el = ensureElement();
    if (active) close({ action: 'replaced' });
    var context = String(options.context || 'feed').toLowerCase();
    var previous = window.__balanceShareStudioCustomizations && window.__balanceShareStudioCustomizations[context] || {};
    return new Promise(function (resolve) {
      active = {
        context: context,
        photoDataUrl: options.photoDataUrl,
        cardPayload: options.cardPayload || null,
        rawPhoto: !!options.rawPhoto,
        previewTarget: options.previewTarget || 'story',
        photoScale: 1,
        photoX: 0,
        photoY: 0,
        filter: 'original',
        overlayX: previous.overlayX == null ? .5 : previous.overlayX,
        overlayY: previous.overlayY == null ? .68 : previous.overlayY,
        overlayScale: previous.overlayScale || 1,
        overlayStyle: previous.overlayStyle || options.overlayStyle || 'gold',
        textStyle: previous.textStyle || options.textStyle || 'bold',
        editorPreset: previous.editorPreset || 'gold',
        showPB: previous.showPB !== false,
        showStats: previous.showStats !== false,
        caption: '', captionStyle: 'plain', captionFont: 'strong', captionColour: '#ffffff', captionAlign: 'center', captionSize: 1, captionX: .5, captionY: .26,
        stickers: [], selectedSticker: '', activeTool: 'photo',
        onFeed: options.onFeed, onInstagram: options.onInstagram, onDone: options.onDone, resolve: resolve
      };
      active.initial = JSON.parse(JSON.stringify(editorState()));
      el.querySelector('[data-share-drawer]').hidden = true;
      el.querySelectorAll('[data-share-tool]').forEach(function (button) { button.classList.remove('is-active'); });
      var names = { workout: 'Workout', activity: 'Activity', meal: 'Meal', nutrition: 'Nutrition', progress_photo: 'Progress', feed: 'Photo' };
      el.querySelector('[data-share-layer-label]').textContent = names[context] || 'Card';
      el.querySelector('[data-share-feed]').style.display = typeof active.onFeed === 'function' ? '' : 'none';
      el.querySelector('[data-share-instagram]').style.display = typeof active.onInstagram === 'function' ? '' : 'none';
      el.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      renderLayers(el);
      if (typeof window.pushNavigationState === 'function') { try { window.pushNavigationState('private-share-studio', function () { close({ action: 'closed' }); }); } catch (_) {} }
      if (typeof window.enableSwipeBackNavigation === 'function') { try { window.enableSwipeBackNavigation('pbb-private-share-studio-v3', function () { close({ action: 'closed' }); }); } catch (_) {} }
      window.dispatchEvent(new CustomEvent('pbb:share-studio-opened', { detail: { context: context } }));
      if (typeof window._crumb === 'function') window._crumb('private_share_studio_' + context + '_opened');
    });
  }

  function choosePhoto(options) {
    options = options || {};
    var existing = document.getElementById('pbb-private-photo-source');
    if (existing) existing.remove();
    ensureStyles();
    var sheet = document.createElement('div');
    sheet.id = 'pbb-private-photo-source';
    sheet.className = 'pbb-photo-source';
    sheet.innerHTML = '<div class="pbb-photo-source__card" role="dialog" aria-modal="true" aria-label="Choose a photo source">' +
      '<div class="pbb-photo-source__title">Share a photo</div>' +
      '<div class="pbb-photo-source__copy">Take one now or choose one you already love.</div>' +
      '<button type="button" class="pbb-photo-source__button" data-source-camera>Take a photo</button>' +
      '<button type="button" class="pbb-photo-source__button pbb-photo-source__button--gold" data-source-gallery>Choose from photos</button>' +
      '<button type="button" class="pbb-photo-source__button pbb-photo-source__button--cancel" data-source-cancel>Cancel</button></div>';
    function finish(callback) { sheet.remove(); if (typeof callback === 'function') callback(); }
    sheet.querySelector('[data-source-camera]').addEventListener('click', function () { finish(options.onCamera); });
    sheet.querySelector('[data-source-gallery]').addEventListener('click', function () { finish(options.onGallery); });
    sheet.querySelector('[data-source-cancel]').addEventListener('click', function () { finish(options.onCancel); });
    sheet.addEventListener('click', function (event) { if (event.target === sheet) finish(options.onCancel); });
    document.body.appendChild(sheet);
  }

  window.BalancePrivateShareStudio = {
    isEnabled: isEnabled,
    open: open,
    choosePhoto: choosePhoto,
    renderWorkoutCompletePage: renderWorkoutCompletePage,
    close: close,
    pilotEmail: PILOT_EMAIL
  };
})();
