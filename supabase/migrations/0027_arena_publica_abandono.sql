-- Mismo problema que se resolvió para Ruleta en 0026, versión Arena
-- Pública: sin este contador, una sala abandonada a mitad de partida solo
-- avanza una fase por cada visita a /arena-abierta de un tercero — con
-- poco tráfico, puede tardar días en llegar a 'finished' aunque el número
-- de preguntas sea finito (ver healStaleRooms() en advance.server.ts).
ALTER TABLE arena_publica_salas
  ADD COLUMN avances_automaticos_seguidos INT NOT NULL DEFAULT 0;
