-- Privacidad de la transmisión, elegida en la pantalla de configuración
-- antes de entrar al estudio (mismo campo que ya tenía tdv-llm).
ALTER TABLE platikas
  ADD COLUMN visibilidad TEXT NOT NULL DEFAULT 'publico'
    CHECK (visibilidad IN ('publico', 'oculto', 'privado'));
