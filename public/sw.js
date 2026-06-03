// AutoPulse Service Worker — handles push notifications and offline caching

const CACHE = 'autopulse-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// ── Fetch handler ─────────────────────────────────────────
// Only intercept same-origin requests. Cross-origin requests (Supabase API,
// edge functions) must be handled natively by the browser — iOS Safari blocks
// cross-origin fetch() calls made from within the SW context.
self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  // Same-origin: pass through to network
  e.respondWith(fetch(e.request));
});

// ── Push notifications ────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: 'AutoPulse', body: e.data.text() }; }

  const title = payload.title || 'AutoPulse';
  const options = {
    body: payload.body || '',
    icon: '/mazdabuddy/android-chrome-192x192.png',
    badge: '/mazdabuddy/favicon-32x32.png',
    tag: payload.tag || 'autopulse',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    actions: payload.actions || [],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/mazdabuddy/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus existing window if open
      for (const client of list) {
        if (client.url.includes('/mazdabuddy/') && 'focus' in client) {
          if (url) client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
