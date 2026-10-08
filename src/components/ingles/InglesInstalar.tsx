"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import {
  estaInstalada,
  hayAvisoInstalacion,
  iniciarInstalacion,
  pedirInstalacion,
  plataforma,
  suscribirInstalacion,
} from "./instalacionApp";

const GOLD = "#f5c842";

/**
 * Botón "Instalar app" del encabezado de Elim English.
 * - Android / Chrome: abre el aviso de instalación del navegador (solo
 *   aparece cuando el navegador lo ofrece).
 * - iPhone / iPad: muestra una mini guía (Compartir → Agregar a inicio).
 * - Ya abierta como app o recién instalada: no se muestra.
 */
export function InglesInstalar() {
  const [listo, setListo] = useState(false);
  const [puedeAvisar, setPuedeAvisar] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [esIos, setEsIos] = useState(false);
  const [guia, setGuia] = useState(false);

  useEffect(() => {
    iniciarInstalacion();
    const leer = () => {
      setPuedeAvisar(hayAvisoInstalacion());
      setInstalada(estaInstalada());
    };
    leer();
    setEsIos(plataforma() === "ios");
    setListo(true);
    return suscribirInstalacion(leer);
  }, []);

  // Nada en el servidor ni hasta saber en qué dispositivo estamos.
  if (!listo || instalada || (!esIos && !puedeAvisar)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (esIos ? setGuia(true) : void pedirInstalacion())}
        className="flex items-center gap-1 px-2 min-[400px]:gap-1.5 min-[400px]:px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap transition-opacity hover:opacity-90"
        style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}55`, color: GOLD }}
        aria-label="Instalar app"
      >
        <Download size={14} />
        Instalar app
      </button>

      {guia && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setGuia(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="guia-instalar-titulo"
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: "var(--color-surface-elevated)", border: `1px solid ${GOLD}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <p id="guia-instalar-titulo" className="text-base font-bold" style={{ color: "var(--color-text)" }}>
                Instala Elim English en tu iPhone
              </p>
              <button
                type="button"
                onClick={() => setGuia(false)}
                className="p-1 rounded-lg shrink-0"
                style={{ color: "var(--color-text-muted)" }}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <ol className="flex flex-col gap-3 text-sm" style={{ color: "var(--color-text)" }}>
              <li className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${GOLD}1A`, color: GOLD }}
                >
                  <Share size={16} />
                </span>
                <span>
                  1. Toca <strong>Compartir</strong> en la barra de Safari.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${GOLD}1A`, color: GOLD }}
                >
                  <SquarePlus size={16} />
                </span>
                <span>
                  2. Luego toca <strong>Agregar a pantalla de inicio</strong>.
                </span>
              </li>
            </ol>

            <p className="text-xs mt-4" style={{ color: "var(--color-text-muted)" }}>
              Si no ves la opción, desliza hacia abajo en el menú de Compartir.
            </p>

            <button
              type="button"
              onClick={() => setGuia(false)}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: GOLD, color: "#000" }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
