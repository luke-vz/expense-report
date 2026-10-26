// Service worker: lets the installed app open without a connection.
// - Pages: network first (always fresh when online), cached copy when offline. Offline, a
//   page never visited falls back to the quick entry screen.
// - /_next/static (hashed, immutable) and icons: cache first.
// - API calls are never cached: saving offline goes through the IndexedDB queue
//   (lib/pendingQueue.ts), not through here.
// Bump VERSION to drop old caches.
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const FALLBACK = "/quick";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

// Caches a page and the static files its HTML points to, so it also works offline when
// it was never opened (its JS and CSS chunks weren't loaded yet)
async function cachePage(path) {
  try {
    const response = await fetch(path);
    // Never cache the login redirect as if it were the page
    if (!response.ok || response.redirected) return;
    const html = await response.clone().text();
    await (await caches.open(PAGES)).put(path, response);
    const assets = await caches.open(ASSETS);
    const urls = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
    await Promise.all([...urls].map((url) => assets.match(url).then((hit) => hit || assets.add(url).catch(() => {}))));
  } catch {
    // offline: nothing to refresh
  }
}

// The first visit loads before this worker is in control: the page sends the static files
// it already loaded and its own path. The quick entry screen is always kept, since it's
// the offline fallback.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-assets" || !Array.isArray(event.data.urls)) return;
  const pages = [...new Set([FALLBACK, event.data.page].filter(Boolean))];
  event.waitUntil(
    Promise.all([
      caches.open(ASSETS).then((cache) =>
        Promise.all(event.data.urls.map((url) => cache.match(url).then((hit) => hit || cache.add(url).catch(() => {}))))
      ),
      ...pages.map(cachePage),
    ])
  );
});

const isAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const response = await fetch(request);
          if (response.ok && !response.redirected) cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match(FALLBACK)) || Response.error();
        }
      })()
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })()
    );
  }
});
