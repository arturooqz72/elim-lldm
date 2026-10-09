-- ============================================================
-- Elim English — enlazar las aperturas de la app con la prueba sin cuenta
--
-- Hasta ahora, una apertura sin sesión no se podía relacionar con nada:
-- la prueba usa otro id (cookie elim_en_prueba) y, con sesión, no se
-- guardaba el id anónimo del navegador. Desde esta migración:
-- - visitante_id se guarda SIEMPRE (con o sin sesión), para saber si
--   quien abrió sin sesión inició sesión después en ese navegador;
-- - prueba_id = el anon_id de la cookie de la prueba, si había, para
--   saber si esa persona usó la prueba sin cuenta.
-- Sin FK a english_prueba_visitantes: la cookie puede existir sin fila, y
-- la estadística se arma cruzando las tablas al leer.
-- ============================================================

ALTER TABLE english_app_aperturas ADD COLUMN prueba_id UUID;

CREATE INDEX idx_english_app_aperturas_visitante ON english_app_aperturas (visitante_id);
