self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch (_) {}
  const notification = payload.notification || payload;
  event.waitUntil(self.registration.showNotification(notification.title || 'LingoLoop', {
    body: notification.body || 'You have a new update.',
    icon: notification.icon || '/assets/github-avatar.png',
    badge: '/assets/github-avatar.png',
    data: payload.data || {}
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/#rooms'));
});
