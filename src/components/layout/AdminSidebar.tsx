"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  History,
  GraduationCap,
  Users,
  Mic,
  BookOpen,
  Library,
  Gamepad2,
  Archive,
  Folder,
  Music,
  Video,
  Bot,
  AudioLines,
  Zap,
  Disc3,
  Puzzle,
  CalendarCheck,
  Radio,
  Trophy,
  Smartphone,
  Clapperboard,
  Medal,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { createFreshClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ItemNav {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  /** Título de apartado que va arriba de este enlace. */
  seccion?: string;
}

const NAV: ItemNav[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/en-linea", label: "En línea ahora", icon: Activity },
  { href: "/admin/historial", label: "Historial de visitas", icon: History },
  { href: "/admin/ingles", label: "Elim English", icon: GraduationCap },
  { href: "/admin/radio", label: "App de la Radio", icon: Smartphone },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/admin/programas", label: "Programas", icon: Radio },
  { href: "/admin/banco-preguntas", label: "Banco bíblico", icon: Library },
  { href: "/admin/question-sets", label: "Sets de preguntas", icon: BookOpen },
  { href: "/admin/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/admin/arena-abierta", label: "Arena Abierta", icon: Zap },
  { href: "/admin/ruleta", label: "La Ruleta", icon: Disc3 },
  { href: "/admin/ahorcado", label: "Ahorcado", icon: Puzzle },
  { href: "/admin/palabra", label: "Palabra del Día", icon: CalendarCheck },
  { href: "/tiktok-trivia", label: "Trivia TikTok", icon: Trophy },
  { href: "/admin/palabra/tiktok", label: "Palabra del Día (diario)", icon: Clapperboard, seccion: "Videos TikTok" },
  { href: "/admin/juegos/tiktok", label: "Campeones de la semana", icon: Medal },
  { href: "/admin/archivo", label: "Archivo", icon: Archive, seccion: "Contenido" },
  { href: "/admin/categorias", label: "Categorías", icon: Folder },
  { href: "/admin/elimplay", label: "ElimPlay", icon: Music },
  { href: "/admin/videos", label: "Videos", icon: Video },
  { href: "/admin/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/admin/saludos", label: "Saludos", icon: AudioLines },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createFreshClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  // Gana el enlace más largo que coincida: en /admin/juegos/tiktok se marca
  // "Campeones de la semana", no también "Juegos".
  const coincide = (item: ItemNav) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const activo = NAV.filter(coincide).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (item: ItemNav) => item.href === activo;

  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-full"
      style={{
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Logo */}
      <div className="shrink-0 px-5 py-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
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

      {/* Nav — con su propio scroll: son más opciones que alto de pantalla,
          y sin min-h-0 + overflow las últimas (y "Cerrar sesión") quedaban
          fuera de la vista sin forma de llegar a ellas. */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <div key={item.href} className="shrink-0 flex flex-col">
            {item.seccion && (
              <p
                className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)", opacity: 0.75 }}
              >
                {item.seccion}
              </p>
            )}
            <Link
              href={item.href}
              className="shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
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
            </div>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="shrink-0 px-3 py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
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
