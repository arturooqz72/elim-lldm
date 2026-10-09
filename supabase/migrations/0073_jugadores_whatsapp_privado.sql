-- ============================================================
-- Elim LLDM — El WhatsApp de la lista de jugadores deja de ser visible
--
-- Antes cualquier usuario con cuenta podía leer por la API el nombre y el
-- número de WhatsApp de todos los de /juegos/jugadores. Ahora:
--   - cada quien lee solo su propia fila (y un admin, todas);
--   - la lista pública de nombres la arma el servidor, sin números;
--   - para invitar se usa un aviso dentro del sitio y una notificación
--     push (/api/juegos/invitar), nunca el número.
-- El número queda opcional: solo lo ven el propio jugador y los admin.
-- ============================================================

DROP POLICY IF EXISTS "jugadores_en_linea_select" ON jugadores_en_linea;
CREATE POLICY "jugadores_en_linea_select_own_or_admin" ON jugadores_en_linea
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE jugadores_en_linea ALTER COLUMN whatsapp DROP NOT NULL;

-- Bitácora de invitaciones: para limitar el envío (una invitación de la
-- misma persona a la misma persona cada 2 minutos) y para que un admin
-- pueda revisar abusos. Solo el servidor la lee y escribe.
CREATE TABLE juego_invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  para UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  juego TEXT NOT NULL,
  push_enviados INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_juego_invitaciones_par ON juego_invitaciones (de, para, created_at DESC);
ALTER TABLE juego_invitaciones ENABLE ROW LEVEL SECURITY;
-- Sin políticas ni GRANTs para anon/authenticated a propósito.
REVOKE ALL ON juego_invitaciones FROM anon, authenticated;
