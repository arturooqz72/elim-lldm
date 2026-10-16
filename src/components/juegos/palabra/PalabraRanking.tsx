// src/components/juegos/palabra/PalabraRanking.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PalabraPanelPuntos } from "@/types";
import { RankingLista } from "./RankingLista";
import { PreguntaIglesia } from "./PreguntaIglesia";
import { ListaHoy, ListaRachas, ListaSemana } from "./PuntosListas";

type Pestana = "hoy" | "semana" | "rachas" | "iglesias";

const PESTANAS: ReadonlyArray<readonly [Pestana, string]> = [
  ["hoy", "Hoy"],
  ["semana", "Últimos 7 días"],
  ["rachas", "Rachas"],
  ["iglesias", "Iglesias"],
];

function etiquetaFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${fecha}T12:00:00Z`)
  );
}

interface PalabraRankingProps {
  /** null = sin sesión. iglesia null = nunca se le preguntó. */
  usuario: { iglesia: string | null } | null;
}

/**
 * Panel "Ver puntos" (el único ranking de la Palabra del Día). Se carga al
 * abrirlo, así después de resolver ya sale en su lugar.
 */
export function PalabraRanking({ usuario }: PalabraRankingProps) {
  const [pestana, setPestana] = useState<Pestana>("hoy");
  const [datos, setDatos] = useState<PalabraPanelPuntos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iglesia, setIglesia] = useState<string | null>(usuario?.iglesia ?? null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/juegos/palabra/puntos", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as PalabraPanelPuntos & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los puntos.");
        if (vivo) setDatos(data);
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudieron cargar los puntos.");
      });
    return () => {
      vivo = false;
    };
  }, []);

  const preguntarIglesia = pestana === "iglesias" && usuario !== null && (iglesia === null || editando);
  const nota = (texto: string) => (
    <p className="text-[11px] px-1 pb-2" style={{ color: "var(--color-text-muted)" }}>
      {texto}
    </p>
  );
  const rango = datos ? `${etiquetaFecha(datos.desde)} – ${etiquetaFecha(datos.hoy)}` : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl" role="tablist" style={{ background: "var(--color-surface-elevated)" }}>
        {PESTANAS.map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className="min-h-9 px-1 py-1.5 rounded-lg text-[11px] leading-tight font-semibold"
            style={{
              background: pestana === valor ? "rgba(212,160,23,0.16)" : "transparent",
              color: pestana === valor ? "var(--color-primary)" : "var(--color-text-muted)",
            }}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-center py-6" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      ) : !datos ? (
        <p className="flex items-center justify-center gap-2 text-sm py-8" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 size={16} className="animate-spin" /> Cargando puntos…
        </p>
      ) : (
        <div>
          {datos.soyAdmin && (
            <p
              className="text-[11px] px-3 py-2 mb-2 rounded-lg"
              style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)", color: "var(--color-text)" }}
            >
              Tu cuenta es de admin: puedes jugar, pero no compites (no sales en estas listas).
            </p>
          )}
          {pestana === "hoy" && (
            <>
              {nota("Quién resolvió la palabra de hoy · 7 puntos menos los intentos usados · en empate gana quien la resolvió primero")}
              <ListaHoy filas={datos.dia.filas} yo={datos.dia.yo} />
            </>
          )}
          {pestana === "semana" && (
            <>
              {nota(`${rango} · suma de puntos de los últimos 7 días`)}
              <ListaSemana filas={datos.semana.filas} yo={datos.semana.yo} />
            </>
          )}
          {pestana === "rachas" && (
            <>
              {nota("Rachas activas más largas de días seguidos jugados")}
              <ListaRachas filas={datos.rachas} />
            </>
          )}
          {pestana === "iglesias" &&
            (preguntarIglesia ? (
              <PreguntaIglesia
                valorInicial={iglesia ?? ""}
                onGuardado={(valor) => {
                  setIglesia(valor);
                  setEditando(false);
                }}
                onCancelar={editando ? () => setEditando(false) : undefined}
              />
            ) : (
              <>
                {nota(`${rango} · puntos sumados por iglesia o ciudad`)}
                <RankingLista
                  vacio="Aún no hay puntos por iglesia en los últimos 7 días."
                  filas={datos.iglesias.map((f) => ({
                    clave: f.iglesia,
                    esYo: Boolean(iglesia) && f.iglesia.toLowerCase() === iglesia?.trim().toLowerCase(),
                    nombre: f.iglesia,
                    avatar: null,
                    icono: true,
                    detalle: null,
                    valor: `${f.puntos} pts`,
                    subvalor: `${f.jugadores} ${f.jugadores === 1 ? "jugador" : "jugadores"}`,
                  }))}
                />
                {usuario && (
                  <p className="text-[11px] text-center pt-3" style={{ color: "var(--color-text-muted)" }}>
                    Tu iglesia o ciudad: <strong>{iglesia || "sin especificar"}</strong> ·{" "}
                    <button type="button" onClick={() => setEditando(true)} className="underline" style={{ color: "var(--color-primary)" }}>
                      cambiar
                    </button>
                  </p>
                )}
              </>
            ))}
          <p className="text-[11px] text-center pt-3" style={{ color: "var(--color-text-muted)" }}>
            🎬 Los ganadores aparecen en nuestro TikTok
          </p>
        </div>
      )}
    </div>
  );
}
