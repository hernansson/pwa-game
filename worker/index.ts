// Servidor del juego (Cloudflare Worker + D1).
// Regla de oro: el servidor manda. El progreso vive acá y solo cambia por acciones que el servidor
// valida con el mismo código del juego. Las peleas se rejuegan a partir de la semilla y las jugadas,
// así que el celu nunca puede decir "gané" ni inventar oro, gemas o daño.
//
//   POST /auth/google {credential}  -> {session, me}
//   POST /auth/logout
//   GET  /state                     -> {state, me}
//   POST /act {type, ...}           -> {state, me, result}

import { DUEL_SECONDS, Game } from '../src/game';
import { GameState, newState, migrate, regenEnergy } from '../src/state';
import { rolloverLeague } from '../src/league';
import { replayRun } from '../src/replay';
import { UPGRADES, UpgradeId } from '../src/balance';
import { ARMS } from '../src/arsenal';

interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
interface Env {
  DB: { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<unknown> };
  ADMIN_EMAIL?: string;
}

const GOOGLE_CLIENT_ID = '554911510319-s9etahete05ilh86dd2r2bfnilq1jgkm.apps.googleusercontent.com';
const ALLOWED_ORIGINS = ['https://hernansson.github.io', 'http://localhost:5173', 'http://localhost:4181'];
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const RUN_TTL = 30 * 60 * 1000; // una pelea abierta vence a los 30 minutos
const RATE_PER_MIN = 90; // pedidos por minuto por cuenta
const MAX_OPEN_RUNS = 3;

type User = { sub: string; email: string; name: string; admin: boolean };
class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin') || '';
    const cors: Record<string, string> = { Vary: 'Origin' };
    if (ALLOWED_ORIGINS.includes(origin)) cors['Access-Control-Allow-Origin'] = origin;
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } });
    if (origin && !cors['Access-Control-Allow-Origin']) return json({ error: 'origin_not_allowed' }, 403, cors);
    try {
      const url = new URL(req.url);
      if (url.pathname === '/health') return json({ ok: true }, 200, cors);
      if (url.pathname === '/auth/google' && req.method === 'POST') return json(await login(req, env), 200, cors);
      const user = await sessionUser(req, env);
      if (!user) return json({ error: 'unauthorized' }, 401, cors);
      if (url.pathname === '/auth/logout' && req.method === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(bearer(req)!)).run();
        return json({ ok: true }, 200, cors);
      }
      if (url.pathname === '/state' && req.method === 'GET') {
        const out = await mutate(env, user, () => null);
        return json(out, 200, cors);
      }
      if (url.pathname === '/act' && req.method === 'POST') {
        const text = await req.text();
        if (text.length > 400_000) throw new HttpError(413, 'too_large');
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(text);
        } catch {
          throw new HttpError(400, 'bad_json');
        }
        return json(await act(env, user, body), 200, cors);
      }
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
      console.error(e);
      return json({ error: 'server_error' }, 500, cors);
    }
  },
};

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

// ---------- Cuenta ----------

async function login(req: Request, env: Env) {
  const body = (await req.json().catch(() => null)) as { credential?: string } | null;
  const g = await verifyGoogle(body?.credential ?? '');
  const now = Date.now();
  const row = await env.DB.prepare('SELECT sub FROM users WHERE sub = ?').bind(g.sub).first();
  if (!row) {
    // Cuenta nueva: arranca de cero. El progreso de invitado no se sube, porque en el celu se puede editar.
    const s = newState();
    s.playerName = (g.name.split(' ')[0] || 'Héroe').slice(0, 14);
    await env.DB.prepare('INSERT INTO users (sub, email, name, state, version, created, updated) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .bind(g.sub, g.email, g.name, JSON.stringify(s), now, now)
      .run();
  } else {
    await env.DB.prepare('UPDATE users SET email = ?, name = ? WHERE sub = ?').bind(g.email, g.name, g.sub).run();
  }
  const session = randHex(32);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (hash, sub, expires) VALUES (?, ?, ?)').bind(await sha256(session), g.sub, now + SESSION_TTL),
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now),
  ]);
  return { session, me: { name: g.name, email: g.email, admin: isAdmin(env, g.email) } };
}

