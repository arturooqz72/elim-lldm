-- ============================================================
-- Elim LLDM — La Ruleta en línea (multijugador con código de sala)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Namespace nuevo y aislado /ruleta — no modifica games/trivia_* ni
-- elim_arena_* existentes. Jugadores entran SOLO con su nombre (sin
-- cuenta); el anfitrión (created_by) debe tener sesión. Todas las
-- escrituras (join, spin, guess, next-round...) se hacen desde API
-- routes con el service role client — por eso ruleta_salas y
-- ruleta_jugadores no tienen policies de UPDATE para anon/authenticated,
-- y ruleta_rondas no tiene NINGUNA policy pública: guarda la frase
-- secreta y solo el service role puede leerla, para que ningún cliente
-- pueda ver la respuesta inspeccionando la red antes de que termine la
-- ronda.
-- ============================================================

-- RULETA SALAS
CREATE TABLE ruleta_salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'playing', 'ronda_fin', 'finished')),
  rondas_totales INT NOT NULL DEFAULT 5,
  ronda_actual INT NOT NULL DEFAULT 0,
  turno_jugador_id UUID,
  turno_termina_en TIMESTAMPTZ,
  giro_usado BOOLEAN NOT NULL DEFAULT FALSE,
  puede_consonante BOOLEAN NOT NULL DEFAULT FALSE,
  valor_giro_actual INT,
  frases_usadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ultima_categoria TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RULETA JUGADORES
CREATE TABLE ruleta_jugadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES ruleta_salas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INT NOT NULL,
  puntos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sala_id, orden)
);

-- Ahora que ruleta_jugadores existe, agrega la FK diferida desde ruleta_salas
-- ON DELETE SET NULL: si un jugador se borra mientras tiene el turno,
-- la sala se degrada a turno_jugador_id NULL en vez de fallar el delete.
ALTER TABLE ruleta_salas
  ADD CONSTRAINT ruleta_salas_turno_jugador_fk
  FOREIGN KEY (turno_jugador_id) REFERENCES ruleta_jugadores(id) ON DELETE SET NULL;

-- RULETA RONDAS — tabla privada: guarda la frase secreta de cada ronda.
-- Sin policies públicas ni grants para anon/authenticated a propósito.
CREATE TABLE ruleta_rondas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id UUID NOT NULL REFERENCES ruleta_salas(id) ON DELETE CASCADE,
  ronda_numero INT NOT NULL,
  categoria TEXT NOT NULL,
  frase TEXT NOT NULL,
  letras_adivinadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sala_id, ronda_numero)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_ruleta_salas_codigo ON ruleta_salas(codigo);
CREATE INDEX idx_ruleta_salas_status ON ruleta_salas(status);
CREATE INDEX idx_ruleta_jugadores_sala ON ruleta_jugadores(sala_id);
CREATE INDEX idx_ruleta_rondas_sala ON ruleta_rondas(sala_id, ronda_numero);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE ruleta_salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruleta_jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruleta_rondas ENABLE ROW LEVEL SECURITY;

-- Lectura pública de salas/jugadores (jugadores sin cuenta deben poder
-- ver el estado de su sala en tiempo real)
CREATE POLICY "ruleta_salas_select_all" ON ruleta_salas FOR SELECT USING (TRUE);
CREATE POLICY "ruleta_jugadores_select_all" ON ruleta_jugadores FOR SELECT USING (TRUE);

-- Crear sala: cualquier usuario autenticado (no restringido a admin/anfitrion,
-- a diferencia de elim_arena — este es un juego casual para cualquier
-- miembro de la plataforma)
CREATE POLICY "ruleta_salas_insert_auth" ON ruleta_salas
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ruleta_rondas: RLS habilitado, CERO policies para anon/authenticated
-- (default deny). Solo el service role (que ignora RLS) puede leer/escribir.

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT ON ruleta_salas TO anon, authenticated;
GRANT SELECT ON ruleta_jugadores TO anon, authenticated;
GRANT INSERT ON ruleta_salas TO authenticated;
-- Nota: sin GRANT de UPDATE en ruleta_salas/ruleta_jugadores para
-- anon/authenticated — toda mutación de estado de juego pasa por rutas
-- API con el service role client (validado ahí, no aquí).
-- Sin ningún GRANT en ruleta_rondas para anon/authenticated.

-- ============================================================
-- REALTIME (ruleta_rondas NO se agrega — nunca debe llegar a los clientes)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ruleta_salas;
ALTER PUBLICATION supabase_realtime ADD TABLE ruleta_jugadores;
