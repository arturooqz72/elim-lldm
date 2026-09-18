-- ============================================================
-- Elim LLDM — Banco de audios personal por anfitrión
--
-- Cada Conductor habitual de un programa puede tener sus propios
-- intros/outros/clips, además de los generales que ya existían.
-- host_id NULL = clip general del programa (todo lo que ya existe
-- hoy queda como general automáticamente). ON DELETE SET NULL en vez
-- de CASCADE: si se quita al conductor de programa_hosts o se borra
-- su cuenta, sus clips no desaparecen, solo vuelven a ser generales.
-- ============================================================

ALTER TABLE programa_audios
  ADD COLUMN host_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_programa_audios_host ON programa_audios(programa_id, host_id);
