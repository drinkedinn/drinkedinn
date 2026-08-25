// client/public/sw.js
// Minimal service worker for Web Push. Served from the site root (/sw.js).
// If you already have a PWA service worker, merge these two listeners into it.

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* noop */ }
  const title = data.title || 'DrinkedInn';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && 'focus' in w) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});
