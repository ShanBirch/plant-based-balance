(function (root) {
  'use strict';

  if (root.__pbbAppTelemetryLoaded) return;

  const VERSION = 'app-journey-v1';
  const DEBUG_VERSION = 'app-diagnostics-v2';
  const ERROR_STORE = 'pbb_app_errors_v2';
  const trail = [];
  let restoredOwner = '';
  let rateWindow = 0, rateCount = 0;
  const MAX_QUEUE = 120;
  const FLUSH_DELAY_MS = 1200;
  const privacy = root.BalanceTelemetryPrivacy;
  // Fail closed if a stale/failed asset load omitted the privacy helper.
  if (!privacy) return;
  root.__pbbAppTelemetryLoaded = true;
  const queue = [];
  const recent = new Map();
  let flushTimer = null;
  let flushing = false;
  let inFlight = [];

  function safeToken(value, fallback) {
    const safe = privacy.string(value);
    if (safe === '[redacted]') return 'redacted';
    const token = safe
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return token || fallback || 'unknown';
  }

  function sanitize(value, depth) {
    return privacy.sanitize(value, depth);
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

    restoreErrors(userId);
    // An account change must never relabel the previous member's events.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].owner && queue[i].owner !== userId) queue.splice(i, 1);
      else queue[i].owner = userId;
    }
    flushing = true;
    const batch = queue.splice(0, 25);
    inFlight = batch;
    persistErrors();
    try {
      const rows = batch.map(event => ({
        ...(event.id ? { id: event.id } : {}),
        user_id: userId,
        activity_type: event.type,
        activity_data: sanitize(Object.assign({
          telemetry_version: VERSION,
          session_id: sessionId(),
          path: root.location && root.location.pathname || '',
          client_time: event.clientTime
        }, event.data), 0)
      }));
      const table = client.from('user_activity');
      const result = typeof table.upsert === 'function'
        ? await table.upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        : await table.insert(rows);
      if (result && result.error) throw result.error;
    } catch (error) {
      batch.reverse().forEach(event => queue.unshift(event));
      while (queue.length > MAX_QUEUE) queue.shift();
      try { console.warn('[app-telemetry] flush failed', error && (error.code || error.name || 'error')); } catch (_) {}
    } finally {
      flushing = false;
      inFlight = [];
      persistErrors();
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
    if (root.guestMode || root.isAdminViewing) return;
    const eventType = safeToken(type, 'app_interaction');
    const clean = sanitize(data || {}, 0) || {};
    const replaySession = root.BalanceReplay && root.BalanceReplay.getSessionId();
    if (replaySession) clean.replay_session_id = privacy.string(replaySession);
    if (eventType === 'app_client_error') clean.session_id = sessionId();
    const dedupeKey = options && options.dedupeKey ? eventType + ':' + options.dedupeKey : '';
    if (dedupeKey) {
      const now = Date.now();
      if (now - Number(recent.get(dedupeKey) || 0) < Number(options.dedupeMs || 650)) return;
      recent.set(dedupeKey, now);
      if (recent.size > 240) recent.delete(recent.keys().next().value);
    }
    queue.push({ type: eventType, data: clean, clientTime: new Date().toISOString(), owner: currentUserId(),
      id: root.crypto && typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID() : undefined });
    if (eventType === 'app_client_error') persistErrors();
    while (queue.length > MAX_QUEUE) queue.shift();
    scheduleFlush(options && options.immediate ? 20 : FLUSH_DELAY_MS);
  }

  function persistErrors() {
    try {
      const owner = currentUserId();
      if (!owner) return;
      if (restoredOwner !== owner) restoreErrors(owner);
      const events = inFlight.concat(queue).filter(e => e.type === 'app_client_error' && (!e.owner || e.owner === owner)).slice(-25);
      root.sessionStorage.setItem(ERROR_STORE, JSON.stringify({ owner, events }));
    } catch (_) { /* Disabled/full storage must not interrupt the app. */ }
  }
  function restoreErrors(owner) {
    if (restoredOwner === owner) return;
    restoredOwner = owner;
    try {
      const stored = JSON.parse(root.sessionStorage.getItem(ERROR_STORE) || 'null');
      root.sessionStorage.removeItem(ERROR_STORE);
      if (!stored || stored.owner !== owner || !Array.isArray(stored.events)) return;
      for (const event of stored.events.slice(-25)) {
        const age = Date.now() - Date.parse(event.clientTime);
        if (event.type !== 'app_client_error' || event.owner && event.owner !== owner || !Number.isFinite(age) || age < 0 || age > 86400000) continue;
        if (!/^[a-f0-9-]{36}$/i.test(event.id || '') || queue.some(e => e.id === event.id)) continue;
        queue.unshift({ id: event.id, owner, type: event.type, data: sanitize(event.data, 0), clientTime: event.clientTime });
      }
    } catch (_) { /* An invalid local queue is disposable. */ }
  }
  function remember(value) {
    trail.push(Math.round((Date.now() - startedAt) / 1000) + 's:' + value);
    if (trail.length > 8) trail.shift();
  }
  const startedAt = Date.now();

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
    // Identifiers/handler names only: never button text, form values or aria labels.
    const handler = String(element.getAttribute('onclick') || '').match(/^\s*([A-Za-z_$][\w$]{0,63})\s*\(/);
    const control = handler ? handler[1] : element.id || element.tagName;
    remember('tap:' + safeToken(control) + ':' + currentSurface());
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
      remember('tab:' + safeToken(tabName));
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

  // Retain only a JavaScript identifier from known ReferenceError formats.
  // Raw messages and stacks can contain private values, so never store them.
  function missingSymbol(error, fallback) {
    if (error && error.name && error.name !== 'ReferenceError') return undefined;
    const value = String(error && error.message || fallback || '');
    const match = /^(?:ReferenceError: )?(?:Can't find variable: ([A-Za-z_$][\w$]{0,63})|([A-Za-z_$][\w$]{0,63}) is not defined)$/.exec(value);
    return match ? privacy.string(match[1] || match[2]) : undefined;
  }

  const startupMilestones = { init_complete: false, critical_content_ready: false };
  root.addEventListener('pbbInitComplete', function () { startupMilestones.init_complete = true; });
  root.addEventListener('appCriticalContentReady', function () { startupMilestones.critical_content_ready = true; });

  function errorContext(error) {
    // Parse only file coordinates, never retain stack messages, URLs or arguments.
    const frames = String(error && error.stack || '').split('\n').slice(0, 12).flatMap(function (line) {
      const match = line.match(/(?:https?:\/\/[^\s@()]+\/|\/)([^\s/():?#]+\.html?|[^\s/():?#]+\.js)(?:[?#][^\s():]*)?:(\d+):(\d+)\)?$/);
      if (!match) return [];
      return [safeToken(privacy.sourceFile(match[1])) + ':' + Number(match[2]) + ':' + Number(match[3])];
    }).slice(0, 5);
    const agent = String(root.navigator && root.navigator.userAgent || '');
    const ios = /iPhone|iPad|iPod/.test(agent);
    return {
      debug_version: DEBUG_VERSION,
      release: safeToken(document.querySelector?.('meta[name="balance-build"]')?.content || 'development'),
      online: root.navigator ? root.navigator.onLine !== false : null,
      surface: currentSurface(),
      trail: trail.slice(),
      document_state: safeToken(document.readyState),
      visibility: safeToken(document.visibilityState),
      elapsed_ms: root.performance && typeof root.performance.now === 'function' ? Math.round(root.performance.now()) : null,
      browser_family: /Instagram/i.test(agent) ? (ios ? 'instagram_ios' : 'instagram_other') : /FBAN|FBAV/i.test(agent) ? 'facebook' : ios ? 'ios_other' : 'other',
      native_marker: /FitGotchi-Native/i.test(agent),
      init_complete: startupMilestones.init_complete,
      critical_ready: startupMilestones.critical_content_ready || !!root._appCriticalContentReady,
      client_ready: !!(root.supabaseClient || root.supabase),
      account_ready: !!currentUserId(),
      learning_ready: typeof root.openCurrentCourseLesson === 'function',
      predictive_ready: !!root.BalancePredictiveContent,
      frames
    };
  }

  function fingerprint(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return 'issue-' + (hash >>> 0).toString(16);
  }
  function reportFailure(kind, error, facts) {
    try {
      if (Date.now() - rateWindow > 60000) { rateWindow = Date.now(); rateCount = 0; }
      if (rateCount >= 30) return;
      const data = Object.assign({ error_kind: kind, error_name: safeToken(error && error.name || 'error'),
        missing_symbol: missingSymbol(error), diagnostic: errorContext(error) }, facts || {});
      data.issue_key = fingerprint([kind, data.error_name, data.source_file, data.line, data.column,
        data.missing_symbol, data.operation, data.status, data.code, data.diagnostic.frames[0]].join(':'));
      const key = 'app_client_error:' + data.issue_key;
      if (Date.now() - Number(recent.get(key) || 0) < 5000) return;
      rateCount++;
      track('app_client_error', data, { dedupeKey: data.issue_key, dedupeMs: 5000, immediate: true });
      if (kind !== 'runtime' && kind !== 'promise') root.BalanceReplay?.markError?.();
    } catch (_) { /* Debugging must never break the original action. */ }
  }
  // For caught application failures that do not reject a request or promise.
  root.reportBalanceAppError = function (operation, error, facts) {
    reportFailure('handled', error, { operation: /^[a-z][a-z0-9_]{0,63}$/i.test(operation || '') ? safeToken(operation) : 'app_action',
      code: /^[a-z0-9_]{1,32}$/i.test(facts?.code || '') ? safeToken(facts.code) : undefined });
  };
  root.addEventListener('error', function (event) {
    const target = event.target;
    if (target && target !== root && /^(SCRIPT|LINK|IMG|VIDEO|AUDIO|SOURCE)$/.test(target.tagName || '')) {
      reportFailure('resource', null, { source_file: endpoint(target.src || target.href || '').label, operation: safeToken(target.tagName) });
      return;
    }
    reportFailure('runtime', event.error, { source_file: safeToken(privacy.sourceFile(event.filename)),
      missing_symbol: missingSymbol(event.error, event.message), line: Number(event.lineno || 0), column: Number(event.colno || 0) });
  }, true);
  root.addEventListener('unhandledrejection', function (event) {
    reportFailure('promise', event.reason, { source_file: 'unhandled_promise' });
  });
  root.addEventListener('offline', function () { remember('offline'); });
  root.addEventListener('online', function () { remember('online'); flush(); });

  function endpoint(input) {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, root.location.href);
      const path = url.pathname;
      const own = url.origin === root.location.origin;
      const database = url.hostname === 'hzapaorxqboevxnumxkv.supabase.co';
      if (database && /\/rest\/v1\/(?:user_activity|app_replay_chunks)(?:$|\/)/.test(path)) return { skip: true };
      if (own && /client-activity-event|client-activity-dispatch/.test(path)) return { skip: true };
      const named = path.match(/^\/(?:\.netlify\/functions|rest\/v1(?:\/rpc)?)\/([a-z][a-z0-9_-]{0,63})$/i);
      if ((own || database) && named) return { label: (database ? 'database:' : 'function:') + safeToken(named[1]), monitor: true };
      if (database && /^\/auth\/v1\//.test(path)) return { label: 'auth', monitor: true };
      if (database && /^\/storage\/v1\//.test(path)) return { label: 'storage', monitor: true };
      // Static asset basename only for our own code; private media paths stay hidden.
      const asset = path.match(/\/([a-z0-9_.-]+\.(?:js|css))$/i);
      return { label: own && asset ? safeToken(asset[1]) : own ? 'app_resource' : 'external_resource', monitor: own };
    } catch (_) { return { label: 'unknown_resource', monitor: false }; }
  }
  if (typeof root.fetch === 'function') {
    const originalFetch = root.fetch;
    root.fetch = function () {
      const args = arguments, target = endpoint(args[0]);
      if (target.skip || !target.monitor) return originalFetch.apply(this, args);
      const began = Date.now();
      const timer = setTimeout(function () { reportFailure('slow_request', null, { operation: target.label, duration_ms: Date.now() - began }); }, 15000);
      let result;
      try { result = originalFetch.apply(this, args); }
      catch (error) { clearTimeout(timer); if (error?.name !== 'AbortError') reportFailure('network', error, { operation: target.label }); throw error; }
      return Promise.resolve(result).then(function (response) {
        clearTimeout(timer);
        if (response.status >= 400) reportFailure('http', null, { operation: target.label, status: response.status, duration_ms: Date.now() - began });
        return response;
      }, function (error) {
        clearTimeout(timer);
        if (error?.name !== 'AbortError') reportFailure('network', error, { operation: target.label, duration_ms: Date.now() - began });
        throw error;
      });
    };
  }
  // Caught errors are often logged rather than thrown. Retain only Error metadata,
  // never the log prefix, arguments, message, response or body.
  if (root.console && typeof root.console.error === 'function') {
    const originalError = root.console.error;
    root.console.error = function () {
      try {
        const error = Array.from(arguments).find(value => value && typeof value === 'object' && typeof value.stack === 'string');
        if (error) reportFailure('logged', error, { operation: 'console_error' });
      } catch (_) {}
      return originalError.apply(this, arguments);
    };
  }

  root.addEventListener('pagehide', function () { flush(); });
  setInterval(function () {
    installTabTracking();
    if (queue.length) flush();
  }, 2000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObservers, { once: true });
  else startObservers();
  track('telemetry_ready', { version: VERSION }, { immediate: true });
})(window);
