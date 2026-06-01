(function () {
    var MODEL_URL = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';
    var STAGE_ID = 'balance-character-stage';
    var MAX_TRIES = 160;
    var progressTimer = null;
    var depsRequested = false;

    function getFrame(stage) {
        return stage ? stage.closest('.fitgotchi-live-frame') : null;
    }

    function setLoadingProgress(frame, percent, text) {
        if (!frame) return;

        var safePercent = Math.min(100, Math.max(0, Math.round(percent || 0)));
        var fill = frame.querySelector('.fitgotchi-loading-fill');
        var percentNode = frame.querySelector('.fitgotchi-loading-percent');
        var textNode = frame.querySelector('.fitgotchi-loading-text');

        frame.style.setProperty('--character-load-progress', safePercent + '%');
        frame.dataset.characterLoadProgress = String(safePercent);

        if (fill) fill.style.width = safePercent + '%';
        if (percentNode) percentNode.textContent = safePercent + '%';
        if (textNode && text) textNode.textContent = text;
    }

    function startSoftProgress(frame) {
        if (!frame || progressTimer) return;

        var percent = Number(frame.dataset.characterLoadProgress || 0);

        progressTimer = setInterval(function () {
            percent = Math.min(88, percent + (percent < 45 ? 5 : 2));
            setLoadingProgress(frame, percent, 'Loading character');

            if (percent >= 88) {
                clearInterval(progressTimer);
                progressTimer = null;
            }
        }, 420);
    }

    function stopSoftProgress() {
        if (!progressTimer) return;
        clearInterval(progressTimer);
        progressTimer = null;
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

        var frame = getFrame(stage);

        if (typeof Avatar3D === 'undefined' || !window.THREE || !window.GLTFLoader || !window.MeshoptDecoder) {
            if (!depsRequested && typeof window.loadBalanceCharacterDeps === 'function') {
                depsRequested = true;
                window.loadBalanceCharacterDeps();
            }

            if (frame) {
                frame.classList.add('is-loading');
            }

            setLoadingProgress(frame, 8, 'Preparing character');
            startSoftProgress(frame);
            return false;
        }

        stage.dataset.avatarState = 'loading';
        if (frame) {
            frame.classList.add('is-loading');
            setLoadingProgress(frame, 14, 'Loading character');
            startSoftProgress(frame);
        }

        var avatar = new Avatar3D(STAGE_ID, {
            width: 720,
            height: 980,
            showRoom: false,
            interactive: false,
            autoRotate: false,
            modelUrl: MODEL_URL,
            onModelProgress: function (progress) {
                if (!frame) return;

                if (Number.isFinite(progress.percent)) {
                    var modelPercent = 14 + (progress.percent * 0.82);
                    setLoadingProgress(frame, modelPercent, 'Loading character');
                } else {
                    startSoftProgress(frame);
                }
            }
        });

        window.balanceCharacterAvatar = avatar;

        avatar.initPromise.then(function () {
            stopSoftProgress();
            if (frame) {
                setLoadingProgress(frame, 100, 'Character ready');
                frame.classList.add('is-live');
                frame.classList.remove('is-loading');
            }

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
        }).catch(function (err) {
            stopSoftProgress();
            stage.dataset.avatarState = 'error';
            if (frame) {
                frame.classList.remove('is-loading');
                setLoadingProgress(frame, 100, 'Character unavailable');
            }
            console.warn('Balance character failed to load', err);
        });

        return true;
    }

    function startWhenVisible() {
        var tries = 0;
        var shot = document.querySelector('.fitgotchi-live-frame');

        if (!shot) return;

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

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        observer.disconnect();
                        attemptMount();
                        break;
                    }
                }
            }, {
                rootMargin: '160px 0px',
                threshold: 0.15
            });

            observer.observe(shot);
            return;
        }

        attemptMount();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startWhenVisible, { once: true });
    } else {
        startWhenVisible();
    }
})();
