-- ============================================================
-- Elim LLDM — Elim IA (asistente con MODO LLDM y MODO GENERAL)
-- Run in Supabase SQL Editor
--
-- elim_ia_messages: historial de conversación por usuario y modo
-- elim_ia_documents: base de conocimiento (PDF/Word/texto) para
--   MODO LLDM, subida por administradores
-- ============================================================

-- ELIM IA MESSAGES
CREATE TABLE elim_ia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('lldm', 'general')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ELIM IA DOCUMENTS
CREATE TABLE elim_ia_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_elim_ia_messages_user ON elim_ia_messages(user_id, mode, created_at);
CREATE INDEX idx_elim_ia_documents_created_at ON elim_ia_documents(created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE elim_ia_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE elim_ia_documents ENABLE ROW LEVEL SECURITY;

-- MESSAGES: cada usuario lee/escribe/borra solo lo suyo
CREATE POLICY "elim_ia_messages_select_own" ON elim_ia_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "elim_ia_messages_insert_own" ON elim_ia_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "elim_ia_messages_delete_own" ON elim_ia_messages
  FOR DELETE USING (auth.uid() = user_id);

-- DOCUMENTS: cualquier usuario autenticado puede leer el contenido
-- (se usa como contexto para MODO LLDM); solo admin gestiona
CREATE POLICY "elim_ia_documents_select_auth" ON elim_ia_documents
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "elim_ia_documents_insert_admin" ON elim_ia_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "elim_ia_documents_delete_admin" ON elim_ia_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON elim_ia_messages, elim_ia_documents TO service_role;
GRANT SELECT, INSERT, DELETE ON elim_ia_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON elim_ia_documents TO authenticated;

-- ============================================================
-- STORAGE BUCKET (archivos fuente — privado)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('elim-ia-documents', 'elim-ia-documents', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "elim_ia_documents_storage_select_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'elim-ia-documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "elim_ia_documents_storage_insert_admin" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'elim-ia-documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "elim_ia_documents_storage_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'elim-ia-documents'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
