(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let client, player, sessions = [], cursor, selected, request = 0, listRequest = 0, duration = 0;
  const fmt = ms => Math.floor(ms / 60000) + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  function status(text) { $('status').textContent = text; }
  function destroy() { if (player) player.destroy(); player = null; $('player').replaceChildren(); $('controls').hidden = true; }
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
      events.filter(e => e.type === 5).slice(0, 30).forEach(e => {
        const offset = e.timestamp - events[0].timestamp, button = document.createElement('button');
        button.textContent = 'Error at ' + fmt(offset); button.onclick = () => player?.pause(Math.max(0, offset - 3000)); $('errors').append(button);
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
  }
  init().catch(() => status('Could not verify admin access. Reload this page.'));
})();
