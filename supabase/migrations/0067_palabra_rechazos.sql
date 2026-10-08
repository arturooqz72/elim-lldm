-- ============================================================
-- Elim LLDM — Palabra del Día: intentos rechazados por "palabra no válida"
--
-- Una fila cada vez que /api/juegos/palabra/intento rechaza un intento
-- porque la palabra no está en la lista de válidas (src/lib/palabra/
-- validas.ts). Sirve para ver cuánto frustra la lista y qué palabras
-- conviene agregar. Los intentos de menos de 5 letras no llegan aquí (el
-- navegador ni los envía).
--
-- Solo la escribe el servidor (service role) y la lee /admin/palabra.
-- ============================================================

CREATE TABLE palabra_rechazos (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- Día del juego (America/Los_Angeles), igual que palabra_partidas.fecha.
  fecha      DATE NOT NULL,
  -- Ya normalizada (mayúsculas, sin acentos, con Ñ), como se evaluó.
  intento    TEXT NOT NULL CHECK (intento ~ '^[A-ZÑ]{5}$')
);

CREATE INDEX idx_palabra_rechazos_fecha ON palabra_rechazos (fecha);

-- RLS activo y sin políticas: el navegador no puede leer ni escribir.
ALTER TABLE palabra_rechazos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON palabra_rechazos TO service_role;
