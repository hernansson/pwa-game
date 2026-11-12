// Monstruos de los niveles normales y mundos con escenario propio.
// Cada mundo tiene 3 especies para las oleadas y un jefe de mundo único. Los colores cambian por mundo
// y por nivel, y el jefe de cada nivel es una versión "élite" (más grande, con cuernos, aura y corona).

import { BossSpecies, Species, WORLD_FOES, foeIndex } from './foes';
export type { BossSpecies, Species };

export interface Look {
  c: string; // color base
  c2: string; // color de acento
  eye: string; // brillo de los ojos
}

export interface WorldTheme {
  name: string;
  scene: 'forest' | 'cave' | 'peaks' | 'desert' | 'glacier' | 'volcano';
  mobs: Species[];
  boss: BossSpecies;
  bossName: string;
  looks: Look[]; // paleta del mundo para las especies
  sky: [string, string];
  accent: string;
}

export const WORLDS: WorldTheme[] = [
  {
    name: 'Bosque Viscoso', scene: 'forest', mobs: WORLD_FOES[0].mobs, boss: WORLD_FOES[0].boss, bossName: 'Ent Ancestral',
    looks: [{ c: '#6fd36a', c2: '#2f8f4a', eye: '#fff36b' }, { c: '#e2574c', c2: '#f6e7c8', eye: '#ffe066' }, { c: '#8d6a4f', c2: '#d8c3a5', eye: '#ffd34d' }],
    sky: ['#1f4a3a', '#0c1f1a'], accent: '#7ee07a',
  },
  {
    name: 'Cuevas del Eco', scene: 'cave', mobs: WORLD_FOES[1].mobs, boss: WORLD_FOES[1].boss, bossName: 'Reina Araña',
    looks: [{ c: '#7b5bd6', c2: '#c9a7ff', eye: '#ff5a8a' }, { c: '#3f3a5c', c2: '#b26bff', eye: '#ff3b3b' }, { c: '#e8e2d4', c2: '#8a7fa8', eye: '#7fe0ff' }],
    sky: ['#2a1a4a', '#0b0716'], accent: '#b98bff',
  },
  {
    name: 'Picos de Piedra', scene: 'peaks', mobs: WORLD_FOES[2].mobs, boss: WORLD_FOES[2].boss, bossName: 'Titán de la Cumbre',
    looks: [{ c: '#9aa3ad', c2: '#5f6873', eye: '#5ad1ff' }, { c: '#e9eef5', c2: '#8fa3bf', eye: '#5ad1ff' }, { c: '#5c6f8a', c2: '#a8c0e0', eye: '#ffe066' }],
    sky: ['#3a6aa8', '#14243e'], accent: '#9fd0ff',
  },
  {
    name: 'Dunas Ardientes', scene: 'desert', mobs: WORLD_FOES[3].mobs, boss: WORLD_FOES[3].boss, bossName: 'Esfinge Dorada',
    looks: [{ c: '#d9963a', c2: '#7a3f12', eye: '#ff3b3b' }, { c: '#e8d6a8', c2: '#9a7a4a', eye: '#3affc8' }, { c: '#e8c26a', c2: '#a8742a', eye: '#ff5a2a' }],
    sky: ['#e88a3a', '#5a2410'], accent: '#ffcf6b',
  },
  {
    name: 'Glaciar Eterno', scene: 'glacier', mobs: WORLD_FOES[4].mobs, boss: WORLD_FOES[4].boss, bossName: 'Dragón de Escarcha',
    looks: [{ c: '#eef6ff', c2: '#7fb8e8', eye: '#3a8bff' }, { c: '#cfe8ff', c2: '#5a8fc8', eye: '#7fffd4' }, { c: '#8fd8ff', c2: '#2a7fc8', eye: '#ffffff' }],
    sky: ['#2a5a8a', '#0a1a30'], accent: '#bff0ff',
  },
  {
    name: 'Fragua Infernal', scene: 'volcano', mobs: WORLD_FOES[5].mobs, boss: WORLD_FOES[5].boss, bossName: 'Dragón del Volcán',
    looks: [{ c: '#d83a2a', c2: '#ffb02e', eye: '#ffe066' }, { c: '#4a2a24', c2: '#ff6a1a', eye: '#ffb02e' }, { c: '#b8261a', c2: '#ffd34d', eye: '#fff1a8' }],
    sky: ['#6a1a10', '#1a0505'], accent: '#ff8a3d',
  },
];

