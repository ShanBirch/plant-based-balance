console.log("🔥 LOADING BATTLE SYSTEM OVERRIDES...");

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

    // --- OVERRIDE COLOR APPLICATION ---
    window.applyCharacterColors = async function(modelViewer, modelSrc) {
        if(!modelViewer) return;
        
        // Wait for load
        if(!modelViewer.model) {
            await new Promise(r => modelViewer.addEventListener('load', r, {once:true}));
        }
        const model = modelViewer.model;
        if(!model || !model.materials) return;

        const colors = window.getCharacterColors(); // Uses existing helper which reads localStorage
        const src = (modelSrc || modelViewer.src || "").toLowerCase();

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

            // Apply
            model.materials.forEach(mat => {
                const matName = (mat.name || "").toLowerCase();
                const matched = targets.some(t => {
                    if(t.startsWith('part_') || t.startsWith('new_')) {
                        // Strict ID match
                        return matName.includes(t);
                    }
                    return matName.includes(t);
                });

                if(matched) {
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
    };