// Cuánto vale cada efecto: lo mide jugando niveles reales y lo pasa a "% de daño equivalente".
// Así se puede comparar cualquier efecto, aunque no sea daño: escudo inicial, curación, combo, más espadas…
// Uso: npx esbuild tools/valuate.ts --bundle --platform=node --outfile=/tmp/valuate.cjs && node /tmp/valuate.cjs [partidas]
import { LOADOUT, TRIALS, power } from './sim';
import { Mods } from '../src/arsenal';
import { FAMILY_INFO } from '../src/board';

const base = power({});
const dmg10 = power({ dmg: 0.1 }) - base; // niveles que vale +10% de daño: la vara para todo lo demás
console.log(`sin nada extra: nivel ${base.toFixed(2)} · +10% de daño vale ${dmg10.toFixed(2)} niveles (${TRIALS} partidas por nivel, equipo básico nivel ${LOADOUT})\n`);
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
