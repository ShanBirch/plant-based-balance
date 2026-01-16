const CACHE_NAME = 'pbb-app-v2';
const ASSETS = [
  './dashboard.html',
  './icon-192.png',
  './icon-512.png',
  './index.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// Handle push notifications
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Coach Shannon';
  const options = {
    body: data.body || 'You have a new message',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'daily-coach-message',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './dashboard.html'
    }
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('dashboard.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(e.notification.data.url || './dashboard.html');
      }
    })
  );
});
