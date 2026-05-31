(function () {
    var MODEL_URL = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';
    var STAGE_ID = 'balance-character-stage';
    var MAX_TRIES = 160;

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

        if (typeof Avatar3D === 'undefined' || !window.THREE || !window.GLTFLoader || !window.MeshoptDecoder) {
            return false;
        }

        stage.dataset.avatarState = 'loading';

        var avatar = new Avatar3D(STAGE_ID, {
            width: 720,
            height: 980,
            showRoom: false,
            interactive: false,
            autoRotate: false,
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
        }).catch(function (err) {
            stage.dataset.avatarState = 'error';
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
