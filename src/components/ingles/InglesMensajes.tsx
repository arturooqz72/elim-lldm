import { GraduationCap, Loader2, User } from "lucide-react";
import { piezas } from "@/lib/ingles/frases-chat";
import { TarjetaFrase } from "./TarjetaFrase";
import type { InglesMensaje } from "@/types";

const GOLD = "#f5c842";

type ChatMsg = Pick<InglesMensaje, "id" | "role" | "content">;

/** Respuesta de la tutora: texto normal y, donde marcó una frase, su tarjeta de voz. */
function ContenidoTutora({ mensaje }: { mensaje: ChatMsg }) {
  return (
    <>
      {piezas(mensaje.content).map((p, i, todas) =>
        p.tipo === "texto" ? (
          // Sin el espacio que queda pegado a una tarjeta (se ve como sangría).
          <span key={i}>
            {todas[i - 1]?.tipo === "frase" ? p.texto.replace(/^[ \t]+/, "") : p.texto}
          </span>
        ) : (
          <TarjetaFrase key={i} texto={p.texto} mensajeId={mensaje.id} indice={p.indice} />
        ),
      )}
    </>
  );
}

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
  /** Botones de inicio que se muestran con el chat vacío (se envían con un toque). */
  sugerencias?: string[];
  onSugerencia?: (texto: string) => void;
}

/** Burbujas de la conversación del modo actual (sin estado propio). */
export function InglesMensajes({ mensajes, bienvenida, escribiendo, sugerencias, onSugerencia }: Props) {
  const vacio = mensajes.length === 0;

  return (
    <>
      {vacio && (
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

      {vacio && !escribiendo && sugerencias && onSugerencia && sugerencias.length > 0 && (
        <div className="flex flex-col items-end gap-2" aria-label="Sugerencias para empezar">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSugerencia(s)}
              className="px-4 py-2 rounded-2xl text-sm text-left max-w-[85%] transition-colors"
              style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}55`, color: "var(--color-text)" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {mensajes.map((m, i) => (
        <div key={m.id ?? i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
          <Avatar rol={m.role} />
          <div
            className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${
              m.role === "assistant" ? "max-w-[88%]" : "max-w-[80%]"
            }`}
            style={
              m.role === "user"
                ? { background: GOLD, color: "#000" }
                : { background: "var(--color-surface-elevated)", color: "var(--color-text)" }
            }
          >
            {m.role === "assistant" ? <ContenidoTutora mensaje={m} /> : m.content}
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
