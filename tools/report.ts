// Tabla de puntaje de todas las variantes, para ver de un vistazo si alguna se pasa (power creep).
// Uso: npx esbuild tools/report.ts --bundle --platform=node --outfile=/tmp/report.cjs && node /tmp/report.cjs
import { ARMS, LEVEL_STAT } from '../src/arsenal';
import { POWER_WEIGHTS, armScore } from '../src/power';

const LV = [1, 5, 10, 20, 40, 60, 100];
console.log('Puntos de poder (1 punto = +1% de daño)\n');
console.log('Variante'.padEnd(18) + LV.map((l) => `Nv${l}`.padStart(7)).join(''));
let fam = '';
for (const d of ARMS) {
  if (d.fam !== fam) {
    fam = d.fam;
    const st = LEVEL_STAT[d.fam];
    console.log(`\n${d.fam.toUpperCase()} · cada nivel +${st.per * 100}% de ${st.label} = ${(st.per * POWER_WEIGHTS[st.key] * 100).toFixed(1)} puntos`);
  }
  console.log(`${d.name} (${d.rarity})`.padEnd(18).slice(0, 18) + LV.map((l) => armScore(d, l).toFixed(0).padStart(7)).join(''));
}
