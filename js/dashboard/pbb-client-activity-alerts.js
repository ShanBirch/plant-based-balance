(function (root) {
  'use strict';
  if (root.__pbbClientActivityAlertsLoaded) return;
  root.__pbbClientActivityAlertsLoaded = true;

  // Only presence is collected here. Existing user_activity is the source of
  // action summaries; visibility or a tap must never imply a completed action.
  const ENDPOINT = '/.netlify/functions/client-activity-event';
  const CONFIRM_MS = 2000, HEARTBEAT_MS = 60000, ACTIVE_MS = 5 * 60000;
  const IDLE_REOPEN_MS = 10 * 60000;
  const MAX_QUEUE = 8, MAX_ATTEMPTS = 8, REQUEST_MS = 10000;
  const HINT_PREFIX = 'pbb_client_activity_hint_v1:';
  const params = new URLSearchParams(root.location.search || '');
  const host = String(root.location.hostname || '').toLowerCase();
  const previewRoute = params.has('view_as') || params.get('guest') === 'true'
    || params.has('meta_trial') || params.get('testFlow') === '1'
    || params.get('utm_campaign') === 'onboarding_test'
    || params.has('preview') || params.get('test') === 'true'
    || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)
    || /--[^.]+\.netlify\.app$/.test(host);

  let owner = '', generation = 0, authRevision = 0, authClient = null;
  let queue = [], flight = null, identifying = false, confirmTimer = null;
  let confirmed = false, pageActive = true, nativeActive = true;
  let nativeBound = false, nativeRevision = 0;
  let lastInteraction = null, lastForeground = 0, lastHeartbeat = 0, fallbackSession = '';
  const hints = new Map();

  function userId() {
    return String(root.currentUser && (root.currentUser.id || root.currentUser.user_id) || '');
  }

  function blocked() {
    const user = root.currentUser || {};
    const profile = root.userProfile || {};
    return previewRoute || root._pbbAuthGuardReady !== true
      || root.guestMode || root.isAdminViewing || root.metaAdTrialMode
      || root.__balanceOnboardingAnalyticsTest === true
      || user.id === 'guest-preview' || user.id === 'cc632168-874c-447e-a4ad-ee7f6b40bb7e'
      || user.is_test_account === true || user.app_metadata?.is_test_account === true
      || user.user_metadata?.is_test_account === true
      || (String(profile.id || profile.user_id || '') === userId() && profile.is_test_account === true)
      || (typeof root.isBalanceAdminEmail === 'function' && root.isBalanceAdminEmail(user.email));
  }

  function visible() {
    return pageActive && nativeActive && document.visibilityState === 'visible' && !document.hidden;
  }

  function eligible(id) {
    return !!id && owner === id && userId() === id && !blocked();
  }

  function uuid() {
    try {
      if (typeof root.crypto?.randomUUID === 'function') return root.crypto.randomUUID();
      const bytes = root.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    } catch (_) { return ''; }
  }

  function usageSessionId() {
    try {
      const usage = root.getBalanceAppUsageTrackerState?.();
      if (usage?.userId === owner && typeof usage.sessionId === 'string'
        && /^[a-zA-Z0-9_-]{1,120}$/.test(usage.sessionId)) return usage.sessionId;
    } catch (_) {}
    if (!fallbackSession) {
      const key = 'pbb_client_activity_session_v1:' + owner;
      try { fallbackSession = root.sessionStorage.getItem(key) || ''; } catch (_) {}
      if (!/^[a-f0-9-]{36}$/i.test(fallbackSession)) fallbackSession = uuid();
      try { if (fallbackSession) root.sessionStorage.setItem(key, fallbackSession); } catch (_) {}
    }
    return fallbackSession;
  }

  function cancelConfirmation() {
    if (confirmTimer !== null) clearTimeout(confirmTimer);
    confirmTimer = null;
    confirmed = false;
  }

  function resetIdentity() {
    generation++;
    owner = '';
    queue = [];
    fallbackSession = '';
    lastInteraction = null;
    lastForeground = 0;
    cancelConfirmation();
    if (flight?.controller) flight.controller.abort();
    flight = null;
  }

  function bounded(promise) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('activity-timeout')), REQUEST_MS); })
    ]).finally(() => clearTimeout(timer));
  }

  // Local storage holds only a timestamp and opaque usage-session hint, never
  // credentials, private content or queued events. A new tab must register its
  // session even within the cooldown; only the server dedupes the client visit.
  function claimHint(kind, sessionId) {
    const key = HINT_PREFIX + owner + ':' + kind;
    let previous = hints.get(key);
    try {
      const stored = JSON.parse(root.localStorage.getItem(key) || 'null');
      if (Number.isFinite(stored?.at)) previous = stored;
    } catch (_) {}
    const now = Date.now();
    if (previous && now >= previous.at && now - previous.at < HEARTBEAT_MS
      && (kind !== 'foreground' || previous.usage_session_id === sessionId)) return false;
    const hint = { at: now, usage_session_id: sessionId };
    hints.set(key, hint);
    try { root.localStorage.setItem(key, JSON.stringify(hint)); } catch (_) {}
    return true;
  }

  function enqueue(kind) {
    if (!eligible(owner) || !visible() || !confirmed) return;
    pruneQueue();
    const eventId = uuid(), sessionId = usageSessionId();
    if (queue.some(entry => entry.payload.kind === kind
      && (kind !== 'foreground' || entry.payload.usage_session_id === sessionId))) return;
    if (!eventId || !sessionId || !claimHint(kind, sessionId)) return;
    const capturedAt = Date.now();
    queue.push({
      owner, createdAt: capturedAt, attempts: 0, retryAt: 0,
      // Capture time is immutable on retry, so the server can reject anything
      // observed before alert activation or outside its short freshness window.
      payload: { kind, event_id: eventId, usage_session_id: sessionId, visible: true, occurred_at: new Date(capturedAt).toISOString() }
    });
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    flush();
  }

  function pruneQueue() {
    const now = Date.now();
    queue = queue.filter(entry => entry.owner === owner && now - entry.createdAt <= ACTIVE_MS
      && entry.attempts < MAX_ATTEMPTS
      && (entry.payload.kind !== 'presence' || (visible() && lastInteraction !== null && now - lastInteraction <= ACTIVE_MS)));
  }

  function reconcileVisibility() {
    if (!eligible(owner) || !visible()) {
      cancelConfirmation();
      queue = queue.filter(entry => entry.payload.kind !== 'presence');
      return;
    }
    if (confirmed || confirmTimer !== null) return;
    const version = generation;
    confirmTimer = setTimeout(() => {
      confirmTimer = null;
      if (version !== generation || !eligible(owner) || !visible()) return;
      confirmed = true;
      lastForeground = Date.now();
      lastHeartbeat = Date.now();
      enqueue('foreground');
      flush();
    }, CONFIRM_MS);
  }

  async function flush() {
    pruneQueue();
    if (flight || !queue.length || !eligible(owner) || !visible() || !confirmed || root.navigator.onLine === false) return;
    const entry = queue.find(item => item.retryAt <= Date.now());
    if (!entry) return;
    const run = { generation, owner, controller: typeof root.AbortController === 'function' ? new root.AbortController() : null };
    flight = run;
    let retry = false;
    try {
      const revision = authRevision;
      const result = await bounded(root.supabaseClient.auth.getSession());
      if (run.generation !== generation || revision !== authRevision) return;
      const session = result?.data?.session;
      if (result?.error) throw result.error;
      if (!session?.access_token || session.user?.id !== run.owner) { resetIdentity(); return; }
      if (!eligible(run.owner) || !visible() || !confirmed) return;
      entry.attempts++;
      const response = await bounded(root.fetch(ENDPOINT, {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify(entry.payload),
        ...(run.controller ? { signal: run.controller.signal } : {})
      }));
      retry = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      if (!retry && run.generation === generation) queue = queue.filter(item => item !== entry);
    } catch (_) {
      retry = true;
      // Aborting a timed-out request is best effort. Its retry keeps the exact
      // event UUID, including when the server accepted it but the reply was lost.
      if (run.controller) run.controller.abort();
    } finally {
      if (run.generation === generation && retry && queue.includes(entry)) {
        entry.attempts = Math.max(1, entry.attempts);
        entry.retryAt = Date.now() + Math.min(60000, 5000 * Math.pow(2, entry.attempts - 1));
      }
      if (flight === run) flight = null;
    }
  }

  function bindAuth() {
    const client = root.supabaseClient;
    if (!client?.auth || authClient === client) return;
    if (typeof client.auth.onAuthStateChange !== 'function') return;
    authClient = client;
    client.auth.onAuthStateChange((event, session) => {
      authRevision++;
      if (event === 'SIGNED_OUT' || (owner && session?.user?.id !== owner)) resetIdentity();
      // Supabase auth callbacks must stay synchronous: getSession is deferred.
      setTimeout(tick, 0);
    });
  }

  async function identify() {
    if (identifying || blocked() || !userId() || !root.supabaseClient?.auth?.getSession) return;
    identifying = true;
    const revision = authRevision, version = generation, id = userId();
    try {
      const result = await bounded(root.supabaseClient.auth.getSession());
      if (revision !== authRevision || version !== generation || userId() !== id || blocked()) return;
      if (result?.error || !result?.data?.session?.access_token || result.data.session.user?.id !== id) return;
      owner = id;
      reconcileVisibility();
    } catch (_) { /* Presence must never interrupt the app or its sign-in. */ }
    finally { identifying = false; }
  }

  function bindNative() {
    if (nativeBound || !root.Capacitor) return;
    try {
      const cap = root.Capacitor;
      let app = cap.Plugins?.App;
      if (!app && cap.isNativePlatform?.() && typeof cap.registerPlugin === 'function') app = cap.registerPlugin('App');
      if (!app?.addListener) return;
      nativeBound = true;
      const listener = app.addListener('appStateChange', state => {
        if (typeof state?.isActive !== 'boolean') return;
        nativeRevision++;
        nativeActive = state.isActive;
        reconcileVisibility();
        if (nativeActive) tick();
      });
      Promise.resolve(listener).catch(() => { /* Document visibility remains the fallback. */ });
      if (typeof app.getState === 'function') {
        nativeActive = false;
        cancelConfirmation();
        const revision = nativeRevision;
        bounded(Promise.resolve().then(() => app.getState())).then(state => {
          if (revision === nativeRevision) nativeActive = state?.isActive !== false;
        }, () => { if (revision === nativeRevision) nativeActive = true; }).finally(tick);
      }
    } catch (_) { /* The optional native App plugin is not installed everywhere. */ }
  }

  function tick() {
    bindAuth();
    bindNative();
    if (owner && (!eligible(owner))) resetIdentity();
    if (!owner) { identify(); return; }
    reconcileVisibility();
    if (confirmed && visible() && Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
      lastHeartbeat = Date.now();
      if (lastInteraction !== null && Date.now() - lastInteraction <= ACTIVE_MS) enqueue('presence');
    }
    flush();
  }

  function interaction(event) {
    // Do not read targets, keys, form values, DOM text or replay data.
    if (event.isTrusted !== true || !eligible(owner) || !visible()) return;
    const now = Date.now();
    const returningFromIdle = confirmed && now - Math.max(lastForeground, lastInteraction || 0) >= IDLE_REOPEN_MS;
    lastInteraction = now;
    if (returningFromIdle) {
      // Presence cannot create a server visit. After a long idle, confirm a new
      // foreground before resuming heartbeats; server dedupe handles overlap.
      cancelConfirmation();
      reconcileVisibility();
    }
  }

  function reconnect() {
    pruneQueue();
    // Old heartbeats cannot recreate an expired visit. Keep any recent pending
    // foreground (and its retry UUID); otherwise reconfirm before sending more
    // presence, even if interaction continued throughout a long offline spell.
    queue = queue.filter(entry => entry.payload.kind === 'foreground');
    if (eligible(owner) && visible() && confirmed && !queue.length) cancelConfirmation();
    queue.forEach(entry => { entry.retryAt = 0; });
    tick();
  }

  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(type => document.addEventListener(type, interaction, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', tick);
  root.addEventListener('pbbCurrentUserReady', tick);
  root.addEventListener('online', reconnect);
  root.addEventListener('pagehide', () => { pageActive = false; reconcileVisibility(); });
  root.addEventListener('pageshow', () => { pageActive = true; tick(); });
  setInterval(tick, 5000);
  tick();
})(window);
