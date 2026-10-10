/* Recipient playback receipts. Opening a conversation is never a playback event. */
(function (root) {
  'use strict';
  const audioUrl = message => (String(message || '').match(/\[AUDIO:(https?:\/\/[^\s\]]+)\]/i) || [])[1];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clock = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  const date = value => new Date(value).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  function bind(audio, message, userId, client) {
    const url = audioUrl(message.message);
    if (!url || !message.id || message.receiver_id !== userId || message.sender_id === userId || audio.__voiceReceipt) return;
    let playing = false, previous = null, previousWall = null, ranges = [], dirty = false, started = false;
    let lastFlush = 0, pending = Promise.resolve(), disposed = false, endedPending = false;
    const now = () => Date.now();
    const duration = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    // Only contiguous advancing media time while playing counts. Seeking creates a new segment.
    function sample() {
      const wall = now(), position = Number(audio.currentTime);
      if (playing && !audio.seeking && previous !== null && previousWall !== null) {
        const delta = position - previous, elapsed = (wall - previousWall) / 1000;
        if (delta > 0 && delta <= elapsed * Math.max(1, audio.playbackRate || 1) + 0.75) {
          for (let start = previous; start < position; start += 10) ranges.push([start, Math.min(start + 10, position)]);
          dirty = true;
        }
      }
      previous = position; previousWall = wall;
    }
    function flush(ended) {
      endedPending = endedPending || !!ended;
      if (!started || !duration() || (!dirty && !endedPending)) return pending;
      const batch = ranges; ranges = []; dirty = false; lastFlush = now();
      const atEnd = endedPending; endedPending = false;
      const measuredDuration = duration();
      pending = pending.then(async () => {
        try {
          const chunks = Math.max(1, Math.ceil(batch.length / 200));
          for (let i = 0; i < chunks; i++) {
            const result = await client.rpc('record_voice_feedback_playback', {
              p_message_id: message.id, p_audio_url: url, p_duration: measuredDuration,
              p_ranges: batch.slice(i * 200, (i + 1) * 200), p_ended: atEnd && i === chunks - 1
            });
            if (result.error) throw result.error;
          }
        } catch (_) {
          // Keep unsaved coverage for the next play/progress/pause. Never block the player.
          ranges.unshift(...batch); dirty = true; endedPending = endedPending || atEnd;
        }
      });
      return pending;
    }
    const handlers = {
      playing() { started = true; playing = true; previous = Number(audio.currentTime); previousWall = now(); dirty = true; flush(false); },
      timeupdate() { sample(); if (now() - lastFlush >= 10000) flush(false); },
      seeking() { previous = null; previousWall = null; },
      seeked() { previous = Number(audio.currentTime); previousWall = now(); },
      pause() { sample(); playing = false; flush(false); },
      waiting() { sample(); playing = false; flush(false); },
      ended() { sample(); playing = false; flush(true); },
      error() { sample(); playing = false; flush(false); }
    };
    Object.entries(handlers).forEach(([name, fn]) => audio.addEventListener(name, fn));
    const hide = () => { sample(); flush(false); };
    root.addEventListener('pagehide', hide);
    const visibility = () => { if (root.document.visibilityState === 'hidden') hide(); };
    root.document.addEventListener('visibilitychange', visibility);
    audio.__voiceReceipt = {
      flush,
      dispose() {
        if (disposed) return; disposed = true; sample(); playing = false; flush(false);
        Object.entries(handlers).forEach(([name, fn]) => audio.removeEventListener(name, fn));
        root.removeEventListener('pagehide', hide); root.document.removeEventListener('visibilitychange', visibility);
      }
    };
  }
  function dispose(container) {
    container.querySelectorAll('audio').forEach(audio => { if (audio.__voiceReceipt) audio.__voiceReceipt.dispose(); });
  }
  function attach(container, messages, userId, client) {
    container.querySelectorAll('audio[data-voice-message-id]').forEach(audio => {
      const message = messages.find(m => m.id === audio.dataset.voiceMessageId);
      if (message) bind(audio, message, userId, client);
    });
  }
  function render(rows) {
    if (!rows.length) return '';
    return '<section aria-label="Voice feedback playback" style="padding:12px;margin-bottom:16px;border:1px solid var(--admin-border,#cbd5e1);border-radius:12px;background:var(--admin-surface,#fff);color:var(--admin-text,#172033);overflow-wrap:anywhere;-webkit-text-fill-color:var(--admin-text,#172033);">'
      + '<strong>Voice feedback playback</strong><p style="font-size:12px;margin:6px 0 10px;">Read and playback are separate. Completed means the player reached the end after playing at least 95% of the note. Older notes start tracking on their next play.</p>'
      + rows.map(row => {
        const status = row.completed_at ? 'Completed playback' : row.started_at ? 'Started playing' : 'No playback recorded';
        const progress = row.started_at ? ' · ' + clock(Number(row.listened_seconds)) + ' / ' + clock(Number(row.duration_seconds)) + ' unique audio played (' + Math.min(100, Math.round(Number(row.listened_seconds) / Number(row.duration_seconds) * 100)) + '%)' : '';
        const read = row.read_at ? 'Marked read ' + date(row.read_at) : 'Not marked read';
        const played = row.last_played_at ? ' · Last played ' + date(row.last_played_at) : '';
        return '<div style="border-top:1px solid #e2e8f0;padding:9px 0;font-size:13px;line-height:1.5;">'
          + '<div>' + esc(row.label) + ' · Sent ' + esc(date(row.sent_at)) + '</div><strong>' + status + '</strong>' + esc(progress)
          + '<div style="font-size:12px;">' + esc(read + played) + '</div></div>';
      }).join('') + '</section>';
  }
  root.VoiceFeedbackPlayback = { attach, dispose, bind, render, audioUrl };
  if (typeof module !== 'undefined') module.exports = root.VoiceFeedbackPlayback;
})(typeof window !== 'undefined' ? window : globalThis);
