"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, LogIn, LogOut, ChevronDown, UserCircle, ShieldCheck, MessageCircle, CalendarCheck } from "lucide-react";
import { createClient, createFreshClient } from "@/lib/supabase/client";
import { LiveBadge } from "./LiveBadge";
import { EtiquetaMantenimiento, NavEscritorio } from "./NavEscritorio";
import { NAV_LINKS, esActivo } from "./navLinks";
import { usePresenciaSitio } from "./usePresenciaSitio";
import { useRegistrarVisita } from "./useRegistrarVisita";
import { InvitacionJuego } from "./InvitacionJuego";
import { whatsappHref } from "@/lib/whatsapp";
import type { Profile } from "@/types";

// Verde de marca de WhatsApp — a propósito distinto del dorado del resto
// del menú, para que se reconozca de un vistazo como "esto abre WhatsApp"
// y no como una sección más del sitio.
const WHATSAPP_GREEN = "#25D366";

export function PublicHeader({
  initialProfile,
  enMantenimiento = [],
}: {
  initialProfile: Profile | null;
  /** hrefs de secciones en mantenimiento (ELIM_IA_MAINTENANCE, ARCHIVO_MAINTENANCE). */
  enMantenimiento?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
      } else if (session?.user) {
        const userId = session.user.id;
        // Fuera del callback: un await a Supabase aquí dentro deja trabado el
        // cliente (lock de auth) y todas sus consultas posteriores se quedan
        // colgadas — ver docs de onAuthStateChange.
        setTimeout(async () => {
          const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
          if (data) setProfile(data as Profile);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Presencia global en "presence:site": la leen /juegos/jugadores (quién de
  // la lista de invitación está conectado) y /admin/en-linea (todos los que
  // están en el sitio ahora mismo y en qué página).
  usePresenciaSitio(profile?.id ?? null, pathname);
  // Historial persistente de visitas (/admin/historial), 90 días.
  useRegistrarVisita(profile?.id ?? null, pathname);

  async function handleSignOut() {
    const supabase = createFreshClient();
    await supabase.auth.signOut();
    setProfile(null);
    setUserMenuOpen(false);
    router.refresh();
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 backdrop-blur-sm"
        style={{
          background: "rgba(10,10,18,0.85)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="max-w-7xl 2xl:max-w-[96rem] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span
              className="text-xl font-bold tracking-widest"
              style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
            >
              Elim LLDM
            </span>
          </Link>

          {/* Desktop Nav — enlaces principales + "Más ▾" (ver navLinks.ts). */}
          <NavEscritorio pathname={pathname} enMantenimiento={enMantenimiento} />

          {/* Auth */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Ícono solo, sin texto, a propósito: como link de texto dentro
                del <nav> de arriba empujaba el contenido más allá de los
                1280px del contenedor y cortaba "Iniciar sesión" a la derecha
                en pantallas de escritorio comunes (1280-1440px). */}
            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              title="Escríbenos por WhatsApp"
              className="hidden md:flex items-center justify-center w-9 h-9 shrink-0 rounded-lg transition-all duration-200"
              style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)" }}
            >
              <MessageCircle size={16} style={{ color: WHATSAPP_GREEN }} />
            </a>

            {profile?.role === "admin" && (
              <Link
                href="/admin"
                title="Panel Admin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200"
                style={{
                  background: "rgba(212,160,23,0.12)",
                  border: "1px solid rgba(212,160,23,0.35)",
                  color: "var(--color-primary)",
                }}
              >
                <ShieldCheck size={15} />
                {/* Solo ícono entre sm y 2xl para que el menú de escritorio quepa. */}
                <span className="sm:inline xl:hidden 2xl:inline">Panel Admin</span>
              </Link>
            )}

            {profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "var(--color-primary)", color: "#000" }}
                    >
                      {profile.display_name[0]}
                    </div>
                  )}
                  <span className="hidden sm:block max-w-24 truncate">{profile.display_name}</span>
                  <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-xl py-1 z-50"
                    style={{
                      background: "var(--color-surface-elevated)",
                      border: "1px solid var(--color-border)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    }}
                  >
                    <Link
                      href="/perfil"
                      className="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--color-text)" }}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserCircle size={14} />
                      Mi perfil
                    </Link>
                    <div
                      className="mx-3 my-1 h-px"
                      style={{ background: "var(--color-border)" }}
                    />
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <LogOut size={14} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{ background: "var(--color-primary)", color: "#000" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(212,160,23,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <LogIn size={15} />
                {/* "Entrar" en móvil angosto (<640px) — con el botón "Menú"
                    ahora con texto al lado, "Iniciar sesión" completo ya no
                    cabía en una sola línea en anchos como 390px y se partía
                    en dos. */}
                <span className="hidden sm:inline">Iniciar sesión</span>
                <span className="sm:hidden">Entrar</span>
              </Link>
            )}

            {/* Mobile menu toggle — con la palabra "Menú" a propósito: solo el
                ícono de rayitas confundía a algunas personas, que no sabían
                que ahí se abría la navegación. */}
            <button
              className="xl:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              {mobileOpen ? "Cerrar" : "Menú"}
            </button>
          </div>
        </div>

        {/* Mobile Nav — fondo SÓLIDO a propósito, no el translúcido del
            <header> (rgba(...,0.85) + blur, pensado para verse bien encima
            del hero de la landing). Si el menú se abre estando ya con mucho
            scroll (ej. hasta el pie de página), ese fondo semitransparente
            dejaba ver el contenido de abajo como un "fantasma" mezclado con
            las opciones, volviéndolas difíciles de leer. */}
        {mobileOpen && (
          <div
            className="xl:hidden px-4 pb-4 flex flex-col gap-1"
            style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" }}
          >
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = esActivo(pathname, href);
              const isSaludo = href === "/saludo";
              return (
                <div key={href} className="flex items-center gap-2">
                  <Link
                    href={href}
                    className="flex-1 flex items-center gap-3 px-3 py-3 rounded-lg text-sm"
                    style={{
                      color: isSaludo || active ? "var(--color-primary)" : "var(--color-text)",
                      background: active ? "rgba(212,160,23,0.1)" : "transparent",
                      fontWeight: isSaludo ? 700 : 500,
                      textShadow: isSaludo ? "0 0 14px rgba(212,160,23,0.55)" : "none",
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={18} />
                    {label}
                    {enMantenimiento.includes(href) && <EtiquetaMantenimiento />}
                  </Link>
                  {href === "/platikas" && <LiveBadge className="mr-3" />}
                  {href === "/juegos" && (
                    // Acceso directo al reto diario solo en el menú móvil: en el
                    // de escritorio no cabe otro enlace (ver nota del ícono de
                    // WhatsApp) y ahí ya está destacado al tope de /juegos.
                    <Link
                      href="/juegos/palabra"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 mr-1 rounded-full text-[11px] font-bold shrink-0"
                      style={{ background: "rgba(212,160,23,0.15)", color: "var(--color-primary)" }}
                      onClick={() => setMobileOpen(false)}
                    >
                      <CalendarCheck size={13} />
                      Reto diario
                    </Link>
                  )}
                </div>
              );
            })}

            <a
              href={whatsappHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium"
              style={{ color: WHATSAPP_GREEN }}
              onClick={() => setMobileOpen(false)}
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>

            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium"
                style={{ color: "var(--color-primary)", background: "rgba(212,160,23,0.1)" }}
                onClick={() => setMobileOpen(false)}
              >
                <ShieldCheck size={18} />
                Panel Admin
              </Link>
            )}
          </div>
        )}
      </header>
      {/* Fuera del header: su backdrop-blur haría que un hijo "fixed" se
          posicione respecto al header y no a la pantalla. */}
      <InvitacionJuego profileId={profile?.id ?? null} />
    </>
  );
}
