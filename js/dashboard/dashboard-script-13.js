(function() {
        const TAMAGOTCHI_EVOLUTIONS_MALE = [
            { level: 1,  xp: 0,    title: "Hatchling", src: "https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb" },
            { level: 5,  xp: 15,   title: "Newcomer",  src: "https://f005.backblazeb2.com/file/shannonsvideos/level_1_good_final.glb" },
            { level: 10, xp: 46,   title: "Rising",    src: "https://f005.backblazeb2.com/file/shannonsvideos/level_10_real_final.glb" },
            { level: 20, xp: 133,  title: "Growing",   src: "https://f005.backblazeb2.com/file/shannonsvideos/level_20_real_final.glb" },
            { level: 30, xp: 251,  title: "Consistent",src: "https://f005.backblazeb2.com/file/shannonsvideos/level_30_real_final.glb" },
            { level: 40, xp: 393,  title: "Committed", src: "https://f005.backblazeb2.com/file/shannonsvideos/level_40_real_final.glb" },
            { level: 50, xp: 557,  title: "Dedicated", src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" },
            { level: 60, xp: 739,  title: "Veteran",   src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" },
            { level: 70, xp: 938,  title: "Expert",    src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" },
            { level: 80, xp: 1152, title: "Champion",  src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" },
            { level: 90, xp: 1381, title: "Master",    src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" },
            { level: 99, xp: 1605, title: "Legend",    src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb" }
        ];

        const TAMAGOTCHI_EVOLUTIONS_FEMALE = [
            { level: 1,  xp: 0,    title: "Hatchling", src: "https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb" },
            { level: 5,  xp: 15,   title: "Newcomer",  src: "https://f005.backblazeb2.com/file/shannonsvideos/level_1_female_final.glb" },
            { level: 10, xp: 46,   title: "Rising",    src: "https://f005.backblazeb2.com/file/shannonsvideos/level_10_female_final.glb" },
            { level: 20, xp: 133,  title: "Growing",   src: "https://f005.backblazeb2.com/file/shannonsvideos/level_20_female_final.glb" },
            { level: 30, xp: 251,  title: "Consistent",src: "https://f005.backblazeb2.com/file/shannonsvideos/level_30_female_final.glb" },
            { level: 40, xp: 393,  title: "Committed", src: "https://f005.backblazeb2.com/file/shannonsvideos/level_40_female_final.glb" },
            { level: 50, xp: 557,  title: "Dedicated", src: "https://f005.backblazeb2.com/file/shannonsvideos/level_50_female_final.glb" }
        ];

        // Default to Male for backward compatibility, will be overridden by user fact
        let TAMAGOTCHI_EVOLUTIONS = TAMAGOTCHI_EVOLUTIONS_MALE;

        // Character material mappings for each level model
        // Maps body part names to material indices for color customization
        const CHARACTER_MATERIAL_MAPPINGS = {
            // Dynamic logic used instead
        };

        // Color options for character customization
        const CHARACTER_COLOR_OPTIONS = {
            hair: [
                { name: 'Black', hex: '#1a1a1a' },
                { name: 'Brown', hex: '#4a3728' },
                { name: 'Blonde', hex: '#d4a574' },
                { name: 'Red', hex: '#8b2500' },
                { name: 'Auburn', hex: '#6b3a2e' },
                { name: 'Gray', hex: '#808080' },
                { name: 'Pink', hex: '#ff69b4' },
                { name: 'Blue', hex: '#4169e1' },
                { name: 'Purple', hex: '#8b008b' },
                { name: 'Green', hex: '#228b22' }
            ],
            shirt: [
                { name: 'Green', hex: '#7BA883' },
                { name: 'Blue', hex: '#4A90D9' },
                { name: 'Pink', hex: '#D98B9C' },
                { name: 'Purple', hex: '#9B59B6' },
                { name: 'Orange', hex: '#E67E22' },
                { name: 'Red', hex: '#E74C3C' },
                { name: 'Yellow', hex: '#F1C40F' },
                { name: 'Black', hex: '#2C3E50' },
                { name: 'White', hex: '#ECF0F1' },
                { name: 'Teal', hex: '#16A085' }
            ],
            pants: [
                { name: 'Black', hex: '#2C3E50' },
                { name: 'Navy', hex: '#1a365d' },
                { name: 'Gray', hex: '#718096' },
                { name: 'Green', hex: '#276749' },
                { name: 'Blue', hex: '#2b6cb0' },
                { name: 'Purple', hex: '#6b46c1' },
                { name: 'Red', hex: '#c53030' },
                { name: 'Pink', hex: '#d53f8c' }
            ],
            shoes: [
                { name: 'White', hex: '#f7fafc' },
                { name: 'Black', hex: '#1a202c' },
                { name: 'Gray', hex: '#718096' },
                { name: 'Red', hex: '#e53e3e' },
                { name: 'Blue', hex: '#3182ce' },
                { name: 'Green', hex: '#38a169' },
                { name: 'Pink', hex: '#ed64a6' },
                { name: 'Purple', hex: '#805ad5' }
            ],
            skin: [
                { name: 'Light', hex: '#FFE4C4' },
                { name: 'Fair', hex: '#FFDAB9' },
                { name: 'Medium', hex: '#DEB887' },
                { name: 'Olive', hex: '#C9A86C' },
                { name: 'Tan', hex: '#CD853F' },
                { name: 'Brown', hex: '#A0522D' },
                { name: 'Dark', hex: '#8B4513' },
                { name: 'Deep', hex: '#654321' }
            ]
        };

        // Default character colors
        const DEFAULT_CHARACTER_COLORS = {
            hair: '#4a3728',      // Brown
            shirt: '#7BA883',     // Green
            pants: '#2C3E50',    // Black
            shoes: '#1a202c',     // Black
            skin: '#DEB887'       // Medium
        };

        // Get saved character colors or defaults
        window.getCharacterColors = function() {
            try {
                const saved = localStorage.getItem('characterColors');
                if (saved) {
                    return JSON.parse(saved);
                }
            } catch (e) {
                console.error('Error loading character colors:', e);
            }
            return { ...DEFAULT_CHARACTER_COLORS };
        };

        // Load character colors and gender from database
        window.loadCharacterColorsFromDb = async function() {
            if (!window.currentUser || !window.dbHelpers) return;

            try {
                const userId = window.currentUser.id || window.currentUser.user_id;

                // Get user profile from users table (which has the sex field)
                const userProfile = await window.dbHelpers.users.get(userId);
                const facts = await window.dbHelpers.userFacts.get(userId);

                // Get gender from user profile (users table has the authoritative sex field)
                const userSex = userProfile?.sex || 'female';
                window.currentUserGender = userSex;

                if (userSex.toLowerCase() === 'female') {
                    TAMAGOTCHI_EVOLUTIONS = TAMAGOTCHI_EVOLUTIONS_FEMALE;
                    console.log('Character system: Switched to Female evolution path');
                } else {
                    TAMAGOTCHI_EVOLUTIONS = TAMAGOTCHI_EVOLUTIONS_MALE;
                    console.log('Character system: Switched to Male evolution path');
                }

                // Load character colors from user_facts if available
                if (facts?.additional_data?.character_colors) {
                    const dbColors = facts.additional_data.character_colors;
                    const mergedColors = { ...DEFAULT_CHARACTER_COLORS, ...dbColors };
                    localStorage.setItem('characterColors', JSON.stringify(mergedColors));
                    console.log('Character colors loaded from database:', mergedColors);

                    // Re-apply to model if loaded
                    const modelViewer = document.getElementById('tamagotchi-model');
                    if (modelViewer && modelViewer.model) {
                        window.applyCharacterColors(modelViewer, modelViewer.getAttribute('src'));
                    }
                }
            } catch (e) {
                console.warn('Could not load character colors from database:', e);
            }
        };

        // Save character colors (localStorage and database)
        window.saveCharacterColors = async function(colors) {
            try {
                // Save to localStorage
                localStorage.setItem('characterColors', JSON.stringify(colors));
                console.log('Character colors saved to localStorage:', colors);

                // Save to database if user is logged in
                if (window.currentUser && window.dbHelpers) {
                    const userId = window.currentUser.id || window.currentUser.user_id;
                    try {
                        const existingFacts = await window.dbHelpers.userFacts.get(userId) || {};
                        const currentAdditional = existingFacts.additional_data || {};

                        await window.dbHelpers.userFacts.upsert(userId, {
                            additional_data: {
                                ...currentAdditional,
                                character_colors: colors
                            }
                        });
                        console.log('Character colors saved to database:', colors);
                    } catch (dbErr) {
                        console.warn('Could not save character colors to database:', dbErr);
                    }
                }
            } catch (e) {
                console.error('Error saving character colors:', e);
            }
        };

        // Apply colors to a model-viewer element
        window.applyCharacterColors = async function(modelViewer, modelSrc) {
            if (!modelViewer) return;

            const colors = window.getCharacterColors();
            const modelName = modelSrc ? modelSrc.split('/').pop() : modelViewer.getAttribute('src')?.split('/').pop();
            const mapping = CHARACTER_MATERIAL_MAPPINGS[modelName];

            if (!mapping) {
                console.log('No material mapping found for model:', modelName);
                return;
            }

            // Wait for model to be loaded
            if (!modelViewer.model) {
                await new Promise(resolve => {
                    modelViewer.addEventListener('load', resolve, { once: true });
                });
            }

            const model = modelViewer.model;
            if (!model || !model.materials) {
                console.log('Model or materials not available');
                return;
            }

            console.log('Applying character colors to', modelName, colors);

            // Apply each color to corresponding material
            for (const [part, config] of Object.entries(mapping)) {
                const colorKey = part.replace('Secondary', '').replace('Accent', '');
                const colorHex = colors[colorKey];

                if (colorHex) {
                    try {
                        if (config.names) {
                            // Name-based mapping (for segmented Tripo models)
                            model.materials.forEach(mat => {
                                const name = (mat.name || "").toLowerCase();
                                if (config.names.some(target => name.includes(target.toLowerCase()))) {
                                    applyColorToMaterial(mat, colorHex);
                                }
                            });
                        } else if (config.index !== undefined && model.materials[config.index]) {
                            // Index-based mapping (for legacy models)
                            applyColorToMaterial(model.materials[config.index], colorHex);
                        }
                    } catch (e) {
                        console.log('Could not apply color to', part, e);
                    }
                }
            }
        };

        // Helper function to apply color and clear textures for visibility
        function applyColorToMaterial(material, colorHex) {
            const rgb = hexToRgb(colorHex);
            if (rgb && material.pbrMetallicRoughness) {
                const pbr = material.pbrMetallicRoughness;
                // Clearing baseColorTexture is key for Tripo-segmented models to show custom colors
                pbr.baseColorTexture = null; 
                pbr.setBaseColorFactor([
                    rgb.r / 255,
                    rgb.g / 255,
                    rgb.b / 255,
                    1
                ]);
            }
        }

        // Helper function to convert hex to RGB
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        // Expose material mappings and color options globally
        window.CHARACTER_MATERIAL_MAPPINGS = CHARACTER_MATERIAL_MAPPINGS;
        window.CHARACTER_COLOR_OPTIONS = CHARACTER_COLOR_OPTIONS;
        window.DEFAULT_CHARACTER_COLORS = DEFAULT_CHARACTER_COLORS;

        // Function to calculate XP threshold for a specific level based on the app's curve
        // Math.floor(0.07 * Math.pow(level, 2.4) + 0.7 * level)
        function getXPForLevel(lvl) {
            if (lvl <= 1) return 0;
            return Math.floor(0.07 * Math.pow(lvl, 2.4) + 0.7 * lvl);
        }

        window.updateFitGotchi = async function(pointsData) {
            // When called without arguments (e.g. from clearRareSkin), re-fetch points
            if (!pointsData) {
                try {
                    const userId = window.currentUser?.id;
                    if (userId && window.db?.points?.getPoints) {
                        pointsData = await window.db.points.getPoints(userId);
                    }
                } catch(e) {}
                if (!pointsData) return;
            }

            const lifetimePoints = pointsData.lifetime_points || 0;
            const currentStreak = pointsData.current_streak || 0;

            // Guard: Don't overwrite valid cached level with default level 1.
            // This prevents a race condition where loadPointsWidget fires before
            // auth is ready, receives 0 lifetime_points, and resets a level 35
            // user back to level 1 (including overwriting the localStorage cache).
            if (lifetimePoints === 0) {
                const cachedLevel = parseInt(localStorage.getItem('fitgotchi_level'));
                if (cachedLevel > 1) {
                    return;
                }
            }

            // Calculate actual level using app's logic
            let level = 1;
            while (level < 99) {
                if (lifetimePoints < getXPForLevel(level + 1)) break;
                level++;
            }

            const currentLevelXP = getXPForLevel(level);
            const nextLevelXP = getXPForLevel(level + 1);
            
            // Update UI Elements
            const levelEl = document.getElementById('tamagotchi-level');
            const rankEl = document.getElementById('tamagotchi-rank');
            const xpTextEl = document.getElementById('tamagotchi-xp-text');
            const xpBarEl = document.getElementById('tamagotchi-xp-bar');
            const streakEl = document.getElementById('tamagotchi-streak');
            const modelViewer = document.getElementById('tamagotchi-model');

            if (levelEl) levelEl.textContent = level;
            if (streakEl) streakEl.textContent = currentStreak;

            // Check level and streak badges
            try {
                if (typeof checkLevelBadges === 'function') checkLevelBadges(level);
                if (typeof checkStreakBadges === 'function') checkStreakBadges(currentStreak);
            } catch(e) {}

            // Find matching evolution for the model
            // Ensure gender is loaded BEFORE selecting evolution (must await to fix female character bug)
            if (!window.currentUserGender && window.currentUser) {
                await loadCharacterColorsFromDb();
            }
            
            const currentEvolution = [...TAMAGOTCHI_EVOLUTIONS].reverse().find(e => level >= e.level) || TAMAGOTCHI_EVOLUTIONS[0];
            if (rankEl) rankEl.textContent = currentEvolution.title;

            // Progress calculation
            if (level < 99) {
                const range = nextLevelXP - currentLevelXP;
                const progress = lifetimePoints - currentLevelXP;
                const percent = Math.min(100, Math.max(0, (progress / range) * 100));
                if (xpBarEl) xpBarEl.style.width = percent + '%';
                if (xpTextEl) xpTextEl.textContent = `${lifetimePoints - currentLevelXP} / ${range} XP to Level ${level + 1}`;
            } else {
                if (xpBarEl) xpBarEl.style.width = '100%';
                if (xpTextEl) xpTextEl.textContent = `${lifetimePoints} XP (MAX)`;
            }

            // Apply rare/evolution skin overrides if active
            const activeRareSkinId = localStorage.getItem('active_rare_skin');
            const activeEvoSkinOverride = localStorage.getItem('active_evolution_skin');

            if (activeRareSkinId && window.RARE_COLLECTION && window.DBZ_COLLECTION) {
                const rareData = [...window.RARE_COLLECTION, ...window.DBZ_COLLECTION].find(r => r.id === activeRareSkinId);
                if (rareData) {
                    const isUnlocked = window.DBZ_COLLECTION.some(c => c.id === activeRareSkinId) || 
                                     (typeof window.isRareUnlocked === 'function' && window.isRareUnlocked(activeRareSkinId));
                    if (isUnlocked) {
                        if (modelViewer.getAttribute('src') !== rareData.model) {
                            modelViewer.setAttribute('src', rareData.model);
                        }
                        if (window.applyCharacterColors) {
                            window.applyCharacterColors(modelViewer, rareData.model);
                        }
                    } else {
                        localStorage.removeItem('active_rare_skin');
                    }
                }
            } else if (activeEvoSkinOverride) {
                if (modelViewer.getAttribute('src') !== activeEvoSkinOverride) {
                    modelViewer.setAttribute('src', activeEvoSkinOverride);
                }
                if (window.applyCharacterColors) {
                    window.applyCharacterColors(modelViewer, activeEvoSkinOverride);
                }
            } else {
                const currentSrc = modelViewer.getAttribute('src');
                if (currentSrc !== currentEvolution.src) {
                    modelViewer.setAttribute('src', currentEvolution.src);
                    if (currentSrc) {
                        modelViewer.style.filter = 'brightness(3) contrast(1.2)';
                        setTimeout(() => modelViewer.style.filter = '', 500);
                    }
                }
                if (window.applyCharacterColors) {
                    window.applyCharacterColors(modelViewer, currentEvolution.src);
                }
            }

            if (modelViewer) {
                // Camera distance logic based on level
                let cameraDist = 22.0;
                if (level >= 99) cameraDist = 12.0;
                else if (level >= 40) cameraDist = 18.0 - ((level - 40) / 59 * 6.0);
                else cameraDist = 22.0 - (level / 40 * 4.0);

                // Use consistent field-of-view for both male and female characters
                let fov = 30;

                // Only update camera if not in battle (battle locks camera to side profile)
                if (!window._battleInProgress && !window.isDuringBattle) {
                    modelViewer.setAttribute('camera-orbit', `0deg 85deg ${cameraDist}m`);
                    modelViewer.setAttribute('field-of-view', `${fov}deg`);
                }

                // Scale down both male and female characters equally via CSS transform
                modelViewer.style.transform = 'scale(0.75)';
                modelViewer.style.transformOrigin = 'center center';

                // Cache current model state for instant restore on next page load
                // Skip in admin view-as mode to prevent character state leakage
                if (!window.isAdminViewing) {
                    try {
                        var finalSrc = modelViewer.getAttribute('src');
                        if (finalSrc) localStorage.setItem('fitgotchi_model_src', finalSrc);
                        localStorage.setItem('fitgotchi_camera_orbit', `0deg 85deg ${cameraDist}m`);
                        localStorage.setItem('fitgotchi_fov', `${fov}deg`);
                        localStorage.setItem('fitgotchi_scale', 'scale(0.75)');
                    } catch(e) {}
                }
            }

            // Cache stats for instant restore on next page load
            // Skip in admin view-as mode to prevent state leakage
            if (!window.isAdminViewing) {
                try {
                    localStorage.setItem('fitgotchi_level', String(level));
                    localStorage.setItem('fitgotchi_rank', currentEvolution.title);
                    localStorage.setItem('fitgotchi_streak', String(currentStreak));
                    if (xpBarEl) localStorage.setItem('fitgotchi_xp_percent', xpBarEl.style.width);
                    if (xpTextEl) localStorage.setItem('fitgotchi_xp_text', xpTextEl.textContent);
                } catch(e) {}
            }
        };

        // Animation unlock system - animations unlocked at specific levels
        // 55 real model animations (idle is always available, NlaTrack.055 is internal):
        // laugh, walk, warm_up, greet, pitch, arms_up_still, greet_1, laugh_1,
        // angry, karate, sad_stand, boxing, laugh_2, stretch, hit_to_1, dance,
        // hit_to_2, fold_arms, die, laugh_3, angry_1, idle, stand_hands_on_hips,
        // hit_to_head, strut, hit_to_side, dance_1, dance_2, dance_3, dance_4,
        // sit, lose, kick, pushup, clap, boxing_1, angry_walk, boxing_2,
        // cartwheel, basketball, greet_2, depressed_walk, angry_2, hit_to_3,
        // bow, say_goodbye, block, die_1, volleyball, kick_2, dance_5, agree,
        // stand, angry_3, heart_pose
        // NOTE: 'idle' is NOT in the unlock array - unmapped animations default to unlocked
        const ANIMATION_UNLOCKS = [
            // Level 1 starter animations (baby has full animations now)
            { name: 'walk', displayName: 'Walk', unlockLevel: 1, icon: '🚶', category: 'special' },
            { name: 'greet', displayName: 'Greet', unlockLevel: 1, icon: '👋', category: 'greetings' },
            { name: 'agree', displayName: 'Agree', unlockLevel: 1, icon: '👍', category: 'reactions' },
            { name: 'laugh', displayName: 'Laugh', unlockLevel: 1, icon: '😄', category: 'celebrations' },
            { name: 'boxing', displayName: 'Boxing', unlockLevel: 1, icon: '🥊', category: 'combat' },

            // Level 3 unlocks
            { name: 'fold_arms', displayName: 'Fold Arms', unlockLevel: 3, icon: '🤔', category: 'reactions' },

            // Level 5 unlocks (Newcomer evolution)
            { name: 'bow', displayName: 'Bow', unlockLevel: 5, icon: '🙇', category: 'greetings' },
            { name: 'sad_stand', displayName: 'Sad', unlockLevel: 5, icon: '😔', category: 'reactions' },
            { name: 'clap', displayName: 'Clap', unlockLevel: 5, icon: '👏', category: 'celebrations' },
            { name: 'warm_up', displayName: 'Warm Up', unlockLevel: 5, icon: '🔥', category: 'exercise' },
            { name: 'dance', displayName: 'Dance', unlockLevel: 5, icon: '💃', category: 'dance' },

            // Level 8 unlocks
            { name: 'angry', displayName: 'Angry', unlockLevel: 8, icon: '😠', category: 'reactions' },
            { name: 'laugh_1', displayName: 'Giggle', unlockLevel: 8, icon: '😂', category: 'celebrations' },
            { name: 'angry_2', displayName: 'Furious', unlockLevel: 8, icon: '🤬', category: 'reactions' },

            // Level 10 unlocks (Rising evolution + Battle Mode)
            { name: 'greet_1', displayName: 'Hey!', unlockLevel: 10, icon: '🤙', category: 'greetings' },
            { name: 'greet_2', displayName: 'Hi There', unlockLevel: 10, icon: '✌️', category: 'greetings' },
            { name: 'angry_1', displayName: 'Annoyed', unlockLevel: 10, icon: '😤', category: 'reactions' },
            { name: 'stretch', displayName: 'Stretch', unlockLevel: 10, icon: '🧘', category: 'exercise' },
            { name: 'kick', displayName: 'Kick', unlockLevel: 10, icon: '🦵', category: 'combat' },
            { name: 'hit_to_2', displayName: 'Hit To 2', unlockLevel: 10, icon: '🤜', category: 'reactions' },
            { name: 'stand_hands_on_hips', displayName: 'Power Pose', unlockLevel: 10, icon: '💪', category: 'poses' },
            { name: 'strut', displayName: 'Strut', unlockLevel: 10, icon: '🚶', category: 'dance' },

            // Level 15 unlocks
            { name: 'lose', displayName: 'Lose', unlockLevel: 15, icon: '😞', category: 'reactions' },
            { name: 'pushup', displayName: 'Push-Up', unlockLevel: 15, icon: '💪', category: 'exercise' },
            { name: 'karate', displayName: 'Karate', unlockLevel: 15, icon: '🥋', category: 'combat' },
            { name: 'hit_to_head', displayName: 'Hit To Head', unlockLevel: 15, icon: '🎯', category: 'reactions' },
            { name: 'hit_to_side', displayName: 'Hit To Side', unlockLevel: 15, icon: '⚡', category: 'reactions' },
            { name: 'dance_1', displayName: 'Groove', unlockLevel: 15, icon: '🎵', category: 'dance' },
            { name: 'arms_up_still', displayName: 'Arms Up', unlockLevel: 15, icon: '🙌', category: 'celebrations' },
            { name: 'laugh_3', displayName: 'Cracking Up', unlockLevel: 15, icon: '😹', category: 'celebrations' },

            // Level 20 unlocks (Growing evolution)
            { name: 'say_goodbye', displayName: 'Goodbye', unlockLevel: 20, icon: '👋', category: 'greetings' },
            { name: 'depressed_walk', displayName: 'Sad Walk', unlockLevel: 20, icon: '🚶', category: 'reactions' },
            { name: 'angry_3', displayName: 'Rage', unlockLevel: 20, icon: '💢', category: 'reactions' },
            { name: 'heart_pose', displayName: 'Heart Pose', unlockLevel: 20, icon: '❤️', category: 'celebrations' },
            { name: 'basketball', displayName: 'Basketball', unlockLevel: 20, icon: '🏀', category: 'exercise' },
            { name: 'boxing_1', displayName: 'Boxing Combo', unlockLevel: 20, icon: '🥊', category: 'combat' },
            { name: 'hit_to_3', displayName: 'Hit To 3', unlockLevel: 20, icon: '💥', category: 'reactions' },
            { name: 'stand', displayName: 'Stand Tall', unlockLevel: 20, icon: '🧍', category: 'poses' },
            { name: 'dance_2', displayName: 'Moves', unlockLevel: 20, icon: '🎶', category: 'dance' },

            // Level 25 unlocks
            { name: 'angry_walk', displayName: 'Angry Walk', unlockLevel: 25, icon: '😡', category: 'reactions' },
            { name: 'laugh_2', displayName: 'LOL', unlockLevel: 25, icon: '🤣', category: 'celebrations' },
            { name: 'volleyball', displayName: 'Volleyball', unlockLevel: 25, icon: '🏐', category: 'exercise' },
            { name: 'hit_to_1', displayName: 'Hit To 1', unlockLevel: 25, icon: '👊', category: 'reactions' },
            { name: 'dance_3', displayName: 'Boogie', unlockLevel: 25, icon: '🕺', category: 'dance' },

            // Level 30 unlocks (Consistent evolution)
            { name: 'pitch', displayName: 'Pitch', unlockLevel: 30, icon: '⚾', category: 'poses' },
            { name: 'cartwheel', displayName: 'Cartwheel', unlockLevel: 30, icon: '🤸', category: 'special' },
            { name: 'dance_4', displayName: 'Freestyle', unlockLevel: 30, icon: '🎧', category: 'dance' },
            { name: 'boxing_2', displayName: 'Boxing Pro', unlockLevel: 30, icon: '💥', category: 'combat' },

            // Level 35 unlocks
            { name: 'dance_5', displayName: 'Show Off', unlockLevel: 35, icon: '✨', category: 'dance' },

            // Level 40 unlocks (Committed evolution)
            { name: 'kick_2', displayName: 'Spin Kick', unlockLevel: 40, icon: '🌀', category: 'combat' },
            { name: 'sit', displayName: 'Sit Down', unlockLevel: 40, icon: '🪑', category: 'special' },
            { name: 'block', displayName: 'Block', unlockLevel: 40, icon: '🛡️', category: 'combat' },

            // Level 50+ unlocks (Dedicated evolution)
            { name: 'die', displayName: 'Drama Fall', unlockLevel: 50, icon: '🎭', category: 'special' },
            { name: 'die_1', displayName: 'Play Dead', unlockLevel: 60, icon: '😵', category: 'special' },
        ];

        // Background unlock system - 20+ backgrounds from DB to DBZ/DBS
        const BACKGROUND_UNLOCKS = [
            { name: 'none', displayName: 'Default', unlockLevel: 1, icon: '🌑', theme: 'tamagotchi-bg-none', image: null },
            { name: 'mt_paozu', displayName: 'Mt. Paozu', unlockLevel: 1, icon: '🏠', theme: 'tamagotchi-bg-park', image: './assets/mt_paozu.png' },
            { name: 'kame_house', displayName: 'Kame House', unlockLevel: 1, icon: '🏝️', theme: 'tamagotchi-bg-beach', image: './assets/kame_house.png' },
            { name: 'pilaf', displayName: 'Pilaf Castle', unlockLevel: 5, icon: '🏰', theme: 'tamagotchi-bg-none', image: './assets/pilaf_castle.png' },
            { name: 'muscle_tower', displayName: 'Muscle Tower', unlockLevel: 10, icon: '❄️', theme: 'tamagotchi-bg-none', image: './assets/muscle_tower.png' },
            { name: 'arena', displayName: 'Tournament', unlockLevel: 15, icon: '🏆', theme: 'tamagotchi-bg-arena', image: './assets/tournament_arena.png' },
            { name: 'korin', displayName: 'Korin Tower', unlockLevel: 22, icon: '🐱', theme: 'tamagotchi-bg-mountain', image: './assets/korin_tower.png' },
            { name: 'lookout', displayName: 'Kami\'s Lookout', unlockLevel: 30, icon: '🏛️', theme: 'tamagotchi-bg-mountain', image: './assets/kamis_lookout.png' },
            { name: 'wasteland', displayName: 'Wasteland', unlockLevel: 40, icon: '🏜️', theme: 'tamagotchi-bg-mountain', image: './assets/wasteland.png' },
            { name: 'snake_way', displayName: 'Snake Way', unlockLevel: 50, icon: '🐍', theme: 'tamagotchi-bg-none', image: './assets/snake_way.png' },
            { name: 'king_kai', displayName: 'King Kai\'s', unlockLevel: 60, icon: '🪐', theme: 'tamagotchi-bg-none', image: './assets/king_kais_planet.png' },
            { name: 'namek', displayName: 'Planet Namek', unlockLevel: 75, icon: '🌌', theme: 'tamagotchi-bg-mountain', image: './assets/planet_namek.png' },
            { name: 'frieza_ship', displayName: 'Frieza Ship', unlockLevel: 90, icon: '🛸', theme: 'tamagotchi-bg-none', image: './assets/frieza_ship.png' },
            { name: 'dying_namek', displayName: 'Dying Namek', unlockLevel: 110, icon: '🌋', theme: 'tamagotchi-bg-mountain', image: './assets/dying_namek.png' },
            { name: 'time_chamber', displayName: 'H.T.C', unlockLevel: 130, icon: '⚪', theme: 'tamagotchi-bg-none', image: './assets/time_chamber.png' },
            { name: 'cell_arena', displayName: 'Cell Games', unlockLevel: 150, icon: '🥋', theme: 'tamagotchi-bg-arena', image: './assets/cell_arena.png' },
            { name: 'kai_world', displayName: 'Kai World', unlockLevel: 180, icon: '🌳', theme: 'tamagotchi-bg-none', image: './assets/supreme_kai_world.png' },
            { name: 'inside_buu', displayName: 'Inside Buu', unlockLevel: 210, icon: '🧠', theme: 'tamagotchi-bg-none', image: './assets/inside_buu.png' },
            { name: 'rocky_canyon', displayName: 'Rocky Canyon', unlockLevel: 240, icon: '☄️', theme: 'tamagotchi-bg-mountain', image: './assets/rocky_canyon.png' },
            { name: 'beerus', displayName: 'Beerus\'s', unlockLevel: 275, icon: '🐈', theme: 'tamagotchi-bg-none', image: './assets/beerus_planet.png' },
            { name: 'grand_palace', displayName: 'Grand Palace', unlockLevel: 300, icon: '✨', theme: 'tamagotchi-bg-none', image: './assets/grand_palace.png' },
        ];

        // Expose globally so battle restore can look up the saved background image
        window.BACKGROUND_UNLOCKS = BACKGROUND_UNLOCKS;

        // Expose ANIMATION_UNLOCKS globally for use by checkNewAnimationUnlocks
        window.ANIMATION_UNLOCKS = ANIMATION_UNLOCKS;

        // Get user's current level for animation unlocks
        function getCurrentUserLevel() {
            const levelEl = document.getElementById('tamagotchi-level');
            return levelEl ? parseInt(levelEl.textContent) || 1 : 1;
        }
        window.getCurrentUserLevel = getCurrentUserLevel;

        // Check if an animation is unlocked for current user
        function isAnimationUnlocked(animName) {
            const level = getCurrentUserLevel();
            // First try exact match, then includes match
            let unlock = ANIMATION_UNLOCKS.find(a =>
                a.name.toLowerCase() === animName.toLowerCase()
            );
            if (!unlock) {
                unlock = ANIMATION_UNLOCKS.find(a =>
                    animName.toLowerCase().includes(a.name.toLowerCase()) ||
                    a.name.toLowerCase().includes(animName.toLowerCase())
                );
            }
            return unlock ? level >= unlock.unlockLevel : true; // Unknown animations are unlocked
        }

        // Get unlock info for an animation
        function getAnimationUnlockInfo(animName) {
            // First try exact match, then includes match
            let unlock = ANIMATION_UNLOCKS.find(a =>
                a.name.toLowerCase() === animName.toLowerCase()
            );
            if (!unlock) {
                unlock = ANIMATION_UNLOCKS.find(a =>
                    animName.toLowerCase().includes(a.name.toLowerCase()) ||
                    a.name.toLowerCase().includes(animName.toLowerCase())
                );
            }
            return unlock;
        }

        // Get all unlocked animations from available animations
        function getUnlockedAnimations(availableAnimations) {
            const level = getCurrentUserLevel();
            return availableAnimations.filter(animName => {
                const unlock = getAnimationUnlockInfo(animName);
                return unlock ? level >= unlock.unlockLevel : true;
            });
        }

        // Store available animations when model loads
        let shaziAvailableAnimations = [];

        // Stop any playing animation and return to static stance
        let previewTimeoutId = null;
        function stopAnimation() {
            const mv = document.getElementById('tamagotchi-model');
            if (previewTimeoutId) { clearTimeout(previewTimeoutId); previewTimeoutId = null; }
            if (mv) {
                mv.pause();
                mv.currentTime = 0;
            }
        }

        // Play a specific animation
        function playAnimation(animName, returnToStatic = true) {
            const mv = document.getElementById('tamagotchi-model');
            if (!mv) return false;

            // Cancel any pending preview reset from a previous animation
            if (previewTimeoutId) { clearTimeout(previewTimeoutId); previewTimeoutId = null; }

            // Check if unlocked based on level
            if (!isAnimationUnlocked(animName)) {
                const unlock = getAnimationUnlockInfo(animName);
                if (unlock) {
                    showToast(`Unlock at Level ${unlock.unlockLevel}`, 'info');
                }
                return false;
            }

            // Try to find matching animation in availableAnimations if they exist
            let targetAnim = animName;
            if (mv.availableAnimations?.length) {
                // First try exact match (case insensitive)
                let found = mv.availableAnimations.find(a =>
                    a.toLowerCase() === animName.toLowerCase()
                );
                // If no exact match, try includes match
                if (!found) {
                    found = mv.availableAnimations.find(a =>
                        a.toLowerCase().includes(animName.toLowerCase())
                    );
                }
                if (found) targetAnim = found;
            }

            // Set and play the animation
            mv.animationName = targetAnim;
            mv.play();

            if (returnToStatic) {
                // Use the actual animation duration so the full move plays before resetting
                requestAnimationFrame(() => {
                    const durationMs = (mv.duration > 0 ? mv.duration : 3.5) * 1000;
                    previewTimeoutId = setTimeout(() => {
                        mv.pause();
                        mv.currentTime = 0;
                        mv.animationName = null;
                        mv.removeAttribute('animation-name');
                        previewTimeoutId = null;
                    }, durationMs);
                });
            }
            return true;
        }

        // Build and show animation selector UI (exposed to window for onclick)
        window.showAnimationSelector = function() {
            const mv = document.getElementById('tamagotchi-model');
            if (!mv) return;

            const level = getCurrentUserLevel();

            // Use ANIMATION_UNLOCKS directly - don't rely on availableAnimations detection
            // The model has animations, we just show what's possible based on level
            const categories = {};
            ANIMATION_UNLOCKS.forEach(unlock => {
                if (!categories[unlock.category]) {
                    categories[unlock.category] = [];
                }
                categories[unlock.category].push({
                    name: unlock.name,
                    displayName: unlock.displayName,
                    icon: unlock.icon,
                    unlockLevel: unlock.unlockLevel,
                    category: unlock.category,
                    isUnlocked: level >= unlock.unlockLevel
                });
            });

            const categoryNames = {
                'greetings': '👋 Greetings',
                'reactions': '👀 Reactions',
                'celebrations': '🎉 Celebrations',
                'exercise': '🏋️ Exercise',
                'combat': '🥊 Combat',
                'poses': '💪 Poses',
                'dance': '💃 Dance',
                'special': '⭐ Special'
            };

            const selectorTitle = "Unlocks";

            let html = `
                <div class="animation-selector-backdrop" onclick="closeAnimationSelector()"></div>
                <div class="animation-selector-modal">
                    <div class="animation-selector-header">
                        <h3>${selectorTitle}</h3>
                        <span class="animation-selector-close" onclick="closeAnimationSelector()">&times;</span>
                    </div>
                    <div class="animation-selector-content">
            `;

            const categoryOrder = ['greetings', 'reactions', 'celebrations', 'exercise', 'combat', 'poses', 'dance', 'special'];

            categoryOrder.forEach(cat => {
                if (categories[cat]?.length) {
                    html += `<div class="animation-category">
                        <div class="animation-category-title">${categoryNames[cat] || cat}</div>
                        <div class="animation-grid">`;

                    categories[cat].forEach(anim => {
                        if (anim.isUnlocked) {
                            html += `
                                <div class="animation-item unlocked" onclick="playAnimationFromSelector('${anim.name}')">
                                    <span class="animation-icon">${anim.icon}</span>
                                    <span class="animation-name">${anim.displayName}</span>
                                </div>`;
                        } else {
                            html += `
                                <div class="animation-item locked">
                                    <span class="animation-icon">🔒</span>
                                    <span class="animation-name">${anim.displayName}</span>
                                    <span class="animation-unlock-level">Lvl ${anim.unlockLevel}</span>
                                </div>`;
                        }
                    });

                    html += `</div></div>`;
                }
            });

            // Add Character Skins section showing level unlocks
            const skinEvolutions = TAMAGOTCHI_EVOLUTIONS.filter((e, i, arr) => {
                // Only show entries where the model source changes (actual new skin)
                return i === 0 || e.src !== arr[i - 1].src;
            });

            html += `<div class="animation-category">
                <div class="animation-category-title">🎨 Character Skins</div>
                <div class="skin-levels-grid">`;

            const activeRareSkinForEvo = localStorage.getItem('active_rare_skin') || '';
            const activeEvoSkin = localStorage.getItem('active_evolution_skin') || '';
            skinEvolutions.forEach(evo => {
                const isUnlocked = level >= evo.level;
                const isActiveEvo = !activeRareSkinForEvo && (activeEvoSkin === evo.src || (!activeEvoSkin && evo === skinEvolutions.filter(e => level >= e.level).pop()));
                const skinClass = isUnlocked ? 'skin-level-item unlocked' : 'skin-level-item locked';
                const checkOrLock = isUnlocked ? (isActiveEvo ? '✨' : '✅') : '🔒';
                const activeStyle = isActiveEvo ? 'border: 2px solid var(--primary); box-shadow: 0 0 10px rgba(123,168,131,0.4);' : '';
                const clickHandler = isUnlocked ? `onclick="selectEvolutionSkin('${evo.src}', '${evo.title}')" style="cursor: pointer; ${activeStyle}"` : '';
                html += `
                    <div class="${skinClass}" ${clickHandler}>
                        <span class="skin-level-badge">Lvl ${evo.level}</span>
                        <span class="skin-level-icon">${checkOrLock}</span>
                        <span class="skin-level-title">${evo.title}</span>
                    </div>`;
            });

            html += `</div></div>`;

            const activeRareSkin = localStorage.getItem('active_rare_skin') || '';
            html += `<div class="animation-category">
                <div class="animation-category-title">💎 Rare Skins</div>
                <div class="skin-levels-grid">`;

            (window.RARE_COLLECTION || []).forEach(rare => {
                const rareUnlocked = (window.isRareUnlocked || (() => false))(rare.id);
                const tierData = (window.RARE_TIERS || {})[rare.tier];
                const isActive = activeRareSkin === rare.id;
                if (rareUnlocked) {
                    html += `
                        <div class="skin-level-item unlocked${isActive ? ' rare-skin-active' : ''}" onclick="selectRareSkin('${rare.id}')" style="cursor: pointer; position: relative; ${isActive ? 'border: 2px solid ' + tierData.color + '; box-shadow: 0 0 10px ' + tierData.glow + ';' : ''}">
                            <span class="skin-level-badge" style="background: ${tierData.gradient}; color: white; font-size: 0.55rem;">${tierData.label}</span>
                            <span class="skin-level-icon">${rare.emoji}</span>
                            <span class="skin-level-title">${rare.name}</span>
                        </div>`;
                } else {
                    html += `
                        <div class="skin-level-item locked" style="position: relative;">
                            <span class="skin-level-badge" style="background: ${tierData.gradient}; color: white; font-size: 0.55rem;">${tierData.label}</span>
                            <span class="skin-level-icon">🔒</span>
                            <span class="skin-level-title" style="opacity: 0.5;">${rare.name}</span>
                        </div>`;
                }
            });

            html += `</div></div>`;

            // Add DBZ Warriors section
            if (window.DBZ_COLLECTION) {
                html += `<div class="animation-category">
                    <div class="animation-category-title">🥋 DBZ Warriors</div>
                    <div class="skin-levels-grid">`;

                window.DBZ_COLLECTION.forEach(char => {
                    const isActive = activeRareSkin === char.id;
                    const tierData = (window.RARE_TIERS || {})[char.tier] || (window.RARE_TIERS || {}).EPIC;
                    html += `
                        <div class="skin-level-item unlocked${isActive ? ' rare-skin-active' : ''}" onclick="selectRareSkinFromDBZ('${char.id}')" style="cursor: pointer; position: relative; ${isActive ? 'border: 2px solid ' + tierData.color + '; box-shadow: 0 0 10px ' + tierData.glow + ';' : ''}">
                            <span class="skin-level-badge" style="background: ${tierData.gradient}; color: white; font-size: 0.55rem;">${tierData.label}</span>
                            <span class="skin-level-icon">${char.emoji}</span>
                            <span class="skin-level-title">${char.name}</span>
                        </div>`;
                });
                html += `</div></div>`;
            }

            // Add Backgrounds section
            html += `<div class="animation-category">
                <div class="animation-category-title">🖼️ Backgrounds</div>
                <div class="animation-grid">`;

            const savedBg = localStorage.getItem('selectedBackground') || '';
            BACKGROUND_UNLOCKS.forEach(bg => {
                const isBgUnlocked = level >= bg.unlockLevel;
                const isSelected = savedBg === bg.name;
                if (isBgUnlocked) {
                    html += `
                        <div class="animation-item unlocked bg-selector-item${isSelected ? ' bg-selected' : ''}" data-bg="${bg.name}" onclick="selectBackground('${bg.name}')">
                            <span class="animation-icon">${bg.icon}</span>
                            <span class="animation-name">${bg.displayName}</span>
                        </div>`;
                } else {
                    html += `
                        <div class="animation-item locked">
                            <span class="animation-icon">🔒</span>
                            <span class="animation-name">${bg.displayName}</span>
                            <span class="animation-unlock-level">Lvl ${bg.unlockLevel}</span>
                        </div>`;
                }
            });

            html += `</div></div>`;

            html += `
                    </div>
                </div>
            `;

            // Create container inside tamagotchi widget
            let container = document.getElementById('animation-selector-container');
            const tamagotchiContainer = document.getElementById('tamagotchi-widget-container');

            if (!container && tamagotchiContainer) {
                container = document.createElement('div');
                container.id = 'animation-selector-container';
                container.className = 'animation-selector-container';
                tamagotchiContainer.appendChild(container);
            }

            if (container) {
                container.innerHTML = html;
                container.style.display = 'block';
            }
        }

        window.closeAnimationSelector = function() {
            const container = document.getElementById('animation-selector-container');
            if (container) {
                container.style.display = 'none';
            }
        };

        // Alias for refreshing the selector when a skin is selected
        window.populateTamagotchiAnimations = window.showAnimationSelector;

        window.playAnimationFromSelector = function(animName) {
            playAnimation(animName, true);
            window.closeAnimationSelector();
        };

        // All possible background theme classes (for cleanup)
        const ALL_BG_THEME_CLASSES = [
            'tamagotchi-bg-gym', 'tamagotchi-bg-park', 'tamagotchi-bg-home',
            'tamagotchi-bg-beach', 'tamagotchi-bg-mountain',
            'tamagotchi-bg-dojo', 'tamagotchi-bg-arena'
        ];

        // Select and apply a background theme from the Unlocks panel
        window.selectBackground = function(bgName) {
            const bg = (window.BACKGROUND_UNLOCKS || BACKGROUND_UNLOCKS).find(b => b.name === bgName);
            if (!bg) return;

            const container = document.getElementById('tamagotchi-widget-container');
            const dynamicBg = document.getElementById('tamagotchi-dynamic-bg');
            const staticBg = document.getElementById('tamagotchi-static-bg');
            const bgModel = document.getElementById('tamagotchi-bg-model');
            const floor = document.getElementById('tamagotchi-floor');
            
            if (!container) return;

            // Remove all background CSS theme classes
            const ALL_THEME_CLEANUP = [
                'tamagotchi-bg-gym', 'tamagotchi-bg-park', 'tamagotchi-bg-home',
                'tamagotchi-bg-beach', 'tamagotchi-bg-mountain',
                'tamagotchi-bg-dojo', 'tamagotchi-bg-arena', 'tamagotchi-bg-none'
            ];
            ALL_THEME_CLEANUP.forEach(theme => container.classList.remove(theme));

            // Apply the selected CSS theme (gradient backdrop)
            if (bg.theme) container.classList.add(bg.theme);

            // Hide 3D model and floor by default
            if (bgModel) bgModel.style.display = 'none';
            if (floor) floor.style.display = 'none';

            // Check if it's a dynamic DBZ-themed background
            const isDynamic = ['kame_house', 'arena', 'lookout', 'king_kai', 'namek', 'time_chamber', 'kai_world', 'beerus', 'mt_paozu', 'pilaf', 'muscle_tower', 'korin', 'wasteland', 'snake_way', 'frieza_ship', 'dying_namek', 'cell_arena', 'inside_buu', 'rocky_canyon'].includes(bgName);

            if (isDynamic && dynamicBg) {
                if (staticBg) staticBg.style.display = 'none';
                dynamicBg.style.display = 'block';
                
                // Initialize Dynamic Layers
                const layers = {
                    back: document.getElementById('bg-layer-back'),
                    mid: document.getElementById('bg-layer-mid'),
                    front: document.getElementById('bg-layer-front')
                };

                // For now, put the main image in the mid layer
                if (layers.mid) {
                    layers.mid.style.backgroundImage = `url('${bg.image}')`;
                    layers.back.style.backgroundImage = 'none';
                    layers.front.style.backgroundImage = 'none';

                    // Adjust vertical alignment for specific backgrounds to provide more floor space
                    if (bgName === 'mt_paozu' || bgName === 'pilaf') {
                        layers.mid.style.backgroundPosition = 'center 35%'; // Pulls the image UP to show more floor
                    } else if (bgName === 'namek') {
                        layers.mid.style.backgroundPosition = 'center 45%';
                    } else {
                        layers.mid.style.backgroundPosition = 'center center';
                    }
                }

                // Apply Time of Day Sync
                applyTimeOfDayToBg(dynamicBg);
                
                // Initialize Weather if applicable (e.g. Namek or Lookout can have clouds/rain)
                updateWeatherEffects(bgName);

                // Setup Parallax
                setupBgParallax(container, layers);

                // Add Particle System for extra life
                createParticles(bgName);

            } else {
                // Standard static backgrounds
                if (dynamicBg) dynamicBg.style.display = 'none';
                
                if (bg.image && staticBg) {
                    staticBg.style.display = 'block';
                    staticBg.style.backgroundImage = "url('" + bg.image + "')";
                    staticBg.style.backgroundSize = 'cover';
                    staticBg.style.backgroundPosition = 'center center';
                } else if (staticBg) {
                    staticBg.style.display = 'none';
                    if (floor) floor.style.display = 'block';
                }
            }

            // Save selection to localStorage (skip in admin view-as mode)
            if (!window.isAdminViewing) {
                localStorage.setItem('selectedBackground', bgName);

                // Save background preference to Supabase for persistence
                if (window.currentUser?.id && typeof dbHelpers !== 'undefined') {
                    try {
                        dbHelpers.users.update(window.currentUser.id, { background_preference: bgName });
                    } catch (e) {
                        console.warn("Failed to save background preference to DB:", e);
                    }
                }
            }

            // Update the selected state in the UI
            document.querySelectorAll('.bg-selector-item').forEach(el => {
                el.classList.remove('bg-selected');
            });
            const selectedEl = document.querySelector(`.bg-selector-item[data-bg="${bgName}"]`);
            if (selectedEl) selectedEl.classList.add('bg-selected');
        };

        // Helper: Apply Time of Day Filters based on user's local time
        function applyTimeOfDayToBg(container) {
            const hour = new Date().getHours();
            container.classList.remove('bg-time-dawn', 'bg-time-day', 'bg-time-dusk', 'bg-time-night');
            
            if (hour >= 5 && hour < 8) container.classList.add('bg-time-dawn');
            else if (hour >= 8 && hour < 17) container.classList.add('bg-time-day');
            else if (hour >= 17 && hour < 20) container.classList.add('bg-time-dusk');
            else container.classList.add('bg-time-night');
        }

        // Helper: Initialize Parallax Effect (Reverted to Touch/Mouse Only)
        function setupBgParallax(container, layers) {
            let currentX = 0;
            let currentY = 0;

            const updateLayers = (x, y) => {
                // Smoothing
                currentX += (x - currentX) * 0.1;
                currentY += (y - currentY) * 0.1;

                // Subtle parallax shift as requested by user
                if (layers.back) layers.back.style.transform = `translateX(${currentX * -20}px) translateY(${currentY * -10}px)`;
                if (layers.mid) layers.mid.style.transform = `translateX(${currentX * -45}px) translateY(${currentY * -20}px)`;
                if (layers.front) layers.front.style.transform = `translateX(${currentX * -80}px) translateY(${currentY * -40}px)`;
            };

            const handleMove = (e) => {
                if (window.isDuringBattle) return;
                
                let x = 0, y = 0;
                if (e.type === 'touchmove' || e.type === 'touchstart') {
                    const touch = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : null);
                    if (touch) {
                        x = (touch.clientX / window.innerWidth - 0.5) * 2;
                        y = (touch.clientY / window.innerHeight - 0.5) * 2;
                    }
                } else {
                    x = (e.clientX / window.innerWidth - 0.5) * 2;
                    y = (e.clientY / window.innerHeight - 0.5) * 2;
                }
                updateLayers(x, y);
            };

            container.removeEventListener('mousemove', container._parallaxHandler);
            container.removeEventListener('touchstart', container._parallaxHandler);
            container.removeEventListener('touchmove', container._parallaxHandler);
            
            container._parallaxHandler = handleMove;
            container.addEventListener('mousemove', handleMove);
            container.addEventListener('touchstart', handleMove, { passive: true });
            container.addEventListener('touchmove', handleMove, { passive: true });
            
            if (layers.mid) layers.mid.classList.add('bg-breathing');
        }

        // Global motion permission helper
        window.requestMotionPermission = async function() {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        console.log('Motion permission granted');
                        // Notify all parallax instances to init gyro
                        window.dispatchEvent(new CustomEvent('gyroPermissionGranted'));
                        return true;
                    }
                } catch (err) {
                    console.error('Motion permission error:', err);
                }
            } else {
                return true;
            }
            return false;
        };

        // Helper: Weather effects (rain, clouds)
        function updateWeatherEffects(bgName) {
            const rainOverlay = document.getElementById('rain-overlay');
            const cloudLayer = document.getElementById('cloud-layer');
            
            if (!rainOverlay) return;
            
            // Clean up
            rainOverlay.innerHTML = '';
            rainOverlay.style.display = 'none';
            if (cloudLayer) cloudLayer.style.display = 'none';

            // Specific weather for certain backgrounds
            if (bgName === 'namek') {
                // Namek has green-ish clouds/mist + toxic rain
                if (cloudLayer) {
                    cloudLayer.style.display = 'block';
                    cloudLayer.style.filter = 'hue-rotate(80deg) saturate(0.5)';
                }
                createRainEffect(rainOverlay);
                rainOverlay.style.filter = 'hue-rotate(80deg) brightness(0.8)';
            } else if (bgName === 'dying_namek') {
                // Dark skies + ash rain
                if (cloudLayer) {
                    cloudLayer.style.display = 'block';
                    cloudLayer.style.filter = 'grayscale(1) brightness(0.3)';
                }
                createRainEffect(rainOverlay);
                rainOverlay.style.filter = 'sepia(1) hue-rotate(-20deg) brightness(0.6)';
            } else if (bgName === 'muscle_tower') {
                // Heavy snow
                if (cloudLayer) {
                    cloudLayer.style.display = 'block';
                    cloudLayer.style.filter = 'brightness(1.5) opacity(0.5)';
                }
                createRainEffect(rainOverlay, '❄️');
                rainOverlay.style.filter = 'none';
            } else if (bgName === 'lookout' || bgName === 'korin' || bgName === 'snake_way') {
                // High altitude clouds
                if (cloudLayer) cloudLayer.style.display = 'block';
            }

            
            // Toggle rain for testing or based on level?
            // For now, let's keep it clear unless we add a weather API later.
        }

        // Helper: Create particles for extra environmental life
        function createParticles(bgName) {
            const container = document.getElementById('tamagotchi-dynamic-bg');
            if (!container) return;
            
            // Clean up existing
            const existing = document.getElementById('bg-particles');
            if (existing) existing.remove();

            const particleContainer = document.createElement('div');
            particleContainer.id = 'bg-particles';
            particleContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:hidden;';
            container.appendChild(particleContainer);

            let icon = '✨';
            let count = 12;
            let speed = 10000;

            if (bgName === 'kame_house' || bgName === 'mt_paozu') { icon = '🍃'; count = 6; }
            else if (bgName === 'kai_world') { icon = '🌸'; count = 10; }
            else if (bgName === 'beerus' || bgName === 'pilaf' || bgName === 'frieza_ship') { icon = '✨'; count = 15; speed = 15000; }
            else if (bgName === 'namek' || bgName === 'inside_buu') { icon = '🫧'; count = 8; speed = 8000; }
            else if (bgName === 'arena' || bgName === 'wasteland' || bgName === 'cell_arena' || bgName === 'rocky_canyon') { icon = '💨'; count = 8; }
            else if (bgName === 'lookout' || bgName === 'korin' || bgName === 'snake_way') { icon = '☁️'; count = 10; speed = 20000; }
            else if (bgName === 'muscle_tower') { icon = '❄️'; count = 12; speed = 12000; }
            else if (bgName === 'dying_namek') { icon = '☄️'; count = 6; speed = 7000; }

            for (let i = 0; i < count; i++) {
                const p = document.createElement('div');
                p.innerHTML = icon;
                p.style.cssText = `position:absolute; font-size: ${Math.random() * 10 + 8}px; pointer-events:none; filter: blur(${Math.random() * 2}px); opacity: 0; transition: opacity 1s;`;
                particleContainer.appendChild(p);
                
                const animate = () => {
                    const duration = Math.random() * speed + speed/2;
                    const startX = Math.random() * 120 - 10;
                    const startY = Math.random() * 120 - 10;
                    const endX = startX + (Math.random() * 40 - 20);
                    const endY = startY + (Math.random() * 40 - 20);

                    p.style.left = startX + '%';
                    p.style.top = startY + '%';
                    p.style.opacity = 0;
                    
                    setTimeout(() => {
                        p.style.transition = `all ${duration}ms linear, opacity 1s ease-in-out`;
                        p.style.left = endX + '%';
                        p.style.top = endY + '%';
                        p.style.opacity = Math.random() * 0.5 + 0.1;
                        p.style.transform = `rotate(${Math.random() * 360}deg) scale(${Math.random() * 0.5 + 0.7})`;
                    }, 50);

                    setTimeout(() => {
                        p.style.opacity = 0;
                        setTimeout(animate, 1000);
                    }, duration - 1000);
                };
                
                setTimeout(animate, Math.random() * 5000);
            }
        }

        // Helper: Create rain drops
        function createRainEffect(container, char = null) {
            if (!container) return;
            container.innerHTML = '';
            container.style.display = 'block';
            const dropCount = 40;
            for (let i = 0; i < dropCount; i++) {
                const drop = document.createElement('div');
                if (char) {
                    drop.innerHTML = char;
                    drop.style.cssText = `position:absolute; font-size: 10px; opacity: ${Math.random()}; animation: rain-fall ${Math.random() * 2 + 1}s infinite linear;`;
                } else {
                    drop.className = 'rain-drop';
                }
                drop.style.left = Math.random() * 100 + '%';
                drop.style.animationDelay = Math.random() * 2 + 's';
                if (!char) { // Only apply animationDuration if it's a default rain-drop
                    drop.style.animationDuration = 0.5 + Math.random() * 0.5 + 's';
                }
                container.appendChild(drop);
            }
        }



        // Listen for initial model load to log available animations and apply colors
        const initialModelViewer = document.getElementById('tamagotchi-model');
        if (initialModelViewer) {
            initialModelViewer.addEventListener('load', () => {
                console.log('Initial model loaded:', initialModelViewer.getAttribute('src'));
                console.log('Available animations:', initialModelViewer.availableAnimations);

                // Store animations globally for debugging
                window.shaziAnimations = initialModelViewer.availableAnimations || [];

                // Apply user's custom character colors to the initial model
                if (window.applyCharacterColors) {
                    window.applyCharacterColors(initialModelViewer, initialModelViewer.getAttribute('src'));
                }
            });
        }

        // ============================================================
        // CAMERA SYNC: Gym background rotates with character
        // Makes the gym part of the scene instead of a flat backdrop
        // ============================================================
        (function setupBackgroundCameraSync() {
            const charViewer = document.getElementById('tamagotchi-model');
            const bgViewer = document.getElementById('tamagotchi-bg-model');
            if (!charViewer || !bgViewer) return;

            // Base background camera distance - scales proportionally with character zoom
            // Higher BG_BASE_DISTANCE = gym appears larger/closer
            const BG_BASE_DISTANCE = 8.0; // meters at default character distance
            const CHAR_BASE_DISTANCE = 22; // default character orbit distance
            const BG_SCALE = BG_BASE_DISTANCE / CHAR_BASE_DISTANCE;

            charViewer.addEventListener('camera-change', () => {
                // Skip sync if background is hidden
                if (bgViewer.style.display === 'none') return;

                const orbit = charViewer.getCameraOrbit();
                // theta = horizontal rotation (radians)
                // phi = vertical angle (radians)
                // radius = distance from target (meters)
                const thetaDeg = (orbit.theta * 180 / Math.PI);
                const phiDeg = (orbit.phi * 180 / Math.PI);

                // Scale bg distance proportionally to character zoom
                // so gym scales naturally when character zooms in/out with level
                const bgDist = orbit.radius * BG_SCALE;

                bgViewer.cameraOrbit = `${thetaDeg}deg ${phiDeg}deg ${bgDist}m`;
                bgViewer.jumpCameraToGoal();
            });

            console.log('Background camera sync initialized');
        })();

        // Tap reaction - greeting animation
        document.getElementById('tamagotchi-model')?.addEventListener('click', () => {
            const mv = document.getElementById('tamagotchi-model');
            if (!mv || !mv.availableAnimations || !mv.availableAnimations.length) return;

            // Find the greeting animation
            let greetAnim = mv.availableAnimations.find(a => a === 'greet');
            if (!greetAnim) {
                greetAnim = mv.availableAnimations.find(a => a === 'bow');
            }
            if (greetAnim) {
                mv.animationName = greetAnim;
                mv.play();

                // Return to static stance after animation plays
                setTimeout(() => {
                    mv.pause();
                    mv.currentTime = 0;
                    mv.animationName = null;
                    mv.removeAttribute('animation-name');
                }, 3000);
            }
        });

        // Battle state flags (used by camera distance update guard)
        window.isDuringBattle = false;
    })();