export function worldTheme(world: number): WorldTheme {
  return WORLDS[(world - 1) % WORLDS.length];
}
export function worldName(world: number): string {
  const t = worldTheme(world);
  const lap = Math.ceil(world / WORLDS.length);
  return lap > 1 ? `${t.name} ${['', '', 'II', 'III', 'IV', 'V', 'VI'][lap] ?? lap}` : t.name;
}

const O = '#1b1424';

/** Mezcla un color hex con blanco (k>0) o negro (k<0). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  r = Math.round(r + (t - r) * a);
  g = Math.round(g + (t - g) * a);
  b = Math.round(b + (t - b) * a);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

let gid = 0;
function grad(c: string): [string, string] {
  const id = 'mg' + gid++;
  return [`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 0.28)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, -0.35)}"/></linearGradient></defs>`, `url(#${id})`];
}

/** Ojos grandes con brillo; los élite tienen cejas enojadas y ojos que brillan. */
function eyes(x1: number, x2: number, y: number, r: number, look: Look, elite: boolean, glow = false): string {
  const eye = (x: number, side: number) => glow || elite
    ? `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${look.eye}"/><ellipse cx="${x}" cy="${y}" rx="${r * 0.45}" ry="${r * 0.7}" fill="${O}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="#fff"/>
       ${elite ? `<path d="M${x - r * 1.3 * side} ${y - r * 1.5} L${x + r * 1.1 * side} ${y - r * 0.8}" stroke="${O}" stroke-width="${r * 0.55}" stroke-linecap="round"/>` : ''}`
    : `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${O}" stroke-width="1.6"/><circle cx="${x + r * 0.15}" cy="${y + r * 0.1}" r="${r * 0.55}" fill="${O}"/><circle cx="${x - r * 0.1}" cy="${y - r * 0.2}" r="${r * 0.22}" fill="#fff"/>`;
  return eye(x1, 1) + eye(x2, -1);
}

function horns(x: number, y: number, s: number, fill = '#f2e6cf'): string {
  return `<path d="M${x - 14 * s} ${y} Q${x - 24 * s} ${y - 10 * s} ${x - 22 * s} ${y - 22 * s} Q${x - 14 * s} ${y - 12 * s} ${x - 7 * s} ${y - 4 * s}Z M${x + 14 * s} ${y} Q${x + 24 * s} ${y - 10 * s} ${x + 22 * s} ${y - 22 * s} Q${x + 14 * s} ${y - 12 * s} ${x + 7 * s} ${y - 4 * s}Z" fill="${fill}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`;
}

function crown(x: number, y: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 6 L-12 -8 L-6 -1 L0 -11 L6 -1 L12 -8 L14 6Z" fill="#ffd34d" stroke="#5a3a00" stroke-width="1.8" stroke-linejoin="round"/><circle cx="0" cy="1" r="2.4" fill="#ff3b5c" stroke="#5a3a00" stroke-width="1"/><path d="M-12 2 L12 2" stroke="#fff3b0" stroke-width="1.2" opacity=".7"/></g>`;
}

function shadow(rx = 30): string {
  return `<ellipse cx="55" cy="95" rx="${rx}" ry="4.5" fill="#000" opacity=".3"/>`;
}

