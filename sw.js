const CACHE_NAME = 'pbb-app-v22'; // v22: Better DM notification logging, 5s polling interval
const MODEL_CACHE_NAME = 'pbb-models-v2'; // v2: pre-cache critical onboarding models for fast startup
const ASSETS = [
  './dashboard.html',
  './assets/Logo_dots.jpg',
  './index.html',
  './lib/supabase.js',
  './lib/auth-guard.js',
  './lib/biometric-auth.js',
  './login.html'
];

// Critical 3D models to pre-cache for fast onboarding & dashboard startup
const CRITICAL_MODELS = [
  'https://f005.backblazeb2.com/file/shannonsvideos/arny.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/goku.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/optimus.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/steve_irwin.glb',
  'https://f005.backblazeb2.com/file/shannonsvideos/baby_full_animations.glb'
];

// Install - cache assets + pre-cache critical 3D models
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force activation immediately
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
      // Pre-cache critical models (non-blocking — don't fail install if models fail)
      caches.open(MODEL_CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          CRITICAL_MODELS.map(url =>
            cache.match(url).then(existing => {
              if (existing) return; // Already cached
              return fetch(url, { mode: 'cors' }).then(resp => {
                if (resp.ok) cache.put(url, resp);
              });
            })
          )
        );
      })
    ])
  );
});

// Activate - clean old caches (but keep model cache)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== MODEL_CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

// Fetch - Network First for HTML/JS, Cache First for models & images
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
