const CACHE_NAME = 'coachfolio-v3.0';
// A lista de bagagem obrigatória (Ficheiros base e Ícones)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Timeout de rede: se a ligação não responder dentro deste prazo,
// serve a cache imediatamente em vez de deixar a app "encravada".
const NETWORK_TIMEOUT_MS = 2500;

self.addEventListener('install', (e) => {
  // Guarda imediatamente a lista obrigatória assim que instala a app
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );

  // IMPORTANTE: NÃO chamar self.skipWaiting() aqui.
  // A app fica à espera do clique no botão "Atualizar" do index.html
  // precisamente para não forçar um reload a meio de um jogo em curso.
  // (Se um dia quiseres skipWaiting automático, faz-o condicional a
  // currentTab !== 'jogo' no lado do index.html, nunca aqui sem condição.)
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
  if (e.request.method !== 'GET') return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  e.respondWith(
    fetch(e.request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        // Caching Dinâmico: Se houver net, guarda uma cópia na cache para usar offline
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
        return response;
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Se falhar ou exceder o timeout (rede fraca/offline), serve da cache
        return caches.match(e.request);
      })
  );
});
