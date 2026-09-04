-- elim_arena_preguntas.respuesta_correcta era públicamente consultable
-- (GRANT SELECT a anon/authenticated con policy USING (TRUE) sobre TODAS las
-- columnas) — cualquiera podía leer la respuesta correcta antes de
-- responder. Se aísla en su propia tabla sin ningún GRANT, igual que ya se
-- hizo para Arena Abierta en 0021_arena_publica.sql.
CREATE TABLE elim_arena_respuestas_correctas (
  pregunta_id UUID PRIMARY KEY REFERENCES elim_arena_preguntas(id) ON DELETE CASCADE,
  respuesta_correcta TEXT NOT NULL CHECK (respuesta_correcta IN ('a','b','c','d'))
);

INSERT INTO elim_arena_respuestas_correctas (pregunta_id, respuesta_correcta)
SELECT id, respuesta_correcta FROM elim_arena_preguntas;

ALTER TABLE elim_arena_respuestas_correctas ENABLE ROW LEVEL SECURITY;
-- Sin políticas, sin GRANTs — solo el service role client puede leerla.

ALTER TABLE elim_arena_preguntas DROP COLUMN respuesta_correcta;
