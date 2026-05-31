(function () {
    var MODEL_URL = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb?v=balance-showcase-1';
    var STAGE_ID = 'balance-character-stage';
    var MAX_TRIES = 240;
    var hasWarmedModel = false;

    function warmModelRequest() {
        if (hasWarmedModel) return;
        hasWarmedModel = true;

        try {
            var links = document.querySelectorAll('link[rel="preload"]');
            var exists = false;

            for (var i = 0; i < links.length; i++) {
                if (links[i].href === MODEL_URL) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                var link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'fetch';
                link.href = MODEL_URL;
                link.crossOrigin = 'anonymous';
                link.setAttribute('fetchpriority', 'high');
                link.setAttribute('data-balance-character-preload', 'true');
                document.head.appendChild(link);
            }
        } catch (err) {
            // Preload is a bonus. The real mount path still handles failures.
        }
    }

    function dependenciesReady() {
        return !!(window.Avatar3D && window.THREE && window.GLTFLoader && window.DRACOLoader);
    }

    function getMissingDependencies() {
        var missing = [];

        if (!window.Avatar3D) missing.push('Avatar3D');
        if (!window.THREE) missing.push('THREE');
        if (!window.GLTFLoader) missing.push('GLTFLoader');
        if (!window.DRACOLoader) missing.push('DRACOLoader');

        return missing.join(',');
    }

    function loadDependencies() {
        if (window.loadBalanceCharacterDeps) {
            return window.loadBalanceCharacterDeps();
        }

        return window.balanceCharacterDeps || null;
    }

    function playWaveLikeAnimation(avatar) {
        var preferred = ['greet', 'wave', 'hello', 'clap', 'dance', 'idle', 'stand'];

        for (var i = 0; i < preferred.length; i++) {
            if (avatar.playAnimation(preferred[i])) {
                return true;
            }
        }

        return false;
    }

    function mountCharacter() {
        var stage = document.getElementById(STAGE_ID);
        if (!stage) return true;

        if (stage.dataset.avatarState === 'loading' || stage.dataset.avatarState === 'ready') {
            return true;
        }

        if (!dependenciesReady()) {
            stage.dataset.avatarState = 'waiting';
            stage.dataset.avatarMissing = getMissingDependencies();
            return false;
        }

        stage.dataset.avatarState = 'loading';
        delete stage.dataset.avatarMissing;

        var avatar = new window.Avatar3D(STAGE_ID, {
            width: 720,
            height: 980,
            showRoom: false,
            interactive: false,
            autoRotate: false,
            cacheBustModel: false,
            maxPixelRatio: 1.25,
            enableShadows: false,
            modelUrl: MODEL_URL
        });

        window.balanceCharacterAvatar = avatar;

        avatar.initPromise.then(function () {
            var frame = stage.closest('.fitgotchi-live-frame');
            if (frame) frame.classList.add('is-live');

            avatar.state.mood = 'happy';
            avatar.state.energyLevel = 78;

            if (avatar.camera) {
                avatar.camera.position.set(0, 1.1, 4.6);
                avatar.camera.lookAt(0, 1, 0);
                avatar.camera.updateProjectionMatrix();
            }

            if (avatar.character) {
                avatar.character.rotation.y = -Math.PI / 2;
            }

            avatar.updateAnimationForMood();
            playWaveLikeAnimation(avatar);

            stage.dataset.avatarState = 'ready';
            pauseRenderWhenOffscreen(avatar, frame || stage);
        }).catch(function (err) {
            stage.dataset.avatarState = 'error';
            console.warn('Balance character failed to load', err);
        });

        return true;
    }

    function pauseRenderWhenOffscreen(avatar, target) {
        if (!avatar || !target || !('IntersectionObserver' in window)) return;

        var observer = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                avatar.isRenderPaused = !entries[i].isIntersecting;
            }
        }, {
            rootMargin: '220px 0px',
            threshold: 0.02
        });

        observer.observe(target);
        avatar.renderPauseObserver = observer;
    }

    function startCharacterLoader() {
        var tries = 0;
        var mountStarted = false;
        var shot = document.querySelector('.fitgotchi-live-frame');
        var target = document.querySelector('.character-showcase') || shot;

        if (!shot) return;
        warmModelRequest();

        function attemptMount() {
            if (mountCharacter()) {
                return;
            }

            tries += 1;
            if (tries >= MAX_TRIES) {
                return;
            }

            setTimeout(attemptMount, 100);
        }

        function beginMounting() {
            if (mountStarted) return;
            mountStarted = true;
            var depsPromise = loadDependencies();
            attemptMount();

            if (depsPromise && typeof depsPromise.then === 'function') {
                depsPromise.then(attemptMount);
            }

            window.addEventListener('balance:character-deps-ready', attemptMount, { once: true });
        }

        if ('IntersectionObserver' in window && target) {
            var mountObserver = new IntersectionObserver(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        mountObserver.disconnect();
                        beginMounting();
                        break;
                    }
                }
            }, {
                rootMargin: '2200px 0px',
                threshold: 0.01
            });

            mountObserver.observe(target);
            return;
        }

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(beginMounting, { timeout: 5000 });
            return;
        }

        setTimeout(beginMounting, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startCharacterLoader, { once: true });
    } else {
        startCharacterLoader();
    }
})();
