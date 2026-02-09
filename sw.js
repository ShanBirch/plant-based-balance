<<<<<<< HEAD
const CACHE_NAME = 'pbb-app-v13'; // Added meal tracking with text/voice input and reminders
=======
const CACHE_NAME = 'pbb-app-v14'; // Improved 3D model caching for faster character loads
const MODEL_CACHE_NAME = 'pbb-models-v1'; // Separate long-lived cache for 3D models
>>>>>>> ac66ca259cf9a37038ebf6ad2a9c697b546a0ee7
const ASSETS = [
  './dashboard.html',
  './assets/Logo_dots.jpg',
  './index.html',
  './lib/supabase.js',
  './lib/auth-guard.js',
  './lib/biometric-auth.js',
  './login.html'
];

// Install - cache assets
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force activation immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

<<<<<<< HEAD
// Activate - clean old caches
=======
// Activate - clean old caches (but keep model cache)
>>>>>>> ac66ca259cf9a37038ebf6ad2a9c697b546a0ee7
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
<<<<<<< HEAD
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
=======
        keys.filter(k => k !== CACHE_NAME && k !== MODEL_CACHE_NAME).map(k => caches.delete(k))
>>>>>>> ac66ca259cf9a37038ebf6ad2a9c697b546a0ee7
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

<<<<<<< HEAD
// Fetch - Network First for HTML/JS, Cache First for images
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
=======
// Fetch - Network First for HTML/JS, Cache First for models & images
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

>>>>>>> ac66ca259cf9a37038ebf6ad2a9c697b546a0ee7
  // Network first for HTML and JS files (always get latest)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.js')) {
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
<<<<<<< HEAD
  
=======

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

>>>>>>> ac66ca259cf9a37038ebf6ad2a9c697b546a0ee7
  // Cache first for everything else (images, icons)
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// Handle push notifications from server
self.addEventListener('push', (e) => {
  let data = { title: 'Coach Shannon', body: 'New message from your coach!' };

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
    icon: data.icon || './assets/coach_shannon.jpg',
    badge: data.badge || './assets/Logo_dots.jpg',
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'coach-message',
    requireInteraction: data.requireInteraction || false,
    data: data.data || { url: './dashboard.html' }
  };

  // Add actions if provided (for approval notifications)
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
      // Check if notification is for pending approval
      if (notificationData.type === 'pending_approval') {
        // Try to focus existing window
        for (let client of clientList) {
          if (client.url.includes('dashboard.html') && 'focus' in client) {
            return client.focus().then(client => {
              // Send message to open approval modal
              client.postMessage({
                type: 'open_approval_modal',
                action: action,
                data: notificationData
              });
              return client;
            });
          }
        }

        // If no window exists, open new one with approval modal trigger
        if (clients.openWindow) {
          return clients.openWindow('./dashboard.html?openApproval=true');
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
