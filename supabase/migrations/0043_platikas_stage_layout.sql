-- ============================================================
-- Elim LLDM — Selector de layout del escenario
--
-- El anfitrión elige cómo se ve la composición en vivo (solo una
-- cámara, lado a lado, grid, o cámara+pantalla) — se guarda en
-- platikas.stage_layout tanto para que la app la recuerde al
-- recargar como para reaplicarla si el egress de streaming se
-- reinicia. El cambio en tiempo real a los espectadores viaja por
-- los metadatos de la sala de LiveKit, no por esta columna.
-- ============================================================

ALTER TABLE platikas ADD COLUMN stage_layout TEXT NOT NULL DEFAULT 'grid'
  CHECK (stage_layout IN ('solo', 'lado_a_lado', 'grid', 'pantalla'));
