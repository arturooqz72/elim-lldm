"use client";

// Estado de instalación de las apps del sitio (Elim English en /ingles y
// Radio Elim en /escuchar), compartido entre el botón "Instalar app" y el
// registro del service worker. El aviso de instalación del navegador
// (beforeinstallprompt) llega una sola vez y puede llegar antes de que el
// botón se monte, así que se guarda aquí, junto con la sección donde llegó:
// el aviso instala la app del manifest de esa página, así que no se usa en
// otra sección (por ejemplo, al pasar de /ingles a /escuchar sin recargar).

/** Evento de Chrome/Android; no viene en los tipos del DOM de TypeScript. */
export interface AvisoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Plataforma = "ios" | "android" | "otro";

let aviso: AvisoInstalacion | null = null;
let seccionDelAviso = "";
let instalada = false;
let iniciado = false;
const oyentes = new Set<() => void>();

/** "/ingles/algo" → "/ingles". */
function seccion(ruta: string): string {
  return "/" + (ruta.split("/")[1] ?? "");
}

function avisar() {
  for (const fn of oyentes) fn();
}

/** La página está abierta como app instalada (no en una pestaña del navegador). */
export function abiertaComoApp(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function plataforma(): Plataforma {
  if (typeof navigator === "undefined") return "otro";
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac; se distingue porque tiene pantalla táctil.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "otro";
}

/** Empieza a escuchar el aviso de instalación (se llama una vez, en el cliente). */
export function iniciarInstalacion() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  instalada = abiertaComoApp();

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // se muestra con nuestro botón, no con la barra del navegador
    aviso = e as AvisoInstalacion;
    seccionDelAviso = seccion(location.pathname);
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    instalada = true;
    avisar();
  });
}

export function suscribirInstalacion(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

export function hayAvisoInstalacion(): boolean {
  return aviso !== null && seccionDelAviso === seccion(location.pathname);
}

export function estaInstalada(): boolean {
  return instalada;
}

/** Abre el aviso del navegador. Devuelve true si la persona aceptó. */
export async function pedirInstalacion(): Promise<boolean> {
  if (!aviso || !hayAvisoInstalacion()) return false;
  const actual = aviso;
  aviso = null; // el navegador solo deja usarlo una vez
  avisar();
  await actual.prompt();
  const { outcome } = await actual.userChoice;
  if (outcome === "accepted") {
    instalada = true;
    avisar();
  }
  return outcome === "accepted";
}
