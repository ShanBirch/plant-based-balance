console.log("🔥 LOADING BATTLE SYSTEM OVERRIDES... (v18: skip-level-rare-recolor)");

    // Track which GLB srcs we've already dumped material names for, so we can
    // log each one once per session. The logs are how we'll finally build
    // correct level_N_* mappings — the previous blackout fixes were all
    // guessing at material names without ever reading what's actually in the
    // GLBs at runtime.
    const _pbbLoggedMaterialNames = new Set();

    // Mobile WebViews can render Tripo/DBZ GLBs with patchy black material
    // artifacts after repeated model swaps. Android is the common case, but
    // WKWebView can hit the same failure mode when textured materials inherit
    // a dark baseColorFactor from a stale/corrupted material instance.
    //
    // Keep this mobile-scoped: desktop renders are useful for asset QA and do
    // not need the extra material normalization.
    const _pbbIsAndroid = /Android/i.test(navigator.userAgent || '');
    const _pbbIsIOS = /iP(ad|hone|od)/i.test(navigator.userAgent || '');
    const _pbbIsNativeMobile = !!(
        window.Capacitor &&
        ((typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
         /^(ios|android)$/i.test(String(window.Capacitor.platform || '')))
    );
    const _pbbNeedsMobileMaterialSafety = _pbbIsAndroid || _pbbIsIOS || _pbbIsNativeMobile ||
        !!window._pbbIsIOSSafari || !!window._pbbIsNativeAndroid;
    // Recovery pass intentionally runs every time it is requested. A same-URL
    // reload can still produce fresh or newly-corrupted material state.
    const _pbbMaterialSafetyTimers = new WeakMap();
    const _pbbMaterialSafetyIntervals = new WeakMap();
    const _pbbModelLoadRecoveryAttempts = new WeakMap();
    const _pbbDefaultBabyModelSrc = 'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb';

    function _pbbHasCustomizableColorMapping(src) {
        return src.includes('baby')
            || src.includes('level_1_female')
            || src.includes('level_1_good')
            || src.includes('shazylvl1');
    }

    function _pbbIsLevelRareCharacterModel(src) {
        const clean = ((typeof window.pbbStripModelVersion === 'function'
            ? window.pbbStripModelVersion(src || '')
            : (src || '')) + '').toLowerCase().split('#')[0].split('?')[0];
        return /\/[0-9]+\.glb$/.test(clean);
    }

    function _pbbShouldApplyCustomCharacterColors(src, skinId) {
        if (/^level_character_[0-9]+$/i.test((skinId || '') + '')) return false;
        if (_pbbIsLevelRareCharacterModel(src)) return false;
        return _pbbHasCustomizableColorMapping(((src || '') + '').toLowerCase());
    }

    window.pbbIsLevelRareCharacterModel = _pbbIsLevelRareCharacterModel;
    window.pbbShouldApplyCharacterColorsToModel = _pbbShouldApplyCustomCharacterColors;

    // Sound System — lazy-load Audio objects on first use.
    // Creating 5 Audio objects at parse time triggers resource allocation + network
    // prefetch, adding memory pressure during HTML parsing on iOS.
    const BATTLE_SOUND_URLS = {
        intro: 'assets/battle_intro.wav',
        bell: 'assets/bell.wav',
        whoosh: 'assets/whoosh.wav',
        hit: 'assets/hit.wav',
        victory: 'assets/victory.wav'
    };
    const BATTLE_SOUNDS = {};

    function playBattleSound(name) {
        if (!BATTLE_SOUND_URLS[name]) return;
        if (!BATTLE_SOUNDS[name]) {
            BATTLE_SOUNDS[name] = new Audio(BATTLE_SOUND_URLS[name]);
        }
        BATTLE_SOUNDS[name].currentTime = 0;
        BATTLE_SOUNDS[name].volume = 0.6;
        BATTLE_SOUNDS[name].play().catch(e => console.log("Audio play failed:", e));
    }

    // (V2 battle logic removed - all battle logic is now in _runBattle below)

    // Mobile material safety pass. Walks every material on the loaded model
    // and forces metallicFactor down + roughnessFactor up so the character
    // renders with diffuse shading instead of dark metal. For textured
    // materials, also reset baseColorFactor back to neutral white; otherwise a
    // stale/dark factor can multiply the baked JPEG texture into black blotches.
    //
    // Logs a once-per-src snapshot of metallic/roughness/baseColorFactor so we
    // can verify the pass is actually changing what we think it's changing.
    async function _pbbAndroidPbrSafetyPass(modelViewer, src) {
        if (!_pbbNeedsMobileMaterialSafety || !modelViewer) return;
        if (!modelViewer.model) {
            await new Promise(r => modelViewer.addEventListener('load', r, { once: true }));
        }
        const model = modelViewer.model;
        if (!model || !model.materials) return;

        const fileName = src.split('/').pop();
        const before = [];
        model.materials.forEach(mat => {
            const pbr = mat.pbrMetallicRoughness;
            if (!pbr) return;

            // Snapshot for logging.
            let bcf = null;
            try { bcf = pbr.baseColorFactor; } catch (e) {}
            const hasTexture = !!pbr.baseColorTexture;
            before.push({
                name: mat.name || '<unnamed>',
                metallic: typeof pbr.metallicFactor === 'number' ? pbr.metallicFactor : '?',
                rough: typeof pbr.roughnessFactor === 'number' ? pbr.roughnessFactor : '?',
                bcf: bcf,
                hasTex: hasTexture,
            });

            // Force matte rendering. Character models should never be metal.
            try { pbr.setMetallicFactor(0.0); } catch (e) {}
            try { pbr.setRoughnessFactor(0.85); } catch (e) {}
            // Preserve the baked texture, but remove any dark tint multiplier.
            try {
                if (hasTexture) pbr.setBaseColorFactor([1, 1, 1, 1]);
            } catch (e) {}
        });

        console.log('[mobileMaterialSafety] GLB=' + fileName + ' fixed', before.length,
            'materials. before snapshot:', before);
    }

    function _pbbScheduleMaterialSafetyPasses(modelViewer, src, reason) {
        if (!_pbbNeedsMobileMaterialSafety || !modelViewer) return;
        const s = ((src || (modelViewer && modelViewer.src) || '') + '').toLowerCase();
        if (!s) return;
        if (_pbbHasCustomizableColorMapping(s)) return;

        const existing = _pbbMaterialSafetyTimers.get(modelViewer) || [];
        existing.forEach(id => clearTimeout(id));
        const existingInterval = _pbbMaterialSafetyIntervals.get(modelViewer);
        if (existingInterval) {
            clearInterval(existingInterval);
            _pbbMaterialSafetyIntervals.delete(modelViewer);
        }

        // Some WebViews apply or rehydrate material factors after the initial
        // load event. Sweep a few times after first render so a late dark
        // texture multiplier does not stick around as black blotches. Custom
        // color models are skipped because model-viewer's material API keeps
        // reporting baseColorTexture after we clear it, so a later neutral
        // texture reset can wipe the user's chosen shirt/pants colors.
        const timers = [0, 300, 1200, 3500, 8000].map(delay => setTimeout(() => {
            const current = ((modelViewer.getAttribute('src') || modelViewer.src || '') + '').toLowerCase();
            if (current && current !== s) return;
            _pbbAndroidPbrSafetyPass(modelViewer, s).catch(() => {});
        }, delay));
        _pbbMaterialSafetyTimers.set(modelViewer, timers);

        // Android WebView can rehydrate the main model's material factors long
        // after the first render, especially after background/resume. Keep a
        // small watchdog only on the home character and only for non-custom
        // textured skins so chosen baby/level-1 colours are never flattened.
        if (modelViewer.id === 'tamagotchi-model') {
            const interval = setInterval(() => {
                const current = ((modelViewer.getAttribute('src') || modelViewer.src || '') + '').toLowerCase();
                if (!current || current !== s || _pbbHasCustomizableColorMapping(current)) {
                    clearInterval(interval);
                    if (_pbbMaterialSafetyIntervals.get(modelViewer) === interval) {
                        _pbbMaterialSafetyIntervals.delete(modelViewer);
                    }
                    return;
                }
                _pbbAndroidPbrSafetyPass(modelViewer, current).catch(() => {});
            }, 5000);
            _pbbMaterialSafetyIntervals.set(modelViewer, interval);
        }

        console.log('[mobileMaterialSafety] scheduled delayed sweeps for ' + s.split('/').pop() +
            ' reason=' + (reason || 'unknown'));
    }

    function _pbbRefreshVisibleMaterialSafety(reason) {
        if (!_pbbNeedsMobileMaterialSafety) return;
        try {
            document.querySelectorAll('model-viewer').forEach(mv => {
                const s = ((mv.getAttribute('src') || mv.src || '') + '').toLowerCase();
                if (!s || _pbbHasCustomizableColorMapping(s)) return;
                _pbbScheduleMaterialSafetyPasses(mv, s, reason || 'refresh');
            });
        } catch (e) {}
    }

    // Expose for any other model-viewer load callbacks (rare-reward, profile,
    // battle, story preloads) that don't go through applyCharacterColors.
    window.applyAndroidPbrSafetyPass = function(modelViewer, modelSrc) {
        const s = ((modelSrc || (modelViewer && modelViewer.src) || "") + "").toLowerCase();
        return _pbbAndroidPbrSafetyPass(modelViewer, s);
    };
    window.applyMobileMaterialSafetyPass = window.applyAndroidPbrSafetyPass;
    window.scheduleMobileMaterialSafetyPasses = _pbbScheduleMaterialSafetyPasses;

    // ─── Universal mobile material safety pass ──────────────────────────
    // The per-call `applyAndroidPbrSafetyPass` only fixes viewers whose caller
    // remembers to invoke it (mostly the main tamagotchi-model via
    // applyCharacterColors). Many other model-viewers in the app
    // (mascot-model, rare-reward-viewer, unlock-rare-viewer,
    // challenge-rare-viewer, story-preload-viewer, wizard-preview-model, and
    // anything created dynamically via iosHotSwapModel) skip that path and
    // set src directly — on mobile those can render patchy-black because the
    // material factors never get normalized.
    //
    // Fix: on mobile only, attach a load listener to every <model-viewer>
    // on the page and to any created later. Each load triggers a safety
    // pass against the fresh materials.
    if (_pbbNeedsMobileMaterialSafety) {
        const _pbbWireViewerForSafetyPass = (mv) => {
            if (!mv || mv.tagName !== 'MODEL-VIEWER') return;
            if (mv._pbbSafetyWired) return;
            mv._pbbSafetyWired = true;
            const runPass = () => {
                const s = ((mv.getAttribute('src') || mv.src || '') + '').toLowerCase();
                if (!s) return;
                mv._pbbLoadedSrc = s;
                _pbbScheduleMaterialSafetyPasses(mv, s, 'model-viewer-load');
                if (!_pbbShouldApplyCustomCharacterColors(s)) return;
                if (mv._pbbColorAppliedForLoadedSrc === s) return;
                mv._pbbColorAppliedForLoadedSrc = s;
                setTimeout(() => {
                    if (typeof window.applyCharacterColors !== 'function') return;
                    if (mv._pbbApplyingCharacterColors) return;
                    const current = ((mv.getAttribute('src') || mv.src || '') + '').toLowerCase();
                    if (current !== s) return;
                    window.applyCharacterColors(mv, s);
                }, 0);
            };
            // Fire on every load — model-viewer dispatches 'load' again when
            // the src changes. The delayed schedule catches material changes
            // that happen after the initial render tick.
            mv.addEventListener('load', runPass);
            mv.addEventListener('error', () => {
                const raw = ((mv.getAttribute('src') || mv.src || '') + '');
                if (!raw) return;
                const attempt = (_pbbModelLoadRecoveryAttempts.get(mv) || 0) + 1;
                _pbbModelLoadRecoveryAttempts.set(mv, attempt);
                if (attempt > 2) return;

                const unversioned = typeof window.pbbCanonicalModelUrl === 'function'
                    ? window.pbbCanonicalModelUrl(raw)
                    : (typeof window.pbbStripModelVersion === 'function' ? window.pbbStripModelVersion(raw) : raw);
                const canonical = typeof window.pbbBustModelUrl === 'function'
                    ? window.pbbBustModelUrl(raw)
                    : unversioned;
                const isMain = mv.id === 'tamagotchi-model';
                const hasModelVersion = raw.indexOf('pbb_model_v=') !== -1;
                let next = null;
                if (hasModelVersion && unversioned && unversioned !== raw) {
                    next = unversioned;
                } else if (canonical && canonical !== raw) {
                    next = canonical;
                } else if (isMain && typeof window.pbbBustModelUrl === 'function') {
                    next = window.pbbBustModelUrl(_pbbDefaultBabyModelSrc);
                } else {
                    next = canonical;
                }
                if (!next || next === raw) return;

                console.warn('[modelLoadRecovery] recovering failed model src', {
                    id: mv.id || '<unnamed>',
                    from: raw,
                    to: next,
                    attempt: attempt
                });
                if (isMain) {
                    try { localStorage.setItem('fitgotchi_model_src', next); } catch (e) {}
                }
                mv.removeAttribute('src');
                setTimeout(() => {
                    const current = ((mv.getAttribute('src') || mv.src || '') + '');
                    if (!current) mv.setAttribute('src', next);
                }, 250);
            });
            // If the model is already parsed by the time we wire up, run now.
            if (mv.model && mv.model.materials) runPass();
        };

        const _pbbWireAllModelViewers = () => {
            try {
                document.querySelectorAll('model-viewer').forEach(_pbbWireViewerForSafetyPass);
            } catch (e) { /* ignore */ }
        };

        // Walk existing elements once the CE is upgraded so .model is available
        // on already-loaded viewers.
        if (window.customElements && customElements.whenDefined) {
            customElements.whenDefined('model-viewer').then(_pbbWireAllModelViewers).catch(() => {});
        }
        // Also wire up on DOM ready in case the CE registered before this
        // script ran.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _pbbWireAllModelViewers, { once: true });
        } else {
            _pbbWireAllModelViewers();
        }

        // Watch for new <model-viewer> elements added later — iosHotSwap
        // recreates the main viewer, rare modal viewers come in via
        // placeholder restores, story preloads get rewritten, etc.
        try {
            const _pbbMv_MO = new MutationObserver((muts) => {
                for (const m of muts) {
                    if (!m.addedNodes) continue;
                    m.addedNodes.forEach(n => {
                        if (!n || n.nodeType !== 1) return;
                        if (n.tagName === 'MODEL-VIEWER') {
                            _pbbWireViewerForSafetyPass(n);
                        } else if (n.querySelectorAll) {
                            n.querySelectorAll('model-viewer').forEach(_pbbWireViewerForSafetyPass);
                        }
                    });
                }
            });
            _pbbMv_MO.observe(document.documentElement || document.body, { childList: true, subtree: true });
        } catch (e) { /* MutationObserver unavailable — best effort */ }

        console.log('[mobileMaterialSafety] universal hook armed — all <model-viewer> loads will be normalized on mobile.');
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) setTimeout(() => _pbbRefreshVisibleMaterialSafety('visibility-resume'), 250);
        });
        window.addEventListener('pageshow', () => setTimeout(() => _pbbRefreshVisibleMaterialSafety('pageshow'), 250));
        window.addEventListener('focus', () => setTimeout(() => _pbbRefreshVisibleMaterialSafety('window-focus'), 250));
    }

    // --- OVERRIDE COLOR APPLICATION ---
    window.applyCharacterColors = async function(modelViewer, modelSrc) {
        if(!modelViewer) return;

        const src = ((modelSrc || modelViewer.src || "") + "").toLowerCase();
        if (modelViewer._pbbApplyingCharacterColors === src) return;
        modelViewer._pbbApplyingCharacterColors = src;
        try {

        // Run mobile material safety BEFORE the allowlist gate — the gate skips
        // level_10+ models (which is the right call for color mapping), but
        // mobile still needs the material factor fix on those models so they
        // don't render as dark/black blotchy silhouettes.
        await _pbbAndroidPbrSafetyPass(modelViewer, src);

        // Only apply colors to models where the per-material mappings have been
        // verified to align with the actual Tripo material names in the GLB.
        //
        // History:
        //   - 2126b87 (Apr 9) originally narrowed the allowlist to baby +
        //     level_1 models after users on iOS started seeing level 5+
        //     characters rendered as a black silhouette. Root cause: the
        //     higher-level mappings target material names like
        //     `part_4_material` that don't match the actual baked material
        //     layout, so baseColorTexture gets nulled on the wrong materials
        //     and solid color factors get painted over them.
        //   - abd2b00 (Apr 16) extended the allowlist to level_10 through
        //     level_50 to carry wizard colors through evolution. This
        //     resurfaced the exact blackout 2126b87 had fixed.
        //   - f55f96c (Apr 16) tightened the substring matcher so `part_1`
        //     stops over-matching `part_10`. That helps when mappings are
        //     correct, but doesn't help when the mapped material names
        //     don't exist in the GLB at all — so the blackout persisted.
        //
        // Restoring the 2126b87 allowlist. Level 10+ characters will render
        // with their baked GLB textures (proper full-colour look) instead of
        // a black silhouette; wizard-chosen colors are lost at evolution,
        // but that's a known, fixable follow-up (remap material targets
        // against actual GLB material names with a per-model inspection).
        const hasCustomizableMapping = _pbbShouldApplyCustomCharacterColors(src);
        if (!hasCustomizableMapping) {
            _pbbScheduleMaterialSafetyPasses(modelViewer, src, 'apply-character-colors');
            return;
        }

        // Wait for load
        if(!modelViewer.model) {
            await new Promise(r => modelViewer.addEventListener('load', r, {once:true}));
        }
        const model = modelViewer.model;
        if(!model || !model.materials) return;

        // Dump actual GLB material names once per src, so future blackout
        // debugging has the real ground truth to build mappings against
        // instead of guessing. This is how we'll finally fix level_10+
        // wizard-color persistence properly.
        if (!_pbbLoggedMaterialNames.has(src)) {
            _pbbLoggedMaterialNames.add(src);
            const names = model.materials.map(m => m.name || '<unnamed>');
            console.log('[applyCharacterColors] GLB=' + src.split('/').pop() + ' materials=', names);
        }

        // Snapshot lower-case material names for target pre-validation below.
        const matNamesLower = model.materials.map(m => (m.name || "").toLowerCase());

        const colors = window.getCharacterColors(); // Uses existing helper which reads localStorage

        // Hex to RGB Helper
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? { r: parseInt(result[1], 16)/255, g: parseInt(result[2], 16)/255, b: parseInt(result[3], 16)/255 } : null;
        };

        Object.keys(colors).forEach(cat => {
            const hex = colors[cat];
            if(!hex) return;
            const linkColor = hexToRgb(hex);
            if(!linkColor) return;

            let targets = [];
            
            // KEYWORD MATCHING LOGIC
            if (src.includes('baby')) {
                 if(cat==='skin') targets=['tripo_part_new_0.001']; if(cat==='hair') targets=['tripo_part_0.001']; if(cat==='pants') targets=['tripo_part_8.001']; if(cat==='shoes') targets=['tripo_part_3.001'];
            }
            else if (src.includes('level_50_female')) {
                if(cat==='skin') targets=['part_11']; if(cat==='hair') targets=['part_4']; if(cat==='shirt') targets=['part_9']; if(cat==='shoes') targets=['part_9'];
            } 
            else if (src.includes('level_40_female')) {
                 if(cat==='skin') targets=['part_1']; if(cat==='hair') targets=['part_10']; if(cat==='shirt') targets=['part_7']; if(cat==='pants') targets=['part_6']; if(cat==='shoes') targets=['part_2'];
            }
            else if (src.includes('level_30_female')) {
                 if(cat==='skin') targets=['new_0_material']; if(cat==='hair') targets=['new_0_0']; if(cat==='shirt') targets=['part_10']; if(cat==='pants') targets=['part_2']; if(cat==='shoes') targets=['part_1'];
            }
            else if (src.includes('level_20_female')) {
                 if(cat==='skin') targets=['part_11', 'part_8', 'tripo_part_new_0_0']; if(cat==='hair') targets=['part_0', 'tripo_part_8']; if(cat==='shirt') targets=['part_3', 'tripo_part_5']; if(cat==='pants') targets=['tripo_part_4']; if(cat==='shoes') targets=['part_1', 'tripo_part_9'];
            }
            else if (src.includes('level_10_female')) {
                 if(cat==='skin') targets=['part_8.001']; if(cat==='hair') targets=['part_new_0.001', 'part_new.001']; if(cat==='shirt') targets=['part_new_0_0.001']; if(cat==='pants') targets=['part_6.001']; if(cat==='shoes') targets=['part_1.001', 'part_10.001'];
            }
            else if (src.includes('level_1_female')) {
                 if(cat==='skin') targets=['part_new']; if(cat==='hair') targets=['part_2']; if(cat==='shirt') targets=['part_8']; if(cat==='pants') targets=['part_4']; if(cat==='shoes') targets=['part_11'];
            }
            // MALE / REAL MODELS
            else if (src.includes('level_50_real')) {
                 if(cat==='skin') targets=['part_4_material']; if(cat==='hair') targets=['part_1_material']; if(cat==='pants') targets=['new_0_material']; if(cat==='shoes') targets=['part_6_material'];
            }
            else if (src.includes('level_40_real')) {
                 if(cat==='skin') targets=['part_3_material']; if(cat==='hair') targets=['part_5_material']; if(cat==='shirt') targets=['part_10_material']; if(cat==='pants') targets=['part_6_material']; if(cat==='shoes') targets=['part_2_material'];
            }
            else if (src.includes('level_30_real')) {
                 if(cat==='skin') targets=['part_13_material']; if(cat==='hair') targets=['part_4_material']; if(cat==='shirt') targets=['new_0_material']; if(cat==='pants') targets=['part_5_material']; if(cat==='shoes') targets=['part_2_material'];
            }
            else if (src.includes('level_20_real')) {
                 if(cat==='skin') targets=['part_0_material']; if(cat==='hair') targets=['part_12_material']; if(cat==='shirt') targets=['part_6_material']; if(cat==='pants') targets=['part_9_material']; if(cat==='shoes') targets=['part_2_material'];
            }
            else if (src.includes('level_10_real')) {
                 if(cat==='skin') targets=['part_0_material']; if(cat==='hair') targets=['part_5_material']; if(cat==='shirt') targets=['part_12_material']; if(cat==='pants') targets=['part_6_material']; if(cat==='shoes') targets=['part_10_material'];
            }
            else if (src.includes('level_1_good') || src.includes('shazylvl1')) {
                 if(cat==='skin') targets=['part_10_material']; if(cat==='hair') targets=['part_7_material']; if(cat==='shirt') targets=['part_5_material']; if(cat==='pants') targets=['part_6_material']; if(cat==='shoes') targets=['part_9_material'];
            }
            
            // Fallback
            if(targets.length === 0) {
                 if(cat==='skin') targets=['skin', 'body', 'face', 'arm', 'hand'];
                 if(cat==='hair') targets=['hair', 'head'];
                 if(cat==='shirt') targets=['shirt', 'top', 'vest'];
                 if(cat==='pants') targets=['pants', 'shorts', 'leg'];
                 if(cat==='shoes') targets=['shoes', 'boot', 'feet'];
            }

            // Matcher used both for pre-validation and the apply loop.
            const matchesTarget = (matName) => targets.some(t => {
                if(t.startsWith('part_') || t.startsWith('new_')) {
                    // Strict ID match — target digits must not be extended.
                    // Without this, target `part_1` also matches materials named
                    // `part_10`, `part_11`, `part_12`, so the skin color gets
                    // painted onto hair/shirt/pants materials and their baked
                    // textures get stripped, leaving the character "blacked out"
                    // at level 10+ (the allowlist expansion in abd2b00 exposed
                    // a latent bug that was also present for baby / level_1).
                    // Allowed next-chars after target: end-of-string, `.` (for
                    // `.001` Blender suffixes), `_` (for `_material` / `_0_0`).
                    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    return new RegExp('(^|[^a-z0-9])' + escaped + '(?![0-9])').test(matName);
                }
                return matName.includes(t);
            });

            // Pre-validate: do any real materials match? If nothing matches,
            // skip this category entirely. This is the core blackout guard —
            // the previous bug was that targets listed material names that
            // didn't actually exist in the GLB, yet the apply loop would still
            // null `baseColorTexture` on anything it thought matched (e.g.
            // `part_1` matching `part_10` via substring). Now we also bail
            // out if not a single material name in the GLB lines up.
            const anyMatch = matNamesLower.some(n => matchesTarget(n));
            if (!anyMatch) {
                console.warn('[applyCharacterColors] no materials matched for cat=' + cat +
                    ' on GLB=' + src.split('/').pop() + ' — skipping to preserve baked textures.',
                    { targets, available: matNamesLower });
                return;
            }

            // Second guard: if `targets` would match MORE than 60% of all
            // materials in the GLB, the mapping is almost certainly wrong
            // (legitimate per-category mappings target 1–2 materials out of
            // ~10). Bailing here prevents a mis-broadened match from stripping
            // every baked texture and blacking the character out.
            const matchCount = matNamesLower.filter(n => matchesTarget(n)).length;
            if (matchCount > Math.max(2, Math.floor(matNamesLower.length * 0.6))) {
                console.warn('[applyCharacterColors] suspicious wide match for cat=' + cat +
                    ' (' + matchCount + '/' + matNamesLower.length + ') on GLB=' +
                    src.split('/').pop() + ' — skipping to avoid blackout.',
                    { targets, available: matNamesLower });
                return;
            }

            // Apply
            model.materials.forEach(mat => {
                const matName = (mat.name || "").toLowerCase();
                if(matchesTarget(matName)) {
                    const pbr = mat.pbrMetallicRoughness;
                    pbr.baseColorTexture = null;
                    pbr.setBaseColorFactor([linkColor.r, linkColor.g, linkColor.b, 1]);
                    if(cat==='skin' || cat==='hair') {
                        pbr.setRoughnessFactor(0.9);
                        pbr.setMetallicFactor(0.0);
                    }
                }
            });
        });
        } finally {
            if (modelViewer._pbbApplyingCharacterColors === src) {
                modelViewer._pbbApplyingCharacterColors = null;
            }
        }
    };
