/*
 * Mi Garaje IA — service worker: permite abrir la app sin conexión.
 * Estrategia «red primero»: si hay conexión se usa siempre la versión más reciente
 * y se guarda una copia; si no la hay, se sirve la copia. No intercepta peticiones a otros dominios.
 */
var CACHE = 'mi-garaje-ia-v1.0.0';
var ARCHIVOS = [
  './', 'index.html', 'css/estilos.css', 'manifest.webmanifest',
  'js/calculos.js', 'js/almacen.js', 'js/iconos.js', 'js/graficos.js', 'js/demo.js', 'js/app.js',
  'iconos/icono.svg', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/icono-maskable-512.png', 'iconos/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (claves) {
    return Promise.all(claves.filter(function (k) { return k.indexOf('mi-garaje-ia-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp && resp.ok && resp.type === 'basic') {
        var copia = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return resp;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) {
        return r || (req.mode === 'navigate' ? caches.match('index.html') : undefined);
      });
    })
  );
});
