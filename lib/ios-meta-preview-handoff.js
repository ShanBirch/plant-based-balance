/* Balance iOS paid-preview recovery handoff.
 *
 * iOS does not replay a custom URL after a first App Store install. This helper
 * keeps the short-lived signed preview query in the originating browser tab and
 * restores it only when that same tab carries the matching opaque recovery key.
 * The member must then explicitly tap the custom URL after Balance is installed.
 *
 * This is persistence, not trust: HMAC verification remains server-side in the
 * existing preview-event / checkout attribution paths.
 */
(function (root, factory) {
    const api = factory(root || {});
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BalanceIOSMetaPreviewHandoff = api;
})(typeof window !== 'undefined' ? window : globalThis, function (window) {
    'use strict';

    const VARIANT = 'facebook_5m_foundations_v3';
    const STORAGE_KEY = 'pbb_ios_meta_preview_handoff_v1';
    const HASH_PREFIX = '#ios-preview-return=';
    const MAX_REF_LIFETIME_MS = 24 * 60 * 60 * 1000;
    const CLOCK_SKEW_MS = 60 * 1000;
    const META_SOURCES = ['facebook', 'fb', 'instagram', 'ig', 'meta'];
    const PAID_MEDIA = ['paid_social', 'paidsocial', 'paid', 'cpc'];

    function normalizeParams(input) {
        if (input instanceof URLSearchParams) return new URLSearchParams(input.toString());
        return new URLSearchParams(String(input || '').replace(/^\?/, ''));
    }

    function isPaidPreviewParams(input) {
        const params = normalizeParams(input);
        const source = String(params.get('utm_source') || '').trim().toLowerCase();
        const medium = String(params.get('utm_medium') || '').trim().toLowerCase();
        return params.get('meta_trial') === VARIANT
            && META_SOURCES.includes(source)
            && PAID_MEDIA.includes(medium);
    }

    function decodeBase64Url(value) {
        const input = String(value || '');
        if (!/^[A-Za-z0-9_-]{20,100}$/.test(input)) return null;
        try {
            if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(input, 'base64url'));
            const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
            const decoded = window.atob(padded);
            return Uint8Array.from(decoded, function (character) { return character.charCodeAt(0); });
        } catch (_) {
            return null;
        }
    }

    function compactRefExpiryMs(token) {
        const bytes = decodeBase64Url(token);
        // v2 ref = version byte + UUID (16) + expires-at uint32 (4) + HMAC (12).
        if (!bytes || bytes.length !== 33 || bytes[0] !== 2) return null;
        const expiresAtSeconds = (
            (bytes[17] * 0x1000000)
            + (bytes[18] << 16)
            + (bytes[19] << 8)
            + bytes[20]
        );
        return expiresAtSeconds * 1000;
    }

    function hasPlausibleSignedRef(token, nowMs) {
        const now = Number.isFinite(nowMs) ? nowMs : Date.now();
        const expiresAt = compactRefExpiryMs(token);
        return Number.isFinite(expiresAt)
            && expiresAt > now
            && expiresAt <= now + MAX_REF_LIFETIME_MS + CLOCK_SKEW_MS;
    }

    function paidPreviewQuery(input, options) {
        const settings = options || {};
        const params = normalizeParams(input);
        if (params.get('meta_trial') !== VARIANT) return '';
        params.delete('guest');
        params.delete('meta_preview');
        params.set('account_first', '1');
        params.set('meta_trial', VARIANT);
        if (!isPaidPreviewParams(params)) return '';

        const token = String(params.get('meta_ref') || '').trim();
        if (settings.requireSignedRef && !token) return '';
        if (token && !hasPlausibleSignedRef(token, settings.nowMs)) return '';
        return params.toString();
    }

    function nonceFromCrypto(cryptoObject) {
        const cryptoApi = cryptoObject || window.crypto;
        try {
            if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
                return cryptoApi.randomUUID().replace(/-/g, '');
            }
            if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
                const values = new Uint8Array(16);
                cryptoApi.getRandomValues(values);
                return Array.from(values, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
            }
        } catch (_) {}
        return '';
    }

    function selectedStorage(settings) {
        if (Object.prototype.hasOwnProperty.call(settings || {}, 'storage')) return settings.storage;
        try { return window.localStorage || null; } catch (_) { return null; }
    }

    function buildRecovery(input, options) {
        const settings = options || {};
        const now = Number.isFinite(settings.nowMs) ? settings.nowMs : Date.now();
        const query = paidPreviewQuery(input, { requireSignedRef: true, nowMs: now });
        const nonce = String(settings.nonce || nonceFromCrypto(settings.crypto)).trim();
        if (!query || !/^[A-Za-z0-9]{24,80}$/.test(nonce)) return null;
        const token = new URLSearchParams(query).get('meta_ref');
        const refExpiry = compactRefExpiryMs(token);
        return {
            version: 1,
            nonce: nonce,
            query: query,
            savedAt: now,
            expiresAt: Math.min(now + MAX_REF_LIFETIME_MS, refExpiry),
        };
    }

    function remember(input, options) {
        const settings = options || {};
        const recovery = buildRecovery(input, settings);
        const storage = selectedStorage(settings);
        const location = settings.location || window.location;
        const history = settings.history || window.history;
        if (!recovery || !storage) return null;
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(recovery));
        } catch (_) {
            return null;
        }
        try {
            if (location && history && typeof history.replaceState === 'function') {
                const base = String(location.pathname || '') + String(location.search || '');
                history.replaceState(history.state || null, '', base + HASH_PREFIX + encodeURIComponent(recovery.nonce));
            }
        } catch (_) {}
        return recovery;
    }

    function recoveryNonce(location) {
        const hash = String(location && location.hash || '');
        if (!hash.startsWith(HASH_PREFIX)) return '';
        try { return decodeURIComponent(hash.slice(HASH_PREFIX.length)); } catch (_) { return ''; }
    }

    function recover(options) {
        const settings = options || {};
        const now = Number.isFinite(settings.nowMs) ? settings.nowMs : Date.now();
        const storage = selectedStorage(settings);
        const nonce = recoveryNonce(settings.location || window.location);
        if (!storage || !nonce) return null;
        let state;
        try { state = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); } catch (_) { state = null; }
        const query = state && state.version === 1 && state.nonce === nonce && Number(state.expiresAt) > now
            ? paidPreviewQuery(state.query, { requireSignedRef: true, nowMs: now })
            : '';
        if (!query) {
            try { storage.removeItem(STORAGE_KEY); } catch (_) {}
            return null;
        }
        return new URLSearchParams(query);
    }

    function buildNativePreviewUrl(input, options) {
        const query = paidPreviewQuery(input, {
            requireSignedRef: false,
            nowMs: options && options.nowMs,
        });
        return query ? 'com.fitgotchi.app://meta-trial?' + query : '';
    }

    return {
        VARIANT: VARIANT,
        STORAGE_KEY: STORAGE_KEY,
        HASH_PREFIX: HASH_PREFIX,
        MAX_REF_LIFETIME_MS: MAX_REF_LIFETIME_MS,
        isPaidPreviewParams: isPaidPreviewParams,
        compactRefExpiryMs: compactRefExpiryMs,
        hasPlausibleSignedRef: hasPlausibleSignedRef,
        paidPreviewQuery: paidPreviewQuery,
        buildRecovery: buildRecovery,
        remember: remember,
        recover: recover,
        buildNativePreviewUrl: buildNativePreviewUrl,
    };
});
