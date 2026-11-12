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
  helm: 'knight' | 'kabuto' | 'cyber';
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
}

/** Escudo en el brazo de atrás: el mismo dibujo que la pieza del tablero. */
function heroShield(lvl: number, shape: number): string {
  const sc = 0.62 + Math.min(lvl, 10) * 0.02;
  return `<g transform="translate(30 62) scale(${sc}) translate(-32 -32)" class="hero-shield">${famIcon('escudo', shape, lvl, '#5c9bff')}</g>`;
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
    <path d="M29 50 Q30 40 40 40 Q45 42 45 48 Q37 46 31 54Z" fill="${skin.armor}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M31 53 Q37 46 45 48" stroke="${skin.trim}" stroke-width="2" fill="none"/>
    ${helmSvg(skin)}
    ${fight.shield ? heroShield(fight.shield, fight.shieldShape ?? 0) : ''}
    <path d="M56 47 Q58 39 66 40 Q73 42 72 51 Q66 46 58 50Z" fill="${skin.armor}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M58 50 Q66 46 72 51" stroke="${skin.trim}" stroke-width="2" fill="none"/>
    <g class="hero-arm">
      <circle cx="64" cy="55" r="6.5" fill="${skin.armorDark}" stroke="${o}" stroke-width="2"/>
      <g transform="translate(41 25) scale(.62)">${famIcon('espada', fight.swordShape ?? 0, Math.max(1, Math.min(10, weaponLevel)), '#c9d3dd')}</g>
      <rect x="65" y="54" width="10" height="9" rx="3" fill="${skin.armor}" stroke="${o}" stroke-width="2"/>
      <path d="M66 57 L74 57" stroke="${skin.trim}" stroke-width="1.6"/>
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
export function levelEnemySvg(level: number, boss: boolean): string {
  const e = levelEnemy(level);
  return enemySvg(e.wave, boss, e.opts);
}
export function levelEnemyName(level: number, worldBoss: boolean): string {
  const e = levelEnemy(level);
  return `${worldBoss ? 'Rey ' : ''}${enemyName(e.wave, false)} ${e.title}`;
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
export function famIcon(fam: string, shape: number, lvl: number, base: string): string {
  const f = pieceFrame(lvl);
  const icons = ICONS[fam] ?? SWORDS;
  return icons[Math.max(0, Math.min(icons.length - 1, shape))](pieceColor(fam, lvl, base), PIECE_DARK[fam] ?? '#222', lvl, f);
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
