import { levelMonster } from './monsters';
// Arte vectorial del prototipo. Todo es SVG en línea: liviano y nítido en cualquier pantalla.

export interface Tier {
  name: string;
  blade: string;
  edge: string;
  hilt: string;
  glow: string;
}

export const TIERS: Tier[] = [
  { name: 'Hierro', blade: '#9aa3ad', edge: '#e4e8ec', hilt: '#6b4a2b', glow: 'none' },
  { name: 'Bronce', blade: '#c07a3a', edge: '#f2c08a', hilt: '#5a3a1e', glow: 'none' },
  { name: 'Plata', blade: '#c9d3dd', edge: '#ffffff', hilt: '#3d4a5c', glow: 'none' },
  { name: 'Oro', blade: '#e8b730', edge: '#fff1a8', hilt: '#7a2e1e', glow: '#ffd75a' },
  { name: 'Esmeralda', blade: '#2fbf71', edge: '#b8ffd6', hilt: '#1d3b2c', glow: '#46f29a' },
  { name: 'Zafiro', blade: '#3b7bff', edge: '#bcd3ff', hilt: '#1b2550', glow: '#5c9bff' },
  { name: 'Rubí', blade: '#e5304d', edge: '#ffc0ca', hilt: '#3b1018', glow: '#ff4d6a' },
  { name: 'Amatista', blade: '#9b4dff', edge: '#e2c9ff', hilt: '#2a1450', glow: '#b77bff' },
  { name: 'Obsidiana', blade: '#2b2b3a', edge: '#ff7a2f', hilt: '#120f18', glow: '#ff7a2f' },
  { name: 'Celestial', blade: '#e9fbff', edge: '#7ff6ff', hilt: '#4b3d8f', glow: '#a8fbff' },
];

export function tierFor(level: number): Tier {
  return TIERS[(level - 1) % TIERS.length];
}

/** Estrellas extra cuando el nivel supera los 10 tonos de arma. */
export function tierStars(level: number): number {
  return Math.floor((level - 1) / TIERS.length);
}

export function weaponName(level: number): string {
  const t = tierFor(level);
  const stars = tierStars(level);
  return `Espada de ${t.name}${stars ? ' ' + '★'.repeat(stars) : ''}`;
}

export function weaponSvg(level: number, size = 56): string {
  const t = tierFor(level);
  const gid = `g${level}`;
  const glow =
    t.glow === 'none'
      ? ''
      : `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="${t.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="30" r="30" fill="url(#${gid})"/>`;
  // Hoja más ancha y guarda más elaborada en niveles altos.
  const tierIdx = (level - 1) % TIERS.length;
  const w = 5 + Math.min(tierIdx, 6) * 0.5;
  const guard =
    tierIdx >= 5
      ? `<path d="M18 44 Q32 36 46 44 L44 48 Q32 42 20 48Z" fill="${t.hilt}" stroke="${t.edge}" stroke-width="1"/>`
      : `<rect x="20" y="43" width="24" height="5" rx="2" fill="${t.hilt}"/>`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${glow}
    <g transform="rotate(-35 32 32)">
      <path d="M32 4 L${32 + w} 14 L${32 + w} 43 L${32 - w} 43 L${32 - w} 14 Z" fill="${t.blade}" stroke="#1a1a24" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M32 6 L${32 + w * 0.45} 14 L${32 + w * 0.45} 42 L32 42Z" fill="${t.edge}" opacity=".85"/>
      ${guard}
      <rect x="29.5" y="48" width="5" height="9" rx="1.5" fill="${t.hilt}" stroke="#1a1a24" stroke-width="1"/>
      <circle cx="32" cy="59" r="3.2" fill="${t.edge}" stroke="#1a1a24" stroke-width="1"/>
    </g></svg>`;
}

export interface Skin {
  id: string;
  name: string;
  rarity: 'común' | 'rara' | 'épica' | 'legendaria';
  price: number; // en gemas, 0 = incluida
  armor: string;
  armorDark: string;
  trim: string;
  cape: string;
  visor: string;
  aura: string | null;
  helm: 'knight' | 'kabuto' | 'cyber' | 'fenix';
  helmColor?: string;
}

export const SKINS: Skin[] = [
  {
    id: 'caballero',
    name: 'Caballero',
    rarity: 'común',
    price: 0,
    armor: '#8e99a8',
    armorDark: '#5d6776',
    trim: '#d9b45a',
    cape: '#3557a8',
    visor: '#1b1f2a',
    aura: null,
    helm: 'knight',
  },
  {
    id: 'samurai',
    name: 'Samurái Carmesí',
    rarity: 'rara',
    price: 150,
    armor: '#b3263a',
    armorDark: '#6e1322',
    trim: '#f0c24b',
    cape: '#24151c',
    visor: '#0e0a0c',
    aura: '#ff5a6e',
    helm: 'kabuto',
  },
  {
    id: 'cyber',
    name: 'Ronin Neón',
    rarity: 'épica',
    price: 400,
    armor: '#1e2236',
    armorDark: '#11131f',
    trim: '#29f0ff',
    cape: '#ff2fb4',
    visor: '#29f0ff',
    aura: '#29f0ff',
    helm: 'cyber',
  },
  {
    id: 'fenix',
    name: 'Caballero Fénix',
    rarity: 'legendaria',
    price: 0,
    armor: '#efb02c',
    armorDark: '#a3301b',
    trim: '#fff1a8',
    cape: '#ff5a1f',
    visor: '#2a0805',
    aura: '#ff8a1f',
    helm: 'fenix',
  },
];

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function helmSvg(s: Skin): string {
  if (s.helm === 'kabuto') {
    return `<g transform="translate(50 30) scale(1.22) translate(-50 -30)"><path d="M36 30 Q50 12 64 30 L64 40 L36 40Z" fill="${s.helmColor ?? s.armor}" stroke="#14080c" stroke-width="2"/>
      <path d="M38 28 Q30 10 24 8 Q34 18 40 26Z M62 28 Q70 10 76 8 Q66 18 60 26Z" fill="${s.trim}" stroke="#14080c" stroke-width="1.5"/>
      <rect x="40" y="33" width="20" height="6" rx="2" fill="${s.visor}"/>
      <circle cx="50" cy="24" r="3" fill="${s.trim}"/></g>`;
  }
  if (s.helm === 'fenix') {
    // Yelmo del fénix: dorado, corona de plumas de fuego que se mueven y visera con ojos de brasa.
    return `<g class="fx-crest">
      <path class="fx-fl f1" d="M50 -6 Q57 4 54 14 L46 14 Q43 4 50 -6Z" fill="#ff5a1f"/>
      <path class="fx-fl f2" d="M40 0 Q46 6 46 15 L39 15 Q36 7 40 0Z" fill="#ff8a1f"/>
      <path class="fx-fl f3" d="M60 0 Q64 7 61 15 L54 15 Q54 6 60 0Z" fill="#ff8a1f"/>
      <path class="fx-fl f2" d="M50 2 Q54 8 52 14 L48 14 Q46 8 50 2Z" fill="#ffd34d"/></g>
    <path d="M33 42 L33 27 Q33 11 50 11 Q67 11 67 27 L67 42 Q50 47 33 42Z" fill="${s.armor}" stroke="#3a0d05" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M33 22 Q41 18 50 22 Q59 18 67 22 L67 26 Q59 22 50 26 Q41 22 33 26Z" fill="${s.armorDark}" stroke="#3a0d05" stroke-width="1.2"/>
    <path d="M37 26 Q38 15 49 14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M36 28 L64 28 L62 35 Q50 38 38 35Z" fill="${s.visor}" stroke="#3a0d05" stroke-width="1.6"/>
    <path d="M40 31.5 L46 31.5 M54 31.5 L60 31.5" stroke="#ffb02e" stroke-width="2.4" stroke-linecap="round" class="fx-eyes"/>
    <path d="M50 37 L53 41 L50 45 L47 41Z" fill="#ff3b1f" stroke="#3a0d05" stroke-width="1"/>
    <path d="M33 30 Q26 26 22 16 Q30 22 34 26Z M67 30 Q74 26 78 16 Q70 22 66 26Z" fill="${s.trim}" stroke="#3a0d05" stroke-width="1.2"/>`;
  }
  if (s.helm === 'cyber') {
    return `<g transform="translate(50 30) scale(1.22) translate(-50 -30)"><path d="M35 38 L37 24 Q50 14 63 24 L65 38Z" fill="${s.helmColor ?? s.armor}" stroke="#05060c" stroke-width="2"/>
      <rect x="38" y="29" width="24" height="5" rx="2.5" fill="${s.visor}" class="neon"/>
      <path d="M60 22 L72 14" stroke="${s.trim}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="72" cy="14" r="2.2" fill="${s.cape}"/></g>`;
  }
  // Yelmo de caballero: casco grande y redondeado, cresta, visera con ojos que brillan y penacho.
  return `<path d="M50 4 Q62 -2 74 6 Q66 6 60 10 Q70 10 76 18 Q64 14 56 16Z" fill="${s.cape}" stroke="#141826" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M33 42 L33 27 Q33 11 50 11 Q67 11 67 27 L67 42 Q50 47 33 42Z" fill="${s.helmColor ?? s.armor}" stroke="#141826" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M37 26 Q38 15 49 14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".45"/>
    <path d="M60 15 Q66 20 66 30 L66 41 Q62 43 58 43Z" fill="${s.armorDark}" opacity=".45"/>
    <path d="M48.5 11.5 L51.5 11.5 L51.5 44 L48.5 44Z" fill="${s.trim}" stroke="#141826" stroke-width="1"/>
    <path d="M36 27 L64 27 L64 34 Q50 37 36 34Z" fill="${s.visor}" stroke="#141826" stroke-width="1.6"/>
    <path d="M40 30.5 L46 30.5 M54 30.5 L60 30.5" stroke="#9fe8ff" stroke-width="2.2" stroke-linecap="round" class="hero-eyes"/>
    <g fill="#141826" opacity=".55"><circle cx="42" cy="39" r="1"/><circle cx="46" cy="40" r="1"/><circle cx="54" cy="40" r="1"/><circle cx="58" cy="39" r="1"/></g>`;
}

export interface HeroFight {
  shield?: number; // nivel del mejor escudo fusionado
  glow?: number; // nivel de la última poción: brillo cada vez más fuerte
  swordShape?: number; // diseño de la espada equipada en el Arsenal
  shieldShape?: number;
  bare?: boolean; // sin espada: para mostrar solo la skin (la armadura)
}

