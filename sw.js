const CACHE_NAME = 'coachfolio-v2.8.1a';

// A lista de bagagem obrigatória (Ficheiros base e Ícones)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  // Guarda imediatamente a lista obrigatória assim que instala a app
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  
  // Retiramos o skipWaiting automático para a app não reiniciar a meio de um jogo.
  // Agora vai esperar pelo clique no botão "Atualizar" do index.html.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fica à escuta da mensagem do botão "Atualizar" do index.html
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Caching Dinâmico: Se houver net, guarda uma cópia na cache para usar offline
        if (e.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, clone);
            });
        }
        return response;
      })
      .catch(() => caches.match(e.request)) // Se falhar (offline), serve da cache
  );
});
