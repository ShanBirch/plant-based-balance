(() => {
    const gallery = document.getElementById('learn-phone-gallery');
    if (!gallery) return;
    const buttons = [...document.querySelectorAll('[data-gallery-step]')];
    const update = () => {
        buttons[0].disabled = gallery.scrollLeft <= 2;
        buttons[1].disabled = gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 2;
    };
    buttons.forEach(button => button.addEventListener('click', () => {
        const slides = [...gallery.children];
        const step = slides[1].offsetLeft - slides[0].offsetLeft;
        const index = Math.round(gallery.scrollLeft / step) + Number(button.dataset.galleryStep);
        gallery.scrollTo({ left: Math.max(0, index) * step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }));
    gallery.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
})();
