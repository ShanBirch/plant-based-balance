(function() {
        try {
            // 1. Get User Data
            const rawProfile = sessionStorage.getItem('userProfile');
            const data = rawProfile ? JSON.parse(rawProfile) : {};
            // 0. Unified App Content Configuration
            const APP_CONTENT = {
                CORTISOL: {
                    title: "Your Cortisol Recovery Protocol",
                    subtitle: "<strong>The \"Survival Mode\" Profile.</strong> Your body is stuck in fight-or-flight, holding onto belly fat. This plan powers down your adrenaline response to signal safety and shedding.",
                    goldenRules: `
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">1. Carbs at Night</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p>Save starchy carbs (Sweet Potato/Rice) for <strong>dinner</strong>. This blunts the evening cortisol spike and boosts serotonin for deep sleep.</p></div></div>
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">2. No Fasting</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p>Eat within <strong>30 minutes</strong> of waking. Fasting spikes cortisol and keeps your body in emergency storage mode.</p></div></div>
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">3. Magnesium</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p>Prioritize magnesium-rich foods (Spinach, Pumpkin Seeds, Dark Choc) to physically relax the nervous system.</p></div></div>
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">4. 4-Hour Rhythm</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p><strong>Never go >4 hours without food.</strong> Frequent protein feedings assure your ancient brain that you are safe from starvation.</p></div></div>
                    `,
                    spotlight: `
                        <img src="protocols/cortisol/images/sweet_potato_spotlight.png" style="width:150px; height:150px; object-fit:cover; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                        <div><h3 style="color:var(--secondary);">Medicinal Power: The Sweet Potato</h3><p><strong>Why simple carbs?</strong> When eaten at night, the strategic insulin release helps lower cortisol and drives Tryptophan into the brain to create <strong>Serotonin</strong>. It is your biochemistry hack for sleep and calm.</p></div>
                    `,
                    whyWorks: `
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Calming Your Adrenals</h4><p>This plan specifically excludes stimulants and high-glycemic spikes that trigger cortisol release. By stabilizing your blood sugar with complex carbs and protein, we tell your body it is "safe," allowing your adrenal glands to rest and recover.</p></div>
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Strategic Carb Timing</h4><p>We include specific slow-releasing carbohydrates in the evening (like sweet potatoes). This naturally lowers cortisol levels and boosts serotonin production, helping you wind down and improving sleep qualitythe foundation of hormone repair.</p></div>
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Magnesium-Rich Ingredients</h4><p>High-stress burns through magnesium. This menu is packed with magnesium-rich foods like leafy greens, seeds, and cacao to actively replenish your stores, relaxing your nervous system and reducing anxiety.</p></div>
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Anti-Inflammatory fats</h4><p>Healthy fats from avocados, nuts, and seeds provide the raw materials for hormone production while damping down the systemic inflammation caused by chronic stress.</p></div>
                    `,
                    welcomeText: "Your biochemical reset is active. Cortisol levels are stabilizing."
                },
                ESTROGEN: {
                    title: "Your Estrogen Detox Protocol",
                    subtitle: "<strong>The \"Dominance\" Profile.</strong> Heavy cycles, bloating, and mood swings. This plan amplifies fiber and liver support to safely flush excess hormones.",
                    goldenRules: `
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">1. Cruciferous Daily</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p>Eat Broccoli, Kale, or Brussels Sprouts <strong>daily</strong>. They contain compounds (DIM) that active the liver's detox pathways.</p></div></div>
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">2. Raw Carrot Salad</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p>Eat your raw carrot salad <strong>every day</strong>. Its unique fiber acts like a sponge for endotoxins and excess estrogen.</p></div></div>
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">3. Hydration</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p>Drink <strong>3 Liters</strong> of water. Your kidneys are a major detox organ; keep them flushed to reduce bloating.</p></div></div>
                        <div class="card" style="margin:0;"><div class="card-header" style="background:var(--secondary); color:white;"><div class="meal-title" style="color:white;">4. Zero Alcohol</div></div><div class="card-body" style="max-height:none; opacity:1; padding:20px;"><p><strong>Strict No Alcohol.</strong> Ethanol pauses fat burning and liver detox for up to 48 hours. Give your liver a break.</p></div></div>
                    `,
                    spotlight: `
                        <img src="protocols/estrogen/images/raw_carrot_salad_spotlight.png" style="width:150px; height:150px; object-fit:cover; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                         <div><h3 style="color:var(--secondary);">Medicinal Power: Raw Carrot Salad</h3><p><strong>Not just a side dish.</strong> Raw carrots contain a unique fiber that binds to estrogen in the intestine, preventing reabsorption. Paired with coconut oil and vinegar, it is a powerful daily detox tool.</p></div>
                    `,
                    whyWorks: `
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Supporting Liver Detoxification</h4><p>Your liver is responsible for clearing excess estrogen. This plan is rich in cruciferous vegetables (broccoli, kale, cauliflower) containing Indole-3-Carbinol, a compound that directly supports the liver's ability to safely metabolize and excrete used hormones.</p></div>
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Fiber "Estrogen Trap"</h4><p>Once the liver processes estrogen, it needs to be eliminated. The high soluble fiber content in this plan (from oats, beans, flax) acts like a sponge in your gut, binding to this "old" estrogen and ensuring it leaves your body instead of being reabsorbed.</p></div>
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Phytoestrogen Modulation</h4><p>We use specific plant foods like flaxseeds and legumes that contain phytoestrogens. These smart compounds help balance your levelsproviding a weak estrogenic effect if you're low, but competing with potent estrogens if you're high, creating a smoother ride.</p></div>
                        <div style="margin-bottom: 20px;"><h4 style="color: var(--primary);">Gut Microbiome Support</h4><p>A healthy gut minimizes the enzyme beta-glucuronidase, which can recycle bad estrogen. This diverse, plant-based menu feeds the beneficial bacteria needed to keep this enzyme in check.</p></div>
                    `,
                    welcomeText: "Your biochemical reset is active. Estrogen detoxification is active."
                }
            };

            const selectedSymptoms = (data.symptoms || '').split(',').map(s => s.trim()).filter(Boolean);

            // 0.5. Apply Unified Content
            const resultType = sessionStorage.getItem('userResult') || 'CORTISOL';
            const profileKey = (resultType.toUpperCase().includes('ESTROGEN')) ? 'ESTROGEN' : 'CORTISOL';
            const content = APP_CONTENT[profileKey];

            if(content) {
                // Intro / Dashboard
                const heroTitle = document.getElementById('hero-title');
                if(heroTitle) heroTitle.innerHTML = content.title;

                const heroSubtitle = document.getElementById('hero-subtitle');
                if(heroSubtitle) heroSubtitle.innerHTML = content.subtitle;
                
                // Welcome Text (Day 1)
                const welcomeMsg = document.getElementById('welcome-message');
                if(welcomeMsg) welcomeMsg.textContent = content.welcomeText;

                // Golden Rules
                const rulesContainer = document.getElementById('golden-rules-container');
                if(rulesContainer) rulesContainer.innerHTML = content.goldenRules;

                // Spotlight
                const spotlightBody = document.getElementById('spotlight-body');
                if(spotlightBody) spotlightBody.innerHTML = content.spotlight;

                // Why Works
                const whyWorksBody = document.getElementById('why-works-body');
                if(whyWorksBody) whyWorksBody.innerHTML = content.whyWorks;
            }
            
            // 2. Symptom Data (Mirrored from Landing Page)
            const symptomData = {
                bloating: {
                    title: 'SYMPTOM: BLOATING & DIGESTION',
                    wrong: "Dwindling estrogen slows gastric emptying. Your digestion is literally moving slower, causing fermentation and that 'hard' belly feeling.",
                    fix: "We use the 'Flora-Flush' sequence. By rotating specific enzyme-active plants, we clear the digestive backlog and flatten the 'Endo-Belly' in days."
                },
                joint_pain: {
                    title: 'SYMPTOM: JOINTS & INFLAMMATION',
                    wrong: "Estrogen is nature's anti-inflammatory. As it drops, your joints lose hydration and fascia becomes sticky, causing that 'stiff and achy' feeling.",
                    fix: "We implement 'Structural Hydration.' We use specific mineral-dense liquids and collagen-protecting plants to re-lubricate your joints from the inside out."
                },
                mood: {
                    title: 'SYMPTOM: MOOD & IRRITABILITY',
                    wrong: "Estrogen protects your serotonin receptors. When it fluctuates, your emotional 'buffer' disappears, leading to sudden rage or weepiness.",
                    fix: "The 'Neuro-Buffering' Protocol. We use amino-acid rich plant pairings to stabilize your dopamine and serotonin pathways, giving you your patience back."
                },
                hair_skin: {
                    title: 'SYMPTOM: HAIR & SKIN CHANGES',
                    wrong: "As estrogen drops, your relative testosterone levels become dominant, attacking hair follicles and causing 'crepey' or dry skin.",
                    fix: "The 'Follicle-Fortress' Strategy. We block DHT naturally using specific plant sterols and re-hydrate the dermal layers with essential fatty acids."
                },
                hot_flashes: {
                    title: 'SYMPTOM: HOT FLASHES & SWEATS',
                    wrong: "Your hypothalamus is misreading low estrogen as 'overheating,' triggering a false panic-cooldown response that results in sweats.",
                    fix: "The 'Thermostat Reset.' We use cooling phytoestrogens and evening primrose timing to 'lie' to your brain's thermostat and keep your core temperature stable."
                },
                libido: {
                    title: 'SYMPTOM: LOW LIBIDO',
                    wrong: "Dopamine drives desire, but it needs estrogen to fire effectively. Without it, the 'spark' feels physically and mentally distant.",
                    fix: "The 'Spark-Ignition' Protocol. We clear neural pathways and use natural vasodilation plants to increase physical sensitivity and mental desire."
                },
                anxiety: {
                    title: 'SYMPTOM: ANXIETY & DREAD',
                    wrong: "Progesterone is your brain's natural 'chill-pill.' When it crashes, your GABA receptors are left unprotected, causing spikes of dread.",
                    fix: "The 'GABA-Guard' Sequence. We use magnesium-rich plant chelation and specific breathing windows to manually override the panic response."
                },
                weight_gain: {
                    title: 'SYMPTOM: UNEXPECTED WEIGHT GAIN',
                    wrong: "Your body is in 'Storage Mode.' It's hoarding fat to protect your bones and produce emergency estrogen, making standard dieting useless.",
                    fix: "The 'Metabolic Flip.' We switch your body from 'Storage' to 'Fuel' mode by hitting specific insulin triggers and using anti-inflammatory fats."
                }
            };

            // 3. Render Logic
            const container = document.getElementById('symptom-content-container');
            const wrapper = document.getElementById('dynamic-symptom-section');
            
            const activeSymptoms = selectedSymptoms
                .filter(s => symptomData[s])
                .map(s => symptomData[s]);

            if (activeSymptoms.length > 0) {
                wrapper.style.display = 'block';
                container.innerHTML = activeSymptoms.map(s => `
                    <div style="margin-bottom: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <h4 style="color: #48864B; margin: 0 0 10px 0; font-size: 0.9rem;">${s.title}</h4>
                        <p style="font-size: 0.9rem; color: #475569; margin-bottom: 10px;"><strong>The Issue:</strong> ${s.wrong}</p>
                        <p style="font-size: 0.9rem; color: #1e293b; margin: 0;"><strong>The Fix:</strong> ${s.fix}</p>
                    </div>
                `).join('');

                // 4. Meal Card Badging Logic
                applyMealBadges(selectedSymptoms);
            }

            // Expose function globally for re-triggering
            window.applyMealBadges = function(symptomList) {
                let _parsedProfile = {};
                try { _parsedProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}'); } catch(e) {}
                const symptoms = symptomList || _parsedProfile.symptoms || [];

                // Map symptoms to keywords/meal types
                const mappings = {
                    'mood': { type: 'BREAKFAST', badge: '🧠 Brain-Fat Focus', color: '#fef3c7', text: '#8a7e30' }, /* Greeny Gold Text */
                    'bloating': { type: 'DINNER', badge: '🦠 Flora-Flush', color: '#dcfce7', text: '#166534' },
                    'joint_pain': { type: 'SMOOTHIE', badge: '🦴 Structural Hydration', color: '#dbeafe', text: '#1e40af' },
                    'anxiety': { type: 'SNACK', badge: '🛡️ GABA-Guard', color: '#f3e8ff', text: '#6b21a8' },
                    'weight_gain': { type: 'LUNCH', badge: '🔥 Metabolic Spark', color: '#ffe4e6', text: '#9f1239' }
                };

                symptoms.forEach(s => {
                    const map = mappings[s];
                    if (map) {
                        document.querySelectorAll('.meta').forEach(meta => {
                            if (meta.textContent.toUpperCase().includes(map.type)) {
                                const titleInfoDiv = meta.parentElement;
                                const title = titleInfoDiv.querySelector('.meal-title');
                                
                                if (title && !title.querySelector('.dynamic-badge')) {
                                    const badge = document.createElement('span');
                                    badge.className = 'dynamic-badge';
                                    badge.textContent = map.badge;
                                    badge.style.cssText = `
                                        background: ${map.color}; 
                                        color: ${map.text}; 
                                        padding: 4px 8px; 
                                        border-radius: 4px; 
                                        font-size: 0.65rem; 
                                        font-weight: 700; 
                                        text-transform: uppercase; 
                                        margin-left: 10px;
                                        display: inline-block;
                                        vertical-align: middle;
                                        line-height: 1.2;
                                    `;
                                    title.appendChild(badge);
                                }
                            }
                        });
                    }
                });
            };

            // Run on load
            window.applyMealBadges();

        } catch(e) { console.error("Symptom Injection and Badging Error", e); }
    })();

    // --- NEW: Coach & Photo Logic ---
    window.addEventListener('DOMContentLoaded', async () => {
        injectReflectionsIntoDays();

        // NOTE: Do NOT call applyGenderTheme() here - it must run AFTER loadProfileData()
        // restores gender from the database, otherwise it defaults to female

        // --- Login Loading Bar Progress Helper ---
        function updateLoginProgress(percent, message) {
            const bar = document.getElementById('login-loading-bar');
            const text = document.getElementById('login-loading-text');
            if (bar) bar.style.width = percent + '%';
            if (text) text.textContent = message;
        }

        updateLoginProgress(10, 'Authenticating...');

        // Wait for Auth before loading user-specific data
        const waitForAuth = () => new Promise(resolve => {
            if(window.currentUser) return resolve(window.currentUser);
            const check = setInterval(() => {
                if(window.currentUser) {
                    clearInterval(check);
                    resolve(window.currentUser);
                }
            }, 100);
            // Timeout after 5s just in case
            setTimeout(() => { clearInterval(check); resolve(null); }, 5000);
        });

        await waitForAuth();

        // Show admin viewing banner if in view_as mode
        if (window.isAdminViewing) {
            const banner = document.createElement('div');
            banner.id = 'admin-view-banner';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:Inter,sans-serif;font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
            banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.1rem;">👁️</span><span><strong>Admin View</strong> — Viewing ' + (window.adminViewUserName || 'user') + '\'s account (read-only)</span></div><button onclick="window.close()" style="background:white;color:#1e293b;border:none;padding:6px 16px;border-radius:20px;font-size:0.8rem;font-weight:700;cursor:pointer;">Close</button>';
            document.body.prepend(banner);
            // Push page content down so banner doesn't overlap
            document.body.style.paddingTop = '48px';
        }

        if(window.currentUser) {
            try {
            updateLoginProgress(25, 'Loading your profile...');

            // Fire-and-forget: non-blocking background loads
            loadChat();
            loadJournalHistory();

            // Preload custom exercises for video matching
            if (typeof dbHelpers !== 'undefined' && dbHelpers.customExercises) {
                dbHelpers.customExercises.getAll(window.currentUser.id).then(exercises => {
                    window._customExercisesCache = exercises || [];
                    // Also inject custom exercise videos into EXERCISE_VIDEOS for seamless lookup
                    if (typeof EXERCISE_VIDEOS !== 'undefined') {
                        exercises.forEach(ex => {
                            if (ex.video_url && ex.exercise_name) {
                                EXERCISE_VIDEOS[ex.exercise_name] = ex.video_url;
                            }
                        });
                    }
                }).catch(e => console.warn('Custom exercises preload:', e));
            }

            // Phase 1: Run independent async operations in parallel for faster startup
            // - syncQuizDataToDb: sync local quiz data to DB (independent)
            // - seedTestAccount: inject test data if test user (independent)
            // - initCalendarView: load cycle data (loadProfileData depends on this)
            // - loadCharacterColorsFromDb: load gender & colors (loadPointsWidget depends on this)
            await Promise.all([
                syncQuizDataToDb().catch(e => console.warn('Quiz sync error:', e)),
                seedTestAccount().catch(e => console.warn('Seed error:', e)),
                (typeof initCalendarView === 'function'
                    ? initCalendarView().then(() => console.log('✅ Cycle data loaded'))
                    : Promise.resolve()),
                (typeof window.loadCharacterColorsFromDb === 'function'
                    ? window.loadCharacterColorsFromDb()
                    : Promise.resolve())
            ]);

            updateLoginProgress(50, 'Setting up your experience...');

            // Phase 2: Profile data (depends on cycle data from Phase 1)
            await loadProfileData();
            initProgramDate();

            // Apply saved theme AFTER gender is loaded from database
            const savedTheme = localStorage.getItem('userThemePreference') || 'default';
            if (typeof applyAppTheme === 'function') {
                applyAppTheme(savedTheme);
            }

            // Check if essential quiz data is missing and trigger onboarding wizard
            await checkAndTriggerOnboarding();

            updateLoginProgress(65, 'Preparing your FitGotchi...');

            // Phase 3: Load points and update FitGotchi (depends on character colors from Phase 1)
            if (typeof loadPointsWidget === 'function') {
                await loadPointsWidget();
            }

            updateLoginProgress(80, 'Almost there...');

            // Phase 4: Non-critical UI updates (fire-and-forget, don't block)
            // Note: weigh-in, diary, quiz, meal tip, progress photo, workout trend, and
            // performance card are all refreshed by switchAppTab('dashboard') below,
            // so we only call integrations that switchAppTab doesn't handle.
            if(typeof initFitbitDashboard === 'function') initFitbitDashboard();
            if(typeof window.loadCommunityFeed === 'function') window.loadCommunityFeed();

            // Native app: permissions & health/push initialization
            if (typeof isNativeApp === 'function' && isNativeApp()) {
                if (localStorage.getItem('native_permissions_requested')) {
                    // Permissions already requested — silently init health + push
                    if (window.NativeHealth) {
                        window.NativeHealth.init().then(ready => {
                            if (ready) window.NativeHealth.getSummary().then(s => {
                                if (s) console.log('📊 Native health summary:', s);
                            });
                        });
                    }
                } else if (!window._onboardingWizardPending) {
                    // First time on native & no onboarding wizard pending — show permissions modal
                    // (If wizard IS pending, permissions modal will show after wizard finishes)
                    setTimeout(showNativePermissionsModal, 800);
                }
                // Always init native push (FCM) regardless of permissions modal state
                // so the FCM token gets registered for background push notifications
                if (window.NativePush) window.NativePush.init();
            } else if (!window._onboardingWizardPending) {
                // Web (non-native): request notification permission now that user is logged in
                // and onboarding is complete. Deferred from DOMContentLoaded to avoid
                // showing the browser dialog during the onboarding wizard.
                if (typeof requestNotificationPermission === 'function') {
                    requestNotificationPermission();
                }
            }

            // Switch to dashboard as default entry point
            if(typeof switchAppTab === 'function') {
                const homeNav = document.querySelector('.nav-item');
                switchAppTab('dashboard', homeNav);
            }
            } catch(initError) {
                console.error('Initialization error (dismissing overlay anyway):', initError);
            }

            // --- Dismiss Login Loading Overlay ---
            // Wait for the character model to finish loading, then fade out
            (function dismissLoginOverlay() {
                const overlay = document.getElementById('login-loading-overlay');
                if (!overlay) return;

                let dismissed = false;
                const splashStartTime = Date.now();
                const MIN_SPLASH_DURATION = 2500; // Keep splash up for at least 2.5s for aesthetics
                
                function fadeOut() {
                    if (dismissed) return;
                    
                    const elapsed = Date.now() - splashStartTime;
                    if (elapsed < MIN_SPLASH_DURATION) {
                        setTimeout(fadeOut, MIN_SPLASH_DURATION - elapsed);
                        return;
                    }
                    
                    dismissed = true;
                    updateLoginProgress(100, 'Ready!');
                    // Mark that the user has completed their first dashboard load,
                    // so the loading overlay won't show on subsequent page reloads.
                    if (!window.isAdminViewing) { try { localStorage.setItem('dashboardInitialized', 'true'); } catch(e) {} }
                    setTimeout(() => {
                        overlay.classList.add('fade-out');
                        // Remove from DOM after transition
                        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
                    }, 300);
                    // Signal that the main character model + core UI is loaded.
                    // Non-critical assets (rare models, etc.) should wait for this.
                    window._appCriticalContentReady = true;
                    window.dispatchEvent(new Event('appCriticalContentReady'));
                }

                const modelViewer = document.getElementById('tamagotchi-model');
                if (modelViewer && !modelViewer.getAttribute('src')) {
                    // Model src not set yet — wait for it to load
                    const onSrcSet = new MutationObserver(() => {
                        if (modelViewer.getAttribute('src')) {
                            onSrcSet.disconnect();
                            modelViewer.addEventListener('load', fadeOut, { once: true });
                            // Safety timeout if model load takes too long
                            setTimeout(fadeOut, 8000);
                        }
                    });
                    onSrcSet.observe(modelViewer, { attributes: true, attributeFilter: ['src'] });
                    // Absolute safety timeout
                    setTimeout(fadeOut, 12000);
                } else if (modelViewer && modelViewer.getAttribute('src')) {
                    // src already set — wait for load or dismiss if already loaded
                    if (modelViewer.loaded) {
                        fadeOut();
                    } else {
                        modelViewer.addEventListener('load', fadeOut, { once: true });
                        setTimeout(fadeOut, 8000);
                    }
                } else {
                    // No model viewer found — just dismiss after a short delay
                    setTimeout(fadeOut, 2000);
                }
            })();

            // --- TEST DATA SEEDING ---
            async function seedTestAccount() {
                if (window.currentUser?.email === 'shannonbirch@cocospersonaltraining.com') {
                    console.log("🧪 Seeding Test Account Data...");
                    
                    const coreUpdates = {
                        name: 'Shannon Test'
                    };

                    const factUpdates = {
                        profile: 'CORTISOL', // Hormone Type
                        equipment_access: 'none', // Just a mat (Triggers: Yoga, Bodyweight only)
                        energy_status: 'moderate',
                        goal: 'Fat Loss',
                        // Quiz Answers mapping to symptoms
                        keeps_awake: 'worry',     // -> Anxiety
                        midday_crash: 'yes',      // -> Fatigue
                        brain_fog: 'yes',         // -> Fatigue
                        symptoms: ['anxiety', 'fatigue'] // Explicitly set for immediate testing
                    };
                    
                    try {
                        // 1. Core Profile (users table)
                        try {
                            await dbHelpers.users.update(window.currentUser.id, coreUpdates);
                        } catch (coreError) {
                            console.warn("⚠️ Could not update core 'users' table (likely RLS). Proceeding to 'user_facts'.", coreError);
                        }
                        
                        // 2. Extended Facts (user_facts table)
                        let existingFacts = {}; 
                        try { existingFacts = await dbHelpers.userFacts.get(window.currentUser.id); } catch(e){}
                        const currentDetails = existingFacts?.personal_details || {};
                        
                        // Force explicit symptoms to prove it works
                        const finalFacts = { ...currentDetails, ...factUpdates };
                        // Ensure symptoms are set if not already present or if forceful overwrite needed
                        // For test account, we force them.
                        finalFacts.symptoms = ['anxiety', 'bloating', 'fatigue'];

                        await dbHelpers.userFacts.upsert(window.currentUser.id, {
                            personal_details: finalFacts
                        });

                        window.userProfile = { ...window.userProfile, ...coreUpdates, ...factUpdates, symptoms: finalFacts.symptoms };
                        console.log("✅ Test Data Injected Successfully: ", window.userProfile);
                        
                        // Force UI refresh if profile view is active
                        if(typeof loadProfileData === 'function') setTimeout(loadProfileData, 500);
                    } catch (e) {
                        console.error("❌ Failed to seed test data (Fatal)", e);
                    }
                }

                // Test account that skips quiz but shows onboarding slides
                if (window.currentUser?.email === 'shannonrhysbirch@gmail.com') {
                    console.log("🧪 Setting up Onboarding Test Account (skips quiz, shows onboarding)...");

                    // Clear onboarding complete flag to ensure wizard shows
                    localStorage.removeItem('onboardingComplete');

                    // Clear any cached quiz data from sessionStorage
                    sessionStorage.removeItem('userProfile');

                    // Clear quiz results from database to ensure onboarding triggers
                    try {
                        await window.supabaseClient
                            .from('quiz_results')
                            .delete()
                            .eq('user_id', window.currentUser.id);
                        console.log("✅ Cleared quiz results for onboarding test account");
                    } catch(e) {
                        console.warn("⚠️ Could not clear quiz results:", e);
                    }

                    console.log("✅ Onboarding Test Account Ready - wizard will show");
                }
            }

            // Auto-show Daily Wellness check-in (once per day)
            // NOTE: Moved to after onboarding completes - handled by finishOnboarding()
            // This ensures check-in only shows AFTER user selects gender in onboarding
        } else {
            // Auth failed — dismiss overlay (auth guard will redirect to login)
            const overlay = document.getElementById('login-loading-overlay');
            if (overlay) overlay.remove();
        }
    });

    function injectReflectionsIntoDays() {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        // Find all day views
        document.querySelectorAll('.day-view').forEach(view => {
            const id = view.id; // e.g., week1-Monday
            if (!id) return;
            
            // Check if it ends with a day name
            const isDay = days.some(day => id.endsWith(day));
            if (!isDay) return;

            // Check if already injected
            if (view.querySelector('.reflection-card')) return;

            const div = document.createElement('div');
            div.className = 'card reflection-card';
            div.innerHTML = `
                <div class="card-header" style="background: white; cursor: default;">
                    <div class="meal-title" style="color: var(--primary);">End of Day Reflection</div>
                </div>
                <div class="card-body" style="padding: 25px; max-height: none; opacity: 1;">
                    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">How did you feel today? Any wins or challenges?</p>
                    <textarea id="ref-${id}" placeholder="Journal your thoughts here..." style="width: 100%; height: 120px; padding: 15px; border: 1px solid #cbd5e0; border-radius: 8px; font-family: 'Inter'; font-size: 0.95rem; resize: vertical; margin-bottom: 15px;"></textarea>
                    <button onclick="saveDayReflection('${id}')" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">Save Entry</button>
                    <span id="status-${id}" style="margin-left: 15px; font-size: 0.85rem; color: #166534;"></span>
                </div>
            `;
            view.appendChild(div);

            // Load saved reflection
            const saved = localStorage.getItem('reflection_' + id);
            if (saved) {
                div.querySelector('textarea').value = saved;
            }
        });
    }

    window.saveDayReflection = function(id) {
        const el = document.getElementById('ref-' + id);
        if (!el) return;
        const val = el.value;
        if (!val.trim()) return;

        // Save locally
        localStorage.setItem('reflection_' + id, val);

        const status = document.getElementById('status-' + id);
        if (status) {
            status.textContent = "Saved to your journal.";
            setTimeout(() => { status.textContent = ""; }, 3000);
        }

        // Re-render journal history
        loadJournalHistory();

        // Trigger Celebration
        // Parse "week1-Monday" to get "Day X" or just confirm "Day Complete"
        // For simplicity, we can map days to numbers or just say "You did it!"
        showDayCompletion(id);
    };

    window.showDayCompletion = function(dayId) {
        const modal = document.getElementById('day-completion-modal');
        const text = document.getElementById('completion-text');
        
        // Simple heuristic for day number
        // Assuming we are on Day 1 for demo if not strictly tracked elsewhere in this simpler version
        // Or extract from dayId if it was "day1" etc. 
        // dayId format: "week1-Monday"
        
        let displayDay = "Today";
        if(dayId.includes('Monday')) displayDay = "Day 1";
        if(dayId.includes('Tuesday')) displayDay = "Day 2";
        if(dayId.includes('Wednesday')) displayDay = "Day 3";
        if(dayId.includes('Thursday')) displayDay = "Day 4";
        if(dayId.includes('Friday')) displayDay = "Day 5";
        if(dayId.includes('Saturday')) displayDay = "Day 6";
        if(dayId.includes('Sunday')) displayDay = "Day 7";

        text.textContent = `You have successfully completed ${displayDay}.`;
        modal.style.display = 'flex';
        triggerConfetti();
    }

    window.closeCompletionModal = function() {
        const modal = document.getElementById('day-completion-modal');
        if (modal) modal.style.display = 'none';
    }

    window.triggerConfetti = function() {
        // Simple JS confetti
        const colors = ['#d4af37', '#046A38', '#ffffff', '#f0fdf4'];
        for(let i=0; i<50; i++) {
            const el = document.createElement('div');
            el.className = 'confetti-piece';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            el.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 5000);
        }
    }
    
    // Inject confetti styles if not present
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fall {
            to { transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);

    // --- MOVEMENT STUDIO DB & LOGIC ---
    // --- WORKOUT TRACKER & DATABASE LOGIC ---
    
    // 1. Configuration
    const DEFAULT_WORKOUT = [
        { id: 'sq_01', name: 'Goblet Squat', thumb: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=150', video: 'MeIiIdhvOUg', sets: 3 },
        { id: 'dl_01', name: 'Romanian Deadlift', thumb: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=150', video: 'vI2jU4zFfK8', sets: 3 },
        { id: 'push_01', name: 'Kneeling Push Up', thumb: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=150', video: 'WPHG8tJ9bO0', sets: 3 }
    ];

    let myWorkout = DEFAULT_WORKOUT;
    try { myWorkout = JSON.parse(localStorage.getItem('myCurrentWorkout')) || DEFAULT_WORKOUT; } catch(e) {}
    let rapidApiKey = localStorage.getItem('rapidApiKey') || ''; // User needs to set this

    // 2. Initialize
    async function loadMovementStudio() {
        renderWorkoutList();
    }

    // 3. Render Workout List (Trainerize Style)
    function renderWorkoutList() {
        const container = document.getElementById('workout-list');
        if(!container) return;
        
        if(myWorkout.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#94a3b8;">No exercises added. Go to Library to add some!</div>`;
            return;
        }

        container.innerHTML = myWorkout.map((ex, index) => `
            <div class="card" style="margin-bottom:20px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img src="${ex.thumb || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; background:white;">
                        <div>
                            <h4 style="margin:0; color:var(--primary); font-size:1rem;">${ex.name}</h4>
                            ${ex.video ? `<button onclick="openExerciseModal('${ex.video}')" style="background:none; border:none; color:#3b82f6; font-size:0.75rem; cursor:pointer; padding:0; display:flex; align-items:center; gap:4px; margin-top:4px;">? Watch Demo</button>` : ''}
                        </div>
                    </div>
                     <button onclick="removeExercise(${index})" style="color:#ef4444; background:none; border:none; font-size:0.8rem; cursor:pointer;">Remove</button>
                </div>
                <!-- Sets -->
                <div style="padding:15px;">
                    <div style="display:grid; grid-template-columns: 40px 1fr 1fr 40px; gap:10px; margin-bottom:10px; font-size:0.7rem; color:#64748b; font-weight:700; text-transform:uppercase; text-align:center;">
                        <div>Set</div>
                        <div>kg / lbs</div>
                        <div>Reps</div>
                        <div></div>
                    </div>
                    ${Array(ex.sets || 3).fill(0).map((_, i) => `
                        <div style="display:grid; grid-template-columns: 40px 1fr 1fr 40px; gap:10px; margin-bottom:8px; align-items:center;">
                            <div style="text-align:center; color:#94a3b8; font-weight:600; font-size:0.9rem;">${i + 1}</div>
                            <input type="number" placeholder="0" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; text-align:center; background:#f8fafc;">
                            <input type="number" placeholder="0" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; text-align:center; background:#f8fafc;">
                            <div class="check-circle" onclick="this.classList.toggle('completed')" style="width:32px; height:32px; border:2px solid #e2e8f0; border-radius:50%; margin:0 auto; cursor:pointer; display:flex; align-items:center; justify-content:center; color:white; transition:all 0.2s;">✓</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    // 4. ExerciseDB Integration (RapidAPI)
    window.searchRapidAPI = async function() {
        const searchEl = document.getElementById('db-search-input');
        if (!searchEl) return;
        const query = searchEl.value.trim();
        const grid = document.getElementById('library-results');
        
        if(!rapidApiKey) {
            alert("Please set your RapidAPI Key first (click 'Update API Key'). Using Demo Data for now.");
            // Demo Fallback
            renderLibraryResults([
                { id: 'demo1', name: 'Barbell Squat', bodyPart: 'legs', gifUrl: 'https://v2.exercisedb.io/image/demo-squat.gif', target: 'glutes' },
                { id: 'demo2', name: 'Dumbbell Lunge', bodyPart: 'legs', gifUrl: 'https://v2.exercisedb.io/image/demo-lunge.gif', target: 'quads' },
                { id: 'demo3', name: 'Plank', bodyPart: 'core', gifUrl: 'https://v2.exercisedb.io/image/demo-plank.gif', target: 'abs' }
            ]); 
            return;
        }

        if(!query) return;

        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px;">Searching ExerciseDB...</div>';

        try {
            const url = `https://exercisedb.p.rapidapi.com/exercises/name/${query}`;
            const options = {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': rapidApiKey,
                    'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
                }
            };

            const response = await fetch(url, options);
            const result = await response.json();
            
            if(Array.isArray(result)) {
                renderLibraryResults(result.slice(0, 20)); // Limit 20
            } else {
                grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px;">No results found.</div>';
            }

        } catch (error) {
            console.error(error);
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red; padding:20px;">Error fetching data. Check Console.</div>';
        }
    }

    function renderLibraryResults(list) {
        const grid = document.getElementById('library-results');
        grid.innerHTML = list.map(item => `
            <div class="card" style="margin:0; text-align:center; padding:10px; cursor:pointer; transition:all 0.2s; touch-action: manipulation; user-select: none;" onclick="addToWorkout('${item.name.replace(/'/g, "\\'")}', '${item.gifUrl}')">
                <img src="${item.gifUrl}" style="width:100%; height:120px; object-fit:contain; mix-blend-mode:multiply; margin-bottom:10px; pointer-events: none;">
                <h5 style="margin:0 0 5px 0; font-size:0.85rem; color:var(--primary);">${item.name}</h5>
                <small style="color:#64748b; text-transform:uppercase; font-size:0.7rem;">${item.bodyPart || item.target}</small>
                <div style="margin-top:10px; color:var(--secondary); font-size:0.8rem; font-weight:600;">+ Add</div>
            </div>
        `).join('');
    }

    // Load exercise library from EXERCISE_VIDEOS (Google Drive)
    window.loadExerciseLibrary = function(searchQuery = '') {
        const grid = document.getElementById('library-results');

        // Safety check for library loading
        if (typeof EXERCISE_VIDEOS === 'undefined') {
            grid.innerHTML = `
                <div style="grid-column:1/-1; padding:20px; text-align:center; color:red; background:#fee2e2; border-radius:12px;">
                    <strong>Error: Exercise Library Not Loaded</strong><br>
                    <div style="font-size:0.8rem; margin-top:5px;">Please verify 'exercise_videos.js' file exists and is in the same folder.</div>
                </div>`;
            return;
        }

        const allExercises = Object.keys(EXERCISE_VIDEOS);

        if (allExercises.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">Exercise library is empty.</div>';
            return;
        }

        // Filter by search query if provided
        let filteredExercises = allExercises;
        if (searchQuery) {
            const terms = searchQuery.toLowerCase().split(' ');
            filteredExercises = allExercises.filter(name => {
                const nameLower = name.toLowerCase();
                return terms.every(term => nameLower.includes(term));
            });
        }

        if (filteredExercises.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">No exercises found matching your search.</div>';
            return;
        }

        // Limit to first 100 exercises for performance
        const displayExercises = filteredExercises.slice(0, 100);

        grid.innerHTML = displayExercises.map(name => {
            const videoUrl = EXERCISE_VIDEOS[name];
            const escapedName = name.replace(/'/g, "\\'");
            const escapedUrl = videoUrl.replace(/'/g, "\\'");

            return `
                <div class="card" style="margin:0; text-align:center; padding:12px; cursor:pointer; transition:all 0.2s; position:relative;" onclick="openExerciseVideo('${escapedUrl}', '${escapedName}')">
                    <div style="width:100%; height:120px; background:#f8fafc; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; position:relative; overflow:hidden;">
                        <svg style="width:48px; height:48px; color:#cbd5e0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.6); color:white; font-size:0.65rem; padding:2px 6px; border-radius:4px;">VIDEO</div>
                    </div>
                    <h5 style="margin:0 0 5px 0; font-size:0.85rem; color:var(--primary); line-height:1.3;">${name}</h5>
                    <div style="margin-top:8px; color:var(--secondary); font-size:0.75rem; font-weight:600;">▶ Watch</div>
                </div>
            `;
        }).join('');

        if (displayExercises.length < filteredExercises.length) {
            grid.innerHTML += `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8; font-size:0.9rem;">Showing first ${displayExercises.length} of ${filteredExercises.length} exercises. Use search to narrow down.</div>`;
        }
    }

    window.addToWorkout = function(name, gif) {
        myWorkout.push({
            id: 'ex_' + Date.now(),
            name: name,
            thumb: gif,
            video: null, // No YT video for API items
            sets: 3
        });
        localStorage.setItem('myCurrentWorkout', JSON.stringify(myWorkout));
        alert(`${name} added to workout!`);
        switchTrackerView('workout');
    }

    window.removeExercise = function(index) {
        if(confirm('Remove this exercise?')) {
            myWorkout.splice(index, 1);
            localStorage.setItem('myCurrentWorkout', JSON.stringify(myWorkout));
            renderWorkoutList();
        }
    }

    window.promptApiKey = function() {
        const key = prompt("Enter your RapidAPI Key for ExerciseDB:", rapidApiKey);
        if(key) {
            rapidApiKey = key;
            localStorage.setItem('rapidApiKey', key);
            alert("API Key Saved.");
        }
    }

    window.switchTrackerView = function(view) {
        document.getElementById('view-workout').style.display = view === 'workout' ? 'block' : 'none';
        document.getElementById('view-library').style.display = view === 'library' ? 'block' : 'none';

        const btnW = document.getElementById('btn-workout');
        const btnL = document.getElementById('btn-library');

        if(view === 'workout') {
            btnW.style.color = 'var(--primary)'; btnW.style.borderBottomColor = 'var(--primary)';
            btnL.style.color = '#94a3b8'; btnL.style.borderBottomColor = 'transparent';
            renderWorkoutList();
        } else {
            btnL.style.color = 'var(--primary)'; btnL.style.borderBottomColor = 'var(--primary)';
            btnW.style.color = '#94a3b8'; btnW.style.borderBottomColor = 'transparent';
            loadExerciseLibrary(); // Load exercise library with videos
        }
    }
    
    // Style check circles
    document.head.insertAdjacentHTML('beforeend', `<style>.check-circle.completed { background: #10b981 !important; border-color: #10b981 !important; }</style>`);

    // --- END TRACKER LOGIC ---

    // Call this on load
    window.addEventListener('DOMContentLoaded', () => {
         loadMovementStudio();
    });

    // Chat
    window.toggleFloatingChat = function() {
        const box = document.getElementById('floating-chat-box');
        if(box.style.display === 'none' || !box.style.display) {
            box.style.display = 'flex';
        } else {
            box.style.display = 'none';
        }
    }

    window.sendChatMessage = function(inputEl) {
        let input;
        if (inputEl) {
            input = inputEl;
        } else {
            input = document.getElementById('chat-input');
        }
        
        const txt = input.value.trim();
        if(!txt) return;

        // Add user msg to ALL containers
        addMessage(txt, 'user');
        
        // Clear inputs
        document.querySelectorAll('input[type="text"]').forEach(el => {
             if(el.id === 'chat-input' || el.classList.contains('chat-input-field')) el.value = '';
        });
        
        // Save
        saveChatToStorage(txt, 'user');

        // Simulate AI Pending
        setTimeout(() => {
        }, 1000);
    }
    
    function addMessage(text, sender) {
        document.querySelectorAll('.chat-history-container').forEach(container => {
            const div = document.createElement('div');
            const isUser = sender === 'user';
            
            div.style.cssText = isUser 
                ? "align-self: flex-end; background: var(--primary); color: white; padding: 12px 16px; border-radius: 12px 12px 0 12px; max-width: 85%;"
                : "align-self: flex-start; background: white; padding: 12px 16px; border-radius: 12px 12px 12px 0; border: 1px solid #e2e8f0; max-width: 85%;";
                
            div.innerHTML = `
                <p style="margin: 0; font-size: 0.95rem;">${text}</p>
                <span style="font-size: 0.75rem; color: ${isUser ? 'rgba(255,255,255,0.7)' : '#94a3b8'}; display: block; margin-top: 5px; text-align: right;">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            `;
            
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        });
    }

    function saveChatToStorage(text, sender) {
        let chat = [];
        try { chat = JSON.parse(localStorage.getItem('myChatStats') || '[]'); } catch(e) {}
        chat.push({ text, sender, time: new Date().toISOString() });
        localStorage.setItem('myChatStats', JSON.stringify(chat));
    }

    function loadChat() {
        let chat = [];
        try { chat = JSON.parse(localStorage.getItem('myChatStats') || '[]'); } catch(e) {}
        chat.forEach(msg => addMessage(msg.text, msg.sender));
    }

    // Journal History
    function loadJournalHistory() {
        const journalContainer = document.getElementById('journal-history');
        if (!journalContainer) return;
        journalContainer.innerHTML = ''; // Clear previous entries

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weeks = ['week1', 'week2', 'week3', 'week4'];

        let hasEntries = false;

        weeks.forEach(week => {
            days.forEach(day => {
                const id = `${week}-${day}`;
                const savedReflection = localStorage.getItem('reflection_' + id);
                if (savedReflection) {
                    hasEntries = true;
                    const entryDiv = document.createElement('div');
                    entryDiv.style.cssText = 'margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;';
                    entryDiv.innerHTML = `
                        <h5 style="margin: 0 0 8px 0; color: var(--primary-light); font-size: 0.95rem;">${week.charAt(0).toUpperCase() + week.slice(1)} - ${day}</h5>
                        <p style="margin: 0; font-size: 0.9rem; color: #4a5568;">${savedReflection}</p>
                    `;
                    journalContainer.appendChild(entryDiv);
                }
            });
        });

        if (!hasEntries) {
            journalContainer.innerHTML = '<p style="font-style: italic; color: var(--text-muted);">No journal entries yet. Start writing your daily reflections!</p>';
        }
    }

    // ==========================================
    // REFLECTIONS DIARY SYSTEM
    // ==========================================

    // Load all reflections (meal plan + standalone) and display chronologically
    function loadAllReflections() {
        const container = document.getElementById('reflections-list');
        if (!container) return;

        const reflections = [];

        // 1. Load meal plan reflections
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weeks = ['week1', 'week2', 'week3', 'week4'];

        weeks.forEach(week => {
            days.forEach(day => {
                const id = `${week}-${day}`;
                const savedReflection = localStorage.getItem('reflection_' + id);
                if (savedReflection) {
                    reflections.push({
                        type: 'mealplan',
                        id: id,
                        title: `${week.charAt(0).toUpperCase() + week.slice(1)} - ${day}`,
                        text: savedReflection,
                        timestamp: 0 // Meal plan reflections don't have timestamps, will show at bottom
                    });
                }
            });
        });

        // 2. Load standalone reflections
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('standalone_reflection_')) {
                let data;
                try { data = JSON.parse(localStorage.getItem(key)); } catch(e) { continue; }
                if (!data) continue;
                reflections.push({
                    type: 'standalone',
                    id: key,
                    title: formatReflectionDate(data.timestamp),
                    text: data.text,
                    timestamp: data.timestamp
                });
            }
        }

        // 3. Sort by timestamp (newest first, meal plan at bottom)
        reflections.sort((a, b) => b.timestamp - a.timestamp);

        // 4. Render
        if (reflections.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">📔</div>
                    <p style="margin: 0; font-size: 1rem; font-weight: 500;">No reflections yet</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.875rem;">Start by adding your first reflection or complete a meal plan day</p>
                </div>
            `;
        } else {
            container.innerHTML = '';
            reflections.forEach(r => {
                const entryDiv = document.createElement('div');
                entryDiv.style.cssText = 'margin-bottom: 15px; padding: 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;';
                entryDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">${r.title}</div>
                        ${r.type === 'standalone' ? `<button onclick="deleteReflection('${r.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0; font-size: 1.2rem; line-height: 1;">&times;</button>` : ''}
                    </div>
                    <div style="font-size: 0.95rem; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${r.text}</div>
                `;
                container.appendChild(entryDiv);
            });
        }
    }

    // Format timestamp to readable date
    function formatReflectionDate(timestamp) {
        if (!timestamp) return 'Meal Plan Entry';
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Check if today
        if (date.toDateString() === today.toDateString()) {
            return 'Today, ' + date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        }

        // Check if yesterday
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday, ' + date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
        }

        // Otherwise show full date
        return date.toLocaleDateString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Open modal to add new reflection
    window.openNewReflectionModal = function() {
        const modal = document.createElement('div');
        modal.id = 'reflection-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 500px; width: 100%; padding: 25px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 1.3rem; color: var(--text-main);">New Reflection</h3>
                    <button onclick="closeReflectionModal()" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                </div>
                <p style="margin: 0 0 15px 0; font-size: 0.9rem; color: #64748b;">How are you feeling? Any wins or challenges today?</p>
                <textarea id="new-reflection-text" placeholder="Write your thoughts..." style="width: 100%; height: 200px; padding: 15px; border: 1px solid #cbd5e0; border-radius: 8px; font-family: 'Inter'; font-size: 1rem; resize: vertical; margin-bottom: 20px;"></textarea>
                <div style="display: flex; gap: 10px;">
                    <button onclick="closeReflectionModal()" style="flex: 1; background: #f1f5f9; color: #64748b; border: none; padding: 12px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">Cancel</button>
                    <button onclick="saveNewReflection()" style="flex: 1; background: var(--primary); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Focus textarea
        setTimeout(() => {
            document.getElementById('new-reflection-text').focus();
        }, 100);
    }

    // Close modal
    window.closeReflectionModal = function() {
        const modal = document.getElementById('reflection-modal');
        if (modal) modal.remove();
    }

    // Save new standalone reflection
    window.saveNewReflection = function() {
        const text = document.getElementById('new-reflection-text').value.trim();
        if (!text) return;

        const timestamp = Date.now();
        const id = `standalone_reflection_${timestamp}`;

        localStorage.setItem(id, JSON.stringify({
            text: text,
            timestamp: timestamp
        }));

        closeReflectionModal();
        loadAllReflections();
    }

    // Delete a standalone reflection
    window.deleteReflection = function(id) {
        if (confirm('Delete this reflection?')) {
            localStorage.removeItem(id);
            loadAllReflections();
        }
    }
