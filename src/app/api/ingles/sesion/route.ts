import { NextResponse, type NextRequest } from "next/server";

/** Lo mismo que usa @supabase/ssr por defecto (el máximo que aceptan los navegadores). */
const CUATROCIENTOS_DIAS = 400 * 24 * 60 * 60;
/** sb-<proyecto>-auth-token y sus pedazos (.0, .1, ...). */
const COOKIE_SESION = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/;

// Mantiene viva la sesión de la app instalada. Cuando el navegador renueva la
// sesión por su cuenta, escribe las cookies desde JavaScript, y Safari las
// limita a 7 días: quien no abre la app en una semana tendría que volver a
// entrar. Esta ruta vuelve a mandar las MISMAS cookies (no crea ni cambia la
// sesión) desde el servidor, con la duración normal de 400 días. No son
// httpOnly porque el cliente de Supabase del navegador necesita leerlas.
export async function POST(request: NextRequest) {
  const sesion = request.cookies.getAll().filter((c) => COOKIE_SESION.test(c.name));
  const res = NextResponse.json({ ok: true, renovadas: sesion.length });
  for (const { name, value } of sesion) {
    res.cookies.set(name, value, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      maxAge: CUATROCIENTOS_DIAS,
    });
  }
  return res;
}
