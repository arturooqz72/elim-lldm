"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { InglesMensajes } from "./InglesMensajes";
import { InglesOpciones } from "./InglesOpciones";
import { InglesAvisoLimite } from "./InglesAvisoLimite";
import { InglesPronunciacion } from "./InglesPronunciacion";
import { InglesSaldo } from "./InglesSaldo";
import { InglesInstalar } from "./InglesInstalar";
import { InglesEncabezado } from "./InglesEncabezado";
import { InglesEntrada } from "./InglesEntrada";
import { InglesRetoTarjeta } from "./InglesRetoTarjeta";
import { InglesRetoLogro } from "./InglesRetoLogro";
import { useAvisoCompra } from "./useAvisoCompra";
import { BIENVENIDA, MODOS, SUGERENCIAS } from "@/lib/ingles/etiquetas";
import type {
  InglesMensaje,
  InglesModo,
  InglesPaquete,
  InglesPerfil,
  InglesRacha,
  InglesReto,
  InglesRetoAvance,
  InglesSaldo as Saldo,
  PronFrase,
  PronProgreso,
} from "@/types";

const GOLD = "#f5c842";

type ChatMsg = Pick<InglesMensaje, "role" | "content">;

interface Props {
  displayName: string;
  perfilInicial: InglesPerfil;
  mensajesIniciales: InglesMensaje[];
  saldoInicial: Saldo;
  paquetes: InglesPaquete[];
  maxCaracteres: number;
  compra: "ok" | "cancelada" | null;
  /** Modo Pronunciación */
  costoPronunciacion: number;
  pronMaxSegundos: number;
  fraseInicial: PronFrase | null;
  progresoInicial: PronProgreso;
  /** ENGLISH_PAYMENTS_ENABLED y si el usuario ya está en la lista de espera. */
  pagosActivos: boolean;
  enListaEspera: boolean;
  /** Reto del día (null si no se pudo cargar), su conversación de hoy y la racha. */
  reto: InglesReto | null;
  avanceInicial: InglesRetoAvance;
  mensajesRetoIniciales: ChatMsg[];
  rachaInicial: InglesRacha;
}

interface Respuesta {
  estado?: string;
  reply?: string;
  saldo?: Saldo;
  error?: string;
  racha?: InglesRacha;
  avance?: InglesRetoAvance;
}

function agrupar(mensajes: InglesMensaje[]): Record<InglesModo, ChatMsg[]> {
  const grupos = Object.fromEntries(MODOS.map((m) => [m, [] as ChatMsg[]])) as Record<InglesModo, ChatMsg[]>;
  for (const m of mensajes) grupos[m.modo]?.push({ role: m.role, content: m.content });
  return grupos;
}

function bienvenidaReto(reto: InglesReto): string {
  return `¡Reto de hoy: ${reto.titulo}! Escríbeme la frase 1 en inglés: "${reto.frases[0].en}" (puedes adaptarla a tu caso). Te corrijo y seguimos con la 2 y la 3.`;
}

