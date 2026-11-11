// Puntaje de poder: mide cuánto vale cada efecto jugando niveles reales con un jugador simulado.
// Poder = el nivel (con decimales) donde ganas la mitad de las veces. Así se puede comparar cualquier
// efecto, aunque no sea daño: escudo inicial, curación, más tiempo de combo, más espadas en el tablero…
// Uso: npx esbuild tools/valuate.ts --bundle --platform=node --outfile=/tmp/valuate.cjs && node /tmp/valuate.cjs [partidas]
import { Game } from '../src/game';
import { newState, maxHp } from '../src/state';
import { ARMS, ArmDef, Mods } from '../src/arsenal';
import { FAMILY_INFO } from '../src/board';

const TRIALS = Number(process.argv[2] ?? 200);

function pick(game: Game, sloppy: number, rand: () => number): [any, any] | null {
  const g = game.s.run!.grid;
  const hpr = game.s.run!.heroHp / maxHp(game.s);
  const groups: Record<string, any[]> = {};
  for (let c = 0; c < g.length; c++) for (let r = 0; r < g[c].length; r++) { const p = g[c][r]; if (p) (groups[p.fam + p.lvl] ??= []).push({ col: c, row: r, p }); }
  const pairs: [any, any, number][] = [];
  for (const k in groups) {
    const L = groups[k];
    if (L.length < 2) continue;
    let w = Math.pow(2, L[0].p.lvl);
    if (L[0].p.fam === 'espada') w *= 1.4;
    if (L[0].p.fam === 'pocion' && hpr < 0.5) w *= 2;
    pairs.push([L[0], L[1], w]);
  }
  if (!pairs.length) return null;
  if (rand() < sloppy) { const x = pairs[Math.floor(rand() * pairs.length)]; return [x[0], x[1]]; }
  pairs.sort((a, b) => b[2] - a[2]);
  return [pairs[0][0], pairs[0][1]];
}

/** Semilla fija por partida: cada efecto se prueba con los mismos tableros, así la comparación es justa. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Una variante de prueba equipada en el lugar de la skin, que da exactamente los efectos a medir.
const TEST: ArmDef = { id: '_test', fam: 'skin', name: 'test', rarity: 'común', shape: 0, skills: [] };
ARMS.push(TEST);

function winRate(level: number): number {
  let wins = 0;
  for (let i = 0; i < TRIALS; i++) {
    const s = newState();
    s.upgrades.fuerza = 12;
    s.upgrades.vida = 12;
    s.arsenal._test = { lvl: 1, shards: 0 } as any;
    s.arms.skin = '_test';
    s.unlocked = level;
    s.energy = 99;
    const rand = rng(1000 + i * 7 + level * 100003);
    const game = new Game(s);
    game.rand = rand;
    let res: boolean | null = null;
    (game as any).listeners = [(e: any) => { if (e.type === 'end') res = e.report.win; }];
    game.start(level);
    let t = 0, wait = 0.6;
    while (res === null && t < 600) {
      game.tick(1 / 30);
      t += 1 / 30;
      wait -= 1 / 30;
      if (wait <= 0) {
        // Un jugador real no es un reloj: casi siempre rápido, a veces se toma su tiempo.
        wait = 0.45 + rand() * rand() * 2.5;
        const pr = pick(game, 0.25, rand);
        if (pr) game.merge(pr[0], pr[1]);
      }
    }
    if (res) wins++;
  }
  return wins / TRIALS;
}

/** Nivel (con decimales) donde se gana la mitad de las veces, con estos efectos extra. */
export function power(mods: Partial<Mods>, setup?: () => () => void): number {
  TEST.skills = [{ at: 1, text: '', mod: mods }];
  const undo = setup?.();
  let lo = 1, hi = 120;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (winRate(mid) >= 0.5) lo = mid; else hi = mid;
  }
  const a = winRate(lo), b = winRate(hi);
  undo?.();
  return lo + Math.min(1, Math.max(0, (a - 0.5) / Math.max(0.01, a - b)));
}

const base = power({});
const dmg10 = power({ dmg: 0.1 }) - base; // niveles que vale +10% de daño: la vara para todo lo demás
console.log(`sin nada extra: nivel ${base.toFixed(2)} · +10% de daño vale ${dmg10.toFixed(2)} niveles (${TRIALS} partidas por nivel)\n`);
const tests: [string, Partial<Mods>][] = [
  ['hp', { hp: 0.1 }],
  ['shield', { shield: 0.1 }],
  ['heal', { heal: 0.1 }],
  ['boostMult', { boostMult: 0.1 }],
  ['crit', { crit: 0.05 }],
  ['critMult', { critMult: 0.5 }],
  ['reduce', { reduce: 0.05 }],
  ['startShield', { startShield: 0.1 }],
  ['boostSec', { boostSec: 0.5 }],
  ['combo', { combo: 0.5 }],
];
const w: Record<string, number> = { dmg: 1 };
const line = (name: string, gain: number) => console.log(`${name.padEnd(28)} ${gain >= 0 ? '+' : ''}${gain.toFixed(2)} niveles = ${((gain / dmg10) * 10).toFixed(1)}% de daño`);
for (const [k, m] of tests) {
  const gain = power(m) - base;
  const amount = Object.values(m)[0]!;
  w[k] = Number(((gain / dmg10) * 0.1 / amount).toFixed(2)); // cuánto daño equivale cada 1,0 del stat
  line(`${k} ${JSON.stringify(m)}`, gain);
}
// Algo difícil de pasar a daño: que aparezcan más espadas en el tablero.
const ws = FAMILY_INFO.espada.weight;
line('espadas aparecen 20% más', power({}, () => { FAMILY_INFO.espada.weight = ws * 1.2; return () => (FAMILY_INFO.espada.weight = ws); }) - base);
console.log('\nPOWER_WEIGHTS = ' + JSON.stringify(w));
