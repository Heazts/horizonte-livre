const CACHE_PREFIX = 'horizonte-livre-shell-';
const CACHE = CACHE_PREFIX + 'v5';
const base = new URL(self.registration.scope);
const index = new URL('index.html', base);
const catalog = new URL('catalogo.json?v=5', base);
const assets = new Set(['styles.css?v=5', 'app.js?v=5', 'icone.svg']
  .map((path) => new URL(path, base).href));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const requests = [index.href, catalog.href, ...assets]
      .map((url) => new Request(url, { cache: 'reload' }));
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function fromNetwork(request, offlineUrl, saveOnlineResponse = false) {
  let response;
  try {
    response = await fetch(request, { cache: 'no-cache' });
  } catch {
    // Sem rede, use a cópia associada a esta versão da interface.
  }
  if (response?.ok) {
    if (saveOnlineResponse) {
      try {
        const cache = await caches.open(CACHE);
        await cache.put(offlineUrl, response.clone());
      } catch {
        // A resposta da rede continua utilizável se o armazenamento falhar.
      }
    }
    return response;
  }
  if (response && response.status < 500) return response;
  const cache = await caches.open(CACHE);
  return await cache.match(offlineUrl) ?? response ?? Response.error();
}

async function fromShell(request) {
  const cache = await caches.open(CACHE);
  return await cache.match(request) ?? fetch(request);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== base.origin) return;
  if (event.request.mode === 'navigate' && [base.pathname, index.pathname].includes(url.pathname)) {
    // A página online vem da rede. O HTML offline permanece com os arquivos
    // da mesma versão, mesmo que uma nova publicação esteja em andamento.
    event.respondWith(fromNetwork(event.request, index.href));
  } else if (url.href === catalog.href) {
    event.respondWith(fromNetwork(event.request, catalog.href, true));
  } else if (assets.has(url.href)) {
    event.respondWith(fromShell(event.request));
  }
});
