(function (root) {
  'use strict';
  if (root.BalanceReplay) return;
  const privacy = root.BalanceReplayPrivacy;
  const MAX_RAW = 4000000, MAX_QUEUE = 6000000, MAX_PAYLOAD = 750000;
  let stop, owner = '', session = '', seq = 0, queue = [], bytes = 0;
  let started = 0, busy = false, retryAt = 0, disabledUntil = 0, loading;
  let authBound = false, activeAuthId = '', enabled = true, generation = 0;
  function preferenceKey(id) { return 'pbb_replay_disabled:' + id; }
  function eligible() { return enabled && owner && activeAuthId === owner && String(root.currentUser?.id || root.currentUser?.user_id || '') === owner && !root.guestMode && !root.isAdminViewing && document.visibilityState !== 'hidden'; }
  function clear() {
    if (stop) stop(); stop = null; queue = []; bytes = 0; session = ''; seq = 0; generation++;
  }
  function emit(value) {
    if (!eligible()) return;
    const clean = privacy.event(value);
    if (!clean) return;
    const length = JSON.stringify(clean).length;
    if (length > MAX_RAW || bytes + length > MAX_QUEUE) { clear(); disabledUntil = Date.now() + 60000; return; }
    queue.push(clean); bytes += length;
  }
  async function load() {
    if (root.rrweb) return;
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = '/js/vendor/rrweb-2.1.4.min.js';
      script.onload = resolve; script.onerror = () => { loading = null; script.remove(); reject(new Error('Recorder unavailable')); };
      document.head.appendChild(script);
    });
    await loading;
  }
  function start() {
    if (stop || queue.length || !eligible() || Date.now() < disabledUntil || !root.rrweb) return;
    session = crypto.randomUUID(); seq = 0; started = Date.now();
    stop = root.rrweb.record({ emit, maskAllInputs: true, maskTextSelector: '*', maskTextFn: privacy.mask,
      blockSelector: privacy.blocked, inlineImages: false, inlineStylesheet: true,
      recordCanvas: false, recordCrossOriginIframes: false, collectFonts: false,
      slimDOMOptions: 'all', sampling: { mousemove: false, scroll: 200, input: 'last' } });
    if (!session) { if (stop) stop(); stop = null; return; }
    if (typeof root.trackBalanceActivity === 'function') root.trackBalanceActivity('app_replay_started', { replay_session_id: session });
  }
  async function gzip(events) {
    const stream = new Blob([JSON.stringify(events)]).stream().pipeThrough(new CompressionStream('gzip'));
    const array = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = ''; for (let i = 0; i < array.length; i += 8192) binary += String.fromCharCode(...array.subarray(i, i + 8192));
    return btoa(binary);
  }
  async function flush() {
    if (busy || !queue.length || !owner || activeAuthId !== owner || Date.now() < retryAt) return;
    busy = true;
    const batch = [], token = generation, id = owner, sid = session, index = seq;
    let raw = 0;
    for (const event of queue) { const size = JSON.stringify(event).length; if (raw + size > MAX_RAW) break; batch.push(event); raw += size; }
    try {
      const payload = await gzip(batch);
      if (token !== generation) return;
      if (payload.length > MAX_PAYLOAD) { clear(); disabledUntil = Date.now() + 300000; return; }
      const { data: auth } = await root.supabaseClient.auth.getSession();
      if (!auth.session || auth.session.user.id !== id || token !== generation) return;
      const { error } = await root.supabaseClient.from('app_replay_chunks').insert({
        user_id: id, session_id: sid, seq: index, payload,
        first_ms: batch[0].timestamp, last_ms: batch[batch.length - 1].timestamp,
        error_count: batch.filter(e => e.type === 5).length
      });
      if (token !== generation) return;
      if (error && error.code !== '23505') {
        if (error.code === 'P0001') { clear(); disabledUntil = Date.now() + 3600000; }
        else retryAt = Date.now() + 30000;
        return;
      }
      queue.splice(0, batch.length); bytes -= raw; seq++;
      if (Date.now() - started > 300000 && !queue.length) { clear(); start(); }
    } catch (_) { retryAt = Date.now() + 30000; }
    finally { busy = false; }
  }
  function setEnabled(value) {
    enabled = !!value;
    if (owner) { try { localStorage.setItem(preferenceKey(owner), enabled ? '0' : '1'); } catch (_) {} }
    if (!enabled) clear(); else start();
    syncPreference();
  }
  function syncPreference() {
    const toggle = document.getElementById('balance-replay-enabled'); if (toggle) toggle.checked = enabled;
  }
  async function tick() {
    if (!privacy || !root.CompressionStream || !root.crypto?.randomUUID || !root.supabaseClient?.auth) return;
    try {
      if (!authBound) {
        authBound = true;
        root.supabaseClient.auth.onAuthStateChange((_event, auth) => {
          activeAuthId = auth?.user?.id || '';
          if (owner && activeAuthId !== owner) { clear(); owner = ''; }
        });
      }
      const { data } = await root.supabaseClient.auth.getSession();
      activeAuthId = data.session?.user?.id || '';
      const userId = String(root.currentUser?.id || root.currentUser?.user_id || '');
      if (!userId || userId !== activeAuthId || root.guestMode || root.isAdminViewing) { clear(); owner = ''; return; }
      if (owner !== userId) {
        clear(); owner = userId; enabled = true;
        try { enabled = localStorage.getItem(preferenceKey(owner)) !== '1'; } catch (_) {}
        syncPreference();
      }
      if (!enabled) return;
      await load(); start();
    } catch (_) { /* Diagnostics must never prevent app use. */ }
  }
  function errorMarker() {
    if (stop && eligible()) {
      emit({ type: 5, timestamp: Date.now(), data: { tag: 'balance-error' } });
      flush();
    }
  }
  root.BalanceReplay = { setEnabled, flush, getSessionId: () => session || null };
  root.addEventListener('error', errorMarker); root.addEventListener('unhandledrejection', errorMarker);
  root.addEventListener('storage', event => { if (owner && event.key === preferenceKey(owner)) { enabled = event.newValue !== '1'; if (!enabled) clear(); else start(); syncPreference(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (stop) stop(); stop = null; flush(); }
    else { flush().finally(() => { if (!queue.length) { clear(); tick(); } }); }
  });
  root.addEventListener('pagehide', () => { if (stop) stop(); stop = null; flush(); });
  // Periodic uploads keep most of the lead-up even when a phone kills its WebView.
  setInterval(tick, 5000); setInterval(flush, 15000); tick();
})(window);
