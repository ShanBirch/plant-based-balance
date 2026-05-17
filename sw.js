const CACHE_NAME = 'pbb-app-v123'; // v123: keep light nav SVG cutouts transparent; v122: brighten Learn quiz card
const MODEL_CACHE_NAME = 'pbb-models-v20'; // v20: refresh GLB cache with network-first fetch; v19: persistent material heal
const ASSETS = [
  './dashboard.html',
  './assets/balance_logo.png',
  './welcome.html',
  './lib/supabase.js',
  './lib/auth-guard.js',
  './login.html'
];

// Onboarding models needed immediately on first login.
// Fetched ONE AT A TIME after install to avoid OOM crashes on mobile Safari.
// (Previously all 17 models were fetched in parallel which crashed WebKit.)
// Only pre-cache the starter model. Rare/story models (shanbot, arny, optimus,
// steve_irwin) are cached on-demand via the fetch handler when the user selects
// them. Pre-caching all 5 caused OOM crashes on iOS — the SW memory combined
// with page initialization exceeded WKWebView limits.
const ONBOARDING_MODELS = [
  'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb',
];

// Broadcast a status message to all clients so the on-screen debug panel can display it.
async function broadcast(payload) {
  try {
    const all = await self.clients.matchAll({ includeUncontrolled: true });
    all.forEach(c => c.postMessage({ type: 'SW_DEBUG', ts: Date.now(), ...payload }));
  } catch (_) {}
}

// Sequential model caching helper — fetches one model at a time to keep
// memory pressure low on mobile devices.
async function cacheModelsSequentially(cache, urls) {
  for (const url of urls) {
    const name = url.split('/').pop();
    try {
      const existing = await cache.match(url);
      if (existing) {
        await broadcast({ event: 'model_cached', model: name, source: 'already_cached' });
        continue;
      }
      await broadcast({ event: 'model_fetching', model: name });
      const t0 = Date.now();
      const resp = await fetch(url, { mode: 'cors' });
      if (resp.ok) {
        await cache.put(url, resp);
        await broadcast({ event: 'model_cached', model: name, source: 'network', ms: Date.now() - t0 });
      } else {
        await broadcast({ event: 'model_error', model: name, detail: 'HTTP ' + resp.status });
      }
    } catch (e) {
      await broadcast({ event: 'model_error', model: name, detail: e && e.message ? e.message : String(e) });
    }
  }
  await broadcast({ event: 'all_models_done' });
}

// Install - cache app shell, then pre-cache onboarding models sequentially.
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force activation immediately
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => broadcast({ event: 'sw_installed', cache: CACHE_NAME }))
    // Onboarding models are cached after activate (see below) to avoid
    // blocking install and to keep memory usage low during SW startup.
  );
});

// Activate - clean old caches, take control.
// Model pre-caching is deferred — triggered by the page via postMessage('PRECACHE_MODELS')
// after init completes, to avoid OOM crashes on iOS Safari during page load.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== MODEL_CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => broadcast({ event: 'sw_active' }))
  );
});

// Listen for page signal to start model pre-caching (sent after app init completes)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'PRECACHE_MODELS') {
    caches.open(MODEL_CACHE_NAME)
      .then((cache) => cacheModelsSequentially(cache, ONBOARDING_MODELS));
  }
});

