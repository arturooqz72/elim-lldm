// src/components/admin/liga/TarjetaLiga.tsx
//
// Imagen vertical 1080x1920 de la Liga: título con la semana, los 3
// primeros equipos y el mejor jugador (nombre para mostrar y foto, o la
// inicial) SOLO si aceptó la regla. La foto se baja por
// /api/admin/palabra/tiktok/foto (mismo dominio) para que el lienzo no
// quede "sucio" por CORS y se pueda descargar el PNG.
"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { DatosTarjetaLiga } from "@/lib/liga/consultas.server";
import { rangoSemana } from "@/lib/juegos/campeones/semana";
import { fotoDesdeServidor } from "@/lib/palabra/video/recursos";

const ANCHO = 1080;
const ALTO = 1920;
const ORO = "#D4A017";
const FONDO = "#0A0A12";
const TEXTO = "#F8F8FF";
const GRIS = "#9090A8";
const MEDALLAS = ["🥇", "🥈", "🥉"];
const FUENTE = "Inter, system-ui, sans-serif";

function cargar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function ajustar(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number, tamano: number) {
  let t = tamano;
  do {
    ctx.font = `700 ${t}px ${FUENTE}`;
    if (ctx.measureText(texto).width <= maxAncho) break;
    t -= 2;
  } while (t > 28);
}

async function dibujar(ctx: CanvasRenderingContext2D, d: DatosTarjetaLiga) {
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  const glow = ctx.createRadialGradient(ANCHO / 2, 520, 50, ANCHO / 2, 520, 900);
  glow.addColorStop(0, "rgba(212,160,23,0.28)");
  glow.addColorStop(1, "rgba(212,160,23,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.textAlign = "center";
  ctx.fillStyle = ORO;
  ctx.font = `700 56px ${FUENTE}`;
  ctx.fillText("ELIM LLDM", ANCHO / 2, 200);
  ctx.fillStyle = TEXTO;
  ctx.font = `800 104px ${FUENTE}`;
  ctx.fillText("Liga de Iglesias", ANCHO / 2, 340);
  ctx.fillStyle = GRIS;
  ctx.font = `500 44px ${FUENTE}`;
  ctx.fillText(`Semana: ${rangoSemana(d.semana)}`, ANCHO / 2, 420);

  let y = 560;
  if (d.top3.length === 0) {
    ctx.fillStyle = GRIS;
    ctx.font = `500 48px ${FUENTE}`;
    ctx.fillText("Todavía no hay puntos esta semana", ANCHO / 2, y + 120);
  }
  d.top3.forEach((f, i) => {
    const alto = 230;
    ctx.fillStyle = i === 0 ? "rgba(212,160,23,0.18)" : "rgba(255,255,255,0.05)";
    ctx.strokeStyle = i === 0 ? ORO : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(90, y, ANCHO - 180, alto, 36);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "96px sans-serif";
    ctx.fillText(MEDALLAS[i], 130, y + 145);
    ctx.fillStyle = TEXTO;
    ajustar(ctx, f.nombre, ANCHO - 420, 60);
    ctx.fillText(f.nombre, 270, y + 110);
    ctx.fillStyle = ORO;
    ctx.font = `700 52px ${FUENTE}`;
    ctx.fillText(`${f.puntos} puntos`, 270, y + 180);
    ctx.textAlign = "center";
    y += alto + 40;
  });

  if (d.mejor) {
    y = Math.max(y + 40, 1420);
    ctx.fillStyle = GRIS;
    ctx.font = `600 42px ${FUENTE}`;
    ctx.fillText("Mejor jugador de la semana", ANCHO / 2, y);
    const foto = d.mejor.avatar ? await cargar(fotoDesdeServidor(d.mejor.avatar)) : null;
    const cx = ANCHO / 2;
    const cy = y + 130;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (foto) {
      ctx.drawImage(foto, cx - 90, cy - 90, 180, 180);
    } else {
      ctx.fillStyle = "#1C1C2E";
      ctx.fillRect(cx - 90, cy - 90, 180, 180);
      ctx.fillStyle = ORO;
      ctx.font = `700 90px ${FUENTE}`;
      ctx.fillText(d.mejor.nombre.charAt(0).toUpperCase(), cx, cy + 32);
    }
    ctx.restore();
    ctx.fillStyle = TEXTO;
    ajustar(ctx, d.mejor.nombre, ANCHO - 160, 56);
    ctx.fillText(d.mejor.nombre, cx, cy + 170);
    ctx.fillStyle = GRIS;
    ctx.font = `500 40px ${FUENTE}`;
    ctx.fillText(`${d.mejor.puntos} puntos${d.mejor.equipo ? ` · ${d.mejor.equipo}` : ""}`, cx, cy + 230);
  }

  ctx.fillStyle = ORO;
  ctx.font = `600 44px ${FUENTE}`;
  ctx.fillText("Todos son bienvenidos · elimlldm.net/juegos/liga", ANCHO / 2, ALTO - 120);
}

export function TarjetaLiga({ datos }: { datos: DatosTarjetaLiga }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const ctx = lienzo.current?.getContext("2d");
    if (!ctx) return;
    setListo(false);
    void dibujar(ctx, datos).then(() => setListo(true));
  }, [datos]);

  function descargar() {
    lienzo.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `liga-iglesias-${datos.semana}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-3 items-start">
      <canvas ref={lienzo} width={ANCHO} height={ALTO} className="w-full max-w-[360px] rounded-xl" style={{ border: "1px solid var(--color-border)" }} />
      {!datos.mejor && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>El mejor jugador no sale porque no ha aceptado la regla de participación (o nadie ha jugado).</p>}
      <button type="button" disabled={!listo} onClick={descargar} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60" style={{ background: "var(--color-primary)", color: "#000" }}>
        <Download size={16} /> Descargar imagen (PNG)
      </button>
    </div>
  );
}
