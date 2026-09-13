import { PlaySquare, Globe, Music2, Link2 } from "lucide-react";
import type { DestinoPlataforma } from "@/types";

export const DESTINO_ESTILOS: Record<
  DestinoPlataforma,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    accentColor: string;
  }
> = {
  youtube: { label: "YouTube", icon: PlaySquare, accentColor: "#FF0000" },
  facebook: { label: "Facebook", icon: Globe, accentColor: "#1877F2" },
  tiktok: { label: "TikTok", icon: Music2, accentColor: "#69C9D0" },
  otro: { label: "Otro", icon: Link2, accentColor: "#D4A017" },
};
