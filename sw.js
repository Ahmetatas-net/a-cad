/* A-CAD çevrimdışı önbellek. users.json her zaman ağdan (hesap denetimi). */
const V = "acad-695a6cc880"; const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-mask.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => { const u = new URL(e.request.url); if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (/users\.json$/.test(u.pathname)) return; /* ağdan; çevrimdışıysa uygulama son doğrulanmış kopyayı kullanır */
  if (e.request.mode === "navigate") { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put("index.html", c)); return r; }).catch(() => caches.match("index.html"))); return; }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
