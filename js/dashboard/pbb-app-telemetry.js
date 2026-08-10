(function (root) {
  'use strict';

  if (root.__pbbAppTelemetryLoaded) return;
  root.__pbbAppTelemetryLoaded = true;

  const VERSION = 'app-journey-v1';
  const MAX_QUEUE = 120;
  const FLUSH_DELAY_MS = 1200;
  const SENSITIVE_KEY = /(password|passcode|token|secret|authorization|card|cvv|cvc|expiry|email|phone|message|content|answer|response|photo|image|audio|transcript|notes?|body|text|url)/i;
  const queue = [];
  const recent = new Map();
  let flushTimer = null;
  let flushing = false;

  function safeToken(value, fallback) {
    const token = String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return token || fallback || 'unknown';
  }

  function sanitize(value, depth) {
    if (depth > 3 || value == null) return value == null ? null : undefined;
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.slice(0, 120);
    if (Array.isArray(value)) return value.slice(0, 12).map(item => sanitize(item, depth + 1)).filter(item => item !== undefined);
    if (typeof value !== 'object') return undefined;
    const output = {};
    Object.keys(value).slice(0, 30).forEach(key => {
      if (SENSITIVE_KEY.test(key)) return;
      const clean = sanitize(value[key], depth + 1);
      if (clean !== undefined) output[safeToken(key)] = clean;
    });
    return output;
  }

  function sessionId() {
    try {
      const usage = typeof root.getBalanceAppUsageTrackerState === 'function' ? root.getBalanceAppUsageTrackerState() : null;
      if (usage && usage.sessionId) return String(usage.sessionId);
    } catch (_) {}
    const key = 'pbb_app_telemetry_session_v1';
    try {
      let value = sessionStorage.getItem(key);
      if (!value) {
        value = (root.crypto && typeof root.crypto.randomUUID === 'function')
          ? root.crypto.randomUUID()
          : Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return 'session-unavailable';
    }
  }

  function currentUserId() {
    if (root.guestMode || root.isAdminViewing) return '';
    return String(root.currentUser && (root.currentUser.id || root.currentUser.user_id) || '');
  }

  async function flush() {
    if (flushing || !queue.length) return;
    const userId = currentUserId();
    const client = root.supabaseClient || root.supabase;
    if (!userId || !client || typeof client.from !== 'function') {
      scheduleFlush(1000);
      return;
    }

    flushing = true;
    const batch = queue.splice(0, 25);
    try {
      const rows = batch.map(event => ({
        user_id: userId,
        activity_type: event.type,
        activity_data: Object.assign({
          telemetry_version: VERSION,
          session_id: sessionId(),
          path: root.location && root.location.pathname || '',
          client_time: event.clientTime
        }, event.data)
      }));
      const result = await client.from('user_activity').insert(rows);
      if (result && result.error) throw result.error;
    } catch (error) {
      batch.reverse().forEach(event => queue.unshift(event));
      while (queue.length > MAX_QUEUE) queue.shift();
      try { console.warn('[app-telemetry] flush failed', error && (error.code || error.name || 'error')); } catch (_) {}
    } finally {
      flushing = false;
      if (queue.length) scheduleFlush(2500);
    }
  }

  function scheduleFlush(delay) {
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flush();
    }, Number(delay) || FLUSH_DELAY_MS);
  }

  function track(type, data, options) {
    const eventType = safeToken(type, 'app_interaction');
    const clean = sanitize(data || {}, 0) || {};
    const dedupeKey = options && options.dedupeKey ? eventType + ':' + options.dedupeKey : '';
    if (dedupeKey) {
      const now = Date.now();
      if (now - Number(recent.get(dedupeKey) || 0) < Number(options.dedupeMs || 650)) return;
      recent.set(dedupeKey, now);
    }
    queue.push({ type: eventType, data: clean, clientTime: new Date().toISOString() });
    while (queue.length > MAX_QUEUE) queue.shift();
    scheduleFlush(options && options.immediate ? 20 : FLUSH_DELAY_MS);
  }

  root.trackBalanceActivity = track;
  root.flushBalanceActivity = flush;

  function actionKey(element) {
    if (!element) return '';
    const explicit = element.getAttribute('data-telemetry-action') || element.getAttribute('data-track') || '';
    if (explicit) return safeToken(explicit);
    if (element.id) return safeToken(element.id);
    const aria = element.getAttribute('aria-label');
    if (aria) return safeToken(aria);
    const onclick = element.getAttribute('onclick') || '';
    const call = onclick.match(/([A-Za-z_$][\w$]*)\s*\(/);
    if (call) return safeToken(call[1]);
    const className = String(element.className || '').split(/\s+/).find(name => /(?:nav|card|button|btn|pill|cta|action)/i.test(name));
    return safeToken(className || element.tagName || 'control');
  }

  function currentSurface() {
    const activeView = Array.from(document.querySelectorAll('.app-view')).find(view => {
      const style = root.getComputedStyle ? root.getComputedStyle(view) : null;
      return style && style.display !== 'none' && style.visibility !== 'hidden';
    });
    return safeToken(activeView && activeView.id || 'dashboard');
  }

  document.addEventListener('click', function (event) {
    const element = event.target && event.target.closest
      ? event.target.closest('button,a,[role="button"],.card,.nav-item,[data-track],[data-telemetry-action]')
      : null;
    if (!element || element.closest('input,textarea,select')) return;
    const action = actionKey(element);
    track('ui_action', {
      action,
      surface: currentSurface(),
      element: safeToken(element.tagName || 'control')
    }, { dedupeKey: action + ':' + currentSurface(), dedupeMs: 500 });
  }, true);

  function installTabTracking() {
    const real = root._switchAppTabReal;
    if (typeof real !== 'function' || real.__pbbTelemetryWrapped) return;
    function trackedSwitchAppTab(tabName, button) {
      track('app_tab_opened', {
        tab: safeToken(tabName),
        source: button ? actionKey(button) : 'programmatic'
      }, { dedupeKey: safeToken(tabName), dedupeMs: 400 });
      return real.apply(this, arguments);
    }
    trackedSwitchAppTab.__pbbTelemetryWrapped = true;
    trackedSwitchAppTab.__pbbTelemetryOriginal = real;
    root._switchAppTabReal = trackedSwitchAppTab;
  }

  const surfaceDefinitions = [
    { id: 'onboarding-wizard', name: 'onboarding_wizard' },
    { id: 'guided-tour-overlay', name: 'guided_tour' },
    { id: 'direct-message-modal', name: 'direct_message' },
    { id: 'social-journey-view', name: 'foundations_journey' },
    { id: 'native-permissions-modal', name: 'native_permissions' }
  ];
  const surfaceState = {};

  function isOpen(element) {
    if (!element) return false;
    const style = root.getComputedStyle ? root.getComputedStyle(element) : null;
    return element.classList.contains('active') || element.classList.contains('is-open')
      || (style && style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0);
  }

  function scanSurfaces() {
    surfaceDefinitions.forEach(definition => {
      const element = document.getElementById(definition.id);
      if (!element) return;
      const open = isOpen(element);
      if (!(definition.name in surfaceState)) {
        surfaceState[definition.name] = open;
        return;
      }
      if (surfaceState[definition.name] === open) return;
      surfaceState[definition.name] = open;
      track(open ? 'app_surface_opened' : 'app_surface_closed', { surface: definition.name }, { immediate: true });
    });
  }

  let scanTimer = null;
  const observer = new MutationObserver(function () {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      scanSurfaces();
    }, 80);
  });

  function startObservers() {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'], childList: true, subtree: true });
    scanSurfaces();
  }

  root.addEventListener('error', function (event) {
    track('app_client_error', {
      error_name: safeToken(event.error && event.error.name || 'error'),
      source_file: safeToken(String(event.filename || '').split('/').pop()),
      line: Number(event.lineno || 0),
      column: Number(event.colno || 0)
    }, { dedupeKey: String(event.filename || '') + ':' + event.lineno, dedupeMs: 5000, immediate: true });
  });

  root.addEventListener('unhandledrejection', function (event) {
    track('app_client_error', {
      error_name: safeToken(event.reason && event.reason.name || typeof event.reason || 'promise_rejection'),
      source_file: 'unhandled_promise'
    }, { dedupeKey: 'unhandled:' + safeToken(event.reason && event.reason.name || ''), dedupeMs: 5000, immediate: true });
  });

  root.addEventListener('pagehide', function () { flush(); });
  setInterval(function () {
    installTabTracking();
    if (queue.length) flush();
  }, 2000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObservers, { once: true });
  else startObservers();
  track('telemetry_ready', { version: VERSION }, { immediate: true });
})(window);
