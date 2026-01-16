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

  e.waitUntil(
    clients.openWindow(e.notification.data.url || './dashboard.html')
  );
});
