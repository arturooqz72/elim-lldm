// src/components/layout/navLinks.ts
// Enlaces del menú público. El menú móvil los muestra todos; el de escritorio
// deja a la vista los que no tienen `enMas` y agrupa el resto en "Más ▾"
// (12 enlaces en una fila no cabían en 1280px junto a Panel Admin y usuario).

import {
  Archive,
  AudioLines,
  Bot,
  Gamepad2,
  GraduationCap,
  Mail,
  MessageSquareText,
  Mic,
  Music,
  Radio,
  Smartphone,
  Video,
  Volume2,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** En escritorio va dentro del botón "Más". */
  enMas?: boolean;
  /** Dorado y en negritas, para que se vea (como Saludos). */
  destacado?: boolean;
  /**
   * Abre la página completa (<a>) en vez de navegar dentro del sitio: las
   * apps instalables (/escuchar) necesitan que el navegador lea su manifest.
   */
  documento?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/radio", label: "Radio", icon: Radio },
  {
    href: "/escuchar",
    label: "Escuchar en vivo / Instalar app",
    icon: Smartphone,
    enMas: true,
    destacado: true,
    documento: true,
  },
  { href: "/saludo", label: "Saludos", icon: AudioLines },
  { href: "/saludo-directo", label: "Saludo Directo", icon: Volume2 },
  { href: "/platikas", label: "Estudio en Vivo", icon: Mic },
  { href: "/juegos", label: "Juegos en línea", icon: Gamepad2 },
  { href: "/archivo", label: "Archivo", icon: Archive, enMas: true },
  { href: "/elimplay", label: "ElimPlay", icon: Music, enMas: true },
  { href: "/videos", label: "Videos", icon: Video, enMas: true },
  { href: "/elim-ia", label: "Elim IA", icon: Bot },
  { href: "/ingles", label: "Elim English", icon: GraduationCap },
  { href: "/opiniones", label: "Opiniones", icon: MessageSquareText, enMas: true },
  { href: "/contacto", label: "Contáctanos", icon: Mail, enMas: true },
];

export function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
