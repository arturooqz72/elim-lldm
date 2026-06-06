# Elim LLDM — Blueprint

> Generado por The Architect el 2026-06-05
> Archetype: SaaS Web App (primario) + Content Platform (secundario)

---

## 1. Project Overview

### Vision

Elim LLDM es una plataforma cristiana abierta al mundo para predicar y vivir la fe de la Luz del Mundo (LLDM). Cualquier persona puede escuchar la radio en vivo o ver pláticas grabadas sin registrarse. Los creyentes con cuenta pueden participar activamente: chatear en transmisiones en vivo, solicitar subir al escenario de debate, y competir en juegos bíblicos en tiempo real con otros jugadores de todo el mundo.

La plataforma tiene cuatro pilares: **Radio** (stream 24/7 existente en AzuraCast), **Sala de Pláticas** (transmisiones en vivo con WebRTC vía LiveKit, chat moderado y sistema de debate), **Juegos Bíblicos** (competencias de conocimiento bíblico en tiempo real, por equipos), y **Archivo** (todas las pláticas grabadas organizadas por categoría y etiquetas).

### Goals

- Plataforma de predicación accesible sin fricción — ver sin registrarse
- Transmisiones en vivo profesionales con interacción real (debate, chat)
- Comunidad bíblica gamificada que motive el estudio de las escrituras
- Archivo permanente y organizado de la doctrina LLDM

### Success Metrics

- Visitantes simultáneos escuchando la radio: > 100 sin degradación
- Latencia de chat en Pláticas: < 500ms
- Partida de juego con 50 jugadores fluida y sin desincronización
- Tiempo de carga de página pública: < 2s (LCP)

---

## 2. Tech Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Framework | Next.js 15 (App Router) | SSR, Server Components, API routes — un solo repo para todo |
| Lenguaje | TypeScript strict | Seguridad de tipos, crítico con LiveKit SDK y Supabase generados |
| Styling | Tailwind CSS v4 | Velocidad de desarrollo, dark mode nativo con CSS variables |
| Componentes | shadcn/ui | Accesibles, sin estilo impuesto, se integra con Tailwind v4 |
| Base de datos | Supabase (PostgreSQL) | Auth + DB + Realtime + Storage en un servicio — elimina 3 dependencias |
| Tipos DB | Supabase generated types (`supabase gen types`) | Sin ORM extra — tipos TypeScript generados directamente del schema |
| Auth | Supabase Auth | Ya en el stack; Google OAuth, RLS por fila para control de permisos |
| Real-time | Supabase Realtime (chat, cola, juegos) | WebSocket gestionado, se integra con RLS |
| Audio/Video | LiveKit Cloud | WebRTC P2P/SFU administrado; gratuito hasta escala media |
| Radio player | HTML5 Audio + AzuraCast API | Stream ya existe en `radio.elimlldm.net` — solo reproducir |
| Radio bridge | Node.js + @livekit/rtc-node + FFmpeg | Bot que une sala LiveKit y restreams a AzuraCast vía Icecast |
| Storage | Supabase Storage | Grabaciones, thumbnails, avatares |
| Hosting app | Vercel | Deploy automático, Edge Network, preview URLs por PR |
| Hosting relay | Railway | Proceso Node.js persistente para el radio bridge |
| Package Manager | pnpm | Más rápido que npm, mejor manejo de monorepo si se necesita |

---

## 3. Directory Structure

```
elim-lldm/
├── src/
│   ├── app/
│   │   ├── (public)/                    # Layout público — sin auth requerida
│   │   │   ├── layout.tsx               # Header con nav + footer
│   │   │   ├── page.tsx                 # Landing page
│   │   │   ├── radio/
│   │   │   │   └── page.tsx             # Reproductor de radio en vivo
│   │   │   ├── platikas/
│   │   │   │   ├── page.tsx             # Lista de pláticas (programadas y en vivo)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx         # Sala de plática (viewer + participante)
│   │   │   ├── juegos/
│   │   │   │   ├── page.tsx             # Lobby de juegos activos
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx         # Sala de juego (jugador)
│   │   │   └── archivo/
│   │   │       ├── page.tsx             # Archivo con filtros
│   │   │       └── [id]/
│   │   │           └── page.tsx         # Reproductor de plática grabada
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx             # Página de inicio de sesión
│   │   │   └── callback/
│   │   │       └── route.ts             # Callback OAuth de Supabase
│   │   ├── admin/                       # Solo rol 'admin'
│   │   │   ├── layout.tsx               # Sidebar admin
│   │   │   ├── page.tsx                 # Dashboard admin
│   │   │   ├── usuarios/
│   │   │   │   └── page.tsx             # Listar usuarios, verificar anfitriones
│   │   │   ├── platikas/
│   │   │   │   ├── nueva/page.tsx       # Crear plática programada
│   │   │   │   └── [id]/page.tsx        # Editar/moderar plática
│   │   │   ├── question-sets/
│   │   │   │   ├── page.tsx             # Lista de sets de preguntas
│   │   │   │   ├── nueva/page.tsx       # Crear set
│   │   │   │   └── [id]/page.tsx        # Editar set + CRUD preguntas
│   │   │   ├── juegos/
│   │   │   │   ├── nueva/page.tsx       # Crear partida
│   │   │   │   └── [id]/
│   │   │   │       └── host/page.tsx    # Panel host de juego en vivo
│   │   │   └── archivo/
│   │   │       └── nueva/page.tsx       # Subir grabación al archivo
│   │   └── api/
│   │       ├── livekit/
│   │       │   └── token/route.ts       # Genera token LiveKit para un room
│   │       ├── platikas/
│   │       │   └── [id]/
│   │       │       ├── go-live/route.ts        # Activa plática en vivo
│   │       │       ├── end/route.ts             # Termina plática
│   │       │       ├── radio-toggle/route.ts    # Activa/desactiva salida a radio
│   │       │       └── requests/
│   │       │           └── [requestId]/
│   │       │               └── approve/route.ts # Aprueba solicitud de escenario
│   │       └── games/
│   │           └── [id]/
│   │               ├── start/route.ts           # Inicia partida
│   │               ├── next-question/route.ts   # Avanza pregunta
│   │               └── finish/route.ts          # Termina partida
│   ├── components/
│   │   ├── ui/                          # shadcn/ui primitivos (Button, Dialog, etc.)
│   │   ├── layout/
│   │   │   ├── PublicHeader.tsx
│   │   │   ├── PublicFooter.tsx
│   │   │   └── AdminSidebar.tsx
│   │   ├── radio/
│   │   │   ├── RadioPlayer.tsx          # Player HTML5 con controles
│   │   │   ├── RadioMetadata.tsx        # Now playing, listeners
│   │   │   └── RadioVisualizer.tsx      # Animación de ondas de audio
│   │   ├── platikas/
│   │   │   ├── LiveKitRoom.tsx          # Wrapper de @livekit/components-react
│   │   │   ├── StagePanel.tsx           # Audio/video del escenario
│   │   │   ├── ChatPanel.tsx            # Chat en tiempo real
│   │   │   ├── RequestQueue.tsx         # Cola de solicitudes (host view)
│   │   │   ├── RequestButton.tsx        # Botón para solicitar subir
│   │   │   └── HostControls.tsx         # Controles del anfitrión
│   │   ├── juegos/
│   │   │   ├── GameLobby.tsx            # Sala de espera + equipos
│   │   │   ├── QuestionCard.tsx         # Pregunta con timer
│   │   │   ├── AnswerOptions.tsx        # Opciones A/B/C/D
│   │   │   ├── Scoreboard.tsx           # Tabla de puntos en tiempo real
│   │   │   └── TeamSelect.tsx           # Selección de equipo
│   │   └── archivo/
│   │       ├── ArchiveGrid.tsx          # Grid de pláticas grabadas
│   │       ├── ArchiveFilters.tsx       # Filtros por categoría/tags
│   │       └── VideoPlayer.tsx          # Reproductor de video
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                # createBrowserClient()
│   │   │   ├── server.ts                # createServerClient() con cookies
│   │   │   └── middleware.ts            # updateSession helper
│   │   ├── livekit/
│   │   │   └── tokens.ts               # generateToken() con AccessToken
│   │   ├── azuracast/
│   │   │   └── api.ts                  # Fetch metadata del stream
│   │   └── utils.ts                    # cn(), formatDate(), etc.
│   ├── types/
│   │   ├── database.ts                  # Auto-generado por Supabase CLI
│   │   └── index.ts                     # Tipos de dominio: Profile, Pláticas, Game
│   └── middleware.ts                    # Protección de rutas por rol
├── relay/                               # Servicio relay LiveKit→AzuraCast (Railway)
│   ├── index.ts                         # Express server + relay logic
│   ├── livekit-bot.ts                   # Bot que se une al room
│   ├── ffmpeg-bridge.ts                 # FFmpeg → Icecast stream
│   └── package.json
├── supabase/
│   └── migrations/
│       └── 0001_init.sql                # Schema completo
├── public/
│   ├── logo.svg
│   └── og-image.png
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── CLAUDE.md
```

