const CACHE_NAME = 'pbb-app-v28'; // v28: Enable SW on native + timeout race for slow connections
const MODEL_CACHE_NAME = 'pbb-models-v3'; // v3: all evolution + collectible models
const API_CACHE_NAME = 'pbb-api-v1'; // v1: Supabase user data, nutrition, learning progress

// Core app files
const ASSETS = [
  './dashboard.html',
  './assets/Logo_dots.jpg',
  './index.html',
  './lib/supabase.js',
  './lib/auth-guard.js',
  './lib/biometric-auth.js',
  './lib/nutrition-calculator.js',
  './lib/learning-config.js',
  './lib/learning-lessons.js',
  './lib/learning-inline.js',
  './lib/learning.js',
  './lib/stories.js',
  './lib/ai-opponents.js',
  './lib/games.js',
  './lib/native-health.js',
  './lib/native-iap.js',
  './lib/native-push.js',
  './lib/platform.js',
  './lib/points-config.js',
  './lib/migrate-localstorage.js',
  './lib/avatar.js',
  './login.html'
];

// CDN libraries to pre-cache so app works offline / loads fast
const CDN_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js'
];

// All 3D models to pre-cache: onboarding + evolution + collectible characters
const CRITICAL_MODELS = [
  // Onboarding story models
  'https://f005.backblazeb2.com/file/shannonsvideos/arny.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/goku.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/optimus.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/steve_irwin.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb',
  // Male evolution models
  'https://f005.backblazeb2.com/file/shannonsvideos/level_1_good_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_10_real_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_20_real_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_30_real_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_40_real_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_50_real_final.glb',
  // Female evolution models
  'https://f005.backblazeb2.com/file/shannonsvideos/level_1_female_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_10_female_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_20_female_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_30_female_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_40_female_final.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/level_50_female_final.glb',
  // Collectible / rare characters
  'https://f005.backblazeb2.com/file/shannonsvideos/gohan.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/vegeta.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/cbum.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/ronny.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/itadori.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/elon.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/trump.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/epstein_rigged.glb'
];

// Install - cache assets, CDN scripts, and pre-cache 3D models
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force activation immediately
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
      // Pre-cache CDN scripts (non-blocking)
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          CDN_SCRIPTS.map(url =>
            cache.match(url).then(existing => {
              if (existing) return;
              return fetch(url, { mode: 'cors' }).then(resp => {
                if (resp.ok) cache.put(url, resp);
              }).catch(() => {}); // Don't fail install
            })
          )
        );
      }),
      // Pre-cache critical models (non-blocking — don't fail install if models fail)
      caches.open(MODEL_CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          CRITICAL_MODELS.map(url =>
            cache.match(url).then(existing => {
              if (existing) return; // Already cached
              return fetch(url, { mode: 'cors' }).then(resp => {
                if (resp.ok) cache.put(url, resp);
              }).catch(() => {}); // Don't fail install
            })
          )
        );
      })
    ])
  );
});

// Activate - clean old caches (keep model + API caches)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== MODEL_CACHE_NAME && k !== API_CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

// Fetch - smart caching per resource type
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Only handle GET requests (POST/PATCH/DELETE should always hit network)
  if (e.request.method !== 'GET') return;

  // Supabase REST API — stale-while-revalidate for user data, nutrition, learning progress
  // Serves cached response instantly while fetching fresh data in the background
  if (url.hostname.includes('supabase.co') && url.pathname.startsWith('/rest/')) {
    e.respondWith(
      caches.open(API_CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(response => {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(() => {
            // Offline — return cached if available
            return cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
          });
          // Return cached immediately if available, otherwise wait for network
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Network-first with timeout for HTML, JS, and CSS files.
  // If cached version exists and network takes > 3s, serve cache immediately
  // (network fetch continues in background to update cache for next load).
  // This prevents the app from hanging on slow connections.
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(response => {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          });

          if (!cached) {
            // Nothing in cache — must wait for network
            return networkFetch.catch(() => cached);
          }

          // Race: serve cache after 3s timeout if network is slow
          return Promise.race([
            networkFetch,
            new Promise(resolve => setTimeout(() => resolve(cached), 3000))
          ]).catch(() => cached);
        });
      })
    );
    return;
  }

  // Cache first for 3D model files (.glb/.gltf) - stored in dedicated model cache
  if (url.pathname.endsWith('.glb') || url.pathname.endsWith('.gltf')) {
    e.respondWith(
      caches.open(MODEL_CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          if (cached) return cached;
          // Not cached yet - fetch, cache, and return
          return fetch(e.request).then(response => {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Cache first for everything else (images, icons, fonts)
  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) return response;
      return fetch(e.request).then(resp => {
        // Cache images and other static assets on first fetch
        if (resp.ok && (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2?)$/) || url.hostname.includes('fonts.googleapis.com'))) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      });
    })
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
    icon: data.icon || './assets/Logo_dots.jpg',
    badge: data.badge || './assets/Logo_dots.jpg',
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
      // Handle DM message notifications
      if (notificationData.type === 'dm_message') {
        // Try to focus existing window
        for (let client of clientList) {
          if (client.url.includes('dashboard.html') && 'focus' in client) {
            return client.focus();
          }
        }

        // If no window exists, open dashboard
        if (clients.openWindow) {
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
