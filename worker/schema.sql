-- Base de datos del juego (Cloudflare D1). Se aplica sola en cada publicación; es segura de repetir.
CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY,          -- id de la cuenta de Google
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL,           -- el progreso completo (JSON). Solo lo escribe el servidor.
  version INTEGER NOT NULL DEFAULT 0, -- sube en cada cambio: evita que dos pedidos a la vez se pisen
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  rate_min INTEGER NOT NULL DEFAULT 0, -- minuto actual y pedidos en ese minuto (límite anti-abuso)
  rate_n INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,         -- sha256 de la sesión: si se filtra la base, las sesiones no sirven
  sub TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_sub ON sessions(sub);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  level INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  snapshot TEXT NOT NULL,        -- el progreso al empezar: con esto se rejuega la pelea
  started INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_sub ON runs(sub, started);
-- Retos entre amigos: un código, un jefe, 60 segundos. Gana quien le hace más daño.
CREATE TABLE IF NOT EXISTS duels (
  code TEXT PRIMARY KEY,
  sub TEXT NOT NULL,             -- quien lo creó
  level INTEGER NOT NULL,
  seed INTEGER NOT NULL,         -- todos juegan con las mismas piezas
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS duels_sub ON duels(sub, created);
CREATE TABLE IF NOT EXISTS duel_entries (
  code TEXT NOT NULL,
  sub TEXT NOT NULL,
  name TEXT NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  combo INTEGER NOT NULL DEFAULT 0,
  run_id TEXT NOT NULL,
  snapshot TEXT NOT NULL,        -- el progreso al empezar: con esto se rejuega
  started INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0, -- un solo intento por persona
  PRIMARY KEY (code, sub)
);
CREATE INDEX IF NOT EXISTS duel_entries_sub ON duel_entries(sub, started);
CREATE INDEX IF NOT EXISTS duel_entries_run ON duel_entries(run_id);