---

## 4. Data Model

### Entities

**profiles** (extiende `auth.users`)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | Referencias `auth.users(id)` |
| display_name | TEXT NOT NULL | Nombre público |
| avatar_url | TEXT | URL de avatar |
| role | TEXT | `'admin'`, `'anfitrion'`, `'participante'` |
| verified_lldm | BOOLEAN | True = miembro LLDM verificado (puede ser anfitrión) |
| bio | TEXT | Biografía opcional |
| created_at | TIMESTAMPTZ | |

**platikas**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| host_id | UUID FK | → profiles |
| status | TEXT | `'scheduled'`, `'live'`, `'ended'` |
| livekit_room_name | TEXT UNIQUE | Generado al ir en vivo |
| radio_output_active | BOOLEAN | Si el audio sale a AzuraCast |
| thumbnail_url | TEXT | |
| scheduled_at | TIMESTAMPTZ | Para pláticas programadas |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| recording_url | TEXT | URL de grabación (post-evento) |
| created_at | TIMESTAMPTZ | |

**platikas_messages**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| pláticas_id | UUID FK | → platikas |
| user_id | UUID FK | → profiles |
| content | TEXT NOT NULL | Max 500 chars |
| is_moderated | BOOLEAN | True = oculto |
| created_at | TIMESTAMPTZ | |

**platikas_requests** (cola de escenario)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| pláticas_id | UUID FK | → platikas |
| user_id | UUID FK | → profiles |
| status | TEXT | `'pending'`, `'approved'`, `'rejected'`, `'completed'` |
| message | TEXT | Mensaje opcional con la solicitud |
| created_at | TIMESTAMPTZ | |

**question_sets**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| created_by | UUID FK | → profiles |
| is_public | BOOLEAN | Visible para todos los anfitriones |
| created_at | TIMESTAMPTZ | |

**questions**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| question_set_id | UUID FK | → question_sets |
| question_text | TEXT NOT NULL | |
| option_a/b/c/d | TEXT NOT NULL | Las 4 opciones |
| correct_option | TEXT | `'a'`, `'b'`, `'c'`, `'d'` |
| bible_reference | TEXT | Ej: "Juan 3:16" |
| time_limit_seconds | INT | Default 30 |
| points | INT | Default 100 |
| order_index | INT | Orden en el set |
| created_at | TIMESTAMPTZ | |

**games**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| title | TEXT NOT NULL | |
| host_id | UUID FK | → profiles |
| question_set_id | UUID FK | → question_sets |
| status | TEXT | `'lobby'`, `'in_progress'`, `'finished'` |
| current_question_index | INT | Default 0 |
| join_code | TEXT UNIQUE | Código corto (ej: `ELIM42`) |
| started_at | TIMESTAMPTZ | |
| finished_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**game_teams**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| game_id | UUID FK | → games |
| name | TEXT NOT NULL | Nombre del equipo |
| color | TEXT | Color hex del equipo |
| score | INT | Puntuación acumulada |

**game_players**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| game_id | UUID FK | → games |
| team_id | UUID FK | → game_teams |
| user_id | UUID FK | → profiles |
| score | INT | Puntuación individual |
| joined_at | TIMESTAMPTZ | |

**game_answers**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| game_id | UUID FK | → games |
| question_id | UUID FK | → questions |
| player_id | UUID FK | → game_players |
| selected_option | TEXT | `'a'`, `'b'`, `'c'`, `'d'` |
| is_correct | BOOLEAN | |
| time_taken_ms | INT | Para desempate |
| answered_at | TIMESTAMPTZ | |