/** Silueta de fuego detrás del caballero (forma 20 y 40): llamas que suben desde el piso alrededor del cuerpo. */
function flameAura(c1: string, c2: string, c3: string): string {
  const outer = 'M14 104 Q8 84 14 66 Q10 74 6 70 Q10 56 18 48 Q14 50 12 44 Q20 40 26 42 Q22 30 30 18 Q30 28 34 30 Q34 14 44 2 Q44 14 48 16 Q52 4 62 -4 Q60 10 64 16 Q68 8 76 6 Q72 18 74 26 Q80 22 86 24 Q80 34 82 42 Q88 42 92 46 Q84 54 86 64 Q92 62 96 66 Q88 80 92 104Z';
  return `<g class="kn-aura" transform="translate(52 0) scale(.82 1) translate(-52 0)"><path class="fx-fl f1" d="${outer}" fill="${c1}" opacity=".42"/>
    <g transform="translate(52 104) scale(.8) translate(-52 -104)"><path class="fx-fl f2" d="${outer}" fill="${c2}" opacity=".45"/></g>
    <g transform="translate(52 104) scale(.6 .55) translate(-52 -104)"><path class="fx-fl f3" d="${outer}" fill="${c3}" opacity=".4"/></g></g>`;
}

/**
 * Caballero Fénix: un personaje propio. Yelmo dorado en punta con alas esculpidas a los costados, visera en T
 * con brillo de brasa y penacho de fuego; hombreras con púas de llama, peto con sol, capa con borde de fuego y alas.
 */
function fenixHero(skin: Skin, weaponLevel: number, fight: HeroFight, back: string): string {
  const o = '#3a0d05';
  const gold = skin.armor;
  const red = skin.armorDark;
  const e = evoOf('skin');
  const c = EVO_COLORS[e];
  const wingScale = [1, 1.1, 1.25, 1.45, 1.6][e];
  // Proporción chibi (cabeza grande, piernas cortas), girado a tres cuartos mirando a la derecha y en guardia:
  // el cuerpo respira, la cabeza acompaña, la espada se balancea y el escudo sube y baja mientras espera pelear.
  const out = `<svg viewBox="0 0 120 110" class="hero-svg fenix-hero evo-${e}" aria-hidden="true">
    ${back}
    ${e >= 4 ? `<g class="evo-rays big">${rays(52, 46, 70, 18, '#bff0ff')}</g>` : ''}
    ${e >= 1 ? `<defs><radialGradient id="evoAura${e}"><stop offset="0" stop-color="${c}" stop-opacity="${0.35 + e * 0.1}"/><stop offset=".6" stop-color="${c}" stop-opacity="${0.12 + e * 0.05}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><ellipse class="evo-aura" cx="52" cy="60" rx="${36 + e * 4}" ry="${44 + e * 4}" fill="url(#evoAura${e})"/>` : ''}
    ${e >= 3 ? flameAura('#ff5a1f', '#ff8a1f', '#ffd34d') : ''}
    ${e >= 4 ? `<g class="kn-halo"><circle cx="52" cy="26" r="30" fill="none" stroke="#fff6c8" stroke-width="1.6" opacity=".85"/><circle cx="52" cy="26" r="34" fill="none" stroke="#bff0ff" stroke-width=".8" stroke-dasharray="2 4"/></g>` : ''}
    <ellipse cx="51" cy="104" rx="31" ry="5" fill="#000" opacity=".3"/>
    <g class="fx-legs">
      <path d="M43 85 L49.5 85 L46.5 97 L39.5 97Z" fill="#7a2414" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M36 96.5 L47 96.5 L47.5 103 L32.5 103 Q32.5 98.5 36 96.5Z" fill="#c98a1e" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M52.5 85 L59 85 L63 97 L56 97Z" fill="${red}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M55.5 90.5 L59.5 88 L63 91.5 L59.5 94.5Z" fill="${gold}" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M54.5 96.5 L64 96.5 Q70 98.5 72 103 L54.5 103Z" fill="${gold}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M32.5 103 L47.5 103 M54.5 103 L72 103" stroke="${red}" stroke-width="2"/>
    </g>
    <g class="fx-body"><g transform="translate(0 8)">
      ${e >= 2 ? `<path class="fx-fl f1" d="M42 76 Q26 88 8 102 Q20 99 24 103 Q22 96 30 94 Q30 100 36 100 Q36 92 46 84Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/><path class="fx-fl f2" d="M42 80 Q30 90 18 99 Q28 96 31 98 Q32 92 44 86Z" fill="#ffd34d"/>` : ''}
      ${e >= 4 ? `<g class="fx-wingwrap" opacity=".75"><g transform="translate(46 50) rotate(20) scale(1.2) translate(-46 -52)">${fenixWings()}</g></g>` : ''}<g class="fx-wingwrap"><g transform="translate(46 52) scale(${wingScale}) translate(-46 -52)">${fenixWings()}</g></g>
      <g class="fx-capewrap"><path d="M40 44 Q24 58 20 90 Q26 86 31 90 Q36 84 42 89 Q47 84 53 88 L56 46Z" fill="${skin.cape}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
        <path class="fx-fl f2" d="M22 88 Q24 81 28 85 Q30 77 35 83 Q38 76 42 82 Q46 77 50 83 L53 87 Q47 83 42 88 Q36 83 31 89 Q26 85 22 88Z" fill="#ffd34d" opacity=".85"/>
        <path d="M40 48 Q28 62 26 86 Q30 84 33 87 Q36 68 46 50Z" fill="#000" opacity=".25"/></g>
      <path d="M38 73 L50 73 L49 81 L39 80Z M52 73 L65 73 L63.5 80 L53 81Z" fill="${gold}" stroke="${o}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M47 74 L57 74 L57 83 L54.5 87 L52 83.5 L49.5 87 L47 83Z" fill="${red}" stroke="${o}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M52 76.5 Q54.5 79.5 52 82.5 Q49.5 79.5 52 76.5Z" fill="#ffd34d"/>
      <path d="M37 46 Q51 41 64 46 L62 73 Q51 77 39 73Z" fill="${red}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M43 49 Q52 45 60 49 L58.5 70 Q52 73 44.5 70Z" fill="${gold}" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M38.5 48 Q41 47 43 49 L44.5 70 Q42 71.5 39.5 72Z" fill="#000" opacity=".22"/>
      ${e >= 2 ? `<g class="fx-sun"><circle cx="52.5" cy="58" r="7" fill="${red}" stroke="${o}" stroke-width="1.2"/><g transform="translate(52.5 58.5) scale(.36) translate(-32 -32)"><path d="M32 19 Q35 23 34.2 27.5 Q40 21 47 21.5 Q42 28.5 36.5 31.5 Q39 37 32 46 Q25 37 27.5 31.5 Q22 28.5 17 21.5 Q24 21 29.8 27.5 Q29 23 32 19Z" fill="#ffd34d" stroke="${o}" stroke-width="2"/></g></g>` : `      <g class="fx-sun"><circle cx="52.5" cy="58" r="5" fill="#ff5a1f" stroke="${o}" stroke-width="1.2"/>
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M52.5 50.8 L53.7 53.2 L51.3 53.2Z" fill="#fff1a8" transform="rotate(${a} 52.5 58)"/>`).join('')}
        <circle cx="52.5" cy="58" r="2.3" fill="#fff1a8"/></g>`}
      <path d="M45 49 Q48 46.5 52 46" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".5"/>
      ${e >= 2 ? '<path class="fx-vein" d="M44 52 L47 56 L45 61 L48 66 M60 52 L57.5 57 L59.5 62 L57 68 M40 60 L42.5 63 M62.5 62 L60.5 65" stroke="#ffd34d" stroke-width="1.4" fill="none" stroke-linecap="round"/>' : ''}
      <path d="M38.5 71 L62.5 71 L62.5 75 L38.5 75Z" fill="#5a1a0a" stroke="${o}" stroke-width="1.4"/>
      <rect x="49.5" y="70" width="6" height="6" rx="1.4" fill="${gold}" stroke="${o}" stroke-width="1.2"/>
      ${fight.bare ? bareArm('back', red, gold, o) : ''}
      <g transform="translate(36 42) scale(${[1, 1.35, 1.45, 1.6, 1.75][e]}) translate(-36 -42)"><path class="${e >= 1 ? 'fx-fl f1' : ''}" d="M30 46 Q24 38 26 30 Q30 37 34 39 Q32 32 36 27 Q37 35 41 38Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.2" stroke-linejoin="round"/></g>
      <path d="M28 51 Q29 40 40 39 Q46 41 46 48 Q37 46 31 55Z" fill="${gold}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M30.5 54 Q37 46 46 48" stroke="${red}" stroke-width="2.2" fill="none"/>
      ${e >= 2 ? `<path d="M29 52 Q24 56 23 62 Q27 58 30 58 Q27 62 27 67 Q31 61 34 60 Q33 64 34 68 Q36 60 38 55Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.2" stroke-linejoin="round"/>` : ''}
      <g class="fx-head"><g transform="translate(52 45) scale(1.17) translate(-52 -45)">
        ${e >= 3 ? runeRing(52, 26, 24, c) : ''}
        <g class="fx-crest">
          <path class="fx-fl f1" d="M52 -10 Q61 0 57 10 L47 10 Q43 0 52 -10Z" fill="#ff5a1f" stroke="${o}" stroke-width="1.1"/>
          <path class="fx-fl f2" d="M45 -3 Q50 3 49 10 L42 11 Q40 3 45 -3Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.1"/>
          <path class="fx-fl f3" d="M59 -3 Q64 3 62 11 L55 10 Q54 3 59 -3Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.1"/>
          <path class="fx-fl f2" d="M52 -3 Q55 3 53.5 9 L50.5 9 Q49 3 52 -3Z" fill="#fff1a8"/>
        </g>
        ${e >= 2 ? `<g class="fx-phead">${[
          ['M44 12 Q30 4 16 8 Q26 8 30 12 Q20 14 12 22 Q28 16 42 18Z', '#d42a0c'],
          ['M46 9 Q36 -4 20 -6 Q30 -2 33 3 Q24 2 16 6 Q32 6 44 14Z', '#ff6a1a'],
          ['M48 7 Q44 -8 32 -16 Q38 -6 38 0 Q32 -4 26 -4 Q38 2 46 11Z', '#ffd34d'],
        ].map(([d, f], i) => `<path class="fx-fl f${i + 1}" d="${d}" fill="${f}" stroke="${o}" stroke-width="1.1" stroke-linejoin="round"/>`).join('')}</g>` : ''}
        <path d="M65 24 Q72 20 76 10 Q71 14 68 15 Q71 9 70 4 Q66 11 63 15Z" fill="#c98a1e" stroke="${o}" stroke-width="1.4" stroke-linejoin="round"/>
        <path class="fx-hw" d="M36 25 Q25 20 19 6 Q26 12 30 13 Q25 6 26 -2 Q32 8 36 13 Q34 6 37 1 Q39 12 41 18Z" fill="${gold}" stroke="${o}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M33 13 Q30 8 26 9" stroke="${red}" stroke-width="1.3" fill="none"/>
        <path d="M33 28 Q34 12 52 7 Q67 11 68 27 L69 38 L62 46 L54 49 L43 46 L33 38Z" fill="${gold}" stroke="${o}" stroke-width="2.3" stroke-linejoin="round"/>
        <path d="M35 24 Q36 32 40 44 L43 46 L33 38 L33 28Z" fill="#000" opacity=".18"/>
        <path d="M54.6 7.4 L57.2 8.2 L57 28 L54.4 28Z" fill="${red}" stroke="${o}" stroke-width="1"/>
        <path d="M38 23 Q39 14 48 10.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>
        <path d="M41 28 L68 27.5 L67.5 33 L42 33Z" fill="${skin.visor}" stroke="${o}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M53.6 33 L58 33 L57.5 43.5 L54.2 43.5Z" fill="${skin.visor}" stroke="${o}" stroke-width="1.3"/>
        <path class="fx-eyes" d="M44.5 30.5 L50 30.5 M59.5 30.3 L66 30.2 M55.8 34.5 L55.8 42" stroke="#ffb02e" stroke-width="2.2" stroke-linecap="round"/>
        <g fill="${red}"><circle cx="46" cy="40" r="1.1"/><circle cx="50" cy="43" r="1.1"/><circle cx="61" cy="43" r="1.1"/><circle cx="65" cy="39.5" r="1.1"/></g>
        ${e >= 4 ? `<path d="M41 11 L42 1 L46.5 7 L52 -4 L57.5 7 L62 1 L63 11 Q52 7 41 11Z" fill="#ffd700" stroke="${o}" stroke-width="1.3" stroke-linejoin="round"/>${gem(52, 3, 1.8, '#2ad8ff')}${gem(42.5, 6, 1.2, '#2ad8ff')}${gem(61.5, 6, 1.2, '#2ad8ff')}` : ''}
        <path d="M56 13.5 L59 17.5 L56 22.5 L53 17.5Z" fill="#ff3b1f" stroke="${o}" stroke-width="1"/>
        ${e >= 2 ? `<path d="M66 26 Q76 25 81 32 Q82.5 36 79.5 38 Q78.5 34.5 75 34 Q71 34 67.5 35Z" fill="#ffb02e" stroke="${o}" stroke-width="1.5" stroke-linejoin="round"/><path d="M68 29.5 L78 31" stroke="${o}" stroke-width=".9" opacity=".6"/><path d="M41 27 Q50 23.5 68 26" stroke="${o}" stroke-width="1.6" fill="none"/>` : ''}
      </g></g>
      ${fight.shield ? '%%SHIELD%%' : ''}
      ${fight.bare ? bareArm('front', red, gold, o) : ''}
      <g transform="translate(68 42) scale(${[1, 1.35, 1.45, 1.6, 1.75][e]}) translate(-68 -42)"><path class="${e >= 1 ? 'fx-fl f2' : ''}" d="M62 43 Q64 34 72 32 Q70 38 72 41 Q75 36 80 35 Q76 41 74 46Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.2" stroke-linejoin="round"/></g>
      <path d="M56 47 Q58 38 67 39 Q74 41 73 51 Q66 46 58 50Z" fill="${gold}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M58 50 Q66 46 73 51" stroke="${red}" stroke-width="2.2" fill="none"/>
      ${e >= 2 ? `<path d="M72 50 Q77 54 78 60 Q74 56 71 56 Q74 60 74 65 Q70 59 67 58 Q68 62 67 66 Q65 58 63 53Z" fill="#ff8a1f" stroke="${o}" stroke-width="1.2" stroke-linejoin="round"/>` : ''}
      <path d="M60 43 Q63 40.5 68 41" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".5"/>
      <g class="hero-arm"${fight.bare ? ' display="none"' : ''}><g class="fx-armidle">
        <circle cx="64" cy="55" r="6" fill="${red}" stroke="${o}" stroke-width="2"/>
        %%BLADE%%
        <rect x="65.5" y="54.5" width="10" height="8.5" rx="3.5" fill="${gold}" stroke="${o}" stroke-width="2"/>
        <path d="M65.5 58.5 L75.5 58.5" stroke="${red}" stroke-width="1.4"/>
      </g></g>
    </g></g>
    ${e >= 2 ? star(14, 40, 3, '#fff', 1) + star(88, 30, 2.6, c, 2) + star(84, 80, 2.4, '#fff', 3) + star(18, 82, 2.2, c, 2) : ''}
    ${e >= 4 ? `<g class="evo-orbit big"><circle cx="52" cy="6" r="2.2" fill="#d8f6ff"/><circle cx="96" cy="58" r="1.8" fill="#7fe0ff"/><circle cx="52" cy="110" r="2.2" fill="#d8f6ff"/><circle cx="8" cy="58" r="1.8" fill="#7fe0ff"/></g>` : ''}
  </svg>`;
  return evoPaint(out, e)
    .replace('%%SHIELD%%', fight.shield ? `<g class="fx-shidle">${heroShield(fight.shield, fight.shieldShape ?? 0)}</g>` : '')
    .replace('%%BLADE%%', fight.bare ? '' : heroBlade(fight.swordShape ?? 0, weaponLevel));
}

