/**
 * NEXUS Service Worker — Web Push Notifications
 * Minimal: push reception + notification click handling
 * Pas de cache offline (ce n'est pas un full PWA)
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'NEXUS',
      body: event.data.text(),
    };
  }

  const { title = 'NEXUS', body = '', icon, badge, data = {} } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/vite.svg',
      badge: badge || '/vite.svg',
      data,
      tag: data.id || 'nexus-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if found
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(link);
    })
  );
});
