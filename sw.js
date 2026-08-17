// Service Worker - Fight For Fast (FFF)
// Stratégie :
//  - App shell (HTML/manifest/icônes) : cache-first, mise à jour silencieuse en arrière-plan (stale-while-revalidate)
//  - Librairies CDN (three.js, GLTFLoader, OrbitControls) : cache-first, pour que le jeu se charge hors-ligne après une 1ère visite
//  - Modèles 3D .glb (GitHub raw) : cache-first, mis en cache dès qu'ils sont téléchargés une fois -> le garage reste utilisable hors-ligne

const CACHE_VERSION = 'fff-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

const RUNTIME_CACHE_HOSTS = [
  'raw.githubusercontent.com',   // permalinks GLB (personnage, véhicules, stuff)
  'cdnjs.cloudflare.com',        // three.js
  'cdn.jsdelivr.net'             // GLTFLoader / OrbitControls
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isRuntimeAsset = RUNTIME_CACHE_HOSTS.some((host) => url.hostname.includes(host));

  if (isRuntimeAsset) {
    // Cache-first : les .glb et libs CDN ne changent quasi jamais une fois publiés sur un commit précis
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // App shell : stale-while-revalidate (répond vite avec le cache, met à jour en tâche de fond)
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);

      return cached || network;
    })
  );
});