/** Brazos sueltos a los costados, para mostrar la skin sola (sin espada ni escudo). */
function bareArm(side: 'back' | 'front', dark: string, light: string, o: string): string {
  return side === 'back'
    ? `<path d="M31 49 L37.5 49 L36.5 66 L30 66Z" fill="${dark}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/><rect x="28" y="63.5" width="9.5" height="8.5" rx="3.8" fill="${light}" stroke="${o}" stroke-width="2"/>`
    : `<path d="M62 49 L68.5 49 L70 66 L63.5 66Z" fill="${dark}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/><rect x="62.5" y="63.5" width="9.5" height="8.5" rx="3.8" fill="${light}" stroke="${o}" stroke-width="2"/>`;
}

/** La espada en la mano: más grande que antes, y la legendaria todavía más. El envoltorio permite crecerla en combate. */
function heroBlade(shape: number, weaponLevel: number): string {
  const sc = shape === 3 ? 1.02 : 0.88;
  return `<g class="hero-blade"><g transform="translate(70.5 58.5) rotate(68) scale(${sc}) translate(-43.25 -45.4)">${famIcon('espada', shape, Math.max(1, Math.min(10, weaponLevel)), '#c9d3dd', false)}</g></g>`;
}

/** Alas de fuego del Caballero Fénix: aletean despacio y sueltan brasas. */
function fenixWings(): string {
  const wing = (k: string) => `<g class="fx-wing ${k}">
      <path d="M46 48 Q28 26 4 22 Q14 30 12 36 Q4 36 0 42 Q12 44 14 50 Q6 54 4 62 Q20 58 30 62 Q36 56 46 58Z" fill="#ff5a1f" stroke="#7a1a05" stroke-width="1.6" stroke-linejoin="round" opacity=".92"/>
      <path class="fx-fl f1" d="M44 50 Q30 34 12 30 Q20 38 18 42 Q28 44 30 52 Q36 52 44 56Z" fill="#ffb02e"/>
      <path class="fx-fl f2" d="M42 52 Q34 44 24 42 Q30 48 30 54 Q36 54 42 56Z" fill="#fff1a8" opacity=".85"/></g>`;
  return `<g class="fx-wings">${wing('back')}${wing('front')}</g>
    <g class="fx-embers hero-embers"><circle class="fx-em e1" cx="20" cy="70" r="1.6" fill="#ffd34d"/><circle class="fx-em e2" cx="78" cy="60" r="1.3" fill="#ff8a1f"/><circle class="fx-em e3" cx="30" cy="40" r="1.2" fill="#fff1a8"/><circle class="fx-em e4" cx="70" cy="86" r="1.4" fill="#ffd34d"/></g>`;
}

/** Escudo en el brazo de atrás: el mismo dibujo que la pieza del tablero. */
function heroShield(lvl: number, shape: number): string {
  const sc = 0.62 + Math.min(lvl, 10) * 0.02;
  return `<g transform="translate(30 62) scale(${sc}) translate(-32 -32)" class="hero-shield">${famIcon('escudo', shape, lvl, '#5c9bff', false)}</g>`;
}

/** Héroe mirando a la derecha, con el arma en la mano. En combate muestra escudo y brillo. */
export function heroSvg(skin: Skin, weaponLevel: number, fight: HeroFight = {}): string {
  const aura = skin.aura
    ? `<ellipse cx="50" cy="62" rx="34" ry="40" fill="${skin.aura}" opacity=".18" class="aura"/>`
    : '';
  const g = fight.glow ?? 0;
  const glow = g
    ? `<ellipse cx="50" cy="62" rx="${30 + g * 2.5}" ry="${38 + g * 2.5}" fill="${pieceFrame(g)}" opacity="${Math.min(0.55, 0.12 + g * 0.045)}" class="aura potion-glow"/>`
    : '';
  if (skin.helm === 'fenix') return fenixHero(skin, weaponLevel, fight, glow + aura);
  const o = '#141826';
  return `<svg viewBox="0 0 120 110" class="hero-svg" aria-hidden="true">
    ${glow}${aura}
    <ellipse cx="50" cy="104" rx="28" ry="5" fill="#000" opacity=".3"/>
    <path d="M40 44 Q20 60 18 100 Q26 95 32 100 Q38 94 45 99 Q50 94 54 98 L56 46Z" fill="${skin.cape}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 48 Q26 64 25 94 Q30 92 33 95 Q36 70 46 50Z" fill="#000" opacity=".22"/>
    <path d="M41 78 L48 78 L47 96 L40 96Z" fill="${skin.armorDark}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M53 78 L60 78 L62 96 L55 96Z" fill="${skin.armorDark}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="44.5" cy="86" r="3.6" fill="${skin.armor}" stroke="${o}" stroke-width="1.6"/>
    <circle cx="57.5" cy="86" r="3.6" fill="${skin.armor}" stroke="${o}" stroke-width="1.6"/>
    <path d="M37 95 L49 95 L50 103 L35 103 Q35 98 37 95Z" fill="${skin.armorDark}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M53 95 L64 95 Q67 98 67 103 L53 103Z" fill="${skin.armorDark}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M37 95 L49 95 L49 97.5 L37 97.5Z M53 95 L64 95 L64.5 97.5 L53 97.5Z" fill="${skin.trim}"/>
    <path d="M35 47 Q50 40 65 47 L63 76 Q50 80 37 76Z" fill="${skin.armor}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M56 45 Q62 46 65 47 L63 76 Q59 77.5 55 78Z" fill="${skin.armorDark}" opacity=".5"/>
    <path d="M39 50 Q42 46 48 45" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".45"/>
    <path d="M50 52 L56 55 L55 63 L50 67 L45 63 L44 55Z" fill="${skin.trim}" stroke="${o}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M50 55 L53 56.5 L52.5 61 L50 63 Z" fill="#fff" opacity=".35"/>
    <path d="M36 71 L64 71 L64 76 L36 76Z" fill="#4a3424" stroke="${o}" stroke-width="1.6"/>
    <rect x="46.5" y="70" width="7" height="7" rx="1.5" fill="${skin.trim}" stroke="${o}" stroke-width="1.4"/>
    <path d="M43 76 L57 76 L56 89 L50 92 L44 89Z" fill="${skin.cape}" stroke="${o}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M44 79 L56 79" stroke="${skin.trim}" stroke-width="1.6"/>
    ${fight.bare ? bareArm('back', skin.armorDark, skin.armor, o) : ''}
    <path d="M29 50 Q30 40 40 40 Q45 42 45 48 Q37 46 31 54Z" fill="${skin.armor}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M31 53 Q37 46 45 48" stroke="${skin.trim}" stroke-width="2" fill="none"/>
    ${helmSvg(skin)}
    ${fight.shield ? heroShield(fight.shield, fight.shieldShape ?? 0) : ''}
    ${fight.bare ? bareArm('front', skin.armorDark, skin.armor, o) : ''}
    <path d="M56 47 Q58 39 66 40 Q73 42 72 51 Q66 46 58 50Z" fill="${skin.armor}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M58 50 Q66 46 72 51" stroke="${skin.trim}" stroke-width="2" fill="none"/>
    <g class="hero-arm"${fight.bare ? ' display="none"' : ''}>
      <circle cx="64" cy="55" r="6.5" fill="${skin.armorDark}" stroke="${o}" stroke-width="2"/>
      ${fight.bare ? '' : heroBlade(fight.swordShape ?? 0, weaponLevel)}
      <rect x="65.5" y="54.5" width="10" height="8.5" rx="3.5" fill="${skin.armor}" stroke="${o}" stroke-width="2"/>
      <path d="M68.5 55 L68.5 62.5 M71.5 55 L71.5 62.5" stroke="${o}" stroke-width="1" opacity=".5"/>
    </g>
  </svg>`;
}


