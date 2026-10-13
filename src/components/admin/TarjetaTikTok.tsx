// src/components/admin/TarjetaTikTok.tsx
// Tarjeta vertical 9:16 de la Palabra del Día para capturar y subir a
// TikTok. Todo se mide en cqw (ancho de la tarjeta), así se ve igual en
// cualquier tamaño de pantalla. Con nombre solo quien dio permiso; los
// demás se resumen en "y N hermanos más". El ganador siempre va arriba
// (como "Hermano/a participante" sin foto si no dio permiso). Sin iglesia.
import type { PalabraTarjetaTikTok, PalabraPuntosPersona } from "@/types";

const ORO = "#D4A017";
const MEDALLAS = ["🥇", "🥈", "🥉"];
/** "X hermanos jugaron" solo se muestra a partir de este número. */
const MIN_JUGADORES_VISIBLE = 5;

function etiquetaFecha(fecha: string): string {
  const texto = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${fecha}T12:00:00Z`)
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Foto({ p, tam }: { p: PalabraPuntosPersona; tam: number }) {
  const estilo = { width: `${tam}cqw`, height: `${tam}cqw`, borderRadius: "9999px", flexShrink: 0 } as const;
  return p.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.avatar} alt="" referrerPolicy="no-referrer" style={{ ...estilo, objectFit: "cover", border: `0.6cqw solid ${ORO}` }} />
  ) : (
    <span
      style={{
        ...estilo,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(212,160,23,0.15)",
        color: ORO,
        fontSize: `${tam * 0.45}cqw`,
      }}
    >
      🙏
    </span>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: ORO, fontSize: "3.6cqw", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function Renglon({ izq, p, der }: { izq: string; p: PalabraPuntosPersona; der: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2.5cqw",
        padding: "1.1cqw 2.5cqw",
        borderRadius: "2.5cqw",
        background: "rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ width: "6cqw", textAlign: "center", fontSize: "3.9cqw", fontWeight: 800, color: ORO }}>{izq}</span>
      <Foto p={p} tam={7} />
      <span
        style={{ flex: 1, minWidth: 0, fontSize: "3.9cqw", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {p.nombre}
      </span>
      <span style={{ fontSize: "3.9cqw", fontWeight: 800, color: ORO, fontVariantNumeric: "tabular-nums" }}>{der}</span>
    </div>
  );
}

/** "y N hermanos más"; si no hay nadie con nombre antes, `sinNombres`. */
function YMas({ n, sinNombres }: { n: number; sinNombres?: string }) {
  if (n <= 0) return null;
  const hermanos = `${n} ${n === 1 ? "hermano" : "hermanos"}`;
  return (
    <p style={{ textAlign: "center", fontSize: "3.6cqw", color: "#C9C4B5", padding: "0.6cqw 0" }}>
      {sinNombres ? `${hermanos} ${sinNombres}` : `y ${hermanos} más`}
    </p>
  );
}

export function TarjetaTikTok({ t }: { t: PalabraTarjetaTikTok }) {
  const { ganador } = t;
  return (
    <div
      id="tarjeta-tiktok"
      style={{
        containerType: "inline-size",
        width: "min(100%, 405px)",
        aspectRatio: "9 / 16",
        background: "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(212,160,23,0.22) 0%, transparent 70%), #0A0A12",
        color: "#F8F8FF",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "5cqw 5.5cqw",
        gap: "2.6cqw",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2.5cqw" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" style={{ width: "9cqw", height: "9cqw", borderRadius: "2cqw" }} />
        <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "7cqw", fontWeight: 700, color: ORO, letterSpacing: "0.08em" }}>
          Elim LLDM
        </span>
      </div>

      {/* Lo de en medio queda centrado aunque haya pocos renglones. */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "3cqw" }}>
      <div style={{ textAlign: "center" }}>
        <Titulo>Palabra del Día</Titulo>
        <p style={{ fontSize: "3.4cqw", color: "#9090A8" }}>{etiquetaFecha(t.fecha)}</p>
        <p style={{ fontSize: "10.5cqw", fontWeight: 800, letterSpacing: "0.18em", color: ORO, lineHeight: 1.1 }}>
          {t.palabra?.palabra ?? "—"}
        </p>
        {t.palabra && <p style={{ fontSize: "3.4cqw", color: "#9090A8" }}>{t.palabra.referencia}</p>}
        {/* Solo con 5 o más (sin admins): con menos no luce en el video. */}
        {t.jugadores >= MIN_JUGADORES_VISIBLE && (
          <p style={{ fontSize: "3.8cqw", fontWeight: 700, marginTop: "1.2cqw" }}>
            🙌 {t.jugadores} hermanos jugaron
          </p>
        )}
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "2.6cqw",
          borderRadius: "4cqw",
          background: "rgba(212,160,23,0.1)",
          border: `0.4cqw solid rgba(212,160,23,0.45)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5cqw",
        }}
      >
        <Titulo>🏆 Ganador del día</Titulo>
        {ganador ? (
          <>
            <Foto p={ganador} tam={14} />
            <p style={{ fontSize: "5.6cqw", fontWeight: 800, lineHeight: 1.1 }}>{ganador.nombre}</p>
            <p style={{ fontSize: "4cqw", color: ORO, fontWeight: 700 }}>
              {ganador.puntos} puntos · {ganador.intentos} de 6 intentos
            </p>
          </>
        ) : (
          <p style={{ fontSize: "4cqw", color: "#9090A8" }}>Nadie la resolvió este día</p>
        )}
      </div>

      {(t.top3.length > 0 || t.otrosDia > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.1cqw" }}>
          <Titulo>Top 3 del día</Titulo>
          {t.top3.map((p) => (
            <Renglon key={p.posicion} izq={MEDALLAS[p.posicion - 1] ?? String(p.posicion)} p={p} der={`${p.puntos} pts`} />
          ))}
          <YMas n={t.otrosDia} />
        </div>
      )}

      {(t.top5Semana.length > 0 || t.otrosSemana > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.1cqw" }}>
          <Titulo>Top 5 · últimos 7 días</Titulo>
          {t.top5Semana.map((p) => (
            <Renglon key={p.posicion} izq={String(p.posicion)} p={p} der={`${p.puntos} pts`} />
          ))}
          <YMas n={t.otrosSemana} sinNombres={t.top5Semana.length === 0 ? (t.otrosSemana === 1 ? "sumó puntos" : "sumaron puntos") : undefined} />
        </div>
      )}

      </div>

      <p style={{ textAlign: "center", fontSize: "3.6cqw", color: "#9090A8" }}>
        Juega gratis cada día en <strong style={{ color: ORO }}>elimlldm.net/juegos/palabra</strong>
      </p>
    </div>
  );
}
