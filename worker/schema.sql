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