const ENEMY_COLORS = ['#58c26b', '#d36bd8', '#e0884a', '#4fb3e8', '#c9c35a', '#e85a5a'];

export interface EnemyOpts {
  color?: string;
  horns?: boolean;
  spikes?: boolean;
  eyes?: string;
}

export function enemySvg(wave: number, boss: boolean, o: EnemyOpts = {}): string {
  const kind = Math.floor((wave - 1) / 10) % 3;
  const color = o.color ?? ENEMY_COLORS[Math.floor((wave - 1) / 30) % ENEMY_COLORS.length];
  const top = [30, 40, 34][kind];
  const horns = o.horns
    ? `<path d="M40 ${top + 6} Q30 ${top - 8} 26 ${top - 18} Q40 ${top - 10} 46 ${top + 2}Z M70 ${top + 6} Q80 ${top - 8} 84 ${top - 18} Q70 ${top - 10} 64 ${top + 2}Z" fill="#f2e6cf" stroke="#2a2018" stroke-width="2" stroke-linejoin="round"/>`
    : '';
  const spikes = o.spikes
    ? `<path d="M22 ${top + 30} L12 ${top + 24} L20 ${top + 40}Z M88 ${top + 30} L98 ${top + 24} L90 ${top + 40}Z M30 ${top + 14} L22 ${top + 4} L36 ${top + 10}Z M80 ${top + 14} L88 ${top + 4} L74 ${top + 10}Z" fill="${o.eyes ?? '#ffe066'}" stroke="#1a1410" stroke-width="1.5"/>`
    : '';
  const crown =
    horns +
    spikes +
    (boss ? `<path d="M34 18 L40 6 L48 16 L56 4 L64 16 L72 6 L76 18Z" fill="#ffd34d" stroke="#3a2a00" stroke-width="2"/>` : '');
  if (kind === 0) {
    // Babosa
    return `<svg viewBox="0 0 110 100" class="enemy-svg" aria-hidden="true">
      <ellipse cx="55" cy="94" rx="34" ry="5" fill="#000" opacity=".25"/>
      <path d="M18 92 Q14 40 55 26 Q96 40 92 92Z" fill="${color}" stroke="#14261a" stroke-width="2.5"/>
      <ellipse cx="44" cy="50" rx="10" ry="6" fill="#fff" opacity=".35"/>
      <circle cx="44" cy="62" r="6" fill="#111"/><circle cx="66" cy="62" r="6" fill="#111"/>
      <circle cx="46" cy="60" r="2" fill="#fff"/><circle cx="68" cy="60" r="2" fill="#fff"/>
      <path d="M46 76 Q55 82 64 76" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${crown}</svg>`;
  }
  if (kind === 1) {
    // Murciélago
    return `<svg viewBox="0 0 110 100" class="enemy-svg bob" aria-hidden="true">
      <ellipse cx="55" cy="94" rx="22" ry="4" fill="#000" opacity=".2"/>
      <path d="M55 40 Q30 20 6 34 Q20 44 18 58 Q34 50 42 62Z M55 40 Q80 20 104 34 Q90 44 92 58 Q76 50 68 62Z" fill="${color}" stroke="#1a0f24" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="55" cy="58" r="20" fill="${color}" stroke="#1a0f24" stroke-width="2.5"/>
      <path d="M42 42 L46 30 L52 40Z M68 42 L64 30 L58 40Z" fill="${color}" stroke="#1a0f24" stroke-width="2"/>
      <circle cx="48" cy="56" r="4.5" fill="#ffef6b"/><circle cx="62" cy="56" r="4.5" fill="#ffef6b"/>
      <path d="M50 68 L53 73 L56 68 L59 73 L62 68" stroke="#fff" stroke-width="2" fill="none"/>
      ${crown}</svg>`;
  }
  // Gólem de piedra
  return `<svg viewBox="0 0 110 100" class="enemy-svg" aria-hidden="true">
    <ellipse cx="55" cy="95" rx="34" ry="5" fill="#000" opacity=".25"/>
    <rect x="22" y="50" width="16" height="30" rx="6" fill="#6f6a66" stroke="#221f1d" stroke-width="2.5"/>
    <rect x="72" y="50" width="16" height="30" rx="6" fill="#6f6a66" stroke="#221f1d" stroke-width="2.5"/>
    <path d="M32 92 L34 36 Q55 22 76 36 L78 92Z" fill="#8a847e" stroke="#221f1d" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M44 50 L50 58 M64 46 L60 56 M46 76 L54 72" stroke="#5a5550" stroke-width="2"/>
    <rect x="42" y="40" width="26" height="8" rx="3" fill="#1d1a18"/>
    <circle cx="49" cy="44" r="2.6" fill="${color}"/><circle cx="61" cy="44" r="2.6" fill="${color}"/>
    ${crown}</svg>`;
}

const ENEMY_TITLES = ['de Fuego', 'de Hielo', 'de Sombra', 'del Pantano', 'de Cristal', 'de Lava', 'del Trueno', 'de Hueso', 'de Niebla', 'de Oro', 'de Óxido', 'de Espinas', 'del Abismo', 'de Ceniza', 'de Jade', 'Estelar'];

/** Cada nivel tiene su propio jefe: especie por mundo, y color, cuernos, púas y título por nivel. */
export function levelEnemy(level: number) {
  const world = Math.ceil(level / 10);
  const kind = (world - 1) % 3;
  const hue = (level * 53 + world * 29) % 360;
  return {
    wave: kind * 10 + 1,
    opts: { color: `hsl(${hue} 58% 56%)`, horns: level % 3 === 1 || level % 10 === 0, spikes: level % 4 === 2 || level % 10 === 0, eyes: `hsl(${(hue + 180) % 360} 90% 65%)` } as EnemyOpts,
    title: ENEMY_TITLES[(level * 7 + world * 3) % ENEMY_TITLES.length],
    hue,
  };
}
const TITAN_ART = () => worldBossArt({ color: '#8a96a3', eyes: '#5ad1ff', horns: true, spikes: true });
/** Monstruo de un nivel: el jefe del nivel (boss) o uno de la oleada `wave`/`enemy`. */
export function levelMob(level: number, boss: boolean, wave = 0, enemy = 0) {
  return levelMonster(level, wave, enemy, boss, TITAN_ART);
}
export function levelEnemySvg(level: number, boss: boolean): string {
  return levelMob(level, boss).svg;
}
export function levelEnemyName(level: number, _worldBoss?: boolean): string {
  return levelMob(level, true).name;
}

export function enemyName(wave: number, boss: boolean): string {
  const kind = Math.floor((wave - 1) / 10) % 3;
  const base = ['Babosa', 'Murciélago', 'Gólem'][kind];
  return boss ? `Rey ${base}` : base;
}

export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="#1b1430"/>
<circle cx="256" cy="256" r="190" fill="#ffd75a" opacity=".18"/>
<g transform="rotate(-35 256 256)">
<path d="M256 50 L296 130 L296 340 L216 340 L216 130Z" fill="#e8b730" stroke="#140f22" stroke-width="12" stroke-linejoin="round"/>
<path d="M256 66 L274 130 L274 334 L256 334Z" fill="#fff1a8"/>
<rect x="160" y="336" width="192" height="36" rx="14" fill="#7a2e1e" stroke="#140f22" stroke-width="10"/>
<rect x="236" y="370" width="40" height="70" rx="10" fill="#7a2e1e" stroke="#140f22" stroke-width="10"/>
<circle cx="256" cy="456" r="24" fill="#fff1a8" stroke="#140f22" stroke-width="10"/>
</g></svg>`;

/** Ícono chico de una pieza de equipo. */
export function itemIconSvg(slot: 'casco' | 'armadura' | 'capa', look: Skin): string {
  if (slot === 'casco') return `<svg viewBox="22 2 56 44" aria-hidden="true">${helmSvg(look)}</svg>`;
  if (slot === 'armadura')
    return `<svg viewBox="28 40 44 44" aria-hidden="true">
      <path d="M36 44 L64 44 L66 80 L34 80Z" fill="${look.armor}" stroke="#0d0f16" stroke-width="2" stroke-linejoin="round"/>
      <path d="M42 50 L58 50 L56 70 L44 70Z" fill="${look.armorDark}" opacity=".7"/>
      <rect x="34" y="72" width="32" height="5" fill="${look.trim}"/></svg>`;
  return `<svg viewBox="16 38 50 64" aria-hidden="true">
    ${look.aura ? `<ellipse cx="40" cy="70" rx="22" ry="28" fill="${look.aura}" opacity=".25"/>` : ''}
    <path d="M38 42 Q22 70 26 98 L48 92 L46 44Z" fill="${look.cape}" stroke="#0d0f16" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

// ---------- Piezas del tablero ----------

/** Color del marco según el nivel de la pieza (1 a 10). */
/** Mismo orden de materiales que las espadas: hierro, bronce, plata, oro, esmeralda, zafiro, rubí, amatista, obsidiana, celestial. */
export const PIECE_FRAMES = ['#7d8794', '#c07a3a', '#dfe6ee', '#ffd25a', '#46f29a', '#4f8dff', '#ff4d6a', '#b77bff', '#ff7a2f', '#a8fbff'];

type Icon = (c: string, d: string, lvl: number, f: string) => string;

/** Detalles que se suman con el nivel: así cada subida se nota, aunque sea poco. */
function gem(x: number, y: number, r: number, f: string) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="#0d0f16" stroke-width="1.2"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.35}" fill="#fff" opacity=".7"/>`;
}

/** Las puntas de la guarda de la Espada del Fénix se vuelven llamas: un poco en la forma 5, más en la 10. */
function fireGuardTips(e: number): string {
  const k = e >= 2 ? 1.15 : 0.8;
  const tip = `<g transform="translate(16 40) scale(${k}) translate(-16 -40)"><path class="fx-fl f1" d="M19 41.5 Q12 43 8 38 Q12 39 13 37.5 Q9 35 9 30 Q13 34.5 16 34.5 Q14.5 31 16 27.5 Q18 33 21.5 36Z" fill="#ff6a1a" stroke="#c8230f" stroke-width=".6" stroke-linejoin="round"/><path class="fx-fl f3" d="M19 40.5 Q14.5 41 12 38.5 Q15 38.5 15.5 37 Q13.5 35 14 32.5 Q16.5 35.5 20 37Z" fill="#ffd34d"/></g>`;
  return tip + `<g transform="translate(64 0) scale(-1 1)">${tip}</g>`;
}

