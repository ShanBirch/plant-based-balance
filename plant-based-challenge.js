(function () {
    'use strict';
    // Keep genuine campaign evidence, including signed DM references, on handoff.
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'campaign_id', 'adset_id', 'ad_id', 'creative_id',
        'placement', 'site_source_name', 'meta_ad_name', 'meta_ref'];
    const incoming = new URLSearchParams(location.search);
    const attribution = window.getAttributionData?.() || {};
    document.querySelectorAll('[data-challenge-booking]').forEach((link) => {
        const url = new URL('/book', location.origin);
        url.searchParams.set('source', 'plant_based_challenge');
        keys.forEach((key) => {
            const value = incoming.get(key) || attribution[key];
            if (value) url.searchParams.set(key, String(value).slice(0, 700));
        });
        if (incoming.get('analytics_test') === '1') url.searchParams.set('analytics_test', '1');
        link.href = url.pathname + url.search;
    });
}());
