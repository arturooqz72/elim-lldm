-- ============================================================
-- Elim LLDM — documentos de Elim IA: lectura solo para admin
--
-- 0008 dejaba que cualquier usuario con cuenta leyera el texto
-- completo de elim_ia_documents por la API REST. El chat ahora lee
-- los documentos con service role (api/elim-ia/chat), así que
-- basta con que el panel /admin/elim-ia (sesión de admin) pueda
-- listarlos.
-- ============================================================

DROP POLICY IF EXISTS "elim_ia_documents_select_auth" ON elim_ia_documents;

CREATE POLICY "elim_ia_documents_select_admin" ON elim_ia_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
