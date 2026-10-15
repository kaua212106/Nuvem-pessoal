/* Cofre JSON - Service Worker
   Guarda em cache apenas os arquivos do próprio app, para abrir offline.
   Requisições para outros domínios (como api.github.com) passam direto,
   sem cache, para que o token e os dados nunca fiquem guardados aqui.
   Ao alterar os arquivos do app, mude a VERSAO para forçar a atualização. */

const VERSAO = 'cofre-json-v2-pasta2';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO && k !== 'cofre-share').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Compartilhar do celular: guarda os arquivos recebidos e abre o app
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const dados = await req.formData();
      const cache = await caches.open('cofre-share');
      let i = 0;
      for (const f of dados.getAll('arquivos')) {
        if (!(f instanceof File)) continue;
        await cache.put('/share/' + (i++) + '-' + Date.now(), new Response(f, {
          headers: { 'X-Name': encodeURIComponent(f.name), 'Content-Type': f.type || 'application/octet-stream' }
        }));
      }
      return Response.redirect(new URL('./index.html?share=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // Páginas: tenta a rede primeiro; sem internet, abre a última versão salva
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(VERSAO).then((c) => c.put('./index.html', copia));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Demais arquivos do app: usa o cache e atualiza quando houver rede
  e.respondWith(
    caches.match(req).then((salvo) =>
      salvo ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      })
    )
  );
});
