(() => {
    const toggle = document.querySelector('.balance-menu-toggle');
    const drawer = document.querySelector('.balance-menu-drawer');
    if (!toggle || !drawer) return;
    // Keep older cached pages connected to newly available public destinations.
    const nav = drawer.querySelector('nav');
    if (nav && !nav.querySelector('a[href="/plant-based-challenge"]')) {
        const challenge = document.createElement('a');
        challenge.href = '/plant-based-challenge';
        challenge.textContent = 'Plant-Based Challenge';
        challenge.dataset.track = 'cta_click';
        challenge.dataset.cta = 'navigation_challenge';
        const learn = nav.querySelector('a[href="/founders"]');
        if (learn) learn.after(challenge);
        else nav.append(challenge);
    }
    toggle.addEventListener('click', () => {
        drawer.showModal();
        toggle.setAttribute('aria-expanded', 'true');
    });
    drawer.querySelector('.balance-menu-close').addEventListener('click', () => drawer.close());
    drawer.addEventListener('click', (event) => {
        const bounds = drawer.getBoundingClientRect();
        if (event.target === drawer && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) drawer.close();
        if (event.target.closest('a')) drawer.close();
    });
    drawer.addEventListener('close', () => {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus({ preventScroll: true });
    });
    window.addEventListener('pageshow', () => { if (drawer.open) drawer.close(); });
})();
