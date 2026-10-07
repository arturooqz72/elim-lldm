import { GraduationCap } from "lucide-react";
import { nivelPalabra } from "@/lib/ingles/sonidos";
import { ETIQUETA_SONIDO } from "@/lib/ingles/etiquetas";
import type { PronResultado } from "@/types";

const GOLD = "#f5c842";

const COLOR = {
  bien: "var(--color-success)",
  regular: "#facc15",
  mal: "var(--color-destructive)",
} as const;

function colorPuntaje(p: number): string {
  return p >= 80 ? COLOR.bien : p >= 60 ? COLOR.regular : COLOR.mal;
}

export function PronunciacionResultado({ resultado }: { resultado: PronResultado }) {
  // Las palabras "agregadas" (que no estaban en la frase) no se colorean.
  const palabras = resultado.palabras.filter((p) => p.error !== "Insertion");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex flex-col items-center justify-center shrink-0"
          style={{ border: `4px solid ${colorPuntaje(resultado.puntaje)}` }}
        >
          <span className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            {Math.round(resultado.puntaje)}
          </span>
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            de 100
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-xs flex-1">
          {[
            ["Precisión", resultado.precision],
            ["Fluidez", resultado.fluidez],
            ["Completa", resultado.completitud],
          ].map(([nombre, valor]) => (
            <div key={nombre as string} className="rounded-xl py-2" style={{ background: "var(--color-surface-elevated)" }}>
              <dt style={{ color: "var(--color-text-muted)" }}>{nombre}</dt>
              <dd className="font-bold text-sm" style={{ color: "var(--color-text)" }}>
                {Math.round(valor as number)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="text-lg leading-relaxed flex flex-wrap gap-x-2 gap-y-1">
        {palabras.map((p, i) => {
          const nivel = nivelPalabra(p);
          return (
            <span
              key={i}
              title={p.error === "Omission" ? "No se escuchó" : `${Math.round(p.puntaje)}/100`}
              className="font-semibold"
              style={{
                color: COLOR[nivel],
                textDecoration: p.error === "Omission" ? "line-through" : undefined,
              }}
            >
              {p.palabra}
            </span>
          );
        })}
      </p>
      <p className="text-[11px] -mt-2 flex gap-3" style={{ color: "var(--color-text-muted)" }}>
        <span style={{ color: COLOR.bien }}>● bien</span>
        <span style={{ color: COLOR.regular }}>● regular</span>
        <span style={{ color: COLOR.mal }}>● mejorar</span>
      </p>

      {resultado.sonidosFallados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resultado.sonidosFallados.map((s) => (
            <span
              key={s}
              className="px-2.5 py-1 rounded-full text-[11px]"
              style={{ background: "var(--color-surface-elevated)", color: "var(--color-text-muted)" }}
            >
              {ETIQUETA_SONIDO[s]}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55` }}
        >
          <GraduationCap size={15} style={{ color: GOLD }} />
        </div>
        <div
          className="px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap"
          style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}
        >
          {resultado.explicacion ??
            (resultado.puntaje >= 85
              ? "¡Muy bien! Tu pronunciación fue muy clara. Pasa a la siguiente frase."
              : "Revisa las palabras en amarillo y rojo, escucha la frase otra vez e inténtalo de nuevo.")}
        </div>
      </div>
    </div>
  );
}
