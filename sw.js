const CACHE_NAME = 'pbb-app-v18'; // v18: stale-while-revalidate for fast Android startup
const MODEL_CACHE_NAME = 'pbb-models-v1'; // Separate long-lived cache for 3D models
const LIB_CACHE_NAME = 'pbb-libs-v1'; // Long-lived cache for lib/ JS files (they have ?v= busting)
const ASSETS = [
  './dashboard.html',
  './assets/Logo_dots.jpg',
  './index.html',
  './lib/supabase.js',
  './lib/auth-guard.js',
  './lib/biometric-auth.js',
  './lib/nutrition-calculator.js',
  './lib/platform.js',
  './login.html'
];

// Install - cache critical assets and activate immediately
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force activation immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate - clean old caches (but keep model and lib caches)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== MODEL_CACHE_NAME && k !== LIB_CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

// Fetch handler with optimized caching strategies per resource type
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // === STALE-WHILE-REVALIDATE for dashboard.html ===
  // Serve cached version INSTANTLY, then update cache in background.
  // This is the biggest performance win: avoids re-downloading 3.2MB on every launch.
  if (url.pathname.endsWith('/dashboard.html') || url.pathname === '/dashboard.html') {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(response => {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          }).catch(() => cached); // If network fails, cached is already served

          // Return cached immediately if available, otherwise wait for network
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // === CACHE-FIRST for lib/ JS files and large data files ===
  // These rarely change and use ?v= query params for cache busting.
  // Serve from cache instantly, fetch in background only if not cached.
  const isLibJS = url.pathname.startsWith('/lib/') && url.pathname.endsWith('.js');
  const isDataJS = ['/exercise_videos.js', '/workout_library.js', '/workout_library_extended.js',
                     '/meal_plan_library.js', '/quiz.js'].some(f => url.pathname.endsWith(f));
  if (isLibJS || isDataJS) {
    e.respondWith(
      caches.open(LIB_CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          if (cached) return cached;
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

  // === NETWORK-FIRST for other HTML, JS, CSS ===
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // === CACHE-FIRST for 3D model files (.glb/.gltf) ===
  if (url.pathname.endsWith('.glb') || url.pathname.endsWith('.gltf')) {
    e.respondWith(
      caches.open(MODEL_CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          if (cached) return cached;
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

  // === CACHE-FIRST for images and everything else ===
  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) return response;
      return fetch(e.request).then(networkResponse => {
        // Cache images for future use
        if (networkResponse.ok && (url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.jpeg') || url.pathname.endsWith('.webp') || url.pathname.endsWith('.svg'))) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return networkResponse;
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
