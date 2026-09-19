(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let client, player, sessions = [], cursor, selected, request = 0, listRequest = 0, duration = 0;
  const fmt = ms => Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  function status(text) { $('status').textContent = text; }
  function destroy() { if (player) player.destroy(); player = null; $('player').replaceChildren(); $('controls').hidden = true; $('onboarding-timeline').replaceChildren(); $('onboarding-summary').textContent = ''; }
  function markerLabel(value) {
    const screens = { slide_1: 'Setup questions', slide_3: 'Cycle setup', slide_4: 'Design your training week', slide_6: 'Exercise preferences', slide_7: 'Confirm your training week', slide_19: 'Your recommendations' };
    const actions = { outside_highlight: 'Tap outside the highlight', app_hidden: 'App moved to background', app_returned: 'Returned to app', page_left: 'Left this page', recording_resumed: 'Recording resumed here' };
    const stage = screens[value.step] || (value.phase === 'tour' ? 'Tour step ' + value.step_number : (value.step || value.phase).replace(/_/g, ' '));
    return stage + ' · ' + (actions[value.action] || value.status);
  }
  function size() {
    if (!player) return;
    const meta = player.getMetaData();
    const frame = player.iframe;
    const width = Number(frame?.getAttribute('width')) || 390;
    const height = Number(frame?.getAttribute('height')) || 844;
    const scale = Math.min($('player').clientWidth / width, 620 / height, 1);
    player.wrapper.style.transform = 'scale(' + scale + ')';
    $('player').style.height = Math.ceil(height * scale) + 'px';
  }
  async function decode(payload) {
    const binary = atob(payload), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > 5000000) { await reader.cancel(); throw new Error('Replay chunk exceeds playback limit'); } chunks.push(value); }
    const events = JSON.parse(await new Blob(chunks).text());
    if (!Array.isArray(events)) throw new Error('Invalid replay');
    return events.map(window.BalanceReplayPrivacy.event).filter(Boolean);
  }
  async function openSession(item) {
    const token = ++request; destroy(); selected = item;
    document.querySelectorAll('.session').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.session === item.session_id)));
    $('session-title').textContent = item.member_name;
    $('session-detail').textContent = new Date(item.started_at).toLocaleString() + ' · Loading replay…';
    try {
      const { data, error } = await client.from('app_replay_chunks').select('seq,payload').eq('user_id', item.user_id).eq('session_id', item.session_id).order('seq').limit(101);
      if (error) throw error;
      if (!data?.length || data[0].seq !== 0) throw new Error('This session has no opening snapshot or has expired.');
      let events = [], total = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i].seq !== i) throw new Error('Some of this session has not uploaded yet. Refresh shortly.');
        const decoded = await decode(data[i].payload); total += JSON.stringify(decoded).length;
        if (total > 40000000) throw new Error('This session exceeds the playback limit.');
        events.push(...decoded);
      }
      if (token !== request) return;
      if (!events.some(e => e.type === 2) || events.length < 2) throw new Error('This replay has no usable screen snapshot.');
      events.sort((a, b) => a.timestamp - b.timestamp);
      player = new rrweb.Replayer(events, { root: $('player'), skipInactive: true, mouseTail: false, UNSAFE_replayCanvas: false, showWarning: false });
      duration = player.getMetaData().totalTime; $('seek').max = Math.max(duration, 1); $('seek').value = 0;
      $('controls').hidden = false; $('errors').replaceChildren();
      events.filter(e => e.type === 5 && e.data.tag === 'balance-error').slice(0, 30).forEach(e => {
        const offset = e.timestamp - events[0].timestamp, button = document.createElement('button');
        button.textContent = 'Error at ' + fmt(offset); button.onclick = () => player?.pause(Math.max(0, offset - 3000)); $('errors').append(button);
      });
      const markers = events.filter(e => e.type === 5 && e.data.tag === 'balance-onboarding');
      $('onboarding-summary').textContent = markers.length
        ? 'Last recorded: ' + markerLabel(markers[markers.length - 1].data.payload) + '. Select a step to jump there. Taps outside the highlight are observations, not confirmed problems.'
        : 'This recording has no onboarding step markers. Older replays can still show the screen activity.';
      markers.slice(-500).forEach(e => {
        const offset = Math.max(0, e.timestamp - events[0].timestamp), button = document.createElement('button');
        button.textContent = fmt(offset) + ' · ' + markerLabel(e.data.payload);
        button.onclick = () => player?.pause(Math.max(0, offset - 1000));
        $('onboarding-timeline').append(button);
      });
      player.on('resize', size); player.pause(0); size();
      $('session-detail').textContent = new Date(item.started_at).toLocaleString() + ' · ' + fmt(duration) + ' · ' + item.error_count + ' recorded errors. Masked areas are expected; native screens and other apps are not captured.';
      status('Replay loaded.');
    } catch (e) { if (token === request) { destroy(); $('session-detail').textContent = e.message || 'Could not load this replay.'; status('Replay unavailable.'); } }
  }
  async function list(older) {
    const token = ++listRequest;
    status('Loading sessions…'); $('older').disabled = true;
    try {
      const args = { search_text: $('search').value.trim() }; if (older && cursor) args.before_time = cursor;
      const { data, error } = await client.rpc('list_app_replays', args);
      if (error) throw error;
      if (token !== listRequest) return;
      if (!older) { sessions = []; $('sessions').replaceChildren(); }
      for (const item of data || []) {
        if (sessions.some(s => s.session_id === item.session_id && s.user_id === item.user_id)) continue;
        sessions.push(item);
        const button = document.createElement('button'); button.className = 'session'; button.dataset.session = item.session_id; button.setAttribute('aria-pressed','false');
        const name = document.createElement('strong'), detail = document.createElement('span'); name.textContent = item.member_name;
        detail.textContent = new Date(item.started_at).toLocaleString() + ' · ' + fmt(item.last_ms - item.first_ms) + ' · ' + item.error_count + ' errors';
        button.append(name, detail); button.onclick = () => openSession(item); $('sessions').append(button);
      }
      cursor = data?.length ? data[data.length - 1].last_at : null; $('older').hidden = data?.length !== 50;
      status(sessions.length ? sessions.length + ' recent sessions. Select one to review.' : 'No replays yet for this search. Sessions appear after members open the updated app.');
    } catch (_) { status('Could not load sessions. Check your connection and admin sign-in, then refresh.'); }
    finally { $('older').disabled = false; }
  }
  $('play').onclick = () => player?.play(Number($('seek').value)); $('pause').onclick = () => player?.pause();
  $('seek').oninput = () => player?.pause(Number($('seek').value)); $('speed').onchange = () => player?.setConfig({ speed: Number($('speed').value) });
  $('search-form').onsubmit = event => { event.preventDefault(); list(false); }; $('refresh').onclick = () => list(false); $('older').onclick = () => list(true);
  $('theme').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; };
  if (matchMedia('(prefers-color-scheme:dark)').matches) document.documentElement.dataset.theme = 'dark';
  window.addEventListener('resize', size);
  setInterval(() => { if (!player) return; const time = Math.min(duration, Math.max(0, player.getCurrentTime())); $('seek').value = time; $('time').textContent = fmt(time) + ' / ' + fmt(duration); }, 250);
  async function init() {
    client = window.supabaseClient;
    if (!client) { status('Could not load sign-in. Reload this page.'); return; }
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.email?.toLowerCase() !== 'shannonbirch@cocospersonaltraining.com') { status('Sign in with your Balance administrator account to view replays.'); return; }
    client.auth.onAuthStateChange((_event, session) => { if (session?.user?.id !== data.user.id) { request++; listRequest++; destroy(); $('workspace').hidden = true; $('sessions').replaceChildren(); status('Admin session ended. Sign in again.'); } });
    $('workspace').hidden = false;
    $('search').value = new URLSearchParams(location.search).get('member') || '';
    await list(false);
    const requested = new URLSearchParams(location.search).get('session');
    if (requested && /^[0-9a-f-]{36}$/i.test(requested) && /^[0-9a-f-]{36}$/i.test($('search').value)) {
      let item = sessions.find(item => item.session_id === requested && item.user_id === $('search').value);
      if (!item) {
        // Exact linked lookup still uses admin RLS and seven-day expiry.
        const { data, error } = await client.from('app_replay_chunks').select('created_at,error_count,first_ms,last_ms').eq('user_id', $('search').value).eq('session_id', requested).order('seq').limit(101);
        if (!error && data?.length) item = { user_id: $('search').value, session_id: requested, member_name: sessions[0]?.member_name || 'Onboarding replay', started_at: data[0].created_at, error_count: data.reduce((sum, row) => sum + row.error_count, 0) };
      }
      if (item) await openSession(item);
      else status('This linked replay is unavailable or has expired. Replays are kept for seven days.');
    }
  }
  init().catch(() => status('Could not verify admin access. Reload this page.'));
})();