export function InglesChat(props: Props) {
  const { displayName, perfilInicial, mensajesIniciales, saldoInicial, paquetes, maxCaracteres, compra, reto } = props;
  const [perfil, setPerfil] = useState<InglesPerfil>(perfilInicial);
  const [mensajes, setMensajes] = useState(() => agrupar(mensajesIniciales));
  const [saldo, setSaldo] = useState<Saldo>(saldoInicial);
  const [enLista, setEnLista] = useState(props.enListaEspera);
  const [limite, setLimite] = useState(saldoInicial.gratisRestantes === 0 && saldoInicial.creditos === 0);
  const aviso = useAvisoCompra(compra, saldoInicial.creditos, (nuevo) => {
    setSaldo(nuevo);
    setLimite(false);
  });
  const [enReto, setEnReto] = useState(false);
  const [mensajesReto, setMensajesReto] = useState<ChatMsg[]>(props.mensajesRetoIniciales);
  const [avance, setAvance] = useState<InglesRetoAvance>(props.avanceInicial);
  const [racha, setRacha] = useState<InglesRacha>(props.rachaInicial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, mensajesReto, perfil.modo, enReto, loading, limite, avance.completado]);

  function cambiarPerfil(nuevo: InglesPerfil) {
    setPerfil(nuevo);
    setEnReto(false);
    void fetch("/api/ingles/perfil", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nuevo),
    });
  }

  /** Envía lo escrito en la caja, o el texto de un botón de sugerencia (al chat o al reto). */
  async function enviar(directo?: string) {
    const texto = (directo ?? input).trim();
    if (limite) return;
    if (!texto || loading) return;
    const modo = perfil.modo;
    const delReto = enReto;

    const agregar = (m: ChatMsg) =>
      delReto
        ? setMensajesReto((prev) => [...prev, m])
        : setMensajes((prev) => ({ ...prev, [modo]: [...prev[modo], m] }));

    setInput("");
    setError(null);
    agregar({ role: "user", content: texto });
    setLoading(true);

    // Si el mensaje no se procesó, se quita de la pantalla y vuelve a la caja.
    const deshacer = () => {
      if (delReto) setMensajesReto((prev) => prev.slice(0, -1));
      else setMensajes((prev) => ({ ...prev, [modo]: prev[modo].slice(0, -1) }));
      setInput(texto);
    };

    try {
      const res = await fetch(delReto ? "/api/ingles/reto" : "/api/ingles/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(delReto ? { message: texto, nivel: perfil.nivel } : { message: texto, ...perfil }),
      });
      const data = (await res.json()) as Respuesta;
      if (data.saldo) setSaldo(data.saldo);
      if (data.racha) setRacha(data.racha);

      if (data.estado === "limite_alcanzado") {
        deshacer();
        setLimite(true);
        return;
      }
      if (!res.ok || !data.reply) throw new Error(data.error ?? "Error al consultar a la tutora");

      agregar({ role: "assistant", content: data.reply });
      if (data.avance) setAvance(data.avance);
    } catch (err) {
      deshacer();
      setError(err instanceof Error ? err.message : "Error al consultar a la tutora");
    } finally {
      setLoading(false);
    }
  }

  async function borrarConversacion() {
    if (!confirm("¿Borrar la conversación de este modo? Esto no devuelve mensajes ya usados.")) return;
    const modo = perfil.modo;
    await fetch("/api/ingles/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modo }),
    });
    setMensajes((prev) => ({ ...prev, [modo]: [] }));
  }

  const pron = !enReto && perfil.modo === "pronunciacion";
  const actuales = enReto ? mensajesReto : mensajes[perfil.modo];

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: `1px solid ${GOLD}33` }}
    >
      <InglesEncabezado subtitulo={`Hola, ${displayName}`} separacionAncha="gap-1">
        <InglesInstalar />
        {!pron && !enReto && (
          <button
            onClick={borrarConversacion}
            className="p-2 rounded-lg transition-colors shrink-0"
            style={{ color: "var(--color-text-muted)" }}
            title="Borrar conversación"
            aria-label="Borrar conversación"
          >
            <Trash2 size={16} />
          </button>
        )}
      </InglesEncabezado>

      <InglesOpciones perfil={perfil} onCambiar={cambiarPerfil} />

      <div className="px-5 py-2 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <InglesSaldo saldo={saldo} mostrarCreditos={props.pagosActivos} racha={racha} />
      </div>

      {reto && (
        <InglesRetoTarjeta
          reto={reto}
          avance={avance}
          enReto={enReto}
          onEmpezar={() => {
            setError(null);
            setEnReto(true);
          }}
          onSalir={() => setEnReto(false)}
        />
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {aviso && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}55`, color: "var(--color-text)" }}
          >
            {aviso}
          </div>
        )}

        {pron ? (
          <InglesPronunciacion
            nivel={perfil.nivel}
            costo={props.costoPronunciacion}
            maxSegundos={props.pronMaxSegundos}
            saldo={saldo}
            paquetes={paquetes}
            fraseInicial={props.fraseInicial}
            progresoInicial={props.progresoInicial}
            onSaldo={setSaldo}
            pagosActivos={props.pagosActivos}
            enLista={enLista}
            onApuntado={() => setEnLista(true)}
          />
        ) : (
          <InglesMensajes
            mensajes={actuales}
            bienvenida={enReto && reto ? bienvenidaReto(reto) : BIENVENIDA[perfil.modo]}
            escribiendo={loading}
            sugerencias={limite || enReto ? undefined : SUGERENCIAS[perfil.modo as keyof typeof SUGERENCIAS]}
            onSugerencia={(t) => void enviar(t)}
          />
        )}

        {enReto && avance.completado && !loading && <InglesRetoLogro racha={racha} />}

        {!pron && error && (
          <div
            className="px-4 py-3 rounded-2xl text-sm"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "var(--color-destructive)",
            }}
          >
            {error}
          </div>
        )}

        {!pron && limite && (
          <InglesAvisoLimite
            pagosActivos={props.pagosActivos}
            paquetes={paquetes}
            gratisDiarios={saldo.gratisDiarios}
            enLista={enLista}
            onApuntado={() => setEnLista(true)}
          />
        )}
      </div>

      <InglesEntrada
        valor={input}
        onCambiar={setInput}
        onEnviar={() => void enviar()}
        bloqueada={limite}
        enviando={loading}
        placeholder={
          limite
            ? "Llegaste al límite de hoy"
            : enReto
              ? "Escribe la frase del reto en inglés..."
              : "Escribe en inglés (o en español si no sabes cómo decirlo)..."
        }
        maxCaracteres={maxCaracteres}
        conCaja={!pron}
      />
    </div>
  );
}
