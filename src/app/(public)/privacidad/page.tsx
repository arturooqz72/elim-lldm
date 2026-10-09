import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { whatsappHref } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Política de privacidad — Elim LLDM",
  description: "Qué datos guarda Elim LLDM, para qué los usa y cómo pedir que se borren.",
};

const CORREO = "contacto@elimlldm.net";
const ACTUALIZADA = "7 de octubre de 2026";

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-24">
      <h2 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
        {titulo}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacidadPage() {
  const enlace = { color: "var(--color-primary)" } as const;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col gap-10">
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <ShieldCheck size={24} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--color-text)" }}>
            Política de privacidad
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Última actualización: {ACTUALIZADA}
          </p>
        </div>

        <Seccion titulo="Quiénes somos">
          <p>
            Elim LLDM (elimlldm.net) es una plataforma cristiana con radio en vivo, transmisiones, juegos bíblicos y un
            archivo de grabaciones. Esta página explica qué datos guardamos y para qué. No vendemos ni compartimos tus
            datos con anunciantes.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos guardamos">
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li>
              <strong style={{ color: "var(--color-text)" }}>Tu cuenta:</strong> correo electrónico, nombre y foto de
              perfil. Si entras con Google o Facebook, recibimos solo esos datos básicos de tu perfil público, nunca tu
              contraseña.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Lo que tú decides agregar:</strong> la iglesia o ciudad del
              ranking, tu número de WhatsApp si te apuntas a la lista de jugadores, los saludos de audio que grabas y los
              mensajes que nos envías por el formulario de contacto.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Tu actividad en los juegos:</strong> partidas, puntos y
              rachas, para mostrar los rankings.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Datos técnicos:</strong> mientras tienes el sitio abierto,
              qué página estás viendo (para saber cuántas personas están conectadas) y, si las activas, las
              notificaciones del navegador.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Historial de visitas:</strong> qué páginas del sitio abres,
              con fecha y hora. Si tienes cuenta se asocia a tu nombre; si no, a un número aleatorio guardado en tu
              navegador que no te identifica. Solo lo ven los administradores y se borra automáticamente a los 90 días.
            </li>
            <li>
              <strong style={{ color: "var(--color-text)" }}>Elim English:</strong> tu nivel y modo elegidos, tus
              conversaciones con la tutora, los resultados de tus prácticas de pronunciación (frase, puntajes y sonidos a
              mejorar) y, si compras mensajes, el registro de la compra (paquete, monto y fecha). La grabación de tu voz no
              se guarda: solo se usa en el momento para evaluarla.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <p>
            Solo para que el sitio funcione: iniciar sesión, mostrar tu nombre en los juegos y rankings, avisarte cuando
            alguien quiere jugar, poner tu saludo en la radio y responderte cuando nos escribes. Si dejas tu WhatsApp en
            la lista de jugadores, solo lo ven los administradores; los demás miembros te invitan a jugar con un aviso
            dentro del sitio, sin ver tu número.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparten">
          <p>
            Usamos servicios que guardan los datos por nosotros: Supabase (base de datos y cuentas), Vercel (hospedaje),
            Google y Facebook (solo si eliges entrar con ellos) y nuestro proveedor de correo. Ninguno los usa para
            publicidad en nuestro nombre.
          </p>
          <p>
            En Elim English: tus mensajes a la tutora se envían a Anthropic (el proveedor de inteligencia artificial) para
            generar la respuesta; en el modo Pronunciación, tu grabación se envía a Microsoft Azure solo para evaluarla y no
            se almacena; y los pagos los procesa Stripe, así que nunca vemos ni guardamos los datos de tu tarjeta.
          </p>
        </Seccion>

        <Seccion id="eliminar-datos" titulo="Cómo borrar tus datos">
          <p>Puedes pedir que borremos tu cuenta y todos tus datos cuando quieras:</p>
          <ol className="list-decimal pl-5 flex flex-col gap-2">
            <li>
              Escríbenos a{" "}
              <a href={`mailto:${CORREO}?subject=Borrar%20mi%20cuenta`} style={enlace}>
                {CORREO}
              </a>{" "}
              o por{" "}
              <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" style={enlace}>
                WhatsApp
              </a>{" "}
              con el asunto &quot;Borrar mi cuenta&quot;, desde el correo con el que te registraste.
            </li>
            <li>Borramos tu cuenta, tu perfil, tus partidas y lo que hayas agregado en un plazo máximo de 30 días.</li>
            <li>Te confirmamos por el mismo medio cuando esté hecho.</li>
          </ol>
          <p>
            Si entraste con Facebook, también puedes quitarle el acceso a Elim LLDM desde Facebook, en Configuración →
            Apps y sitios web. Eso deja de compartirnos tus datos; para borrar lo que ya tenemos, sigue los pasos de
            arriba.
          </p>
        </Seccion>

        <Seccion titulo="Contacto">
          <p>
            Para cualquier pregunta sobre esta política, escríbenos a{" "}
            <a href={`mailto:${CORREO}`} style={enlace}>
              {CORREO}
            </a>
            .
          </p>
        </Seccion>
      </div>
    </div>
  );
}
