(function() {
        'use strict';
        console.log('🎮 Loading Progression & Battle System...');

        // ============================================================
        // STAT SYSTEM - Save/Load/Display
        // ============================================================
        const STAT_MAX = 150; // Visual max for bar display
        const DEFAULT_STATS = { str: 0, hp: 0, mana: 0 };

        // Points per level (front-loaded)
        function getStatPointsForLevel(level) {
            if (level <= 10) return 3;
            if (level <= 20) return 2;
            return 1;
        }

        // Bonus points at skin evolution levels
        const EVOLUTION_BONUS_LEVELS = [10, 20, 30, 40, 50];
        const EVOLUTION_BONUS_POINTS = 5;

        function getBattleStats() {
            try {
                const saved = localStorage.getItem('battleStats');
                return saved ? { ...DEFAULT_STATS, ...JSON.parse(saved) } : { ...DEFAULT_STATS };
            } catch (e) {
                return { ...DEFAULT_STATS };
            }
        }

        function saveBattleStats(stats) {
            localStorage.setItem('battleStats', JSON.stringify(stats));
            updateStatBarsUI(stats);
            // Also save to DB if available
            saveBattleStatsToDb(stats);
        }

        async function saveBattleStatsToDb(stats) {
            if (window.isAdminViewing) return; // Admin view-as is read-only
            if (!window.currentUser || !window.dbHelpers) return;
            try {
                const userId = window.currentUser.id || window.currentUser.user_id;
                const existing = await window.dbHelpers.userFacts.get(userId) || {};
                const currentAdditional = existing.additional_data || {};
                const unalloc = parseInt(localStorage.getItem('unallocatedStatPoints') || '0');

                // Don't overwrite non-zero DB stats with zeros (protects against
                // localStorage being cleared while DB still has the correct values)
                const dbStats = currentAdditional.battle_stats;
                if (dbStats) {
                    const dbAllocated = (dbStats.str || 0) + (dbStats.hp || 0) + (dbStats.mana || 0);
                    const newAllocated = (stats.str || 0) + (stats.hp || 0) + (stats.mana || 0);
                    if (dbAllocated > 0 && newAllocated === 0) {
                        console.warn('🎮 Blocked saving zeroed stats to DB (DB has allocated stats). Only updating unallocated points.');
                        await window.dbHelpers.userFacts.upsert(userId, {
                            additional_data: { ...currentAdditional, unallocated_stat_points: unalloc }
                        });
                        return;
                    }
                }

                await window.dbHelpers.userFacts.upsert(userId, {
                    additional_data: { ...currentAdditional, battle_stats: stats, unallocated_stat_points: unalloc }
                });
            } catch (e) {
                console.warn('Could not save battle stats to DB:', e);
            }
        }

        async function loadBattleStatsFromDb() {
            if (window.isAdminViewing) return; // Don't load viewed user's stats into admin's localStorage
            if (!window.currentUser || !window.dbHelpers) return;
            try {
                const userId = window.currentUser.id || window.currentUser.user_id;
                const facts = await window.dbHelpers.userFacts.get(userId);
                if (facts?.additional_data?.battle_stats) {
                    const dbStats = { ...DEFAULT_STATS, ...facts.additional_data.battle_stats };
                    localStorage.setItem('battleStats', JSON.stringify(dbStats));
                    updateStatBarsUI(dbStats);
                }
                // Also restore unallocated stat points from DB
                if (facts?.additional_data?.unallocated_stat_points != null) {
                    const dbUnalloc = parseInt(facts.additional_data.unallocated_stat_points) || 0;
                    // Only restore from DB if localStorage doesn't already have a value
                    // (localStorage is authoritative during a session, DB is for cross-device/reinstall)
                    if (!localStorage.getItem('unallocatedStatPoints')) {
                        localStorage.setItem('unallocatedStatPoints', String(dbUnalloc));
                    }
                }
            } catch (e) {
                console.warn('Could not load battle stats from DB:', e);
            }
        }

        function updateStatBarsUI(stats) {
            const s = stats || getBattleStats();
            ['str', 'hp', 'mana'].forEach(stat => {
                const valEl = document.getElementById(`stat-${stat}-value`);
                const fillEl = document.getElementById(`stat-${stat}-fill`);
                if (valEl) valEl.textContent = s[stat];
                if (fillEl) fillEl.style.width = `${Math.min(100, (s[stat] / STAT_MAX) * 100)}%`;
            });
        }

        // Tooltip on stat tap
        window.showStatTooltip = function(stat) {
            const descriptions = {
                str: 'Strength increases your attack damage in battle',
                hp: 'Health Points give you more HP in battle',
                mana: 'Mana makes your special move charge faster'
            };
            if (typeof showToast === 'function') {
                showToast(descriptions[stat] || '', 'info');
            }
        };

        // Initialize stats on page load
        setTimeout(() => {
            updateStatBarsUI();
            loadBattleStatsFromDb();
        }, 2000);

        // ============================================================
        // STAT ALLOCATION MODAL
        // ============================================================
        // Track pending allocations
        let pendingAllocations = { str: 0, hp: 0, mana: 0 };

        function getUnallocatedPoints() {
            try {
                return parseInt(localStorage.getItem('unallocatedStatPoints') || '0');
            } catch (e) {
                return 0;
            }
        }

        function setUnallocatedPoints(pts) {
            localStorage.setItem('unallocatedStatPoints', String(Math.max(0, pts)));
        }

        // Called when user levels up - grants stat points
        function grantStatPoints(previousLevel, newLevel) {
            if (window.isAdminViewing) return; // Admin view-as is read-only
            let totalNewPoints = 0;
            for (let lvl = previousLevel + 1; lvl <= newLevel; lvl++) {
                totalNewPoints += getStatPointsForLevel(lvl);
                if (EVOLUTION_BONUS_LEVELS.includes(lvl)) {
                    totalNewPoints += EVOLUTION_BONUS_POINTS;
                }
            }
            if (totalNewPoints > 0) {
                const current = getUnallocatedPoints();
                setUnallocatedPoints(current + totalNewPoints);
                console.log(`🎮 Granted ${totalNewPoints} stat points (levels ${previousLevel+1}-${newLevel})`);
                // Persist unallocated points to DB so they survive app reinstalls
                saveBattleStatsToDb(getBattleStats());
                // The stat allocation modal is now shown by the celebration cleanup
                // in triggerLevelUpCelebration (Step 15) for correct timing.
                // No separate timeout needed here.
            }
        }

        function showStatAllocationModal() {
            if (window.isAdminViewing) return; // Admin view-as is read-only
            const pointsLeft = getUnallocatedPoints();
            if (pointsLeft <= 0) return;

            const stats = getBattleStats();
            pendingAllocations = { str: 0, hp: 0, mana: 0 };

            const overlay = document.createElement('div');
            overlay.className = 'stat-alloc-overlay';
            overlay.id = 'stat-alloc-overlay';
            overlay.innerHTML = `
                <div class="stat-alloc-modal">
                    <div class="stat-alloc-header">
                        <h2>Power Up!</h2>
                        <div class="stat-alloc-points-left">You have <span id="alloc-points-left">${pointsLeft}</span> points to spend</div>
                    </div>
                    <div class="stat-alloc-body">
                        <div class="stat-alloc-row">
                            <div class="stat-alloc-icon str">⚔️</div>
                            <div class="stat-alloc-details">
                                <div class="stat-alloc-name">Strength</div>
                                <div class="stat-alloc-desc">Increases attack damage</div>
                            </div>
                            <div class="stat-alloc-current str" id="alloc-str-val">${stats.str}</div>
                            <button class="stat-alloc-btn str" onclick="window._allocStat('str')">+</button>
                        </div>
                        <div class="stat-alloc-row">
                            <div class="stat-alloc-icon hp">❤️</div>
                            <div class="stat-alloc-details">
                                <div class="stat-alloc-name">Health Points</div>
                                <div class="stat-alloc-desc">More HP in battle</div>
                            </div>
                            <div class="stat-alloc-current hp" id="alloc-hp-val">${stats.hp}</div>
                            <button class="stat-alloc-btn hp" onclick="window._allocStat('hp')">+</button>
                        </div>
                        <div class="stat-alloc-row">
                            <div class="stat-alloc-icon mana">🔮</div>
                            <div class="stat-alloc-details">
                                <div class="stat-alloc-name">Mana</div>
                                <div class="stat-alloc-desc">Faster special move charge</div>
                            </div>
                            <div class="stat-alloc-current mana" id="alloc-mana-val">${stats.mana}</div>
                            <button class="stat-alloc-btn mana" onclick="window._allocStat('mana')">+</button>
                        </div>
                    </div>
                    <div class="stat-alloc-footer">
                        <button class="stat-alloc-confirm" id="alloc-confirm-btn" onclick="window._confirmAlloc()" disabled>Allocate Points First</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        window._allocStat = function(stat) {
            const pointsLeftEl = document.getElementById('alloc-points-left');
            const currentPointsLeft = parseInt(pointsLeftEl.textContent);
            if (currentPointsLeft <= 0) return;

            const stats = getBattleStats();
            pendingAllocations[stat]++;
            const newVal = stats[stat] + pendingAllocations[stat];

            // Update display
            const valEl = document.getElementById(`alloc-${stat}-val`);
            if (valEl) {
                valEl.textContent = newVal;
                valEl.classList.remove('stat-pop');
                void valEl.offsetWidth;
                valEl.classList.add('stat-pop');
            }

            pointsLeftEl.textContent = currentPointsLeft - 1;

            // Update confirm button
            const confirmBtn = document.getElementById('alloc-confirm-btn');
            const totalAllocated = pendingAllocations.str + pendingAllocations.hp + pendingAllocations.mana;
            if (totalAllocated > 0) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = currentPointsLeft - 1 > 0 ? `Spend More or Confirm` : `Confirm Allocation`;
            }

            // Disable + buttons if no points left
            if (currentPointsLeft - 1 <= 0) {
                document.querySelectorAll('.stat-alloc-btn').forEach(btn => btn.disabled = true);
            }
        };

        window._confirmAlloc = function() {
            const stats = getBattleStats();
            stats.str += pendingAllocations.str;
            stats.hp += pendingAllocations.hp;
            stats.mana += pendingAllocations.mana;
            saveBattleStats(stats);

            // Subtract spent points
            const totalSpent = pendingAllocations.str + pendingAllocations.hp + pendingAllocations.mana;
            const remaining = getUnallocatedPoints() - totalSpent;
            setUnallocatedPoints(remaining);

            // Close modal
            const overlay = document.getElementById('stat-alloc-overlay');
            if (overlay) overlay.remove();

            if (typeof showToast === 'function') {
                showToast('Stats allocated!', 'success');
            }

            pendingAllocations = { str: 0, hp: 0, mana: 0 };

            // If still have points, show again
            if (remaining > 0) {
                setTimeout(() => showStatAllocationModal(), 500);
            }
        };

        // Expose for level up system
        window.grantStatPoints = grantStatPoints;
        window.showStatAllocationModal = showStatAllocationModal;
        window.getBattleStats = getBattleStats;

        // ============================================================
        // SETTINGS - STAT ALLOCATION UI
        // ============================================================

        // Calculate total expected stat points for a given level
        function getTotalExpectedPointsForLevel(level) {
            let total = 0;
            for (let lvl = 1; lvl <= level; lvl++) {
                total += getStatPointsForLevel(lvl);
                if (EVOLUTION_BONUS_LEVELS.includes(lvl)) {
                    total += EVOLUTION_BONUS_POINTS;
                }
            }
            return total;
        }

        // Grant any missing stat points for users who leveled before the stat system existed
        async function ensureRetroactiveStatPoints() {
            if (window.isAdminViewing) return; // Admin view-as is read-only

            // Wait for battle stats to load from DB first to avoid granting
            // duplicate points when localStorage is empty (e.g. after app reinstall)
            await loadBattleStatsFromDb();

            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            const expectedTotal = getTotalExpectedPointsForLevel(level);

            const stats = getBattleStats();
            const allocated = stats.str + stats.hp + stats.mana;
            const unallocated = getUnallocatedPoints();
            const actualTotal = allocated + unallocated;

            if (actualTotal < expectedTotal) {
                const missing = expectedTotal - actualTotal;
                if (allocated === 0 && level > 5 && unallocated === 0) {
                    // Stats were lost (localStorage cleared + DB empty/zeroed).
                    // Grant ALL expected points as unallocated so the user can re-allocate.
                    console.warn(`🎮 Stat recovery: level ${level} but 0 allocated, 0 unallocated. Granting all ${expectedTotal} points as unallocated.`);
                }
                setUnallocatedPoints(unallocated + missing);
                console.log(`🎮 Retroactively granted ${missing} stat points (level ${level}, expected ${expectedTotal}, had ${actualTotal})`);
                // Persist the newly granted unallocated points to DB
                saveBattleStatsToDb(stats);
                // Show the allocation modal so the user can spend the recovered points
                setTimeout(() => showStatAllocationModal(), 1000);
            }
        }

        // Run retroactive check on load (with enough delay for user data to be available)
        setTimeout(() => {
            ensureRetroactiveStatPoints();
        }, 3000);

        window.ensureRetroactiveStatPoints = ensureRetroactiveStatPoints;

        // ============================================================
        // BACKGROUND THEMES (combined into character model-viewer)
        // ============================================================
        function applyBackgroundForLevel(level) {
            // If user has manually selected a background, respect that choice
            const savedBg = localStorage.getItem('selectedBackground');
            if (savedBg && window.selectBackground) {
                window.selectBackground(savedBg);
                return;
            }

            const container = document.getElementById('tamagotchi-widget-container');
            if (!container) return;

            // Remove all CSS bg themes
            const ALL_BG_THEME_CLASSES_LOCAL = [
                'tamagotchi-bg-gym', 'tamagotchi-bg-park', 'tamagotchi-bg-home',
                'tamagotchi-bg-beach', 'tamagotchi-bg-mountain',
                'tamagotchi-bg-dojo', 'tamagotchi-bg-arena'
            ];
            ALL_BG_THEME_CLASSES_LOCAL.forEach(theme => container.classList.remove(theme));

            // Default to gym bg
            if (level >= 1) {
                container.classList.add('tamagotchi-bg-gym');
                const staticBg = document.getElementById('tamagotchi-static-bg');
                const bgModel = document.getElementById('tamagotchi-bg-model');
                const floor = document.getElementById('tamagotchi-floor');
                if (staticBg) {
                    staticBg.style.display = 'block';
                    staticBg.style.backgroundImage = "url('./assets/gym_bg.jpeg')";
                    staticBg.style.backgroundSize = 'cover';
                    staticBg.style.backgroundPosition = 'center center';
                }
                if (bgModel) bgModel.style.display = 'none';
                if (floor) floor.style.display = 'none';
            }
        }

        // Apply saved background or default on load
        setTimeout(() => {
            const savedBg = localStorage.getItem('selectedBackground');
            if (savedBg && window.selectBackground) {
                window.selectBackground(savedBg);
            } else {
                const levelEl = document.getElementById('tamagotchi-level');
                const level = levelEl ? parseInt(levelEl.textContent) || 1 : 1;
                applyBackgroundForLevel(level);
            }
        }, 2500);

        window.applyBackgroundForLevel = applyBackgroundForLevel;

        // ============================================================
        // BATTLE LEVEL GATE
        // ============================================================
        function updateBattleButtonLock() {
            const btn = document.querySelector('.battle-trigger-btn');
            if (!btn) return;
            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            if (level < 10) {
                btn.classList.add('locked');
            } else {
                btn.classList.remove('locked');
            }
        }

        setTimeout(updateBattleButtonLock, 2500);
        window.updateBattleButtonLock = updateBattleButtonLock;

        // ============================================================
        // MOVE PICKER (Pre-Battle)
        // ============================================================
        function showMovePicker() {
            return new Promise((resolve) => {
                const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
                const unlocks = (window.ANIMATION_UNLOCKS || []).filter(a => a.category === 'combat' && level >= a.unlockLevel);

                if (unlocks.length === 0) {
                    resolve({ name: 'boxing', displayName: 'Boxing', power: 1 });
                    return;
                }

                // Power rankings for combat moves
                const powerMap = {
                    'boxing': 1, 'kick': 1.5, 'karate': 2, 'boxing_1': 2.5,
                    'boxing_2': 3.5, 'kick_2': 4, 'block': 0
                };

                const container = document.getElementById('tamagotchi-widget-container');
                const picker = document.createElement('div');
                picker.className = 'move-picker-overlay';
                picker.id = 'move-picker';

                let html = '<div class="move-picker-title">Choose Your Move</div><div class="move-picker-grid">';
                unlocks.filter(u => u.name !== 'block').forEach(u => {
                    const power = powerMap[u.name] || 1;
                    const stars = '⭐'.repeat(Math.ceil(power));
                    html += `
                        <div class="move-picker-item" data-move="${u.name}" data-power="${power}">
                            <div class="pick-icon">${u.icon}</div>
                            <div class="pick-name">${u.displayName}</div>
                            <div class="pick-power">${stars}</div>
                        </div>`;
                });
                html += '</div>';
                picker.innerHTML = html;
                container.appendChild(picker);

                picker.querySelectorAll('.move-picker-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const moveName = item.dataset.move;
                        const movePower = parseFloat(item.dataset.power) || 1;
                        const unlock = unlocks.find(u => u.name === moveName);
                        picker.remove();
                        resolve({
                            name: moveName,
                            displayName: unlock?.displayName || moveName,
                            power: movePower,
                            icon: unlock?.icon || '👊'
                        });
                    });
                });
            });
        }

        // ============================================================
        // BATTLE INVITE SYSTEM
        // ============================================================
        window.startBattle = async function() {
            console.log('🥊 BATTLE BUTTON CLICKED');

            // Level gate
            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            if (level < 10) {
                if (typeof showToast === 'function') {
                    showToast('Battle Mode unlocks at Level 10!', 'info');
                }
                return;
            }

            if (window._battleInProgress) return;

            // Show the invite friend modal
            showBattleInviteModal();
        };

        // Track current battle bet amount
        window._currentBattleBet = 0;

        async function showBattleInviteModal() {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'battle-invite-overlay';
            overlay.id = 'battle-invite-overlay';

            // Get coin balance for display
            let coinBalance = 0;
            try {
                if (window.supabaseClient && window.currentUser) {
                    const { data } = await window.supabaseClient.rpc('get_coin_balance', { user_uuid: window.currentUser.id });
                    coinBalance = data || 0;
                }
            } catch (e) {}

            let friendsHtml = '';

            try {
                // Fetch friends list
                if (window.supabaseClient && window.currentUser) {
                    const { data: friends, error } = await window.supabaseClient
                        .rpc('get_friends_with_status', { user_uuid: window.currentUser.id });

                    if (!error && friends && friends.length > 0) {
                        friendsHtml = friends.map(friend => {
                            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
                            const isActive = friend.has_workout_today || friend.has_meal_today;
                            const statusText = isActive ? 'Active today' : (friend.days_inactive > 0 ? `${friend.days_inactive}d ago` : 'Online');
                            const statusClass = isActive ? 'active' : '';
                            const photoHtml = friend.friend_photo
                                ? `<img src="${friend.friend_photo}" alt="${friend.friend_name}">`
                                : initials;
                            const streak = friend.current_streak > 0 ? ` 🔥${friend.current_streak}` : '';

                            return `
                                <div class="battle-invite-friend" onclick="window._sendBattleInvite('${friend.friend_id}', '${(friend.friend_name || '').replace(/'/g, "\\'")}')">
                                    <div class="battle-invite-avatar">${photoHtml}</div>
                                    <div class="battle-invite-info">
                                        <div class="battle-invite-name">${friend.friend_name || 'Friend'}${streak}</div>
                                        <div class="battle-invite-status ${statusClass}">${statusText}</div>
                                    </div>
                                    <button class="battle-invite-btn">Challenge</button>
                                </div>`;
                        }).join('');
                    }
                }
            } catch (e) {
                console.warn('Could not fetch friends for battle invite:', e);
            }

            overlay.innerHTML = `
                <div class="battle-invite-modal">
                    <div class="battle-invite-header">
                        <h2>⚔️ Battle Mode</h2>
                        <p>Choose your opponent</p>
                    </div>
                    <div class="battle-invite-body">
                        <!-- Coin Bet Picker -->
                        <div style="padding: 10px 0 14px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600;">WAGER COINS</span>
                                <span style="font-size: 0.75rem; color: rgba(255,255,255,0.4);">Balance: 🪙 ${coinBalance.toLocaleString()}</span>
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <button onclick="window._setBattleBet(0, this)" class="battle-bet-btn active" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">Free</button>
                                <button onclick="window._setBattleBet(10, this)" class="battle-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 10</button>
                                <button onclick="window._setBattleBet(50, this)" class="battle-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 50</button>
                                <button onclick="window._setBattleBet(100, this)" class="battle-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 100</button>
                                <button onclick="window._setBattleBet(500, this)" class="battle-bet-btn" style="flex: 1; min-width: 50px; padding: 8px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer;">🪙 500</button>
                            </div>
                            <div style="margin-top: 8px;">
                                <input type="number" id="battle-custom-bet" placeholder="Or enter custom amount..." min="0" style="width: 100%; padding: 8px 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 0.85rem; box-sizing: border-box;" oninput="window._setBattleBet(parseInt(this.value) || 0)">
                            </div>
                        </div>

                        <div class="battle-invite-friend battle-bot-option" onclick="window.closeBattleInvite(); window._runBattle('Bot');">
                            <div class="battle-invite-avatar" style="background: linear-gradient(135deg, rgba(100,100,255,0.4), rgba(150,50,255,0.4));">🤖</div>
                            <div class="battle-invite-info">
                                <div class="battle-invite-name">Practice Mode</div>
                                <div class="battle-invite-status active">Free training, no bet</div>
                            </div>
                            <button class="battle-invite-btn" style="background: linear-gradient(135deg, #7c3aed, #6366f1);">Fight</button>
                        </div>
                        ${friendsHtml ? '<div style="padding: 8px 0 4px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;">Challenge a friend (bet applies)</div>' : ''}
                        ${friendsHtml}
                    </div>
                    <div class="battle-invite-footer">
                        <button class="battle-invite-close" onclick="window.closeBattleInvite()">Cancel</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Close on backdrop click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) window.closeBattleInvite();
            });
        }

        window._setBattleBet = function(amount, btnEl) {
            window._currentBattleBet = amount;
            // Update active button styling
            if (btnEl) {
                document.querySelectorAll('.battle-bet-btn').forEach(b => {
                    b.style.background = 'rgba(255,255,255,0.08)';
                    b.style.borderColor = 'rgba(255,255,255,0.15)';
                    b.className = 'battle-bet-btn';
                });
                btnEl.style.background = 'rgba(255,255,255,0.15)';
                btnEl.style.borderColor = 'rgba(255,255,255,0.3)';
                btnEl.className = 'battle-bet-btn active';
            }
        };

        window.closeBattleInvite = function() {
            const overlay = document.getElementById('battle-invite-overlay');
            if (overlay) overlay.remove();
        };

        // ============================================================
        // ARENA MODE - Among Us-style battle arena
        // ============================================================
        window._arenaPlayerCount = 4;

        async function showArenaInviteModal() {
            // Level gate
            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            if (level < 10) {
                if (typeof showToast === 'function') showToast('Reach Level 10 to unlock Arena Mode!');
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'arena-invite-overlay';
            overlay.id = 'arena-invite-overlay';

            let friendsHtml = '';
            try {
                if (window.supabaseClient && window.currentUser) {
                    const { data: friends, error } = await window.supabaseClient
                        .rpc('get_friends_with_status', { user_uuid: window.currentUser.id });

                    if (!error && friends && friends.length > 0) {
                        friendsHtml = friends.map(friend => {
                            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
                            const isActive = friend.has_workout_today || friend.has_meal_today;
                            const statusText = isActive ? 'Active today' : (friend.days_inactive > 0 ? `${friend.days_inactive}d ago` : 'Online');
                            const statusClass = isActive ? 'active' : '';
                            const photoHtml = friend.friend_photo
                                ? `<img src="${friend.friend_photo}" alt="${friend.friend_name}">`
                                : initials;
                            const streak = friend.current_streak > 0 ? ` 🔥${friend.current_streak}` : '';

                            return `
                                <div class="arena-invite-friend" onclick="window._launchArena('${friend.friend_id}', '${(friend.friend_name || '').replace(/'/g, "\\'")}')">
                                    <div class="arena-invite-avatar">${photoHtml}</div>
                                    <div class="arena-invite-info">
                                        <div class="arena-invite-name">${friend.friend_name || 'Friend'}${streak}</div>
                                        <div class="arena-invite-status ${statusClass}">${statusText}</div>
                                    </div>
                                    <button class="arena-invite-btn">Invite</button>
                                </div>`;
                        }).join('');
                    }
                }
            } catch (e) {
                console.warn('Could not fetch friends for arena invite:', e);
            }

            overlay.innerHTML = `
                <div class="arena-invite-modal">
                    <div class="arena-invite-header">
                        <h2>🗺️ Arena Mode</h2>
                        <p>Run around, find opponents, battle it out!</p>
                    </div>
                    <div class="arena-invite-body">
                        <!-- Player count -->
                        <div style="padding: 10px 0 14px;">
                            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); font-weight: 600; margin-bottom: 8px;">ARENA SIZE</div>
                            <div class="arena-player-count">
                                <button onclick="window._setArenaCount(4, this)" class="arena-count-btn active">4 Players</button>
                                <button onclick="window._setArenaCount(6, this)" class="arena-count-btn">6 Players</button>
                                <button onclick="window._setArenaCount(8, this)" class="arena-count-btn">8 Players</button>
                            </div>
                        </div>

                        <div class="arena-invite-friend" onclick="window._launchArena(null, null)">
                            <div class="arena-invite-avatar" style="background: linear-gradient(135deg, rgba(16,185,129,0.4), rgba(5,150,105,0.4));">🤖</div>
                            <div class="arena-invite-info">
                                <div class="arena-invite-name">Solo Practice</div>
                                <div class="arena-invite-status" style="color:#10b981;">Play vs bots</div>
                            </div>
                            <button class="arena-invite-btn">Play</button>
                        </div>
                        ${friendsHtml ? '<div style="padding: 8px 0 4px; font-size: 0.7rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px;">Invite friends to the arena</div>' : ''}
                        ${friendsHtml || '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);font-size:0.85rem;">Add friends from the Feed to invite them!</div>'}
                    </div>
                    <div class="arena-invite-footer">
                        <button class="arena-invite-close" onclick="window.closeArenaInvite()">Cancel</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) window.closeArenaInvite();
            });
        }

        window.showArenaInviteModal = showArenaInviteModal;

        window._setArenaCount = function(count, btnEl) {
            window._arenaPlayerCount = count;
            if (btnEl) {
                document.querySelectorAll('.arena-count-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btnEl.classList.add('active');
            }
        };

        window.closeArenaInvite = function() {
            const overlay = document.getElementById('arena-invite-overlay');
            if (overlay) overlay.remove();
        };

        window._launchArena = function(friendId, friendName) {
            window.closeArenaInvite();
            // Navigate to arena with params
            const params = new URLSearchParams();
            params.set('players', window._arenaPlayerCount || 4);
            if (friendId) {
                params.set('invite', friendId);
                params.set('inviteName', friendName || '');
            }
            window.location.href = 'battle-arena.html?' + params.toString();
        };

        // Arena level gate
        function updateArenaButtonLock() {
            const btn = document.querySelector('.arena-trigger-btn');
            if (!btn) return;
            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            if (level < 10) {
                btn.classList.add('locked');
            } else {
                btn.classList.remove('locked');
            }
        }
        setTimeout(updateArenaButtonLock, 2500);
        window.updateArenaButtonLock = updateArenaButtonLock;

        window._sendBattleInvite = async function(friendId, friendName) {
            const betAmount = window._currentBattleBet || 0;

            // Debit coins for the bet before starting
            if (betAmount > 0 && window.supabaseClient && window.currentUser) {
                try {
                    const { data: newBalance, error } = await window.supabaseClient
                        .rpc('debit_coins', {
                            user_uuid: window.currentUser.id,
                            coin_amount: betAmount,
                            txn_type: 'battle_bet',
                            txn_description: 'Battle bet vs ' + friendName,
                            txn_reference: friendId
                        });

                    if (error) throw error;

                    if (newBalance === -1) {
                        alert('Not enough coins for this bet!');
                        return;
                    }

                    if (typeof updateCoinBalanceDisplay === 'function') updateCoinBalanceDisplay(newBalance);
                } catch (e) {
                    console.warn('Could not debit battle bet:', e);
                    alert('Failed to place bet. Please try again.');
                    return;
                }
            }

            window.closeBattleInvite();

            // Create tamagotchi battle record in DB
            let battleId = null;
            const stats = getBattleStats();
            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            try {
                if (window.supabaseClient && window.currentUser) {
                    const { data, error } = await window.supabaseClient
                        .rpc('create_tamagotchi_battle', {
                            p_challenger_id: window.currentUser.id,
                            p_opponent_id: friendId,
                            p_coin_bet: betAmount,
                            p_challenger_stats: { str: stats.str, hp: stats.hp, mana: stats.mana, level }
                        });
                    if (error) throw error;
                    battleId = data;
                }
            } catch (e) {
                console.warn('Could not create tamagotchi battle:', e);
            }

            // Send battle invite via nudges table
            try {
                if (window.supabaseClient && window.currentUser) {
                    const userId = window.currentUser.id || window.currentUser.user_id;

                    await window.supabaseClient
                        .from('nudges')
                        .insert({
                            sender_id: userId,
                            receiver_id: friendId,
                            message: betAmount > 0
                                ? '⚔️ BATTLE CHALLENGE! 🪙 ' + betAmount + ' coin bet! Tap to accept and fight!'
                                : '⚔️ BATTLE CHALLENGE! Tap to accept and fight!',
                            coin_bet: betAmount
                        });

                    console.log('Battle invite sent to', friendName, 'bet:', betAmount);

                    // Send push notification so opponent gets notified even if app is closed
                    const battleMsg = betAmount > 0
                        ? '⚔️ BATTLE CHALLENGE! 🪙 ' + betAmount + ' coin bet! Tap to accept and fight!'
                        : '⚔️ BATTLE CHALLENGE! Tap to accept and fight!';
                    sendDMNotification(friendId, battleMsg);
                }
            } catch (e) {
                console.warn('Could not send battle invite:', e);
            }

            // Store battle info for PvP
            window._activeBattleBet = betAmount;
            window._activeBattleOpponentId = friendId;
            window._activeBattleId = battleId;
            window._isBattleChallenger = true;

            // Start battle — will enter waiting room if PvP (battleId set)
            window._runBattle(friendName || 'Opponent');
        };

        window.cancelBattleWait = function(opponentName) {
            if (window._battleWaitTimer) {
                clearTimeout(window._battleWaitTimer);
                window._battleWaitTimer = null;
            }
            const waiting = document.getElementById('battle-waiting-overlay');
            if (waiting) waiting.remove();

            // Start the actual battle
            window._runBattle(opponentName || 'Opponent');
        };

        // ============================================================
        // INCOMING BATTLE CHALLENGE NOTIFICATION
        // ============================================================
        function showBattleChallengeNotification(fromName, fromId, battleId, coinBet) {
            // Remove existing challenge toasts
            document.querySelectorAll('.battle-challenge-toast:not(.quiz-battle-challenge-toast)').forEach(el => el.remove());

            const betText = coinBet > 0 ? ` 🪙 ${coinBet} coins` : '';
            const toast = document.createElement('div');
            toast.className = 'battle-challenge-toast';
            toast.innerHTML = `
                <div class="battle-challenge-header">
                    <div class="battle-challenge-icon">⚔️</div>
                    <div>
                        <div class="battle-challenge-title">Battle Challenge!</div>
                        <div class="battle-challenge-from">${fromName} wants to fight!${betText}</div>
                    </div>
                </div>
                <div class="battle-challenge-actions">
                    <button class="battle-challenge-accept" onclick="acceptBattleChallenge('${fromId}', '${fromName.replace(/'/g, "\\'")}', this, '${battleId || ''}', ${coinBet || 0})">Accept</button>
                    <button class="battle-challenge-decline" onclick="this.closest('.battle-challenge-toast').remove()">Decline</button>
                </div>
            `;
            document.body.appendChild(toast);

            // Animate in
            setTimeout(() => toast.classList.add('show'), 10);

            // Auto-dismiss after 30 seconds
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 400);
                }
            }, 30000);
        }

        window.acceptBattleChallenge = async function(fromId, fromName, btn, battleId, coinBet) {
            const toast = btn.closest('.battle-challenge-toast');
            if (toast) toast.remove();

            // If we have a battleId, this is a PvP battle — join it and debit coins
            if (battleId && window.supabaseClient && window.currentUser) {
                // Debit opponent's coins
                if (coinBet > 0) {
                    try {
                        const { data: newBalance, error } = await window.supabaseClient
                            .rpc('debit_coins', {
                                user_uuid: window.currentUser.id,
                                coin_amount: coinBet,
                                txn_type: 'battle_bet',
                                txn_description: 'Battle bet vs ' + fromName,
                                txn_reference: battleId
                            });
                        if (error) throw error;
                        if (newBalance === -1) {
                            alert('Not enough coins for this bet!');
                            return;
                        }
                        if (typeof updateCoinBalanceDisplay === 'function') updateCoinBalanceDisplay(newBalance);
                    } catch (e) {
                        console.warn('Could not debit battle bet:', e);
                        alert('Failed to place bet. Please try again.');
                        return;
                    }
                }

                // Join the battle in DB
                const stats = getBattleStats();
                const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
                try {
                    const { data, error } = await window.supabaseClient
                        .rpc('join_tamagotchi_battle', {
                            p_battle_id: battleId,
                            p_user_id: window.currentUser.id,
                            p_opponent_stats: { str: stats.str, hp: stats.hp, mana: stats.mana, level }
                        });
                    if (error) throw error;
                    if (data && data.error) {
                        if (typeof showToast === 'function') showToast('Battle ' + data.error, 'error');
                        return;
                    }
                } catch (e) {
                    console.warn('Could not join tamagotchi battle:', e);
                }

                // Set PvP state
                window._activeBattleBet = coinBet || 0;
                window._activeBattleOpponentId = fromId;
                window._activeBattleId = battleId;
                window._isBattleChallenger = false;
            }

            // Navigate to dashboard if needed
            if (typeof switchAppTab === 'function' && typeof currentActiveTab !== 'undefined' && currentActiveTab !== 'dashboard') {
                const dashBtn = document.querySelector('.bottom-nav .nav-item');
                switchAppTab('dashboard', dashBtn);
                setTimeout(() => window._runBattle(fromName), 500);
            } else {
                window._runBattle(fromName);
            }
        };

        // Poll for incoming battle challenges (check nudges)
        async function checkForBattleChallenges() {
            if (!window.supabaseClient || !window.currentUser) return;
            try {
                const userId = window.currentUser.id || window.currentUser.user_id;
                const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

                const { data, error } = await window.supabaseClient
                    .from('nudges')
                    .select('id, sender_id, message, coin_bet, created_at')
                    .eq('receiver_id', userId)
                    .like('message', '%BATTLE CHALLENGE%')
                    .is('read_at', null)
                    .gte('created_at', fiveMinAgo)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!error && data && data.length > 0) {
                    const challenge = data[0];

                    // Skip quiz battle nudges
                    if (challenge.message.includes('QUIZ BATTLE')) return;

                    // Mark as read
                    await window.supabaseClient
                        .from('nudges')
                        .update({ read_at: new Date().toISOString() })
                        .eq('id', challenge.id);

                    // Get sender name
                    const { data: sender } = await window.supabaseClient
                        .from('users')
                        .select('name')
                        .eq('id', challenge.sender_id)
                        .single();

                    const senderName = sender?.name || 'A friend';

                    // Find the tamagotchi battle record
                    let battleId = null;
                    let coinBet = challenge.coin_bet || 0;
                    try {
                        const { data: battles } = await window.supabaseClient
                            .from('tamagotchi_battles')
                            .select('id, coin_bet')
                            .eq('challenger_id', challenge.sender_id)
                            .eq('opponent_id', userId)
                            .eq('status', 'pending')
                            .order('created_at', { ascending: false })
                            .limit(1);
                        if (battles && battles.length > 0) {
                            battleId = battles[0].id;
                            coinBet = battles[0].coin_bet;
                        }
                    } catch (e) {}

                    showBattleChallengeNotification(senderName, challenge.sender_id, battleId, coinBet);
                }
            } catch (e) {
                // Silently fail
            }
        }

        // Expose to window so native push handler can trigger immediate checks
        window.checkForBattleChallenges = checkForBattleChallenges;

        // Check for challenges every 15 seconds
        setInterval(checkForBattleChallenges, 15000);
        // Initial check after page load
        setTimeout(checkForBattleChallenges, 5000);

        // ============================================================
        // INCOMING QUIZ BATTLE CHALLENGE NOTIFICATION
        // ============================================================
        function showQuizBattleChallengeNotification(fromName, fromId, battleId, coinBet) {
            // Remove existing quiz battle toasts
            document.querySelectorAll('.quiz-battle-challenge-toast').forEach(el => el.remove());

            const toast = document.createElement('div');
            toast.className = 'battle-challenge-toast quiz-battle-challenge-toast';
            toast.innerHTML = `
                <div class="battle-challenge-header">
                    <div class="battle-challenge-icon" style="background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.3));">⚡</div>
                    <div>
                        <div class="battle-challenge-title">Quiz Battle!</div>
                        <div class="battle-challenge-from">${fromName} challenges you!${coinBet > 0 ? ' 🪙 ' + coinBet + ' coins' : ''}</div>
                    </div>
                </div>
                <div class="battle-challenge-actions">
                    <button class="battle-challenge-accept" style="background: linear-gradient(135deg, #7c3aed, #6366f1);" onclick="window._acceptQuizBattleFromToast('${battleId}', '${fromName.replace(/'/g, "\\'")}', ${coinBet}, this)">Accept</button>
                    <button class="battle-challenge-decline" onclick="this.closest('.battle-challenge-toast').remove()">Decline</button>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);

            // Auto-dismiss after 60 seconds (longer for quiz battles)
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 400);
                }
            }, 60000);
        }

        window._acceptQuizBattleFromToast = function(battleId, fromName, coinBet, btn) {
            const toast = btn.closest('.battle-challenge-toast');
            if (toast) toast.remove();

            // Call the acceptQuizBattle function from learning-inline.js
            if (typeof window.acceptQuizBattle === 'function') {
                window.acceptQuizBattle(battleId, fromName, coinBet);
            }
        };

        // Poll for incoming quiz battle challenges
        async function checkForQuizBattleChallenges() {
            if (!window.supabaseClient || !window.currentUser) return;
            try {
                const userId = window.currentUser.id || window.currentUser.user_id;
                const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

                const { data, error } = await window.supabaseClient
                    .from('nudges')
                    .select('id, sender_id, message, coin_bet, created_at')
                    .eq('receiver_id', userId)
                    .like('message', '%QUIZ BATTLE%')
                    .is('read_at', null)
                    .gte('created_at', fiveMinAgo)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (!error && data && data.length > 0) {
                    const challenge = data[0];

                    // Mark as read
                    await window.supabaseClient
                        .from('nudges')
                        .update({ read_at: new Date().toISOString() })
                        .eq('id', challenge.id);

                    // Get sender name
                    const { data: sender } = await window.supabaseClient
                        .from('users')
                        .select('name')
                        .eq('id', challenge.sender_id)
                        .single();

                    const senderName = sender?.name || 'A friend';

                    // Find the quiz battle record
                    const { data: battles } = await window.supabaseClient
                        .from('quiz_battles')
                        .select('id, coin_bet')
                        .eq('challenger_id', challenge.sender_id)
                        .eq('opponent_id', userId)
                        .eq('status', 'pending')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (battles && battles.length > 0) {
                        showQuizBattleChallengeNotification(senderName, challenge.sender_id, battles[0].id, battles[0].coin_bet);
                    }
                }
            } catch (e) {
                // Silently fail
            }
        }

        // Expose to window so native push handler can trigger immediate checks
        window.checkForQuizBattleChallenges = checkForQuizBattleChallenges;

        // Check for quiz battle challenges every 15 seconds
        setInterval(checkForQuizBattleChallenges, 15000);
        setTimeout(checkForQuizBattleChallenges, 6000);

        // ============================================================
        // ACTUAL BATTLE ENGINE (renamed from startBattle)
        // ============================================================
        window._runBattle = async function(opponentName) {
            console.log('🥊 BATTLE START vs', opponentName);

            if (window._battleInProgress) return;
            window._battleInProgress = true;
            window.isDuringBattle = true;

            // PvP state
            const isPvP = !!window._activeBattleId;
            const battleId = window._activeBattleId || null;
            const isChallenger = window._isBattleChallenger || false;
            let battleChannel = null;
            let opponentReady = false;
            let opponentStats = null;

            try {

            const viewer = document.getElementById('tamagotchi-model');
            const overlay = document.getElementById('battle-mode-overlay');
            const overlayText = overlay?.querySelector('.battle-text');
            const widget = document.getElementById('tamagotchi-widget-container');
            const hpContainer = document.getElementById('battle-hp-container');
            const manaContainer = document.getElementById('battle-mana-container');
            const actionContainer = document.getElementById('battle-action-container');
            let bashBtn = document.getElementById('battle-btn-bash');

            if (!widget || !viewer) {
                window._battleInProgress = false;
                window.isDuringBattle = false;
                return;
            }

            // === SAVE ORIGINAL STATE ===
            const savedOrbit = viewer.getAttribute('camera-orbit');
            const hadAutoRotate = viewer.hasAttribute('auto-rotate');
            const hadCameraControls = viewer.hasAttribute('camera-controls');

            // === BATTLE DOJO BACKGROUND ===
            const battleBgClasses = ['tamagotchi-bg-gym','tamagotchi-bg-park','tamagotchi-bg-home','tamagotchi-bg-beach','tamagotchi-bg-mountain','tamagotchi-bg-dojo','tamagotchi-bg-arena'];
            const savedBgClasses = battleBgClasses.filter(c => widget.classList.contains(c));
            battleBgClasses.forEach(c => widget.classList.remove(c));
            widget.classList.add('tamagotchi-bg-dojo');
            const battleStaticBg = document.getElementById('tamagotchi-static-bg');
            if (battleStaticBg) {
                battleStaticBg.style.display = 'block';
                battleStaticBg.style.backgroundImage = "url('./assets/battle_dojo_bg.jpeg')";
                battleStaticBg.style.backgroundSize = 'cover';
                battleStaticBg.style.backgroundPosition = 'center center';
            }

            // === BATTLE CAMERA SETUP ===
            viewer.removeAttribute('auto-rotate');
            viewer.removeAttribute('camera-controls');

            if (typeof viewer.resetTurntableRotation === 'function') {
                viewer.resetTurntableRotation();
            }

            const orbitParts = (savedOrbit || '0deg 85deg 22m').split(/\s+/);
            const currentDist = orbitParts[2] || '22m';
            viewer.setAttribute('camera-orbit', `0deg 85deg ${currentDist}`);

            viewer.style.left = '-30%';

            // Get stats
            const stats = getBattleStats();
            const level = window.getCurrentUserLevel ? window.getCurrentUserLevel() : 1;
            const baseDmg = 20;
            const playerMaxHP = 100 + (stats.hp * 5);
            const playerSTR = stats.str;
            const playerMana = stats.mana;

            // Enemy stats: adaptive bot scales with user's FitGotchi level
            // Curve ramps up gradually - bot should feel beatable but increasingly challenging
            // Low levels (1-10): easy opponent to learn mechanics
            // Mid levels (11-30): competitive, ~50/50 feel
            // High levels (31-50+): tough, requires stat allocation and good moves
            let enemyMaxHP = Math.floor(70 + (level * 5) + Math.pow(level, 1.4));
            let enemyBaseDmg = Math.floor(12 + (level * 0.8) + Math.pow(level, 1.15));

            let playerHP = playerMaxHP;
            let enemyHP = enemyMaxHP;

            // Move picker
            const chosenMove = await showMovePicker();
            const movePower = chosenMove.power || 1;

            // === PvP WAITING ROOM ===
            if (isPvP && window.supabaseClient) {
                // Set up Realtime channel
                battleChannel = window.supabaseClient.channel('tamagotchi-battle-' + battleId);

                // Wait for opponent to be ready
                const myStats = { str: stats.str, hp: stats.hp, mana: stats.mana, movePower, level };
                let waitingResolve = null;

                battleChannel.on('broadcast', { event: 'ready' }, (payload) => {
                    if (payload.payload.userId !== (window.currentUser?.id)) {
                        opponentReady = true;
                        opponentStats = payload.payload.stats;
                        if (waitingResolve) waitingResolve();
                    }
                });

                await battleChannel.subscribe((status) => {
                    console.log('Battle channel status:', status);
                });

                // Broadcast our ready state
                await battleChannel.send({
                    type: 'broadcast',
                    event: 'ready',
                    payload: { userId: window.currentUser?.id, stats: myStats, name: window.currentUser?.user_metadata?.name || 'Player' }
                });

                // If challenger, show waiting room
                if (isChallenger && !opponentReady) {
                    if (overlayText && overlay) {
                        overlayText.textContent = 'WAITING...';
                        overlayText.style.fontSize = '1.5rem';
                        overlay.classList.add('active');
                    }

                    // Wait up to 2 minutes for opponent
                    await Promise.race([
                        new Promise(resolve => { waitingResolve = resolve; }),
                        new Promise(resolve => setTimeout(resolve, 120000))
                    ]);
                    waitingResolve = null;

                    if (overlayText) overlayText.style.fontSize = '';
                    if (overlay) overlay.classList.remove('active');

                    if (!opponentReady) {
                        // Timeout — fall back to bot mode
                        if (typeof showToast === 'function') showToast('Opponent didn\'t join. Fighting bot instead!', 'info');
                    }
                } else if (!isChallenger) {
                    // Opponent side: wait briefly for challenger's ready signal
                    if (!opponentReady) {
                        await Promise.race([
                            new Promise(resolve => { waitingResolve = resolve; }),
                            new Promise(resolve => setTimeout(resolve, 5000))
                        ]);
                        waitingResolve = null;
                    }
                }

                // Set enemy stats from real opponent if PvP connected
                if (opponentReady && opponentStats) {
                    enemyMaxHP = 100 + ((opponentStats.hp || 0) * 5);
                    enemyHP = enemyMaxHP;
                    enemyBaseDmg = baseDmg; // PvP: damage comes from opponent's broadcasts, not this formula
                }

                // Synced countdown (challenger broadcasts)
                if (isChallenger && opponentReady) {
                    for (let c = 3; c >= 0; c--) {
                        await battleChannel.send({ type: 'broadcast', event: 'countdown', payload: { count: c } });
                        if (c > 0) {
                            if (overlayText && overlay) {
                                overlayText.textContent = '' + c;
                                overlay.classList.add('active');
                            }
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                    if (overlay) overlay.classList.remove('active');
                } else if (!isChallenger && opponentReady) {
                    // Listen for countdown from challenger
                    await new Promise(resolve => {
                        let countdownDone = false;
                        battleChannel.on('broadcast', { event: 'countdown' }, (payload) => {
                            const c = payload.payload.count;
                            if (c > 0 && overlayText && overlay) {
                                overlayText.textContent = '' + c;
                                overlay.classList.add('active');
                            }
                            if (c <= 0 && !countdownDone) {
                                countdownDone = true;
                                if (overlay) overlay.classList.remove('active');
                                resolve();
                            }
                        });
                        // Fallback timeout
                        setTimeout(() => { if (!countdownDone) { countdownDone = true; resolve(); } }, 6000);
                    });
                }
            }

            const pvpConnected = isPvP && opponentReady && opponentStats;

            // Animations (shared across all battle functions) - declared early
            const anims = viewer.availableAnimations || [];
            const attackAnim = anims.find(a => a.toLowerCase() === chosenMove.name.toLowerCase())
                || anims.find(a => a.toLowerCase().includes(chosenMove.name.toLowerCase()))
                || anims.find(a => /^boxing$/i.test(a))
                || anims[0];
            const hitAnim = anims.find(a => /^hit_to_1$|^hit_to_2$|^hit_to_3$|^hit_to_head$|^hit_to_side$/i.test(a)) || anims[0];
            const loseAnim = anims.find(a => /^lose$|^die$|^die_1$/i.test(a)) || anims[0];

            // Bash system: mana reduces taps needed (30 base, min 10)
            const baseTapsNeeded = 30;
            const manaReduction = Math.floor(playerMana / 5); // every 5 mana = 1 less tap
            const tapsNeeded = Math.max(10, baseTapsNeeded - manaReduction);
            let bashCount = 0;
            let battleOver = false;
            let battleTimer = null;
            const BATTLE_DURATION = 30000; // 30 seconds

            // === ROUND SYSTEM ===
            let playerRoundWins = 0;
            let enemyRoundWins = 0;
            let currentRound = 0;
            const ROUNDS_TO_WIN = 2; // Best of 3: first to 2 wins

            // Show round transition overlay (e.g. "ROUND 2" with score "1 - 0")
            async function showRoundTransition(roundNum, pWins, eWins) {
                if (overlayText && overlay) {
                    // Show round number
                    overlay.style.color = '#FFD700';
                    overlay.style.textShadow = '0 0 30px rgba(255,215,0,0.8), 0 4px 20px rgba(0,0,0,0.7)';
                    overlayText.innerHTML = `<div style="font-size:1.2em;animation:roundTextPop 0.5s ease-out;">ROUND ${roundNum}</div>` +
                        (roundNum > 1 ? `<div style="font-size:0.6em;margin-top:8px;opacity:0.9;">${pWins} - ${eWins}</div>` : '');
                    overlay.classList.add('active');
                    playSound('bell');
                    await new Promise(r => setTimeout(r, 2000));
                    overlay.classList.remove('active');
                    overlay.style.color = '';
                    overlay.style.textShadow = '';
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // Show round result briefly (e.g. "ROUND 1 - YOU WIN!")
            async function showRoundResult(roundNum, playerWonRound) {
                if (overlayText && overlay) {
                    const color = playerWonRound ? '#00ff00' : '#ff4444';
                    const text = playerWonRound ? 'YOU WIN!' : 'DEFEATED!';
                    overlay.style.color = color;
                    overlay.style.textShadow = `0 0 20px ${color}`;
                    overlayText.innerHTML = `<div style="font-size:0.8em;opacity:0.7;">ROUND ${roundNum}</div><div style="font-size:1.1em;margin-top:4px;">${text}</div>`;
                    overlay.classList.add('active');
                    playSound(playerWonRound ? 'victory' : 'hit');
                    await new Promise(r => setTimeout(r, 2000));
                    overlay.classList.remove('active');
                    overlay.style.color = '';
                    overlay.style.textShadow = '';
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // Reset state between rounds
            function resetRoundState() {
                battleOver = false;
                superReady = false;
                bashCount = 0;
                botAttackCount = 0;
                blockSuccess = false;
                fireWindowOpen = false;
                blockWindowOpen = false;

                // Reset HP
                playerHP = playerMaxHP;
                enemyHP = enemyMaxHP;
                updateHPBars();

                // Reset bash UI (ring)
                updateBashUI();

                // Clear all timers
                if (autoAttackInterval) { clearInterval(autoAttackInterval); autoAttackInterval = null; }
                if (enemyAttackInterval) { clearTimeout(enemyAttackInterval); enemyAttackInterval = null; }
                if (battleTimer) { clearInterval(battleTimer); battleTimer = null; }
                if (fireTimeout) { clearTimeout(fireTimeout); fireTimeout = null; }
                if (blockTimeout) { clearTimeout(blockTimeout); blockTimeout = null; }

                // Hide fire/block buttons
                if (fireBtn) fireBtn.style.display = 'none';
                if (blockBtn) blockBtn.style.display = 'none';
            }

            // Re-attach event listeners to fresh button references after cloneNode
            function reattachBattleListeners() {
                bashBtn = document.getElementById('battle-btn-bash');
                if (bashBtn) {
                    bashBtn.addEventListener('click', onBash);
                    bashBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onBash(); }, { passive: false });
                }
                // Fire button - get fresh reference
                const freshFireBtn = document.getElementById('battle-btn-fire');
                if (freshFireBtn) {
                    freshFireBtn.addEventListener('click', onFireTap);
                    freshFireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onFireTap(); }, { passive: false });
                }
                // Block button - get fresh reference
                const freshBlockBtn = document.getElementById('battle-btn-block');
                if (freshBlockBtn) {
                    freshBlockBtn.addEventListener('click', onBlockTap);
                    freshBlockBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onBlockTap(); }, { passive: false });
                }
            }

            // UI elements
            const bashRingFill = document.getElementById('bash-ring-fill');
            const ringCircumference = 163.36; // 2 * PI * 26

            function updateBashUI() {
                // Update progress ring
                const progress = (bashCount % tapsNeeded) / tapsNeeded;
                if (bashRingFill) {
                    bashRingFill.style.strokeDashoffset = ringCircumference * (1 - progress);
                }
            }

            // HP bar updates
            function updateHPBars() {
                const playerFill = document.getElementById('battle-hp-player');
                const playerText = document.getElementById('battle-hp-player-text');
                const enemyFill = document.getElementById('battle-hp-enemy');
                const enemyText = document.getElementById('battle-hp-enemy-text');
                const playerPct = Math.max(0, (playerHP / playerMaxHP) * 100);
                const enemyPct = Math.max(0, (enemyHP / enemyMaxHP) * 100);
                if (playerFill) playerFill.style.width = playerPct + '%';
                if (playerText) playerText.textContent = `${Math.max(0, Math.round(playerHP))} / ${playerMaxHP}`;
                if (enemyFill) enemyFill.style.width = enemyPct + '%';
                if (enemyText) enemyText.textContent = `${Math.max(0, Math.round(enemyHP))} / ${enemyMaxHP}`;
            }

            function playSound(name) {
                if (typeof playBattleSound === 'function') playBattleSound(name);
            }

            // Triple fireball using special.png
            function spawnTripleFireball(container) {
                const offsets = [-80, 0, 80]; // top, middle, bottom spread
                offsets.forEach((yOff, i) => {
                    const fb = document.createElement('div');
                    fb.innerHTML = `<img src="./assets/special.png" style="width:140px;height:140px;border-radius:50%;filter:drop-shadow(0 0 30px gold) brightness(1.3);">`;
                    fb.style.cssText = `position:absolute; left:150px; top:calc(50% + ${yOff}px); transform:translateY(-50%); z-index:100; pointer-events:none;`;
                    container.appendChild(fb);
                    let posX = 150;
                    const speed = 5 + i; // slightly different speeds for spread effect (50% slower)
                    function move() {
                        posX += speed;
                        fb.style.left = posX + 'px';
                        if (posX > container.clientWidth) fb.remove();
                        else requestAnimationFrame(move);
                    }
                    setTimeout(() => move(), i * 60); // stagger slightly
                });
            }

            // Incoming enemy fireball
            function spawnIncomingBattleFireball(container) {
                return new Promise(resolve => {
                    const fb = document.createElement('div');
                    fb.innerHTML = `<img src="./assets/fireball.png" style="width:140px;height:140px; transform:scaleX(-1); filter:drop-shadow(0 0 22px orange);" onerror="this.style.background='radial-gradient(circle, orange, red)'; this.style.borderRadius='50%';">`;
                    fb.style.cssText = 'position:absolute; right:-150px; top:50%; transform:translateY(-50%); z-index:100; pointer-events:none;';
                    container.appendChild(fb);
                    let posX = container.clientWidth;
                    const targetX = container.clientWidth / 2;
                    const speed = 4;
                    function move() {
                        posX -= speed;
                        fb.style.left = posX + 'px';
                        if (posX <= targetX) { fb.remove(); resolve(); }
                        else requestAnimationFrame(move);
                    }
                    move();
                });
            }

            // Track if super attack is ready
            let superReady = false;

            // Normal auto-attack (character attacks on a timer)
            function spawnNormalFireball(container) {
                const fb = document.createElement('div');
                fb.innerHTML = `<img src="./assets/fireball.png" style="width:140px;height:140px;filter:drop-shadow(0 0 22px orange);" onerror="this.style.background='radial-gradient(circle, orange, red)'; this.style.borderRadius='50%';">`;
                fb.style.cssText = `position:absolute; left:150px; top:50%; transform:translateY(-50%); z-index:100; pointer-events:none;`;
                container.appendChild(fb);
                let posX = 150;
                function move() {
                    posX += 5;
                    fb.style.left = posX + 'px';
                    if (posX > container.clientWidth) fb.remove();
                    else requestAnimationFrame(move);
                }
                move();
            }

            // Broadcast damage to opponent via Realtime (PvP only)
            function broadcastAttack(damage, isSuper) {
                if (battleChannel && pvpConnected) {
                    battleChannel.send({
                        type: 'broadcast',
                        event: 'attack',
                        payload: { userId: window.currentUser?.id, damage, isSuper }
                    });
                }
            }

            // Fire super attack (3 parallel fireballs with special.jpeg)
            function fireSuperAttack() {
                viewer.animationName = attackAnim;
                viewer.play();

                const damage = (baseDmg + playerSTR) * movePower * 1.0;

                // In PvP, don't reduce enemy HP locally — opponent handles their own HP
                // In bot mode, reduce enemy HP directly
                if (!pvpConnected) {
                    enemyHP -= damage;
                    updateHPBars();
                }
                broadcastAttack(damage, true);

                spawnTripleFireball(widget);
                playSound('whoosh');

                // Screen shake
                widget.style.transform = 'translateX(5px)';
                setTimeout(() => widget.style.transform = 'translateX(-5px)', 50);
                setTimeout(() => widget.style.transform = 'translateX(3px)', 100);
                setTimeout(() => widget.style.transform = '', 150);

                // Flash bash button gold briefly
                if (bashBtn) {
                    bashBtn.classList.add('attack-ready');
                    setTimeout(() => bashBtn.classList.remove('attack-ready'), 400);
                }

                superReady = false;
                bashCount = 0;
                updateBashUI();

                if (!pvpConnected && enemyHP <= 0) {
                    battleOver = true;
                }
            }

            // Normal auto-attack
            function fireNormalAttack() {
                viewer.animationName = attackAnim;
                viewer.play();

                const damage = (baseDmg + playerSTR) * movePower * 0.2;

                if (!pvpConnected) {
                    enemyHP -= damage;
                    updateHPBars();
                }
                broadcastAttack(damage, false);

                spawnNormalFireball(widget);
                playSound('whoosh');

                if (!pvpConnected && enemyHP <= 0) {
                    battleOver = true;
                }
            }

            // Auto-attack timer: character fires normal attacks every 2.5s
            // Super attacks are now player-triggered via the FIRE button
            let autoAttackInterval = null;
            function startAutoAttacks() {
                autoAttackInterval = setInterval(() => {
                    if (battleOver) return;
                    // Only fire normal attacks - super is manual via FIRE button
                    if (!superReady) {
                        fireNormalAttack();
                    }
                }, 2500);
            }

            // Incoming triple special fireball (3 blue fireballs from right side)
            function spawnIncomingTripleFireball(container) {
                return new Promise(resolve => {
                    const offsets = [-60, 0, 60];
                    let resolved = false;
                    offsets.forEach((yOff, i) => {
                        const fb = document.createElement('div');
                        fb.innerHTML = `<img src="./assets/special.png" style="width:140px;height:140px;border-radius:50%;transform:scaleX(-1);filter:drop-shadow(0 0 30px cyan) brightness(1.3);">`;
                        fb.style.cssText = `position:absolute; right:-150px; top:calc(50% + ${yOff}px); transform:translateY(-50%); z-index:100; pointer-events:none;`;
                        container.appendChild(fb);
                        let posX = container.clientWidth;
                        const targetX = container.clientWidth / 2;
                        const speed = 4 + i;
                        function move() {
                            posX -= speed;
                            fb.style.left = posX + 'px';
                            if (posX <= targetX) {
                                fb.remove();
                                if (!resolved) { resolved = true; resolve(); }
                            }
                            else requestAnimationFrame(move);
                        }
                        setTimeout(() => move(), i * 60);
                    });
                });
            }

            // Bot enemy counter-attacks (only used in bot mode)
            // Attack speed scales with level: 4.5s at level 1 down to 1.8s at level 50+
            let enemyAttackInterval = null;
            let botAttackCount = 0;
            function startEnemyAttacks() {
                const baseInterval = Math.max(1800, 4500 - Math.floor(Math.pow(level, 1.1) * 50));
                // Bot fires a super attack every 4th hit (scales with level - higher levels do it every 3rd)
                const superEvery = level >= 30 ? 3 : 4;

                function scheduleNextAttack() {
                    if (battleOver) return;
                    // Add +/- 20% variance so bot doesn't feel like a metronome
                    const variance = baseInterval * (0.8 + Math.random() * 0.4);
                    enemyAttackInterval = setTimeout(async () => {
                        if (battleOver) return;

                        botAttackCount++;
                        const isSuper = (botAttackCount % superEvery === 0);

                        // Show BLOCK button before the attack lands
                        showBlockButton();
                        // Brief delay for the block window before fireball spawns
                        await new Promise(r => setTimeout(r, Math.min(blockWindowMs, 200)));

                        if (battleOver) { scheduleNextAttack(); return; }

                        if (isSuper) {
                            await spawnIncomingTripleFireball(widget);
                        } else {
                            await spawnIncomingBattleFireball(widget);
                        }
                        viewer.animationName = hitAnim;
                        viewer.play();
                        playSound('hit');

                        // Check if player blocked
                        const blocked = consumeBlock();

                        const hitFlash = document.createElement('div');
                        if (blocked) {
                            hitFlash.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(96,165,250,0.3);z-index:998;pointer-events:none;';
                        } else {
                            hitFlash.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:${isSuper ? 'cyan' : 'red'};opacity:${isSuper ? '0.4' : '0.3'};z-index:998;pointer-events:none;`;
                        }
                        widget.appendChild(hitFlash);
                        setTimeout(() => hitFlash.remove(), isSuper ? 250 : 150);

                        // Calculate damage (50% reduction if blocked)
                        const dmgVariance = 0.75 + Math.random() * 0.5;
                        const dmgMultiplier = isSuper ? 1.5 : 1.0;
                        const blockMultiplier = blocked ? 0.5 : 1.0;
                        const finalDmg = Math.floor(enemyBaseDmg * dmgVariance * dmgMultiplier * blockMultiplier);
                        playerHP -= finalDmg;
                        updateHPBars();

                        // Screen shake on super (less if blocked)
                        if (isSuper && !blocked) {
                            widget.style.animation = 'none';
                            widget.offsetHeight;
                            widget.style.animation = 'battleShake 0.4s ease';
                        }

                        if (playerHP <= 0) battleOver = true;

                        scheduleNextAttack();
                    }, variance);
                }
                scheduleNextAttack();
            }

            // PvP: listen for real opponent attacks via Realtime
            function listenForOpponentAttacks() {
                if (!battleChannel) return;
                battleChannel.on('broadcast', { event: 'attack' }, async (payload) => {
                    if (battleOver) return;
                    if (payload.payload.userId === window.currentUser?.id) return; // Ignore own attacks

                    const damage = payload.payload.damage || 0;
                    const isSuper = payload.payload.isSuper;

                    // Show BLOCK button before incoming attack
                    showBlockButton();
                    await new Promise(r => setTimeout(r, Math.min(blockWindowMs, 200)));

                    // Show incoming fireball + hit effects
                    if (isSuper) {
                        await spawnIncomingTripleFireball(widget);
                    } else {
                        await spawnIncomingBattleFireball(widget);
                    }

                    viewer.animationName = hitAnim;
                    viewer.play();
                    playSound('hit');

                    // Check if player blocked
                    const blocked = consumeBlock();

                    const hitFlash = document.createElement('div');
                    if (blocked) {
                        hitFlash.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(96,165,250,0.3);z-index:998;pointer-events:none;';
                    } else {
                        hitFlash.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:${isSuper ? 'cyan' : 'red'};opacity:${isSuper ? '0.4' : '0.3'};z-index:998;pointer-events:none;`;
                        // Screen shake on unblocked super
                        if (isSuper) {
                            widget.style.animation = 'none';
                            widget.offsetHeight;
                            widget.style.animation = 'battleShake 0.4s ease';
                        }
                    }
                    widget.appendChild(hitFlash);
                    setTimeout(() => hitFlash.remove(), isSuper ? 250 : 150);

                    // Take damage (50% reduction if blocked)
                    const blockMult = blocked ? 0.5 : 1.0;
                    playerHP -= Math.floor(damage * blockMult);
                    updateHPBars();
                    if (playerHP <= 0) battleOver = true;
                });

                // Listen for opponent finishing
                battleChannel.on('broadcast', { event: 'finished' }, (payload) => {
                    if (payload.payload.userId !== window.currentUser?.id) {
                        // Opponent has submitted their result — we should finish too if not already
                        console.log('Opponent finished battle');
                    }
                });
            }

            // Bash button handler — bashing charges the super attack
            // === FIRE BUTTON LOGIC ===
            let fireBtn = document.getElementById('battle-btn-fire');
            let fireTimeout = null;
            let fireWindowOpen = false;

            function showFireButton() {
                if (battleOver || fireWindowOpen) return;
                fireWindowOpen = true;
                if (fireBtn) {
                    fireBtn.style.display = 'flex';
                    fireBtn.style.animation = 'actionBtnAppear 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), firePulse 0.5s ease-in-out infinite alternate';
                }
                if (bashBtn) bashBtn.classList.add('attack-ready');
                if (navigator.vibrate) navigator.vibrate([50, 30, 100]);

                // 1.5s window to tap FIRE - miss it and charge resets
                fireTimeout = setTimeout(() => {
                    if (fireWindowOpen) {
                        hideFireButton(true); // missed - reset charge
                    }
                }, 1500);
            }

            function hideFireButton(missed) {
                fireWindowOpen = false;
                if (fireTimeout) { clearTimeout(fireTimeout); fireTimeout = null; }
                if (fireBtn) {
                    fireBtn.style.animation = 'actionBtnDisappear 0.15s ease-out forwards';
                    setTimeout(() => { fireBtn.style.display = 'none'; }, 150);
                }
                if (bashBtn) bashBtn.classList.remove('attack-ready');
                if (missed) {
                    // Charge lost - reset bash count
                    superReady = false;
                    bashCount = 0;
                    updateBashUI();
                    if (typeof showToast === 'function') showToast('Special missed! Charge again...', 'info');
                }
            }

            function onFireTap() {
                if (!fireWindowOpen || battleOver) return;
                hideFireButton(false);
                fireSuperAttack();
            }

            if (fireBtn) {
                fireBtn.addEventListener('click', onFireTap);
                fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onFireTap(); }, { passive: false });
            }

            // === BLOCK BUTTON LOGIC ===
            let blockBtn = document.getElementById('battle-btn-block');
            let blockWindowOpen = false;
            let blockTimeout = null;
            let blockSuccess = false;
            // Block window duration scales with level: 0.5s at L1, 0.25s at L50+
            // Tight timing - block button appears right before impact
            const blockWindowMs = Math.max(250, 500 - Math.floor(level * 5));

            function showBlockButton() {
                if (battleOver || blockWindowOpen || fireWindowOpen) return;
                blockWindowOpen = true;
                blockSuccess = false;
                if (blockBtn) {
                    blockBtn.style.display = 'flex';
                    blockBtn.style.animation = 'actionBtnAppear 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), blockPulse 0.4s ease-in-out infinite alternate';
                }

                blockTimeout = setTimeout(() => {
                    hideBlockButton();
                }, blockWindowMs);
            }

            function hideBlockButton() {
                blockWindowOpen = false;
                if (blockTimeout) { clearTimeout(blockTimeout); blockTimeout = null; }
                if (blockBtn) {
                    blockBtn.style.animation = 'actionBtnDisappear 0.15s ease-out forwards';
                    setTimeout(() => { blockBtn.style.display = 'none'; }, 150);
                }
            }

            function onBlockTap() {
                if (!blockWindowOpen || battleOver) return;
                blockSuccess = true;
                hideBlockButton();

                // Show shield visual
                const shield = document.createElement('div');
                shield.className = 'battle-shield-overlay';
                widget.appendChild(shield);
                setTimeout(() => shield.remove(), 500);

                if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
            }

            if (blockBtn) {
                blockBtn.addEventListener('click', onBlockTap);
                blockBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onBlockTap(); }, { passive: false });
            }

            // Returns true if block is active (damage should be halved)
            function consumeBlock() {
                if (blockSuccess) {
                    blockSuccess = false;
                    return true;
                }
                return false;
            }

            function onBash() {
                if (battleOver) return;
                bashCount++;
                updateBashUI();

                // Haptic rumble on each tap
                if (navigator.vibrate) navigator.vibrate(50);

                // Visual feedback on each tap
                if (bashBtn) {
                    bashBtn.classList.remove('bash-rumble');
                    void bashBtn.offsetWidth; // force reflow to restart animation
                    bashBtn.classList.add('bash-rumble');
                }

                // When bash threshold reached, show FIRE button instead of auto-firing
                if (bashCount >= tapsNeeded && !superReady && !fireWindowOpen) {
                    superReady = true;
                    showFireButton();
                }
            }

            // Init HP
            updateHPBars();
            updateBashUI();
            const enemyNameEl = document.querySelector('.battle-hp-box.enemy .battle-hp-name');
            if (enemyNameEl) enemyNameEl.textContent = (opponentName || 'BOT').toUpperCase();

            // === INTRO (skip if PvP already did countdown) ===
            if (!pvpConnected) {
                playSound('intro');
                if (overlayText && overlay) {
                    overlayText.textContent = `VS ${(opponentName || 'BOT').toUpperCase()}!`;
                    overlay.classList.add('active');
                }

                const flash = document.createElement('div');
                flash.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:white;opacity:0.8;transition:opacity 0.5s;pointer-events:none;z-index:999;';
                widget.appendChild(flash);
                setTimeout(() => flash.style.opacity = 0, 50);
                setTimeout(() => flash.remove(), 550);

                await new Promise(r => setTimeout(r, 2000));
                if (overlay) overlay.classList.remove('active');
            } else {
                playSound('intro');
            }

            // Hide battle trigger + unlocks buttons during battle
            const battleTriggerBtn = document.querySelector('.battle-trigger-btn');
            const animTriggerBtn = document.querySelector('.animation-trigger-btn');
            const arenaTriggerBtn = document.querySelector('.arena-trigger-btn');
            if (battleTriggerBtn) battleTriggerBtn.style.display = 'none';
            if (animTriggerBtn) animTriggerBtn.style.display = 'none';
            if (arenaTriggerBtn) arenaTriggerBtn.style.display = 'none';

            // Show battle UI (hide mana bar - not needed anymore)
            if (hpContainer) hpContainer.classList.add('active');
            if (manaContainer) manaContainer.style.display = 'none';
            if (actionContainer) actionContainer.classList.add('active');

            await new Promise(r => setTimeout(r, 600));

            // === 3-ROUND BATTLE LOOP ===
            for (let round = 1; round <= 3; round++) {
                currentRound = round;

                // Show round transition (with score for rounds 2+)
                await showRoundTransition(round, playerRoundWins, enemyRoundWins);

                // Reset state for new round (except round 1 which is already fresh)
                if (round > 1) {
                    resetRoundState();
                    reattachBattleListeners();
                    // Re-get fire/block button refs after cloneNode in previous round cleanup
                    fireBtn = document.getElementById('battle-btn-fire');
                    blockBtn = document.getElementById('battle-btn-block');
                }

                // "FIGHT!" / "BASH!" text
                if (overlayText && overlay) {
                    overlayText.textContent = pvpConnected ? 'FIGHT!' : 'BASH!';
                    overlay.classList.add('active');
                    playSound('bell');
                    await new Promise(r => setTimeout(r, 1000));
                    overlay.classList.remove('active');
                }

                // Add bash listener (round 1 only - subsequent rounds use reattachBattleListeners)
                if (round === 1) {
                    bashBtn.addEventListener('click', onBash);
                    bashBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onBash(); }, { passive: false });
                }

                // Start auto-attacks
                startAutoAttacks();

                // Start enemy attacks: PvP uses real opponent, bot uses simulated
                if (pvpConnected) {
                    listenForOpponentAttacks();
                } else {
                    startEnemyAttacks();
                }

                // Battle timer - 30 seconds per round
                await new Promise(resolve => {
                    battleTimer = setInterval(() => {
                        if (battleOver) {
                            clearInterval(battleTimer);
                            resolve();
                        }
                    }, 100);

                    setTimeout(() => {
                        if (!battleOver) {
                            battleOver = true;
                        }
                    }, BATTLE_DURATION);
                });

                // === END OF ROUND CLEANUP ===
                if (autoAttackInterval) clearInterval(autoAttackInterval);
                if (enemyAttackInterval) clearTimeout(enemyAttackInterval);
                if (battleTimer) clearInterval(battleTimer);
                if (fireTimeout) clearTimeout(fireTimeout);
                if (blockTimeout) clearTimeout(blockTimeout);
                bashBtn.removeEventListener('click', onBash);
                bashBtn.replaceWith(bashBtn.cloneNode(true));
                bashBtn = document.getElementById('battle-btn-bash');

                // Hide fire and block buttons
                const curFireBtn = document.getElementById('battle-btn-fire');
                const curBlockBtn = document.getElementById('battle-btn-block');
                if (curFireBtn) { curFireBtn.style.display = 'none'; curFireBtn.replaceWith(curFireBtn.cloneNode(true)); }
                if (curBlockBtn) { curBlockBtn.style.display = 'none'; curBlockBtn.replaceWith(curBlockBtn.cloneNode(true)); }

                // Determine round winner
                const playerWonRound = pvpConnected ? (playerHP > 0) : (enemyHP <= 0 || playerHP > enemyHP);
                if (playerWonRound) {
                    playerRoundWins++;
                } else {
                    enemyRoundWins++;
                }

                // PvP: broadcast round result
                if (pvpConnected && battleChannel) {
                    battleChannel.send({
                        type: 'broadcast',
                        event: 'round_result',
                        payload: { userId: window.currentUser?.id, round, playerWonRound, playerRoundWins, enemyRoundWins }
                    });
                }

                // Show round result animation
                await showRoundResult(round, playerWonRound);

                // Check if match is decided (first to 2 wins)
                if (playerRoundWins >= ROUNDS_TO_WIN || enemyRoundWins >= ROUNDS_TO_WIN) {
                    break;
                }
            }

            // === MATCH RESULT ===
            const playerWon = playerRoundWins >= ROUNDS_TO_WIN;

            // Restore hidden buttons
            if (battleTriggerBtn) battleTriggerBtn.style.display = '';
            if (animTriggerBtn) animTriggerBtn.style.display = '';
            if (arenaTriggerBtn) arenaTriggerBtn.style.display = '';

            // Settle battle
            const battleBet = window._activeBattleBet || 0;
            const opponentId = window._activeBattleOpponentId || null;

            // PvP: broadcast finished + submit to server RPC
            if (pvpConnected && battleChannel) {
                battleChannel.send({
                    type: 'broadcast',
                    event: 'finished',
                    payload: { userId: window.currentUser?.id, hpRemaining: playerWon ? 100 : 0 }
                });

                try {
                    if (window.supabaseClient && window.currentUser) {
                        const { data: result } = await window.supabaseClient
                            .rpc('finish_tamagotchi_battle', {
                                p_battle_id: battleId,
                                p_user_id: window.currentUser.id,
                                p_hp_remaining: playerWon ? 100 : 0
                            });
                        console.log('Battle result submitted:', result);

                        if (result && result.finished) {
                            if (typeof loadCoinBalance === 'function') loadCoinBalance();
                        }
                    }
                } catch (e) {
                    console.warn('Could not submit battle result:', e);
                }

                battleChannel.unsubscribe();
                battleChannel = null;
            }

            // Show match result with score
            const scoreText = playerRoundWins + ' - ' + enemyRoundWins;

            if (playerWon) {
                const victoryAnim = anims.find(a => /laugh|clap|arms_up/i.test(a)) || 'idle';
                viewer.animationName = victoryAnim;
                viewer.play();
                playSound('victory');
                if (overlayText && overlay) {
                    overlayText.innerHTML = `<div style="font-size:1.2em;">VICTORY!</div><div style="font-size:0.5em;margin-top:8px;opacity:0.8;">${scoreText}</div>`;
                    overlay.style.color = '#00ff00';
                    overlay.style.textShadow = '0 0 20px #00ff00';
                    overlay.classList.add('active');
                }

                if (pvpConnected) {
                    if (typeof showToast === 'function') {
                        const msg = battleBet > 0 ? 'Victory! 🪙 ' + (battleBet * 2) + ' coins won!' : 'Victory!';
                        setTimeout(() => showToast(msg, 'success'), 2000);
                    }
                } else if (battleBet > 0 && window.supabaseClient && window.currentUser) {
                    try {
                        const winnings = battleBet * 2;
                        await window.supabaseClient.rpc('credit_coins', {
                            user_uuid: window.currentUser.id,
                            coin_amount: winnings,
                            txn_type: 'battle_win',
                            txn_description: 'Won battle bet (' + winnings + ' coins)',
                            txn_reference: opponentId || 'battle'
                        });
                        if (typeof loadCoinBalance === 'function') loadCoinBalance();
                        if (typeof showToast === 'function') {
                            setTimeout(() => showToast('Victory! 🪙 ' + winnings + ' coins won!', 'success'), 2000);
                        }
                    } catch (e) {
                        console.warn('Could not settle battle bet:', e);
                        if (typeof showToast === 'function') {
                            setTimeout(() => showToast('Victory!', 'success'), 2000);
                        }
                    }
                } else {
                    if (typeof showToast === 'function') {
                        setTimeout(() => showToast('Victory!', 'success'), 2000);
                    }
                }
            } else {
                viewer.animationName = loseAnim;
                viewer.play();
                if (overlayText && overlay) {
                    overlayText.innerHTML = `<div style="font-size:1.2em;">DEFEATED!</div><div style="font-size:0.5em;margin-top:8px;opacity:0.8;">${scoreText}</div>`;
                    overlay.style.color = '#ff4444';
                    overlay.style.textShadow = '0 0 20px #ff4444';
                    overlay.classList.add('active');
                }
                if (typeof showToast === 'function') {
                    const lossMsg = battleBet > 0
                        ? 'Defeated! Lost 🪙 ' + battleBet + ' coins. Train harder!'
                        : 'Train harder and try again!';
                    setTimeout(() => showToast(lossMsg, 'info'), 2000);
                }
            }

            // Reset battle state
            window._activeBattleBet = 0;
            window._activeBattleOpponentId = null;
            window._activeBattleId = null;
            window._isBattleChallenger = false;

            await new Promise(r => setTimeout(r, 4000));

            // === CLEAN RESET ===
            if (overlay) {
                overlay.classList.remove('active');
                overlay.style.color = '';
                overlay.style.textShadow = '';
            }
            if (hpContainer) hpContainer.classList.remove('active');
            if (manaContainer) { manaContainer.classList.remove('active'); manaContainer.style.display = ''; }
            if (actionContainer) actionContainer.classList.remove('active');

            // Restore background to whatever was selected before battle
            widget.classList.remove('tamagotchi-bg-dojo');
            savedBgClasses.forEach(c => widget.classList.add(c));
            const restoreStaticBg = document.getElementById('tamagotchi-static-bg');
            if (restoreStaticBg) {
                const savedBgName = localStorage.getItem('selectedBackground') || 'none';
                const savedBgObj = (window.BACKGROUND_UNLOCKS || []).find(b => b.name === savedBgName);
                const restoreImage = savedBgObj && savedBgObj.image ? savedBgObj.image : './assets/gym_bg.jpeg';
                restoreStaticBg.style.display = 'block';
                restoreStaticBg.style.backgroundImage = "url('" + restoreImage + "')";
                restoreStaticBg.style.backgroundSize = 'cover';
                restoreStaticBg.style.backgroundPosition = 'center center';
            }

            // Restore camera, controls, and position
            if (savedOrbit) viewer.setAttribute('camera-orbit', savedOrbit);
            if (hadCameraControls) viewer.setAttribute('camera-controls', '');
            if (hadAutoRotate) viewer.setAttribute('auto-rotate', '');
            viewer.style.left = '0';

            viewer.animationName = 'idle';
            setTimeout(() => {
                viewer.pause();
                viewer.currentTime = 0;
                viewer.animationName = null;
                viewer.removeAttribute('animation-name');
            }, 500);

            } catch (e) {
                console.error('Battle error:', e);
                if (battleChannel) { battleChannel.unsubscribe(); battleChannel = null; }
            } finally {
                window._battleInProgress = false;
                window.isDuringBattle = false;
            }
        };

        // ============================================================
        // HOOK INTO LEVEL UP CELEBRATION
        // ============================================================
        const originalTriggerLevelUp = window.triggerLevelUpCelebration;
        if (typeof originalTriggerLevelUp === 'function') {
            window.triggerLevelUpCelebration = function(newLevel, title, previousLevel, lifetimePoints, currentStreak, previousProgress) {
                // Call original
                originalTriggerLevelUp(newLevel, title, previousLevel, lifetimePoints, currentStreak, previousProgress);

                // Grant stat points
                if (previousLevel && newLevel > previousLevel) {
                    grantStatPoints(previousLevel, newLevel);
                }

                // Update background
                applyBackgroundForLevel(newLevel);

                // Update battle button lock
                updateBattleButtonLock();
            };
        }

        // Stat allocation modal is shown only through the level-up celebration flow:
        // 1. triggerLevelUpCelebration() shows it after the celebration animation ends
        // 2. checkPendingLevelUpCelebration() replays interrupted celebrations on reload
        // No need to show it on every page load - that causes a false popup bug.

        console.log('🎮 Progression & Battle System loaded!');
    })();
