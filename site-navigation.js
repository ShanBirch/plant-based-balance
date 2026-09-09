(() => {
    const toggle = document.querySelector('.balance-menu-toggle');
    const drawer = document.querySelector('.balance-menu-drawer');
    if (!toggle || !drawer) return;
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
    drawer.addEventListener('close', () => toggle.setAttribute('aria-expanded', 'false'));
})();
