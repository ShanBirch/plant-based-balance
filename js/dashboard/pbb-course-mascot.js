/* One on-demand 3D course companion, including iOS placeholder restoration. */
(function () {
    let libraryPromise;
    let loadTimer;
    function library() {
        if (customElements.get('model-viewer')) return Promise.resolve();
        if (libraryPromise) return libraryPromise;
        libraryPromise = new Promise((resolve, reject) => {
            let script = document.querySelector('script[data-course-model-viewer]');
            // Native iOS intentionally skips the Home WebGL loader. Only request
            // it when Course needs its small companion; don't change Home boot.
            if (!script) {
                script = document.createElement('script');
                script.type = 'module';
                script.dataset.courseModelViewer = 'true';
                script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';
                document.head.appendChild(script);
            }
            const timer = setTimeout(() => reject(new Error('3D viewer took too long')), 20000);
            script.addEventListener('error', () => {
                clearTimeout(timer); script.remove(); reject(new Error('3D viewer unavailable'));
            }, { once: true });
            customElements.whenDefined('model-viewer').then(() => { clearTimeout(timer); resolve(); });
        }).catch(error => { libraryPromise = null; throw error; });
        return libraryPromise;
    }
    function status(text, failed) {
        const el = document.getElementById('learnMascotStatus');
        if (el) el.textContent = text;
        const avatar = document.getElementById('learnMascotAvatar');
        if (avatar) avatar.classList.toggle('model-error', !!failed);
    }
    function prepare(retry) {
        if (window._pbbDisableCharacterModel && !retry) {
            status('Tap to load', true); return;
        }
        let model = typeof window._pbbRestorePlaceholder === 'function'
            ? window._pbbRestorePlaceholder('mascot-model') : document.getElementById('mascot-model');
        if (!model || model.tagName.toLowerCase() !== 'model-viewer') return;
        if (!model.dataset.courseBound) {
            model.dataset.courseBound = 'true';
            model.addEventListener('load', () => {
                clearTimeout(loadTimer);
                model.closest('.learn-mascot-avatar').classList.add('model-ready');
                status('', false);
                if (!document.getElementById('learnMascot')?.classList.contains('visible')) model.pause?.();
            });
            model.addEventListener('error', () => {
                clearTimeout(loadTimer);
                model.closest('.learn-mascot-avatar').classList.remove('model-ready');
                status('Tap to retry', true);
            });
        }
        if (!retry && model.getAttribute('src')) return;
        status('Loading…', false);
        if (retry) model.removeAttribute('src');
        model.setAttribute('loading', 'eager');
        model.setAttribute('reveal', 'auto');
        model.setAttribute('src', model.dataset.lazySrc);
        clearTimeout(loadTimer);
        loadTimer = setTimeout(() => status('Tap to retry', true), 25000);
        library().catch(() => { clearTimeout(loadTimer); status('Tap to retry', true); });
    }
    window.BalanceCourseMascot = {
        prepare,
        show() {
            prepare();
            document.getElementById('mascot-model')?.play?.();
        },
        hide() { document.getElementById('mascot-model')?.pause?.(); },
        retryIfNeeded() {
            if (!document.getElementById('learnMascotAvatar')?.classList.contains('model-error')) return false;
            prepare(true); return true;
        }
    };
})();
