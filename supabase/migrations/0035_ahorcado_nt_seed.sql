-- ============================================================
-- Elim LLDM — Ahorcado del Nuevo Testamento: banco de palabras inicial
--
-- 72 palabras en los cuatro tipos acordados con el usuario: personajes,
-- lugares, conceptos/palabras clave, y libros del Nuevo Testamento. Todas
-- en mayúsculas sin acentos (para que coincidan letra por letra con el
-- teclado A-Z+Ñ del juego); la referencia bíblica sí puede llevar acentos
-- — es solo texto descriptivo que nunca se compara letra por letra.
-- ============================================================

-- PERSONAJES
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('JESUS', 'personaje', 'El Salvador, Hijo de Dios hecho hombre', 'Mateo 1:21'),
  ('PEDRO', 'personaje', 'Apóstol a quien Jesús llamó "la roca"', 'Mateo 16:18'),
  ('PABLO', 'personaje', 'Apóstol de los gentiles, antes llamado Saulo', 'Hechos 13:9'),
  ('JUAN', 'personaje', 'El discípulo amado, autor del cuarto evangelio', 'Juan 21:20'),
  ('MATEO', 'personaje', 'Recaudador de impuestos llamado a seguir a Jesús', 'Mateo 9:9'),
  ('MARIA', 'personaje', 'Madre de Jesús', 'Lucas 1:31'),
  ('MARTA', 'personaje', 'Hermana de Lázaro, se afanaba sirviendo', 'Lucas 10:40'),
  ('LAZARO', 'personaje', 'Amigo de Jesús a quien resucitó de entre los muertos', 'Juan 11:43'),
  ('JUDAS', 'personaje', 'El discípulo que traicionó a Jesús por treinta monedas de plata', 'Mateo 26:15'),
  ('TOMAS', 'personaje', 'El discípulo que dudó hasta ver las llagas de Jesús', 'Juan 20:27'),
  ('ESTEBAN', 'personaje', 'Primer mártir cristiano, apedreado por su fe', 'Hechos 7:59'),
  ('BARNABAS', 'personaje', 'Compañero de misión de Pablo, llamado hijo de consolación', 'Hechos 4:36'),
  ('TIMOTEO', 'personaje', 'Joven discípulo de Pablo, destinatario de dos epístolas', '1 Timoteo 1:2'),
  ('HERODES', 'personaje', 'Rey que mandó matar a los niños de Belén', 'Mateo 2:16'),
  ('ZAQUEO', 'personaje', 'Jefe de publicanos que subió a un árbol para ver a Jesús', 'Lucas 19:4'),
  ('NICODEMO', 'personaje', 'Fariseo que visitó a Jesús de noche', 'Juan 3:2'),
  ('ANDRES', 'personaje', 'Hermano de Simón Pedro, de los primeros en seguir a Jesús', 'Juan 1:40'),
  ('FELIPE', 'personaje', 'Discípulo que llevó a Natanael a conocer a Jesús', 'Juan 1:45'),
  ('MAGDALENA', 'personaje', 'Apellido de la María que fue la primera en ver a Jesús resucitado', 'Juan 20:16');

-- LUGARES
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('BELEN', 'lugar', 'Ciudad donde nació Jesús', 'Mateo 2:1'),
  ('NAZARET', 'lugar', 'Pueblo donde Jesús creció', 'Lucas 2:39'),
  ('GALILEA', 'lugar', 'Región donde Jesús inició su ministerio', 'Mateo 4:12'),
  ('JERUSALEN', 'lugar', 'Ciudad santa, sede del templo judío', 'Lucas 2:22'),
  ('JORDAN', 'lugar', 'Río donde Juan bautizó a Jesús', 'Mateo 3:13'),
  ('CAFARNAUM', 'lugar', 'Ciudad junto al mar de Galilea donde Jesús vivió', 'Mateo 4:13'),
  ('SAMARIA', 'lugar', 'Región donde Jesús habló con una mujer junto a un pozo', 'Juan 4:7'),
  ('CORINTO', 'lugar', 'Ciudad griega a la que Pablo escribió dos epístolas', '1 Corintios 1:2'),
  ('EFESO', 'lugar', 'Ciudad donde Pablo predicó por tres años', 'Hechos 20:31'),
  ('ANTIOQUIA', 'lugar', 'Ciudad donde los discípulos fueron llamados cristianos por primera vez', 'Hechos 11:26'),
  ('DAMASCO', 'lugar', 'Camino donde Saulo se convirtió al ver una luz del cielo', 'Hechos 9:3'),
  ('GETSEMANI', 'lugar', 'Huerto donde Jesús oró antes de ser arrestado', 'Mateo 26:36'),
  ('GOLGOTA', 'lugar', 'Lugar de la calavera donde Jesús fue crucificado', 'Juan 19:17'),
  ('PATMOS', 'lugar', 'Isla donde el apóstol Juan recibió la revelación', 'Apocalipsis 1:9'),
  ('EMAUS', 'lugar', 'Pueblo donde dos discípulos reconocieron a Jesús resucitado al partir el pan', 'Lucas 24:13'),
  ('CANA', 'lugar', 'Pueblo donde Jesús convirtió el agua en vino, su primer milagro', 'Juan 2:1');