const SWORDS: Icon[] = [
  // Espada recta
  (c, d, l, f) => `<g transform="rotate(-40 32 32)">
    ${l >= 9 ? `<path d="M32 2 L40 14 L40 42 L24 42 L24 14Z" fill="${f}" opacity=".35"/>` : ''}
    <path d="M32 7 L37 15 L37 40 L27 40 L27 15Z" fill="${c}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 9 L34.5 15 L34.5 39 L32 39Z" fill="#fff" opacity=".7"/>
    ${l >= 7 ? `<path d="M32 16 V36" stroke="${f}" stroke-width="2" stroke-linecap="round"/>` : ''}
    <rect x="${l >= 3 ? 18 : 21}" y="40" width="${l >= 3 ? 28 : 22}" height="5" rx="2" fill="${l >= 2 ? f : d}" stroke="${d}" stroke-width="1"/>
    ${l >= 3 ? `<circle cx="18" cy="42.5" r="3" fill="${f}" stroke="${d}" stroke-width="1"/><circle cx="46" cy="42.5" r="3" fill="${f}" stroke="${d}" stroke-width="1"/>` : ''}
    <rect x="29.5" y="45" width="5" height="9" rx="1.5" fill="#6b4a2b" stroke="${d}" stroke-width="1"/>
    ${l >= 5 ? gem(32, 42.5, 3.2, f) : ''}
    <circle cx="32" cy="56" r="3" fill="${c}" stroke="${d}" stroke-width="1"/></g>`,
  // Cimitarra
  (c, d, l, f) => `<g transform="rotate(-40 32 32)">
    ${l >= 9 ? `<path d="M24 42 L24 16 Q26 2 44 0 Q38 14 40 26 L40 42Z" fill="${f}" opacity=".35"/>` : ''}
    <path d="M27 40 L27 18 Q28 7 41 4 Q35 14 37 24 L37 40Z" fill="${c}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M29 38 L29 19 Q30 11 37 7 Q32 16 33 24 L33 38Z" fill="#fff" opacity=".55"/>
    ${l >= 7 ? `<path d="M31 34 Q31 20 36 12" stroke="${f}" stroke-width="2" fill="none" stroke-linecap="round"/>` : ''}
    <path d="M${l >= 3 ? 19 : 22} 41 Q32 ${l >= 3 ? 36 : 38} ${l >= 3 ? 45 : 42} 41 L${l >= 3 ? 45 : 42} 45 Q32 41 ${l >= 3 ? 19 : 22} 45Z" fill="${l >= 2 ? f : d}" stroke="${d}" stroke-width="1"/>
    <rect x="29.5" y="45" width="5" height="9" rx="1.5" fill="#4a2b1b" stroke="${d}" stroke-width="1"/>
    ${l >= 5 ? gem(32, 42, 3, f) : ''}
    <path d="M29 55 L35 55 L32 60Z" fill="${c}" stroke="${d}" stroke-width="1"/></g>`,
  // Mandoble
  (c, d, l, f) => `<g transform="rotate(-40 32 32)">
    ${l >= 9 ? `<path d="M32 0 L43 12 L43 42 L21 42 L21 12Z" fill="${f}" opacity=".35"/>` : ''}
    <path d="M32 4 L40 12 L40 40 L24 40 L24 12Z" fill="${c}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 6 L37 12 L37 39 L32 39Z" fill="#fff" opacity=".6"/>
    <path d="M32 13 V37" stroke="${d}" stroke-width="1.5" opacity=".5"/>
    ${l >= 7 ? `<path d="M28 18 L36 18 M28 26 L36 26 M28 34 L36 34" stroke="${f}" stroke-width="1.6"/>` : ''}
    <path d="M${l >= 3 ? 14 : 18} 40 L${l >= 3 ? 50 : 46} 40 L${l >= 3 ? 46 : 44} 46 L${l >= 3 ? 18 : 20} 46Z" fill="${l >= 2 ? f : d}" stroke="${d}" stroke-width="1"/>
    <rect x="29" y="46" width="6" height="10" rx="1.5" fill="#3b2a20" stroke="${d}" stroke-width="1"/>
    ${l >= 5 ? gem(32, 43, 3.5, f) : ''}
    <circle cx="32" cy="58" r="3.5" fill="${c}" stroke="${d}" stroke-width="1"/></g>`,
  // Espada del Fénix (legendaria). Con cada forma se va volviendo fuego: en 5 el filo se prende, en 10 la hoja
  // se vuelve translúcida con el fuego adentro, y desde 20 es una espada de fuego puro (celestial en 40).
  (_c, _d, l, f) => {
    const e = evoOf('espada');
    if (e >= 3) return fireSword(e);
    const k = 1 + e * 0.22;
    return `<g transform="rotate(-40 32 32)">
    <defs><linearGradient id="fxBladeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".4" stop-color="#ffab2e"/><stop offset="1" stop-color="#c8230f"/></linearGradient></defs>
    <g class="fx-flames" transform="translate(32 40) scale(${1 + e * 0.12} ${k}) translate(-32 -40)">
      <path class="fx-fl f1" d="M32 -2 Q41 9 38.5 20 Q43 29 38.5 40 L25.5 40 Q21 29 25.5 20 Q23 9 32 -2Z" fill="#ff6a1a" opacity="${0.5 + e * 0.2}"/>
      <path class="fx-fl f2" d="M32 3 Q38 13 36 23 Q39 31 36 40 L28 40 Q25 31 28 23 Q26 13 32 3Z" fill="#ffc23a" opacity="${0.55 + e * 0.15}"/>
    </g>
    <path d="M32 5 L37.5 13.5 L37 40 L27 40 L26.5 13.5Z" fill="url(#fxBladeG)" ${e >= 2 ? 'fill-opacity=".45"' : ''} stroke="#3a0d05" stroke-width="2" stroke-linejoin="round"/>
    ${e >= 2 ? '<path class="fx-fl f3" d="M32 6 Q35.5 13 34.5 20 Q36.5 28 34.5 39 L29.5 39 Q27.5 28 29.5 20 Q28.5 13 32 6Z" fill="#fff1a8" opacity=".85"/>' : '<path d="M32 8 L34.6 14.5 L34.3 38.5 L32 38.5Z" fill="#fff" opacity=".7"/>'}
    <path class="fx-vein" d="M31.5 16 Q29.8 21 31.6 26 Q33.4 31 31.6 37" stroke="#fff6c8" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    ${e >= 1 ? `<defs><linearGradient id="fxGuardG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${e >= 2 ? '#ff3d0a' : '#ff6a1a'}"/><stop offset="${e >= 2 ? '.32' : '.2'}" stop-color="#ffab2e"/><stop offset="${e >= 2 ? '.42' : '.32'}" stop-color="#ffc83a"/><stop offset="${e >= 2 ? '.58' : '.68'}" stop-color="#ffc83a"/><stop offset="${e >= 2 ? '.68' : '.8'}" stop-color="#ffab2e"/><stop offset="1" stop-color="${e >= 2 ? '#ff3d0a' : '#ff6a1a'}"/></linearGradient></defs>` : ''}
    ${e >= 1 ? fireGuardTips(e) : ''}
    <path d="M15 39.5 Q19 33 25.5 38.5 L32 40.5 L38.5 38.5 Q45 33 49 39.5 Q45 46.5 38.5 44.5 L25.5 44.5 Q19 46.5 15 39.5Z" fill="${e >= 1 ? 'url(#fxGuardG)' : '#ffc83a'}" stroke="#3a0d05" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M18 39.5 Q21 36.5 25 39.5 M46 39.5 Q43 36.5 39 39.5" stroke="#fff1a8" stroke-width="1.2" fill="none"/>
    ${gem(32, 42.2, 3.3, '#ff3b1f')}
    <rect x="29.5" y="45" width="5" height="9" rx="1.5" fill="#5a1a0a" stroke="#3a0d05" stroke-width="1"/>
    <path d="M29.5 47.5 L34.5 49.5 M29.5 50.5 L34.5 52.5" stroke="#ffb02e" stroke-width="1"/>
    <path d="M32 53.5 Q36.5 57 32 62.5 Q27.5 57 32 53.5Z" fill="#ffb02e" stroke="#3a0d05" stroke-width="1"/>
    <g class="fx-embers"><circle class="fx-em e1" cx="27" cy="26" r="1.4" fill="#ffd34d"/><circle class="fx-em e2" cx="37" cy="18" r="1.1" fill="#fff1a8"/><circle class="fx-em e3" cx="29" cy="12" r="1.2" fill="#ff8a1f"/><circle class="fx-em e4" cx="36" cy="30" r="1" fill="#ffd34d"/></g>
    ${l >= 9 ? `<path d="M32 -4 L40 12 L40 42 L24 42 L24 12Z" fill="${f}" opacity=".2"/>` : ''}</g>`;
  },
];

