"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { InglesMensajes } from "./InglesMensajes";
import { InglesOpciones } from "./InglesOpciones";
import { InglesChatAvisos } from "./InglesChatAvisos";
import { InglesPronunciacion } from "./InglesPronunciacion";
import { InglesSaldo } from "./InglesSaldo";
import { InglesInstalar } from "./InglesInstalar";
import { InglesEncabezado } from "./InglesEncabezado";
import { InglesEntrada } from "./InglesEntrada";
import { InglesRetoTarjeta } from "./InglesRetoTarjeta";
import { InglesPronunciacionAtajo } from "./InglesPronunciacionAtajo";
import { InglesRetoLogro } from "./InglesRetoLogro";
import { useAvisoCompra } from "./useAvisoCompra";
import { VozContext, type ContextoVoz } from "./contextoVoz";
import { agrupar, bienvenidaReto, type ChatMsg, type RespuestaChat as Respuesta } from "./chatAyudas";
import { BIENVENIDA, SUGERENCIAS } from "@/lib/ingles/etiquetas";
import type {
  EncuestasUsuario,
  InglesMensaje,
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

interface Props {
  displayName: string;
  perfilInicial: InglesPerfil;
  mensajesIniciales: InglesMensaje[];
  saldoInicial: Saldo;
  paquetes: InglesPaquete[];
  maxCaracteres: number;
  compra: "ok" | "cancelada" | null;
  /** Grabaciones de voz (modo Pronunciación y tarjetas del chat). */
  pronMaxSegundos: number;
  fraseInicial: PronFrase | null;
  progresoInicial: PronProgreso;
  /** ENGLISH_PAYMENTS_ENABLED y si el usuario ya está en la lista de espera. */
  pagosActivos: boolean;
  enListaEspera: boolean;
  /** Respuestas que ya dio a las encuestas "¿Pagarías…?". */
  encuestas: EncuestasUsuario;
  /** Reto del día (null si no se pudo cargar), su conversación de hoy y la racha. */
  reto: InglesReto | null;
  avanceInicial: InglesRetoAvance;
  mensajesRetoIniciales: ChatMsg[];
  rachaInicial: InglesRacha;
}

export function InglesChat(props: Props) {
  const { displayName, perfilInicial, mensajesIniciales, saldoInicial, paquetes, maxCaracteres, compra, reto } = props;
  const [perfil, setPerfil] = useState<InglesPerfil>(perfilInicial);
  const [mensajes, setMensajes] = useState(() => agrupar(mensajesIniciales));
  const [saldo, setSaldo] = useState<Saldo>(saldoInicial);
  const [enLista, setEnLista] = useState(props.enListaEspera);
  const [encuestas, setEncuestas] = useState<EncuestasUsuario>(props.encuestas);
  const [limite, setLimite] = useState(saldoInicial.gratisRestantes === 0 && saldoInicial.creditos === 0);
  // Se muestra el aviso de voz solo cuando intenta usar la voz sin intentos.
  const [limiteVoz, setLimiteVoz] = useState(false);
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
  }, [mensajes, mensajesReto, perfil.modo, enReto, loading, limite, limiteVoz, avance.completado]);

  // Tarjetas de voz del chat (🔊/🎤): usan el contador de voz de hoy.
  const voz = useMemo<ContextoVoz>(
    () => ({
      prueba: false,
      nivel: perfil.nivel,
      maxSegundos: props.pronMaxSegundos,
      restantes: saldo.vozRestantes,
      actualizar: ({ saldo: nuevo }) => {
        if (nuevo) setSaldo(nuevo);
      },
      alLimite: () => setLimiteVoz(true),
    }),
    [perfil.nivel, props.pronMaxSegundos, saldo.vozRestantes],
  );

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

      agregar({ id: data.mensajeId ?? undefined, role: "assistant", content: data.reply });
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
  const guardarEncuesta = (tipo: keyof EncuestasUsuario, r: NonNullable<EncuestasUsuario["voz"]>) =>
    setEncuestas((prev) => ({ ...prev, [tipo]: r }));

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

      {!pron && !enReto && (
        <InglesPronunciacionAtajo onAbrir={() => cambiarPerfil({ ...perfil, modo: "pronunciacion" })} />
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
            maxSegundos={props.pronMaxSegundos}
            saldo={saldo}
            fraseInicial={props.fraseInicial}
            progresoInicial={props.progresoInicial}
            onSaldo={setSaldo}
            encuestaVoz={encuestas.voz}
            onEncuestaVoz={(r) => guardarEncuesta("voz", r)}
          />
        ) : (
          <VozContext.Provider value={voz}>
            <InglesMensajes
              mensajes={actuales}
              bienvenida={enReto && reto ? bienvenidaReto(reto) : BIENVENIDA[perfil.modo]}
              escribiendo={loading}
              sugerencias={limite || enReto ? undefined : SUGERENCIAS[perfil.modo as keyof typeof SUGERENCIAS]}
              onSugerencia={(t) => void enviar(t)}
            />
          </VozContext.Provider>
        )}

        {enReto && avance.completado && !loading && <InglesRetoLogro racha={racha} />}

        {!pron && (
          <InglesChatAvisos
            error={error}
            limite={limite}
            limiteVoz={limiteVoz && saldo.vozRestantes <= 0}
            mensajesRestantes={saldo.gratisRestantes}
            pagosActivos={props.pagosActivos}
            paquetes={paquetes}
            gratisDiarios={saldo.gratisDiarios}
            enLista={enLista}
            onApuntado={() => setEnLista(true)}
            encuestas={encuestas}
            onEncuesta={guardarEncuesta}
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