function isAdmin(env: Env, email: string): boolean {
  const list = (env.ADMIN_EMAIL || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

function bearer(req: Request): string | null {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization') || '');
  return m ? m[1] : null;
}

async function sessionUser(req: Request, env: Env): Promise<User | null> {
  const tok = bearer(req);
  if (!tok) return null;
  const row = await env.DB.prepare('SELECT u.sub AS sub, u.email AS email, u.name AS name, s.expires AS expires FROM sessions s JOIN users u ON u.sub = s.sub WHERE s.hash = ?')
    .bind(await sha256(tok))
    .first<{ sub: string; email: string; name: string; expires: number }>();
  if (!row || row.expires < Date.now()) return null;
  return { sub: row.sub, email: row.email, name: row.name, admin: isAdmin(env, row.email) };
}

// ---------- Progreso ----------

/**
 * Lee el progreso, aplica un cambio y lo guarda. Si otro pedido lo cambió en el medio, reintenta.
 * También aplica el límite de pedidos por minuto y lo que corre solo con el tiempo (energía, liga).
 */
async function mutate<T>(env: Env, user: User, fn: (s: GameState, game: Game) => T | Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await env.DB.prepare('SELECT state, version, rate_min, rate_n FROM users WHERE sub = ?')
      .bind(user.sub)
      .first<{ state: string; version: number; rate_min: number; rate_n: number }>();
    if (!row) throw new HttpError(401, 'unauthorized');
    const minute = Math.floor(Date.now() / 60000);
    const n = row.rate_min === minute ? row.rate_n + 1 : 1;
    if (n > RATE_PER_MIN && !user.admin) throw new HttpError(429, 'too_many_requests');
    const s = migrate(JSON.parse(row.state));
    s.run = null;
    regenEnergy(s);
    rolloverLeague(s);
    const game = new Game(s);
    const result = await fn(s, game);
    s.run = null;
    s.events = s.events.slice(-100);
    const res = await env.DB.prepare('UPDATE users SET state = ?, version = version + 1, updated = ?, rate_min = ?, rate_n = ? WHERE sub = ? AND version = ?')
      .bind(JSON.stringify(s), Date.now(), minute, n, user.sub, row.version)
      .run();
    if (res.meta.changes === 1) return { state: s, me: { name: user.name, email: user.email, admin: user.admin }, result };
  }
  throw new HttpError(409, 'busy');
}

async function act(env: Env, user: User, b: Record<string, unknown>) {
  const type = String(b.type || '');
  const str = (k: string) => String(b[k] ?? '');
  const admin = () => {
    if (!user.admin) throw new HttpError(403, 'admin_only');
  };

  switch (type) {
    case 'buy':
      return mutate(env, user, (_s, g) => {
        const id = str('id') as UpgradeId;
        if (!UPGRADES.some((u) => u.id === id) || !g.buy(id)) throw new HttpError(400, 'cannot_buy');
        return { ok: true };
      });
    case 'arm_up':
      return mutate(env, user, (_s, g) => {
        const r = g.upgradeArm(str('id'));
        if (!r) throw new HttpError(400, 'cannot_upgrade');
        if (r === 'unlock') g.equipArm(str('id'));
        return { kind: r };
      });
    case 'arm_equip':
      return mutate(env, user, (_s, g) => {
        if (!g.equipArm(str('id'))) throw new HttpError(400, 'cannot_equip');
        return { ok: true };
      });
    case 'chest':
      return mutate(env, user, (_s, g) => {
        g.rand = Math.random; // en el servidor los dados no se pueden predecir desde el celu
        const r = g.openChest(str('id'), !!b.free, Number(b.count) === 10 ? 10 : 1);
        if (!r) throw new HttpError(400, 'cannot_open');
        return r;
      });
    case 'gold_pack':
      return mutate(env, user, (_s, g) => {
        const gold = g.buyGold(Number(b.pack));
        if (gold == null) throw new HttpError(400, 'cannot_buy');
        return { gold };
      });
    case 'gems_pack':
      throw new HttpError(402, 'needs_payment'); // gemas con dinero real: cuando haya cobros
    case 'refill':
      return mutate(env, user, (_s, g) => {
        if (!g.refillEnergy()) throw new HttpError(400, 'cannot_refill');
        return { ok: true };
      });
    case 'name':
      return mutate(env, user, (s) => {
        const v = str('name').replace(/[<>]/g, '').trim().slice(0, 14);
        if (v) s.playerName = v;
        return { ok: true };
      });
    case 'run_start':
      return runStart(env, user, Number(b.level));
    case 'run_finish':
      return runFinish(env, user, str('runId'), b.log);
    case 'duel_create':
      return duelCreate(env, user);
    case 'duel_get':
      return duelGet(env, user, str('code'));
    case 'duel_start':
      return duelStart(env, user, str('code'));
    case 'duel_finish':
      return duelFinish(env, user, str('runId'), b.log);
    case 'duel_mine':
      return duelMine(env, user);
    case 'pass':
      throw new HttpError(402, 'needs_payment'); // se activa cuando haya cobros reales
    // Solo para la cuenta de administrador.
    case 'admin_gems':
      admin();
      return mutate(env, user, (s) => ((s.gems += 1000), { ok: true }));
    case 'admin_gold':
      admin();
      return mutate(env, user, (s) => ((s.gold += 50000), { ok: true }));
    case 'admin_board':
      admin();
      return mutate(env, user, (_s, g) => ({ ok: g.setBoardExtra(str('kind') === 'cols' ? 'cols' : 'rows', !!b.on) }));
    case 'admin_pass':
      admin();
      return mutate(env, user, (_s, g) => (g.activatePass(), { ok: true }));
    case 'admin_fenix':
      admin();
      return mutate(env, user, (_s, g) => ({ ok: g.unlockFenix(Number(b.lvl) || 0) }));
    case 'admin_reset':
      admin();
      return mutate(env, user, (s) => {
        const fresh = newState();
        fresh.playerName = s.playerName;
        Object.assign(s, fresh);
        return { ok: true };
      });
    default:
      throw new HttpError(400, 'unknown_action');
  }
}

// ---------- Peleas ----------

async function runStart(env: Env, user: User, level: number) {
  if (!Number.isInteger(level) || level < 1) throw new HttpError(400, 'bad_level');
  const now = Date.now();
  const open = await env.DB.prepare('SELECT COUNT(*) AS n FROM runs WHERE sub = ? AND done = 0 AND started > ?').bind(user.sub, now - RUN_TTL).first<{ n: number }>();
  if ((open?.n ?? 0) >= MAX_OPEN_RUNS) throw new HttpError(429, 'too_many_runs');
  const id = randHex(16);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  let snapshot = '';
  const out = await mutate(env, user, (s, g) => {
    snapshot = JSON.stringify(s);
    if (!g.start(level)) throw new HttpError(400, 'cannot_start'); // cobra la energía acá
    return { runId: id, seed };
  });
  await env.DB.batch([
    env.DB.prepare('INSERT INTO runs (id, sub, level, seed, snapshot, started) VALUES (?, ?, ?, ?, ?, ?)').bind(id, user.sub, level, seed, snapshot, now),
    env.DB.prepare('DELETE FROM runs WHERE sub = ? AND started < ?').bind(user.sub, now - 24 * 3600 * 1000),
  ]);
  return out;
}

async function runFinish(env: Env, user: User, runId: string, log: unknown) {
  const run = await env.DB.prepare('SELECT level, seed, snapshot, started, done FROM runs WHERE id = ? AND sub = ?')
    .bind(runId, user.sub)
    .first<{ level: number; seed: number; snapshot: string; started: number; done: number }>();
  if (!run || run.done) throw new HttpError(404, 'run_not_found');
  // Marcar terminada primero: una pelea solo se cobra una vez aunque llegue dos veces.
  const claim = await env.DB.prepare('UPDATE runs SET done = 1 WHERE id = ? AND done = 0').bind(runId).run();
  if (claim.meta.changes !== 1) throw new HttpError(404, 'run_not_found');
  if (Date.now() - run.started > RUN_TTL) throw new HttpError(410, 'run_expired');
  if (!Array.isArray(log) || log.length > 5000) throw new HttpError(400, 'bad_log');
  const snap = migrate(JSON.parse(run.snapshot));
  const out = replayRun(snap, run.level, run.seed, log as number[][]);
  if (!out.ok) throw new HttpError(422, 'replay_' + out.error);
  // No se puede terminar una pelea más rápido que en tiempo real.
  const elapsed = (Date.now() - run.started) / 1000;
  if (out.steps * Game.STEP > elapsed + 5) throw new HttpError(422, 'too_fast');
  const after = out.state;
  return mutate(env, user, (s) => {
    // Se suma lo que dio la pelea (no se pisa el progreso: entre medio pudo comprar cosas).
    s.gold += after.gold - snap.gold;
    s.gems += after.gems - snap.gems;
    s.unlocked = Math.max(s.unlocked, after.unlocked);
    for (const k in after.stars) s.stars[+k] = Math.max(s.stars[+k] ?? 0, after.stars[+k]);
    for (const a of ARMS) {
      const d = (after.arsenal[a.id]?.shards ?? 0) - (snap.arsenal[a.id]?.shards ?? 0);
      if (d > 0 && s.arsenal[a.id]) s.arsenal[a.id].shards += d;
    }
    if (s.league.week === snap.league.week) s.league.points += after.league.points - snap.league.points;
    for (const k of Object.keys(s.stats) as (keyof GameState['stats'])[]) s.stats[k] += after.stats[k] - snap.stats[k];
    return { report: out.report };
  });
}

// ---------- Retos entre amigos ----------
// Un código = un jefe y una semilla. Cada persona tiene un solo intento de 60 segundos y el servidor
// rejuega su pelea para saber el daño real. Sirve igual para 2 amigos o para miles (jefe mundial).

const DUEL_TTL = 3 * 24 * 3600 * 1000; // un reto dura 3 días
const DUEL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin letras que se confunden (0/O, 1/I/L)
const DUELS_PER_DAY = 20;

function duelCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return [...b].map((x) => DUEL_ALPHABET[x % DUEL_ALPHABET.length]).join('');
}
function cleanCode(c: string): string {
  const v = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v.length !== 6) throw new HttpError(400, 'bad_code');
  return v;
}

