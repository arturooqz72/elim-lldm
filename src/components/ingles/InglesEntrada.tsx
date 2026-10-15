import Link from "next/link";
import { Mic, Send } from "lucide-react";

const GOLD = "#f5c842";

interface Props {
  valor: string;
  onCambiar: (valor: string) => void;
  onEnviar: () => void;
  bloqueada: boolean;
  enviando: boolean;
  placeholder: string;
  maxCaracteres: number;
  /** false = solo el pie (p. ej. en Pronunciación, que no usa la caja de texto). */
  conCaja?: boolean;
  textoTerminos?: string;
  /** Botón 🎤 junto a la caja: lleva a practicar pronunciación. */
  onVoz?: () => void;
}

/** Caja para escribir a la tutora + pie con términos y contador de caracteres. */
export function InglesEntrada(props: Props) {
  const { valor, onCambiar, onEnviar, bloqueada, enviando, placeholder, maxCaracteres, conCaja = true } = props;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnviar();
    }
  }

  return (
    <div className="px-3 min-[400px]:px-5 py-3 sm:py-4 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
      {conCaja && (
        <div className="flex items-end gap-2">
          {props.onVoz && (
            <button
              type="button"
              onClick={props.onVoz}
              className="p-3 rounded-xl shrink-0 transition-opacity hover:opacity-90"
              style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55`, color: GOLD }}
              aria-label="Practicar pronunciación con tu voz"
              title="Practicar pronunciación"
            >
              <Mic size={16} />
            </button>
          )}
          <textarea
            value={valor}
            onChange={(e) => onCambiar(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={maxCaracteres}
            placeholder={placeholder}
            disabled={bloqueada}
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none disabled:opacity-50"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              maxHeight: "120px",
            }}
          />
          <button
            onClick={onEnviar}
            disabled={enviando || bloqueada || !valor.trim()}
            className="p-3 rounded-xl shrink-0 transition-opacity disabled:opacity-40"
            style={{ background: GOLD, color: "#000" }}
            aria-label="Enviar"
          >
            <Send size={16} />
          </button>
        </div>
      )}
      <div className="flex justify-between mt-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        <Link href="/ingles/terminos" className="hover:underline">
          {props.textoTerminos ?? "Términos y reembolsos"}
        </Link>
        {valor.length > maxCaracteres * 0.8 && (
          <span>
            {valor.length}/{maxCaracteres}
          </span>
        )}
      </div>
    </div>
  );
}
