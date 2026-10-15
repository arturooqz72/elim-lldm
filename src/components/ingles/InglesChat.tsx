"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { InglesSaludo } from "./InglesSaludo";
import { useSaludoTutora } from "./useSaludoTutora";
import { useEnvioTutora } from "./useEnvioTutora";
import { InglesBorrarConversacion } from "./InglesBorrarConversacion";
import { InglesAvisoRecordatorio, InglesCampana } from "./InglesRecordatorio";
import { VozContext, type ContextoVoz } from "./contextoVoz";
import { agrupar, bienvenidaReto, type ChatMsg } from "./chatAyudas";
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
  /** Con lo que la tutora abre el chat (ya escrito; elegido en el servidor). */
  saludoInicial: string;
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
  // Ya contestó la tutora en esta visita: entonces se ofrece el recordatorio.
  const [huboRespuesta, setHuboRespuesta] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const { saludo, fijar, tocar } = useSaludoTutora({
    inicial: props.saludoInicial,
    agregarLocales: (nuevos, deBoton) =>
      setMensajes((prev) => {
        const modo = deBoton ? "conversacion" : perfil.modo;
        return { ...prev, [modo]: [...prev[modo], ...nuevos] };
      }),
    abrirPronunciacion: () => cambiarPerfil({ ...perfil, modo: "pronunciacion" }),
    abrirReto: () => {
      setError(null);
      setEnReto(true);
    },
    ponerPrincipiante: () => cambiarPerfil({ ...perfil, nivel: "principiante", modo: "conversacion" }),
    alPlaticar: () => {
      if (perfil.modo !== "conversacion") cambiarPerfil({ ...perfil, modo: "conversacion" });
    },
  });

  const { input, setInput, loading, error, setError, enviar } = useEnvioTutora({
    perfil,
    enReto,
    limite,
    antes: () => fijar(),
    agregar: (m, delReto, modo) =>
      delReto
        ? setMensajesReto((prev) => [...prev, m])
        : setMensajes((prev) => ({ ...prev, [modo]: [...prev[modo], m] })),
    quitarUltimo: (delReto, modo) =>
      delReto
        ? setMensajesReto((prev) => prev.slice(0, -1))
        : setMensajes((prev) => ({ ...prev, [modo]: prev[modo].slice(0, -1) })),
    alResponder: (data) => {
      if (data.saldo) setSaldo(data.saldo);
      if (data.racha) setRacha(data.racha);
      if (data.avance) setAvance(data.avance);
      if (data.reply) setHuboRespuesta(true);
    },
    alLimite: () => setLimite(true),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, mensajesReto, perfil.modo, enReto, loading, limite, limiteVoz, avance.completado]);

  function cambiarPerfil(nuevo: InglesPerfil) {
    setPerfil(nuevo);
    setEnReto(false);
    void fetch("/api/ingles/perfil", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nuevo),
    });
  }

  const pron = !enReto && perfil.modo === "pronunciacion";
  const conSaludo = Boolean(saludo) && !pron && !enReto && !limite;
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
        <InglesCampana />
        {!pron && !enReto && (
          <InglesBorrarConversacion
            modo={perfil.modo}
            onBorrada={(modo) => setMensajes((prev) => ({ ...prev, [modo]: [] }))}
          />
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

      {/* Con el saludo a la vista, su botón 🎤 ya lleva a la voz. */}
      {!pron && !enReto && !conSaludo && (
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
              bienvenida={enReto && reto ? bienvenidaReto(reto) : conSaludo ? null : BIENVENIDA[perfil.modo]}
              escribiendo={loading}
              sugerencias={
                limite || enReto || conSaludo ? undefined : SUGERENCIAS[perfil.modo as keyof typeof SUGERENCIAS]
              }
              onSugerencia={(t) => void enviar(t)}
            />
            {conSaludo && saludo && !loading && (
              <InglesSaludo
                texto={saludo}
                botones={[
                  "pronunciacion",
                  "platicar",
                  ...(reto && !avance.completado ? (["reto"] as const) : []),
                  "principiante",
                ]}
                onBoton={tocar}
              />
            )}
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

        {!pron && <InglesAvisoRecordatorio mostrar={huboRespuesta && !loading && !limite} />}
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
              : "Escribe en inglés..."
        }
        maxCaracteres={maxCaracteres}
        conCaja={!pron}
        onVoz={enReto ? undefined : () => cambiarPerfil({ ...perfil, modo: "pronunciacion" })}
      />
    </div>
  );
}
