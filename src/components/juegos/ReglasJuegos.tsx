// Texto de "Cómo se juega" de cada juego. Los números salen de la misma
// configuración que usa el juego, para que las reglas no se desactualicen.
import {
  ANSWER_SECONDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RESOLVE_BONUS,
  ROUNDS_DEFAULT,
  TURN_SECONDS,
  VOWEL_COST,
} from "@/lib/ruleta/wheel";
import {
  MAX_JUGADORES_POR_SALA,
  MIN_JUGADORES_PARA_INICIAR,
  PREGUNTAS_POR_PARTIDA,
  ROUND_SECONDS,
} from "@/lib/arena-publica/config";

// Igual que VIDAS_INICIALES en AhorcadoGame.
const VIDAS_AHORCADO = 6;

const texto = { color: "var(--color-text)" } as const;
const tenue = { color: "var(--color-text-muted)" } as const;

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
        {titulo}
      </p>
      <ul className="list-disc pl-5 flex flex-col gap-1" style={texto}>
        {children}
      </ul>
    </div>
  );
}

export function ReglasRuleta() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p style={texto}>
        Adivina la frase bíblica escondida en el panel. De {MIN_PLAYERS} a {MAX_PLAYERS} jugadores, por turnos.
        La partida es de {ROUNDS_DEFAULT} rondas, una frase por ronda.
      </p>
      <Seccion titulo="En tu turno">
        <li>Tienes {TURN_SECONDS} segundos. Si se acaba el tiempo, pasa al siguiente jugador.</li>
        <li>
          <strong>Gira la ruleta.</strong> Si cae en puntos, elige una consonante (tienes {ANSWER_SECONDS} segundos
          cuando deja de girar). Ganas esos puntos por cada vez que aparece la letra.
        </li>
        <li>Si la letra está, sigues jugando: puedes girar otra vez, comprar vocal o resolver.</li>
        <li>Si la letra no está, pasa el turno.</li>
        <li>
          <strong>Comprar vocal</strong> cuesta {VOWEL_COST} puntos. Si la vocal no está, pasa el turno.
        </li>
      </Seccion>
      <Seccion titulo="Casillas especiales">
        <li>
          <strong>BANCARROTA:</strong> pierdes todos tus puntos y pasa el turno.
        </li>
        <li>
          <strong>PIERDE TURNO:</strong> pasa al siguiente jugador.
        </li>
      </Seccion>
      <Seccion titulo="Resolver el panel">
        <li>Cuando creas saber la frase, escríbela completa o toca el 🎤 micrófono y dila en voz alta.</li>
        <li>Los acentos y la puntuación no importan.</li>
        <li>Si aciertas, ganas {RESOLVE_BONUS} puntos extra y la ronda. Si fallas, pasa el turno (no pierdes puntos).</li>
      </Seccion>
      <p style={tenue}>Al final gana quien tenga más puntos. Puedes activar el chat de voz para hablar con los demás.</p>
    </div>
  );
}

export function ReglasTrivia() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p style={texto}>
        Preguntas bíblicas de opción múltiple contra otros jugadores en tiempo real. De {MIN_JUGADORES_PARA_INICIAR} a{" "}
        {MAX_JUGADORES_POR_SALA} jugadores.
      </p>
      <Seccion titulo="Cómo se juega">
        <li>La partida empieza sola cuando hay al menos {MIN_JUGADORES_PARA_INICIAR} jugadores en la sala.</li>
        <li>Son {PREGUNTAS_POR_PARTIDA} preguntas. Cada una dura {ROUND_SECONDS} segundos.</li>
        <li>
          Se empieza con preguntas fáciles y, cuando la mayoría acierta, se sube a normales y luego a difíciles.
        </li>
        <li>Nunca te sale una pregunta que ya hayas visto.</li>
        <li>Toca la respuesta que creas correcta. Solo cuenta tu primera respuesta.</li>
        <li>Después de cada pregunta se muestra la respuesta correcta y el marcador.</li>
      </Seccion>
      <Seccion titulo="Puntos">
        <li>Respuesta correcta: de 100 a 1,000 puntos. Mientras más rápido contestes, más ganas.</li>
        <li>Respuesta incorrecta o sin contestar: 0 puntos.</li>
      </Seccion>
      <p style={tenue}>Al final gana quien tenga más puntos.</p>
    </div>
  );
}

export function ReglasAhorcado() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p style={texto}>
        Adivina la palabra del Nuevo Testamento (personajes, lugares, palabras clave y libros) letra por letra. Es de
        un jugador.
      </p>
      <Seccion titulo="Cómo se juega">
        <li>Toca una letra. Si está en la palabra, se descubre en todos los lugares donde aparece.</li>
        <li>Si no está, pierdes una vida. Tienes {VIDAS_AHORCADO} vidas por palabra.</li>
        <li>Si te atoras, lee la pista de la palabra.</li>
      </Seccion>
      <Seccion titulo="Puntos">
        <li>Al adivinar la palabra ganas 10 puntos por cada vida que te quede.</li>
        <li>Con &quot;Siguiente palabra&quot; sigues sumando puntos. &quot;Reiniciar juego&quot; empieza de cero.</li>
        <li>Si tienes sesión iniciada, tu mejor récord se guarda en la tabla de posiciones.</li>
      </Seccion>
    </div>
  );
}

export function ReglasRuletaLocal() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p style={texto}>
        La Ruleta para jugar en <strong>un solo dispositivo</strong>: en familia, en clase o con amigos, pasándose el
        teléfono o viendo la misma pantalla.
      </p>
      <Seccion titulo="Cómo se juega">
        <li>Al empezar eligen el número de jugadores y cuántas rondas hay que ganar.</li>
        <li>En su turno, cada jugador gira la ruleta y elige una consonante. Gana esos puntos por cada vez que aparece.</li>
        <li>Comprar una vocal cuesta {VOWEL_COST} puntos.</li>
        <li>BANCARROTA: pierdes todos tus puntos y el turno. PIERDE TURNO: pasa al siguiente jugador.</li>
        <li>Cuando alguien sepa la frase, toca &quot;Resolver Panel&quot; y la escribe completa.</li>
      </Seccion>
      <p style={tenue}>Gana quien llegue primero al número de rondas elegido.</p>
    </div>
  );
}