const SHIELDS: Icon[] = [
  // Rodela (redonda)
  (c, d, l, f) => `${l >= 9 ? `<circle cx="32" cy="32" r="27" fill="${f}" opacity=".3"/>` : ''}
    <circle cx="32" cy="32" r="22" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="3.5"/>
    <circle cx="32" cy="32" r="15" fill="none" stroke="${d}" stroke-width="2" opacity=".5"/>
    <path d="M20 22 Q26 14 36 13" stroke="#fff" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/>
    ${l >= 3 ? [0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${32 + 18.5 * Math.cos((a * Math.PI) / 180)}" cy="${32 + 18.5 * Math.sin((a * Math.PI) / 180)}" r="1.8" fill="${f}"/>`).join('') : ''}
    ${l >= 7 ? `<path d="M32 21 L35 29 L43 32 L35 35 L32 43 L29 35 L21 32 L29 29Z" fill="${f}" opacity=".85"/>` : ''}
    ${l >= 5 ? gem(32, 32, 4.5, f) : `<circle cx="32" cy="32" r="5" fill="${d}"/>`}`,
  // Escudo cometa
  (c, d, l, f) => `${l >= 9 ? `<path d="M32 3 L55 11 Q55 42 32 61 Q9 42 9 11Z" fill="${f}" opacity=".3"/>` : ''}
    <path d="M32 9 L50 15 Q50 40 32 55 Q14 40 14 15Z" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 15 L44 19 Q44 37 32 48Z" fill="#fff" opacity=".28"/>
    <path d="M32 18 V46 M22 27 H42" stroke="${l >= 7 ? f : d}" stroke-width="2.5" opacity="${l >= 7 ? 1 : 0.55}"/>
    ${l >= 3 ? `<circle cx="19" cy="18" r="1.8" fill="${f}"/><circle cx="45" cy="18" r="1.8" fill="${f}"/><circle cx="32" cy="50" r="1.8" fill="${f}"/>` : ''}
    ${l >= 5 ? gem(32, 27, 4, f) : ''}`,
  // Pavés (torre)
  (c, d, l, f) => `${l >= 9 ? `<rect x="11" y="3" width="42" height="58" rx="8" fill="${f}" opacity=".3"/>` : ''}
    <rect x="16" y="8" width="32" height="48" rx="6" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="3"/>
    <rect x="20" y="12" width="10" height="40" rx="3" fill="#fff" opacity=".22"/>
    <path d="M16 22 H48 M16 42 H48" stroke="${d}" stroke-width="2" opacity=".5"/>
    ${l >= 3 ? [14, 50].map((y) => `<circle cx="20" cy="${y}" r="1.8" fill="${f}"/><circle cx="44" cy="${y}" r="1.8" fill="${f}"/>`).join('') : ''}
    ${l >= 7 ? `<path d="M32 24 L38 32 L32 40 L26 32Z" fill="${f}"/>` : ''}
    ${l >= 5 ? gem(32, 32, 4, f) : ''}`,
  // Égida del Fénix (legendaria). En 5 el borde se prende, en 10 la cara se vuelve fuego,
  // y desde 20 ya no es metal: es un fénix de fuego con las alas abiertas (celestial en 40).
  (_c, _d, l, f) => {
    const e = evoOf('escudo');
    if (e >= 3) return fireShield(e);
    return `<defs><linearGradient id="fxShieldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#f5b52e"/><stop offset="1" stop-color="#b8660c"/></linearGradient>
      <radialGradient id="fxShieldR" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="${e >= 2 ? '#ffd34d' : '#ff5a2a'}"/><stop offset="${e >= 2 ? '.55' : '1'}" stop-color="${e >= 2 ? '#ff6a1a' : '#8e0f0a'}"/>${e >= 2 ? '<stop offset="1" stop-color="#c8230f"/>' : ''}</radialGradient></defs>
    <circle class="fx-pulse" cx="32" cy="33" r="28" fill="#ff7a1a" opacity="${0.28 + e * 0.1}"/>
    ${e >= 1 ? `<g transform="translate(32 33) scale(${e >= 2 ? 1.12 : 1.04}) translate(-32 -33)"><path class="fx-fl f1" d="M32 -1 Q35 3 34 5 L40 2 Q40 6 39 8 L46 6 Q45 10 44 11 L52 10 Q50 14 49 15 L56 15 Q54 19 54 21 Q57 23 56 26 Q54 26 54 28 Q55 34 52 40 Q48 50 32 62 Q16 50 12 40 Q9 34 10 28 Q8 26 8 26 Q7 23 10 21 Q10 19 8 15 L15 15 Q14 14 12 10 L20 11 Q19 10 18 6 L25 8 Q24 6 24 2 L30 5 Q29 3 32 -1Z" fill="#ff6a1a" opacity=".9"/><path class="fx-fl f2" d="M32 3 L38 6 L45 9 L51 14 L53 22 Q53 40 32 58 Q11 40 11 22 L13 14 L19 9 L26 6Z" fill="#ffb02e" opacity=".8"/></g>` : ''}
    <g class="fx-ring"><circle cx="32" cy="33" r="29" fill="none" stroke="#ffb02e" stroke-width="2.4" stroke-dasharray="7 6" stroke-linecap="round"/><circle cx="32" cy="33" r="25.5" fill="none" stroke="#ff5a1f" stroke-width="1.2" stroke-dasharray="3 7" opacity=".9"/></g>
    <path d="M32 6 L53 13 Q54 40 32 58 Q10 40 11 13Z" fill="url(#fxShieldG)" stroke="#3a0d05" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M32 11 L48.5 16.5 Q49 38 32 52.5 Q15 38 15.5 16.5Z" fill="url(#fxShieldR)" stroke="#ffe27a" stroke-width="1.4"/>
    ${e >= 2 ? '<g class="fx-flames"><path class="fx-fl f1" d="M22 50 Q18 40 22 32 Q23 38 26 39 Q24 30 30 22 Q30 32 33 34 Q34 26 40 22 Q38 30 41 34 Q44 30 44 26 Q48 36 42 48 Q38 52 32 53 Q26 52 22 50Z" fill="#ff8a1f" opacity=".75"/></g>' : ''}
    <g class="fx-bird"><path d="M32 19 Q35 23 34.2 27.5 Q40 21 47 21.5 Q42 28.5 36.5 31.5 Q39 37 32 46 Q25 37 27.5 31.5 Q22 28.5 17 21.5 Q24 21 29.8 27.5 Q29 23 32 19Z" fill="${e >= 2 ? '#fff6c8' : '#ffd34d'}" stroke="#5a1a0a" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M32 24 Q33 28 32 33 Q31 28 32 24Z" fill="#fff6c8"/></g>
    <path d="M18 17 Q24 13 31 12" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>
    ${l >= 5 ? gem(32, 50, 2.6, f) : ''}`;
  },
];

const POTIONS: Icon[] = [
  // Frasco redondo
  (c, d, l, f) => `${l >= 9 ? `<circle cx="32" cy="38" r="24" fill="${f}" opacity=".3"/>` : ''}
    <rect x="27" y="8" width="10" height="6" rx="2" fill="${l >= 3 ? f : '#a0724a'}" stroke="${d}" stroke-width="1.5"/>
    <path d="M28 14 H36 V22 Q48 27 48 39 Q48 54 32 54 Q16 54 16 39 Q16 27 28 22Z" fill="#e8f2ff" fill-opacity=".25" stroke="${l >= 2 ? f : d}" stroke-width="2.5"/>
    <path d="M18.5 37 Q32 33 45.5 37 Q46 52 32 52 Q18 52 18.5 37Z" fill="${c}"/>
    ${l >= 5 ? `<circle cx="27" cy="44" r="2" fill="#fff" opacity=".7"/><circle cx="36" cy="47" r="1.5" fill="#fff" opacity=".7"/><circle cx="33" cy="40" r="1.2" fill="#fff" opacity=".7"/>` : ''}
    ${l >= 7 ? `<path d="M22 24 Q32 30 42 24" stroke="${f}" stroke-width="2.5" fill="none"/>` : ''}
    <circle cx="25" cy="31" r="3" fill="#fff" opacity=".6"/>`,
  // Vial alto
  (c, d, l, f) => `${l >= 9 ? `<rect x="17" y="2" width="30" height="60" rx="14" fill="${f}" opacity=".3"/>` : ''}
    <rect x="26" y="5" width="12" height="6" rx="2" fill="${l >= 3 ? f : '#a0724a'}" stroke="${d}" stroke-width="1.5"/>
    <path d="M27 11 H37 V16 Q42 18 42 24 V50 Q42 57 32 57 Q22 57 22 50 V24 Q22 18 27 16Z" fill="#e8f2ff" fill-opacity=".25" stroke="${l >= 2 ? f : d}" stroke-width="2.5"/>
    <path d="M24.5 30 H39.5 V50 Q39.5 55 32 55 Q24.5 55 24.5 50Z" fill="${c}"/>
    ${l >= 5 ? `<circle cx="29" cy="45" r="1.8" fill="#fff" opacity=".7"/><circle cx="35" cy="38" r="1.4" fill="#fff" opacity=".7"/><circle cx="31" cy="34" r="1" fill="#fff" opacity=".7"/>` : ''}
    ${l >= 7 ? `<path d="M22 26 H42" stroke="${f}" stroke-width="2.5"/>` : ''}
    <rect x="25.5" y="20" width="3" height="10" rx="1.5" fill="#fff" opacity=".55"/>`,
  // Elixir corazón
  (c, d, l, f) => `${l >= 9 ? `<path d="M32 60 Q4 40 10 24 Q16 10 32 22 Q48 10 54 24 Q60 40 32 60Z" fill="${f}" opacity=".3"/>` : ''}
    <rect x="28" y="7" width="8" height="7" rx="2" fill="${l >= 3 ? f : '#a0724a'}" stroke="${d}" stroke-width="1.5"/>
    <path d="M32 55 Q12 42 15 29 Q18 18 29 21 L29 14 H35 V21 Q46 18 49 29 Q52 42 32 55Z" fill="#e8f2ff" fill-opacity=".25" stroke="${l >= 2 ? f : d}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 52 Q16 41 17.5 33 Q32 30 46.5 33 Q48 41 32 52Z" fill="${c}"/>
    ${l >= 5 ? `<circle cx="27" cy="39" r="1.8" fill="#fff" opacity=".7"/><circle cx="37" cy="42" r="1.4" fill="#fff" opacity=".7"/>` : ''}
    ${l >= 7 ? `<path d="M29 14 H35" stroke="${f}" stroke-width="3"/>` : ''}
    <circle cx="22" cy="30" r="2.5" fill="#fff" opacity=".6"/>`,
];

const BOLTS: Icon[] = [
  // Chispa
  (c, d, l, f) => `<circle cx="32" cy="32" r="${19 + Math.min(l, 10) * 0.6}" fill="${l >= 9 ? f : c}" opacity="${l >= 9 ? 0.35 : 0.18}"/>
    <path d="M37 6 L18 36 L30 36 L25 58 L46 26 L34 26 L40 6Z" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M36 10 L24 32 L31 32 L33 26Z" fill="#fff" opacity=".55"/>
    ${l >= 3 ? `<circle cx="14" cy="18" r="2" fill="${f}"/><circle cx="51" cy="44" r="2" fill="${f}"/>` : ''}
    ${l >= 5 ? `<path d="M10 40 L16 37 M48 14 L54 11" stroke="${f}" stroke-width="2.5" stroke-linecap="round"/>` : ''}
    ${l >= 7 ? `<circle cx="32" cy="32" r="26" fill="none" stroke="${f}" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}`,
  // Rayo doble
  (c, d, l, f) => `<circle cx="32" cy="32" r="${19 + Math.min(l, 10) * 0.6}" fill="${l >= 9 ? f : c}" opacity="${l >= 9 ? 0.35 : 0.18}"/>
    <path d="M28 6 L14 30 L23 30 L19 50 L34 24 L26 24 L31 6Z" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M42 12 L30 36 L38 36 L34 58 L50 30 L42 30 L46 12Z" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M41 16 L33 33 L37 33 L39 30Z" fill="#fff" opacity=".55"/>
    ${l >= 3 ? `<circle cx="12" cy="44" r="2" fill="${f}"/><circle cx="54" cy="18" r="2" fill="${f}"/>` : ''}
    ${l >= 5 ? `<path d="M8 20 L14 22 M50 50 L56 52" stroke="${f}" stroke-width="2.5" stroke-linecap="round"/>` : ''}
    ${l >= 7 ? `<circle cx="32" cy="32" r="26" fill="none" stroke="${f}" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}`,
  // Tormenta
  (c, d, l, f) => `<circle cx="32" cy="32" r="${19 + Math.min(l, 10) * 0.6}" fill="${l >= 9 ? f : c}" opacity="${l >= 9 ? 0.35 : 0.18}"/>
    <path d="M18 22 Q18 12 28 12 Q32 5 40 9 Q50 8 50 18 Q56 22 50 28 L18 28 Q12 26 18 22Z" fill="#cfd6e6" stroke="${l >= 2 ? f : d}" stroke-width="2"/>
    <path d="M34 26 L24 42 L31 42 L27 58 L42 36 L35 36 L39 26Z" fill="${c}" stroke="${l >= 2 ? f : d}" stroke-width="2" stroke-linejoin="round"/>
    ${l >= 3 ? `<path d="M20 34 L17 40 M46 34 L49 40" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>` : ''}
    ${l >= 5 ? gem(40, 16, 3, f) : ''}
    ${l >= 7 ? `<circle cx="32" cy="32" r="27" fill="none" stroke="${f}" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}`,
];

const ICONS: Record<string, Icon[]> = { espada: SWORDS, escudo: SHIELDS, pocion: POTIONS, rayo: BOLTS };

const PIECE_DARK: Record<string, string> = {
  espada: '#2a3140',
  escudo: '#14306b',
  pocion: '#5a0f2a',
  rayo: '#6b4a00',
};

/** Solo el dibujo (sin marco), en una caja de 64×64. Sirve para el tablero y para el héroe. */

// ---------- Formas de fuego de las piezas del Fénix ----------
/** Espada de fuego puro (forma 20 y 40): la hoja, la guarda y el pomo son llamas; solo queda un núcleo de brasa. */
function fireSword(e: number): string {
  const halo = e >= 4 ? '<g class="fx-fl f2"><path d="M32 -12 L35 -7 L32 -2 L29 -7Z" fill="#fff6c8"/><circle cx="32" cy="-7" r="6.5" fill="none" stroke="#fff1a8" stroke-width="1.1" opacity=".8"/></g>' : '';
  // En la forma 20 la hoja de fuego es más fina (como la espada de antes); en la 40 se ensancha en llama celestial.
  const thin = e >= 4 ? '' : ' transform="translate(32 0) scale(.62 1) translate(-32 0)"';
  return `<g transform="rotate(-40 32 32)"><g${thin}>
    <path class="fx-fl f1" d="M32 -9 Q40 0 38 8 Q45 15 40.5 23 Q46 31 40 41 L24 41 Q18 31 23.5 23 Q19 15 26 8 Q24 0 32 -9Z" fill="#ff5a1f" stroke="#c8230f" stroke-width="1"/>
    <path class="fx-fl f2" d="M32 -5 Q38.5 3 37 9 Q42 15 38.5 23 Q42.5 31 38 40 L26 40 Q21.5 31 25.5 23 Q22 15 27 9 Q25.5 3 32 -5Z" fill="#ff8a1f"/>
    <path class="fx-fl f3" d="M32 3 Q35 9 34.2 13 Q36.8 19 35 26 Q36.8 33 34.6 40 L29.4 40 Q27.2 33 29 26 Q27.2 19 29.8 13 Q29 9 32 3Z" fill="#ffd34d"/>
    <path class="fx-fl f1" d="M32 10 Q33.4 15 33 21 Q34 29 33 39 L31 39 Q30 29 31 21 Q30.6 15 32 10Z" fill="#fff6c8"/></g>
    <path class="fx-fl f2" d="M32 41 Q24 33 11 35 Q17 38 16 41 Q10 42 8 46 Q18 44 24 46 L40 46 Q46 44 56 46 Q54 42 48 41 Q47 38 53 35 Q40 33 32 41Z" fill="#ff8a1f"/>
    <path class="fx-fl f3" d="M32 42 Q26 38.5 20 39.5 Q23 41.5 22 43 L42 43 Q41 41.5 44 39.5 Q38 38.5 32 42Z" fill="#ffb02e"/>
    <circle cx="32" cy="43.5" r="3.4" fill="#fff6c8"/><circle class="fx-pulse" cx="32" cy="43.5" r="5.5" fill="#ffd34d" opacity=".5"/>
    <path d="M30.2 46 L33.8 46 L33.4 55 L30.6 55Z" fill="#5a1a0a" stroke="#3a0d05" stroke-width="1"/>
    <path d="M31 48 L33 50 L31 52 L33 54" stroke="#ffd34d" stroke-width="1" fill="none"/>
    <path class="fx-fl f1" d="M32 54 Q37 58 34 63 Q33 60 32 66 Q31 60 30 63 Q27 58 32 54Z" fill="#ff8a1f"/>
    <g class="fx-embers"><circle class="fx-em e1" cx="25" cy="22" r="1.6" fill="#fff1a8"/><circle class="fx-em e2" cx="39" cy="14" r="1.3" fill="#ffd34d"/><circle class="fx-em e3" cx="27" cy="6" r="1.2" fill="#fff1a8"/><circle class="fx-em e4" cx="38" cy="30" r="1.3" fill="#ffd34d"/></g>
    ${halo}</g>`;
}
/**
 * Formas altas de la Égida: un escudo hecho de fuego. Llamas en capas siguen la forma del escudo y suben por arriba,
 * con un núcleo de metal fundido y el fénix del emblema en el centro. En 40 el fuego es celestial (azul y blanco),
 * más alto, con un marco de filigrana dorada, corona de llamas y una estrella.
 */
function fireShield(e: number): string {
  const sky = e >= 4;
  const [c1, c2, c3, c4] = sky ? ['#2a5bff', '#3ab8ff', '#9ff0ff', '#ffffff'] : ['#e8340f', '#ff7a1a', '#ffb02e', '#fff1a8'];
  const outer = 'M32 -4 Q36 2 35 6 Q40 0 44 -2 Q42 4 43 8 Q49 4 54 4 Q50 9 52 12 Q58 10 60 14 Q55 18 56 22 Q60 24 59 28 Q55 30 55 34 Q58 40 54 44 Q50 46 48 48 Q46 56 32 66 Q18 56 16 48 Q14 46 10 44 Q6 40 9 34 Q9 30 5 28 Q4 24 8 22 Q9 18 4 14 Q6 10 12 12 Q14 9 10 4 Q15 4 21 8 Q22 4 20 -2 Q24 0 29 6 Q28 2 32 -4Z';
  const layer = (k: number, fill: string, cls: string, extra = '') => `<g transform="translate(32 36) scale(${k}) translate(-32 -36)"><path class="fx-fl ${cls}" d="${outer}" fill="${fill}" ${extra}/></g>`;
  const core = `<defs><radialGradient id="fxMolten${e}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${c4}"/><stop offset=".45" stop-color="${c3}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
    <g transform="translate(32 34) scale(.66) translate(-32 -34)">
      <path d="M32 6 L53 13 Q54 40 32 58 Q10 40 11 13Z" fill="url(#fxMolten${e})" stroke="${sky ? '#ffd700' : '#ffe27a'}" stroke-width="${sky ? 3 : 2.2}" stroke-linejoin="round"/>
      ${sky
        ? `<path d="M32 17 L35.5 28 L47 28.5 L38 35.4 L41.2 46.5 L32 40 L22.8 46.5 L26 35.4 L17 28.5 L28.5 28Z" fill="#fff" stroke="#ffd700" stroke-width="1.6" stroke-linejoin="round"/>`
        : `<path d="M32 19 Q35 23 34.2 27.5 Q40 21 47 21.5 Q42 28.5 36.5 31.5 Q39 37 32 46 Q25 37 27.5 31.5 Q22 28.5 17 21.5 Q24 21 29.8 27.5 Q29 23 32 19Z" fill="#fff6c8" stroke="#c8230f" stroke-width="1.2" stroke-linejoin="round"/>`}
    </g>`;
  const frame = sky
    ? `<path d="M32 3 L56 11 Q57 42 32 62 Q7 42 8 11Z" fill="none" stroke="#ffd700" stroke-width="1.6" stroke-linejoin="round"/>
       <path d="M32 3 L56 11 Q57 42 32 62 Q7 42 8 11Z" fill="none" stroke="#fff6c8" stroke-width=".6" stroke-dasharray="1.5 2.5"/>
       ${[[8, 11], [56, 11], [32, 62], [32, 3]].map(([x, y]) => `<path d="M${x} ${y - 2.6} L${x + 1.8} ${y} L${x} ${y + 2.6} L${x - 1.8} ${y}Z" fill="#ffd700" stroke="#0b1450" stroke-width=".5"/>`).join('')}
       <g class="fx-fl f2"><path d="M32 -10 Q35 -4 34 0 Q38 -6 42 -7 Q39 -1 40 3 L24 3 Q25 -1 22 -7 Q26 -6 30 0 Q29 -4 32 -10Z" fill="#e8fbff" stroke="#3ab8ff" stroke-width=".6"/></g>`
    : '';
  return `<defs><radialGradient id="fxShGlow${e}"><stop offset="0" stop-color="${c2}" stop-opacity=".7"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs>
    <circle class="fx-pulse" cx="32" cy="32" r="${sky ? 36 : 32}" fill="url(#fxShGlow${e})"/>
    ${layer(sky ? 1.12 : 1, c1, 'f1', `stroke="${sky ? '#0b1450' : '#7a1a05'}" stroke-width=".8" stroke-linejoin="round"`)}
    ${layer(sky ? 0.95 : 0.86, c2, 'f2')}
    ${layer(sky ? 0.8 : 0.72, c3, 'f3')}
    ${frame}${core}
    <g class="fx-embers"><circle class="fx-em e1" cx="14" cy="20" r="1.4" fill="${c4}"/><circle class="fx-em e2" cx="50" cy="16" r="1.2" fill="${c3}"/><circle class="fx-em e3" cx="22" cy="6" r="1.1" fill="${c4}"/><circle class="fx-em e4" cx="44" cy="4" r="1.2" fill="${c3}"/></g>`;
}
// ---------- Evolución de las legendarias (formas en nivel 5, 10, 20 y 40) ----------
export const EVO_COLORS = ['#ff8a1f', '#ff8a1f', '#ffd34d', '#ff2a5a', '#3ab8ff'];
let evoSource: (fam: string) => number = () => 0;
/** main.ts dice en qué forma está cada pieza legendaria (según su nivel). */
export function setEvoSource(fn: (fam: string) => number) {
  evoSource = fn;
}
let evoOverride: number | null = null;
/** Dibuja con una forma elegida (vista previa de cómo se verá en niveles más altos). */
export function previewEvo<T>(e: number | null, fn: () => T): T {
  const old = evoOverride;
  evoOverride = e;
  try {
    return fn();
  } finally {
    evoOverride = old;
  }
}
const evoOf = (fam: string) => evoOverride ?? evoSource(fam);
const PALETTES: Record<number, Record<string, string>> = {
  // Llama dorada: el fuego se vuelve más claro y caliente.
  2: { '#ff6a1a': '#ff9a1a', '#ff5a1f': '#ff7a1a', '#ff8a1f': '#ffb22e', '#ffc23a': '#ffe680', '#ffd34d': '#fff1a8', '#c8230f': '#e0560f', '#ff7a1a': '#ffa02a' },
  // Fénix carmesí: fuego rojo rubí y armadura con detalles granate.
  3: { '#ff5a1f': '#ff2a4a', '#ff6a1a': '#ff3a5a', '#ff8a1f': '#ff5a3a', '#ffc23a': '#ffd0a0', '#ffd34d': '#ffe6a8', '#c8230f': '#9a0f3a', '#a3301b': '#6a0a30',
    '#ff5a2a': '#ff2a5a', '#8e0f0a': '#5a0828', '#7a2414': '#5a0a26', '#ff7a1a': '#ff3a5a', '#ffab2e': '#ff7a6a' },
  // Fénix celestial (forma final): fuego azul eterno, detalles azul noche y oro.
  4: { '#ff5a1f': '#3a7bff', '#ff6a1a': '#4a9bff', '#ff8a1f': '#3ab8ff', '#ffb02e': '#7fe0ff', '#ffc23a': '#bff0ff', '#ffd34d': '#d8f6ff', '#c8230f': '#2a3fd8',
    '#ff7a1a': '#4aa8ff', '#a3301b': '#27308f', '#ff5a2a': '#3a6bff', '#8e0f0a': '#141a5a', '#ff3b1f': '#2ad8ff', '#7a2414': '#1e2370', '#ffab2e': '#8fd8ff',
    '#5a1a0a': '#141a4a', '#3a0d05': '#0b0e30', '#fff1a8': '#e8fbff', '#ff3a1f': '#2ad8ff', '#efb02c': '#eef2ff', '#c98a1e': '#a9b8ee', '#ffc83a': '#ffd700', '#7a1a05': '#13186a' },
};
function evoPaint(svg: string, e: number): string {
  const p = PALETTES[e];
  if (!p) return svg;
  return svg.replace(/#[0-9a-fA-F]{6}\b/g, (m) => p[m.toLowerCase()] ?? m).replace(/(fxBladeG|fxShieldG|fxShieldR|fxGuardG)/g, `$1e${e}`);
}
function star(x: number, y: number, r: number, fill: string, k: number): string {
  return `<path class="evo-tw t${k}" d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28}Z" fill="${fill}"/>`;
}
function rays(cx: number, cy: number, r: number, n: number, fill: string): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = Math.PI / n / 2.2;
    const p = (ang: number, rr: number) => `${(cx + Math.cos(ang) * rr).toFixed(1)} ${(cy + Math.sin(ang) * rr).toFixed(1)}`;
    d += `M${cx} ${cy} L${p(a - w, r)} L${p(a + w, r)}Z `;
  }
  const id = 'evoRay' + Math.round(r);
  return `<defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${fill}" stop-opacity=".95"/><stop offset="1" stop-color="${fill}" stop-opacity="0"/></radialGradient></defs><path d="${d}" fill="url(#${id})"/>`;
}
function runeRing(cx: number, cy: number, r: number, c: string): string {
  const gems = [0, 60, 120, 180, 240, 300]
    .map((a) => {
      const x = cx + r * Math.cos((a * Math.PI) / 180);
      const y = cy + r * Math.sin((a * Math.PI) / 180);
      return `<path d="M${x.toFixed(1)} ${(y - 2.2).toFixed(1)} L${(x + 1.6).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y + 2.2).toFixed(1)} L${(x - 1.6).toFixed(1)} ${y.toFixed(1)}Z" fill="${c}"/>`;
    })
    .join('');
  return `<g class="evo-ring"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="2 4" stroke-linecap="round"/>${gems}</g>`;
}
/** Capas que se agregan al arma o escudo legendario según su forma. */
function evoIcon(svg: string, e: number): string {
  const c = EVO_COLORS[e];
  const back = [
    `<defs><radialGradient id="evoGlow${e}"><stop offset="0" stop-color="${c}" stop-opacity="${0.45 + e * 0.1}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle class="evo-glow" cx="32" cy="32" r="${22 + e * 1.5}" fill="url(#evoGlow${e})"/>`,
    e >= 4 ? `<g class="evo-rays">${rays(32, 32, 36, 14, '#bff0ff')}</g>` : '',
    e >= 3 ? runeRing(32, 32, 26.5, c) : '',
  ].join('');
  const front = [
    e >= 2 ? star(12, 14, 3.2, '#fff', 1) + star(53, 50, 2.6, '#fff', 2) + star(52, 12, 2.2, c, 3) : '',
    e >= 4 ? `<g class="evo-orbit"><circle cx="32" cy="2" r="1.9" fill="#d8f6ff"/><circle cx="62" cy="32" r="1.5" fill="#7fe0ff"/><circle cx="32" cy="62" r="1.9" fill="#d8f6ff"/><circle cx="2" cy="32" r="1.5" fill="#7fe0ff"/></g>` : '',
  ].join('');
  return `<g class="evo evo-${e}">${back}${evoPaint(svg, e)}${front}</g>`;
}

