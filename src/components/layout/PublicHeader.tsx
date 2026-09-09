"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, Fragment } from "react";
import { Menu, X, Radio, Mic, Gamepad2, Archive, Music, Video, Bot, LogIn, LogOut, ChevronDown, UserCircle, ShieldCheck, Mail, AudioLines, MessageSquareText, MessageCircle } from "lucide-react";
import { createClient, createFreshClient } from "@/lib/supabase/client";
import { LiveBadge } from "./LiveBadge";
import { whatsappHref } from "@/lib/whatsapp";
import type { Profile } from "@/types";

// Verde de marca de WhatsApp — a propósito distinto del dorado del resto
// del menú, para que se reconozca de un vistazo como "esto abre WhatsApp"
// y no como una sección más del sitio.
const WHATSAPP_GREEN = "#25D366";

const NAV_LINKS = [
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/saludo", label: "Saludos", icon: AudioLines },
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos en línea", icon: Gamepad2 },
  { href: "/archivo", label: "Archivo", icon: Archive },
  { href: "/elimplay", label: "ElimPlay", icon: Music },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/opiniones", label: "Opiniones", icon: MessageSquareText },
  { href: "/contacto", label: "Contáctanos", icon: Mail },
];

export function PublicHeader({ initialProfile }: { initialProfile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
      } else if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) setProfile(data as Profile);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Presencia global: mientras haya sesión iniciada en cualquier pestaña con
  // este layout montado, se marca "en línea" en un canal compartido — lo lee
  // /juegos/jugadores para mostrar quién de la lista de invitación está
  // conectado ahora mismo, además de quién simplemente se registró.
  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const channel = supabase.channel("presence:site", {
      config: { presence: { key: profile.id } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ online_at: new Date().toISOString() });
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  async function handleSignOut() {
    const supabase = createFreshClient();
    await supabase.auth.signOut();
    setProfile(null);
    setUserMenuOpen(false);
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-sm"
      style={{
        background: "rgba(10,10,18,0.85)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span
            className="text-xl font-bold tracking-widest"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim LLDM
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            const isSaludo = href === "/saludo";
            return (
              <Fragment key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200"
                  style={{
                    color: isSaludo || active ? "var(--color-primary)" : "var(--color-text-muted)",
                    background: active ? "rgba(212,160,23,0.1)" : "transparent",
                    fontWeight: isSaludo ? 700 : 500,
                    textShadow: isSaludo ? "0 0 14px rgba(212,160,23,0.55)" : "none",
                  }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
                {href === "/platikas" && <LiveBadge />}
              </Fragment>
            );
          })}
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {/* Ícono solo, sin texto, a propósito: como link de texto dentro
              del <nav> de arriba empujaba el contenido más allá de los
              1280px del contenedor y cortaba "Iniciar sesión" a la derecha
              en pantallas de escritorio comunes (1280-1440px). */}
          <a
            href={whatsappHref("Hola, quisiera contactarlos")}
            target="_blank"
            rel="noopener noreferrer"
            title="Escríbenos por WhatsApp"
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
            style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)" }}
          >
            <MessageCircle size={16} style={{ color: WHATSAPP_GREEN }} />
          </a>

          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                background: "rgba(212,160,23,0.12)",
                border: "1px solid rgba(212,160,23,0.35)",
                color: "var(--color-primary)",
              }}
            >
              <ShieldCheck size={15} />
              Panel Admin
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
            className="md:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium"
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
          className="md:hidden px-4 pb-4 flex flex-col gap-1"
          style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" }}
        >
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
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
                </Link>
                {href === "/platikas" && <LiveBadge className="mr-3" />}
              </div>
            );
          })}

          <a
            href={whatsappHref("Hola, quisiera contactarlos")}
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
  );
}
