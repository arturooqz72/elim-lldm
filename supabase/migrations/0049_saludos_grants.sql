-- La migración 0012 solo otorgó GRANT INSERT a anon/authenticated — sin
-- GRANT SELECT/UPDATE de base, las policies RLS de saludos_select_admin y
-- saludos_update_admin (0047) nunca se llegan a evaluar: Postgres rechaza
-- el acceso a nivel de privilegios antes de mirar RLS (403 "permission
-- denied for table saludos", confirmado en pruebas del panel de radio).
GRANT SELECT, UPDATE ON saludos TO authenticated;