async function readUser(env: Env, user: User) {
  const out = await mutate(env, user, () => null); // también aplica el límite de pedidos
  return out;
}

async function duelCreate(env: Env, user: User) {
  const now = Date.now();
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM duels WHERE sub = ? AND created > ?').bind(user.sub, now - 24 * 3600 * 1000).first<{ n: number }>();
  if ((n?.n ?? 0) >= DUELS_PER_DAY && !user.admin) throw new HttpError(429, 'too_many_duels');
  const base = await readUser(env, user);
  // El jefe del reto es el del nivel más alto que tiene disponible quien lo crea.
  const level = Math.max(1, base.state.unlocked);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  for (let i = 0; i < 5; i++) {
    const code = duelCode();
    const r = await env.DB.prepare('INSERT OR IGNORE INTO duels (code, sub, level, seed, created, expires) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(code, user.sub, level, seed, now, now + DUEL_TTL)
      .run();
    if (r.meta.changes === 1) return { ...base, result: { code, level, seconds: DUEL_SECONDS, expires: now + DUEL_TTL } };
  }
  throw new HttpError(503, 'busy');
}

async function duelInfo(env: Env, user: User, code: string) {
  const d = await env.DB.prepare('SELECT code, sub, level, created, expires FROM duels WHERE code = ?')
    .bind(code)
    .first<{ code: string; sub: string; level: number; created: number; expires: number }>();
  if (!d) throw new HttpError(404, 'duel_not_found');
  const top = await env.DB.prepare(
    "SELECT json_group_array(json_object('name', name, 'damage', damage, 'combo', combo, 'done', done, 'me', sub = ?)) AS j FROM (SELECT * FROM duel_entries WHERE code = ? ORDER BY done DESC, damage DESC, started ASC LIMIT 50)",
  )
    .bind(user.sub, code)
    .first<{ j: string }>();
  const mine = await env.DB.prepare('SELECT damage, done FROM duel_entries WHERE code = ? AND sub = ?').bind(code, user.sub).first<{ damage: number; done: number }>();
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM duel_entries WHERE code = ?').bind(code).first<{ n: number }>();
  let rank = 0;
  if (mine?.done) {
    const above = await env.DB.prepare('SELECT COUNT(*) AS n FROM duel_entries WHERE code = ? AND done = 1 AND damage > ?').bind(code, mine.damage).first<{ n: number }>();
    rank = (above?.n ?? 0) + 1;
  }
  const entries = (JSON.parse(top?.j || '[]') as { name: string; damage: number; combo: number; done: number; me: number }[]).map((e) => ({ ...e, done: !!e.done, me: !!e.me }));
  return {
    code: d.code,
    level: d.level,
    seconds: DUEL_SECONDS,
    expires: d.expires,
    expired: d.expires < Date.now(),
    mineCreated: d.sub === user.sub,
    played: !!mine,
    myDamage: mine?.done ? mine.damage : null,
    rank,
    players: count?.n ?? 0,
    entries,
  };
}

async function duelGet(env: Env, user: User, code: string) {
  const base = await readUser(env, user);
  return { ...base, result: await duelInfo(env, user, cleanCode(code)) };
}

async function duelStart(env: Env, user: User, raw: string) {
  const code = cleanCode(raw);
  const now = Date.now();
  const d = await env.DB.prepare('SELECT level, seed, expires FROM duels WHERE code = ?').bind(code).first<{ level: number; seed: number; expires: number }>();
  if (!d) throw new HttpError(404, 'duel_not_found');
  if (d.expires < now) throw new HttpError(410, 'duel_expired');
  const base = await readUser(env, user);
  const runId = randHex(16);
  const name = (base.state.playerName || user.name.split(' ')[0] || 'Héroe').replace(/[<>]/g, '').slice(0, 14);
  // Se anota el intento antes de jugar: si se corta o cierra la app, no hay segunda oportunidad.
  const r = await env.DB.prepare('INSERT OR IGNORE INTO duel_entries (code, sub, name, run_id, snapshot, started) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(code, user.sub, name, runId, JSON.stringify(base.state), now)
    .run();
  if (r.meta.changes !== 1) throw new HttpError(409, 'duel_already_played');
  return { ...base, result: { runId, seed: d.seed, level: d.level, seconds: DUEL_SECONDS } };
}

async function duelFinish(env: Env, user: User, runId: string, log: unknown) {
  if (!/^[a-f0-9]{32}$/.test(runId)) throw new HttpError(400, 'bad_run');
  const e = await env.DB.prepare('SELECT e.code AS code, e.snapshot AS snapshot, e.started AS started, e.done AS done, d.level AS level, d.seed AS seed FROM duel_entries e JOIN duels d ON d.code = e.code WHERE e.run_id = ? AND e.sub = ?')
    .bind(runId, user.sub)
    .first<{ code: string; snapshot: string; started: number; done: number; level: number; seed: number }>();
  if (!e || e.done) throw new HttpError(404, 'run_not_found');
  if (!Array.isArray(log) || log.length > 5000) throw new HttpError(400, 'bad_log');
  const out = replayRun(migrate(JSON.parse(e.snapshot)), e.level, e.seed, log as number[][], true);
  if (!out.ok) throw new HttpError(422, 'replay_' + out.error);
  const elapsed = (Date.now() - e.started) / 1000;
  if (out.steps * Game.STEP > elapsed + 5) throw new HttpError(422, 'too_fast');
  if (Date.now() - e.started > RUN_TTL) throw new HttpError(410, 'run_expired');
  const damage = Math.max(0, Math.round(out.report.damage ?? 0));
  const claim = await env.DB.prepare('UPDATE duel_entries SET damage = ?, combo = ?, done = 1, snapshot = \'\' WHERE run_id = ? AND done = 0')
    .bind(damage, out.report.maxCombo, runId)
    .run();
  if (claim.meta.changes !== 1) throw new HttpError(404, 'run_not_found');
  const base = await readUser(env, user);
  return { ...base, result: { damage, info: await duelInfo(env, user, e.code) } };
}

async function duelMine(env: Env, user: User) {
  const base = await readUser(env, user);
  const since = Date.now() - DUEL_TTL;
  const row = await env.DB.prepare(
    `SELECT json_group_array(json_object('code', code, 'level', level, 'created', created, 'mine', mine, 'myDamage', my_damage, 'players', players, 'best', best)) AS j FROM (
      SELECT d.code AS code, d.level AS level, d.created AS created, d.sub = ?1 AS mine,
        (SELECT damage FROM duel_entries WHERE code = d.code AND sub = ?1 AND done = 1) AS my_damage,
        (SELECT COUNT(*) FROM duel_entries WHERE code = d.code) AS players,
        (SELECT MAX(damage) FROM duel_entries WHERE code = d.code AND done = 1) AS best
      FROM duels d WHERE d.created > ?2 AND (d.sub = ?1 OR d.code IN (SELECT code FROM duel_entries WHERE sub = ?1))
      ORDER BY d.created DESC LIMIT 10)`,
  )
    .bind(user.sub, since)
    .first<{ j: string }>();
  return { ...base, result: { duels: JSON.parse(row?.j || '[]') } };
}

// ---------- Google ----------

let certCache: { at: number; keys: JsonWebKey[] & { kid?: string }[] } = { at: 0, keys: [] };
async function googleKeys(force: boolean) {
  if (!force && certCache.keys.length && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new HttpError(502, 'google_certs');
  const j = (await r.json()) as { keys: (JsonWebKey & { kid: string })[] };
  certCache = { at: Date.now(), keys: j.keys };
  return certCache.keys;
}

function b64u(t: string): Uint8Array {
  t = t.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const s = atob(t);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function verifyGoogle(token: string): Promise<{ sub: string; email: string; name: string }> {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 5000) throw new HttpError(401, 'bad_token');
  const dec = (p: string) => JSON.parse(new TextDecoder().decode(b64u(p)));
  const header = dec(parts[0]);
  const p = dec(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'bad_token');
  let keys = await googleKeys(false);
  let jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) {
    keys = await googleKeys(true);
    jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  }
  if (!jwk) throw new HttpError(401, 'bad_token');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') || p.aud !== GOOGLE_CLIENT_ID || !p.sub) throw new HttpError(401, 'bad_token');
  if (!(p.exp > now)) throw new HttpError(401, 'expired');
  return { sub: String(p.sub), email: p.email_verified ? String(p.email || '') : '', name: String(p.name || '').slice(0, 80) };
}

function randHex(n: number) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(t: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
