// Comprueba en el juego real cuánto vale cada cosa con el equipo completo puesto, que es como juega la gente:
// el ataque y la defensa se multiplican, así que lo justo es medir cada pieza junto a las otras.
// Base: las 4 básicas a nivel L. Luego: subir una familia 10 niveles, o cambiar una básica por otra variante.
// Uso: LOADOUT=20 node verify.cjs [partidas]
import { LOADOUT, TRIALS, power } from './sim';
import { ARMS, ArmFam, STARTER_ARMS } from '../src/arsenal';
import { GameState } from '../src/state';

const L = LOADOUT;
const loadout = (change?: (s: GameState) => void) => (s: GameState) => {
  for (const a of ARMS) if (s.arsenal[a.id]) s.arsenal[a.id].lvl = 0;
  for (const f of Object.keys(STARTER_ARMS) as ArmFam[]) {
    s.arms[f] = STARTER_ARMS[f];
    s.arsenal[STARTER_ARMS[f]].lvl = L;
  }
  change?.(s);
};
const base = power({}, undefined, loadout());
// Vara: subir la espada 10 niveles (daño puro). Todo se expresa como "cuántas espadas +10" vale.
const d10 = power({}, undefined, loadout((s) => (s.arsenal[STARTER_ARMS.espada].lvl = L + 10))) - base;
const show = (name: string, lv: number) => console.log(`${name.padEnd(30)} ${lv >= base ? '+' : ''}${(lv - base).toFixed(2)} niveles = ${((lv - base) / d10).toFixed(2)} × espada+10`);
console.log(`4 básicas a nivel ${L}: llegas al nivel ${base.toFixed(2)} · espada +10 = ${d10.toFixed(2)} niveles (${TRIALS} partidas)\n`);
console.log('Subir una familia 10 niveles:');
for (const f of Object.keys(STARTER_ARMS) as ArmFam[]) show(`  ${f} +10`, power({}, undefined, loadout((s) => (s.arsenal[STARTER_ARMS[f]].lvl = L + 10))));
console.log('\nCambiar la básica por otra variante del mismo nivel:');
for (const d of ARMS.filter((a) => a.id !== '_test' && a.rarity !== 'común'))
  show(`  ${d.name}`, power({}, undefined, loadout((s) => { s.arsenal[d.id].lvl = L; s.arms[d.fam] = d.id; })));
