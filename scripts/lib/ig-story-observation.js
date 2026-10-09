// Paste these definitions into cua_repl after reading this file. No hidden state,
// network requests, DOM mutation, drafting, claims or message sending.
function parseInstagramStorySource(url, expectedHandle) {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/^\/stories\/([^/]+)\/(\d+)\/?$/);
    if (u.hostname !== 'www.instagram.com' || !match ||
        match[1].toLowerCase() !== expectedHandle.toLowerCase()) return null;
    return { creator: match[1].toLowerCase(), storyId: match[2],
      url: 'https://www.instagram.com/stories/' + match[1] + '/' + match[2] + '/' };
  } catch { return null; }
}

async function readInstagramStoryVideo(tab, expectedHandle) {
  const play = tab.playwright.getByRole('button', { name: 'Play', exact: true });
  const pause = tab.playwright.getByRole('button', { name: 'Pause', exact: true });
  const reply = tab.playwright.getByRole('textbox', {
    name: 'Reply to ' + expectedHandle + '...', exact: true });
  // Inspect rendered media only. Instagram also preloads hidden neighbouring videos.
  const media = await tab.playwright.evaluate(() =>
    Array.from(document.querySelectorAll('video')).filter(v => {
      const r = v.getBoundingClientRect();
      return r.width > 0 && r.height > 0 &&
        getComputedStyle(v).visibility !== 'hidden' &&
        getComputedStyle(v).display !== 'none';
    }).map(v => ({ src: v.currentSrc, paused: v.paused,
      time: v.currentTime, duration: Number.isFinite(v.duration) ? v.duration : null,
      ready: v.readyState, width: v.videoWidth, height: v.videoHeight,
      muted: v.muted })));
  return { observedAt: Date.now(), source: parseInstagramStorySource(await tab.url(), expectedHandle),
    replyVisible: await reply.isVisible(), playVisible: await play.isVisible(),
    pauseVisible: await pause.isVisible(), media };
}

function assessInstagramStoryVideo(first, second) {
  const fail = reason => ({ readyForVisualReview: false, reason });
  if (!first?.source || !second?.source) return fail('immutable_story_source_missing');
  if (first.source.creator !== second.source.creator ||
      first.source.storyId !== second.source.storyId) return fail('creator_or_story_changed');
  if (!first.replyVisible || !second.replyVisible) return fail('exact_reply_destination_missing');
  if (!first.playVisible || !second.playVisible ||
      first.pauseVisible || second.pauseVisible) return fail('native_pause_not_confirmed');
  if (second.observedAt - first.observedAt < 500) return fail('independent_read_too_soon');
  if (first.media?.length !== 1 || second.media?.length !== 1)
    return fail('visible_video_ambiguous_or_missing');
  const a = first.media[0], b = second.media[0];
  for (const m of [a, b]) {
    if (!m.src || m.ready < 2 || !m.width || !m.height ||
        !Number.isFinite(m.time) || !Number.isFinite(m.duration) || m.duration <= 0)
      return fail('video_not_loaded');
    if (m.paused !== true) return fail('video_still_playing');
  }
  if (a.src !== b.src || a.duration !== b.duration ||
      Math.abs(a.time - b.time) > 0.05) return fail('media_or_time_changed');
  // End cards/black frames are frequent at the boundary. Reopen/review, never infer.
  if (b.duration - b.time < 0.3) return fail('video_at_end_boundary');
  return { readyForVisualReview: true, reason: 'loaded_frozen_exact_video',
    source: second.source, time: b.time, muted: b.muted,
    // This is mechanical readiness, NOT comprehension or permission to send.
    requiresVisualReview: true, requiresPlaybackReview: true,
    requiresFreshEligibilityAndClaim: true };
}

async function freezeInstagramStory(tab) {
  const reply = tab.playwright.getByRole('textbox', { name: /^Reply to / });
  const pause = tab.playwright.getByRole('button', { name: 'Pause', exact: true });
  const play = tab.playwright.getByRole('button', { name: 'Play', exact: true });
  await reply.waitFor({ state: 'visible', timeoutMs: 4000 });
  if (await pause.isVisible()) await pause.click();
  try { await play.waitFor({ state: 'visible', timeoutMs: 1500 }); }
  catch (error) {
    // One conditional recovery only; do not toggle a control that already changed.
    if (!(await reply.isVisible()) || !(await pause.isVisible())) throw error;
    await pause.click();
    await play.waitFor({ state: 'visible', timeoutMs: 2000 });
  }
}

async function openInstagramStoryVideo(tab, openStory, expectedHandle) {
  const reply = tab.playwright.getByRole('textbox', { name: /^Reply to / });
  const entry = tab.playwright.getByRole('button', { name: 'View story', exact: true });
  await openStory();
  await reply.or(entry).waitFor({ state: 'visible', timeoutMs: 4000 });
  if (await entry.isVisible()) await entry.click();
  await reply.waitFor({ state: 'visible', timeoutMs: 4000 });
  const openedSource = parseInstagramStorySource(await tab.url(), expectedHandle);
  if (!openedSource) throw new Error('immutable_story_source_missing');
  // A pre-load Play icon can revert to Pause when Instagram hydrates video.
  // Wait for rendered video data, without changing playback or page state.
  const loaded = await tab.playwright.evaluate(async () => {
    const deadline = Date.now() + 4000;
    do {
      const videos = Array.from(document.querySelectorAll('video')).filter(v => {
        const r = v.getBoundingClientRect();
        return r.width > 0 && r.height > 0 &&
          getComputedStyle(v).visibility !== 'hidden' &&
          getComputedStyle(v).display !== 'none';
      });
      if (videos.length === 1 && videos[0].readyState >= 2 &&
          videos[0].videoWidth > 0 && videos[0].videoHeight > 0) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    return false;
  }, undefined, { timeoutMs: 5000 });
  if (!loaded) throw new Error('video_not_loaded');
  const loadedSource = parseInstagramStorySource(await tab.url(), expectedHandle);
  if (!loadedSource || openedSource.storyId !== loadedSource.storyId)
    throw new Error('creator_or_story_changed');
  await freezeInstagramStory(tab);
  return readInstagramStoryVideo(tab, expectedHandle);
}

if (typeof module !== 'undefined') module.exports = {
  parseInstagramStorySource, readInstagramStoryVideo, assessInstagramStoryVideo,
  freezeInstagramStory, openInstagramStoryVideo };
