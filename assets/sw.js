// Panorama Super App - Service Worker (Optimized for Instant Updates)
const CACHE_VERSION = '2026.09.22.v2';
const CACHE_STATIC = `panorama-static-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `panorama-dynamic-${CACHE_VERSION}`;

// Precache hanya aset inti shell UI
const SHELL_ASSETS = [
  './',
  'index.php',
  'manifest.json',
  'favicon.svg',
  'assets/icons/favicon.png',
  'assets/icons/logo.png',
  'assets/icons/pwa-192x192.png',
  'assets/icons/pwa-512x512.png'
];

// 1. Install: Precache shell & langsung aktifkan tanpa menunggu tab lama ditutup
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW Precache Warning]', err);
      });
    })
  );
});

// 2. Activate: Hapus cache versi lama secara otomatis
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_STATIC && key !== CACHE_DYNAMIC) {
            console.log('[SW] Membersihkan cache versi lama:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Abaikan request non-GET atau protokol browser extension
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // API Requests: Selalu Network-Only (tidak pernah di-cache)
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({ 
          error: 'Jaringan offline atau server tidak dapat dihubungi.',
          offline: true 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Navigasi Halaman Utama (HTML): Network-First dengan Fallback ke Cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_STATIC).then((c) => c.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match('index.php') || caches.match('./'))
    );
    return;
  }

  // Skrip JS & File CSS: STRATEGI NETWORK-FIRST
  // Memastikan perubahan kode langsung aktif begitu halaman di-refresh saat online!
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_DYNAMIC).then((c) => c.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Aset Statis Lainnya (Gambar, Ikon, Font): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_DYNAMIC).then((c) => c.put(req, clone));
        }
        return networkRes;
      }).catch(() => {
        // Biarkan silent jika offline
      });

      return cachedRes || fetchPromise;
    })
  );
});

// 4. Message Handler untuk paksa update jika diperintahkan dari UI
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
