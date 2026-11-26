// Sago Loco POS offline helper: keeps the app itself on the tablet so it opens without internet.
// Sales data never goes through here; the app saves it on the tablet and syncs it to the database.
const CACHE = 'slpos-v4';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', LIB])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;
  if (u.origin === location.origin && u.pathname.startsWith('/hq')) return;   // HQ page is online-only; never cache it over the POS
  if (req.mode === 'navigate') {
    // newest app when online, the saved copy when offline
    // speed on weak store Wi-Fi: if the newest app hasn't arrived in 1.5 s, open the saved copy now;
    // the download keeps going and is saved, so the next open has it
    const net = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); } return r; });
    const slow = new Promise(res => setTimeout(res, 1500)).then(() => caches.match('./'));
    e.respondWith(Promise.race([net.catch(() => caches.match('./')), slow.then(hit => hit || net)])
      .then(r => r || net));
    return;
  }
  const keep = u.origin === location.origin || ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname);
  if (!keep) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
