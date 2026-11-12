// Tabla de poder de todas las variantes, para ver de un vistazo si alguna se pasa (power creep).
// "Solo" = la variante sola. "En equipo" = cuánto mejora tu poder cambiar la básica del mismo nivel por esta,
// con las otras 3 básicas puestas al mismo nivel (así juega la gente).
// Uso: npx esbuild tools/report.ts --bundle --platform=node --outfile=/tmp/report.cjs && node /tmp/report.cjs
import { ARMS, ArmFam, NO_MODS, STARTER_ARMS, armById, armMods, levelGainText } from '../src/arsenal';
import { armScore, swapGain } from '../src/power';

const LV = [1, 10, 20, 40, 60, 100];
const rest = (fam: ArmFam, lvl: number) => {
  const m = { ...NO_MODS };
  for (const f of Object.keys(STARTER_ARMS) as ArmFam[]) if (f !== fam) armMods(armById(STARTER_ARMS[f])!, lvl, m);
  return m;
};
console.log('Poder: +X% de poder total. Solo / en equipo (vs la básica del mismo nivel)\n');
console.log('Variante'.padEnd(18) + LV.map((l) => `Nv${l}`.padStart(13)).join(''));
let fam = '';
for (const d of ARMS) {
  if (d.fam !== fam) {
    fam = d.fam;
    const r = rest(d.fam, 20);
    const st = armById(STARTER_ARMS[d.fam])!;
    const up10 = swapGain(r, armMods(st, 20, { ...NO_MODS }), armMods(st, 30, { ...NO_MODS }));
    console.log(`\n${d.fam.toUpperCase()} · cada nivel ${levelGainText(d.fam)} · subir la básica de 20 a 30 = +${up10.toFixed(1)}% en equipo`);
  }
  const st = armById(STARTER_ARMS[d.fam])!;
  console.log(
    `${d.name} (${d.rarity})`.padEnd(18).slice(0, 18) +
      LV.map((l) => {
        const team = d.id === st.id ? 0 : swapGain(rest(d.fam, l), armMods(st, l, { ...NO_MODS }), armMods(d, l, { ...NO_MODS }));
        return `${armScore(d, l).toFixed(0)}/${team >= 0 ? '+' : ''}${team.toFixed(0)}`.padStart(13);
      }).join(''),
  );
}
