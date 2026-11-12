// Comprueba que rejugar una pelea da exactamente el mismo resultado que jugarla (determinismo).
// Uso: npx esbuild tools/replay-test.ts --bundle --platform=node --outfile=/tmp/rt.cjs && node /tmp/rt.cjs
import { Game } from '../src/game';
import { newState } from '../src/state';
import { seeded } from '../src/rng';
import { replayRun } from '../src/replay';

let fails = 0;
for (let i = 0; i < 200; i++) {
  const s = newState();
  s.unlocked = 1 + (i % 15);
  s.upgrades.fuerza = i % 12;
  s.upgrades.vida = i % 10;
  const snap = JSON.parse(JSON.stringify(s));
  const level = s.unlocked;
  const seed = 12345 + i * 77;
  const g = new Game(s);
  g.rand = seeded(seed);
  let rep: any = null;
  g.on((e) => e.type === 'end' && (rep = e.report));
  g.start(level);
  const r = seeded(i);
  let wait = 0.5;
  while (g.fighting) {
    const dt = 0.008 + r() * 0.03; // fotogramas irregulares, como en un celu
    g.advance(dt);
    wait -= dt;
    if (wait <= 0 && g.fighting) {
      wait = 0.2 + r() * 1.5;
      const grid = g.s.run!.grid;
      const seen = new Map<string, { col: number; row: number }>();
      let moved = false;
      outer: for (let c = 0; c < grid.length; c++)
        for (let rr = 0; rr < grid[c].length; rr++) {
          const p = grid[c][rr];
          if (!p) continue;
          const k = p.fam + p.lvl;
          const o = seen.get(k);
          if (o) { g.merge(o, { col: c, row: rr }); moved = true; break outer; }
          seen.set(k, { col: c, row: rr });
        }
      if (!moved && r() < 0.3) g.discardAt({ col: 0, row: 0 });
    }
  }
  const out = replayRun(snap, level, seed, g.log);
  const same = out.ok && JSON.stringify(out.report) === JSON.stringify(rep) && out.state.gold === g.s.gold;
  if (!same) { fails++; if (fails < 4) console.log('DIFERENTE', i, out.ok ? out.report : out, rep); }
}
console.log(fails ? `${fails} peleas no coinciden` : '200 de 200 peleas rejugadas dan lo mismo');
