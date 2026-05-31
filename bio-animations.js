(function () {
    const revealTargets = document.querySelectorAll('.reveal');
    const motionTargets = document.querySelectorAll('.feature-motion-card');
    if (!revealTargets.length && !motionTargets.length) return;

    const prefersReducedMotion = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        revealTargets.forEach((el) => el.classList.add('visible'));
        motionTargets.forEach((el) => el.classList.add('is-motion-live'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
        });
    }, {
        threshold: 0.14,
        rootMargin: '0px 0px -40px 0px',
    });

    revealTargets.forEach((el) => observer.observe(el));
    window.bioRevealObserver = observer;

    const motionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            entry.target.classList.toggle('is-motion-live', entry.isIntersecting);
        });
    }, {
        threshold: 0.08,
        rootMargin: '180px 0px',
    });

    motionTargets.forEach((el) => motionObserver.observe(el));
    window.bioMotionObserver = motionObserver;
})();
