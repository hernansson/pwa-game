// Prueba de los retos contra el servidor local (wrangler dev): dos cuentas juegan el mismo código.
// Uso: API=http://localhost:8787 TOKEN_A=... TOKEN_B=... (compilar con esbuild y correr con node)
import { Game } from '../src/game';
import { GameState } from '../src/state';
import { seeded } from '../src/rng';

const API = process.env.API ?? 'http://localhost:8787';
async function call(tok: string, path: string, body?: unknown) {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: (await r.json()) as any };
}

/** Juega el reto como una persona (una jugada cada 0,35 s) y devuelve las jugadas y el daño local. */
function play(s: GameState, level: number, seed: number, gap = 0.35, stopAt = Infinity) {
  const g = new Game(JSON.parse(JSON.stringify(s)));
  g.rand = seeded(seed);
  let rep: any = null;
  g.on((e) => e.type === 'end' && (rep = e.report));
  g.startDuel(level);
  let wait = 1.1;
  while (g.fighting) {
    g.advance(1 / 60);
    if (g.step >= stopAt) g.abandon();
    wait -= 1 / 60;
    if (wait <= 0 && g.fighting) {
      wait = gap;
      const grid = g.s.run!.grid;
      const seen = new Map<string, { col: number; row: number }>();
      outer: for (let c = 0; c < grid.length; c++)
        for (let r = 0; r < grid[c].length; r++) {
          const p = grid[c][r];
          if (!p) continue;
          const o = seen.get(p.fam + p.lvl);
          if (o) { g.merge(o, { col: c, row: r }); break outer; }
          seen.set(p.fam + p.lvl, { col: c, row: r });
        }
    }
  }
  return { log: g.log, rep, steps: g.step };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const check = (ok: boolean, msg: string) => console.log(ok ? '✓' : '✗', msg);

(async () => {
  const A = process.env.TOKEN_A!, B = process.env.TOKEN_B!;
  const c = await call(A, '/act', { type: 'duel_create' });
  check(c.status === 200, `crear reto → ${c.status} ${c.j.result?.code}`);
  const code = c.j.result.code as string;
  const ga = await call(B, '/act', { type: 'duel_get', code: code.toLowerCase() });
  check(ga.status === 200 && ga.j.result.players === 0, 'el amigo lo ve con el código en minúsculas');
  check((await call(B, '/act', { type: 'duel_get', code: 'ZZZZZZ' })).status === 404, 'código inexistente → 404');

  // A juega honesto, pero corto (abandona a los 8 s) para no esperar un minuto entero.
  const sa = await call(A, '/act', { type: 'duel_start', code });
  check(sa.status === 200, 'A empieza');
  const pa = play(sa.j.state, sa.j.result.level, sa.j.result.seed, 0.35, 8 * 30);
  check((await call(A, '/act', { type: 'duel_start', code })).j.error === 'duel_already_played', 'A no puede jugar dos veces');
  await sleep(pa.steps * 1000 / 30 + 300);
  const fa = await call(A, '/act', { type: 'duel_finish', runId: sa.j.result.runId, log: pa.log });
  check(fa.status === 200 && fa.j.result.damage === pa.rep.damage, `A: daño servidor ${fa.j.result?.damage} = local ${pa.rep.damage}`);
  check((await call(A, '/act', { type: 'duel_finish', runId: sa.j.result.runId, log: pa.log })).status === 404, 'no se puede anotar dos veces');

  // B intenta trampas: terminar sin esperar.
  const sb = await call(B, '/act', { type: 'duel_start', code });
  const pb = play(sb.j.state, sb.j.result.level, sb.j.result.seed, 0.2, 6 * 30);
  const fast = await call(B, '/act', { type: 'duel_finish', runId: sb.j.result.runId, log: pb.log });
  check(fast.j.error === 'too_fast', `B manda antes de tiempo → ${fast.j.error}`);
  // ...y luego jugadas inventadas en el mismo intento.
  await sleep(pb.steps * 1000 / 30 + 300);
  const fake = pb.log.map((a) => (a[1] === 0 ? [a[0], 0, 0, 0, 0, 1] : a));
  const fk = await call(B, '/act', { type: 'duel_finish', runId: sb.j.result.runId, log: fake });
  check(fk.status === 422, `B con jugadas inventadas → ${fk.j.error}`);
  const okb = await call(B, '/act', { type: 'duel_finish', runId: sb.j.result.runId, log: pb.log });
  check(okb.status === 200 && okb.j.result.damage === pb.rep.damage, `B honesto: daño ${okb.j.result?.damage}`);
  const info = okb.j.result.info;
  console.log('ranking:', info.entries.map((e: any) => `${e.name} ${e.damage}`).join(' · '), '· jugadores', info.players, '· puesto de B', info.rank);
  const mine = await call(A, '/act', { type: 'duel_mine' });
  check(mine.j.result.duels.some((d: any) => d.code === code), 'aparece en "Tus retos" de A');
})();
