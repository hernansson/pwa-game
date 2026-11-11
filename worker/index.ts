// Servidor del juego (Cloudflare Worker + D1).
// Regla de oro: el servidor manda. El progreso vive acá y solo cambia por acciones que el servidor
// valida con el mismo código del juego. Las peleas se rejuegan a partir de la semilla y las jugadas,
// así que el celu nunca puede decir "gané" ni inventar oro, gemas o daño.
//
//   POST /auth/google {credential}  -> {session, me}
//   POST /auth/logout
//   GET  /state                     -> {state, me}
//   POST /act {type, ...}           -> {state, me, result}

import { Game } from '../src/game';
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
        const got = g.openChest(str('id'), !!b.free);
        if (!got) throw new HttpError(400, 'cannot_open');
        return { got };
      });
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
