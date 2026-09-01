(function () {
  'use strict';

  var PILOT_EMAIL = 'shannonbirch@cocospersonaltraining.com';
  var active = null;
  var renderTimer = null;
  var renderSequence = 0;

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

  function ensureStyles() {
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

  function ensureElement() {
    ensureStyles();
    var el = document.getElementById('pbb-private-share-studio');
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

  function customization() {
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

  function saveCustomization() {
    if (!active) return;
    window.__balanceShareStudioCustomizations = window.__balanceShareStudioCustomizations || {};
    window.__balanceShareStudioCustomizations[active.context] = customization();
  }

  function renderCaptionOverlay(el) {
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

  function syncEditorControls(el) {
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

  async function renderPreview(el) {
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

  function schedulePreview(el) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { renderPreview(el); }, 90);
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

  async function makeRawOutput(state) {
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

  async function currentRenderedFile(el) {
    if (!active) throw new Error('Share editor is closed');
    var dataUrl = active.renderedDataUrl || await renderPreview(el) || active.photoDataUrl;
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

  function bindElement(el) {
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
