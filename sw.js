const CACHE_NAME = 'purple-line-v20';

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
// MESSAGE
// ========================================

self.addEventListener('message', event => {
  if (
    event.data &&
    event.data.type === 'SKIP_WAITING'
  ) {
    self.skipWaiting();
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
