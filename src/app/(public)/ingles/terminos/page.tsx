import Link from "next/link";
import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { inglesConfig, inglesPaquetes, pagosActivos } from "@/lib/ingles/config";
import { ETIQUETA_PAQUETE, formatoPrecio } from "@/lib/ingles/etiquetas";

export const metadata: Metadata = {
  title: "Términos de Elim English — Elim LLDM",
  description: "Términos de uso y política de reembolso del tutor de inglés Elim English.",
};

const CORREO = "contacto@elimlldm.net";
const ACTUALIZADA = "7 de octubre de 2026";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
        {titulo}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {children}
      </div>
    </section>
  );
}

export default function InglesTerminosPage() {
  const { gratisDiarios, vozGratisDiarios } = inglesConfig();
  const paquetes = inglesPaquetes();
  // ENGLISH_PAYMENTS_ENABLED: con la venta pausada el servicio es solo gratuito.
  const conPagos = pagosActivos();
  const enlace = { color: "var(--color-primary)" } as const;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col gap-10">
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <FileText size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
            Términos de Elim English
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Última actualización: {ACTUALIZADA}
          </p>
        </div>

        <Seccion titulo="Qué es Elim English">
          <p>
            Elim English es un tutor de inglés por chat que funciona con inteligencia artificial. Sirve para practicar
            conversación, situaciones de la vida diaria, gramática y vocabulario. Es una herramienta de práctica: no es
            un curso certificado ni sustituye a un maestro, y la tutora puede equivocarse.
          </p>
        </Seccion>

        <Seccion titulo="Cuenta y uso aceptable">
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li>Necesitas una cuenta de Elim LLDM con sesión iniciada para usar Elim English.</li>
            <li>
              Úsalo para aprender inglés con respeto. No envíes contenido ofensivo, datos personales sensibles ni
              información de otras personas.
            </li>
            <li>
              Podemos suspender el acceso a quien abuse del servicio (por ejemplo, con envíos automatizados o contenido
              inapropiado).
            </li>
            <li>
              Tus mensajes se envían a nuestro proveedor de inteligencia artificial solo para generar la respuesta de la
              tutora, y se guardan en tu historial para que puedas continuar la conversación. Puedes borrar tu historial
              desde la misma pantalla.
            </li>
          </ul>
        </Seccion>

        {conPagos ? (
          <Seccion titulo="Mensajes gratis y créditos">
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                Cada usuario tiene {gratisDiarios} mensajes gratis al día. Se renuevan a medianoche, hora del Pacífico,
                y los que no uses no se acumulan.
              </li>
              <li>Cuando se acaban los gratis, cada mensaje que envías a la tutora usa un crédito.</li>
              <li>
                Paquetes disponibles:{" "}
                {paquetes
                  .map(
                    (p) =>
                      `${ETIQUETA_PAQUETE[p.id]}: ${p.mensajes.toLocaleString("es-MX")} mensajes por ${formatoPrecio(p.precioCentavos, p.moneda)}`,
                  )
                  .join("; ")}
                . Es un pago único, no una suscripción: no hay cargos automáticos.
              </li>
              <li>
                Los créditos comprados no caducan mientras el servicio exista y no se pueden transferir a otra cuenta.
              </li>
              <li>Si un mensaje falla por un error nuestro, no se descuenta.</li>
              <li>
                La práctica de voz tiene su propio límite: {vozGratisDiarios} intentos gratis al día, aparte de los
                mensajes. Si no se detecta tu voz o la evaluación falla, el intento no se cuenta.
              </li>
            </ul>
          </Seccion>
        ) : (
          <Seccion titulo="Servicio gratuito">
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                Por ahora Elim English es gratuito y no hay compras disponibles: no se te cobrará nada ni se te pedirán
                datos de pago.
              </li>
              <li>
                Cada usuario tiene {gratisDiarios} mensajes gratis al día. Se renuevan a medianoche, hora del Pacífico,
                y los que no uses no se acumulan.
              </li>
              <li>
                La práctica de voz (modo Pronunciación y las frases para practicar dentro del chat) tiene su propio
                límite: {vozGratisDiarios} intentos gratis al día, aparte de los mensajes, que también se renuevan a
                medianoche, hora del Pacífico. Si no se detecta tu voz o la evaluación falla, el intento no se cuenta.
              </li>
              <li>Si un mensaje falla por un error nuestro, no se descuenta.</li>
              <li>
                Cuando llegues al límite del día puedes pedir que te avisemos si en el futuro hay más mensajes
                disponibles.
              </li>
            </ul>
          </Seccion>
        )}

        <Seccion titulo="Modo Pronunciación y tu voz">
          <p>
            En el modo Pronunciación, la grabación de tu voz se envía a un servicio externo de reconocimiento de voz
            (Microsoft Azure Speech) solo para evaluar tu pronunciación de la frase. El audio no se almacena: ni
            nosotros ni la página lo guardamos después de la evaluación. Solo guardamos el resultado (la frase, los
            puntajes y las palabras o sonidos con errores) para mostrarte tu progreso. El micrófono solo se activa
            cuando tocas el botón de grabar.
          </p>
        </Seccion>

        {conPagos && (
          <>
            <Seccion titulo="Pagos">
              <p>
                Los pagos los procesa Stripe. Elim LLDM nunca ve ni guarda los datos de tu tarjeta; solo guardamos el
                registro de la compra (paquete, monto, fecha e identificador del pago).
              </p>
            </Seccion>

            <Seccion titulo="Política de reembolso">
              <ul className="list-disc pl-5 flex flex-col gap-2">
                <li>
                  Puedes pedir el reembolso completo dentro de los 14 días posteriores a la compra si no has usado
                  ningún crédito de ese paquete.
                </li>
                <li>
                  Si ya usaste parte de los créditos, podemos reembolsar la parte proporcional de los créditos no
                  usados, revisando cada caso.
                </li>
                <li>
                  Si se te cobró dos veces o el pago se hizo pero no recibiste los créditos, te devolvemos el cobro
                  duplicado o acreditamos lo que falta.
                </li>
                <li>
                  Para pedir un reembolso, escribe a{" "}
                  <a href={`mailto:${CORREO}`} style={enlace}>
                    {CORREO}
                  </a>{" "}
                  desde el correo de tu cuenta, con la fecha de la compra. Al reembolsar se retiran los créditos
                  correspondientes.
                </li>
              </ul>
            </Seccion>
          </>
        )}

        <Seccion titulo="Cambios">
          {conPagos ? (
            <p>
              Podemos cambiar los precios, los paquetes o el número de mensajes gratis. Los cambios no afectan los
              créditos que ya compraste. Si cambian estos términos, lo avisaremos en esta página.
            </p>
          ) : (
            <p>
              Podemos cambiar el número de mensajes gratis o, más adelante, ofrecer paquetes de mensajes de pago. Si eso
              pasa, lo avisaremos en esta página antes de cobrar cualquier cosa.
            </p>
          )}
        </Seccion>

        <p className="text-center text-sm">
          <Link href="/ingles" style={enlace}>
            ← Volver a Elim English
          </Link>
        </p>
      </div>
    </div>
  );
}
