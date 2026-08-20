(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.getBrisbaneDateKey = api.getBrisbaneDateKey;
        root.shouldDisplayChallenge = api.shouldDisplayChallenge;
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    function getBrisbaneDateKey(now) {
        const parts = new Intl.DateTimeFormat('en-AU', {
            timeZone: 'Australia/Brisbane',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(now instanceof Date ? now : new Date(now || Date.now()));
        const values = {};
        parts.forEach(function(part) {
            if (part.type !== 'literal') values[part.type] = part.value;
        });
        return `${values.year}-${values.month}-${values.day}`;
    }

    function shouldDisplayChallenge(challenge, now) {
        if (!challenge || !challenge.end_date) return true;
        const endDateKey = String(challenge.end_date).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateKey)) return true;
        return getBrisbaneDateKey(now) <= endDateKey;
    }

    return { getBrisbaneDateKey, shouldDisplayChallenge };
});
