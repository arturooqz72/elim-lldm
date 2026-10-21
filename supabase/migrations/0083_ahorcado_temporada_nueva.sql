-- ============================================================
-- Elim LLDM — Ahorcado: temporada nueva con una tabla por nivel
-- Ejecutar manualmente en Supabase SQL Editor JUSTO DESPUÉS de que el
-- código de feat/ahorcado-dificultad quede en producción (no antes: el
-- código viejo seguiría sumando a las rachas que aquí se reinician).
--
-- 1. Los récords de antes (game_key 'ahorcado') NO se tocan: se muestran
--    como "Récords históricos". Las tablas nuevas son 'ahorcado_facil',
--    'ahorcado_normal' y 'ahorcado_dificil'.
-- 2. Las tablas nuevas empiezan vacías: se borra lo que haya en ellas,
--    que solo pueden ser partidas de prueba de la vista previa (el código
--    de producción anterior nunca escribe esas claves).
-- 3. Las rachas en curso se hicieron con las reglas viejas (pistas y cita
--    a la vista): se dan por terminadas para que nadie lleve esos puntos a
--    las tablas nuevas. Al entrar, cada quien elige dificultad y empieza de
--    cero. Su mejor récord ya está en los históricos.
-- ============================================================

DELETE FROM juego_individual_rankings
WHERE game_key IN ('ahorcado_facil', 'ahorcado_normal', 'ahorcado_dificil');

UPDATE ahorcado_corridas
SET estado = 'perdida',
    puntos = 0,
    ganadas = 0,
    usadas = '{}',
    pistas = 0,
    updated_at = NOW();
