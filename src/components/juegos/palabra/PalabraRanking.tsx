// src/components/juegos/palabra/PalabraRanking.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Flame, LogIn, Trophy } from "lucide-react";
import type {
  PalabraFilaRankingIglesia,
  PalabraFilaRankingRacha,
  PalabraFilaRankingSemanal,
} from "@/types";
import { RankingLista } from "./RankingLista";
import { PreguntaIglesia } from "./PreguntaIglesia";

type Pestana = "semana" | "rachas" | "iglesias";

interface PalabraRankingProps {
  semanal: PalabraFilaRankingSemanal[];
  rachas: PalabraFilaRankingRacha[];
  iglesias: PalabraFilaRankingIglesia[];
  /** Texto "lun 29 sep – dom 5 oct". */
  etiquetaSemana: string;
  /** null = sin sesión. */
  usuario: { id: string; iglesia: string | null } | null;
}

export function PalabraRanking({ semanal, rachas, iglesias, etiquetaSemana, usuario }: PalabraRankingProps) {
  const [pestana, setPestana] = useState<Pestana>("semana");
  // NULL en la base = nunca se le preguntó → se le pregunta una sola vez
  // antes de ver el ranking. '' = prefirió no decirlo.
  const [iglesia, setIglesia] = useState<string | null>(usuario?.iglesia ?? null);
  const [editando, setEditando] = useState(false);
  const debePreguntar = usuario !== null && (iglesia === null || editando);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <Trophy size={14} style={{ color: "var(--color-primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Ranking — Palabra del Día
        </span>
      </div>

      {debePreguntar ? (
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
          <div className="flex gap-1 p-2" role="tablist">
            {(
              [
                ["semana", "Esta semana"],
                ["rachas", "Rachas"],
                ["iglesias", "Iglesias"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={pestana === valor}
                onClick={() => setPestana(valor)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: pestana === valor ? "rgba(212,160,23,0.12)" : "transparent",
                  color: pestana === valor ? "var(--color-primary)" : "var(--color-text-muted)",
                }}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <div className="px-3 pb-3">
            {pestana === "semana" && (
              <>
                <p className="text-[11px] px-1 pb-2" style={{ color: "var(--color-text-muted)" }}>
                  {etiquetaSemana} · 7 puntos menos los intentos usados por día resuelto
                </p>
                <RankingLista
                  vacio="Nadie ha sumado puntos esta semana. ¡Sé el primero!"
                  filas={semanal.map((f) => ({
                    clave: f.user_id,
                    esYo: f.user_id === usuario?.id,
                    nombre: f.nombre,
                    avatar: f.avatar_url,
                    detalle: f.iglesia,
                    valor: `${f.puntos} pts`,
                    subvalor: `${f.partidas} ${f.partidas === 1 ? "día" : "días"}`,
                  }))}
                />
              </>
            )}
            {pestana === "rachas" && (
              <>
                <p className="text-[11px] px-1 pb-2" style={{ color: "var(--color-text-muted)" }}>
                  Rachas activas más largas de días seguidos jugados
                </p>
                <RankingLista
                  vacio="Todavía no hay rachas activas."
                  filas={rachas.map((f) => ({
                    clave: f.user_id,
                    esYo: f.user_id === usuario?.id,
                    nombre: f.nombre,
                    avatar: f.avatar_url,
                    detalle: f.iglesia,
                    valor: (
                      <span className="inline-flex items-center gap-1">
                        <Flame size={12} /> {f.actual}
                      </span>
                    ),
                    subvalor: `máx. ${f.maxima}`,
                  }))}
                />
              </>
            )}
            {pestana === "iglesias" && (
              <>
                <p className="text-[11px] px-1 pb-2" style={{ color: "var(--color-text-muted)" }}>
                  {etiquetaSemana} · puntos sumados por iglesia o ciudad
                </p>
                <RankingLista
                  vacio="Aún no hay puntos por iglesia esta semana."
                  filas={iglesias.map((f) => ({
                    clave: f.iglesia,
                    esYo: false,
                    nombre: f.iglesia,
                    avatar: null,
                    icono: true,
                    detalle: null,
                    valor: `${f.puntos} pts`,
                    subvalor: `${f.jugadores} ${f.jugadores === 1 ? "jugador" : "jugadores"}`,
                  }))}
                />
              </>
            )}

            {usuario ? (
              <p className="text-[11px] text-center pt-3" style={{ color: "var(--color-text-muted)" }}>
                Tu iglesia o ciudad: <strong>{iglesia || "sin especificar"}</strong> ·{" "}
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="underline"
                  style={{ color: "var(--color-primary)" }}
                >
                  cambiar
                </button>
              </p>
            ) : (
              <Link
                href="/login?returnUrl=/juegos/palabra"
                className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: "rgba(212,160,23,0.1)", color: "var(--color-primary)" }}
              >
                <LogIn size={14} />
                Inicia sesión para aparecer en el ranking
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

