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
  rarity: 'común' | 'épica' | 'legendaria';
  price: number; // en gemas, 0 = incluida
  armor: string;
  armorDark: string;
  trim: string;
  cape: string;
  visor: string;
  aura: string | null;
  helm: 'knight' | 'kabuto' | 'cyber';
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
    rarity: 'épica',
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
    rarity: 'legendaria',
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

function helmSvg(s: Skin): string {
  if (s.helm === 'kabuto') {
    return `<path d="M36 30 Q50 12 64 30 L64 40 L36 40Z" fill="${s.armor}" stroke="#14080c" stroke-width="2"/>
      <path d="M38 28 Q30 10 24 8 Q34 18 40 26Z M62 28 Q70 10 76 8 Q66 18 60 26Z" fill="${s.trim}" stroke="#14080c" stroke-width="1.5"/>
      <rect x="40" y="33" width="20" height="6" rx="2" fill="${s.visor}"/>
      <circle cx="50" cy="24" r="3" fill="${s.trim}"/>`;
  }
  if (s.helm === 'cyber') {
    return `<path d="M35 38 L37 24 Q50 14 63 24 L65 38Z" fill="${s.armor}" stroke="#05060c" stroke-width="2"/>
      <rect x="38" y="29" width="24" height="5" rx="2.5" fill="${s.visor}" class="neon"/>
      <path d="M60 22 L72 14" stroke="${s.trim}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="72" cy="14" r="2.2" fill="${s.cape}"/>`;
  }
  return `<path d="M36 40 L36 28 Q50 14 64 28 L64 40Z" fill="${s.armor}" stroke="#1a1d26" stroke-width="2"/>
    <rect x="41" y="30" width="18" height="4" rx="1.5" fill="${s.visor}"/>
    <path d="M50 16 Q58 4 66 10 Q58 10 52 18Z" fill="${s.cape}" stroke="#1a1d26" stroke-width="1.2"/>
    <rect x="48.5" y="18" width="3" height="20" fill="${s.trim}" opacity=".9"/>`;
}

/** Héroe mirando a la derecha, con el arma equipada en la mano. */
export function heroSvg(skin: Skin, weaponLevel: number): string {
  const aura = skin.aura
    ? `<ellipse cx="50" cy="62" rx="34" ry="40" fill="${skin.aura}" opacity=".18" class="aura"/>`
    : '';
  return `<svg viewBox="0 0 120 110" class="hero-svg" aria-hidden="true">
    ${aura}
    <ellipse cx="50" cy="104" rx="26" ry="5" fill="#000" opacity=".25"/>
    <path d="M38 42 Q22 70 26 98 L48 92 L46 44Z" fill="${skin.cape}" stroke="#0d0f16" stroke-width="2" stroke-linejoin="round"/>
    <rect x="40" y="78" width="9" height="22" rx="3" fill="${skin.armorDark}" stroke="#0d0f16" stroke-width="2"/>
    <rect x="52" y="78" width="9" height="22" rx="3" fill="${skin.armorDark}" stroke="#0d0f16" stroke-width="2"/>
    <rect x="38" y="97" width="12" height="6" rx="2" fill="${skin.trim}"/>
    <rect x="51" y="97" width="12" height="6" rx="2" fill="${skin.trim}"/>
    <path d="M36 44 L64 44 L66 80 L34 80Z" fill="${skin.armor}" stroke="#0d0f16" stroke-width="2" stroke-linejoin="round"/>
    <path d="M42 50 L58 50 L56 70 L44 70Z" fill="${skin.armorDark}" opacity=".7"/>
    <rect x="34" y="72" width="32" height="5" fill="${skin.trim}"/>
    ${helmSvg(skin)}
    <g class="hero-arm">
      <circle cx="64" cy="54" r="7" fill="${skin.armorDark}" stroke="#0d0f16" stroke-width="2"/>
      <g transform="translate(41 25) scale(.62)">${weaponInner(weaponLevel)}</g>
      <circle cx="70" cy="58" r="5" fill="${skin.armor}" stroke="#0d0f16" stroke-width="2"/>
    </g>
  </svg>`;
}

function weaponInner(level: number): string {
  // Reutiliza el dibujo del arma sin la etiqueta <svg> exterior.
  return weaponSvg(level).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}

const ENEMY_COLORS = ['#58c26b', '#d36bd8', '#e0884a', '#4fb3e8', '#c9c35a', '#e85a5a'];

export function enemySvg(wave: number, boss: boolean): string {
  const kind = Math.floor((wave - 1) / 10) % 3;
  const color = ENEMY_COLORS[Math.floor((wave - 1) / 30) % ENEMY_COLORS.length];
  const crown = boss
    ? `<path d="M34 18 L40 6 L48 16 L56 4 L64 16 L72 6 L76 18Z" fill="#ffd34d" stroke="#3a2a00" stroke-width="2"/>`
    : '';
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
