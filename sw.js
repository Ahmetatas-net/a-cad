/* A-CAD çevrimdışı önbellek. users.json her zaman ağdan (hesap denetimi). */
const V = "kam-cks-kontrol-20261125"; const CORE = ["index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-mask.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => { const u = new URL(e.request.url); if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (/users\.json$/.test(u.pathname)) return; /* ağdan; çevrimdışıysa uygulama son doğrulanmış kopyayı kullanır */
  const shell = new URL("index.html", self.registration.scope).href;
  if (e.request.mode === "navigate" && (u.pathname === new URL(shell).pathname || u.pathname === new URL("./", shell).pathname)) {
    const cache = caches.open(V);
    const network = fetch(e.request);
    e.waitUntil(network.then(async response => {
      if (!response.ok || response.redirected) return;
      const copy = response.clone();
      const store = await cache;
      const previous = await store.match(shell);
      const tag = response.headers.get("ETag");
      if (previous && tag && previous.headers.get("ETag") === tag) {
        copy.body?.cancel();
        return;
      }
      await store.put(shell, copy);
    }).catch(() => {}));
    e.respondWith(network.catch(() => cache.then(store => store.match(shell))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
