(function (root) {
  'use strict';
  // A second pass runs before upload AND before playback. Never retain arbitrary
  // DOM attributes, URLs, script bodies, form values, or custom/plugin payloads.
  const labels = new Set(['Home', 'Nutrition', 'Movement', 'Course', 'Calendar', 'Feed', 'Profile', 'Settings', 'Save', 'Cancel', 'Close', 'Next', 'Back', 'Done', 'Retry', 'Loading...', 'BALANCE', 'Balance']);
  const blocked = 'input,textarea,select,[contenteditable],img,picture,svg,canvas,video,audio,iframe,object,embed,script,template,[data-replay-private],.rr-block';
  const mask = text => labels.has(String(text).trim()) ? String(text) : String(text || '').replace(/\S/g, '*');
  const setupSteps = new Set(['setup', 'saving_plan', 'goal_setup_ready', 'gender', 'name', 'age', 'height', 'weight', 'why_now', 'main_blocker', 'weekly_capacity', 'equipment_access', 'activity_level', 'energy_level', 'movement_limits', 'dietary_requirements']);
  function onboarding(value) {
    if (!value || !['setup', 'question', 'screen', 'tour', 'task', 'payment', 'course'].includes(value.phase)) return null;
    const step = String(value.step || '');
    return {
      phase: value.phase,
      step: setupSteps.has(step) || /^slide_(?:[1-9]|1[0-9])$/.test(step) ? step : '',
      step_number: Math.min(100, Math.max(0, Number(value.step_number) || 0)),
      status: ['viewed', 'completed', 'skipped', 'blocked', 'left'].includes(value.status) ? value.status : 'viewed',
      action: ['progress', 'outside_highlight', 'app_hidden', 'app_returned', 'page_left', 'recording_resumed'].includes(value.action) ? value.action : 'progress'
    };
  }
  function css(value) {
    return String(value || '').replace(/url\s*\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^)]*)\s*\)/gi, 'none').replace(/@import[^;]+;?/gi, '').replace(/content\s*:[^;}]+/gi, 'content: ""');
  }
  function attrs(source) {
    const result = {};
    for (const [key, value] of Object.entries(source || {})) {
      if (key === 'style' || key === '_cssText') result[key] = css(value);
      else if (['class', 'id'].includes(key)) result[key] = String(value).split(/\s+/).filter(v => /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/.test(v)).join(' ');
      else if (['type', 'disabled', 'hidden', 'open', 'checked', 'selected', 'dir', 'colspan', 'rowspan', 'rr_width', 'rr_height', 'width', 'height', 'rr_scrollLeft', 'rr_scrollTop'].includes(key)) result[key] = String(value).slice(0, 40);
    }
    return result;
  }
  function node(n) {
    if (!n || typeof n !== 'object') return n;
    const out = { ...n };
    if (out.type === 5) out.textContent = ''; // comments
    else if ('textContent' in out) out.textContent = out.isStyle ? css(out.textContent) : mask(out.textContent);
    if (out.type === 2) {
      out.attributes = attrs(out.attributes);
      if (/^(script|iframe|object|embed|input|textarea|select|img|picture|svg|canvas|video|audio|template)$/i.test(out.tagName)) {
        out.tagName = 'div'; out.childNodes = []; out.attributes = { class: 'rr-block', rr_width: out.attributes.rr_width || '0px', rr_height: out.attributes.rr_height || '0px' };
      }
    }
    if (out.childNodes) out.childNodes = out.childNodes.map(node);
    return out;
  }
  function event(e) {
    if (!e || !Number.isFinite(e.timestamp)) return null;
    const d = e.data || {};
    if (e.type === 0 || e.type === 1) return { type: e.type, timestamp: e.timestamp, data: {} };
    if (e.type === 4) return { type: 4, timestamp: e.timestamp, data: { href: 'https://plantbased-balance.org/dashboard.html', width: d.width, height: d.height } };
    if (e.type === 2) return { type: 2, timestamp: e.timestamp, data: { node: node(d.node), initialOffset: d.initialOffset } };
    if (e.type === 5 && d.tag === 'balance-error') return { type: 5, timestamp: e.timestamp, data: { tag: 'balance-error', payload: {} } };
    if (e.type === 5 && d.tag === 'balance-onboarding') {
      const payload = onboarding(d.payload);
      return payload ? { type: 5, timestamp: e.timestamp, data: { tag: 'balance-onboarding', payload } } : null;
    }
    if (e.type !== 3) return null;
    let data;
    if (d.source === 0) data = { source: 0, adds: (d.adds || []).map(a => ({ parentId: a.parentId, nextId: a.nextId, node: node(a.node) })), removes: (d.removes || []).map(a => ({ parentId: a.parentId, id: a.id })), texts: (d.texts || []).map(t => ({ id: t.id, value: mask(t.value) })), attributes: (d.attributes || []).map(a => ({ id: a.id, attributes: attrs(a.attributes) })) };
    else if ([1, 6].includes(d.source)) data = { source: d.source, positions: (d.positions || []).map(p => ({ x: p.x, y: p.y, id: p.id, timeOffset: p.timeOffset })) };
    else if (d.source === 2) data = { source: 2, type: d.type, id: d.id, x: d.x, y: d.y };
    else if (d.source === 3) data = { source: 3, id: d.id, x: d.x, y: d.y };
    else if (d.source === 4) data = { source: 4, width: d.width, height: d.height };
    else return null; // no inputs, media, canvas, CSSOM, selection or plugins
    return { type: 3, timestamp: e.timestamp, data };
  }
  root.BalanceReplayPrivacy = { mask, blocked, event, onboarding };
  if (typeof module !== 'undefined') module.exports = root.BalanceReplayPrivacy;
})(typeof window !== 'undefined' ? window : globalThis);
