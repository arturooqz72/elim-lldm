-- Registro de miembros que quieren que los inviten a jugar juegos en línea.
-- Un anfitrión que abre una sala (Ruleta en línea, Elim Arena, Trivia) puede
-- ver esta lista e invitar a cada persona por WhatsApp con un enlace wa.me.
CREATE TABLE jugadores_en_linea (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jugadores_en_linea ENABLE ROW LEVEL SECURITY;

-- Cualquier miembro autenticado puede ver la lista (para poder invitar).
CREATE POLICY "jugadores_en_linea_select" ON jugadores_en_linea
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Cada quien solo administra su propio registro.
CREATE POLICY "jugadores_en_linea_insert_own" ON jugadores_en_linea
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jugadores_en_linea_update_own" ON jugadores_en_linea
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "jugadores_en_linea_delete_own" ON jugadores_en_linea
  FOR DELETE USING (auth.uid() = user_id);
