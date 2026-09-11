// Ensures a re-opened installed app always checks the network for the
// current index.html instead of running a stale cached copy forever —
// without this, an "Add to Home Screen" app can keep re-launching an old
// build indefinitely. Static assets (JS/CSS) are safe to leave alone since
// Vite gives each build's files a new content-hashed filename already.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
  }
});