**archive**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| pláticas_id | UUID FK NULLABLE | → platikas (si viene de transmisión) |
| title | TEXT NOT NULL | |
| description | TEXT | |
| recording_url | TEXT NOT NULL | URL en Supabase Storage |
| thumbnail_url | TEXT | |
| duration_seconds | INT | |
| category_id | UUID FK | → categories |
| tags | TEXT[] | Array de etiquetas |
| view_count | INT | Default 0 |
| is_published | BOOLEAN | Default false |
| published_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**categories**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| slug | TEXT UNIQUE | |
| description | TEXT | |
| icon | TEXT | Nombre de ícono Lucide |
| order_index | INT | |

### Database Schema

```sql
-- Ejecutar en Supabase SQL Editor

-- PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'participante'
    CHECK (role IN ('admin', 'anfitrion', 'participante')),
  verified_lldm BOOLEAN NOT NULL DEFAULT FALSE,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-crear profile al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATIKAS
CREATE TABLE platikas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  host_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'ended')),
  livekit_room_name TEXT UNIQUE,
  radio_output_active BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail_url TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATIKAS MESSAGES (chat)
CREATE TABLE platikas_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pláticas_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  is_moderated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATIKAS REQUESTS (cola de escenario)
CREATE TABLE platikas_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pláticas_id UUID NOT NULL REFERENCES platikas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTION SETS
CREATE TABLE question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUESTIONS
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  bible_reference TEXT,
  time_limit_seconds INT NOT NULL DEFAULT 30,
  points INT NOT NULL DEFAULT 100,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAMES
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES profiles(id),
  question_set_id UUID NOT NULL REFERENCES question_sets(id),
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'in_progress', 'finished')),
  current_question_index INT NOT NULL DEFAULT 0,
  join_code TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAME TEAMS
CREATE TABLE game_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#D4A017',
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAME PLAYERS
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID REFERENCES game_teams(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, user_id)
);

-- GAME ANSWERS
CREATE TABLE game_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  player_id UUID NOT NULL REFERENCES game_players(id),
  selected_option TEXT NOT NULL CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct BOOLEAN NOT NULL,
  time_taken_ms INT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, player_id)
);

-- ARCHIVE
CREATE TABLE archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pláticas_id UUID REFERENCES platikas(id),
  title TEXT NOT NULL,
  description TEXT,
  recording_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  category_id UUID REFERENCES categories(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX idx_platikas_status ON platikas(status);
CREATE INDEX idx_platikas_host ON platikas(host_id);
CREATE INDEX idx_messages_pláticas ON platikas_messages(pláticas_id, created_at);
CREATE INDEX idx_requests_pláticas ON platikas_requests(pláticas_id, status);
CREATE INDEX idx_game_players_game ON game_players(game_id);
CREATE INDEX idx_game_answers_game ON game_answers(game_id, question_id);
CREATE INDEX idx_archive_category ON archive(category_id);
CREATE INDEX idx_archive_published ON archive(is_published, published_at DESC);

-- RLS: Habilitar en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE platikas_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (ejemplos clave — completar para todas las tablas)

-- Profiles: cualquiera puede ver, solo el dueño edita
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Platikas: cualquiera ve, solo anfitrion/admin crea
CREATE POLICY "platikas_select" ON platikas FOR SELECT USING (TRUE);
CREATE POLICY "platikas_insert" ON platikas FOR INSERT
  WITH CHECK (
    auth.uid() = host_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'anfitrion'))
  );
CREATE POLICY "platikas_update_host" ON platikas FOR UPDATE
  USING (auth.uid() = host_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Messages: cualquiera ve no moderados, participantes insertan
CREATE POLICY "messages_select" ON platikas_messages FOR SELECT
  USING (is_moderated = FALSE OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "messages_insert" ON platikas_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Questions: admins gestionan, todos leen públicas
CREATE POLICY "questions_select" ON questions FOR SELECT USING (TRUE);
CREATE POLICY "questions_insert" ON questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Archive: todos ven publicadas, admins ven todas
CREATE POLICY "archive_select" ON archive FOR SELECT
  USING (is_published = TRUE OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

## 5. API Design

### Routes Overview

| Method | Path | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/livekit/token` | Genera token LiveKit para room y rol | Participante+ |
| POST | `/api/platikas/[id]/go-live` | Activa plática, crea room LiveKit | Anfitrión/Admin |
| POST | `/api/platikas/[id]/end` | Termina plática, desactiva relay | Anfitrión/Admin |
| POST | `/api/platikas/[id]/radio-toggle` | Activa/desactiva relay→AzuraCast | Anfitrión/Admin |
| POST | `/api/platikas/[id]/requests/[reqId]/approve` | Aprueba solicitud, genera token speaker | Anfitrión/Admin |
| POST | `/api/games/[id]/start` | Inicia partida, broadcast evento | Admin |
| POST | `/api/games/[id]/next-question` | Avanza a siguiente pregunta | Admin (host) |
| POST | `/api/games/[id]/finish` | Termina partida, calcula scores finales | Admin (host) |

### Endpoint Detail: POST `/api/livekit/token`

```typescript
// Request body
{
  roomName: string,       // nombre del room LiveKit
  participantRole: 'viewer' | 'speaker' | 'host'
}

// Response
{
  token: string,          // JWT para @livekit/components-react
  wsUrl: string           // URL del servidor LiveKit
}

// Lógica
// 1. Verificar usuario autenticado
// 2. Verificar que la plática existe y está 'live'
// 3. Generar AccessToken con permisos según rol:
//    - viewer: canPublish: false, canSubscribe: true
//    - speaker: canPublish: true, canSubscribe: true
//    - host: canPublish: true, canSubscribe: true, roomAdmin: true
```

### Endpoint Detail: POST `/api/games/[id]/next-question`

```typescript
// Sin body — el host avanza la pregunta
// Lógica:
// 1. Verificar que auth.uid() es host del juego
// 2. Incrementar current_question_index en DB
// 3. Broadcast via Supabase Realtime:
//    channel('game:${id}').send({ type: 'QUESTION_START', questionIndex, endsAt })
// 4. Calcular scores de la pregunta anterior y actualizar game_players.score
// Response: { questionIndex: number, question: Question }
```

---

## 6. Frontend Architecture

### Pages / Routes

