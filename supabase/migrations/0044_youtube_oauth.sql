-- ============================================================
-- Elim LLDM — Conexión OAuth del canal de YouTube
--
-- Permite marcar "Salir al aire" en YouTube de forma automática sin
-- copiar/pegar URL RTMP ni stream key: se conecta el canal una vez
-- (OAuth), se crea un liveStream persistente (ingestion reusable), y
-- cada sesión crea+vincula un liveBroadcast nuevo antes de arrancar el
-- egress — el egress en sí sigue siendo RTMP normal hacia esa
-- ingestion, igual mecanismo que cualquier otro destino manual.
--
-- Solo admin puede conectar/desconectar el canal (credencial durable
-- de todo el ministerio, más sensible que un destino puntual); usarlo
-- (togglearlo encendido/apagado en una sesión) sigue la misma regla
-- que cualquier destino: admin o super_moderador.
-- ============================================================

CREATE TABLE youtube_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  access_token_cifrado TEXT NOT NULL,
  refresh_token_cifrado TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  stream_id TEXT,
  rtmp_url TEXT,
  stream_key_cifrado TEXT,
  connected_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vincula un destino del catálogo a esta conexión — cuando está
-- presente, el toggle de "start" crea+vincula un liveBroadcast antes
-- de arrancar el egress, en vez de solo usar rtmp_url/stream_key tal
-- cual como con un destino manual.
ALTER TABLE destinos ADD COLUMN youtube_connection_id UUID REFERENCES youtube_connections(id);

ALTER TABLE youtube_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "youtube_connections_select" ON youtube_connections FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_moderador')));

CREATE POLICY "youtube_connections_admin_write" ON youtube_connections FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT ON youtube_connections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON youtube_connections TO authenticated;
