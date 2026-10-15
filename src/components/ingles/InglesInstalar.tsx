"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { GuiaIphone } from "./GuiaIphone";
import {
  estaInstalada,
  hayAvisoInstalacion,
  iniciarInstalacion,
  pedirInstalacion,
  plataforma,
  suscribirInstalacion,
} from "./instalacionApp";

interface Props {
  /** Nombre que sale en la guía de iPhone. */
  nombreApp?: string;
  /** Color del botón y de la guía. */
  color?: string;
}

/**
 * Botón "Instalar app" de las apps instalables del sitio: Elim English (en
 * su encabezado) y Radio Elim (en /escuchar).
 * - Android / Chrome: abre el aviso de instalación del navegador (solo
 *   aparece cuando el navegador lo ofrece).
 * - iPhone / iPad: muestra una mini guía (Compartir → Agregar a inicio).
 * - Ya abierta como app o recién instalada: no se muestra.
 */
export function InglesInstalar({ nombreApp = "Elim English", color: GOLD = "#f5c842" }: Props = {}) {
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

      {guia && <GuiaIphone titulo={`Instala ${nombreApp} en tu iPhone`} color={GOLD} onCerrar={() => setGuia(false)} />}
    </>
  );
}
