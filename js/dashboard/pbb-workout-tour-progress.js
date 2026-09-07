(function(root) {
    'use strict';
    // Tour-only acknowledgement state. Never writes exercise values or logs.
    function create() {
        let signature = '';
        let acknowledged = new Set();
        let active = -1;
        let count = 0;
        let phase = 'fields';
        function sync(workout, ids, index) {
            const nextSignature = JSON.stringify([workout, ids]);
            if (nextSignature !== signature) {
                signature = nextSignature;
                acknowledged = new Set();
                active = -1;
            }
            count = ids.length;
            const next = Number.isInteger(index) && index >= 0 && index < count ? index : -1;
            if (active !== next) phase = 'fields';
            active = next;
            return view();
        }
        function view() {
            const missing = Array.from({length:count}, (_, i) => i).find(i => !acknowledged.has(i));
            return {active, count, seen:acknowledged.size, phase,
                complete:count > 0 && acknowledged.size === count,
                direction: missing === undefined || active < 0 ? null : (missing < active ? 'prev' : 'next')};
        }
        function acknowledge() {
            if (active < 0) return view();
            acknowledged.add(active);
            phase = 'navigate';
            return view();
        }
        return {sync, view, acknowledge};
    }
    const api = {create};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.PBBWorkoutTourProgress = api;
})(typeof window !== 'undefined' ? window : null);
