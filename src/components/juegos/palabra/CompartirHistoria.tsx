// src/components/juegos/palabra/CompartirHistoria.tsx
"use client";

// Botón "Compartir en mis historias": imagen vertical con el resultado (sin
// la palabra). En el celular abre el menú de compartir del teléfono con la
// imagen (Instagram, WhatsApp, TikTok…); si el navegador no puede compartir
// archivos, la descarga.
//
// La imagen se prepara en cuanto aparece el botón: Safari solo deja abrir
// el menú de compartir justo después del toque, y si antes hubiera que
// esperar a dibujarla, lo rechaza.
import { useEffect, useState } from "react";
import { Download, ImageUp, Loader2 } from "lucide-react";
import { crearHistoria, type DatosHistoria } from "@/lib/palabra/historia";

interface Props extends DatosHistoria {
  onAviso: (mensaje: string) => void;
}

function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function CompartirHistoria({ fecha, intentos, racha, onAviso }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  const [error, setError] = useState(false);
  // Clave estable: solo se vuelve a dibujar si cambia el resultado.
  const clave = `${fecha}|${racha}|${intentos.map((i) => i.colores.join("")).join(",")}`;

  useEffect(() => {
    let vivo = true;
    setArchivo(null);
    setError(false);
    crearHistoria({ fecha, intentos, racha })
      .then((f) => {
        if (!vivo) return;
        setArchivo(f);
        setPuedeCompartir(typeof navigator.canShare === "function" && navigator.canShare({ files: [f] }));
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
    // `clave` resume fecha, intentos y racha.
  }, [clave]);

  async function alTocar() {
    if (!archivo) return;
    if (!puedeCompartir) {
      descargar(archivo);
      onAviso("Imagen descargada");
      return;
    }
    try {
      await navigator.share({ files: [archivo] });
    } catch (e) {
      // AbortError = la persona cerró el menú. Otro error = el teléfono no
      // dejó compartir: se descarga para que la suba ella misma.
      if (e instanceof DOMException && e.name === "AbortError") return;
      descargar(archivo);
      onAviso("Imagen descargada");
    }
  }

  if (error) return null;

  return (
    <button
      type="button"
      onClick={alTocar}
      disabled={!archivo}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-70"
      style={{
        background: "linear-gradient(135deg, #EDB84A 0%, #D4A017 55%, #A07810 100%)",
        color: "#000",
        boxShadow: "0 0 20px rgba(212,160,23,0.3)",
      }}
    >
      {!archivo ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Preparando imagen…
        </>
      ) : puedeCompartir ? (
        <>
          <ImageUp size={16} />
          Compartir en mis historias
        </>
      ) : (
        <>
          <Download size={16} />
          Compartir en mis historias (descargar imagen)
        </>
      )}
    </button>
  );
}
