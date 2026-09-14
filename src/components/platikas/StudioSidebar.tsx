"use client";

import { useState } from "react";
import { MessageCircle, Radio as RadioIcon, Cast, Users } from "lucide-react";

type Tab = "controles" | "destinos" | "invitados" | "chat";

interface TabDef {
  key: Tab;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}

interface StudioSidebarProps {
  isHost: boolean;
  chatContent: React.ReactNode;
  controlesContent?: React.ReactNode;
  destinosContent?: React.ReactNode;
  invitadosContent?: React.ReactNode;
}

// Panel lateral con rieles de íconos a la derecha (uno por sección) en
// vez de todo apilado en una sola columna — mismo patrón que el panel
// de StreamYard (Comments/Banners/Media assets/... a la derecha, el
// contenido de la sección seleccionada a la izquierda de esos íconos).
export function StudioSidebar({
  isHost,
  chatContent,
  controlesContent,
  destinosContent,
  invitadosContent,
}: StudioSidebarProps) {
  const [tab, setTab] = useState<Tab>(isHost ? "controles" : "chat");

  const tabs: TabDef[] = [
    ...(isHost
      ? ([
          { key: "controles", label: "Controles", icon: RadioIcon },
          { key: "destinos", label: "Destinos", icon: Cast },
          { key: "invitados", label: "Invitados", icon: Users },
        ] as TabDef[])
      : []),
    { key: "chat", label: "Chat", icon: MessageCircle },
  ];

  return (
    <div className="flex h-full w-full gap-2">
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-3">
        {tab === "controles" && controlesContent}
        {tab === "destinos" && destinosContent}
        {tab === "invitados" && invitadosContent}
        {tab === "chat" && chatContent}
      </div>

      <div
        className="flex flex-col items-center gap-1.5 py-3 px-1.5 shrink-0 rounded-2xl"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              title={label}
              aria-label={label}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{
                background: active ? "rgba(212,160,23,0.15)" : "transparent",
                color: active ? "var(--color-primary)" : "var(--color-text-muted)",
              }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
