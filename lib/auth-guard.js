/**
 * Authentication Guard
 * Include this file on pages that require authentication
 * Add <script src="/lib/auth-guard.js"></script> to protected pages
 */

(async function() {
  window._pbbAuthGuardPending = true;
  window._pbbAuthGuardReady = false;

  function markAuthGuardReady() {
    window._pbbAuthGuardPending = false;
    window._pbbAuthGuardReady = true;
    try {
      window.dispatchEvent(new Event('pbbCurrentUserReady'));
    } catch (e) {}
  }

  function redirectToLogin(url) {
    markAuthGuardReady();
    window.location.replace(url || '/login.html');
  }

  function withAuthTimeout(promise, timeoutMs, label) {
    let timeoutId;
    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error((label || 'auth request') + ' timed out');
        error.name = 'PbbAuthTimeout';
        reject(error);
      }, timeoutMs);

      Promise.resolve(promise).then(
        value => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        error => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }

  function readCachedSupabaseSession() {
    try {
      const keys = ['sb-hzapaorxqboevxnumxkv-auth-token'];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && /^sb-[a-z0-9]+-auth-token$/.test(key) && !keys.includes(key)) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const session = parsed && (parsed.currentSession || parsed.session || parsed);
        if (session && session.access_token && session.user && session.user.id) {
          return session;
        }
      }
    } catch (e) {}
    return null;
  }

  async function getSessionForAuthGuard(timeoutMs) {
    try {
      return await withAuthTimeout(authHelpers.getSession(), timeoutMs, 'getSession');
    } catch (error) {
      const cachedSession = readCachedSupabaseSession();
      if (cachedSession) {
        window._pbbUsingStoredSessionFallback = true;
        console.warn('auth-guard: getSession() unavailable, continuing with stored session user:', error);
        return cachedSession;
      }
      throw error;
    }
  }

  function isLikelyAuthFailure(error) {
    const status = error && (error.status || error.statusCode);
    if (status === 401 || status === 403) return true;
    const code = String(error && error.code || '').toLowerCase();
    const message = String(error && (error.message || error.error_description || error.name) || '').toLowerCase();
    return [
      'invalid_grant',
      'invalid token',
      'jwt expired',
      'jwt malformed',
      'session_not_found',
      'refresh token',
      'not authenticated',
      'unauthorized'
    ].some(term => code.includes(term) || message.includes(term));
  }

  function buildCurrentUserProfileFallback(activeUserId) {
    const activeUser = window.currentUser || {};
    const metadata = activeUser.user_metadata || {};
    const email = activeUser.email || '';
    const name = metadata.full_name || metadata.name || (email ? email.split('@')[0] : '');
    return {
      id: activeUserId || activeUser.id || activeUser.user_id || null,
      email,
      name,
      profile_photo: metadata.avatar_url || metadata.picture || activeUser.profile_photo || null,
      sex: activeUser.sex || activeUser.user_gender || null,
      user_gender: activeUser.user_gender || activeUser.sex || null
    };
  }

  function collectPageViewDiagnostics() {
    const ua = navigator.userAgent || '';
    const cap = window.Capacitor || null;
    let capacitorPlatform = null;
    let capacitorNative = false;
    try {
      capacitorPlatform = cap && typeof cap.getPlatform === 'function'
        ? cap.getPlatform()
        : (cap && cap.platform) || null;
      capacitorNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    } catch (e) {}

    let displayMode = 'browser';
    try {
      ['fullscreen', 'standalone', 'minimal-ui'].some(mode => {
        if (window.matchMedia && window.matchMedia('(display-mode: ' + mode + ')').matches) {
          displayMode = mode;
          return true;
        }
        return false;
      });
      if (navigator.standalone) displayMode = 'ios-standalone';
    } catch (e) {}

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const visualViewport = window.visualViewport || null;

    return {
      path: window.location.pathname,
      search: window.location.search || '',
      referrer: document.referrer || '',
      user_agent: ua,
      platform: navigator.platform || '',
      vendor: navigator.vendor || '',
      language: navigator.language || '',
      languages: Array.isArray(navigator.languages) ? navigator.languages.slice(0, 4) : [],
      timezone: (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
      })(),
      device: {
        is_ios: /iP(ad|hone|od)/.test(ua) && /WebKit/.test(ua),
        is_android: /Android/i.test(ua),
        is_native_app: ua.indexOf('FitGotchi-Native') !== -1 || capacitorNative,
        native_platform: window._fitgotchiNativePlatform || capacitorPlatform || '',
        display_mode: displayMode
      },
      viewport: {
        width: window.innerWidth || null,
        height: window.innerHeight || null,
        visual_width: visualViewport ? Math.round(visualViewport.width) : null,
        visual_height: visualViewport ? Math.round(visualViewport.height) : null,
        visual_scale: visualViewport ? visualViewport.scale : null,
        device_pixel_ratio: window.devicePixelRatio || 1
      },
      screen: window.screen ? {
        width: window.screen.width || null,
        height: window.screen.height || null,
        avail_width: window.screen.availWidth || null,
        avail_height: window.screen.availHeight || null,
        color_depth: window.screen.colorDepth || null
      } : null,
      hardware: {
        max_touch_points: navigator.maxTouchPoints || 0,
        hardware_concurrency: navigator.hardwareConcurrency || null,
        device_memory_gb: navigator.deviceMemory || null
      },
      connection: connection ? {
        effective_type: connection.effectiveType || '',
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
        save_data: !!connection.saveData
      } : null,
      diagnostics_version: 'activity-device-v1'
    };
  }

  function startBalanceAppUsageTracker(activeUser, diagnostics) {
    if (!activeUser || !activeUser.id || !window.supabaseClient) return;
    if (window._balanceAppUsageTrackerStarted && window._balanceAppUsageTrackerUserId === activeUser.id) return;

    window._balanceAppUsageTrackerStarted = true;
    window._balanceAppUsageTrackerUserId = activeUser.id;

    const userId = activeUser.id;
    const cacheKey = 'pbb_app_usage_session:' + userId;
    const idleResetMs = 30 * 60 * 1000;
    const flushIntervalMs = 30 * 1000;
    const minFlushMs = 5 * 1000;
    const maxDeltaMs = 60 * 1000;
    const nowMs = Date.now();

    function randomId() {
      try {
        if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      } catch (e) {}
      return String(nowMs) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function readCachedSession() {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (!parsed || parsed.userId !== userId || !parsed.sessionId) return null;
        if (nowMs - Number(parsed.lastSeenMs || 0) > idleResetMs) return null;
        return parsed;
      } catch (e) {
        return null;
      }
    }

    const cached = readCachedSession();
    const state = {
      userId,
      sessionId: cached?.sessionId || randomId(),
      startedAt: cached?.startedAt || new Date(nowMs).toISOString(),
      activeMs: Math.max(0, Number(cached?.activeSeconds || 0) * 1000),
      lastTickPerf: performance && typeof performance.now === 'function' ? performance.now() : 0,
      lastTickWall: nowMs,
      lastFlushWall: 0,
      visible: document.visibilityState !== 'hidden',
      pending: false,
      stopped: false,
      errorCount: 0
    };

    function persistSession() {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          userId: state.userId,
          sessionId: state.sessionId,
          startedAt: state.startedAt,
          activeSeconds: Math.round(state.activeMs / 1000),
          lastSeenMs: Date.now()
        }));
      } catch (e) {}
    }

    function addVisibleDelta() {
      const perfNow = performance && typeof performance.now === 'function' ? performance.now() : 0;
      const wallNow = Date.now();
      if (state.visible) {
        const perfDelta = perfNow && state.lastTickPerf ? perfNow - state.lastTickPerf : wallNow - state.lastTickWall;
        const wallDelta = wallNow - state.lastTickWall;
        const delta = Math.max(0, Math.min(perfDelta, wallDelta, maxDeltaMs));
        if (delta > 0) state.activeMs += delta;
      }
      state.lastTickPerf = perfNow;
      state.lastTickWall = wallNow;
      persistSession();
    }

    async function flushUsage(reason, ended) {
      if (state.stopped) return;
      addVisibleDelta();

      const wallNow = Date.now();
      if (!ended && state.lastFlushWall && wallNow - state.lastFlushWall < minFlushMs) return;
      if (state.pending) return;

      state.pending = true;
      const activeSeconds = Math.round(state.activeMs / 1000);
      const lastSeenAt = new Date(wallNow).toISOString();

      try {
        const { error } = await window.supabaseClient
          .from('app_usage_sessions')
          .upsert({
            user_id: userId,
            session_id: state.sessionId,
            started_at: state.startedAt,
            last_seen_at: lastSeenAt,
            ended_at: ended ? lastSeenAt : null,
            active_seconds: activeSeconds,
            page_path: window.location.pathname || '',
            app_surface: 'dashboard',
            source: 'auth_guard',
            device: diagnostics?.device || {},
            viewport: diagnostics?.viewport || {},
            metadata: {
              reason,
              search: window.location.search || '',
              timezone: diagnostics?.timezone || '',
              display_mode: diagnostics?.device?.display_mode || '',
              diagnostics_version: 'app-usage-v1'
            }
          }, { onConflict: 'user_id,session_id' });

        if (error) throw error;
        state.errorCount = 0;
        state.lastFlushWall = wallNow;
        persistSession();
      } catch (error) {
        state.errorCount += 1;
        console.warn('App usage session flush failed:', error);
        if (state.errorCount >= 3) {
          state.stopped = true;
          if (state.intervalId) clearInterval(state.intervalId);
        }
      } finally {
        state.pending = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        addVisibleDelta();
        state.visible = false;
        flushUsage('hidden', true);
      } else {
        state.visible = true;
        state.lastTickPerf = performance && typeof performance.now === 'function' ? performance.now() : 0;
        state.lastTickWall = Date.now();
        flushUsage('visible', false);
      }
    }

    function endSession(reason) {
      addVisibleDelta();
      state.visible = false;
      flushUsage(reason || 'pagehide', true);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', () => endSession('pagehide'));
    window.addEventListener('beforeunload', () => endSession('beforeunload'));
    state.intervalId = setInterval(() => flushUsage('heartbeat', false), flushIntervalMs);
    window.getBalanceAppUsageTrackerState = function() {
      addVisibleDelta();
      return {
        userId: state.userId,
        sessionId: state.sessionId,
        activeSeconds: Math.round(state.activeMs / 1000),
        startedAt: state.startedAt,
        visible: state.visible,
        stopped: state.stopped
      };
    };

    flushUsage('start', false);
  }

  // --- ANTI-FLASH: Instantly fix gender-specific UI before paint ---
  try {
    const cachedSession = readCachedSupabaseSession();
    const cachedUserId = cachedSession && cachedSession.user && cachedSession.user.id;
    const genderOwnerId = localStorage.getItem('pbb_user_gender_owner_id');
    const gender = cachedUserId && genderOwnerId === cachedUserId
      ? (localStorage.getItem('userGender') || '')
      : '';
    const isMale = gender.toLowerCase() === 'male';

    // For male users, rename the cycle tab to "Calendar" instead of hiding it
    if (isMale) {
      const renameCycleToCalendar = () => {
        const cycleNavItems = document.querySelectorAll('.nav-item');
        cycleNavItems.forEach(item => {
          const onclick = item.getAttribute('onclick') || '';
          if (onclick.includes('cycle') || onclick.includes('Cycle')) {
            const span = item.querySelector('span');
            if (span && span.textContent.toLowerCase().includes('cycle')) {
              span.textContent = 'Calendar';
            }
          }
        });
      };

      const replaceFlush = (node) => {
        if (node.nodeType === 3) {
          if (node.textContent.includes('The Flush')) {
            node.textContent = 'Performance Mode';
            if (node.parentElement && node.parentElement.style) {
              node.parentElement.style.color = '#3b82f6';
            }
          }
        } else if (node.nodeType === 1) {
          if (node.textContent && node.textContent.includes('The Flush')) {
            const children = node.childNodes;
            for (let i = 0; i < children.length; i++) {
              replaceFlush(children[i]);
            }
          }
        }
      };

      // iOS Safari: SKIP MutationObservers during HTML parsing. On a 1.2MB page,
      // subtree observers fire for every new DOM node (thousands of times), each
      // running querySelectorAll + recursive text walks. This creates enormous
      // memory pressure and garbage that causes OOM crashes during page load.
      // Instead, do a single pass after the DOM is complete.
      // Note: on iOS this script is now loaded post-DOMContentLoaded (deferred to
      // reduce OOM pressure), so we must run immediately if DOM is already ready.
      if (window._pbbIsIOSSafari) {
        if (document.readyState === 'loading') {
          window.addEventListener('DOMContentLoaded', () => {
            renameCycleToCalendar();
            replaceFlush(document.body);
          });
        } else {
          renameCycleToCalendar();
          replaceFlush(document.body);
        }
      } else {
        // Non-iOS: use observers for instant anti-flash (enough memory headroom)
        renameCycleToCalendar();

        const calendarObserver = new MutationObserver(() => {
          renameCycleToCalendar();
        });
        calendarObserver.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('load', () => {
          setTimeout(() => calendarObserver.disconnect(), 2000);
        });

        const antiFlashObserver = new MutationObserver((mutations) => {
          mutations.forEach(m => {
            m.addedNodes.forEach(replaceFlush);
          });
        });
        antiFlashObserver.observe(document.documentElement, { childList: true, subtree: true });

        window.addEventListener('DOMContentLoaded', () => {
          replaceFlush(document.body);
        });

        window.addEventListener('load', () => setTimeout(() => antiFlashObserver.disconnect(), 1000));
      }
    }
  } catch(e) {}
  // ----------------------------------------------------------------

  function getActiveBalanceUserId() {
    return window.currentUser && (window.currentUser.id || window.currentUser.user_id) || null;
  }

  function isCacheForActiveUser(cacheUserId, record, activeUserId) {
    if (!activeUserId) return false;
    return cacheUserId === activeUserId || (record && (record.id === activeUserId || record.user_id === activeUserId));
  }

  // Make user functions available globally immediately. These are user-keyed
  // so admin view_as and logout/login account switches cannot reuse another
  // user's startup data.
  window.getUserProfile = async function() {
    const activeUserId = getActiveBalanceUserId();
    if (!activeUserId) return null;
    if (isCacheForActiveUser(window._pbbProfileCacheUserId, window.userProfile, activeUserId)) {
      window._pbbProfileCacheUserId = activeUserId;
      return window.userProfile;
    }
    if (window._pbbProfilePromise && window._pbbProfilePromiseUserId === activeUserId) {
      return window._pbbProfilePromise;
    }
    try {
      window._pbbProfilePromiseUserId = activeUserId;
      window._pbbProfilePromise = Promise.all([
        dbHelpers.users.get(window.currentUser.id).catch(e => {
          console.warn('Failed to load users profile row:', e);
          return null;
        }),
        dbHelpers.userFacts.get(window.currentUser.id).catch(e => ({}))
      ]).then(([user, facts]) => {
        // If the active user changed while the request was in flight, ignore it.
        if (getActiveBalanceUserId() !== activeUserId) return null;
      
        // Merge facts.personal_details into the main profile object for easy access
        const factsData = facts?.personal_details || {};
        window.userProfile = { ...buildCurrentUserProfileFallback(activeUserId), ...(user || {}), ...factsData };
        window.userFacts = facts || {};
        window._pbbProfileCacheUserId = activeUserId;
        window._pbbFactsCacheUserId = activeUserId;

        return window.userProfile;
      }).finally(() => {
        if (window._pbbProfilePromiseUserId === activeUserId) {
          window._pbbProfilePromise = null;
          window._pbbProfilePromiseUserId = null;
        }
      });

      return await window._pbbProfilePromise;
    } catch (error) {
      window._pbbProfilePromise = null;
      window._pbbProfilePromiseUserId = null;
      console.error('Failed to load user profile:', error);
      return null;
    }
  };

  window.getUserFacts = async function() {
    const activeUserId = getActiveBalanceUserId();
    if (!activeUserId) return null;
    if (isCacheForActiveUser(window._pbbFactsCacheUserId, window.userFacts, activeUserId)) {
      window._pbbFactsCacheUserId = activeUserId;
      return window.userFacts;
    }
    if (window._pbbFactsPromise && window._pbbFactsPromiseUserId === activeUserId) {
      return window._pbbFactsPromise;
    }
    if (window._pbbProfilePromise && window._pbbProfilePromiseUserId === activeUserId) {
      try { await window._pbbProfilePromise; } catch(e) {}
      if (isCacheForActiveUser(window._pbbFactsCacheUserId, window.userFacts, activeUserId)) {
        return window.userFacts;
      }
    }
    try {
      window._pbbFactsPromiseUserId = activeUserId;
      window._pbbFactsPromise = dbHelpers.userFacts.get(window.currentUser.id).then(facts => {
        if (getActiveBalanceUserId() !== activeUserId) return null;
        window.userFacts = facts || {};
        window._pbbFactsCacheUserId = activeUserId;
        return window.userFacts;
      }).finally(() => {
        if (window._pbbFactsPromiseUserId === activeUserId) {
          window._pbbFactsPromise = null;
          window._pbbFactsPromiseUserId = null;
        }
      });
      return await window._pbbFactsPromise;
    } catch (error) {
      window._pbbFactsPromise = null;
      window._pbbFactsPromiseUserId = null;
      console.error('Failed to load user facts:', error);
      return null;
    }
  };

  // ── Native OAuth deep-link: cold-start support ──────────────────
  // When the app is launched via com.fitgotchi.app://login-callback#…,
  // the OAuth tokens are stored on the native side and exposed through
  // window.NativePermissions.getPendingOAuthFragment().  We must set
  // the Supabase session HERE — before the auth check below — so the
  // guard doesn't redirect to login.html.
  async function applySupabaseSessionFragment(fragment, sourceLabel) {
    try {
      const params = new URLSearchParams((fragment || '').replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (!accessToken || !refreshToken) return false;

      const { error } = await window.supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.error((sourceLabel || 'OAuth') + ' setSession error:', error);
        return false;
      }

      sessionStorage.removeItem('guestMode');
      sessionStorage.removeItem('guestBannerDismissed');
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
      return true;
    } catch (e) {
      console.error((sourceLabel || 'OAuth') + ' callback error:', e);
      return false;
    }
  }

  if (window.location.hash) {
    await applySupabaseSessionFragment(window.location.hash, 'Dashboard OAuth');
  }

  if (window.NativePermissions && typeof window.NativePermissions.getPendingOAuthFragment === 'function') {
    try {
      const fragment = window.NativePermissions.getPendingOAuthFragment();
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const accessToken  = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await window.supabaseClient.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('Native OAuth setSession error:', error);
          } else {
            console.log('✅ Native OAuth session set from deep link');
            // Clean the URL so the domain/path don't linger visibly
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to process native OAuth deep link:', e);
    }
  }

  // ── Guest / Preview Mode ─────────────────────────────────────
  // Apple App Store guideline 5.1.1v requires that users can browse
  // non-account-based features without registering.  When ?guest=true
  // is in the URL (or sessionStorage flag is set), skip auth entirely
  // and inject demo data so the dashboard renders read-only.
  const _guestParams = new URLSearchParams(window.location.search);
  const requestedMetaAdTrial = !!(
    window.BalanceMetaAdTrial &&
    typeof window.BalanceMetaAdTrial.isActive === 'function' &&
    window.BalanceMetaAdTrial.isActive()
  );
  const requestedGuestMode = _guestParams.get('guest') === 'true' || requestedMetaAdTrial;
  const storedGuestMode = sessionStorage.getItem('guestMode') === 'true';
  let storedSession = null;

  if (!requestedGuestMode && storedGuestMode) {
    try {
      storedSession = await getSessionForAuthGuard(2500);
    } catch (e) {
      storedSession = null;
    }
    if (storedSession) {
      sessionStorage.removeItem('guestMode');
      sessionStorage.removeItem('guestBannerDismissed');
    }
  }

  // A preview link must never replace a real signed-in member session. This
  // also lets the post-preview signup return claim the locally saved answers.
  if (requestedMetaAdTrial && !storedSession) {
    try {
      storedSession = await getSessionForAuthGuard(2500);
    } catch (e) {
      storedSession = null;
    }
  }

  const isGuestMode = requestedMetaAdTrial
    ? !storedSession
    : (requestedGuestMode || (storedGuestMode && !storedSession));

  if (requestedMetaAdTrial && storedSession) {
    sessionStorage.removeItem('guestMode');
    window.metaAdTrialMode = false;
  }

  if (isGuestMode) {
    sessionStorage.setItem('guestMode', 'true');
    window.guestMode = true;
    window.metaAdTrialMode = requestedMetaAdTrial;

    // Mock currentUser so dashboard code doesn't crash
    window.currentUser = {
      id: 'guest-preview',
      email: 'guest@preview.local',
      aud: 'authenticated',
      user_metadata: { name: 'Guest' },
      app_metadata: {},
      created_at: new Date().toISOString(),
    };

    // Mock user profile with demo data
    window.userProfile = {
      id: 'guest-preview',
      name: 'Guest',
      email: 'guest@preview.local',
      gender: 'female',
      profile_photo: null,
      coin_balance: 250,
      referral_code: 'DEMO',
      program_start_date: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    };

    // Mock user facts
    window.userFacts = {
      personal_details: {
        profile_type: 'weight_loss',
        dietary_preference: 'plant_based',
        age: 28,
        height_cm: 165,
        weight_kg: 68,
        target_weight_kg: 62,
        activity_level: 'moderate',
      }
    };

    // Set localStorage keys so UI renders without errors
    const guestDefaults = {
      dashboardInitialized: 'true',
      fitgotchi_level: '3',
      fitgotchi_rank: 'Seedling',
      fitgotchi_streak: '5',
      fitgotchi_xp_text: '1,250 / 2,000 XP',
      fitgotchi_xp_percent: '62.5',
      quizComplete: 'true',
      userThemePreference: 'light',
    };
    if (!requestedMetaAdTrial) {
      guestDefaults.userGender = 'female';
      guestDefaults.onboardingComplete = 'true';
      // Prevent onboarding wizard from triggering for an ordinary guest.
      guestDefaults.userCycleData = JSON.stringify({ noPeriodMode: true });
    }
    Object.entries(guestDefaults).forEach(([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    });

    // Clean the URL so ?guest=true doesn't linger
    if (_guestParams.get('guest')) {
      _guestParams.delete('guest');
      const cleanUrl = _guestParams.toString()
        ? window.location.pathname + '?' + _guestParams.toString()
        : window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }

    console.log('👀 Guest preview mode active');
    // Skip all auth checks, admin view-as, activity logging — jump to end
    markAuthGuardReady();
    return;
  }

  // Check if user is authenticated
  let session = null;
  try {
    session = storedSession || await getSessionForAuthGuard(3500);
  } catch (e) {
    if (isLikelyAuthFailure(e)) {
      console.error('auth-guard: getSession() failed, redirecting to login:', e);
      redirectToLogin('/login.html');
      return;
    }
    console.warn('auth-guard: getSession() unavailable and no stored session was found:', e);
  }

  if (!session) {
    // User is not logged in - redirect to login page.
    // Use replace() so the protected page URL doesn't stay in history.
    const currentPath = window.location.pathname;
    const loginUrl = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
    redirectToLogin(loginUrl);
    return;
  }

  // User is authenticated. Set the cached session user immediately so the
  // dashboard can start from a real account identity while network validation
  // catches up.
  let user = session.user || null;
  let userWasValidated = false;
  if (user) {
    window.currentUser = user;
    window._pbbUsingCachedSessionUser = true;
  }

  // getUser() makes a network request to validate the JWT. Bound it so a weak
  // mobile connection does not leave the app looking logged out for several
  // seconds even when a cached session is present.
  let userValidationPromise = null;
  try {
    userValidationPromise = authHelpers.getUser();
    const validatedUser = await withAuthTimeout(userValidationPromise, 3500, 'getUser');
    if (validatedUser) {
      user = validatedUser;
      userWasValidated = true;
      window._pbbUsingCachedSessionUser = false;
    }
  } catch (e) {
    if (!user || isLikelyAuthFailure(e)) {
      console.error('auth-guard: getUser() failed, redirecting to login:', e);
      redirectToLogin('/login.html');
      return;
    }

    console.warn('auth-guard: getUser() unavailable, continuing with cached session user:', e);
    if (userValidationPromise) {
      userValidationPromise.then(freshUser => {
        if (!freshUser || window.isAdminViewing) return;
        const activeId = window.currentUser && (window.currentUser.id || window.currentUser.user_id);
        if (activeId && activeId !== freshUser.id) return;
        window.currentUser = freshUser;
        window._pbbUsingCachedSessionUser = false;
        try { syncNativeBalanceSession(session, freshUser); } catch (syncError) {}
      }).catch(error => {
        if (isLikelyAuthFailure(error) && !window.isAdminViewing) {
          console.error('auth-guard: background user validation failed:', error);
          redirectToLogin('/login.html');
        }
      });
    }
  }

  if (!user) {
    redirectToLogin('/login.html');
    return;
  }

  function syncNativeBalanceSession(activeSession, activeUser) {
    try {
      if (!window.NativePermissions) return;
      if (!activeSession || !activeUser || !activeUser.id || window.isAdminViewing) return;
      if (typeof window.NativePermissions.setBalanceNativeAdminEmail === 'function') {
        // Native code creates the admin shortcut only for Shannon's exact email.
        window.NativePermissions.setBalanceNativeAdminEmail(activeUser.email || '');
      }
      if (typeof window.NativePermissions.setBalanceNativeSession !== 'function') return;
      window.NativePermissions.setBalanceNativeSession(
        activeUser.id,
        activeSession.access_token || '',
        activeSession.refresh_token || '',
        activeSession.expires_at || 0
      );
    } catch (e) {
      console.warn('Native session cache skipped:', e);
    }
  }

  // Store current user in global scope for easy access
  window.currentUser = user;
  window._pbbUsingCachedSessionUser = !userWasValidated;

  // Check for admin "view as user" mode
  const _viewAsParams = new URLSearchParams(window.location.search);
  const _viewAsUserId = _viewAsParams.get('view_as');

  if (_viewAsUserId) {
    try {
      if (window.isBalanceAdminEmail?.(user.email)) {
        // Admin verified — override currentUser to view as the target user
        window.adminUser = user;
        window.isAdminViewing = true;
        window.adminViewUserId = _viewAsUserId;

        // Fetch the target user's basic info
        const { data: targetUser } = await window.supabaseClient
          .from('users')
          .select('*')
          .eq('id', _viewAsUserId)
          .maybeSingle();

        if (targetUser) {
          // Build a clean target-user identity for app code. The Supabase
          // session remains the admin session for RLS, but dashboard globals
          // should read like the viewed user, not the admin.
          const targetName = targetUser.name || targetUser.email?.split('@')[0] || 'User';
          window.currentUser = {
            ...targetUser,
            aud: user.aud,
            role: user.role,
            app_metadata: {},
            user_metadata: {
              name: targetName,
              full_name: targetName,
              avatar_url: targetUser.profile_photo || ''
            }
          };
          window.adminViewUserName = targetUser.name || targetUser.email;
          console.log('👁️ Admin viewing account:', targetUser.name || targetUser.email);

          // Clear cached user data so dashboard loads fresh data for the viewed user
          // (sessionStorage is tab-scoped so safe to clear entirely)
          sessionStorage.clear();
          window.userProfile = null;
          window.userFacts = null;
          window._pbbProfileCacheUserId = null;
          window._pbbFactsCacheUserId = null;
          window._pbbProfilePromise = null;
          window._pbbFactsPromise = null;

          // Remove dashboard-specific localStorage caches (preserve auth tokens)
          // Note: the early sync script in dashboard.html already backed up and cleared
          // these keys, but clear again here for non-dashboard pages and safety
          [
            'userProfile', 'dashboardInitialized',
            'fitgotchi_model_src', 'fitgotchi_camera_orbit', 'fitgotchi_fov', 'fitgotchi_scale',
            'fitgotchi_level', 'fitgotchi_rank', 'fitgotchi_xp_text', 'fitgotchi_xp_percent', 'fitgotchi_streak',
            'profile_photo', 'userGender', 'pbb_user_gender_owner_id', 'userThemePreference', 'dietaryPreference',
            'pbb_water_goal_ml', 'weighInDoneCardDismissedDate', 'quizDoneCardDismissedDate',
            'dailyQuizLessonToday', 'progressPhotoDoneCardDismissedDate', 'mealTipCardDismissedDate',
            'workoutTrendCardDismissedDate', 'movementTrendCardDismissedDate', 'myCurrentWorkout',
            'myCurrentWorkoutId', 'weightUnitPreference', 'lastWellnessCheck', 'pbb_points_data',
            'pbb_points_level', 'onboardingComplete', 'program_start_date',
            'battleStats', 'unallocatedStatPoints', 'previousLifetimePoints', 'pendingLevelUpCelebration',
            'selectedBackground', 'myChatStats', 'plant_based_learning_progress'
          ].forEach(k => localStorage.removeItem(k));
        } else {
          console.warn('view_as user not found, loading own account');
          window.isAdminViewing = false;
        }
      } else {
        console.warn('Non-admin attempted view_as, ignoring');
      }
    } catch (e) {
      console.warn('view_as check failed:', e);
    }
  }

  // Balance Foundations is a fixed six-week programme. Grandfathered lifetime
  // members and recurring coaching plans have different plan keys and are not
  // affected by this gate.
  if (!window.isAdminViewing && !window.isBalanceAdminEmail?.(user.email)) {
    try {
      const { data: entitlement, error: entitlementError } = await window.supabaseClient
        .from('users')
        .select('subscription_plan')
        .eq('id', user.id)
        .maybeSingle();
      if (entitlementError) throw entitlementError;

      const isFoundations = entitlement?.subscription_plan === 'balance_foundations_six_week';
      if (isFoundations) {
        const entitlementResponse = await withAuthTimeout(fetch('/.netlify/functions/claim-founders-pass', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + session.access_token
          },
          body: '{}'
        }), 5000, 'foundations entitlement');
        if (entitlementResponse.ok) {
          const fixedTerm = await entitlementResponse.json();
          if (fixedTerm?.expired) {
            markAuthGuardReady();
            window.location.replace('/coaching.html?foundations=complete#starter-coaching');
            return;
          }
        }
      }
    } catch (entitlementError) {
      // Fail open on a temporary profile lookup problem so an active client is
      // never locked out because of network trouble.
      console.warn('auth-guard: fixed-term entitlement check unavailable:', entitlementError);
    }
  }

  // Update last_login and log activity (skip when admin is viewing another user)
  if (!window.isAdminViewing) {
    syncNativeBalanceSession(session, user);

    try {
      dbHelpers.users.updateLastLogin(user.id).catch(e => {
        console.warn('Failed to update last_login:', e);
      });
    } catch (e) {
      console.warn('Failed to queue last_login update:', e);
    }

    try {
      const diagnostics = collectPageViewDiagnostics();
      dbHelpers.activity.log(user.id, 'page_view', diagnostics).catch(error => {
        console.error('Failed to log activity:', error);
      });
      startBalanceAppUsageTracker(user, diagnostics);
    } catch (error) {
      console.error('Failed to queue activity log:', error);
    }
  }

  // Set up auth state listener
  authHelpers.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      try {
        if (window.NativePermissions && typeof window.NativePermissions.clearBalanceNativeSession === 'function') {
          window.NativePermissions.clearBalanceNativeSession();
        }
      } catch (e) {}
      try {
        sessionStorage.clear();
        localStorage.removeItem('userGender');
        localStorage.removeItem('pbb_user_gender_owner_id');
      } catch (e) {}
      window.location.href = '/login.html';
    } else if (session && session.user && !window.isAdminViewing) {
      window.currentUser = session.user;
      window._pbbUsingCachedSessionUser = false;
      syncNativeBalanceSession(session, session.user);
    }
  });

  markAuthGuardReady();
  console.log(userWasValidated ? '✅ Authentication verified:' : '✅ Cached authentication restored:', user.email);
})();
