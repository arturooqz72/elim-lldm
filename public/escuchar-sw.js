// public/escuchar-sw.js
// Service worker de la app instalable de Radio Elim. Se registra con scope
// "/escuchar" desde /escuchar (por eso vive en la raíz: un archivo dentro de
// /escuchar/ no podría controlar la ruta "/escuchar" misma). El service
// worker del resto del sitio (/sw.js) y el de Elim English (/ingles-sw.js)
// siguen igual; en /escuchar manda este porque su scope es más específico.
//
// Reglas:
// - El audio y los datos de "lo que suena ahora" vienen de
//   radio.elimlldm.net (otro dominio): nunca pasan por aquí.
// - Nada de /api/ pasa por aquí.
// - La página (navegación) y los datos de Next (RSC) van siempre a la red y
//   nunca se guardan. Sin conexión, la navegación muestra
//   /escuchar/offline.html.
// - Solo los archivos estáticos con versión (/_next/static/, íconos,
//   fuentes) se guardan, para que la app abra rápido.

const VERSION = "v1";
const CACHE_OFFLINE = `elim-radio-offline-${VERSION}`;
const CACHE_ESTATICOS = `elim-radio-estaticos-${VERSION}`;
const PAGINA_OFFLINE = "/escuchar/offline.html";
const PRECARGA = [
  PAGINA_OFFLINE,
  "/escuchar/manifest.webmanifest",
  "/escuchar/icons/icon-192.png",
  "/escuchar/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_OFFLINE)
      .then((cache) => cache.addAll(PRECARGA.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Solo borra versiones viejas de ESTE service worker.
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter((k) => k.startsWith("elim-radio-") && k !== CACHE_OFFLINE && k !== CACHE_ESTATICOS)
          .map((k) => caches.delete(k)),
      );
      // Precarga de navegación: la página empieza a bajar mientras arranca
      // el service worker (la app abre más rápido).
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

async function paginaOffline() {
  const cache = await caches.open(CACHE_OFFLINE);
  const guardada = await cache.match(PAGINA_OFFLINE);
  return (
    guardada ||
    new Response("<h1>Necesitas conexión para escuchar la radio</h1>", {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  );
}

async function navegar(event) {
  try {
    const precargada = await event.preloadResponse;
    if (precargada) return precargada;
    return await fetch(event.request);
  } catch {
    return paginaOffline();
  }
}

function esEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/escuchar/icons/") ||
    /\.(woff2?|png|svg|ico|webp)$/.test(url.pathname)
  );
}

async function estatico(request) {
  const cache = await caches.open(CACHE_ESTATICOS);
  const guardado = await cache.match(request);
  if (guardado) return guardado;
  const respuesta = await fetch(request);
  if (respuesta.ok && respuesta.type === "basic") await cache.put(request, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navegar(event));
    return;
  }

  // Datos de Next (RSC): siempre a la red, nunca a la caché.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (esEstatico(url)) event.respondWith(estatico(request));
});
