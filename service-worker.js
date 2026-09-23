// FILE_VERSION: sw-v2
// Service worker для Web Push — обязателен, чтобы уведомления приходили,
// даже когда сама страница закрыта. Держится "живым" в фоне у браузера.

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'Клуб «Ты Боженька Продаж»';
  const options = {
    body: data.body || '',
    icon: 'images/icon-192.png',
    badge: 'images/icon-192.png',
    data: { url: data.url || './' },
  };

  // Значок с числом на иконке приложения (Badging API). Число считает СЕРВЕР и
  // присылает в badge_count — сам service worker своего состояния не имеет.
  // Если числа нет, значок не трогаем: у обычных рассылок его смысл неочевиден,
  // а на Android система и так рисует точку при непрочитанном уведомлении.
  const tasks = [self.registration.showNotification(title, options)];
  if (typeof data.badge_count === 'number' && self.navigator && self.navigator.setAppBadge) {
    tasks.push(
      data.badge_count > 0
        ? self.navigator.setAppBadge(data.badge_count).catch(() => {})
        : self.navigator.clearAppBadge().catch(() => {})
    );
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';

  // Человек отреагировал — гасим значок. Настоящее число апп пересчитает сам,
  // когда откроется и увидит, сколько паков реально осталось нераскрытыми.
  if (self.navigator && self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // ⚠️ sw-v2 (23.09.2026): ПУШ С МАРШРУТОМ ВЕДЁТ ПО МАРШРУТУ. Раньше открытое
      // в фоне приложение просто выводилось вперёд, и адрес из пуша терялся:
      // «Продолжить оплату» приводила туда, где человек был. Если в адресе есть
      // `startapp=` — перезагружаем окно на этот адрес (апп разберёт маршрут
      // при запуске, как из Telegram). Без маршрута (пуш про пак и т.п.) —
      // как раньше, только выводим окно вперёд, без перезагрузки
      const withRoute = url.indexOf('startapp=') !== -1;
      for (const client of clientList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          if (withRoute && 'navigate' in client) {
            return client.navigate(url)
              .then((c) => (c || client).focus())
              .catch(() => client.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
