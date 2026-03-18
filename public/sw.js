self.addEventListener('push', (event) => {
  const fallback = { title: 'MYLI', body: 'You have a new notification.', url: '/dashboard' };
  let data = fallback;

  try {
    data = event.data ? event.data.json() : fallback;
  } catch {
    data = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || fallback.title, {
      body: data.body || fallback.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
