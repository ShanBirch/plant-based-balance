(() => {
    const toggle = document.querySelector('.balance-menu-toggle');
    const drawer = document.querySelector('.balance-menu-drawer');
    if (!toggle || !drawer) return;
    // Keep older cached pages connected to newly available public destinations.
    const nav = drawer.querySelector('nav');
    const findDestination = (pathname) => Array.from(nav?.querySelectorAll('a[href]') || []).find(link => new URL(link.href, location.origin).pathname.replace(/\.html$/, '') === pathname);
    if (nav && !findDestination('/plant-based-challenge')) {
        const challenge = document.createElement('a');
        challenge.href = '/plant-based-challenge';
        challenge.textContent = 'Summer Ready Shred';
        challenge.dataset.track = 'cta_click';
        challenge.dataset.cta = 'navigation_challenge';
        const learn = findDestination('/founders');
        if (learn) learn.after(challenge);
        else nav.append(challenge);
    }
    if (nav) {
        const challenge = findDestination('/plant-based-challenge');
        if (challenge) { challenge.textContent = 'Summer Ready Shred'; nav.prepend(challenge); }
        const coaching = findDestination('/coaching');
        if (coaching) coaching.textContent = 'Coaching';
        const book = findDestination('/book');
        if (book) { const url = new URL(book.href, location.origin); if (!url.searchParams.has('source')) url.searchParams.set('source', 'plant_based_challenge'); book.href = url.pathname + url.search; }
        const current = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
        const destination = current === '/plant-based-fitness' ? '/founders'
            : ['/fitness', '/fitness-coaching'].includes(current) ? '/coaching'
            : current === '/balance' ? '/' : current;
        for (const link of nav.querySelectorAll('a')) {
            if (new URL(link.href, location.origin).pathname.replace(/\.html$/, '') === destination) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        }
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