| Ruta | Descripción | Auth |
|------|-------------|------|
| `/` | Landing page — hero, features, CTA | Pública |
| `/radio` | Reproductor de radio en vivo + metadata | Pública |
| `/platikas` | Lista de pláticas (en vivo y programadas) | Pública |
| `/platikas/[id]` | Sala de plática — viewer + controles si auth | Pública (participar = auth) |
| `/juegos` | Lobby — lista juegos activos, unirse por código | Pública (jugar = auth) |
| `/juegos/[id]` | Sala de juego con equipos y preguntas | Auth |
| `/archivo` | Grid de pláticas grabadas con filtros | Pública |
| `/archivo/[id]` | Reproductor de grabación + descripción | Pública |
| `/login` | Inicio de sesión Google | Pública |
| `/admin` | Dashboard admin | Admin |
| `/admin/usuarios` | Gestión de usuarios y verificaciones | Admin |
| `/admin/question-sets` | Banco de preguntas | Admin |
| `/admin/juegos/nueva` | Crear partida | Admin |
| `/admin/juegos/[id]/host` | Panel host de juego en vivo | Admin |
| `/admin/archivo/nueva` | Subir grabación | Admin |

### Component Hierarchy — Sala de Plática

```
/platikas/[id]/page.tsx (Server Component — carga datos de la plática)
└── PláticaRoom (Client Component — maneja LiveKit y Realtime)
    ├── LiveKitRoom (wrapper de @livekit/components-react)
    │   ├── StagePanel
    │   │   ├── VideoGrid (participantes en escenario)
    │   │   └── AudioRenderer (audio de todos los tracks)
    │   └── HostControls (solo si role === 'host')
    │       ├── RadioToggleButton
    │       └── RequestQueue
    │           └── RequestCard[] (aprobar/rechazar)
    ├── ChatPanel (Supabase Realtime)
    │   ├── MessageList
    │   │   └── MessageBubble[]
    │   └── MessageInput (solo si auth)
    └── RequestButton (solo si auth y no es speaker/host)
```

### Component Hierarchy — Sala de Juego

```
/juegos/[id]/page.tsx (Server Component)
└── GameRoom (Client Component — Supabase Realtime broadcast)
    ├── GameLobby (si status === 'lobby')
    │   ├── TeamSelect
    │   └── PlayerList
    ├── QuestionView (si status === 'in_progress')
    │   ├── QuestionCard
    │   ├── AnswerOptions
    │   ├── CountdownTimer
    │   └── MiniScoreboard
    └── GameResults (si status === 'finished')
        └── Scoreboard (final, con confetti)
```

### State Management

- **Server Components**: fetch de datos iniciales (plática, juego, archivo) — sin estado cliente
- **Supabase Realtime**: chat (`postgres_changes` en `platikas_messages`), cola (`postgres_changes` en `platikas_requests`), estado de juego (`broadcast` en canal `game:${id}`)
- **Zustand**: estado UI local — sidebar abierto, volumen del player, preferencias de pantalla
- **React state (`useState`)**: timer de pregunta, animaciones de respuesta, estado del player de audio

---

## 7. Design System

### Colors

| Role | Hex | Uso |
|------|-----|-----|
| Primary (Gold) | `#D4A017` | Botones primarios, links, estados activos, glow |
| Primary Light | `#EDB84A` | Hover, shine, estados iluminados |
| Primary Dark | `#A07810` | Pressed, bordes de elementos gold |
| Background | `#0A0A12` | Fondo general de la app |
| Surface | `#12121E` | Cards, paneles, sidebar |
| Surface Elevated | `#1C1C2E` | Modals, dropdowns, tooltips |
| Border | `#2A2A3E` | Divisores, bordes de card |
| Text Primary | `#F8F8FF` | Títulos, texto principal |
| Text Secondary | `#9090A8` | Labels, texto muted, subtítulos |
| Live | `#FF4444` | Badge "EN VIVO", indicadores urgentes |
| Success | `#4ADE80` | Respuesta correcta, confirmaciones |
| Destructive | `#F87171` | Errores, respuesta incorrecta, eliminar |
| Info | `#60A5FA` | Notificaciones, información |

### Typography

| Role | Font | Tamaño | Peso |
|------|------|--------|------|
| Logo "Elim LLDM" | Cinzel | 24px | 700 |
| Headings H1 | Inter | 48px/36px | 700 |
| Headings H2-H3 | Inter | 30px/24px | 600 |
| Body | Inter | 16px | 400 |
| UI Labels | Inter | 14px | 500 |
| Caption | Inter | 12px | 400 |

Google Fonts: cargar solo `Inter` (variable) + `Cinzel` (solo para logo).

### Spacing & Layout

