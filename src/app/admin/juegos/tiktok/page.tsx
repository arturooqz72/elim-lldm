// src/app/admin/juegos/tiktok/page.tsx
// Video "Campeones de la semana" para TikTok, Instagram y YouTube (solo
// admin, lo revisa admin/layout.tsx). Semanas de lunes a domingo en hora
// del Pacífico; solo semanas terminadas (por defecto la pasada), nunca la
// que va en curso aunque la pidan en la URL.
import { Clapperboard } from "lucide-react";
import { fechaDeHoy } from "@/lib/palabra/servidor";
import { getCampeonesSemana } from "@/lib/juegos/campeones.server";
import { lunesPasado, lunesValido, rangoCorto, rangoSemana, semanasDisponibles } from "@/lib/juegos/campeones/semana";
import { VideoCampeones } from "@/components/admin/campeones/VideoCampeones";

export const metadata = { title: "Video TikTok — Campeones de la semana" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ semana?: string }>;
}

export default async function CampeonesTikTokPage({ searchParams }: Props) {
  const { semana: pedida } = await searchParams;
  const hoy = fechaDeHoy();
  const valida = lunesValido(pedida, hoy);
  const lunes = valida ? pedida : lunesPasado(hoy);
  const c = await getCampeonesSemana(lunes);
  const vacia = c.juegos.length === 0 && !c.palabra;
  const sinPermiso = [
    ...c.juegos.flatMap((j) => j.podio.filter((p) => !p.conPermiso).map(() => j.nombre)),
    ...(c.palabra ? [c.palabra.racha, c.palabra.masDias].filter((p) => !p.conPermiso).map(() => "Palabra del Día") : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Clapperboard size={22} style={{ color: "var(--color-primary)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          Campeones de la semana
        </h1>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Semana (lunes a domingo, hora del Pacífico)
          <select
            name="semana"
            defaultValue={lunes}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            {semanasDisponibles(hoy).map((l) => (
              <option key={l} value={l}>
                {rangoCorto(l)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--color-primary)", color: "#000" }}>
          Ver
        </button>
      </form>

      {pedida && !valida && (
        <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
          Solo se pueden ver semanas que ya terminaron. Se muestra la semana pasada.
        </p>
      )}

      <div className="flex flex-col gap-1.5 text-sm max-w-xl" style={{ color: "var(--color-text-muted)" }}>
        <p>
          <strong style={{ color: "var(--color-text)" }}>{rangoSemana(lunes)}.</strong> Gana quien sumó más puntos en la semana
          (en empate, quien jugó menos partidas). Los admins no cuentan. Quien no aceptó salir en TikTok aparece como
          “Hermano/a participante”, sin foto.
        </p>
        {c.juegos.length > 0 && (
          <p>
            ✅ Van en el video: {c.juegos.map((j) => `${j.nombre} (${j.jugadores} jugadores, ${j.partidas} partidas)`).join(" · ")}
            {c.palabra && ` · Palabra del Día (${c.palabra.jugadores} jugadores)`}
          </p>
        )}
        {c.saltados.map((s) => (
          <p key={s.nombre}>
            ⏭️ Se salta {s.nombre}: {s.motivo}.
          </p>
        ))}
      </div>

      {sinPermiso.length > 0 && !vacia && (
        <div
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm max-w-xl"
          style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.45)", color: "var(--color-text)" }}
        >
          <span aria-hidden>⚠️</span>
          <p>
            <strong>
              {sinPermiso.length} {sinPermiso.length === 1 ? "lugar sale" : "lugares salen"} como “Hermano/a participante”
            </strong>{" "}
            porque no han dado permiso de TikTok. Se les pregunta al terminar cada partida; también lo pueden marcar en su perfil.
          </p>
        </div>
      )}

      {vacia ? (
        <div
          className="px-4 py-6 rounded-2xl text-sm max-w-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
        >
          <p className="font-bold mb-1">No hay campeones esta semana.</p>
          <p style={{ color: "var(--color-text-muted)" }}>
            Ningún juego tuvo al menos 2 jugadores, así que no se genera video. Elige otra semana.
          </p>
        </div>
      ) : (
        <VideoCampeones c={c} />
      )}
    </div>
  );
}
