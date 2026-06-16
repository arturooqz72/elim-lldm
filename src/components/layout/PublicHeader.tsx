"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, Fragment } from "react";
import { Menu, X, Radio, Mic, Gamepad2, Archive, Sparkles, Music, Video, Bot, LogIn, LogOut, ChevronDown, UserCircle, ShieldCheck, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LiveBadge } from "./LiveBadge";
import type { Profile } from "@/types";

const NAV_LINKS = [
  { href: "/radio", label: "Radio", icon: Radio },
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/trivia", label: "Trivia en vivo", icon: Sparkles },
  { href: "/arena", label: "Elim Arena", icon: Trophy },
  { href: "/archivo", label: "Archivo", icon: Archive },
  { href: "/elimplay", label: "ElimPlay", icon: Music },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/elim-ia", label: "Elim IA", icon: Bot },
];

export function PublicHeader({ initialProfile }: { initialProfile: Profile | null }) {
  const pathname = usePathname();
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserMenuOpen(false);
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
            return (
              <Fragment key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                    background: active ? "rgba(212,160,23,0.1)" : "transparent",
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
              Iniciar sesión
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: "var(--color-text-muted)" }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div
          className="md:hidden px-4 pb-4 flex flex-col gap-1"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <div key={href} className="flex items-center gap-2">
                <Link
                  href={href}
                  className="flex-1 flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium"
                  style={{
                    color: active ? "var(--color-primary)" : "var(--color-text)",
                    background: active ? "rgba(212,160,23,0.1)" : "transparent",
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
