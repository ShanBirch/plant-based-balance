// Open an offer reached through a shared link or the page navigation.
(function () {
    function openLinkedOffer() {
        const id = window.location.hash.slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        const group = target.closest('details.support-group');
        if (group) group.open = true;
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
    window.addEventListener('hashchange', openLinkedOffer);
    if (window.location.hash) openLinkedOffer();
})();