function aura(look: Look): string {
  const id = 'ma' + gid++;
  return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${look.eye}" stop-opacity=".45"/><stop offset="1" stop-color="${look.eye}" stop-opacity="0"/></radialGradient></defs><ellipse class="mo-aura" cx="55" cy="56" rx="54" ry="48" fill="url(#${id})"/>`;
}

type Draw = (l: Look, elite: boolean) => string;

const SPECIES: Record<Species, Draw> = {
  slime: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(32)}<g class="mo-squish">
      <path d="M16 90 Q12 58 30 40 Q42 26 55 26 Q68 26 80 40 Q98 58 94 90 Q55 97 16 90Z" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <path d="M30 86 Q26 70 34 56" stroke="${shade(l.c, 0.5)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="42" cy="42" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 42 42)"/>
      <circle cx="70" cy="76" r="4" fill="${shade(l.c, 0.35)}" opacity=".7"/><circle cx="78" cy="66" r="2.4" fill="${shade(l.c, 0.35)}" opacity=".7"/>
      ${eyes(44, 66, 60, 7, l, e)}
      <path d="M48 74 Q55 ${e ? 70 : 80} 62 74" stroke="${O}" stroke-width="2.6" fill="${e ? 'none' : shade(l.c, -0.5)}" stroke-linecap="round"/>
      ${e ? `<path d="M50 74 L52 78 L54 74 M58 74 L60 78 L62 74" fill="#fff" stroke="${O}" stroke-width="1"/>` : ''}
      <path d="M20 88 Q24 94 30 90 M84 90 Q88 94 92 88" stroke="${O}" stroke-width="2" fill="${f}"/></g>`;
  },
  mushroom: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(26)}<g class="mo-bob">
      <path d="M38 62 Q36 84 40 92 L70 92 Q74 84 72 62Z" fill="${l.c2}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M44 66 Q42 82 45 90" stroke="#fff" stroke-width="2.4" opacity=".5" fill="none" stroke-linecap="round"/>
      <path d="M12 60 Q10 26 55 20 Q100 26 98 60 Q90 68 55 66 Q20 68 12 60Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="34" cy="40" rx="7" ry="5" fill="${l.c2}" opacity=".95"/><ellipse cx="58" cy="30" rx="6" ry="4" fill="${l.c2}" opacity=".95"/><ellipse cx="80" cy="44" rx="7" ry="5" fill="${l.c2}" opacity=".95"/><ellipse cx="52" cy="50" rx="4" ry="3" fill="${l.c2}" opacity=".95"/>
      <path d="M24 34 Q34 24 48 22" stroke="#fff" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>
      ${eyes(47, 63, 75, 5.2, l, e)}
      <path d="M50 85 Q55 ${e ? 82 : 88} 60 85" stroke="${O}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M36 80 Q28 84 30 90 M74 80 Q82 84 80 90" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`;
  },
  wolf: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(34)}<g class="mo-bob">
      <path d="M78 66 Q100 58 102 40 Q96 52 84 56Z" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M26 66 Q22 48 40 44 L74 44 Q90 48 86 68 L84 90 L74 90 L72 76 L42 76 L40 90 L30 90Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M38 76 Q55 82 74 76 L72 70 Q55 74 40 70Z" fill="${l.c2}" opacity=".9"/>
      <path d="M14 44 Q10 30 22 18 L26 6 L34 18 L46 16 L54 6 L56 20 Q66 32 58 46 Q48 60 30 58 Q16 56 14 44Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M26 10 L30 18 M52 10 L50 19" stroke="${shade(l.c, 0.4)}" stroke-width="2"/>
      <path d="M8 44 Q4 52 12 56 Q22 60 30 54 Q24 48 20 42Z" fill="${l.c2}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="8" cy="46" r="3" fill="${O}"/>
      <path d="M12 54 L14 58 L16 54 M20 56 L22 60 L24 56" fill="#fff" stroke="${O}" stroke-width=".8"/>
      ${eyes(30, 46, 34, 4.6, l, true, true)}
      <path d="M44 48 Q52 50 58 46" stroke="${shade(l.c, -0.4)}" stroke-width="2" fill="none"/>
      ${e ? `<path d="M60 30 L72 24 L66 34 L78 32 L68 40" fill="${l.c2}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` : ''}</g>`;
  },
  bat: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}<ellipse cx="55" cy="96" rx="20" ry="3.5" fill="#000" opacity=".22"/><g class="mo-fly">
      <g class="mo-wing l"><path d="M44 48 Q24 24 2 32 Q12 40 10 50 Q18 46 22 56 Q28 50 34 60Z" fill="${shade(l.c, -0.2)}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 50 Q26 36 10 36 M38 54 Q28 48 20 52" stroke="${l.c2}" stroke-width="1.4" fill="none" opacity=".7"/></g>
      <g class="mo-wing r"><path d="M66 48 Q86 24 108 32 Q98 40 100 50 Q92 46 88 56 Q82 50 76 60Z" fill="${shade(l.c, -0.2)}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M70 50 Q84 36 100 36 M72 54 Q82 48 90 52" stroke="${l.c2}" stroke-width="1.4" fill="none" opacity=".7"/></g>
      <path d="M40 30 L36 12 L48 24Z M70 30 L74 12 L62 24Z" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M40 28 L38 18 L45 25Z M70 28 L72 18 L65 25Z" fill="${l.c2}"/>
      <ellipse cx="55" cy="52" rx="22" ry="24" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <ellipse cx="55" cy="62" rx="12" ry="11" fill="${l.c2}" opacity=".55"/>
      ${eyes(47, 63, 46, 5.5, l, e, true)}
      <path d="M48 60 Q55 64 62 60" stroke="${O}" stroke-width="2.2" fill="none"/>
      <path d="M50 60 L52 66 L54 61 M56 61 L58 66 L60 60" fill="#fff" stroke="${O}" stroke-width="1"/>
      <path d="M48 74 L46 80 M62 74 L64 80" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/></g>`;
  },
  spider: (l, e) => {
    const [d, f] = grad(l.c);
    const legs = [[-1, 0], [1, 0]].map(([s]) => [0, 1, 2, 3].map((i) => {
      const y = 56 + i * 7;
      const x1 = 55 + s * 14;
      const kx = 55 + s * (34 + i * 3);
      const ky = y - 18 + i * 4;
      const fx = 55 + s * (44 + i * 2);
      return `<path class="mo-leg" d="M${x1} ${y} Q${kx} ${ky - 6} ${kx} ${ky} L${fx} ${92 - (3 - i) * 1}" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M${x1} ${y} Q${kx} ${ky - 6} ${kx} ${ky} L${fx} ${92 - (3 - i) * 1}" stroke="${shade(l.c, -0.1)}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('')).join('');
    return `${d}${shadow(40)}<g class="mo-bob">${legs}
      <ellipse cx="55" cy="44" rx="24" ry="20" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <path d="M55 30 L60 38 L55 46 L50 38Z M55 48 L58 53 L55 58 L52 53Z" fill="${l.c2}" stroke="${O}" stroke-width="1.2"/>
      <ellipse cx="55" cy="66" rx="17" ry="14" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <circle cx="48" cy="62" r="3.4" fill="${l.eye}"/><circle cx="62" cy="62" r="3.4" fill="${l.eye}"/><circle cx="51" cy="57" r="2" fill="${l.eye}"/><circle cx="59" cy="57" r="2" fill="${l.eye}"/>
      <circle cx="47" cy="61" r="1.1" fill="#fff"/><circle cx="61" cy="61" r="1.1" fill="#fff"/>
      <path d="M48 74 Q46 82 50 82 M62 74 Q64 82 60 82" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      ${e ? `<path d="M40 52 Q55 46 70 52" stroke="${O}" stroke-width="2.4" fill="none"/>` : ''}
      <ellipse cx="46" cy="36" rx="6" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-20 46 36)"/></g>`;
  },
  skeleton: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(26)}<g class="mo-bob">
      <path d="M44 74 L40 92 L48 92 L52 78 M66 74 L70 92 L62 92 L58 78" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M40 48 Q55 44 70 48 L68 74 Q55 78 42 74Z" fill="${shade(l.c2, -0.2)}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/>
      <path d="M46 54 L64 54 M46 60 L64 60 M47 66 L63 66" stroke="${f}" stroke-width="3" stroke-linecap="round"/>
      <path d="M55 50 L55 72" stroke="${f}" stroke-width="3"/>
      <path d="M40 50 Q28 56 26 70 M70 50 Q84 54 86 44" stroke="${O}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M40 50 Q28 56 26 70 M70 50 Q84 54 86 44" stroke="${l.c}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M86 46 L90 14 M84 22 L96 22" stroke="${O}" stroke-width="4.5" stroke-linecap="round"/><path d="M86 46 L90 14" stroke="#c9d3dd" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M34 22 Q34 6 55 6 Q76 6 76 22 Q76 34 68 38 L68 44 L42 44 L42 38 Q34 34 34 22Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M38 18 Q42 10 52 9" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6" stroke-linecap="round"/>
      <path d="M40 22 Q46 16 52 22 Q50 30 44 30 Q40 28 40 22Z M70 22 Q64 16 58 22 Q60 30 66 30 Q70 28 70 22Z" fill="${O}"/>
      <circle cx="46" cy="24" r="2.6" fill="${l.eye}" class="mo-glow"/><circle cx="64" cy="24" r="2.6" fill="${l.eye}" class="mo-glow"/>
      <path d="M53 30 L55 34 L57 30Z" fill="${O}"/>
      <path d="M44 38 L66 38 M48 36 L48 41 M53 36 L53 41 M58 36 L58 41 M63 36 L63 41" stroke="${O}" stroke-width="1.4"/>
      ${e ? `<path d="M34 16 L28 8 L38 12Z M76 16 L82 8 L72 12Z" fill="${l.c2}" stroke="${O}" stroke-width="1.6"/>` : ''}</g>`;
  },
  golem: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(36)}<g class="mo-stomp">
      <path d="M36 74 L32 92 L50 92 L50 78Z M74 74 L78 92 L60 92 L60 78Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M22 40 Q8 50 10 72 Q12 80 22 80 L28 56Z M88 40 Q102 50 100 72 Q98 80 88 80 L82 56Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M6 72 Q6 86 18 86 Q30 86 28 74 Q18 68 6 72Z M104 72 Q104 86 92 86 Q80 86 82 74 Q92 68 104 72Z" fill="${shade(l.c, -0.15)}" stroke="${O}" stroke-width="2.4"/>
      <path d="M24 36 Q55 24 86 36 L82 80 Q55 86 28 80Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M34 48 L42 56 L38 64 M76 46 L70 56 L74 64 M50 72 L56 66 L62 72" stroke="${l.eye}" stroke-width="2" fill="none" stroke-linecap="round" class="mo-glow"/>
      <path d="M40 30 Q38 12 55 10 Q72 12 70 30 Q62 36 55 36 Q48 36 40 30Z" fill="${shade(l.c, 0.1)}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <rect x="42" y="20" width="26" height="8" rx="3" fill="${O}"/>
      <circle cx="49" cy="24" r="2.8" fill="${l.eye}" class="mo-glow"/><circle cx="61" cy="24" r="2.8" fill="${l.eye}" class="mo-glow"/>
      <path d="M30 40 Q34 34 42 34" stroke="#fff" stroke-width="2.4" fill="none" opacity=".35" stroke-linecap="round"/>
      <circle cx="68" cy="44" r="3" fill="${l.c2}" stroke="${O}" stroke-width="1.2"/><circle cx="40" cy="70" r="2.4" fill="${l.c2}" stroke="${O}" stroke-width="1"/>
      ${e ? `<path d="M48 14 L44 4 L52 10 L55 0 L58 10 L66 4 L62 14" fill="${l.c2}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>` : ''}</g>`;
  },
  scorpion: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(40)}<g transform="translate(-8 -14) scale(1.15)"><g class="mo-bob">
      <path class="mo-tail" d="M70 66 Q92 64 96 44 Q98 26 84 18 Q76 14 72 22 L78 26 Q88 30 86 42 Q84 56 66 58Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M72 22 L64 14 L74 16Z" fill="${l.c2}" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M34 72 L22 90 M42 74 L34 92 M68 74 L76 92 M74 72 L86 90" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M34 72 L22 90 M42 74 L34 92 M68 74 L76 92 M74 72 L86 90" stroke="${f}" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="55" cy="68" rx="24" ry="13" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <path d="M38 64 Q55 58 72 64 M40 72 Q55 66 70 72" stroke="${shade(l.c, -0.35)}" stroke-width="1.6" fill="none"/>
      <path d="M36 62 Q22 54 18 42 M74 62 Q80 50 78 42" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M36 62 Q22 54 18 42" stroke="${f}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M10 40 Q8 28 18 26 Q24 30 20 36 Q26 38 24 44 Q16 48 10 40Z" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      ${eyes(48, 60, 60, 4, l, e, true)}
      <path d="M50 70 L52 74 L54 70 M56 70 L58 74 L60 70" fill="#fff" stroke="${O}" stroke-width=".8"/>
      <ellipse cx="46" cy="62" rx="5" ry="2.4" fill="#fff" opacity=".3"/></g></g>`;
  },
  imp: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(24)}<g class="mo-fly">
      <g class="mo-wing l"><path d="M38 50 Q20 34 8 42 Q16 46 14 54 Q24 50 30 58Z" fill="${shade(l.c, -0.3)}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/></g>
      <g class="mo-wing r"><path d="M72 50 Q90 34 102 42 Q94 46 96 54 Q86 50 80 58Z" fill="${shade(l.c, -0.3)}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/></g>
      <path d="M66 74 Q84 82 82 66 Q88 70 86 62" stroke="${O}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M84 60 L90 64 L84 66Z" fill="${l.c2}" stroke="${O}" stroke-width="1.2"/>
      <path d="M44 76 L42 88 M66 76 L68 88" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 56 Q55 50 70 56 L68 78 Q55 82 42 78Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M48 62 Q55 66 62 62" stroke="${l.c2}" stroke-width="2" fill="none"/>
      ${horns(55, 26, 0.8, l.c2)}
      <ellipse cx="55" cy="38" rx="20" ry="17" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <path d="M36 36 L28 30 L36 42Z M74 36 L82 30 L74 42Z" fill="${f}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
      ${eyes(48, 62, 36, 4.6, l, true, true)}
      <path d="M46 46 Q55 54 64 46" stroke="${O}" stroke-width="2.2" fill="${shade(l.c, -0.5)}"/>
      <path d="M49 47 L51 51 L53 48 M57 48 L59 51 L61 47" fill="#fff" stroke="${O}" stroke-width=".8"/>
      <ellipse cx="45" cy="28" rx="5" ry="3" fill="#fff" opacity=".35"/>
      ${e ? `<path class="fx-fl f1" d="M55 6 Q60 12 58 18 L52 18 Q50 12 55 6Z" fill="${l.c2}"/>` : ''}</g>`;
  },
  yeti: (l, e) => {
    const [d, f] = grad(l.c);
    return `${d}${shadow(34)}<g class="mo-stomp">
      <path d="M36 76 L32 92 L50 92 L50 80Z M74 76 L78 92 L60 92 L60 80Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M24 44 Q10 54 12 76 L26 78 L30 58Z M86 44 Q100 54 98 76 L84 78 L80 58Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M12 76 Q10 86 20 86 Q28 84 26 76Z M98 76 Q100 86 90 86 Q82 84 84 76Z" fill="${l.c2}" stroke="${O}" stroke-width="2"/>
      <path d="M26 42 Q20 22 36 14 Q55 4 74 14 Q90 22 84 42 L82 80 Q55 88 28 80Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M30 30 L26 26 M34 22 L30 16 M76 22 L80 16 M80 30 L86 26 M40 82 L38 88 M70 82 L72 88" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M38 26 Q55 18 72 26 Q76 44 55 48 Q34 44 38 26Z" fill="${l.c2}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
      ${eyes(47, 63, 32, 4.4, l, e, true)}
      <path d="M46 40 Q55 46 64 40 L62 44 Q55 48 48 44Z" fill="${O}"/><path d="M49 41 L50 45 L52 42 M58 42 L60 45 L61 41" fill="#fff"/>
      <path d="M42 56 Q55 62 68 56" stroke="${shade(l.c, -0.25)}" stroke-width="2" fill="none"/>
      ${e ? horns(55, 14, 0.8, '#dfeaf5') : ''}</g>`;
  },
};

