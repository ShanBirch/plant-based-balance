const CACHE_NAME = 'pbb-app-v5'; // Bumped for Chat Optimization & Fixes
const ASSETS = [
  './dashboard.html',
  './icon-192.png',
  './icon-512.png',
  './index.html',
  './lib/supabase.js',
  './lib/auth-guard.js'
];

// Install - cache assets
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force activation immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

// Fetch - Network First for HTML/JS, Cache First for images
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
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
  
  // Cache first for everything else (images, icons)
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// Handle push notifications
self.addEventListener('push', (e) => {
  let data = { title: 'Coach Shannon', body: 'New message from your coach!' };

  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data.body = e.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './assets/coach_shannon.jpg',
    badge: './assets/logo_optimized.png',
    vibrate: [200, 100, 200],
    tag: 'coach-message',
    requireInteraction: false,
    data: {
      url: './dashboard.html'
    }
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const notificationData = e.notification.data || {};
  const action = e.action; // 'approve' or 'edit' from notification actions

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
      } else {
        // Regular notification - just open dashboard
        return clients.openWindow(notificationData.url || './dashboard.html');
      }
    })
  );
});
