-- ============================================================
-- Arena Abierta — sala pública de trivia, siempre abierta
--
-- A diferencia de elim_arena_* (que requiere que un admin/anfitrión cree
-- una sala y comparta un código), esta es UNA sola sala "actual" en todo
-- momento: cualquiera entra a /arena-abierta, pone su nombre, y cuando
-- hay 2+ jugadores arranca sola. No hay host — el servidor genera las
-- preguntas (sorteadas del banco público de question_sets) y el juego
-- avanza de fase solo, por temporizador, sin que nadie tenga que darle
-- a "Siguiente". Cuando termina, la próxima visita a la página crea una
-- sala nueva lista para jugar — no hace falta ningún cron job.
--
-- Sin GRANTs de INSERT/UPDATE para anon/authenticated a propósito: como
-- no hay un usuario "dueño" de la sala (nadie la crea), toda escritura
-- pasa por rutas API con el service role client.
-- ============================================================

CREATE TABLE arena_publica_salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'counting', 'playing', 'reveal', 'finished')),
  pregunta_actual INT NOT NULL DEFAULT 0,
  cuenta_termina_en TIMESTAMPTZ,
  pregunta_termina_en TIMESTAMPTZ,
  reveal_termina_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE arena_publica_preguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES arena_publica_salas(id) ON DELETE CASCADE,
  pregunta TEXT NOT NULL,
  opcion_a TEXT NOT NULL,
  opcion_b TEXT NOT NULL,
  opcion_c TEXT NOT NULL,
  opcion_d TEXT NOT NULL,
  orden INT NOT NULL,
  UNIQUE (sala_id, orden)
);

-- La respuesta correcta vive aparte, sin ninguna policy/GRANT público —
-- mismo patrón que ruleta_rondas en 0016_ruleta_online.sql. Si viviera en
-- arena_publica_preguntas (que sí es públicamente legible, para que
-- cualquiera vea el texto de la pregunta y las opciones), cualquiera
-- podría consultarla por la API REST antes de responder.
CREATE TABLE arena_publica_respuestas_correctas (
  pregunta_id UUID PRIMARY KEY REFERENCES arena_publica_preguntas(id) ON DELETE CASCADE,
  respuesta_correcta TEXT NOT NULL CHECK (respuesta_correcta IN ('a','b','c','d'))
);

ALTER TABLE arena_publica_respuestas_correctas ENABLE ROW LEVEL SECURITY;
-- Sin policies, sin GRANTs para anon/authenticated a propósito — solo el
-- service role (que ignora RLS) puede leerla.

CREATE TABLE arena_publica_jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES arena_publica_salas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  puntos INT NOT NULL DEFAULT 0,
  ultimo_respondido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE arena_publica_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES arena_publica_salas(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL REFERENCES arena_publica_jugadores(id) ON DELETE CASCADE,
  pregunta_id UUID NOT NULL REFERENCES arena_publica_preguntas(id) ON DELETE CASCADE,
  respuesta TEXT NOT NULL CHECK (respuesta IN ('a','b','c','d')),
  es_correcta BOOLEAN NOT NULL,
  tiempo_ms INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pregunta_id, jugador_id)
);

CREATE INDEX idx_arena_publica_salas_status ON arena_publica_salas(status);
-- A lo sumo una sala "no terminada" a la vez. Esto es lo que realmente
-- evita la condición de carrera de getOrCreateOpenRoom() (dos requests que
-- no ven ninguna sala abierta e intentan crear una cada uno): si dos
-- INSERT llegan casi al mismo tiempo, Postgres deja pasar el primero y
-- rechaza el segundo con una violación de unicidad (23505), que la app
-- atrapa y resuelve re-consultando la sala que sí se creó.
CREATE UNIQUE INDEX idx_arena_publica_salas_una_abierta
  ON arena_publica_salas ((1))
  WHERE status <> 'finished';
CREATE INDEX idx_arena_publica_preguntas_sala ON arena_publica_preguntas(sala_id, orden);
CREATE INDEX idx_arena_publica_jugadores_sala ON arena_publica_jugadores(sala_id);
CREATE INDEX idx_arena_publica_respuestas_sala ON arena_publica_respuestas(sala_id, pregunta_id);

ALTER TABLE arena_publica_salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_publica_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_publica_jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_publica_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_publica_salas_select_all" ON arena_publica_salas FOR SELECT USING (TRUE);
CREATE POLICY "arena_publica_preguntas_select_all" ON arena_publica_preguntas FOR SELECT USING (TRUE);
CREATE POLICY "arena_publica_jugadores_select_all" ON arena_publica_jugadores FOR SELECT USING (TRUE);
CREATE POLICY "arena_publica_respuestas_select_all" ON arena_publica_respuestas FOR SELECT USING (TRUE);

GRANT SELECT ON arena_publica_salas TO anon, authenticated;
GRANT SELECT ON arena_publica_preguntas TO anon, authenticated;
GRANT SELECT ON arena_publica_jugadores TO anon, authenticated;
GRANT SELECT ON arena_publica_respuestas TO anon, authenticated;
-- Sin GRANT de INSERT/UPDATE — todo escribe con el service role client.

ALTER PUBLICATION supabase_realtime ADD TABLE arena_publica_salas;
ALTER PUBLICATION supabase_realtime ADD TABLE arena_publica_jugadores;