/** Monstruo de una especie. `elite` = jefe del nivel (más fiero, con cuernos y aura); `crowned` agrega corona. */
export function monsterSvg(sp: Species, look: Look, elite = false, crowned = false): string {
  const extra = elite ? aura(look) : '';
  const top = { slime: [55, 26], mushroom: [55, 18], wolf: [36, 8], bat: [55, 26], spider: [55, 24], skeleton: [55, 4], golem: [55, 8], scorpion: [55, 44], imp: [55, 18], yeti: [55, 8] }[sp];
  return `<svg viewBox="0 0 110 100" class="enemy-svg mo mo-${sp}" aria-hidden="true">${extra}${SPECIES[sp](look, elite)}${elite && sp !== 'imp' && sp !== 'golem' && sp !== 'yeti' && sp !== 'skeleton' ? `<g class="mo-horns">${horns(top[0], top[1] + 8, 0.7)}</g>` : ''}${crowned ? crown(top[0], top[1] - 4, 0.9) : ''}</svg>`;
}

// ---------- Jefes de mundo ----------
const BOSSES: Record<BossSpecies, (t: WorldTheme) => string> = {
  treant: () => {
    const [d, f] = grad('#6b4a2f');
    return `${d}${shadow(42)}
      <path d="M12 40 Q4 20 18 10 Q20 22 28 24 Q26 12 38 4 Q38 18 46 20 Q50 6 62 4 Q60 16 68 20 Q74 8 88 10 Q84 22 92 26 Q104 22 100 40 Q92 52 55 50 Q18 52 12 40Z" fill="#3f9a4a" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M20 34 Q30 22 44 26 M60 22 Q74 18 86 28" stroke="#7ee07a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
      <circle cx="28" cy="30" r="3" fill="#ff5a6a"/><circle cx="82" cy="34" r="3" fill="#ff5a6a"/><circle cx="56" cy="16" r="3" fill="#ff5a6a"/>
      <path d="M32 44 Q30 70 26 92 L44 92 L48 80 L56 92 L62 80 L66 92 L84 92 Q80 70 78 44Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M34 50 Q14 56 6 74 Q12 76 14 70 Q16 78 20 76 Q22 66 34 62Z M76 50 Q96 56 104 74 Q98 76 96 70 Q94 78 90 76 Q88 66 76 62Z" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M40 54 Q42 68 40 84 M70 54 Q68 70 72 86 M55 70 L55 88" stroke="${shade('#6b4a2f', -0.35)}" stroke-width="2" fill="none"/>
      <path d="M40 56 Q46 50 52 56 Q48 62 42 61Z M70 56 Q64 50 58 56 Q62 62 68 61Z" fill="${O}"/>
      <circle cx="46" cy="57" r="2.6" fill="#b6ff6b" class="mo-glow"/><circle cx="64" cy="57" r="2.6" fill="#b6ff6b" class="mo-glow"/>
      <path d="M44 70 Q55 64 66 70 Q60 78 55 76 Q50 78 44 70Z" fill="${O}"/>
      <path d="M48 70 L50 74 L52 71 M58 71 L60 74 L62 70" fill="#e8d6a8"/>
      ${crown(55, 6, 1)}`;
  },
  queen: (t) => {
    const l = t.looks[1];
    const [d, f] = grad('#3a2a5c');
    const legs = [-1, 1].map((s) => [0, 1, 2, 3].map((i) => `<path d="M${55 + s * 16} ${58 + i * 6} Q${55 + s * (40 + i * 4)} ${30 + i * 8} ${55 + s * (50 + i * 1)} ${92 - i}" stroke="${O}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M${55 + s * 16} ${58 + i * 6} Q${55 + s * (40 + i * 4)} ${30 + i * 8} ${55 + s * (50 + i * 1)} ${92 - i}" stroke="#5a4a80" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')).join('');
    return `${d}${shadow(46)}${legs}
      <ellipse cx="55" cy="70" rx="26" ry="20" fill="${f}" stroke="${O}" stroke-width="2.6"/>
      <path d="M55 54 L62 66 L55 82 L48 66Z" fill="${l.c2}" stroke="${O}" stroke-width="1.4"/><circle cx="55" cy="68" r="3" fill="#ff3b6a" class="mo-glow"/>
      <path d="M42 46 Q40 30 55 26 Q70 30 68 46 Q62 54 55 54 Q48 54 42 46Z" fill="#8a6ad8" stroke="${O}" stroke-width="2.4"/>
      <path d="M44 34 L38 22 M66 34 L72 22" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
      ${[[48, 38, 3.4], [62, 38, 3.4], [51, 33, 2], [59, 33, 2], [55, 30, 1.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff3b6a" class="mo-glow"/>`).join('')}
      <path d="M48 48 Q46 56 50 56 M62 48 Q64 56 60 56" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      ${crown(55, 22, 1.1)}`;
  },
  titan: () => `<g transform="translate(-5 -5) scale(1.0)"></g>`,
  sphinx: () => {
    const [d, f] = grad('#e8b24a');
    return `${d}${shadow(46)}
      <path d="M20 90 L22 62 Q24 50 40 48 L76 48 Q96 50 98 70 L98 90Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M22 90 L22 78 L36 78 L36 90 M84 90 L84 78 L98 78 L98 90" fill="${shade('#e8b24a', -0.15)}" stroke="${O}" stroke-width="2"/>
      <path d="M30 46 Q26 20 40 10 L70 10 Q84 20 80 46 L74 60 L36 60Z" fill="#2a5ad8" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M34 20 L76 20 M32 30 L78 30 M32 40 L78 40" stroke="#ffd34d" stroke-width="3"/>
      <path d="M40 22 Q40 12 55 12 Q70 12 70 22 L70 46 Q62 56 55 56 Q48 56 40 46Z" fill="${f}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M44 30 L52 30 M58 30 L66 30" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="48" cy="32" r="2.4" fill="#3affc8" class="mo-glow"/><circle cx="62" cy="32" r="2.4" fill="#3affc8" class="mo-glow"/>
      <path d="M53 36 L55 42 L57 36" stroke="${O}" stroke-width="1.6" fill="none"/>
      <path d="M48 46 Q55 50 62 46" stroke="${O}" stroke-width="2" fill="none"/>
      <path d="M52 56 L52 66 L58 66 L58 56" fill="#2a5ad8" stroke="${O}" stroke-width="1.6"/>
      <path d="M46 8 Q55 0 64 8 L60 14 L50 14Z" fill="#ffd34d" stroke="${O}" stroke-width="1.8"/><circle cx="55" cy="8" r="2.4" fill="#3affc8"/>`;
  },
  icedragon: () => dragon('#8fd8ff', '#eef6ff', '#3a8bff', '#2a6ac8'),
  firedragon: () => dragon('#d83a2a', '#ffb02e', '#ffe066', '#7a1a10'),
};

function dragon(c: string, belly: string, eye: string, wing: string): string {
  const [d, f] = grad(c);
  return `${d}${shadow(46)}
    <g class="mo-wing l"><path d="M40 44 Q18 14 0 18 Q10 26 6 36 Q16 34 16 44 Q24 40 28 52Z" fill="${wing}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M38 44 Q22 26 6 22 M34 48 Q24 40 14 40" stroke="${belly}" stroke-width="1.4" fill="none" opacity=".6"/></g>
    <g class="mo-wing r"><path d="M70 44 Q92 14 110 18 Q100 26 104 36 Q94 34 94 44 Q86 40 82 52Z" fill="${wing}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M72 44 Q88 26 104 22 M76 48 Q86 40 96 40" stroke="${belly}" stroke-width="1.4" fill="none" opacity=".6"/></g>
    <path d="M70 80 Q96 86 102 70 Q104 62 98 60 Q98 70 88 72 Q78 74 70 70Z" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/><path d="M98 60 L104 54 L102 64Z" fill="${belly}" stroke="${O}" stroke-width="1.4"/>
    <path d="M38 78 L34 92 L48 92 L48 82Z M72 78 L76 92 L62 92 L62 82Z" fill="${f}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M34 92 L36 88 M40 92 L41 88 M70 92 L71 88 M76 92 L75 88" stroke="#fff" stroke-width="1.4"/>
    <path d="M32 58 Q30 40 55 38 Q80 40 78 58 L76 82 Q55 90 34 82Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M44 50 Q55 46 66 50 L64 82 Q55 86 46 82Z" fill="${belly}" stroke="${O}" stroke-width="1.6"/>
    <path d="M46 58 L64 58 M46 66 L64 66 M47 74 L63 74" stroke="${shade(belly, -0.3)}" stroke-width="1.4"/>
    ${horns(55, 18, 0.9, belly)}
    <path d="M38 30 Q36 12 55 10 Q74 12 72 30 L80 36 Q78 44 68 44 L42 44 Q32 44 30 36Z" fill="${f}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M44 24 L52 28 M66 24 L58 28" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="48" cy="29" rx="3.4" ry="2.6" fill="${eye}" class="mo-glow"/><ellipse cx="62" cy="29" rx="3.4" ry="2.6" fill="${eye}" class="mo-glow"/>
    <circle cx="44" cy="38" r="1.4" fill="${O}"/><circle cx="66" cy="38" r="1.4" fill="${O}"/>
    <path d="M40 42 L44 46 L48 42 M62 42 L66 46 L70 42" fill="#fff" stroke="${O}" stroke-width="1"/>
    <path d="M42 18 Q48 12 56 12" stroke="#fff" stroke-width="2" fill="none" opacity=".4" stroke-linecap="round"/>
    ${crown(55, 4, 1)}`;
}

/** Jefe del mundo (nivel 10, 20, 30...): único de cada escenario. */
export function worldBossSvg(world: number, titanArt: () => string): string {
  const t = worldTheme(world);
  if (t.boss === 'titan') return titanArt();
  return `<svg viewBox="0 0 110 100" class="enemy-svg mo mo-boss mo-${t.boss}" aria-hidden="true">${aura({ c: '', c2: '', eye: t.accent })}${BOSSES[t.boss](t)}</svg>`;
}

/** Mezcla los colores del mundo con un giro por nivel, para que no haya dos niveles iguales. */
function lookFor(t: WorldTheme, i: number, level: number): Look {
  const base = t.looks[i % t.looks.length];
  const k = ((level * 37) % 7) / 7 - 0.45; // -0.45..0.4
  return { c: shade(base.c, k * 0.35), c2: base.c2, eye: base.eye };
}

/** Qué monstruo aparece en un nivel: el de la oleada (rota entre las 3 especies) o el jefe del nivel. */
export function levelMonster(level: number, wave: number, enemy: number, boss: boolean, titanArt: () => string): { svg: string; name: string } {
  const world = Math.ceil(level / 10);
  const t = worldTheme(world);
  if (boss && level % 10 === 0) return { svg: worldBossSvg(world, titanArt), name: t.bossName };
  const i = foeIndex(level, wave, enemy, boss);
  const sp = t.mobs[i];
  const look = lookFor(t, i, level);
  const title = TITLES[(level * 5 + world) % TITLES.length];
  return { svg: monsterSvg(sp, look, boss, boss), name: (boss ? 'Jefe ' : '') + SPECIES_NAMES[sp] + (boss ? ' ' + title : '') };
}

export const SPECIES_NAMES: Record<Species, string> = {
  slime: 'Babosa', mushroom: 'Hongo Loco', wolf: 'Lobo', bat: 'Murciélago', spider: 'Araña', skeleton: 'Esqueleto',
  golem: 'Gólem', scorpion: 'Escorpión', imp: 'Diablillo', yeti: 'Yeti',
};
const TITLES = ['Feroz', 'Gigante', 'Sombrío', 'Furioso', 'Antiguo', 'Salvaje', 'Maldito', 'Colosal', 'Voraz', 'Rabioso'];
