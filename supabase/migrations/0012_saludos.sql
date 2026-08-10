-- ============================================================
-- Elim LLDM — Saludos en audio (grabación pública en /saludo)
-- Ejecutar manualmente en Supabase SQL Editor
--
-- Tabla + bucket de Storage para que cualquier visitante grabe un
-- saludo desde el navegador y lo envíe. Igual que `sugerencias`:
-- solo INSERT público, sin policy de SELECT para anon/authenticated
-- — el admin lee todo desde /admin/saludos con el service role
-- client (bypassea RLS) y genera URLs firmadas temporales para
-- escuchar/descargar cada audio.
-- ============================================================

CREATE TABLE saludos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 1 AND 120),
  audio_path TEXT NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saludos_created_at ON saludos(created_at DESC);

ALTER TABLE saludos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saludos_insert_public" ON saludos FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

GRANT INSERT ON saludos TO anon, authenticated;

-- Bucket privado para los archivos de audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('saludos', 'saludos', FALSE, 10485760, ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

-- Solo INSERT público en el bucket — sin SELECT para anon/authenticated.
-- storage.objects ya tiene RLS habilitado por defecto en Supabase.
CREATE POLICY "saludos_storage_insert_public" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'saludos');
