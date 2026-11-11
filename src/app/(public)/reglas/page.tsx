// src/app/(public)/reglas/page.tsx
// Reglas de los juegos y de la Liga. Las cifras salen de src/lib/liga/config.ts
// para que esta página nunca diga algo distinto a lo que hace el sitio.
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { TEXTO_PARA_TODOS, TEXTO_REGLA_PARTICIPACION } from "@/lib/reglas";
import { DENOMINACIONES, LIGA_DIAS_CAMBIO, LIGA_MAX_POR_PARTIDA, LIGA_PUNTOS, LIGA_TOPE_DIARIO } from "@/lib/liga/config";
import { NOMBRE_AMIGOS } from "@/lib/liga/nombre";

export const metadata: Metadata = {
  title: "Reglas de los juegos — Elim LLDM",
  description: "Reglas de los juegos y de la Liga de Iglesias de Elim LLDM. Todos son bienvenidos.",
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <h2 className="text-base font-bold" style={{ color: "var(--color-text)" }}>{titulo}</h2>
      <div className="text-sm flex flex-col gap-2" style={{ color: "var(--color-text-muted)" }}>{children}</div>
    </section>
  );
}

export default function ReglasPage() {
  const p = LIGA_PUNTOS;
  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-10 flex flex-col gap-5">
        <header className="flex flex-col items-center text-center gap-3">
          <ScrollText size={32} style={{ color: "var(--color-primary)" }} />
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>Reglas de los juegos</h1>
          <p className="text-base font-semibold" style={{ color: "var(--color-primary)" }}>{TEXTO_PARA_TODOS}</p>
        </header>

        <Seccion titulo="Tu nombre y tu foto">
          <p>{TEXTO_REGLA_PARTICIPACION}</p>
          <p>Tu nombre para mostrar lo eliges tú en tu perfil: puede ser tu nombre o un apodo, por ejemplo &quot;Hermano Juan GDL&quot;.</p>
        </Seccion>

        <Seccion titulo="Los equipos de la Liga">
          <p><strong>Iglesia de [Ciudad]</strong>: para los miembros de la Iglesia La Luz del Mundo, según la ciudad de su iglesia.</p>
          <p><strong>[Denominación] · [Ciudad]</strong>: para hermanos de otras iglesias ({DENOMINACIONES.join(", ")}).</p>
          <p><strong>{NOMBRE_AMIGOS}</strong>: para quien no pertenece a ninguna iglesia o prefiere no decir.</p>
          <p>Todos compiten en la misma Liga y con las mismas reglas.</p>
        </Seccion>

        <Seccion titulo="Cómo se ganan puntos">
          <p>Palabra del Día resuelta: {p.palabraBase} puntos, más {p.palabraPorIntentoSobrante} por cada intento que te sobró.</p>
          <p>Trivia en línea: {p.triviaPorCorrecta} punto por respuesta correcta (máximo {LIGA_MAX_POR_PARTIDA.trivia} por partida).</p>
          <p>La Ruleta en línea: {p.ruletaPorLetra} punto por letra acertada y {p.ruletaPorResolver} por resolver la frase (máximo {LIGA_MAX_POR_PARTIDA.ruleta} por partida).</p>
          <p>Ahorcado: {p.ahorcadoPorPalabra} puntos por palabra ganada.</p>
          <p>Máximo {LIGA_TOPE_DIARIO} puntos por juego al día para cada jugador.</p>
          <p>Las partidas sin iniciar sesión no suman puntos.</p>
        </Seccion>

        <Seccion titulo="La semana y el campeón">
          <p>La semana va de lunes a domingo, hora del Pacífico. Cada lunes se anuncia el equipo campeón, que lleva una 🏆 durante la semana siguiente, y la tabla empieza de cero.</p>
        </Seccion>

        <Seccion titulo="Elegir y cambiar de equipo">
          <p>Eliges tu equipo una vez y puedes cambiarlo una vez cada {LIGA_DIAS_CAMBIO} días. Salir de {NOMBRE_AMIGOS} siempre se puede.</p>
          <p>Si tu iglesia no aparece, puedes agregarla. Queda pendiente hasta que la aprobemos, y tus puntos se guardan desde ya.</p>
        </Seccion>

        <Seccion titulo="Juego limpio">
          <p>Juega con una sola cuenta y sin trampas. Si vemos algo que no es justo, podemos quitar puntos, corregir equipos o juntar iglesias repetidas.</p>
        </Seccion>
      </div>
    </div>
  );
}
