// sw.js · solo cachea fotos de productos de Google Drive (cache-first, máx. 150). No toca la app, Supabase ni nada más.
const VERSION = "v30"; // subir en cada publicación
const CACHE = "dl-fotos-" + VERSION;
const MAX = 150;
const isPhoto = (u) => /^https:\/\/(drive\.google\.com\/(thumbnail|uc)|lh3\.googleusercontent\.com\/)/.test(u);
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("dl-fotos-") && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
async function trim(cache) { const keys = await cache.keys(); for (let i = 0; i < keys.length - MAX; i += 1) await cache.delete(keys[i]); }
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !isPhoto(req.url)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req.url);
    if (hit) return hit;
    const res = await fetch(req.url, { mode: "no-cors", credentials: "omit" });
    // opaque (status 0) o 200: se guarda; un error de red no se guarda para que el respaldo de la página actúe
    if (res && (res.ok || res.type === "opaque")) { cache.put(req.url, res.clone()).then(() => trim(cache)).catch(() => {}); }
    return res;
  })().catch(() => fetch(req)));
});
