const CACHE_NAME = 'purple-line-v22.5';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',

  './break-start.m4a',
  './break-end.m4a',

  './pinkie1-start.m4a',
  './pinkie1-end.m4a',

  './pinkie2-start.m4a',
  './pinkie2-end.m4a',

  './rainbow-start.m4a',
  './rainbow-end.m4a',

  './gumball-start.m4a',
  './gumball-end.m4a',

  './makoto-start.m4a',
  './makoto-end.m4a',

  './darwin-start.m4a',
  './darwin-end.m4a',

  './neuvillette-start.m4a',
  './neuvillette-end.m4a',

  './alastor-start.m4a',
  './alastor-end.m4a',

  './paimon-start.m4a',
  './paimon-end.m4a',

  './durin-start.m4a',
  './durin-end.m4a',

  './furina-start.m4a',
  './furina-end.m4a',

  './columbina-flins-start.m4a',
'./columbina-flins-end.m4a',
];

// ========================================
// INSTALL
// ========================================

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          ASSETS.map(url =>
            cache.add(url).catch(error => {
              console.warn(
                '[Purple Line SW] Failed to cache:',
                url,
                error
              );
            })
          )
        );
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// ========================================
// ACTIVATE
// ========================================

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// ========================================
// SCHEDULED NOTIFICATIONS (background alert
// when the timer ends with the screen locked)
// ========================================
//
// The page's own timer keeps real elapsed time correctly with Date.now(),
// but once the screen locks, the OS fully suspends the page's JS — no
// setTimeout/setInterval in the page can fire a sound at the right moment
// anymore. That's the actual cause of "works sometimes, not always" and
// "silent when phone is locked".
//
// The fix: ask the Service Worker to schedule a real system notification
// with a TimestampTrigger for the exact moment the phase should end. Chrome
// on Android fires these even while the browser itself is fully closed or
// the screen is locked, because the OS (not the page's JS) owns the timer.
// A notification can't play our custom .m4a voice file directly, but it can
// vibrate + play the phone's default notification sound, which reliably
// wakes the screen/gets attention at the right second. The moment the
// person taps the notification (or reopens the app), the app is alive again
// and plays the *actual* recorded voice line immediately.

const TRIGGER_SUPPORTED = (() => {
  try { return 'showTrigger' in Notification.prototype; } catch (e) { return false; }
})();

async function cancelScheduled(tag) {
  try {
    const existing = await self.registration.getNotifications({ tag, includeTriggered: true });
    existing.forEach(n => n.close());
  } catch (e) { /* ignore */ }
}

async function scheduleNotification(tag, title, body, timestamp) {
  await cancelScheduled(tag);
  if (timestamp <= Date.now()) return; // already in the past, nothing to schedule
  try {
    const options = {
      tag,
      body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      requireInteraction: false,
      data: { url: './' }
    };
    if (TRIGGER_SUPPORTED) {
      options.showTrigger = new TimestampTrigger(timestamp);
      await self.registration.showNotification(title, options);
    } else {
      // Fallback for browsers without trigger support: fire immediately if
      // this message happens to arrive close to the target time (e.g. sent
      // right as the phase ends while the SW happens to be awake). This is
      // best-effort only — it cannot guarantee a locked-screen alert.
      const delay = timestamp - Date.now();
      if (delay <= 5000) {
        await self.registration.showNotification(title, options);
      }
    }
  } catch (e) {
    console.warn('[Purple Line SW] scheduleNotification failed:', e);
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) { await client.focus(); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow('./');
  })());
});

// ========================================
// MESSAGE
// ========================================

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'SCHEDULE_PHASE_NOTIFICATION') {
    const { tag, title, body, timestamp } = event.data;
    event.waitUntil(scheduleNotification(tag, title, body, timestamp));
    return;
  }

  if (event.data.type === 'CANCEL_PHASE_NOTIFICATION') {
    const { tag } = event.data;
    event.waitUntil(cancelScheduled(tag));
    return;
  }
});

// ========================================
// FETCH
// ========================================

self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);

  const isAppShell =
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/manifest.json');

  // ========================================
  // APP SHELL
  // NETWORK FIRST
  // ========================================

  if (isAppShell) {

    event.respondWith(
      fetch(request, {
        cache: 'no-store'
      })
      .then(response => {

        if (response && response.ok) {

          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, copy);
            });
        }

        return response;
      })
      .catch(() => {

        return caches.match(request)
          .then(cached => {

            if (cached) {
              return cached;
            }

            return caches.match('./index.html');
          });
      })
    );

    return;
  }

  // ========================================
  // STATIC FILES / AUDIO
  // CACHE FIRST
  // ========================================

  event.respondWith(

    caches.match(request)
      .then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {

            if (
              response &&
              response.ok
            ) {

              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => {

                  cache.put(
                    request,
                    copy
                  );

                });
            }

            return response;
          });

      })

  );

});
