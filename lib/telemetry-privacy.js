(function (root) {
  'use strict';
  const REDACTED = '[redacted]';
  const sensitive = /password|passcode|token|secret|authorization|bearer|apikey|privatekey|credential|authcode|oauthcode|signature/i;
  const privateKey = /password|passcode|token|secret|authorization|credential|apikey|privatekey|card|cvv|cvc|expiry|email|phone|message|content|answer|response|photo|image|audio|transcript|notes?|body|text|url/i;

  function decode(value) {
    let result = String(value == null ? '' : value);
    for (let i = 0; i < 5; i++) {
      const previous = result;
      result = result.replace(/\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi,
        (_, unicode, hex) => String.fromCharCode(parseInt(unicode || hex, 16)))
        .replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_, hex, decimal) => String.fromCodePoint(Math.min(0x10ffff, parseInt(hex || decimal, hex ? 16 : 10))))
        .replace(/&(?:amp|quest|num|colon|sol|equals);/gi, entity => ({ '&amp;': '&', '&quest;': '?', '&num;': '#', '&colon;': ':', '&sol;': '/', '&equals;': '=' }[entity.toLowerCase()]));
      // Decode byte escapes individually too, so a malformed escape cannot hide a delimiter.
      result = result.replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      if (result === previous) break;
    }
    return result;
  }

  function hasCredential(value) {
    return sensitive.test(decode(value).replace(/[^a-z0-9]/gi, ''));
  }

  function string(value) {
    let clean = decode(value).replace(/\\\//g, '/').replace(/\\/g, '/');
    if (/%[0-9a-f]{2}|\b(?:data|javascript|blob):/i.test(clean)) return REDACTED;
    // Keep paths and stack line/column suffixes, discard URL userinfo and all query/fragment values.
    clean = clean.replace(/((?:[a-z][\w+.-]*:)?\/\/)[^\s/]*@/gi, '$1')
      .replace(/[?#][^\r\n]*/g, '');
    if (/[^/\s]+:[^@\s]+@/.test(clean)) return REDACTED;
    if (hasCredential(clean) || /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/i.test(clean)) return REDACTED;
    return clean.slice(0, 120);
  }

  function sourceFile(value) {
    const clean = string(value);
    if (clean === REDACTED) return 'redacted';
    return clean.replace(/\\/g, '/').split('/').pop() || 'unknown';
  }

  function sanitize(value, depth = 0) {
    if (depth > 3 || value == null) return value == null ? null : undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') return string(value);
    if (Array.isArray(value)) return value.slice(0, 12).map(item => sanitize(item, depth + 1)).filter(item => item !== undefined);
    if (typeof value !== 'object') return undefined;
    const output = {};
    Object.keys(value).slice(0, 30).forEach(key => {
      const decodedKey = decode(key);
      if (privateKey.test(decodedKey.replace(/[^a-z0-9]/gi, ''))) return;
      const safeKey = string(decodedKey);
      if (safeKey === REDACTED) return;
      const cleanKey = safeKey.toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_').slice(0, 80);
      if (!cleanKey || ['__proto__', 'constructor', 'prototype'].includes(cleanKey)) return;
      const clean = cleanKey === 'source_file' ? sourceFile(value[key]) : sanitize(value[key], depth + 1);
      if (clean !== undefined) output[cleanKey] = clean;
    });
    return output;
  }

  root.BalanceTelemetryPrivacy = { sanitize, string, sourceFile, hasCredential };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.BalanceTelemetryPrivacy;
})(typeof window === 'undefined' ? globalThis : window);