-- CONCEPTOS / PALABRAS CLAVE
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('FE', 'concepto', 'Certeza de lo que se espera, convicción de lo que no se ve', 'Hebreos 11:1'),
  ('GRACIA', 'concepto', 'Favor inmerecido de Dios hacia el hombre', 'Efesios 2:8'),
  ('AMOR', 'concepto', 'El mayor de los dones, según Pablo', '1 Corintios 13:13'),
  ('SALVACION', 'concepto', 'Liberación del pecado por medio de Jesucristo', 'Hechos 4:12'),
  ('EVANGELIO', 'concepto', 'Las buenas nuevas de Jesucristo', 'Marcos 1:1'),
  ('RESURRECCION', 'concepto', 'Volver a la vida después de la muerte, como Jesús al tercer día', '1 Corintios 15:20'),
  ('BAUTISMO', 'concepto', 'Rito en el nombre del Padre, el Hijo y el Espíritu Santo', 'Mateo 28:19'),
  ('PERDON', 'concepto', 'Dejar libre de culpa a quien nos ofende', 'Mateo 6:14'),
  ('ARREPENTIMIENTO', 'concepto', 'Cambio de mente y de corazón hacia Dios', 'Hechos 3:19'),
  ('DISCIPULO', 'concepto', 'Seguidor y aprendiz de Jesús', 'Juan 8:31'),
  ('PARABOLA', 'concepto', 'Historia sencilla con un significado espiritual profundo', 'Mateo 13:3'),
  ('MILAGRO', 'concepto', 'Hecho sobrenatural que revela el poder de Dios', 'Juan 2:11'),
  ('CRUZ', 'concepto', 'Instrumento de tortura romano donde murió Jesús', 'Filipenses 2:8'),
  ('PENTECOSTES', 'concepto', 'Día en que el Espíritu Santo descendió sobre los apóstoles', 'Hechos 2:1'),
  ('IGLESIA', 'concepto', 'Comunidad de creyentes, cuerpo de Cristo', 'Efesios 1:22'),
  ('ORACION', 'concepto', 'Hablar con Dios', '1 Tesalonicenses 5:17'),
  ('ANGEL', 'concepto', 'Mensajero de Dios', 'Lucas 1:26'),
  ('TEMPLO', 'concepto', 'Casa de oración', 'Mateo 21:13'),
  ('PROFECIA', 'concepto', 'Palabra inspirada por Dios que anuncia lo por venir', '2 Pedro 1:21');

-- LIBROS DEL NUEVO TESTAMENTO
INSERT INTO ahorcado_palabras (palabra, categoria, pista, referencia_biblica) VALUES
  ('MATEO', 'libro', 'Primer evangelio, escrito pensando en el pueblo judío', 'Mateo 5:3'),
  ('MARCOS', 'libro', 'El evangelio más corto, de acción rápida', 'Marcos 16:15'),
  ('LUCAS', 'libro', 'Evangelio escrito por un médico, dirigido a Teófilo', 'Lucas 1:3'),
  ('JUAN', 'libro', 'Evangelio que llama a Jesús "el Verbo hecho carne"', 'Juan 1:14'),
  ('HECHOS', 'libro', 'Narra el nacimiento de la iglesia y los viajes de Pablo', 'Hechos 1:8'),
  ('ROMANOS', 'libro', 'Epístola de Pablo sobre la justificación por la fe', 'Romanos 1:17'),
  ('CORINTIOS', 'libro', 'Epístolas de Pablo a una iglesia dividida por disputas', '1 Corintios 1:10'),
  ('GALATAS', 'libro', 'Epístola sobre la libertad en Cristo, no bajo la ley', 'Gálatas 5:1'),
  ('EFESIOS', 'libro', 'Epístola sobre la unidad de la iglesia como cuerpo de Cristo', 'Efesios 4:4'),
  ('FILIPENSES', 'libro', 'Epístola del gozo, escrita desde la prisión', 'Filipenses 4:4'),
  ('COLOSENSES', 'libro', 'Epístola que exalta la supremacía de Cristo', 'Colosenses 1:15'),
  ('TESALONICENSES', 'libro', 'Epístolas sobre la segunda venida de Cristo', '1 Tesalonicenses 4:16'),
  ('TIMOTEO', 'libro', 'Epístolas pastorales de Pablo a un joven líder de la iglesia', '1 Timoteo 4:12'),
  ('TITO', 'libro', 'Epístola pastoral sobre el orden en la iglesia de Creta', 'Tito 1:5'),
  ('FILEMON', 'libro', 'Carta personal de Pablo pidiendo perdón para un esclavo fugitivo', 'Filemón 1:10'),
  ('HEBREOS', 'libro', 'Epístola que compara a Cristo con el sacerdocio antiguo', 'Hebreos 4:14'),
  ('SANTIAGO', 'libro', 'Epístola práctica: "la fe sin obras es muerta"', 'Santiago 2:26'),
  ('APOCALIPSIS', 'libro', 'Último libro de la Biblia, revelación dada a Juan en Patmos', 'Apocalipsis 1:1');