- Spacing base: `4px` — escala: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Border radius: `8px` default · `12px` cards · `16px` modals · `9999px` badges/pills
- Max content width: `1280px`
- Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`

### Component Style

- **Aesthetic**: "Santuario oscuro" — catedral por la noche, oro caliente contra la oscuridad profunda. Profesional pero espiritual, nunca corporativo frío.
- **Cards**: `bg-surface border border-border rounded-xl` con sutil sombra interior gold en hover
- **Botones primarios**: `bg-[#D4A017] text-black rounded-lg font-semibold` con glow gold en hover: `shadow-[0_0_20px_rgba(212,160,23,0.4)]`
- **Badge LIVE**: `bg-[#FF4444] text-white rounded-full text-xs font-bold animate-pulse`
- **Inputs**: `bg-surface-elevated border-border focus:border-primary` — sin ring estándar, usar border gold
- **Animaciones**: `transition-all duration-200 ease-out`. Scale `1.02` en hover de cards interactivas.
- **Glassmorphism sutil**: `backdrop-blur-sm bg-surface/80` para overlays y headers en scroll.

### CSS Variables (globals.css)

```css
:root {
  --color-bg: #0A0A12;
  --color-surface: #12121E;
  --color-surface-elevated: #1C1C2E;
  --color-border: #2A2A3E;
  --color-primary: #D4A017;
  --color-primary-light: #EDB84A;
  --color-text: #F8F8FF;
  --color-text-muted: #9090A8;
  --color-live: #FF4444;
  --color-success: #4ADE80;
  --color-destructive: #F87171;
  --radius: 8px;
}
```

---

## 8. Authentication & Authorization

### Auth Flow

1. Usuario llega → ve radio/pláticas/archivo sin cuenta
2. Intenta chatear/solicitar subir/jugar → redirect a `/login?returnUrl=...`
3. Login con Google OAuth via Supabase Auth
4. Callback en `/auth/callback` → `supabase.auth.exchangeCodeForSession()`
5. Trigger `handle_new_user()` crea profile automáticamente
6. Redirect al `returnUrl` o a `/`
7. Middleware refreshes session en cada request

### Protected Routes

| Ruta | Protección |
|------|-----------|
| `/admin/*` | Solo rol `admin` — redirect a `/` si no |
| `/juegos/[id]` | Auth requerida para jugar |
| API routes de mutación | Verificar `auth.getUser()` server-side |
| Acciones de anfitrión | Verificar `role IN ('admin', 'anfitrion')` |
| Crear plática | Verificar `role IN ('admin', 'anfitrion') AND verified_lldm = true` |

### Roles & Permissions

| Rol | Puede |
|-----|-------|
| `visitante` | Ver radio, pláticas en vivo, archivo, juegos (read-only) |
| `participante` | Todo lo anterior + chatear, solicitar subir al escenario, jugar |
| `anfitrion` | Todo lo anterior + crear pláticas, moderar chat, aprobar solicitudes, activar relay radio, crear juegos |
| `admin` | Todo + gestionar usuarios, verificar anfitriones, CRUD preguntas, publicar en archivo |

### Session Management

- Cookie-based via `@supabase/ssr` (httpOnly, secure, SameSite=Lax)
- Middleware llama `updateSession()` en cada request para refrescar token
- LiveKit tokens: short-lived JWTs generados server-side por cada acceso a room, no persistidos

---

## 9. Build Order

**Step 1: Project Scaffolding**
```bash
pnpm create next-app@latest elim-lldm --typescript --tailwind --app --src-dir --import-alias "@/*"
cd elim-lldm

# Instalar shadcn/ui
pnpm dlx shadcn@latest init
# Seleccionar: style=Default, base color=Neutral, CSS variables=yes

# Instalar dependencias core
pnpm add @supabase/ssr @supabase/supabase-js
pnpm add livekit-client @livekit/components-react livekit-server-sdk
pnpm add zustand
pnpm add -D supabase

# Configurar globals.css con CSS variables del design system
# Configurar tailwind.config.ts con colores custom
# Crear .env.local con variables vacías
# Crear .env.example documentado
```
**Deliverable**: App Next.js corriendo en localhost:3000 con Tailwind y shadcn listos.

---

**Step 2: Supabase Setup + Schema**
```bash
# Crear proyecto en supabase.com
# Ir a SQL Editor y ejecutar supabase/migrations/0001_init.sql completo
# Habilitar Google OAuth en Authentication > Providers

# Generar tipos TypeScript
pnpm supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.ts

# Crear carpeta supabase/migrations/ y guardar el SQL
```
- Crear `src/lib/supabase/client.ts` — `createBrowserClient()`
- Crear `src/lib/supabase/server.ts` — `createServerClient()` con cookies
- Crear `src/middleware.ts` — `updateSession()` para refrescar tokens

**Deliverable**: Schema completo en Supabase, tipos generados, clientes configurados.

---

**Step 3: Auth — Login con Google**
- Crear `src/app/(auth)/login/page.tsx` — botón "Continuar con Google" que llama `supabase.auth.signInWithOAuth()`
- Crear `src/app/(auth)/callback/route.ts` — maneja OAuth callback, intercambia code por session
- Actualizar `src/middleware.ts` — proteger rutas `/admin/*`, redirigir `/login` si no hay sesión
- Crear helper `getProfile()` en `src/lib/supabase/server.ts` — obtiene perfil del usuario actual
- Probar: registrarse con Google → profile creado automáticamente → rol `participante`

**Deliverable**: Login con Google funcionando, profile auto-creado, rutas protegidas.

---

**Step 4: Layouts**
- Crear `src/app/(public)/layout.tsx` — `PublicHeader` (logo Elim LLDM + nav + botón login/perfil) + `PublicFooter`
- Crear `src/components/layout/PublicHeader.tsx` — nav links: Radio, Pláticas, Juegos, Archivo + auth state
- Crear `src/app/admin/layout.tsx` — sidebar con links admin
- Usar `/frontend-design` para construir el header y sidebar con el design system definido

**Deliverable**: Layouts públicos y admin funcionando, navegación completa.

---

**Step 5: Radio**
- Crear `src/app/(public)/radio/page.tsx` — Server Component que pre-renderiza la página
- Crear `src/components/radio/RadioPlayer.tsx` — HTML5 `<audio>` apuntando a `https://radio.elimlldm.net/listen/elim_radio/radio.mp3`
  - Controles: play/pause, volumen, mute
  - Estado visual cuando está cargando/buffering
- Crear `src/lib/azuracast/api.ts` — fetch a `https://radio.elimlldm.net/api/nowplaying/1` (AzuraCast API pública)
- Crear `src/components/radio/RadioMetadata.tsx` — muestra "Now Playing", oyentes, duración
- Crear `src/components/radio/RadioVisualizer.tsx` — animación CSS de ondas de audio (decorativo)
- La metadata se revalida cada 30 segundos con `{ next: { revalidate: 30 } }` en el fetch

**Deliverable**: Radio en vivo con metadata de AzuraCast funcionando.

---

**Step 6: Sala de Pláticas — Core**
- Crear `src/app/(public)/platikas/page.tsx` — lista de pláticas (live + scheduled) desde Supabase
- Crear `src/app/(public)/platikas/[id]/page.tsx` — Server Component que carga datos de la plática
- Crear `src/components/platikas/LiveKitRoom.tsx`:
  - Llama `/api/livekit/token` para obtener token
  - Envuelve `<LiveKitRoom>` de `@livekit/components-react`
  - Determina rol: host si `pláticas.host_id === user.id`, speaker si aprobado, viewer si resto
- Crear `src/components/platikas/ChatPanel.tsx`:
  - Suscripción Supabase Realtime a `platikas_messages` con `postgres_changes`
  - Input de mensaje (solo si auth)
  - Muestra mensajes no moderados; admin ve todos
- Crear `src/components/platikas/RequestQueue.tsx`:
  - Solo visible para host/admin
  - Suscripción Realtime a `platikas_requests` WHERE `status = 'pending'`
  - Botones Aprobar/Rechazar por solicitud
- Crear `src/components/platikas/RequestButton.tsx`:
  - Visible para participantes autenticados que no son host/speaker
  - POST a `/api/platikas/[id]/requests` para crear solicitud
- Crear `src/api/livekit/token/route.ts` — genera AccessToken con permisos por rol
- Crear `src/api/platikas/[id]/go-live/route.ts` — crea room en LiveKit, actualiza status a 'live'
- Crear `src/api/platikas/[id]/requests/[reqId]/approve/route.ts` — aprueba solicitud, crea token speaker

**Deliverable**: Sala de plática en vivo con LiveKit, chat y sistema de cola funcionando.

---

**Step 7: Admin Panel — Gestión Base + Crear Pláticas**
- Crear `/admin/page.tsx` — dashboard con métricas básicas (pláticas activas, juegos en lobby)
- Crear `/admin/usuarios/page.tsx` — tabla de usuarios con botón "Verificar como anfitrión LLDM"
- Crear `/admin/platikas/nueva/page.tsx` — formulario para crear plática (título, descripción, fecha)
- Crear `src/components/platikas/HostControls.tsx`:
  - Botón "Ir en Vivo" → POST `/api/platikas/[id]/go-live`
  - Botón "Terminar" → POST `/api/platikas/[id]/end`
  - Toggle "Salida a Radio" → POST `/api/platikas/[id]/radio-toggle`

**Deliverable**: Admin puede crear pláticas, verificar anfitriones, controlar sesión en vivo.

---

**Step 8: Relay Service — LiveKit → AzuraCast**

Crear carpeta `relay/` como subproyecto Node.js:
```bash
cd relay
pnpm init
pnpm add express @livekit/rtc-node fluent-ffmpeg
pnpm add -D @types/express typescript tsx
```

Arquitectura del relay:
```
POST /start { roomName, azuracastSourceUrl, azuracastPassword }
  → Crea AccessToken con identity='radio-bot', canPublish=false, canSubscribe=true
  → Conecta al LiveKit room
  → Subscrive a todos los audio tracks
  → Inicia FFmpeg: stdin (PCM desde LiveKit tracks) → Icecast output → AzuraCast
  → Devuelve { egressId }

POST /stop { egressId }
  → Desconecta bot, termina FFmpeg process
```

- Configurar variables: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AZURACAST_SOURCE_PASSWORD`
- Deploy en Railway como servicio Node.js persistente
- La URL del relay se guarda en `RELAY_SERVICE_URL` en env de Vercel

**Deliverable**: Cuando el anfitrión activa "Salida a Radio", el audio de la plática aparece en `radio.elimlldm.net`.

---

**Step 9: Juegos Bíblicos — Jugador**
- Crear `/juegos/page.tsx` — lista juegos en lobby, input para unirse por código
- Crear `/juegos/[id]/page.tsx` — sala de juego completa
- Crear `src/components/juegos/GameRoom.tsx` (Client Component):
  - Suscripción Supabase Realtime broadcast en canal `game:${id}`
  - Eventos escuchados: `QUESTION_START`, `QUESTION_END`, `SCORES_UPDATE`, `GAME_FINISHED`
  - Estado local: `phase: 'lobby' | 'question' | 'results' | 'finished'`
- Crear `GameLobby.tsx` — lista de jugadores por equipo, botón de selección de equipo
- Crear `QuestionCard.tsx` + `AnswerOptions.tsx` — muestra pregunta, 4 opciones, timer countdown
  - Al responder: POST a `/api/games/[id]/answer` → guarda en `game_answers`, no broadcast
- Crear `Scoreboard.tsx` — clasificación en tiempo real por equipo y jugador

**Deliverable**: Jugadores pueden unirse, seleccionar equipo, responder preguntas en tiempo real.

---

**Step 10: Juegos Bíblicos — Admin/Host**
- Crear `/admin/question-sets/page.tsx` — lista de sets, botón crear
- Crear `/admin/question-sets/nueva/page.tsx` — form: título + descripción del set
- Crear `/admin/question-sets/[id]/page.tsx`:
  - Lista de preguntas con drag-and-drop para reordenar
  - Form inline para agregar/editar pregunta (texto, 4 opciones, opción correcta, referencia bíblica, tiempo, puntos)
- Crear `/admin/juegos/nueva/page.tsx` — form: título, seleccionar question set, crear equipos
- Crear `/admin/juegos/[id]/host/page.tsx` — panel host:
  - Lista de jugadores en lobby
  - Botón "Iniciar partida" → POST `/api/games/[id]/start`
  - Vista de pregunta actual con timer
  - Botón "Siguiente pregunta" → POST `/api/games/[id]/next-question`
  - Estadísticas en tiempo real (cuántos respondieron)
  - Botón "Terminar" → POST `/api/games/[id]/finish`

**Deliverable**: Admin puede crear banco de preguntas y hostear partidas completas.

---

**Step 11: Archivo**
- Crear `/archivo/page.tsx` — grid de pláticas publicadas con filtros (categoría, tags, búsqueda por título)
  - Full-text search via `supabase.from('archive').select().textSearch('title', query)`
  - Filtro por `category_id`, tags con `@>` operator (array contains)
- Crear `/archivo/[id]/page.tsx` — player de video + metadata + categoría + tags
  - Incrementar `view_count` via Server Action al cargar
- Crear `/admin/archivo/nueva/page.tsx`:
  - Upload de video a Supabase Storage bucket `recordings`
  - Upload de thumbnail
  - Form: título, descripción, categoría, tags, pláticas_id opcional
  - Checkbox "Publicar inmediatamente"
- Crear `/admin/page.tsx` panel de categorías — CRUD de `categories`

**Deliverable**: Archivo navegable con búsqueda y filtros; admins pueden subir grabaciones.

---

**Step 12: Landing Page + SEO**
- Crear `src/app/(public)/page.tsx` — landing page pública
  - **Hero**: fondo oscuro con gradiente, logo Elim LLDM (Cinzel), tagline, mini radio player incrustado
  - **Sección Radio**: descripción + CTA "Escuchar ahora"
  - **Sección Pláticas**: descripción + próxima plática programada
  - **Sección Juegos**: descripción + CTA
  - **Sección Archivo**: últimas 4 grabaciones
  - **Footer**: logo + redes sociales + créditos LLDM
- Agregar metadata en `layout.tsx`: title, description, OG image, Twitter card
- Crear `public/og-image.png` (1200x630) — imagen de redes sociales
- Usar `/seo-audit` después del deploy para verificar

**Deliverable**: Landing page completa con SEO básico.

---

**Step 13: Polish, Testing & Deploy**

Polish:
- Loading states con `<Suspense>` y skeletons en todas las páginas
- Error boundaries en componentes LiveKit y Realtime
- Empty states (sin pláticas, sin juegos en lobby, archivo vacío)
- Responsive: revisar todas las páginas en mobile (375px, 768px)
- Accesibilidad: `aria-label` en controles del player, focus states visibles

Deploy:
```bash
# Vercel
vercel --prod
# Configurar environment variables en Vercel Dashboard

# Railway (relay service)
railway up
```

Variables de entorno en Vercel:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
NEXT_PUBLIC_LIVEKIT_URL
RELAY_SERVICE_URL
RELAY_SERVICE_SECRET
```

**Deliverable**: Plataforma completa en producción con dominio personalizado.

---

## 10. Environment Setup

### Prerequisites

- Node.js 20+ (LTS)
- pnpm 9+
- Cuenta Supabase (supabase.com)
- Cuenta LiveKit Cloud (livekit.io)
- Cuenta Vercel (vercel.com)
- Cuenta Railway (railway.app) — para relay service
- AzuraCast con acceso a credenciales de source mount

### Environment Variables

| Variable | Descripción | Dónde obtener |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (server-only) | Supabase Dashboard > Settings > API |
| `LIVEKIT_URL` | WebSocket URL de LiveKit Cloud | LiveKit Cloud > Project Settings |
| `LIVEKIT_API_KEY` | API Key LiveKit | LiveKit Cloud > Project Settings |
| `LIVEKIT_API_SECRET` | API Secret LiveKit | LiveKit Cloud > Project Settings |
| `NEXT_PUBLIC_LIVEKIT_URL` | URL pública de LiveKit (para client) | Igual que LIVEKIT_URL |
| `RELAY_SERVICE_URL` | URL del relay en Railway | Railway > Deploy > URL |
| `RELAY_SERVICE_SECRET` | Secret para autenticar al relay | Generar: `openssl rand -hex 32` |
| `AZURACAST_SOURCE_PASSWORD` | Password del source mount en AzuraCast | Panel AzuraCast > Mount Points |

### Initial Setup Commands

```bash
# 1. Clonar y entrar al proyecto
git clone <repo>
cd elim-lldm

# 2. Instalar dependencias
pnpm install

# 3. Copiar env
cp .env.example .env.local
# Llenar .env.local con las variables reales

# 4. Sincronizar schema con Supabase (primera vez)
# Ir a Supabase SQL Editor y ejecutar supabase/migrations/0001_init.sql

# 5. Generar tipos TypeScript
pnpm supabase gen types typescript --project-id <project-id> > src/types/database.ts

# 6. Correr en desarrollo
pnpm dev

# 7. Para el relay (en carpeta relay/)
cd relay && pnpm install && pnpm dev
```

---

## 11. Dependencies

### Core

| Package | Propósito |
|---------|-----------|
| `@supabase/ssr` | Cliente Supabase con manejo de cookies (SSR) |
| `@supabase/supabase-js` | Cliente Supabase base |
| `livekit-client` | SDK cliente LiveKit para WebRTC |
| `@livekit/components-react` | Componentes React de LiveKit |
| `livekit-server-sdk` | Generación de tokens LiveKit (server-side) |
| `zustand` | State management ligero para UI state |
| `next-themes` | Dark mode (aunque solo dark, útil para extensión futura) |
| `lucide-react` | Iconos (incluido con shadcn/ui) |

### Dev

| Package | Propósito |
|---------|-----------|
| `supabase` | CLI de Supabase (gen types, migrations) |
| `typescript` | |
| `@types/node` | |
| `eslint` + `eslint-config-next` | Linting |
| `prettier` | Formateo (opcional pero recomendado) |

### Relay Service (`relay/package.json`)

| Package | Propósito |
|---------|-----------|
| `express` | HTTP server para start/stop relay |
| `@livekit/rtc-node` | WebRTC en Node.js — bot participant |
| `fluent-ffmpeg` | Interfaz FFmpeg para mixing y streaming |
| `ffmpeg-static` | Binario FFmpeg incluido |

---

## 12. Deployment Strategy

### Hosting

- **Next.js app → Vercel**: deploy automático desde main branch. Preview URLs en PRs.
- **Relay service → Railway**: deploy desde `relay/` subdirectorio. Proceso persistente (no serverless).

### CI/CD

- Push a `main` → Vercel auto-deploya a producción
- Push a cualquier otra rama → Vercel crea preview URL
- No hay CI/CD configurado para el relay — deploy manual con `railway up` tras cambios

### Domain & DNS

- App: configurar dominio `elimlldm.com` (o similar) en Vercel > Domains
- Supabase auth callback URL: agregar `https://elimlldm.com/auth/callback` en Supabase Auth > URL Configuration

### Environments

| Entorno | App | DB | LiveKit |
|---------|-----|----|---------|
| Local | `localhost:3000` | Supabase prod (o crear proyecto dev separado) | LiveKit Cloud dev project |
| Preview (PR) | `*.vercel.app` | Supabase prod | LiveKit Cloud dev project |
| Producción | `elimlldm.com` | Supabase prod | LiveKit Cloud prod project |

---

## 13. Testing Strategy

### Unit Tests

- Framework: Vitest
- Testear: utilidades en `lib/` (formatDate, generateJoinCode), lógica de scoring de juegos
- No testear componentes UI con unit tests — demasiado frágil

### Integration Tests

- Testear API routes críticas: generación de token LiveKit, aprobación de solicitudes, scoring de preguntas
- Usar Supabase local (`supabase start`) para tests de DB

### E2E Tests

- Framework: Playwright — usar `/playwright-cli` durante la fase de build
- Flujos críticos a testear:
  1. Login con Google → profile creado → ver plática → enviar chat
  2. Unirse a juego → seleccionar equipo → responder pregunta
  3. Admin crea pregunta → crea juego → inicia partida
- Correr en CI antes de merge a main (configurar en Vercel o GitHub Actions)

---

## 14. Skills to Use During Build

| Skill | Cuándo usar | Por qué |
|-------|-------------|---------|
| `/frontend-design` | Steps 4, 5, 6, 9, 12 (layouts, radio, sala, juegos, landing) | Construir UI distintiva y production-grade con el design system definido |
| `/shadcn-ui` | Step 1 (scaffolding) | Setup y personalización de componentes shadcn |
| `/seo-audit` | Step 13 (después del deploy) | Auditar SEO técnico antes del lanzamiento |
| `/playwright-cli` | Step 13 (testing) | Automatizar E2E de los flujos críticos |

---

## 15. CLAUDE.md for Target Project

```markdown
# Elim LLDM

Plataforma cristiana LLDM: radio 24/7, pláticas en vivo con debate WebRTC, juegos bíblicos en tiempo real, y archivo de grabaciones.

## Commands

- `pnpm dev` — Start development server (localhost:3000)
- `pnpm build` — Production build
- `pnpm lint` — Run ESLint
- `pnpm test` — Run Vitest
- `pnpm supabase gen types typescript --project-id <id> > src/types/database.ts` — Regenerar tipos DB

## Tech Stack

Next.js 15 App Router + TypeScript strict + Tailwind v4 + shadcn/ui + Supabase (Auth/DB/Realtime/Storage) + LiveKit Cloud + Vercel

## Architecture

### Directory Structure
- `src/app/(public)/` — Páginas públicas (radio, platikas, juegos, archivo, landing)
- `src/app/(auth)/` — Login + OAuth callback
- `src/app/admin/` — Panel admin protegido por rol
- `src/app/api/` — API routes: LiveKit tokens, control de pláticas, control de juegos
- `src/components/` — Componentes por dominio: radio/, platikas/, juegos/, archivo/, layout/, ui/
- `src/lib/supabase/` — client.ts (browser), server.ts (server con cookies), middleware.ts
- `src/lib/livekit/` — tokens.ts (generación de AccessToken)
- `src/lib/azuracast/` — api.ts (fetch metadata del stream)
- `src/types/` — database.ts (auto-generado), index.ts (tipos de dominio)
- `relay/` — Servicio Node.js separado para bridge LiveKit→AzuraCast (deploy en Railway)

### Data Flow
- Páginas públicas: Server Component → query Supabase directo → render HTML
- Mutaciones: Server Actions o API routes → Supabase client con service role
- Chat/Cola en tiempo real: Client Component → Supabase Realtime postgres_changes
- Estado de juego: Client Component → Supabase Realtime broadcast channel `game:${id}`
- Audio/video en vivo: LiveKitRoom client → LiveKit Cloud (WebRTC)
- Radio: HTML5 audio → AzuraCast stream URL directa

### Key Patterns
- Server Components por defecto; "use client" solo cuando hay interactividad (Realtime, LiveKit, eventos)
- Auth: `src/lib/supabase/server.ts` en Server Components, `src/lib/supabase/client.ts` en Client Components
- Roles verificados server-side antes de cualquier mutación — nunca confiar en el cliente
- LiveKit tokens generados en API routes server-side, nunca exponer API_SECRET al cliente
- Supabase Realtime para chat y cola; Broadcast para estado de juego (no persiste en DB)

## Design System

### Colors (CSS variables en globals.css)
- `--color-bg: #0A0A12` — Fondo
- `--color-surface: #12121E` — Cards
- `--color-surface-elevated: #1C1C2E` — Modals
- `--color-border: #2A2A3E`
- `--color-primary: #D4A017` — Gold principal
- `--color-primary-light: #EDB84A` — Gold hover
- `--color-text: #F8F8FF`
- `--color-text-muted: #9090A8`
- `--color-live: #FF4444`
- `--color-success: #4ADE80`
- `--color-destructive: #F87171`

### Typography
- Logo: Cinzel 700 (Google Fonts — solo para componente logo)
- Headings + Body: Inter (Google Fonts — variable font)
- Tamaños: H1=48px, H2=30px, H3=24px, Body=16px, Label=14px

### Style
- Border radius: 8px default, 12px cards, 16px modals
- Aesthetic: "santuario oscuro" — fondos oscuros, acentos gold cálidos, nunca corporativo frío
- Botón primario: `bg-[#D4A017] text-black hover:shadow-[0_0_20px_rgba(212,160,23,0.4)]`
- Badge LIVE: `bg-[#FF4444] rounded-full animate-pulse`

## Environment Variables

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NUNCA exponer al cliente) |
| `LIVEKIT_URL` | WebSocket URL LiveKit Cloud |
| `LIVEKIT_API_KEY` | API Key LiveKit |
| `LIVEKIT_API_SECRET` | API Secret LiveKit (NUNCA exponer al cliente) |
| `NEXT_PUBLIC_LIVEKIT_URL` | URL LiveKit pública para el cliente |
| `RELAY_SERVICE_URL` | URL del relay Node.js en Railway |
| `RELAY_SERVICE_SECRET` | Secret para autenticar requests al relay |

