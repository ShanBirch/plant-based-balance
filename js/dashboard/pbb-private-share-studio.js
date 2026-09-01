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

  function ensureStyles() {
    if (document.getElementById('pbb-private-share-studio-styles')) return;
    var style = document.createElement('style');
    style.id = 'pbb-private-share-studio-styles';
    style.textContent = `
      .pbb-share-studio{position:fixed;inset:0;z-index:100120;display:none;flex-direction:column;overflow:hidden;background:#14120d;color:#fff;-webkit-text-fill-color:currentColor;font-family:inherit;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}
      .pbb-share-studio.is-open{display:flex}.pbb-share-studio *{box-sizing:border-box}.pbb-share-studio__top{height:58px;flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(20,18,13,.94);border-bottom:1px solid rgba(233,200,126,.18)}
      .pbb-share-studio__top-title{font-weight:850;font-size:.96rem;letter-spacing:.01em}.pbb-share-studio__icon{width:40px;height:40px;border:0;border-radius:999px;background:rgba(255,255,255,.1);color:#fff;font-size:1.25rem;display:grid;place-items:center;cursor:pointer}.pbb-share-studio__done{border:0;border-radius:999px;background:#e9c87e;color:#241d10;padding:10px 16px;font:inherit;font-size:.84rem;font-weight:900;cursor:pointer}
      .pbb-share-studio__stage{position:relative;min-height:0;flex:1;display:grid;place-items:center;overflow:hidden;background:#090807;touch-action:none}.pbb-share-studio__photo{display:block;width:100%;height:100%;object-fit:contain;background:#090807}.pbb-share-studio__loading{position:absolute;inset:0;display:grid;place-items:center;background:rgba(9,8,7,.2);font-size:.82rem;font-weight:800;pointer-events:none}.pbb-share-studio__loading[hidden]{display:none}
      .pbb-share-studio__caption{position:absolute;left:50%;top:22%;max-width:86%;transform:translate(-50%,-50%);padding:5px 9px;border-radius:8px;color:#fff;-webkit-text-fill-color:#fff;text-align:center;font-size:clamp(1.15rem,5vw,2rem);line-height:1.08;font-weight:900;white-space:pre-wrap;overflow-wrap:anywhere;text-shadow:0 2px 10px rgba(0,0,0,.82);cursor:grab;touch-action:none;user-select:none}.pbb-share-studio__caption[data-style="label"]{background:rgba(20,18,13,.78);padding:9px 13px;text-shadow:none}.pbb-share-studio__caption[data-style="gold"]{background:#e9c87e;color:#241d10;-webkit-text-fill-color:#241d10;text-shadow:none}.pbb-share-studio__caption:empty{display:none}
      .pbb-share-studio__tools{flex:0 0 auto;max-height:42dvh;overflow:auto;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:#f7f0df;color:#241d10;-webkit-text-fill-color:currentColor;border-top:1px solid rgba(36,29,16,.14)}
      .pbb-share-studio__label{display:block;margin:0 0 6px;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#6f5a2c}.pbb-share-studio__input{width:100%;min-height:46px;resize:none;border:1px solid #ccb678;border-radius:13px;background:#fffdf7;color:#241d10;-webkit-text-fill-color:#241d10;padding:12px;font:inherit;font-size:.94rem;outline:none}.pbb-share-studio__input:focus{border-color:#9a7429;box-shadow:0 0 0 3px rgba(154,116,41,.15)}
      .pbb-share-studio__row{display:flex;gap:8px;overflow-x:auto;padding-top:10px;scrollbar-width:none}.pbb-share-studio__row::-webkit-scrollbar{display:none}.pbb-share-studio__chip{flex:0 0 auto;border:1px solid #ccb678;border-radius:999px;background:#fffaf0;color:#493916;-webkit-text-fill-color:#493916;padding:9px 13px;font:inherit;font-size:.78rem;font-weight:850;cursor:pointer}.pbb-share-studio__chip.is-active{background:#2f4a3d;border-color:#2f4a3d;color:#fff;-webkit-text-fill-color:#fff}.pbb-share-studio__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}.pbb-share-studio__action{min-height:47px;border:0;border-radius:14px;background:#2f4a3d;color:#fff;-webkit-text-fill-color:#fff;font:inherit;font-weight:900;cursor:pointer}.pbb-share-studio__action--ig{background:#e9c87e;color:#241d10;-webkit-text-fill-color:#241d10}.pbb-share-studio__action:disabled{opacity:.55;cursor:wait}
      .pbb-photo-source{position:fixed;inset:0;z-index:100119;display:grid;align-items:end;background:rgba(15,12,7,.55);padding:18px;padding-bottom:calc(18px + env(safe-area-inset-bottom))}.pbb-photo-source__card{width:min(100%,480px);margin:0 auto;background:#fff8e8;color:#241d10;-webkit-text-fill-color:#241d10;border:1px solid #e1c983;border-radius:22px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.pbb-photo-source__title{font-size:1.05rem;font-weight:900;margin-bottom:4px}.pbb-photo-source__copy{font-size:.82rem;color:#6f5a2c;margin-bottom:14px}.pbb-photo-source__button{width:100%;min-height:50px;border:0;border-radius:14px;background:#2f4a3d;color:#fff;-webkit-text-fill-color:#fff;font:inherit;font-weight:900;margin-top:8px}.pbb-photo-source__button--gold{background:#e9c87e;color:#241d10;-webkit-text-fill-color:#241d10}.pbb-photo-source__button--cancel{background:transparent;color:#6f5a2c;-webkit-text-fill-color:#6f5a2c;border:1px solid #d8c99f}
      html[data-theme="light"] .pbb-share-studio__tools,body.light-mode .pbb-share-studio__tools{background:#fff8e8;color:#241d10;-webkit-text-fill-color:#241d10}
      html[data-theme="dark"] .pbb-share-studio__tools,body.dark-mode .pbb-share-studio__tools{background:#201c14;color:#f7f0df;-webkit-text-fill-color:#f7f0df;border-top-color:rgba(233,200,126,.24)}html[data-theme="dark"] .pbb-share-studio__label,body.dark-mode .pbb-share-studio__label{color:#e9c87e}html[data-theme="dark"] .pbb-share-studio__input,body.dark-mode .pbb-share-studio__input{background:#31291b;color:#fff8e8;-webkit-text-fill-color:#fff8e8;border-color:#806c3c}html[data-theme="dark"] .pbb-share-studio__input::placeholder,body.dark-mode .pbb-share-studio__input::placeholder{color:#c9b98e;-webkit-text-fill-color:#c9b98e}html[data-theme="dark"] .pbb-share-studio__chip,body.dark-mode .pbb-share-studio__chip{background:#31291b;color:#f7f0df;-webkit-text-fill-color:#f7f0df;border-color:#806c3c}html[data-theme="dark"] .pbb-share-studio__chip.is-active,body.dark-mode .pbb-share-studio__chip.is-active{background:#e9c87e;color:#241d10;-webkit-text-fill-color:#241d10;border-color:#e9c87e}
      @media(max-height:680px){.pbb-share-studio__top{height:50px}.pbb-share-studio__tools{max-height:46dvh;padding-top:9px}.pbb-share-studio__input{min-height:42px}}
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
        <button type="button" class="pbb-share-studio__icon" data-share-close aria-label="Close editor">×</button>
        <div class="pbb-share-studio__top-title">Create your share</div>
        <button type="button" class="pbb-share-studio__done" data-share-done>Use photo</button>
      </div>
      <div class="pbb-share-studio__stage" data-share-stage>
        <img class="pbb-share-studio__photo" data-share-image alt="Your share preview">
        <div class="pbb-share-studio__caption" data-share-caption data-style="plain"></div>
        <div class="pbb-share-studio__loading" data-share-loading hidden>Updating preview...</div>
      </div>
      <div class="pbb-share-studio__tools">
        <label class="pbb-share-studio__label" for="pbb-share-caption-input">Add your own text</label>
        <textarea id="pbb-share-caption-input" class="pbb-share-studio__input" data-share-input rows="2" maxlength="120" placeholder="Say something about it..."></textarea>
        <div class="pbb-share-studio__row" aria-label="Text style">
          <button type="button" class="pbb-share-studio__chip is-active" data-caption-style="plain">Plain</button>
          <button type="button" class="pbb-share-studio__chip" data-caption-style="label">Label</button>
          <button type="button" class="pbb-share-studio__chip" data-caption-style="gold">Gold</button>
          <button type="button" class="pbb-share-studio__chip" data-caption-position="top">Top</button>
          <button type="button" class="pbb-share-studio__chip" data-caption-position="middle">Middle</button>
          <button type="button" class="pbb-share-studio__chip" data-caption-position="bottom">Bottom</button>
        </div>
        <div class="pbb-share-studio__actions" data-share-actions>
          <button type="button" class="pbb-share-studio__action" data-share-feed>Share to Feed</button>
          <button type="button" class="pbb-share-studio__action pbb-share-studio__action--ig" data-share-instagram>IG Story</button>
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
      captionY: active.captionY == null ? 0.22 : active.captionY
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

  async function renderPreview(el) {
    if (!active) return;
    var sequence = ++renderSequence;
    var loading = el.querySelector('[data-share-loading]');
    loading.hidden = false;
    try {
      var output = active.photoDataUrl;
      if (!active.rawPhoto && active.cardPayload && typeof window.renderBalanceShareCardImage === 'function') {
        output = await window.renderBalanceShareCardImage(active.cardPayload, {
          target: active.previewTarget || 'story',
          photoDataUrl: active.photoDataUrl,
          overlayStyle: active.overlayStyle,
          textStyle: active.textStyle,
          suppressCustomCaption: true
        });
      }
      if (sequence === renderSequence && active) el.querySelector('[data-share-image]').src = output;
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
    el.querySelector('[data-share-close]').addEventListener('click', function () { close({ action: 'closed' }); });
    el.querySelector('[data-share-done]').addEventListener('click', function () { runAction('done', el); });
    el.querySelector('[data-share-feed]').addEventListener('click', function () { runAction('feed', el); });
    el.querySelector('[data-share-instagram]').addEventListener('click', function () { runAction('instagram', el); });
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
        overlayStyle: options.overlayStyle,
        textStyle: options.textStyle,
        caption: options.caption != null ? options.caption : (previous.caption || ''),
        captionStyle: previous.captionStyle || 'plain',
        captionX: previous.captionX == null ? 0.5 : previous.captionX,
        captionY: previous.captionY == null ? 0.22 : previous.captionY,
        onFeed: options.onFeed,
        onInstagram: options.onInstagram,
        onDone: options.onDone,
        resolve: resolve
      };
      el.querySelector('[data-share-input]').value = active.caption;
      el.querySelector('[data-share-feed]').style.display = typeof active.onFeed === 'function' ? '' : 'none';
      el.querySelector('[data-share-instagram]').style.display = typeof active.onInstagram === 'function' ? '' : 'none';
      el.querySelector('[data-share-done]').style.display = typeof active.onDone === 'function' ? '' : 'none';
      el.querySelector('[data-share-actions]').style.display = (active.onFeed || active.onInstagram) ? 'grid' : 'none';
      el.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      renderCaptionOverlay(el);
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
    close: close,
    pilotEmail: PILOT_EMAIL
  };
})();
