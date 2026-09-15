-- ============================================================
-- Elim LLDM — Saludos en vivo (ligados a una transmisión activa)
--
-- Extiende `saludos` (grabación pública en /saludo) para que un
-- saludo también pueda quedar ligado a una plática específica —
-- grabado mientras esa transmisión está al aire, vía un link propio
-- (/platikas/[id]/saludo) que el anfitrión comparte por WhatsApp.
-- El estudio los muestra en tiempo real para reproducirlos al aire.
-- ============================================================

ALTER TABLE saludos
  ADD COLUMN platika_id UUID REFERENCES platikas(id) ON DELETE SET NULL,
  ADD COLUMN played_at TIMESTAMPTZ;

CREATE INDEX idx_saludos_platika ON saludos(platika_id, created_at ASC);

-- El estudio necesita leer (y suscribirse en tiempo real a) los saludos
-- de su transmisión activa desde el cliente — antes solo el admin panel
-- los leía server-side con el service role, que no aplica a Realtime.
-- Mientras el Estudio en Vivo siga limitado a administradores (ver
-- UnderConstruction.tsx), basta con permitir a cualquier admin.
CREATE POLICY "saludos_select_admin" ON saludos FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- El anfitrión marca un saludo como "reproducido" desde el estudio.
CREATE POLICY "saludos_update_admin" ON saludos FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- El mismo admin necesita generar URLs firmadas para escuchar/reproducir
-- el audio del saludo directamente desde el cliente del estudio.
CREATE POLICY "saludos_storage_select_admin" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'saludos' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