## Reglas No Negociables

1. TypeScript strict — prohibido `any`. Usar tipos generados de `src/types/database.ts`.
2. LIVEKIT_API_SECRET y SUPABASE_SERVICE_ROLE_KEY solo en server-side. Nunca en componentes client ni NEXT_PUBLIC_*.
3. Verificar rol del usuario en CADA API route y Server Action antes de mutación — nunca confiar en el cliente.
4. Un componente por archivo, máximo 300 líneas. Si crece más, extraer sub-componentes.
5. Mobile-first: diseñar desde 375px hacia arriba. Todas las páginas deben ser usables en móvil.
```

---

## 16. Reglas No Negociables

1. **TypeScript strict, prohibido `any`** — Usar tipos generados por Supabase CLI. Si el tipo no existe, crearlo en `src/types/index.ts`.
2. **Secretos nunca al cliente** — `LIVEKIT_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` y `RELAY_SERVICE_SECRET` solo se usan en server-side. Cualquier variable que el cliente necesite lleva prefijo `NEXT_PUBLIC_`.
3. **Autorización server-side siempre** — Cada API route y Server Action verifica el rol del usuario con `getProfile()` antes de cualquier mutación. El frontend puede esconder botones, pero la API es la línea de defensa real.
4. **Un componente por archivo, máximo 300 líneas** — Si un componente crece, extraer sub-componentes al mismo directorio.
5. **Mobile-first** — Diseñar desde 375px. Las salas de LiveKit y de juego deben ser completamente usables desde un teléfono.
6. **RLS habilitado en todas las tablas** — Ninguna tabla sin política RLS. Usar `service_role` solo en el servidor para operaciones privilegiadas.
7. **El relay es un servicio separado** — No mezclar el código del relay en el repo Next.js. Mantener `relay/` como subproyecto independiente con su propio `package.json`.
8. **El `join_code` de juegos siempre se genera server-side** — Nunca confiar en el código que envía el cliente.
9. **Respuestas de juego validadas en el servidor** — El servidor calcula `is_correct` comparando con `questions.correct_option`. El cliente nunca ve la respuesta correcta hasta que la pregunta termina.
10. **El archivo de grabaciones solo lo publican admins** — `is_published` solo se puede setear a `true` desde una API route con rol `admin` verificado.
