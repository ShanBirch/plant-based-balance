(function() {
    // ONE-TIME MIGRATION: fix cached model URLs that still contain the old /dbz/ path.
    // This was a bug where DBZ model URLs pointed to /shannonsvideos/dbz/ instead of /shannonsvideos/.
    // Without this, returning users who had a DBZ character selected see "could not load character".
    try {
        const cachedSrc = localStorage.getItem('fitgotchi_model_src');
        const normalizeModelSrc = (src) => window.pbbBustModelUrl ? window.pbbBustModelUrl(src) : src;
        if (cachedSrc && cachedSrc.includes('/shannonsvideos/dbz/')) {
            localStorage.setItem('fitgotchi_model_src', normalizeModelSrc(cachedSrc.replace('/shannonsvideos/dbz/', '/shannonsvideos/')));
        } else if (cachedSrc) {
            const busted = normalizeModelSrc(cachedSrc);
            if (busted && busted !== cachedSrc) localStorage.setItem('fitgotchi_model_src', busted);
        }
        // Also fix window._fitgotchiCachedModel if it was set by the early script
        if (window._fitgotchiCachedModel && window._fitgotchiCachedModel.includes('/shannonsvideos/dbz/')) {
            window._fitgotchiCachedModel = normalizeModelSrc(window._fitgotchiCachedModel.replace('/shannonsvideos/dbz/', '/shannonsvideos/'));
            // Also patch the model-viewer src directly if it's already been set
            const mv = document.getElementById('tamagotchi-model');
            if (mv && mv.getAttribute('src') && mv.getAttribute('src').includes('/shannonsvideos/dbz/')) {
                mv.setAttribute('src', normalizeModelSrc(mv.getAttribute('src').replace('/shannonsvideos/dbz/', '/shannonsvideos/')));
            }
        } else if (window._fitgotchiCachedModel) {
            window._fitgotchiCachedModel = normalizeModelSrc(window._fitgotchiCachedModel);
        }
    } catch(e) {}

    const RARE_TIERS = {
        LEGENDARY: { label: 'LEGENDARY', color: '#fbbf24', glow: 'rgba(251,191,36,0.4)', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', buyIn: 10000, weight: 1 },
        EPIC:      { label: 'EPIC',      color: '#a855f7', glow: 'rgba(168,85,247,0.4)', gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)', buyIn: 5000,  weight: 3 },
        RARE:      { label: 'RARE',      color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', buyIn: 2500,  weight: 5 },
        COMMON:    { label: 'COMMON',    color: '#6b7280', glow: 'rgba(107,114,128,0.4)', gradient: 'linear-gradient(135deg, #6b7280, #4b5563)', buyIn: 1000,  weight: 10 },
        CHARACTER: { label: 'CHARACTER', color: '#10b981', glow: 'rgba(16,185,129,0.4)', gradient: 'linear-gradient(135deg, #10b981, #059669)', buyIn: 0, weight: 0 }
    };

    const B2_MODEL_BASE = 'https://f005.backblazeb2.com/file/shannonsvideos/';
    const LEVEL_RARE_START_LEVEL = 55;
    const LEVEL_RARE_INTERVAL = 5;

    const CHALLENGE_RARE_COLLECTION = [
        { id: 'arny', name: 'The Governor', model: 'https://f005.backblazeb2.com/file/shannonsvideos/arny.glb', emoji: '🥋', desc: 'Legendary Proportions', tier: 'LEGENDARY' },
        { id: 'shanbot', name: 'Shanbot', model: 'https://f005.backblazeb2.com/file/shannonsvideos/shanbot_final.glb', emoji: '🦾', desc: 'The Original AI Companion', tier: 'LEGENDARY' },
        { id: 'optimus', name: 'Robot', model: 'https://f005.backblazeb2.com/file/shannonsvideos/optimus.glb', emoji: '🤖', desc: 'Next-Gen Automation', tier: 'EPIC' },
        { id: 'cbum', name: 'Callum', model: 'https://f005.backblazeb2.com/file/shannonsvideos/cbum.glb', emoji: '🥇', desc: 'Modern Classic Physique', tier: 'RARE' },
        { id: 'ronny', name: 'Ronny', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ronny.glb', emoji: '👑', desc: 'The King of Intensity', tier: 'RARE' },
        { id: 'steve_irwin', name: 'Croc Man', model: 'https://f005.backblazeb2.com/file/shannonsvideos/steve_irwin.glb', emoji: '🐊', desc: 'Nature\'s Champion', tier: 'RARE' },
    ];

    const LEVEL_RARE_COUNT = 79;
    const LEVEL_RARE_FILES = Array.from({ length: LEVEL_RARE_COUNT }, (_, index) => (index + 1) + '.glb');

    const LEVEL_RARE_COLLECTION = LEVEL_RARE_FILES.map((file, index) => {
        const unlockLevel = LEVEL_RARE_START_LEVEL + (index * LEVEL_RARE_INTERVAL);
        const characterNumber = index + 1;
        return {
            id: 'level_character_' + characterNumber,
            name: String(characterNumber),
            model: B2_MODEL_BASE + file,
            emoji: '⭐',
            desc: 'Character ' + characterNumber + ' unlocks at Level ' + unlockLevel,
            tier: 'CHARACTER',
            unlockLevel: unlockLevel,
            characterNumber: characterNumber,
            unlockSource: 'level'
        };
    });

    function shouldApplyCharacterColorsToModel(modelSrc, skinId) {
        if (typeof window.pbbShouldApplyCharacterColorsToModel === 'function') {
            return window.pbbShouldApplyCharacterColorsToModel(modelSrc, skinId);
        }
        if (/^level_character_[0-9]+$/i.test((skinId || '') + '')) return false;
        const clean = ((window.pbbStripModelVersion ? window.pbbStripModelVersion(modelSrc || '') : (modelSrc || '')) + '').toLowerCase().split('#')[0].split('?')[0];
        return !/\/[0-9]+\.glb$/.test(clean);
    }

    window.pbbShouldApplyCharacterColorsToModel = window.pbbShouldApplyCharacterColorsToModel || shouldApplyCharacterColorsToModel;

    (function normalizeActiveLevelCharacterSkinCache() {
        try {
            const activeRareSkinId = localStorage.getItem('active_rare_skin') || '';
            const match = activeRareSkinId.match(/^level_character_(\d+)$/);
            if (!match) return;
            const characterNumber = parseInt(match[1], 10);
            const rare = LEVEL_RARE_COLLECTION[characterNumber - 1];
            if (!rare) return;
            const rareModel = window.pbbBustModelUrl ? window.pbbBustModelUrl(rare.model) : rare.model;
            const stripModelVersion = (src) => window.pbbStripModelVersion ? window.pbbStripModelVersion(src) : src;

            const cachedSrc = localStorage.getItem('fitgotchi_model_src') || '';
            if (stripModelVersion(cachedSrc) !== stripModelVersion(rareModel) || cachedSrc !== rareModel) {
                localStorage.setItem('fitgotchi_model_src', rareModel);
            }
            if (window._fitgotchiCachedModel && window._fitgotchiCachedModel !== rareModel) {
                window._fitgotchiCachedModel = rareModel;
            }

            const mv = document.getElementById('tamagotchi-model');
            if (mv && mv.getAttribute('src') && mv.getAttribute('src') !== rareModel) {
                mv.setAttribute('src', rareModel);
            }
        } catch(e) {}
    })();

    const RARE_COLLECTION = CHALLENGE_RARE_COLLECTION;
    const CHARACTER_SKIN_COLLECTION = CHALLENGE_RARE_COLLECTION.concat(LEVEL_RARE_COLLECTION);


    // ============================================================
    // BACKGROUND MODEL PREFETCH - warm browser cache for 3D models
    // ============================================================
    (function prefetchRareModels() {
        // On iOS Safari, skip ALL background prefetching of rare 3D models.
        // Each GLB can be 5-20MB; fetching them all into the HTTP cache creates
        // memory pressure that contributes to OOM crashes during model swaps.
        // Models will load on-demand when the user selects them.
        if (window._pbbIsIOSSafari) {
            console.log('[Prefetch] Skipped on iOS Safari to reduce memory pressure');
            return;
        }

        // Wait for the main app (character model, calorie tracker, stats) to fully load
        // before starting background prefetch of rare 3D models
        const startPrefetch = () => {
            // Prioritize: 1) active skin, 2) featured monthly rare, 3) first in collection, 4) rest
            const activeRareSkinId = localStorage.getItem('active_rare_skin');
            const featured = getFeaturedMonthlyRareId();
            const priorityIds = new Set();
            if (activeRareSkinId) priorityIds.add(activeRareSkinId);
            if (featured) priorityIds.add(featured);
            priorityIds.add(CHALLENGE_RARE_COLLECTION[0].id); // First in list (shown when opening Rare Drops)

            const priorityModels = [];
            const remainingRareModels = [];
            CHALLENGE_RARE_COLLECTION.forEach(rare => {
                if (priorityIds.has(rare.id)) {
                    priorityModels.push(rare.model);
                } else {
                    remainingRareModels.push(rare.model);
                }
            });

            // Prefetch priority models first (active skin + featured rare)
            prefetchBatch(priorityModels, 400).then(() => {
                // Then prefetch remaining RARE_COLLECTION models at 600ms stagger
                prefetchBatch(remainingRareModels, 600);
            });
        };

        function prefetchBatch(urls, staggerMs) {
            const fetches = urls.map((url, i) => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        fetch(url, { mode: 'cors', credentials: 'omit', priority: 'low' })
                            .then(() => console.log('Prefetched:', url.split('/').pop()))
                            .catch(() => {}) // Silently ignore prefetch failures
                            .finally(resolve);
                    }, i * staggerMs);
                });
            });
            return Promise.all(fetches);
        }

        // Helper to get featured rare ID without creating the full object
        function getFeaturedMonthlyRareId() {
            const now = new Date();
            const monthIndex = now.getFullYear() * 12 + now.getMonth();
            const rare = CHALLENGE_RARE_COLLECTION[monthIndex % CHALLENGE_RARE_COLLECTION.length];
            return rare ? rare.id : null;
        }

        // Wait for the critical content (main character, calorie tracker, stats) to load,
        // then add an extra delay before starting rare model prefetch in the background
        function waitAndPrefetch() {
            if (window._appCriticalContentReady) {
                // Critical content already loaded — start after a short extra delay
                setTimeout(startPrefetch, 2000);
            } else {
                // Listen for the signal from the login overlay dismissal
                window.addEventListener('appCriticalContentReady', () => {
                    setTimeout(startPrefetch, 2000);
                }, { once: true });
                // Safety fallback: if signal never fires (e.g. overlay was hidden for returning users),
                // start after a generous delay
                setTimeout(() => {
                    if (!window._appCriticalContentReady) {
                        window._appCriticalContentReady = true;
                        startPrefetch();
                    }
                }, 15000);
            }
        }

        // Kick off the waiting logic after DOM is interactive
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitAndPrefetch);
        } else {
            waitAndPrefetch();
        }
    })(); // end prefetchRareModels

    // Expose constants for other scripts
    window.RARE_COLLECTION = RARE_COLLECTION;
    window.CHALLENGE_RARE_COLLECTION = CHALLENGE_RARE_COLLECTION;
    window.LEVEL_RARE_COLLECTION = LEVEL_RARE_COLLECTION;
    window.CHARACTER_SKIN_COLLECTION = CHARACTER_SKIN_COLLECTION;
    window.LEVEL_RARE_START_LEVEL = LEVEL_RARE_START_LEVEL;
    window.LEVEL_RARE_INTERVAL = LEVEL_RARE_INTERVAL;
    window.RARE_TIERS = RARE_TIERS;
    window.selectRareSkin = selectRareSkin;
    window.isRareUnlocked = isRareUnlocked;
    window.clearRareSkin = clearRareSkin;
    window.unlockLevelRareCharactersForLevel = unlockLevelRareCharactersForLevel;
    window.syncEligibleLevelRareUnlocks = syncEligibleLevelRareUnlocks;
    window.getLevelRareUnlocksBetween = getLevelRareUnlocksBetween;
})(); // end outer IIFE


    // Helper: check if a rare skin is unlocked
    function isRareUnlocked(id) {
        let unlocked = [];
        try { unlocked = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        return unlocked.includes(id);
    }

    // Helper: unlock a rare skin. Mirrors to Supabase so unlocks survive localStorage loss.
    function unlockRare(id) {
        let unlocked = [];
        try { unlocked = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        if (!unlocked.includes(id)) {
            unlocked.push(id);
            localStorage.setItem('user_rares_unlocked', JSON.stringify(unlocked));
            try { if (typeof checkRareBadges === 'function') checkRareBadges(); } catch(e) {}
        }
        persistRareUnlockToServer(id);
    }

    function persistRareUnlockToServer(id) {
        if (!id || !window.supabaseClient || !window.currentUser || !window.currentUser.id) return;
        try {
            window.supabaseClient
                .from('user_rare_unlocks')
                .upsert(
                    { user_id: window.currentUser.id, rare_id: id },
                    { onConflict: 'user_id,rare_id', ignoreDuplicates: true }
                )
                .then(({ error }) => {
                    if (error) console.warn('[unlockRare] server persist failed:', error.message || error);
                });
        } catch(e) { console.warn('[unlockRare] server persist threw:', e); }
    }

    async function syncRareUnlocksFromServer() {
        if (!window.supabaseClient || !window.currentUser || !window.currentUser.id) return;
        try {
            const { data, error } = await window.supabaseClient
                .from('user_rare_unlocks')
                .select('rare_id')
                .eq('user_id', window.currentUser.id);
            if (error) {
                console.warn('[syncRareUnlocksFromServer] fetch failed:', error.message || error);
                return;
            }
            const remote = (data || []).map(r => r.rare_id).filter(Boolean);
            let local = [];
            try { local = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
            if (!Array.isArray(local)) local = [];

            const merged = Array.from(new Set([...local, ...remote]));
            const changed = merged.length !== local.length || merged.some(id => !local.includes(id));

            if (changed) {
                localStorage.setItem('user_rares_unlocked', JSON.stringify(merged));
                try { if (typeof checkRareBadges === 'function') checkRareBadges(); } catch(e) {}
                try {
                    if (typeof renderRaresGrid === 'function' && document.getElementById('rares-grid')) {
                        renderRaresGrid();
                    }
                } catch(e) {}
            }

            local.filter(id => id && !remote.includes(id)).forEach(persistRareUnlockToServer);
        } catch(e) {
            console.warn('[syncRareUnlocksFromServer] threw:', e);
        }
    }

    window.syncRareUnlocksFromServer = syncRareUnlocksFromServer;

    function getLevelRareUnlocksBetween(previousLevel, newLevel) {
        const before = Math.max(0, parseInt(previousLevel, 10) || 0);
        const after = Math.max(0, parseInt(newLevel, 10) || 0);
        if (!after || after <= before) return [];
        return (window.LEVEL_RARE_COLLECTION || []).filter(rare =>
            rare.unlockLevel && before < rare.unlockLevel && after >= rare.unlockLevel
        );
    }

    function getEligibleMissingLevelRares(level) {
        const currentLevel = Math.max(0, parseInt(level, 10) || 0);
        if (!currentLevel) return [];
        return (window.LEVEL_RARE_COLLECTION || []).filter(rare =>
            rare.unlockLevel && currentLevel >= rare.unlockLevel && !isRareUnlocked(rare.id)
        );
    }

    function syncEligibleLevelRareUnlocks(level, options) {
        options = options || {};
        if (window.isAdminViewing) return [];
        const missing = getEligibleMissingLevelRares(level);
        if (!missing.length) return [];
        missing.forEach(rare => unlockRare(rare.id));
        try {
            if (typeof renderRaresGrid === 'function' && document.getElementById('rares-grid')) {
                renderRaresGrid();
            }
        } catch(e) {}
        if (options.celebrate) {
            queueLevelRareCelebration(missing.slice(0, 1), options.delayMs || 0);
        }
        return missing;
    }

    function unlockLevelRareCharactersForLevel(newLevel, previousLevel, options) {
        options = options || {};
        if (window.isAdminViewing) return [];
        const levelUnlocks = getLevelRareUnlocksBetween(previousLevel, newLevel)
            .filter(rare => !isRareUnlocked(rare.id));
        if (!levelUnlocks.length) return [];
        levelUnlocks.forEach(rare => unlockRare(rare.id));
        try {
            if (typeof renderRaresGrid === 'function' && document.getElementById('rares-grid')) {
                renderRaresGrid();
            }
        } catch(e) {}
        if (options.celebrate !== false) {
            queueLevelRareCelebration(levelUnlocks.slice(0, 1), options.delayMs || 0);
        }
        return levelUnlocks;
    }

    function queueLevelRareCelebration(rares, delayMs) {
        if (!rares || !rares.length) return;
        const rare = rares[0];
        const show = () => {
            try {
                window._lastUnlockedRareId = rare.id;
                showRareUnlockCelebration(rare.id, 'You', false);
            } catch(e) {
                console.warn('[levelRare] celebration failed:', e);
            }
        };
        setTimeout(show, Math.max(0, delayMs || 0));
    }

    function replayPendingLevelRareUnlockCheck() {
        try {
            const raw = localStorage.getItem('pendingLevelRareUnlockCheck');
            if (!raw) return;
            localStorage.removeItem('pendingLevelRareUnlockCheck');
            const data = JSON.parse(raw);
            if (!data || Date.now() - data.timestamp > 120000) return;
            unlockLevelRareCharactersForLevel(data.newLevel, data.previousLevel, {
                celebrate: data.celebrate !== false,
                delayMs: data.delayMs || 500
            });
        } catch(e) {
            try { localStorage.removeItem('pendingLevelRareUnlockCheck'); } catch(_) {}
        }
    }

    setTimeout(replayPendingLevelRareUnlockCheck, 500);

    // Helper: get weighted random rare drop (from challenge/raffle rares only).
    // Level-gated B2 characters unlock through XP milestones, not random challenge drops.
    function getRandomRareDrop() {
        const pool = [];
        (window.CHALLENGE_RARE_COLLECTION || []).forEach(rare => {
            const tierData = (window.RARE_TIERS || {})[rare.tier];
            if (tierData) {
                for (let i = 0; i < tierData.weight; i++) {
                    pool.push(rare);
                }
            }
        });
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Helper: get featured monthly rare (deterministic rotation by month)
    function getFeaturedMonthlyRare() {
        const now = new Date();
        const monthIndex = now.getFullYear() * 12 + now.getMonth();
        const challengeRares = window.CHALLENGE_RARE_COLLECTION || [];
        return challengeRares[monthIndex % challengeRares.length];
    }

    // iOS Safari: hot-swap the model without a page reload.
    // DESTROYS the old model-viewer element entirely and creates a fresh one.
    // Just removing src doesn't free GPU memory on iOS — the shared Three.js renderer
    // holds onto WebGL textures/buffers. Destroying the element forces full disposal.
    // Global lock prevents concurrent swaps (e.g. updateFitGotchi firing during a swap).
    window._pbbSwapInProgress = false;

    function iosHotSwapModel(newSrc, onLoaded, opts) {
        opts = opts || {};
        if (window.pbbBustModelUrl) newSrc = window.pbbBustModelUrl(newSrc);
        if (window._crumb) window._crumb('iosHotSwap_START_' + (newSrc || '').split('/').pop() + (opts.force ? '_force' : ''));

        // iOS native app: swap via native SceneKit — no WebGL/DOM manipulation needed.
        if (window._pbbNativeViewerAvailable && window.NativeCharacterViewer && window.NativeCharacterViewer.isActive()) {
            window.NativeCharacterViewer.loadModel(newSrc);
            try { localStorage.setItem('fitgotchi_model_src', newSrc); } catch(e) {}
            window._pbbSavedTamagotchiSrc = newSrc;
            if (window._crumb) window._crumb('iosHotSwap_NATIVE_' + (newSrc || '').split('/').pop());
            if (onLoaded) onLoaded();
            return;
        }

        var mv = document.getElementById('tamagotchi-model');
        if (!mv) return;

        // Prevent concurrent swaps — if another swap is in progress, just update the target
        if (window._pbbSwapInProgress) {
            window._pbbSwapTarget = newSrc;
            try { localStorage.setItem('fitgotchi_model_src', newSrc); } catch(e) {}
            window._pbbSavedTamagotchiSrc = newSrc;
            return;
        }

        // GUARD: If model-viewer CE hasn't loaded yet (e.g. updateFitGotchi fires
        // before pbbInitComplete), do NOT destroy/recreate the element. Just save
        // the target src — script_part_5.js's applyModelSrc will pick it up when
        // model-viewer is ready, or the element already has src from the swap target.
        if (!customElements.get('model-viewer')) {
            if (window._crumb) window._crumb('iosHotSwap_DEFERRED_ce_not_ready');
            try { localStorage.setItem('fitgotchi_model_src', newSrc); } catch(e) {}
            window._pbbSavedTamagotchiSrc = newSrc;
            // Set src on the element — it'll be picked up when CE registers
            mv.setAttribute('src', newSrc);
            if (onLoaded) onLoaded();
            return;
        }

        // Reset crash counter BEFORE the swap
        try {
            localStorage.setItem('_pbb_crash_count', '0');
            window._pbbCrashCount = 0;
        } catch(e) {}

        // Save to localStorage so the model persists across sessions
        try { localStorage.setItem('fitgotchi_model_src', newSrc); } catch(e) {}
        window._pbbSavedTamagotchiSrc = newSrc;

        var oldSrc = mv.getAttribute('src');
        // opts.force bypasses the equality short-circuit — used by pull-to-refresh
        // to nuke a stuck WebGL canvas (white/blank frame after context loss) even
        // when the src hasn't changed.
        if (!opts.force && oldSrc === newSrc) {
            if (onLoaded) onLoaded();
            return;
        }

        window._pbbSwapInProgress = true;
        window._pbbSwapTarget = newSrc;

        // Show fallback egg while swapping
        var fb = document.getElementById('tamagotchi-fallback');
        var fbMsg = document.getElementById('tamagotchi-fallback-msg');
        if (fb) fb.style.display = 'flex';
        if (fbMsg) fbMsg.textContent = 'Loading character...';
        mv.style.opacity = '0';

        var doSwap = function() {
            // NUCLEAR APPROACH: completely remove model-viewer from DOM to force
            // Three.js shared renderer to dispose all GPU resources (textures, buffers, shaders).
            // Just removing src leaves the WebGL context and GPU memory allocated.
            var parent = mv.parentNode;
            var nextSibling = mv.nextSibling;

            // Save attributes we need to recreate the element
            var savedAttrs = {};
            for (var i = 0; i < mv.attributes.length; i++) {
                var attr = mv.attributes[i];
                if (attr.name !== 'src') {
                    savedAttrs[attr.name] = attr.value;
                }
            }
            // Save any inline classes
            var savedClasses = mv.className;

            // Remove old element entirely — forces GPU resource disposal
            mv.removeAttribute('src');
            parent.removeChild(mv);
            mv = null;

            if (window._crumb) window._crumb('iosHotSwap_DESTROYED_old');

            // Wait for GPU cleanup — rAF chain flushes pipeline, then delay for VRAM release
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    setTimeout(function() {
                        if (window._crumb) window._crumb('iosHotSwap_CREATING_new');
                        var targetSrc = window._pbbSwapTarget || newSrc;

                        // Create fresh model-viewer element
                        var newMv = document.createElement('model-viewer');
                        for (var name in savedAttrs) {
                            newMv.setAttribute(name, savedAttrs[name]);
                        }
                        newMv.className = savedClasses;
                        newMv.style.opacity = '0';

                        // Insert back into DOM at the same position
                        if (nextSibling) {
                            parent.insertBefore(newMv, nextSibling);
                        } else {
                            parent.appendChild(newMv);
                        }

                        // Now set src on the fresh element
                        newMv.setAttribute('src', targetSrc);
                        if (window._crumb) window._crumb('iosHotSwap_LOAD_' + (targetSrc || '').split('/').pop());

                        newMv.addEventListener('load', function onLoad() {
                            newMv.removeEventListener('load', onLoad);
                            window._pbbSwapInProgress = false;
                            newMv.style.opacity = '1';
                            newMv.classList.add('model-loaded');
                            if (fb) fb.style.display = 'none';
                            if (window.applyCharacterColors && shouldApplyCharacterColorsToModel(targetSrc, opts.skinId || opts.activeSkinId || '')) {
                                window.applyCharacterColors(newMv, targetSrc);
                            }
                            if (window.applyIdleAnimation) window.applyIdleAnimation(newMv);
                            if (onLoaded) onLoaded();
                        });

                        // Safety: if model fails to load in 8s, unlock and show the viewer.
                        // Reduced from 15s — if the model hasn't loaded by 8s,
                        // keeping the lock just blocks all future skin changes.
                        setTimeout(function() {
                            if (window._pbbSwapInProgress) {
                                window._pbbSwapInProgress = false;
                                newMv.style.opacity = '1';
                                if (fb) fb.style.display = 'none';
                                if (window._crumb) window._crumb('iosHotSwap_SAFETY_UNLOCK');
                            }
                        }, 8000);
                    }, 1500); // 1.5s for iOS GPU to release old VRAM
                });
            });
        };

        // Pre-fetch new model into SW cache so the GPU load reads from cache (no download spike)
        if (window._pbbIsIOSSafari && newSrc) {
            if (fbMsg) fbMsg.textContent = 'Downloading character...';
            fetch(newSrc, { mode: 'cors' })
                .then(function() {
                    if (fbMsg) fbMsg.textContent = 'Loading character...';
                    doSwap();
                })
                .catch(function() {
                    doSwap();
                });
        } else {
            doSwap();
        }
    }

    // Expose globally for iosSafeSrc in dashboard-script-13
    window.iosHotSwapModel = iosHotSwapModel;

    // Select an evolution skin (swap to any unlocked evolution model)
    window.selectEvolutionSkin = function(modelSrc, title) {
        // Clear any active rare skin
        localStorage.removeItem('active_rare_skin');
        // Save the selected evolution skin override
        localStorage.setItem('active_evolution_skin', modelSrc);

        // Lock to prevent updateFitGotchi from racing with this explicit selection
        window._pbbSkinSwapLock = Date.now();

        if (window._pbbIsIOSSafari) {
            // iOS: hot-swap with memory-safe release/load cycle (no page reload)
            // Do NOT call updateFitGotchi in the callback — it would trigger iosSafeSrc
            // which does another remove-wait-load cycle (double swap = OOM crash).
            // iosHotSwapModel already applies colors and idle animation.
            showToast('🎨 ' + title + ' skin equipped!', 'success');
            if (typeof window.closeAnimationSelector === 'function') {
                window.closeAnimationSelector();
            }
            iosHotSwapModel(modelSrc);
            if (typeof window._refreshActiveSkin === 'function') {
                window._refreshActiveSkin('');
            }
            return;
        }

        // Non-iOS: hot-swap the model directly
        var mv = document.getElementById('tamagotchi-model');
        if (mv) {
            mv.setAttribute('src', modelSrc);
            mv.addEventListener('load', function onLoad() {
                mv.removeEventListener('load', onLoad);
                if (window.applyCharacterColors && shouldApplyCharacterColorsToModel(modelSrc)) window.applyCharacterColors(mv, modelSrc);
                if (window.applyIdleAnimation) window.applyIdleAnimation(mv);
                if (typeof updateFitGotchi === 'function') updateFitGotchi();
            });
        }
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin('');
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast('🎨 ' + title + ' skin equipped!', 'success');
    };

    function selectRareSkin(id) {
        const rare = (window.CHARACTER_SKIN_COLLECTION || window.RARE_COLLECTION || []).find(r => r.id === id);
        if (!rare || !isRareUnlocked(id)) return;
        localStorage.setItem('active_rare_skin', id);
        localStorage.removeItem('active_evolution_skin');

        // Lock to prevent updateFitGotchi from racing with this explicit selection
        window._pbbSkinSwapLock = Date.now();

        if (window._pbbIsIOSSafari) {
            // iOS: hot-swap with memory-safe release/load cycle (no page reload)
            // Do NOT call updateFitGotchi in the callback — it would trigger iosSafeSrc
            // which does another remove-wait-load cycle (double swap = OOM crash).
            showToast(rare.emoji + ' ' + rare.name + ' skin equipped!', 'success');
            if (typeof window.closeAnimationSelector === 'function') {
                window.closeAnimationSelector();
            }
            iosHotSwapModel(rare.model, null, { skinId: id });
            if (typeof window._refreshActiveSkin === 'function') {
                window._refreshActiveSkin(id);
            }
            return;
        }

        // Non-iOS: hot-swap the model directly
        var mv = document.getElementById('tamagotchi-model');
        if (mv) {
            mv.setAttribute('src', rare.model);
            mv.addEventListener('load', function onLoad() {
                mv.removeEventListener('load', onLoad);
                if (window.applyIdleAnimation) window.applyIdleAnimation(mv);
                if (typeof updateFitGotchi === 'function') updateFitGotchi();
            });
        }
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin(id);
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast(rare.emoji + ' ' + rare.name + ' skin equipped!', 'success');
    }

    // Clear rare skin and revert to level-based evolution
    function clearRareSkin() {
        localStorage.removeItem('active_rare_skin');
        localStorage.removeItem('active_evolution_skin');
        // Clear cached model so page loads the correct level-based one
        try { localStorage.removeItem('fitgotchi_model_src'); } catch(e) {}

        if (window._pbbIsIOSSafari) {
            // Reset crash counter before the swap
            try {
                localStorage.setItem('_pbb_crash_count', '0');
                window._pbbCrashCount = 0;
            } catch(e) {}
            showToast('Reverted to level skin!', 'success');
            if (typeof window.closeAnimationSelector === 'function') {
                window.closeAnimationSelector();
            }
            // Destroy the model-viewer element to fully free GPU memory, then
            // let updateFitGotchi create a fresh one with the correct level model.
            var mv = document.getElementById('tamagotchi-model');
            if (mv) {
                var parent = mv.parentNode;
                var nextSibling = mv.nextSibling;
                var savedAttrs = {};
                for (var i = 0; i < mv.attributes.length; i++) {
                    var attr = mv.attributes[i];
                    if (attr.name !== 'src') savedAttrs[attr.name] = attr.value;
                }
                var savedClasses = mv.className;
                mv.removeAttribute('src');
                parent.removeChild(mv);
                // Recreate element after GPU cleanup, then call updateFitGotchi
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        setTimeout(function() {
                            var newMv = document.createElement('model-viewer');
                            for (var name in savedAttrs) newMv.setAttribute(name, savedAttrs[name]);
                            newMv.className = savedClasses;
                            if (nextSibling) parent.insertBefore(newMv, nextSibling);
                            else parent.appendChild(newMv);
                            newMv.classList.add('model-loaded');
                            if (typeof updateFitGotchi === 'function') updateFitGotchi();
                        }, 2500);
                    });
                });
            }
            if (typeof window._refreshActiveSkin === 'function') {
                window._refreshActiveSkin('');
            }
            return;
        }

        // Non-iOS: trigger level-based model update
        if (typeof updateTamagotchiDisplay === 'function') {
            updateTamagotchiDisplay();
        } else if (typeof updateFitGotchi === 'function') {
            updateFitGotchi();
        }
        // Refresh active skin highlight in the already-rendered panel
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin('');
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast('Reverted to level skin!', 'success');
    }

    // ============================================================
    // MONTHLY RAFFLE (signups open first 3 days, draw at month end)
    // ============================================================
    const MONTHLY_RAFFLE_SIGNUP_DAYS = 3;
    // Park the raffle without deleting it; flip this back on when ready.
    const MONTHLY_RAFFLE_ENABLED = false;

    // Server-authoritative state per month key (populated by Supabase RPC).
    // Falls back to simulation when missing or RPC call fails.
    const _raffleServerState = {};
    let _raffleFetchInFlight = null;

    function hideMonthlyRaffleSurfaces() {
        const section = document.getElementById('monthly-raffle-section');
        const container = document.getElementById('rare-challenges-preview');
        const popup = document.getElementById('monthly-raffle-popup');
        if (section) section.style.display = 'none';
        if (container) container.innerHTML = '';
        if (popup) popup.style.display = 'none';
    }

    function monthKeyOf(d) {
        d = d || new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function getRaffleState() {
        const now = new Date();
        const day = now.getDate();
        const year = now.getFullYear();
        const month = now.getMonth();
        const key = monthKeyOf(now);

        const signupCloseAt = new Date(year, month, MONTHLY_RAFFLE_SIGNUP_DAYS + 1, 0, 0, 0);
        const nextMonthStart = new Date(year, month + 1, 1, 0, 0, 0);

        const phase = (day <= MONTHLY_RAFFLE_SIGNUP_DAYS) ? 'signup' : 'active';
        const popupSeen = localStorage.getItem('pbb_raffle_popup_seen_' + key) === 'true';

        const featured = getFeaturedMonthlyRare();
        const tier = RARE_TIERS[featured.tier];
        const entryFee = tier.buyIn;

        const server = _raffleServerState[key];
        let participants, pool, joined;
        if (server) {
            participants = server.participants;
            pool = server.pool;
            joined = !!server.joined;
        } else {
            // Optimistic fallback until the RPC response lands.
            joined = localStorage.getItem('pbb_raffle_joined_' + key) === 'true';
            const seed = (year * 100 + (month + 1)) % 37;
            let baseline;
            if (phase === 'signup') {
                const progress = (day - 1) + (now.getHours() / 24);
                baseline = 8 + Math.floor(progress * 5) + (seed % 5);
            } else {
                baseline = 22 + (seed % 6);
            }
            participants = baseline + (joined ? 1 : 0);
            pool = participants * entryFee;
        }

        return {
            monthKey: key, phase, day, now,
            signupCloseAt, nextMonthStart,
            featured, tier, entryFee,
            participants, pool,
            joined, popupSeen,
            fromServer: !!server
        };
    }

    async function refreshRaffleStateFromServer() {
        if (!MONTHLY_RAFFLE_ENABLED) return null;
        if (!window.supabaseClient || !window.currentUser) return null;
        if (_raffleFetchInFlight) return _raffleFetchInFlight;

        const key = monthKeyOf();
        const featured = getFeaturedMonthlyRare();
        const tier = RARE_TIERS[featured.tier];

        _raffleFetchInFlight = (async () => {
            try {
                const { data, error } = await window.supabaseClient
                    .rpc('get_monthly_raffle_state', {
                        p_month_key: key,
                        p_featured_rare_id: featured.id,
                        p_entry_fee: tier.buyIn
                    });
                if (error) throw error;
                if (data) {
                    _raffleServerState[key] = {
                        participants: data.participants || 0,
                        pool: data.pool || 0,
                        joined: !!data.joined,
                        status: data.status,
                        raffleId: data.raffle_id,
                        winnerId: data.winner_id
                    };
                    if (data.joined) {
                        try { localStorage.setItem('pbb_raffle_joined_' + key, 'true'); } catch(e){}
                    }
                    // Re-render the card + popup with real numbers
                    try { renderFeaturedRareCard(); } catch(e){}
                    const popup = document.getElementById('monthly-raffle-popup');
                    if (popup && popup.style.display === 'flex') {
                        try { populateRafflePopup(); } catch(e){}
                    }
                }
                return data;
            } catch (e) {
                console.warn('[refreshRaffleStateFromServer]', e);
                return null;
            } finally {
                _raffleFetchInFlight = null;
            }
        })();

        return _raffleFetchInFlight;
    }

    function formatRaffleCountdown(target, now) {
        const ms = Math.max(0, target - now);
        const totalSec = Math.floor(ms / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        if (days > 0) return days + 'd ' + hours + 'h ' + mins + 'm';
        if (hours > 0) return hours + 'h ' + mins + 'm';
        const secs = totalSec % 60;
        return mins + 'm ' + secs + 's';
    }

    // Render the monthly raffle card on the home page.
    // Shown during signup window (days 1-3) OR when the user has joined.
    // Hidden entirely after signups close if the user did not join.
    function renderFeaturedRareCard() {
        const section = document.getElementById('monthly-raffle-section');
        const container = document.getElementById('rare-challenges-preview');
        if (!container || !section) return;
        if (!MONTHLY_RAFFLE_ENABLED) {
            hideMonthlyRaffleSurfaces();
            return;
        }

        const state = getRaffleState();
        const { phase, joined, featured, tier, participants, pool } = state;

        // Fire-and-forget server refresh so participants/pool converge on real data.
        if (!state.fromServer) {
            refreshRaffleStateFromServer();
        }

        if (phase === 'active' && !joined) {
            section.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        section.style.display = 'block';

        const badge = document.getElementById('monthly-raffle-badge');
        if (badge) {
            if (phase === 'signup') {
                badge.textContent = joined ? "YOU'RE IN" : 'SIGNUPS OPEN';
                badge.style.background = joined
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #f59e0b, #f97316)';
            } else {
                badge.textContent = "YOU'RE IN";
                badge.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            }
        }

        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const currentMonth = monthNames[state.now.getMonth()];

        const target = phase === 'signup' ? state.signupCloseAt : state.nextMonthStart;
        const countdownLabel = phase === 'signup' ? 'Signups close in' : 'Winner drawn in';
        const countdownText = formatRaffleCountdown(target, state.now);

        const ctaLabel = joined ? "✓ YOU'RE IN" : (phase === 'signup' ? 'ENTER' : 'CLOSED');
        const ctaBg = joined
            ? 'linear-gradient(135deg,#10b981,#059669)'
            : (phase === 'signup' ? tier.gradient : 'rgba(255,255,255,0.15)');

        container.innerHTML = `
            <div onclick="openMonthlyRafflePopup()" style="min-width: 280px; max-width: 340px; padding: 18px; border: 2px solid ${tier.color}; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 0 20px ${tier.glow}; border-radius: 16px;">
                <div style="position: absolute; top: -15px; right: -15px; font-size: 5rem; opacity: 0.08; transform: rotate(15deg);">${featured.emoji}</div>

                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <span style="font-size: 1.9rem;">${featured.emoji}</span>
                    <div>
                        <div style="font-weight: 800; color: white; font-size: 1.05rem;">${currentMonth} Raffle</div>
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.55rem; font-weight: 800; letter-spacing: 1.5px; background: ${tier.gradient}; color: white;">${tier.label}</span>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; margin-bottom: 10px; text-align:center;">
                    <div style="font-size: 0.58rem; color: rgba(255,255,255,0.55); text-transform: uppercase; font-weight: 700; letter-spacing: 1.2px;">${countdownLabel}</div>
                    <div data-raffle-countdown="1" style="font-size: 1.05rem; font-weight: 800; color: white; margin-top: 2px; font-variant-numeric: tabular-nums;">${countdownText}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px; text-align:center;">
                        <div style="font-size: 0.55rem; color: rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:1px; font-weight:700;">Pool</div>
                        <div style="font-size:0.92rem; font-weight:800; color:#fbbf24; margin-top:2px;">🪙 ${pool.toLocaleString()}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px; text-align:center;">
                        <div style="font-size: 0.55rem; color: rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:1px; font-weight:700;">Entrants</div>
                        <div style="font-size:0.92rem; font-weight:800; color:white; margin-top:2px;">👥 ${participants}</div>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 10px 12px; display:flex; align-items:center; gap:10px;">
                    <div style="font-size: 1.3rem;">${featured.emoji}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.55rem; color:rgba(255,255,255,0.5); text-transform:uppercase; font-weight:700; letter-spacing:1px;">Guaranteed Drop</div>
                        <div style="font-size:0.85rem; font-weight:700; color:${tier.color}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${featured.name}</div>
                    </div>
                    <div style="background: ${ctaBg}; color: white; padding: 5px 10px; border-radius: 8px; font-size: 0.62rem; font-weight: 800; letter-spacing: 1px; white-space:nowrap;">${ctaLabel}</div>
                </div>
            </div>
        `;

        startRaffleCountdownTicker();
    }

    let _raffleCountdownTimer = null;
    function startRaffleCountdownTicker() {
        if (!MONTHLY_RAFFLE_ENABLED) return;
        if (_raffleCountdownTimer) return;
        _raffleCountdownTimer = setInterval(() => {
            const state = getRaffleState();
            const target = state.phase === 'signup' ? state.signupCloseAt : state.nextMonthStart;
            const text = formatRaffleCountdown(target, new Date());
            document.querySelectorAll('[data-raffle-countdown]').forEach(el => { el.textContent = text; });
            const popup = document.getElementById('monthly-raffle-popup');
            if (popup && popup.style.display === 'flex') {
                const cd = document.getElementById('raffle-popup-countdown');
                if (cd) cd.textContent = text;
            }
        }, 60000);
    }

    function openMonthlyRafflePopup() {
        if (!MONTHLY_RAFFLE_ENABLED) {
            hideMonthlyRaffleSurfaces();
            return;
        }
        const popup = document.getElementById('monthly-raffle-popup');
        if (!popup) return;
        populateRafflePopup();
        popup.style.display = 'flex';
        try {
            if (typeof pushNavigationState === 'function') {
                pushNavigationState('monthly-raffle-popup', closeMonthlyRafflePopup);
            }
        } catch(e) {}
    }

    function closeMonthlyRafflePopup() {
        const popup = document.getElementById('monthly-raffle-popup');
        if (popup) popup.style.display = 'none';
        try {
            if (window._pbbClearModelSrc) {
                window._pbbClearModelSrc('raffle-popup-viewer');
            } else {
                const viewer = document.getElementById('raffle-popup-viewer');
                if (viewer) viewer.removeAttribute('src');
            }
        } catch(e) {}
    }

    function populateRafflePopup() {
        if (!MONTHLY_RAFFLE_ENABLED) return;
        const state = getRaffleState();
        const { phase, joined, featured, tier, entryFee, participants, pool } = state;
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };

        const pill = document.getElementById('raffle-popup-tier-pill');
        if (pill) {
            pill.textContent = tier.label;
            pill.style.background = tier.gradient;
        }
        setText('raffle-popup-month', monthNames[state.now.getMonth()]);
        setText('raffle-popup-prize-name', featured.name);
        setStyle('raffle-popup-prize-name', 'color', tier.color);
        setText('raffle-popup-pool', pool.toLocaleString());
        setText('raffle-popup-participants', participants);
        setText('raffle-popup-entry-btn', entryFee.toLocaleString());
        setText('raffle-popup-entry-inline', entryFee.toLocaleString());

        const target = phase === 'signup' ? state.signupCloseAt : state.nextMonthStart;
        setText('raffle-popup-countdown-label', phase === 'signup' ? 'Signups close in' : 'Winner drawn in');
        setText('raffle-popup-countdown', formatRaffleCountdown(target, state.now));

        const viewer = window._pbbSetModelSrc
            ? window._pbbSetModelSrc('raffle-popup-viewer', featured.model)
            : document.getElementById('raffle-popup-viewer');
        if (viewer && !window._pbbSetModelSrc) viewer.setAttribute('src', featured.model);

        const btn = document.getElementById('raffle-popup-join-btn');
        const joinedNote = document.getElementById('raffle-popup-joined-note');
        if (joined) {
            if (btn) btn.style.display = 'none';
            if (joinedNote) joinedNote.style.display = 'block';
        } else if (phase === 'signup') {
            if (btn) {
                btn.style.display = 'flex';
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.innerHTML = '<span>Enter for</span> <span>🪙</span> <span id="raffle-popup-entry-btn">' + entryFee.toLocaleString() + '</span>';
            }
            if (joinedNote) joinedNote.style.display = 'none';
        } else {
            if (btn) {
                btn.style.display = 'flex';
                btn.disabled = true;
                btn.style.opacity = '0.45';
                btn.style.cursor = 'not-allowed';
                btn.innerHTML = 'Signups closed';
            }
            if (joinedNote) joinedNote.style.display = 'none';
        }

        startRaffleCountdownTicker();
    }

    async function joinMonthlyRaffle() {
        if (!MONTHLY_RAFFLE_ENABLED) return;
        const state = getRaffleState();
        if (state.joined || state.phase !== 'signup') return;

        const btn = document.getElementById('raffle-popup-join-btn');
        const resetBtn = () => {
            if (!btn) return;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = '<span>Enter for</span> <span>🪙</span> <span>' + state.entryFee.toLocaleString() + '</span>';
        };
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.innerHTML = 'Joining...';
        }

        if (!window.supabaseClient || !window.currentUser) {
            if (typeof showToast === 'function') showToast('Sign in to enter the raffle.', 'error');
            resetBtn();
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .rpc('join_monthly_raffle', {
                    p_month_key: state.monthKey,
                    p_featured_rare_id: state.featured.id,
                    p_entry_fee: state.entryFee
                });
            if (error) throw error;

            if (data && data.error) {
                if (data.error === 'insufficient_coins') {
                    if (typeof showToast === 'function') showToast('Not enough coins to enter!', 'error');
                    else alert('Not enough coins to enter!');
                    if (typeof openCoinShop === 'function') openCoinShop();
                } else if (data.error === 'already_joined') {
                    _raffleServerState[state.monthKey] = Object.assign(
                        _raffleServerState[state.monthKey] || {},
                        { joined: true, participants: data.participants || 0, pool: data.pool || 0 }
                    );
                    localStorage.setItem('pbb_raffle_joined_' + state.monthKey, 'true');
                    if (typeof showToast === 'function') showToast("You're already entered in this raffle!", 'info');
                    populateRafflePopup();
                    renderFeaturedRareCard();
                    return;
                } else if (data.error === 'closed') {
                    if (typeof showToast === 'function') showToast('Signups for this raffle are closed.', 'error');
                    else alert('Signups for this raffle are closed.');
                } else {
                    if (typeof showToast === 'function') showToast(data.message || 'Failed to join raffle.', 'error');
                    else alert(data.message || 'Failed to join raffle.');
                }
                resetBtn();
                return;
            }

            if (data && typeof data.new_balance === 'number' && typeof updateCoinBalanceDisplay === 'function') {
                updateCoinBalanceDisplay(data.new_balance);
            }

            _raffleServerState[state.monthKey] = Object.assign(
                _raffleServerState[state.monthKey] || {},
                { joined: true, participants: data.participants || 0, pool: data.pool || 0 }
            );
            localStorage.setItem('pbb_raffle_joined_' + state.monthKey, 'true');
            populateRafflePopup();
            renderFeaturedRareCard();
            if (typeof showToast === 'function') showToast("You're in! Good luck 🍀", 'success');
        } catch(e) {
            console.error('[joinMonthlyRaffle] error:', e);
            const msg = (e && e.message) ? ('Failed to join: ' + e.message) : 'Failed to join raffle. Please try again.';
            if (typeof showToast === 'function') showToast(msg, 'error');
            else alert(msg);
            resetBtn();
        }
    }

    // Trigger the draw for last month (if caller is first past day 4),
    // and show a celebration if the current user was the winner.
    async function checkAndDrawMonthlyRaffle() {
        if (!MONTHLY_RAFFLE_ENABLED) return;
        if (!window.supabaseClient || !window.currentUser) return;
        try {
            const now = new Date();
            // Draw target: previous month (YYYY-MM).
            const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevKey = monthKeyOf(prev);

            const { data: drawData, error: drawErr } = await window.supabaseClient
                .rpc('draw_monthly_raffle', { p_month_key: prevKey });
            if (drawErr) {
                // Not fatal — the row may simply not exist yet.
                console.warn('[checkAndDrawMonthlyRaffle] draw:', drawErr.message);
            }

            // Either way, look up any wins we haven't celebrated yet locally.
            const { data: wins, error: winsErr } = await window.supabaseClient
                .rpc('get_unclaimed_raffle_wins');
            if (winsErr) { console.warn('[checkAndDrawMonthlyRaffle] wins:', winsErr); return; }

            if (!Array.isArray(wins)) return;
            for (const w of wins) {
                const seenKey = 'pbb_raffle_win_seen_' + w.month_key;
                if (localStorage.getItem(seenKey) === 'true') continue;
                localStorage.setItem(seenKey, 'true');

                const rare = (window.RARE_COLLECTION || []).find(r => r.id === w.featured_rare_id);
                if (!rare) continue;
                try { if (typeof unlockRare === 'function') unlockRare(rare.id); } catch(e){}
                const winnerName = (window.currentUser && (window.currentUser.user_metadata?.full_name || window.currentUser.email)) || 'You';
                setTimeout(() => {
                    try { showRareUnlockCelebration(rare.id, winnerName, true); } catch(e) { console.warn(e); }
                    if (w.winner_pool && typeof showToast === 'function') {
                        showToast('🎉 You won ' + (w.winner_pool).toLocaleString() + ' coins in the ' + w.month_key + ' raffle!', 'success');
                    }
                    try { if (typeof loadCoinBalance === 'function') loadCoinBalance(); } catch(e){}
                }, 600);
                break; // only celebrate one at a time
            }
        } catch (e) {
            console.warn('[checkAndDrawMonthlyRaffle]', e);
        }
    }

    function maybeShowMonthlyRafflePopup() {
        if (!MONTHLY_RAFFLE_ENABLED) return;
        try {
            const state = getRaffleState();
            if (state.phase !== 'signup') return;
            if (state.joined) return;
            if (state.popupSeen) return;
            localStorage.setItem('pbb_raffle_popup_seen_' + state.monthKey, 'true');
            setTimeout(openMonthlyRafflePopup, 1200);
        } catch(e) { console.warn('[maybeShowMonthlyRafflePopup]', e); }
    }

    window.openMonthlyRafflePopup = openMonthlyRafflePopup;
    window.closeMonthlyRafflePopup = closeMonthlyRafflePopup;
    window.joinMonthlyRaffle = joinMonthlyRaffle;
    window.maybeShowMonthlyRafflePopup = maybeShowMonthlyRafflePopup;
    window.renderFeaturedRareCard = renderFeaturedRareCard;
    window.refreshRaffleStateFromServer = refreshRaffleStateFromServer;
    window.checkAndDrawMonthlyRaffle = checkAndDrawMonthlyRaffle;

    // ============================================================
    // CHALLENGE COMPLETION & RARE REWARD GRANTING
    // ============================================================

    // Check for expired challenges that need completion
    async function checkAndCompleteExpiredChallenges() {
        if (!window.currentUser) return;

        try {
            // Get all active/pending challenges for this user that have passed their end date
            const { data: challenges, error } = await window.supabaseClient
                .from('challenge_participants')
                .select('challenge_id, challenges!inner(id, name, end_date, status, winner_id, winner_rewarded, rare_reward_id)')
                .eq('user_id', window.currentUser.id)
                .eq('status', 'accepted')
                .in('challenges.status', ['active', 'pending']);

            if (error || !challenges) return;

            const now = new Date();
            for (const cp of challenges) {
                const challenge = cp.challenges;
                const endDate = new Date(challenge.end_date);

                // If challenge has passed its end date and hasn't been completed
                if (endDate < now && !challenge.winner_rewarded) {
                    console.log('Completing expired challenge:', challenge.name);

                    // Sync native health steps first so wearable data is up to date
                    try {
                        if (typeof syncNativeStepsForChallenges === 'function') {
                            await syncNativeStepsForChallenges();
                        }
                    } catch (e) {
                        console.warn('Could not sync native steps before completing:', e);
                    }

                    // Refresh all participants' points before finalizing so scores are accurate
                    try {
                        const { data: participants } = await window.supabaseClient
                            .from('challenge_participants')
                            .select('user_id')
                            .eq('challenge_id', challenge.id)
                            .eq('status', 'accepted');

                        if (participants) {
                            for (const p of participants) {
                                await window.supabaseClient.rpc('update_challenge_participant_points', { user_uuid: p.user_id });
                            }
                        }
                    } catch (e) {
                        console.warn('Could not refresh participant points before completing:', e);
                    }

                    await completeAndRewardChallenge(challenge.id);
                }
            }
        } catch (err) {
            console.error('Error checking expired challenges:', err);
        }
    }

    // Complete a challenge and handle rare reward
    async function completeAndRewardChallenge(challengeId) {
        try {
            // Fetch challenge name for the results modal
            let challengeName = 'Challenge';
            try {
                const { data: cData } = await window.supabaseClient
                    .from('challenges')
                    .select('name')
                    .eq('id', challengeId)
                    .single();
                if (cData?.name) challengeName = cData.name;
            } catch (e) {}

            const { data: result, error } = await window.supabaseClient
                .rpc('complete_challenge', { challenge_uuid: challengeId });

            if (error) {
                console.error('Error completing challenge:', error);
                return;
            }

            if (result?.error) {
                console.log('Challenge already completed:', result.message);
                return;
            }

            const winnerId = result?.winner_id;
            const rareRewardId = result?.rare_reward_id;
            const isCurrentUserWinner = winnerId === window.currentUser?.id;
            const winnerName = result?.winner_name || 'Someone';

            // Show the challenge results modal for ALL completions
            showChallengeResults({
                isWinner: isCurrentUserWinner,
                challengeName: challengeName,
                winnerName: winnerName,
                rareRewardId: isCurrentUserWinner ? rareRewardId : null
            });

            // Check challenge badges
            try { if (typeof checkChallengeBadges === 'function') checkChallengeBadges(); } catch(e) {}

            // Refresh challenges on home screen
            if (typeof loadHomeChallenges === 'function') loadHomeChallenges();

            // Refresh the leaderboard completion banner if it's open
            if (typeof refreshLeaderboardAfterCompletion === 'function') {
                refreshLeaderboardAfterCompletion(challengeId);
            }

        } catch (err) {
            console.error('Error in completeAndRewardChallenge:', err);
        }
    }

    // ============================================================
    // CHALLENGE RESULTS MODAL (win/loss celebration)
    // ============================================================

    function showChallengeResults({ isWinner, challengeName, winnerName, rareRewardId }) {
        const modal = document.getElementById('challenge-results-modal');
        if (!modal) return;

        const iconEl = document.getElementById('challenge-result-icon');
        const nameEl = document.getElementById('challenge-result-challenge-name');
        const headlineEl = document.getElementById('challenge-result-headline');
        const subtitleEl = document.getElementById('challenge-result-subtitle');
        const winnerCard = document.getElementById('challenge-result-winner-card');
        const winnerNameEl = document.getElementById('challenge-result-winner-name');
        const rewardEl = document.getElementById('challenge-result-reward');
        const rewardTextEl = document.getElementById('challenge-result-reward-text');
        const sparklesEl = document.getElementById('challenge-result-sparkles');

        // Challenge name
        if (nameEl) nameEl.textContent = challengeName || 'Challenge';

        if (isWinner) {
            // --- WINNER ---
            if (iconEl) iconEl.textContent = '🏆';
            if (headlineEl) {
                headlineEl.textContent = 'YOU WON!';
                headlineEl.style.color = '#4ade80';
                headlineEl.style.textShadow = '0 0 30px rgba(74,222,128,0.5)';
            }
            if (subtitleEl) subtitleEl.textContent = 'Congratulations, champion! 🎉';
            if (winnerCard) winnerCard.style.display = 'none';

            // Show reward info
            if (rewardEl) rewardEl.style.display = 'block';
            if (rareRewardId) {
                const rare = (window.RARE_COLLECTION || []).find(r => r.id === rareRewardId);
                if (rewardTextEl) {
                    rewardTextEl.textContent = rare
                        ? `✨ ${rare.emoji} ${rare.name} unlocked! +200 XP`
                        : '🎉 +200 XP earned!';
                }
            } else {
                if (rewardTextEl) rewardTextEl.textContent = '🎉 +200 XP earned!';
            }

            // Winner sparkles
            generateChallengeResultSparkles(sparklesEl, true);

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([100, 50, 200, 50, 100]);
        } else {
            // --- LOSER ---
            if (iconEl) iconEl.textContent = '⚔️';
            if (headlineEl) {
                headlineEl.textContent = 'CHALLENGE COMPLETE';
                headlineEl.style.color = '#94a3b8';
                headlineEl.style.textShadow = 'none';
            }
            if (subtitleEl) subtitleEl.textContent = 'Better luck next time — get back in there! 💪';

            // Show who won
            if (winnerCard) winnerCard.style.display = 'block';
            if (winnerNameEl) winnerNameEl.textContent = winnerName || 'Unknown';

            if (rewardEl) rewardEl.style.display = 'none';

            // Subtle sparkles for loser too
            generateChallengeResultSparkles(sparklesEl, false);
        }

        modal.style.display = 'flex';

        // If winner with rare reward, queue the rare celebration after closing this modal
        if (isWinner && rareRewardId) {
            window._pendingRareCelebration = { rareId: rareRewardId, winnerName };
        } else {
            window._pendingRareCelebration = null;
        }
    }

    function generateChallengeResultSparkles(container, isWinner) {
        if (!container) return;
        container.innerHTML = '';
        const emojis = isWinner ? ['🏆', '✨', '⭐', '🌟', '💫', '🎉', '🥇'] : ['⚔️', '💪', '🔥'];
        const count = isWinner ? 20 : 8;
        for (let i = 0; i < count; i++) {
            const sparkle = document.createElement('div');
            sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            sparkle.style.cssText = `
                position: absolute;
                font-size: ${0.8 + Math.random() * 1.5}rem;
                left: ${10 + Math.random() * 80}%;
                bottom: ${Math.random() * 40}%;
                animation: sparkleFloat ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 1}s forwards;
                opacity: 0;
                pointer-events: none;
            `;
            setTimeout(() => sparkle.style.opacity = '1', i * 80);
            container.appendChild(sparkle);
        }
    }

    // Manual fallback: let a winner re-open the rare reward unlock modal
    // from the challenge leaderboard if they missed the celebration earlier.
    window.claimChallengeReward = async function() {
        console.log('🎁 [claimChallengeReward] Button pressed');
        const toast = (msg, type = 'info') => {
            if (typeof window.showToast === 'function') window.showToast(msg, type);
            else console.log('[toast]', msg);
        };
        try {
            let rareId = window._currentChallengeRareRewardId;
            let challengeId = null;
            try { if (typeof currentChallengeId !== 'undefined') challengeId = currentChallengeId; } catch (_) {}
            if (!challengeId) challengeId = window._currentChallengeIdForClaim || null;
            console.log('🎁 [claimChallengeReward] cached rareId:', rareId, 'challengeId:', challengeId);

            // If we don't have the rare id cached, fetch it from the challenge
            if (!rareId && challengeId && window.supabaseClient) {
                console.log('🎁 [claimChallengeReward] Fetching rare_reward_id from DB...');
                const { data, error } = await window.supabaseClient
                    .from('challenges')
                    .select('rare_reward_id, winner_id')
                    .eq('id', challengeId)
                    .single();
                if (error) console.warn('🎁 [claimChallengeReward] DB fetch error:', error);
                if (data) {
                    rareId = data.rare_reward_id;
                    window._currentChallengeRareRewardId = rareId;
                    console.log('🎁 [claimChallengeReward] Fetched rareId:', rareId);
                }
            }

            if (!rareId) {
                console.warn('🎁 [claimChallengeReward] No rare reward attached — opening Rare Drops collection as fallback');
                toast('No rare skin was attached to this challenge — browse the full collection instead.', 'info');
                try {
                    if (typeof openRareRewardsModal === 'function') {
                        openRareRewardsModal();
                    } else if (typeof window.openRareRewardsModal === 'function') {
                        window.openRareRewardsModal();
                    }
                } catch (err) {
                    console.warn('🎁 [claimChallengeReward] Could not open rare rewards modal:', err);
                }
                return;
            }

            // Unlock locally and show the celebration modal (safe to run even if already unlocked)
            const alreadyUnlocked = (typeof isRareUnlocked === 'function') ? isRareUnlocked(rareId) : false;
            unlockRare(rareId);
            const winnerName = (window.currentUser && (window.currentUser.user_metadata?.full_name || window.currentUser.email)) || 'You';
            console.log('🎁 [claimChallengeReward] Showing celebration — alreadyUnlocked:', alreadyUnlocked);
            showRareUnlockCelebration(rareId, winnerName, true);
            if (alreadyUnlocked) {
                // Gentle note so the user understands why it looks familiar
                setTimeout(() => toast('You already unlocked this reward — equip it from here!', 'success'), 400);
            }
        } catch (e) {
            console.error('🎁 [claimChallengeReward] error:', e);
            toast('Something went wrong claiming your reward. Please try again.', 'error');
        }
    };

    function closeChallengeResults() {
        const modal = document.getElementById('challenge-results-modal');
        if (modal) modal.style.display = 'none';

        // If there's a pending rare celebration, show it now
        if (window._pendingRareCelebration) {
            const { rareId, winnerName } = window._pendingRareCelebration;
            window._pendingRareCelebration = null;
            unlockRare(rareId);
            showRareUnlockCelebration(rareId, winnerName, true);
        }
    }

    // ============================================================
    // UNLOCK CELEBRATION MODAL
    // ============================================================

    // Track which rare was just unlocked for the equip button
    window._lastUnlockedRareId = null;

    function showRareUnlockCelebration(rareId, winnerName, isWinner) {
        const rare = (window.CHARACTER_SKIN_COLLECTION || window.RARE_COLLECTION || []).find(r => r.id === rareId);
        if (!rare) return;

        const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
        window._lastUnlockedRareId = rareId;

        const modal = document.getElementById('rare-unlock-celebration');
        if (!modal) return;

        // Set result text
        const resultText = document.getElementById('unlock-result-text');
        if (resultText) {
            resultText.textContent = isWinner ? 'YOU WON!' : 'REWARD UNLOCKED!';
            resultText.style.color = isWinner ? '#4ade80' : '#fbbf24';
        }

        // Set 3D model (uses universal helper for iOS placeholder support)
        const viewer = window._pbbSetModelSrc
            ? window._pbbSetModelSrc('unlock-rare-viewer', rare.model)
            : document.getElementById('unlock-rare-viewer');
        if (viewer && !window._pbbSetModelSrc) viewer.setAttribute('src', rare.model);

        // Set glow ring color
        const glowRing = document.getElementById('unlock-glow-ring');
        if (glowRing) {
            glowRing.style.background = `radial-gradient(circle, ${tierData.glow} 0%, transparent 70%)`;
        }

        // Set tier badge
        const badgeEl = document.getElementById('unlock-tier-badge');
        if (badgeEl) {
            badgeEl.textContent = tierData.label;
            badgeEl.style.background = tierData.gradient;
        }

        // Set name and desc
        const nameEl = document.getElementById('unlock-rare-name');
        if (nameEl) nameEl.textContent = rare.name;
        const descEl = document.getElementById('unlock-rare-desc');
        if (descEl) descEl.textContent = rare.desc;

        // Generate sparkles
        generateSparkles(tierData.color);

        // Show the modal
        modal.style.display = 'flex';

        // Haptic feedback (if available)
        if (navigator.vibrate) navigator.vibrate([100, 50, 200, 50, 100]);
    }

    function generateSparkles(color) {
        const container = document.getElementById('unlock-sparkles');
        if (!container) return;
        container.innerHTML = '';

        const emojis = ['✨', '⭐', '🌟', '💫', '🎆', '🎇'];
        for (let i = 0; i < 20; i++) {
            const sparkle = document.createElement('div');
            sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            sparkle.style.cssText = `
                position: absolute;
                font-size: ${0.8 + Math.random() * 1.5}rem;
                left: ${10 + Math.random() * 80}%;
                bottom: ${Math.random() * 40}%;
                animation: sparkleFloat ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 1}s forwards;
                opacity: 0;
                pointer-events: none;
            `;
            // Start the animation after a brief delay
            setTimeout(() => sparkle.style.opacity = '1', i * 80);
            container.appendChild(sparkle);
        }
    }

    function equipUnlockedRare() {
        if (window._lastUnlockedRareId) {
            selectRareSkin(window._lastUnlockedRareId);
        }
        closeUnlockCelebration();
    }

    function closeUnlockCelebration() {
        const modal = document.getElementById('rare-unlock-celebration');
        if (modal) modal.style.display = 'none';
        // Clear the viewer to stop loading
        if (window._pbbClearModelSrc) {
            window._pbbClearModelSrc('unlock-rare-viewer');
        } else {
            const viewer = document.getElementById('unlock-rare-viewer');
            if (viewer) {
                if (window._pbbReleaseModelViewer) window._pbbReleaseModelViewer(viewer);
                else viewer.removeAttribute('src');
            }
        }
        window._lastUnlockedRareId = null;
        if (window._showStatAllocationAfterRareUnlock) {
            window._showStatAllocationAfterRareUnlock = false;
            setTimeout(() => {
                try {
                    if (typeof window.showStatAllocationModal === 'function') {
                        window.showStatAllocationModal();
                    }
                } catch(e) {}
            }, 500);
        }
    }

    function openRareRewardsModal() {
        const modal = document.getElementById('rare-rewards-modal');
        if (modal) {
            modal.style.display = 'flex';
            renderRaresGrid();
            const firstRare = (window.RARE_COLLECTION || [])[0];
            if (firstRare) previewRare(firstRare.id);
        }
    }

    function closeRareRewardsModal() {
        const modal = document.getElementById('rare-rewards-modal');
        if (modal) modal.style.display = 'none';
        if (window._pbbClearModelSrc) {
            window._pbbClearModelSrc('rare-reward-viewer');
        } else {
            const viewer = document.getElementById('rare-reward-viewer');
            if (viewer) viewer.src = '';
        }
    }

    function renderRaresGrid() {
        const grid = document.getElementById('rares-grid');
        let userProgress = [];
        try { userProgress = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        grid.innerHTML = (window.RARE_COLLECTION || []).map(rare => {
            const isUnlocked = userProgress.includes(rare.id);
            const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
            const lockLabel = rare.unlockLevel ? ('LV ' + rare.unlockLevel) : 'LOCK';
            return `
                <div onclick="previewRare('${rare.id}')" class="rare-item-card" style="aspect-ratio: 1; border: 2px solid ${isUnlocked ? tierData.color : '#f1f5f9'}; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; background: ${isUnlocked ? '#fffbeb' : 'white'};">
                    <div style="position: absolute; top: 4px; left: 4px; padding: 1px 5px; border-radius: 3px; font-size: 0.45rem; font-weight: 800; letter-spacing: 1px; background: ${tierData.gradient}; color: white;">${tierData.label}</div>
                    <div style="font-size: 2rem; filter: ${isUnlocked ? 'none' : 'grayscale(1) opacity(0.5)'};">${rare.emoji}</div>
                    <div style="font-size: 0.65rem; font-weight: 700; margin-top: 5px; color: ${isUnlocked ? 'var(--primary)' : '#94a3b8'};">${rare.name.toUpperCase()}</div>
                    ${!isUnlocked ? '<div style="position: absolute; top: 5px; right: 5px; font-size: 0.58rem; font-weight: 800; color: #64748b; background: rgba(255,255,255,0.86); border-radius: 6px; padding: 2px 5px;">' + lockLabel + '</div>' : ''}
                </div>
            `;
        }).join('');
    }

    // ============================================================
    // BADGE SYSTEM
    // ============================================================

    const BADGES = [
        // Workout Badges
        { id: 'workout_1',   name: 'First Rep',       emoji: '🏋️', desc: 'Complete your first workout', category: 'Workouts', req: { type: 'workouts', count: 1 } },
        { id: 'workout_5',   name: 'Getting Started',  emoji: '💪', desc: 'Complete 5 workouts', category: 'Workouts', req: { type: 'workouts', count: 5 } },
        { id: 'workout_10',  name: 'Double Digits',    emoji: '🔟', desc: 'Complete 10 workouts', category: 'Workouts', req: { type: 'workouts', count: 10 } },
        { id: 'workout_25',  name: 'Quarter Century',  emoji: '⚡', desc: 'Complete 25 workouts', category: 'Workouts', req: { type: 'workouts', count: 25 } },
        { id: 'workout_50',  name: 'Half Century',     emoji: '🔥', desc: 'Complete 50 workouts', category: 'Workouts', req: { type: 'workouts', count: 50 } },
        { id: 'workout_100', name: 'Centurion',        emoji: '💯', desc: 'Complete 100 workouts', category: 'Workouts', req: { type: 'workouts', count: 100 } },
        { id: 'workout_365', name: 'Year Round',       emoji: '🗓️', desc: 'Complete 365 workouts', category: 'Workouts', req: { type: 'workouts', count: 365 } },
        // Streak Badges
        { id: 'streak_7',    name: 'On Fire',          emoji: '🔥', desc: '7-day workout streak', category: 'Streaks', req: { type: 'streak', count: 7 } },
        { id: 'streak_14',   name: 'Dedicated',        emoji: '⭐', desc: '14-day workout streak', category: 'Streaks', req: { type: 'streak', count: 14 } },
        { id: 'streak_30',   name: 'Iron Will',        emoji: '🏅', desc: '30-day workout streak', category: 'Streaks', req: { type: 'streak', count: 30 } },
        { id: 'streak_60',   name: 'Unbreakable',      emoji: '💎', desc: '60-day workout streak', category: 'Streaks', req: { type: 'streak', count: 60 } },
        // Meal Badges
        { id: 'meal_1',      name: 'First Bite',       emoji: '🥗', desc: 'Track your first meal', category: 'Nutrition', req: { type: 'meals', count: 1 } },
        { id: 'meal_10',     name: 'Meal Prep',        emoji: '🍽️', desc: 'Track 10 meals', category: 'Nutrition', req: { type: 'meals', count: 10 } },
        { id: 'meal_50',     name: 'Nutrition Nerd',   emoji: '📊', desc: 'Track 50 meals', category: 'Nutrition', req: { type: 'meals', count: 50 } },
        { id: 'meal_100',    name: 'Centurion Chef',   emoji: '👨‍🍳', desc: 'Track 100 meals', category: 'Nutrition', req: { type: 'meals', count: 100 } },
        { id: 'meal_365',    name: 'Year of Eating',   emoji: '🏆', desc: 'Track 365 meals', category: 'Nutrition', req: { type: 'meals', count: 365 } },
        // Personal Best Badges
        { id: 'pb_1',        name: 'First PB',         emoji: '🥇', desc: 'Set your first personal best', category: 'PBs', req: { type: 'pbs', count: 1 } },
        { id: 'pb_10',       name: 'PB Machine',       emoji: '⚡', desc: 'Set 10 personal bests', category: 'PBs', req: { type: 'pbs', count: 10 } },
        { id: 'pb_25',       name: 'Record Breaker',   emoji: '💥', desc: 'Set 25 personal bests', category: 'PBs', req: { type: 'pbs', count: 25 } },
        { id: 'pb_50',       name: 'Limitless',        emoji: '🚀', desc: 'Set 50 personal bests', category: 'PBs', req: { type: 'pbs', count: 50 } },
        // Rare Collection Badges
        { id: 'rare_1',      name: 'First Drop',       emoji: '✨', desc: 'Unlock your first rare skin', category: 'Collection', req: { type: 'rares', count: 1 } },
        { id: 'rare_3',      name: 'Collector',        emoji: '🎭', desc: 'Unlock 3 rare skins', category: 'Collection', req: { type: 'rares', count: 3 } },
        { id: 'rare_6',      name: 'Rare Hunter',      emoji: '🏹', desc: 'Unlock 6 rare skins', category: 'Collection', req: { type: 'rares', count: 6 } },
        { id: 'rare_11',     name: 'Complete Set',     emoji: '👑', desc: 'Unlock all 11 rare skins', category: 'Collection', req: { type: 'rares', count: 11 } },
        // Challenge Badges
        { id: 'challenge_1', name: 'Challenger',       emoji: '⚔️', desc: 'Enter your first challenge', category: 'Challenges', req: { type: 'challenges_entered', count: 1 } },
        { id: 'challenge_3', name: 'Competitor',       emoji: '🎯', desc: 'Complete 3 challenges', category: 'Challenges', req: { type: 'challenges_completed', count: 3 } },
        { id: 'challenge_w1',name: 'Champion',         emoji: '🏆', desc: 'Win your first challenge', category: 'Challenges', req: { type: 'challenges_won', count: 1 } },
        { id: 'challenge_w5',name: 'Legendary',        emoji: '🌟', desc: 'Win 5 challenges', category: 'Challenges', req: { type: 'challenges_won', count: 5 } },
        // Level Badges
        { id: 'level_10',    name: 'Rising Star',      emoji: '⭐', desc: 'Reach level 10', category: 'Level', req: { type: 'level', count: 10 } },
        { id: 'level_30',    name: 'Veteran',          emoji: '🎖️', desc: 'Reach level 30', category: 'Level', req: { type: 'level', count: 30 } },
        { id: 'level_50',    name: 'Elite',            emoji: '💎', desc: 'Reach level 50', category: 'Level', req: { type: 'level', count: 50 } },
        { id: 'level_99',    name: 'Legend',           emoji: '👑', desc: 'Reach level 99', category: 'Level', req: { type: 'level', count: 99 } }
    ];

    const BADGE_CATEGORIES = ['Workouts', 'Streaks', 'Nutrition', 'PBs', 'Collection', 'Challenges', 'Level'];

    function getEarnedBadges() {
        try { return JSON.parse(localStorage.getItem('user_badges_earned') || '[]'); } catch(e) { return []; }
    }

    function isBadgeEarned(id) {
        return getEarnedBadges().includes(id);
    }

    function earnBadge(id) {
        const earned = getEarnedBadges();
        if (earned.includes(id)) return false;
        earned.push(id);
        localStorage.setItem('user_badges_earned', JSON.stringify(earned));
        return true;
    }

    // Show a badge-earned toast with animation
    function showBadgeToast(badge) {
        const existing = document.getElementById('badge-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'badge-toast';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.6rem;">${badge.emoji}</span>
                <div>
                    <div style="font-weight: 800; font-size: 0.8rem; color: #fbbf24; letter-spacing: 1px;">BADGE UNLOCKED!</div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: white;">${badge.name}</div>
                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">${badge.desc}</div>
                </div>
            </div>
        `;
        Object.assign(toast.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%) translateY(-100px)',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '16px', padding: '14px 20px', zIndex: '99999', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(251,191,36,0.2)',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease', opacity: '0', minWidth: '240px'
        });
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    }

    // Award a badge and show toast if new
    function awardBadge(id) {
        const badge = BADGES.find(b => b.id === id);
        if (!badge) return;
        const isNew = earnBadge(id);
        if (isNew) {
            showBadgeToast(badge);
            renderBadgeOverlay();
            queueBadgeForCoachAlert(badge);
        }
    }

    // Coach alert pipeline — batch badges earned in the same "moment" (e.g. a
    // meal log that trips meal_10 AND streak_7 at once) into a single POST so
    // Shannon gets one push covering both instead of two pings in a row.
    // Server de-dupes against the user_badges ledger so re-firing is cheap.
    let __pendingBadgeAlerts = [];
    let __pendingBadgeFlush = null;
    function queueBadgeForCoachAlert(badge) {
        if (!badge || !badge.id) return;
        if (__pendingBadgeAlerts.some(b => b.id === badge.id)) return;
        __pendingBadgeAlerts.push(badge);
        if (__pendingBadgeFlush) clearTimeout(__pendingBadgeFlush);
        __pendingBadgeFlush = setTimeout(flushBadgeAlerts, 800);
    }
    async function flushBadgeAlerts() {
        __pendingBadgeFlush = null;
        const user = window.currentUser;
        if (!user || !user.id) return;
        const batch = __pendingBadgeAlerts.splice(0, __pendingBadgeAlerts.length);
        if (!batch.length) return;
        try {
            await fetch('/.netlify/functions/badge-earned-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: user.id,
                    badges: batch.map(b => ({
                        id: b.id, name: b.name, emoji: b.emoji,
                        desc: b.desc, category: b.category,
                    })),
                }),
                keepalive: true,
            });
        } catch (e) {
            // Non-fatal — the badge is in localStorage and the next check
            // that re-earns it will try again (server ledger dedupes).
            console.warn('[badge-alert] dispatch failed:', e?.message || e);
        }
    }

    // Check badges by type against a count
    function checkBadgesForType(type, count) {
        BADGES.filter(b => b.req.type === type && count >= b.req.count).forEach(b => awardBadge(b.id));
    }

    // Individual check functions called from existing code
    async function checkWorkoutBadges() {
        if (!window.currentUser) return;
        try {
            const count = await dbHelpers.workouts.getWorkoutCount(window.currentUser.id);
            checkBadgesForType('workouts', count);
        } catch(e) { console.error('Badge check workouts error:', e); }
    }

    function checkStreakBadges(streakCount) {
        if (typeof streakCount === 'number') checkBadgesForType('streak', streakCount);
    }

    async function checkMealBadges() {
        if (!window.currentUser) return;
        try {
            const { data } = await window.supabaseClient
                .from('user_points')
                .select('total_meals_logged')
                .eq('user_id', window.currentUser.id)
                .maybeSingle();
            if (data?.total_meals_logged) checkBadgesForType('meals', data.total_meals_logged);
        } catch(e) { console.error('Badge check meals error:', e); }
    }

    async function checkPBBadges() {
        if (!window.currentUser) return;
        try {
            const { data, count } = await window.supabaseClient
                .from('personal_bests')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', window.currentUser.id);
            if (count != null) checkBadgesForType('pbs', count);
        } catch(e) { console.error('Badge check PBs error:', e); }
    }

    function checkRareBadges() {
        let rares = [];
        try { rares = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        checkBadgesForType('rares', rares.length);
    }

    async function checkChallengeBadges() {
        if (!window.currentUser) return;
        try {
            const { data: challenges } = await window.supabaseClient
                .from('challenge_participants')
                .select('challenge_id, status, challenges!inner(status, winner_id)')
                .eq('user_id', window.currentUser.id);
            if (!challenges) return;
            const entered = challenges.filter(c => c.status === 'accepted').length;
            const completed = challenges.filter(c => c.challenges?.status === 'completed').length;
            const won = challenges.filter(c => c.challenges?.winner_id === window.currentUser.id).length;
            checkBadgesForType('challenges_entered', entered);
            checkBadgesForType('challenges_completed', completed);
            checkBadgesForType('challenges_won', won);
        } catch(e) { console.error('Badge check challenges error:', e); }
    }

    function checkLevelBadges(level) {
        if (typeof level === 'number') checkBadgesForType('level', level);
    }

    // Master check — called on page load
    async function checkAllBadges() {
        if (!window.currentUser) return;
        try {
            await checkWorkoutBadges();
            await checkMealBadges();
            await checkPBBadges();
            checkRareBadges();
            await checkChallengeBadges();
            // Streak + level pulled from existing UI
            const streakEl = document.getElementById('tamagotchi-streak');
            if (streakEl) checkStreakBadges(parseInt(streakEl.textContent) || 0);
            const levelEl = document.getElementById('tamagotchi-level');
            if (levelEl) checkLevelBadges(parseInt(levelEl.textContent) || 0);
        } catch(e) { console.error('checkAllBadges error:', e); }
    }

    // Render the small badge overlay on tamagotchi screen
    function renderBadgeOverlay() {
        const container = document.getElementById('tamagotchi-widget-container');
        if (!container) return;

        let overlay = document.getElementById('badge-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'badge-overlay';
            Object.assign(overlay.style, {
                position: 'absolute', top: '10px', left: '10px', zIndex: '5',
                display: 'flex', alignItems: 'center', gap: '3px',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                borderRadius: '20px', padding: '4px 8px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)', maxWidth: '180px'
            });
            overlay.onclick = () => openBadgeModal();
            container.appendChild(overlay);
        }

        const earned = getEarnedBadges();
        const earnedBadges = BADGES.filter(b => earned.includes(b.id));
        const maxShow = 5;
        const shown = earnedBadges.slice(-maxShow);
        const overflow = earnedBadges.length - maxShow;

        if (earnedBadges.length === 0) {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'flex';
        overlay.innerHTML = shown.map(b =>
            `<span title="${b.name}" style="font-size: 0.85rem; line-height: 1;">${b.emoji}</span>`
        ).join('') + (overflow > 0 ? `<span style="font-size: 0.6rem; color: rgba(255,255,255,0.7); font-weight: 700; margin-left: 2px;">+${overflow}</span>` : '');
    }

    // Open the full badge collection modal
    function openBadgeModal() {
        const modal = document.getElementById('badge-collection-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        renderBadgeGrid();
    }

    function closeBadgeModal() {
        const modal = document.getElementById('badge-collection-modal');
        if (modal) modal.style.display = 'none';
    }

    function renderBadgeGrid() {
        const content = document.getElementById('badge-grid-content');
        if (!content) return;
        const earned = getEarnedBadges();
        const totalEarned = earned.length;
        const totalBadges = BADGES.length;

        // Progress header
        const progressPct = Math.round((totalEarned / totalBadges) * 100);
        let html = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 2rem; margin-bottom: 6px;">🏅</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: white;">${totalEarned} / ${totalBadges} Badges</div>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-top: 8px; overflow: hidden;">
                    <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #fbbf24); border-radius: 10px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;

        // Categories
        BADGE_CATEGORIES.forEach(cat => {
            const catBadges = BADGES.filter(b => b.category === cat);
            const catEarned = catBadges.filter(b => earned.includes(b.id)).length;

            html += `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1.5px;">${cat}</div>
                        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.3); font-weight: 600;">${catEarned}/${catBadges.length}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            `;

            catBadges.forEach(badge => {
                const isEarned = earned.includes(badge.id);
                html += `
                    <div style="text-align: center; padding: 10px 4px; background: ${isEarned ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}; border-radius: 12px; border: 1px solid ${isEarned ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)'}; ${isEarned ? 'box-shadow: 0 0 12px rgba(251,191,36,0.1);' : 'opacity: 0.4;'}">
                        <div style="font-size: 1.5rem; margin-bottom: 4px; ${isEarned ? '' : 'filter: grayscale(1); opacity: 0.5;'}">${isEarned ? badge.emoji : '❓'}</div>
                        <div style="font-size: 0.6rem; font-weight: 700; color: ${isEarned ? 'white' : 'rgba(255,255,255,0.4)'}; line-height: 1.2;">${isEarned ? badge.name : '???'}</div>
                        <div style="font-size: 0.5rem; color: rgba(255,255,255,0.35); margin-top: 2px; line-height: 1.2;">${badge.desc}</div>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        content.innerHTML = html;
    }

    // Init badges on page load (delayed to not block initial render)
    setTimeout(() => {
        renderBadgeOverlay();
        setTimeout(() => checkAllBadges(), 3000);
    }, 2000);

    function previewRare(id) {
        const rare = (window.RARE_COLLECTION || []).find(r => r.id === id);
        if (!rare) return;
        const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
        // Use universal helper to activate placeholder on iOS
        const viewer = window._pbbSetModelSrc
            ? window._pbbSetModelSrc('rare-reward-viewer', rare.model)
            : document.getElementById('rare-reward-viewer');
        const loader = document.getElementById('rare-preview-loading');
        const info = document.getElementById('rare-info-panel');
        const nameEl = document.getElementById('rare-reward-name');
        const descEl = document.getElementById('rare-reward-desc');
        const statusEl = document.getElementById('rare-reward-status');
        if (!viewer) return;
        loader.style.display = 'flex';
        info.style.display = 'block';
        if (nameEl) nameEl.textContent = rare.name;
        if (descEl) {
            descEl.textContent = rare.unlockLevel
                ? `${tierData.label} • Level ${rare.unlockLevel} reward • ${rare.desc}`
                : `${tierData.label} • ${rare.desc} • ${tierData.buyIn.toLocaleString()} Coins`;
        }
        let unlocked = false;
        try { unlocked = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]').includes(id); } catch(e) {}
        if (statusEl) {
            statusEl.textContent = unlocked ? '🎉 UNLOCKED' : (rare.unlockLevel ? `LEVEL ${rare.unlockLevel} REWARD` : '🏆 CHALLENGE DROPS ONLY');
            statusEl.style.background = unlocked ? '#f0fdf4' : '#fef3c7';
            statusEl.style.color = unlocked ? '#166534' : '#92400e';
        }
        if (!window._pbbSetModelSrc) viewer.src = rare.model;
        viewer.addEventListener('load', () => {
            loader.style.display = 'none';
        }, { once: true });
    }





