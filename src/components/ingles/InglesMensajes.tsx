import { GraduationCap, Loader2, User } from "lucide-react";
import type { InglesMensaje } from "@/types";

const GOLD = "#f5c842";

type ChatMsg = Pick<InglesMensaje, "role" | "content">;

function Avatar({ rol }: { rol: ChatMsg["role"] }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={
        rol === "user"
          ? { background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)" }
          : { background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }
      }
    >
      {rol === "user" ? (
        <User size={14} style={{ color: "var(--color-text-muted)" }} />
      ) : (
        <GraduationCap size={15} style={{ color: GOLD }} />
      )}
    </div>
  );
}

interface Props {
  mensajes: ChatMsg[];
  bienvenida: string;
  escribiendo: boolean;
}

/** Burbujas de la conversación del modo actual (sin estado propio). */
export function InglesMensajes({ mensajes, bienvenida, escribiendo }: Props) {
  return (
    <>
      {mensajes.length === 0 && (
        <div className="flex gap-3">
          <Avatar rol="assistant" />
          <div
            className="px-4 py-3 rounded-2xl text-sm max-w-[80%]"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
          >
            {bienvenida}
          </div>
        </div>
      )}

      {mensajes.map((m, i) => (
        <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
          <Avatar rol={m.role} />
          <div
            className="px-4 py-3 rounded-2xl text-sm max-w-[80%] whitespace-pre-wrap break-words"
            style={
              m.role === "user"
                ? { background: GOLD, color: "#000" }
                : { background: "var(--color-surface-elevated)", color: "var(--color-text)" }
            }
          >
            {m.content}
          </div>
        </div>
      ))}

      {escribiendo && (
        <div className="flex gap-3">
          <Avatar rol="assistant" />
          <div
            className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
            style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
          >
            <Loader2 size={14} className="animate-spin" />
            La tutora está escribiendo...
          </div>
        </div>
      )}
    </>
  );
}
