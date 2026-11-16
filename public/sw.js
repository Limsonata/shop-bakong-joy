/* BillieGrace Closet service worker.
 * - Pages: network first, falling back to the last cached copy, then /offline.html
 * - Hashed build assets and icons: cache first (they never change for a given URL)
 * - Everything else (API calls, server functions, Supabase, non-GET): untouched, never cached
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/Billie.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_serverFn")) return;
  // Order data and the back office must always be live.
  if (url.pathname.startsWith("/admin")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/offline.html")),
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpe?g|webp|svg|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
