// src/components/admin/secciones-sitio.ts

// Prefijo de ruta → nombre de la sección, para /admin/en-linea. Se usa el
// prefijo más largo que coincida (/juegos/palabra antes que /juegos).
const SECCIONES: Array<[string, string]> = [
  ["/juegos/palabra", "Palabra del Día"],
  ["/juegos/ahorcado", "Ahorcado"],
  ["/juegos/jugadores", "Lista de jugadores"],
  ["/juegos", "Juegos"],
  ["/arena-abierta", "Trivia en línea"],
  ["/arena", "Elim Arena"],
  ["/ruleta", "La Ruleta"],
  ["/trivia", "Trivia"],
  ["/tiktok-trivia", "Trivia TikTok"],
  ["/radio", "Radio"],
  ["/saludo-directo", "Saludo Directo"],
  ["/saludo", "Saludos"],
  ["/platikas", "Estudio en Vivo"],
  ["/archivo", "Archivo"],
  ["/elimplay", "ElimPlay"],
  ["/videos", "Videos"],
  ["/elim-ia", "Elim IA"],
  ["/opiniones", "Opiniones"],
  ["/contacto", "Contáctanos"],
  ["/perfil", "Perfil"],
  ["/login", "Iniciando sesión"],
];

export function nombreSeccion(ruta: string | undefined): string {
  if (!ruta) return "Sitio";
  if (ruta === "/") return "Inicio";
  const encontrada = SECCIONES.filter(([prefijo]) => ruta === prefijo || ruta.startsWith(prefijo + "/")).sort(
    (a, b) => b[0].length - a[0].length
  )[0];
  return encontrada ? encontrada[1] : ruta;
}