// Fetch - Network First for HTML/JS/CSS and 3D models, Cache First for images
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network first for HTML, JS, and CSS files (always get latest)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Clone and cache fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request)) // Fallback to cache if offline
    );
    return;
  }

  // Network first for 3D model files (.glb/.gltf).
  //
  // The home character can look correct immediately after a cache clear, then
  // reopen blotchy/black when model-viewer reads the GLB from Cache Storage on
  // the next app start. Always try a fresh network response first and only use
  // the model cache as an offline fallback. Never store range/partial model
  // responses; a cached partial GLB is poison for later full-model loads.
  if (url.pathname.endsWith('.glb') || url.pathname.endsWith('.gltf')) {
    if (e.request.headers.has('range')) {
      e.respondWith(fetch(e.request));
      return;
    }
    e.respondWith(
      caches.open(MODEL_CACHE_NAME).then(cache => {
        const networkRequest = new Request(e.request, { cache: 'reload' });
        return fetch(networkRequest).then(response => {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(e.request));
      })
    );
    return;
  }

  // Cache first for everything else (images, icons)
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// Handle push notifications from server
self.addEventListener('push', (e) => {
  let data = { title: 'New Message', body: 'You have a new message!' };

  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data.body = e.data.text();
    }
  }

  // Build notification options from server payload
  const options = {
    body: data.body,
    icon: data.icon || './assets/balance_logo.png',
    badge: data.badge || './assets/balance_logo.png',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'dm-message',
    requireInteraction: data.requireInteraction || false,
    data: data.data || { url: './dashboard.html' }
  };

  // Add actions if provided
  if (data.actions) {
    options.actions = data.actions;
  }

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const notificationData = e.notification.data || {};
  const action = e.action; // Action button clicked

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUnmatched: true }).then(clientList => {
      // Handle coach alert notifications — open admin dashboard
      if (notificationData.type === 'coach_checkins_ready') {
        for (let client of clientList) {
          if (client.url.includes('admin-dashboard.html') && 'focus' in client) {
            return client.focus().then(client => {
              client.postMessage({ type: 'coach_checkins_click' });
              return client;
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(notificationData.url || './admin-dashboard.html?tab=checkins');
        }
      }
      if (notificationData.type === 'dm_message' && notificationData.senderId === 'coach_alert') {
        for (let client of clientList) {
          if (client.url.includes('admin-dashboard.html') && 'focus' in client) {
            return client.focus().then(client => {
              client.postMessage({ type: 'coach_alert_click' });
              return client;
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('./admin-dashboard.html');
        }
      }
      // Handle DM message notifications
      else if (notificationData.type === 'dm_message') {
        const isGameInvite = (e.notification.body || '').includes('🎮') || (e.notification.title || '').includes('🎮');
        const senderId = notificationData.senderId || notificationData.sender_id || null;

        // Try to focus existing window
        for (let client of clientList) {
          if (client.url.includes('dashboard.html') && 'focus' in client) {
            return client.focus().then(client => {
              client.postMessage({
                type: 'dm_message_click',
                isGameInvite: isGameInvite,
                senderId: senderId
              });
              return client;
            });
          }
        }

        // If no window exists, open dashboard
        if (clients.openWindow) {
          if (isGameInvite && senderId) {
            return clients.openWindow(`./dashboard.html?action=game_invite&sender_id=${senderId}`);
          } else if (senderId) {
            return clients.openWindow(`./dashboard.html?action=open_dm&sender_id=${senderId}`);
          }
          return clients.openWindow('./dashboard.html');
        }
      }
      // Handle meal reminder notifications
      else if (notificationData.type === 'meal_reminder') {
        const mealType = notificationData.mealType || 'meal';

        // Try to focus existing window
        for (let client of clientList) {
          if (client.url.includes('dashboard.html') && 'focus' in client) {
            return client.focus().then(client => {
              // Send message to open meal input modal
              client.postMessage({
                type: 'open_meal_input',
                action: action, // 'log_photo' or 'log_text'
                mealType: mealType
              });
              return client;
            });
          }
        }

        // If no window exists, open new one with meal logging
        if (clients.openWindow) {
          const inputMethod = action === 'log_text' ? 'text' : 'photo';
          return clients.openWindow(`./dashboard.html?tab=meals&action=log&type=${mealType}&method=${inputMethod}`);
        }
      }
      else {
        // Regular notification - just open dashboard
        return clients.openWindow(notificationData.url || './dashboard.html');
      }
    })
  );
});

// Listen for messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
