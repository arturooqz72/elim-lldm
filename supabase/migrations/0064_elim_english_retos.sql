-- ============================================================
-- Elim English — Reto del día y racha
--
-- english_retos              un reto por día (hora del Pacífico), el mismo
--                            para todos. Se generan con anticipación (cron
--                            diario /api/cron/ingles-retos), no en cada visita.
-- english_retos_completados  qué día completó cada usuario el reto. La racha
--                            no se guarda: se calcula al leer, a partir de
--                            esta tabla y de english_uso_diario (días con 3
--                            o más mensajes), con la misma lógica que la
--                            Palabra del Día.
-- english_mensajes.modo      acepta 'reto' para la conversación del reto.
--
-- Solo el servidor (service role) escribe; cada usuario puede leer sus
-- retos completados.
-- ============================================================

CREATE TABLE english_retos (
  dia         DATE PRIMARY KEY,
  titulo      TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 80),
  descripcion TEXT NOT NULL CHECK (char_length(descripcion) BETWEEN 1 AND 300),
  -- [{ "en": "...", "es": "..." }, ...] — 3 frases para practicar
  frases      JSONB NOT NULL CHECK (jsonb_typeof(frases) = 'array' AND jsonb_array_length(frases) = 3),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE english_retos_completados (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia        DATE NOT NULL REFERENCES english_retos(dia) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dia)
);

CREATE INDEX idx_english_retos_completados_dia ON english_retos_completados (dia);

ALTER TABLE english_mensajes DROP CONSTRAINT IF EXISTS english_mensajes_modo_check;
ALTER TABLE english_mensajes ADD CONSTRAINT english_mensajes_modo_check
  CHECK (modo IN ('conversacion', 'situaciones', 'gramatica', 'vocabulario', 'reto'));

ALTER TABLE english_retos ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_retos_completados ENABLE ROW LEVEL SECURITY;

-- Los retos los lee el servidor (service role); sin políticas para el
-- navegador, así no se pueden ver los de días futuros.
CREATE POLICY "english_retos_completados_select_own" ON english_retos_completados
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON english_retos_completados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON english_retos, english_retos_completados TO service_role;
