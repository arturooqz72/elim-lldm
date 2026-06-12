"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Mic,
  BookOpen,
  Gamepad2,
  Sparkles,
  Archive,
  Folder,
  Music,
  Video,
  Bot,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/platikas", label: "Pláticas", icon: Mic },
  { href: "/admin/question-sets", label: "Banco de preguntas", icon: BookOpen },
  { href: "/admin/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/admin/trivia", label: "Salas de Trivia", icon: Sparkles },
  { href: "/admin/archivo", label: "Archivo", icon: Archive },
  { href: "/admin/categorias", label: "Categorías", icon: Folder },
  { href: "/admin/elimplay", label: "ElimPlay", icon: Music },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/elim-ia", label: "Elim IA", icon: Bot },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  function isActive(item: (typeof NAV)[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-full"
      style={{
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <Link href="/" className="flex items-center gap-2">
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-cinzel)", color: "var(--color-primary)" }}
          >
            Elim LLDM
          </span>
        </Link>
        <span
          className="text-xs mt-0.5 block font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          Panel Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                background: active ? "rgba(212,160,23,0.12)" : "transparent",
                color: active ? "var(--color-primary)" : "var(--color-text-muted)",
                borderLeft: active ? "2px solid var(--color-primary)" : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={13} />}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--color-destructive)";
            (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
