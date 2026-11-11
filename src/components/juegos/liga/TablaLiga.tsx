// src/components/juegos/liga/TablaLiga.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Church, LogIn } from "lucide-react";
import type { TablaLiga as Tabla } from "@/lib/liga/consultas.server";
import { LIGA_REFRESCO_MS } from "@/lib/liga/config";
import { enFrase } from "@/lib/liga/nombre";
import { InvitarHermanos } from "./InvitarHermanos";
import { SelectorIglesia } from "./SelectorIglesia";

const caja = { background: "var(--color-surface)", border: "1px solid var(--color-border)" } as const;
const botonOro = "self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-11";

export function TablaLiga({ inicial }: { inicial: Tabla }) {
  const router = useRouter();
  const [tabla, setTabla] = useState(inicial);
  const [eligiendo, setEligiendo] = useState(false);

  useEffect(() => setTabla(inicial), [inicial]);
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/liga/tabla", { cache: "no-store" });
        if (res.ok) setTabla((await res.json()) as Tabla);
      } catch {
        // Se intenta de nuevo en 30 segundos.
      }
    }, LIGA_REFRESCO_MS);
    return () => clearInterval(id);
  }, []);

  const { mia, top, jugadores } = tabla;
  const maximo = top[0]?.puntos ?? 0;
  const miFrase = mia ? enFrase(mia.nombre, mia.comunidad, true) : "";

  let cabecera: React.ReactNode;
  if (!tabla.conSesion) {
    cabecera = (
      <>
        <p className="text-sm" style={{ color: "var(--color-text)" }}>Entra a tu cuenta para que tus puntos sumen para tu equipo.</p>
        <Link href="/login?returnUrl=/juegos/liga" className={botonOro} style={{ background: "var(--color-primary)", color: "#000" }}><LogIn size={16} /> Iniciar sesión</Link>
      </>
    );
  } else if (!mia) {
    cabecera = eligiendo && tabla.aceptoReglas ? (
      <SelectorIglesia onElegida={() => { setEligiendo(false); router.refresh(); }} />
    ) : (
      <>
        <p className="text-sm" style={{ color: "var(--color-text)" }}>En Elim LLDM todos son bienvenidos. ¿De qué iglesia eres? Tus puntos sumarán para tu equipo.</p>
        {tabla.aceptoReglas && (
          <button type="button" onClick={() => setEligiendo(true)} className={botonOro} style={{ background: "var(--color-primary)", color: "#000" }}><Church size={16} /> Elegir mi equipo</button>
        )}
      </>
    );
  } else if (!mia.aprobada) {
    cabecera = <p className="text-sm" style={{ color: "var(--color-text)" }}><strong>{mia.nombre}</strong> está esperando aprobación. Tus puntos ya se están guardando.</p>;
  } else {
    cabecera = (
      <>
        <p className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          {mia.lugar ? `${miFrase}${mia.campeona ? " 🏆" : ""} va en el lugar #${mia.lugar}` : `${miFrase}${mia.campeona ? " 🏆" : ""} todavía no tiene puntos esta semana`}
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {mia.lugar === 1
            ? "¡Van en primer lugar! Invita a tus hermanos para no perderlo."
            : mia.faltan && mia.siguiente
              ? `¡Les faltan ${mia.faltan} puntos para pasar a ${enFrase(mia.siguiente.nombre, mia.siguiente.comunidad)}! Invita a tus hermanos.`
              : "¡Jueguen para entrar a la tabla! Invita a tus hermanos."}
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.14) 0%, var(--color-surface) 70%)", border: "1px solid rgba(212,160,23,0.45)" }}>
        {cabecera}
        <InvitarHermanos equipoEnFrase={mia?.aprobada ? enFrase(mia.nombre, mia.comunidad) : null} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Tabla de la semana</h2>
        {top.length === 0 ? (
          <p className="text-sm rounded-2xl p-5" style={{ ...caja, color: "var(--color-text-muted)" }}>Todavía no hay puntos esta semana. ¡Juega y pon a tu equipo en la tabla!</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {top.map((f) => (
              <li key={f.id} className="rounded-xl p-3 flex flex-col gap-2" style={{ ...caja, borderColor: f.id === mia?.id ? "rgba(212,160,23,0.6)" : "var(--color-border)" }}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-sm font-bold tabular-nums" style={{ color: f.lugar <= 3 ? "var(--color-primary)" : "var(--color-text-muted)" }}>#{f.lugar}</span>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>{f.nombre}{f.campeona ? " 🏆" : ""}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{f.puntos} pts</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-elevated)" }}>
                    <div className="h-full rounded-full" style={{ width: `${maximo ? Math.max(4, Math.round((f.puntos / maximo) * 100)) : 0}%`, background: "var(--color-primary)" }} />
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>{f.jugadores} {f.jugadores === 1 ? "jugador" : "jugadores"}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {mia?.aprobada && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Los mejores de mi equipo esta semana</h2>
          {jugadores.length === 0 ? (
            <p className="text-sm rounded-2xl p-5" style={{ ...caja, color: "var(--color-text-muted)" }}>Nadie de tu equipo ha sumado puntos esta semana. ¡Sé el primero!</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {jugadores.map((j) => (
                <li key={j.lugar} className="flex items-center gap-3 rounded-xl p-3" style={{ ...caja, borderColor: j.esYo ? "rgba(212,160,23,0.6)" : "var(--color-border)" }}>
                  <span className="w-6 text-center text-sm font-bold tabular-nums" style={{ color: "var(--color-text-muted)" }}>{j.lugar}</span>
                  {j.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.avatar} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--color-surface-elevated)", color: "var(--color-primary)" }}>{j.nombre.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="flex-1 min-w-0 text-sm truncate" style={{ color: "var(--color-text)" }}>{j.nombre}{j.esYo ? " (tú)" : ""}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text)" }}>{j.puntos} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
