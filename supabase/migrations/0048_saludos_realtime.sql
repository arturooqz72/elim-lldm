-- El panel "Saludos en vivo" del estudio se suscribe por Realtime a los
-- nuevos saludos de la transmisión activa — sin esto, postgres_changes
-- nunca entrega los INSERT aunque la policy de SELECT ya los permita.
ALTER PUBLICATION supabase_realtime ADD TABLE saludos;