export function famIcon(fam: string, shape: number, lvl: number, base: string, layers = true): string {
  const f = pieceFrame(lvl);
  const icons = ICONS[fam] ?? SWORDS;
  const svg = icons[Math.max(0, Math.min(icons.length - 1, shape))](pieceColor(fam, lvl, base), PIECE_DARK[fam] ?? '#222', lvl, f);
  if (shape === 3 && (fam === 'espada' || fam === 'escudo')) {
    const e = evoOf(fam);
    if (e > 0) return layers ? evoIcon(svg, e) : evoPaint(svg, e);
  }
  return svg;
}

export function pieceFrame(lvl: number): string {
  return PIECE_FRAMES[Math.max(1, Math.min(lvl, PIECE_FRAMES.length)) - 1];
}

/** Color de la pieza según familia y nivel: espadas y escudos toman el material del nivel, como en el héroe. */
export function shieldColor(lvl: number): string {
  return lvl <= 1 ? '#2b5fbf' : TIERS[Math.min(lvl, TIERS.length) - 1].blade;
}

function pieceColor(fam: string, lvl: number, base: string): string {
  if (fam === 'espada') return TIERS[Math.min(lvl, TIERS.length) - 1].blade;
  if (fam === 'escudo') return shieldColor(lvl);
  return base;
}

