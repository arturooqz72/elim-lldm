// public/ingles-sw.js
// Service worker de la app instalable de Elim English. Se registra con
// scope "/ingles" desde las páginas de /ingles (por eso vive en la raíz: un
// archivo dentro de /ingles/ no podría controlar la ruta "/ingles" misma).
// El service worker del resto del sitio (/sw.js, notificaciones push) sigue
// igual; en /ingles manda este porque su scope es más específico.
//
// Reglas:
// - Nada de /api/ pasa por aquí: el chat, la pronunciación y la prueba
//   siempre van directo a la red.
// - Las páginas (navegaciones) y los datos de Next (RSC) van siempre a la
//   red y nunca se guardan: traen la conversación del usuario. Sin conexión,
//   las navegaciones muestran /ingles/offline.html.
// - Solo los archivos estáticos con versión (/_next/static/, íconos,
//   fuentes) se guardan, para que la app abra rápido.

const VERSION = "v1";
const CACHE_OFFLINE = `elim-ingles-offline-${VERSION}`;
const CACHE_ESTATICOS = `elim-ingles-estaticos-${VERSION}`;
const PAGINA_OFFLINE = "/ingles/offline.html";
const PRECARGA = [
  PAGINA_OFFLINE,
  "/ingles/manifest.webmanifest",
  "/ingles/icons/icon-192.png",
  "/ingles/icons/icon-512.png",
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
          .filter((k) => k.startsWith("elim-ingles-") && k !== CACHE_OFFLINE && k !== CACHE_ESTATICOS)
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
    new Response("<h1>Necesitas conexión para practicar con tu tutora</h1>", {
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
    url.pathname.startsWith("/ingles/icons/") ||
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

// ── Recordatorio diario (Web Push) ──────────────────────────────────────────
// El servidor manda { title, body, url }. Al tocarla se abre (o se enfoca)
// la app en esa dirección: /ingles?aviso=<id> deja contar que la abrió.

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(datos.title || "Elim English", {
      body: datos.body || "Tu reto de inglés de hoy te espera 📖",
      icon: "/ingles/icons/icon-192.png",
      badge: "/ingles/icons/icon-192.png",
      tag: "elim-english-recordatorio",
      data: { url: datos.url || "/ingles" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/ingles", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = abiertas.find((c) => new URL(c.url).pathname.startsWith("/ingles"));
      if (app) {
        await app.focus();
        return app.navigate(destino);
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
