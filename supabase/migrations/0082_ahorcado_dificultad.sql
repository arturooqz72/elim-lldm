-- ============================================================
-- Elim LLDM — Ahorcado: dificultad y pistas que se piden
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Antes la categoría, la descripción y la cita salían desde el inicio y
-- la palabra se adivinaba de inmediato. Ahora no se ve nada más que los
-- guiones; las pistas se piden una por una (ver ahorcado.server.ts) y la
-- cita completa sale al terminar.
--
-- ahorcado_corridas.dificultad: 'facil' (pistas gratis), 'normal' (cada
--   pista cuesta una vida y 5 puntos) o 'dificil' (sin pistas, 4 vidas,
--   palabras de 7 letras o más). Las partidas que ya existen quedan en
--   'normal', que es como se jugaba hasta ahora.
-- ahorcado_corridas.pistas: cuántas pistas lleva la palabra actual (0-3).
-- ahorcado_resultados.dificultad: para saber en qué nivel se jugó cada
--   palabra. Las filas viejas quedan en NULL.
--
-- Solo agrega columnas con valor por defecto: el código que está hoy en
-- producción sigue funcionando igual con ellas.
-- ============================================================

ALTER TABLE ahorcado_corridas
  ADD COLUMN dificultad TEXT NOT NULL DEFAULT 'normal'
    CHECK (dificultad IN ('facil', 'normal', 'dificil')),
  ADD COLUMN pistas INT NOT NULL DEFAULT 0
    CHECK (pistas BETWEEN 0 AND 3);

ALTER TABLE ahorcado_resultados
  ADD COLUMN dificultad TEXT
    CHECK (dificultad IN ('facil', 'normal', 'dificil'));