/** Pieza del tablero: el icono dice la familia y el marco y el número dicen el nivel. */
export function pieceSvg(fam: string, lvl: number, color: string, shape = 0): string {
  const frame = pieceFrame(lvl);
  const d = PIECE_DARK[fam] ?? '#222';
  const scale = 0.78 + Math.min(lvl, 10) * 0.025;
  const sparkle =
    lvl >= 4
      ? `<path d="M52 8 L54 13 L59 15 L54 17 L52 22 L50 17 L45 15 L50 13Z" fill="#fff" class="spark"/>`
      : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="13" fill="${d}" stroke="${frame}" stroke-width="${lvl >= 4 ? 4 : 3}"/>
    <rect x="5" y="5" width="54" height="26" rx="10" fill="#fff" opacity=".07"/>
    <g transform="translate(32 33) scale(${scale}) translate(-32 -33)">${famIcon(fam, shape, lvl, color)}</g>
    ${sparkle}
    <circle cx="13" cy="13" r="8.5" fill="${frame}" stroke="#0008" stroke-width="1.5"/>
    <text x="13" y="17.5" text-anchor="middle" font-size="12" font-weight="900" fill="#1a1020" font-family="system-ui,sans-serif">${lvl}</text>
  </svg>`;
}

/** Jefe Mundial: un titán enorme con cuernos, ojos que brillan, grietas de energía y núcleo en el pecho. */
export function worldBossArt(o: { color: string; eyes: string; horns: boolean; spikes: boolean }): string {
  const dark = '#1a0f14';
  const id = 'wbG' + o.color.slice(1);
  return `<svg viewBox="0 0 120 110" class="enemy-svg wb-titan" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.color}"/><stop offset="1" stop-color="${dark}" stop-opacity=".9"/></linearGradient>
      <radialGradient id="${id}a"><stop offset="0" stop-color="${o.eyes}" stop-opacity=".55"/><stop offset="1" stop-color="${o.eyes}" stop-opacity="0"/></radialGradient></defs>
    <ellipse class="fx-pulse" cx="60" cy="56" rx="58" ry="52" fill="url(#${id}a)"/>
    <ellipse cx="60" cy="105" rx="40" ry="5" fill="#000" opacity=".35"/>
    <path d="M38 76 L34 104 L50 104 L52 80Z M82 76 L86 104 L70 104 L68 80Z" fill="url(#${id})" stroke="${dark}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M22 44 Q8 54 10 78 Q12 86 20 86 Q28 86 28 76 L30 56Z M98 44 Q112 54 110 78 Q108 86 100 86 Q92 86 92 76 L90 56Z" fill="url(#${id})" stroke="${dark}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M8 76 Q8 92 20 92 Q32 92 31 78 Q20 72 8 76Z M112 76 Q112 92 100 92 Q88 92 89 78 Q100 72 112 76Z" fill="${o.color}" stroke="${dark}" stroke-width="2.4"/>
    <path d="M24 40 Q60 26 96 40 L90 84 Q60 92 30 84Z" fill="url(#${id})" stroke="${dark}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M14 46 Q20 34 34 36 L36 50 Q24 50 14 46Z M106 46 Q100 34 86 36 L84 50 Q96 50 106 46Z" fill="${o.color}" stroke="${dark}" stroke-width="2.2" stroke-linejoin="round"/>
    ${o.spikes ? `<path d="M18 40 L14 28 L24 37Z M102 40 L106 28 L96 37Z M26 36 L26 24 L32 34Z M94 36 L94 24 L88 34Z" fill="${o.eyes}" stroke="${dark}" stroke-width="1.4"/>` : ''}
    <path class="wb-veins" d="M40 50 L46 58 L42 66 L48 74 M80 50 L74 60 L79 68 L72 78 M54 80 L60 74 L66 80 M18 60 L22 68 M102 60 L98 68" stroke="${o.eyes}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <g class="fx-pulse"><circle cx="60" cy="60" r="8" fill="${o.eyes}" opacity=".45"/><path d="M60 52 L66 60 L60 68 L54 60Z" fill="${o.eyes}" stroke="${dark}" stroke-width="1.6"/><path d="M60 55 L62.5 60 L60 63Z" fill="#fff" opacity=".8"/></g>
    ${o.horns ? `<path d="M44 22 Q30 12 28 -2 Q40 8 50 16Z M76 22 Q90 12 92 -2 Q80 8 70 16Z" fill="#f2e6cf" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>` : ''}
    <path d="M42 36 Q40 14 60 12 Q80 14 78 36 Q70 42 60 42 Q50 42 42 36Z" fill="${o.color}" stroke="${dark}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M44 24 L56 28 L56 31 L44 28Z M76 24 L64 28 L64 31 L76 28Z" fill="${dark}"/>
    <path class="wb-eyes" d="M46 27 L55 29.6 M74 27 L65 29.6" stroke="${o.eyes}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M50 35 Q60 40 70 35 L68 38 Q60 42 52 38Z" fill="${dark}"/>
    <path d="M53 36 L54.5 39.5 L56 36.5 M67 36 L65.5 39.5 L64 36.5" fill="#fff" stroke="#fff" stroke-width=".6"/>
    <path d="M48 16 Q54 13 60 13" stroke="#fff" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>
  </svg>`;
}
