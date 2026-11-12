// Prueba de punta a punta contra el servidor local (wrangler dev): juega peleas con la semilla que da
// el servidor, manda las jugadas y comprueba que el servidor calcula lo mismo. También prueba trampas.
// Uso: API=http://localhost:8787 TOKEN=... node server-test.cjs
import { Game } from '../src/game';
import { GameState } from '../src/state';
import { seeded } from '../src/rng';

const API = process.env.API ?? 'http://localhost:8787';
const TOKEN = process.env.TOKEN!;
async function call(path: string, body?: unknown) {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + TOKEN }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: (await r.json()) as any };
}

function play(s: GameState, level: number, seed: number, cheatFast = false) {
  const g = new Game(JSON.parse(JSON.stringify(s)));
  g.rand = seeded(seed);
  let rep: any = null;
  g.on((e) => e.type === 'end' && (rep = e.report));
  g.start(level);
  let wait = 0.4;
  while (g.fighting) {
    g.advance(1 / 60);
    wait -= 1 / 60;
    if (wait <= 0) {
      wait = cheatFast ? 0.11 : 0.35;
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

(async () => {
  let { j } = await call('/state');
  let s: GameState = j.state;
  console.log('inicio: nivel', s.unlocked, 'oro', s.gold, 'energía', s.energy);
  // 1) pelea honesta (esperamos el tiempo real que dura)
  let st = await call('/act', { type: 'run_start', level: 1 });
  const { runId, seed } = st.j.result;
  const p = play(s, 1, seed);
  console.log('pelea local:', p.rep.win ? 'ganada' : 'perdida', 'oro', p.rep.gold, 'duración', (p.steps / 30).toFixed(1), 's');
  await sleep(p.steps * (1000 / 30));
  let fin = await call('/act', { type: 'run_finish', runId, log: p.log });
  console.log('servidor:', fin.status, fin.j.error ?? `ganada=${fin.j.result.report.win} oro=${fin.j.result.report.gold} · igual: ${JSON.stringify(fin.j.result.report) === JSON.stringify(p.rep)}`, '· nivel ahora', fin.j.state?.unlocked);
  // 2) mandar la misma pelea dos veces
  fin = await call('/act', { type: 'run_finish', runId, log: p.log });
  console.log('repetir la misma pelea:', fin.status, fin.j.error);
  // 3) terminar más rápido que en tiempo real
  s = (await call('/state')).j.state;
  st = await call('/act', { type: 'run_start', level: 2 });
  const q = play(s, 2, st.j.result.seed);
  fin = await call('/act', { type: 'run_finish', runId: st.j.result.runId, log: q.log });
  console.log('terminar sin esperar:', fin.status, fin.j.error);
  // 4) jugadas inventadas
  st = await call('/act', { type: 'run_start', level: 2 });
  fin = await call('/act', { type: 'run_finish', runId: st.j.result.runId, log: [[5, 0, 0, 0, 4, 5], [6, 0, 1, 1, 2, 2]] });
  console.log('jugadas inventadas:', fin.status, fin.j.error);
  // 5) cofre y compras
  const c = await call('/act', { type: 'chest', id: 'armas', free: true });
  console.log('cofre gratis:', c.status, JSON.stringify(c.j.result ?? c.j.error));
  const c2 = await call('/act', { type: 'chest', id: 'armas', free: true });
  console.log('segundo cofre gratis seguido:', c2.status, c2.j.error);
  const b = await call('/act', { type: 'buy', id: 'fuerza' });
  console.log('comprar fuerza:', b.status, b.j.error ?? 'fuerza ' + b.j.state.upgrades.fuerza);
})();
