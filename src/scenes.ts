// Escenarios de cada mundo: un SVG de fondo para el mapa de niveles y para la batalla.
// viewBox 200x200, el suelo arranca en y≈150. En pantallas anchas se recorta el cielo
// (xMidYMax slice) y en las altas se recortan los costados: lo importante va entre x=35 y x=165.
import type { WorldTheme } from './monsters';

type Scene = WorldTheme['scene'];

const sky = (id: string, stops: [number, string][]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

/** Partículas que flotan (luciérnagas, nieve, brasas...). Pocas y con transform para no pesar. */
function motes(n: number, color: string, cls: string, y0 = 20, y1 = 150, r = 1.2): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (i * 53 + 17) % 190 + 5;
    const y = y0 + ((i * 37) % (y1 - y0));
    out += `<circle class="${cls}" cx="${x}" cy="${y}" r="${r + (i % 3) * 0.4}" fill="${color}" style="animation-delay:${-(i * 0.7).toFixed(1)}s;animation-duration:${(4 + (i % 4)).toFixed(0)}s"/>`;
  }
  return out;
}

function pine(x: number, y: number, s: number, c: string): string {
  return `<path d="M${x} ${y - 34 * s} L${x + 9 * s} ${y - 18 * s} L${x + 5 * s} ${y - 18 * s} L${x + 13 * s} ${y - 4 * s} L${x + 2 * s} ${y - 4 * s} L${x + 2 * s} ${y} L${x - 2 * s} ${y} L${x - 2 * s} ${y - 4 * s} L${x - 13 * s} ${y - 4 * s} L${x - 5 * s} ${y - 18 * s} L${x - 9 * s} ${y - 18 * s}Z" fill="${c}"/>`;
}

function roundTree(x: number, y: number, s: number, trunk: string, leaf: string, hi: string): string {
  return `<rect x="${x - 2.5 * s}" y="${y - 16 * s}" width="${5 * s}" height="${16 * s}" fill="${trunk}"/>
    <circle cx="${x}" cy="${y - 24 * s}" r="${13 * s}" fill="${leaf}"/><circle cx="${x - 9 * s}" cy="${y - 16 * s}" r="${8 * s}" fill="${leaf}"/><circle cx="${x + 9 * s}" cy="${y - 17 * s}" r="${8 * s}" fill="${leaf}"/>
    <circle cx="${x - 4 * s}" cy="${y - 29 * s}" r="${5 * s}" fill="${hi}" opacity=".5"/>`;
}

const SCENES: Record<Scene, () => string> = {
  forest: () => `<defs>${sky('sk-forest', [[0, '#123d3a'], [0.55, '#2f7a5a'], [0.75, '#7cc28a']])}
      <radialGradient id="sk-forest-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7c2" stop-opacity=".9"/><stop offset="1" stop-color="#fff7c2" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="200" fill="url(#sk-forest)"/>
    <circle cx="130" cy="96" r="44" fill="url(#sk-forest-sun)"/>
    <path d="M0 120 Q30 96 60 112 Q90 92 120 110 Q150 94 200 114 L200 160 L0 160Z" fill="#2a6a52"/>
    ${[8, 30, 52, 150, 172, 194].map((x, i) => pine(x, 142, 1.1 + (i % 2) * 0.3, '#1d5040')).join('')}
    ${[20, 44, 160, 184].map((x) => roundTree(x, 152, 1.2, '#3a2a1c', '#2f7f4a', '#7ee07a')).join('')}
    <path d="M0 148 Q50 140 100 146 Q150 140 200 148 L200 200 L0 200Z" fill="#3f9a4a"/>
    <path d="M0 160 Q60 152 120 158 Q170 154 200 160 L200 200 L0 200Z" fill="#348540"/>
    ${[12, 40, 70, 128, 158, 188].map((x) => `<path d="M${x} 166 l2 -6 l2 6 l2 -5 l1 5" stroke="#5cc25a" stroke-width="1.4" fill="none"/>`).join('')}
    <circle cx="36" cy="174" r="2.4" fill="#ff5a6a"/><circle cx="168" cy="178" r="2.4" fill="#ffd34d"/><circle cx="60" cy="186" r="2" fill="#fff"/>
    ${motes(10, '#e6ff8a', 'sc-fly', 60, 150)}`,

  cave: () => `<defs>${sky('sk-cave', [[0, '#0b0716'], [0.6, '#2a1a4a'], [1, '#3a2560']])}
      <radialGradient id="sk-cave-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#b98bff" stop-opacity=".5"/><stop offset="1" stop-color="#b98bff" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="200" fill="url(#sk-cave)"/>
    <ellipse cx="100" cy="118" rx="70" ry="50" fill="url(#sk-cave-glow)"/>
    <path d="M0 0 L200 0 L200 40 L188 30 L182 58 L170 34 L158 46 L150 26 L138 64 L126 30 L112 42 L100 24 L88 50 L76 28 L64 40 L54 22 L42 60 L32 30 L20 44 L10 28 L0 46Z" fill="#160e2a"/>
    <path d="M0 150 L0 118 L10 126 L18 100 L28 128 L40 132 L50 112 L58 140 L142 140 L150 110 L160 132 L172 104 L182 130 L192 116 L200 124 L200 150Z" fill="#1d1336"/>
    ${[[26, 132, '#c9a7ff'], [46, 140, '#7fe0ff'], [158, 136, '#c9a7ff'], [178, 142, '#ff7ad8']].map(([x, y, c]) => `<g class="sc-glow"><path d="M${x} ${y} L${+x - 5} ${+y - 12} L${x} ${+y - 22} L${+x + 5} ${+y - 12}Z" fill="${c}" opacity=".9"/><path d="M${+x + 6} ${y} L${+x + 3} ${+y - 8} L${+x + 7} ${+y - 13} L${+x + 10} ${+y - 7}Z" fill="${c}" opacity=".7"/></g>`).join('')}
    <path d="M0 146 Q50 138 100 144 Q150 138 200 146 L200 200 L0 200Z" fill="#2c2148"/>
    <path d="M0 162 Q70 154 130 160 Q170 156 200 162 L200 200 L0 200Z" fill="#241a3d"/>
    <ellipse cx="60" cy="176" rx="10" ry="3" fill="#3a2a5e"/><ellipse cx="150" cy="184" rx="14" ry="3.4" fill="#3a2a5e"/>
    ${motes(8, '#c9a7ff', 'sc-fly', 50, 140, 0.9)}`,

  peaks: () => `<defs>${sky('sk-peaks', [[0, '#1f3f78'], [0.55, '#5a8fd0'], [0.78, '#bfe0ff']])}</defs>
    <rect width="200" height="200" fill="url(#sk-peaks)"/>
    <g class="sc-cloud"><ellipse cx="50" cy="56" rx="22" ry="6" fill="#fff" opacity=".7"/><ellipse cx="60" cy="52" rx="12" ry="6" fill="#fff" opacity=".7"/></g>
    <g class="sc-cloud" style="animation-delay:-9s"><ellipse cx="150" cy="40" rx="20" ry="5" fill="#fff" opacity=".6"/><ellipse cx="142" cy="36" rx="10" ry="5" fill="#fff" opacity=".6"/></g>
    <path d="M-10 140 L30 70 L52 100 L84 44 L116 96 L140 64 L182 120 L210 96 L210 150 L-10 150Z" fill="#6a7f9e"/>
    <path d="M30 70 L40 88 L34 86 L28 94 L22 84Z M84 44 L98 68 L90 64 L84 74 L76 64 L70 68Z M140 64 L152 82 L144 80 L138 88 L130 80Z" fill="#f2f7ff"/>
    <path d="M-10 150 L20 112 L44 132 L70 104 L100 136 L128 110 L160 134 L190 108 L210 124 L210 156 L-10 156Z" fill="#4a5a74"/>
    <path d="M0 148 Q50 140 100 146 Q150 140 200 148 L200 200 L0 200Z" fill="#7d8796"/>
    <path d="M0 162 Q60 156 120 160 Q170 156 200 162 L200 200 L0 200Z" fill="#69737f"/>
    <path d="M20 172 L30 166 L40 172Z M150 180 L162 172 L172 180Z" fill="#596370"/>`,

  desert: () => `<defs>${sky('sk-desert', [[0, '#5a2a6a'], [0.45, '#e86a3a'], [0.75, '#ffc46b']])}
      <radialGradient id="sk-desert-sun" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#fff1a8"/><stop offset=".6" stop-color="#ffd36b" stop-opacity=".6"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="200" fill="url(#sk-desert)"/>
    <circle cx="100" cy="104" r="34" fill="url(#sk-desert-sun)"/>
    <path d="M120 140 L146 102 L172 140Z" fill="#b8642a"/><path d="M146 102 L172 140 L156 140Z" fill="#8a4418"/>
    <path d="M28 140 L46 114 L64 140Z" fill="#b8642a"/><path d="M46 114 L64 140 L54 140Z" fill="#8a4418"/>
    <path d="M-10 140 Q40 124 90 138 Q140 126 210 140 L210 154 L-10 154Z" fill="#d88a3a"/>
    <path d="M0 148 Q50 138 110 146 Q160 140 200 148 L200 200 L0 200Z" fill="#f0b45a"/>
    <path d="M0 168 Q60 160 120 166 Q170 162 200 168 L200 200 L0 200Z" fill="#e2a048"/>
    <g fill="#3f8a3a"><rect x="168" y="150" width="5" height="22" rx="2.5"/><rect x="161" y="156" width="4" height="10" rx="2"/><rect x="161" y="164" width="8" height="3"/><rect x="176" y="153" width="4" height="9" rx="2"/><rect x="172" y="160" width="8" height="3"/></g>
    <path d="M26 176 Q34 170 42 176 M130 186 Q140 180 150 186" stroke="#c98a3a" stroke-width="1.4" fill="none"/>`,

  glacier: () => `<defs>${sky('sk-glacier', [[0, '#081a34'], [0.6, '#24507e'], [0.82, '#7fb8e8']])}
      <linearGradient id="sk-aurora" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3affc8" stop-opacity="0"/><stop offset=".5" stop-color="#3affc8" stop-opacity=".55"/><stop offset="1" stop-color="#8a6aff" stop-opacity="0"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#sk-glacier)"/>
    <path class="sc-aurora" d="M-10 50 Q40 20 100 46 Q150 66 210 34 L210 52 Q150 82 100 62 Q40 38 -10 66Z" fill="url(#sk-aurora)"/>
    ${[[30, 20], [70, 34], [120, 14], [160, 28], [184, 50], [14, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#fff"/>`).join('')}
    <path d="M-10 142 L20 92 L36 116 L60 80 L86 124 L112 86 L136 118 L162 84 L190 126 L210 104 L210 150 L-10 150Z" fill="#bfe0f8"/>
    <path d="M20 92 L28 140 L36 116Z M60 80 L66 132 L86 124Z M112 86 L118 136 L136 118Z M162 84 L170 138 L190 126Z" fill="#8fc0e8"/>
    <path d="M0 148 Q50 140 100 146 Q150 140 200 148 L200 200 L0 200Z" fill="#eef6ff"/>
    <path d="M0 164 Q60 156 120 162 Q170 158 200 164 L200 200 L0 200Z" fill="#dbeaf8"/>
    <path d="M24 158 L28 146 L32 158Z M36 158 L38 150 L40 158Z M166 160 L171 144 L176 160Z" fill="#a8d4f5"/>
    ${motes(12, '#fff', 'sc-snow', 0, 150, 1)}`,

  volcano: () => `<defs>${sky('sk-volcano', [[0, '#1a0505'], [0.55, '#5a140c'], [0.8, '#c8401a']])}
      <linearGradient id="sk-lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ff5a1a"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#sk-volcano)"/>
    <ellipse class="sc-glow" cx="100" cy="64" rx="30" ry="20" fill="#ff6a1a" opacity=".35"/>
    <path d="M40 146 L84 70 L116 70 L160 146Z" fill="#2a0e0a"/>
    <path d="M84 70 Q100 62 116 70 L110 78 L104 74 L100 92 L96 76 L90 80Z" fill="url(#sk-lava)"/>
    <path d="M100 92 Q96 110 102 124 Q98 136 104 146" stroke="url(#sk-lava)" stroke-width="3" fill="none" opacity=".9"/>
    <path d="M-10 146 L18 112 L36 136 L56 120 L70 146Z M130 146 L150 118 L170 134 L190 108 L210 130 L210 150 L130 150Z" fill="#3a1410"/>
    <path d="M0 148 Q50 140 100 146 Q150 140 200 148 L200 200 L0 200Z" fill="#3a1a14"/>
    <path d="M-5 176 Q40 164 90 174 Q140 184 205 170" stroke="url(#sk-lava)" stroke-width="5" fill="none" class="sc-glow"/>
    <path d="M0 186 Q60 178 120 184 Q170 180 200 186 L200 200 L0 200Z" fill="#2a100c"/>
    ${motes(12, '#ffb02e', 'sc-ember', 40, 160, 0.9)}`,
};

/** Fondo del escenario. `fit` = cómo se recorta: 'map' (pantalla alta) o 'battle' (ancha). */
export function sceneSvg(theme: WorldTheme, fit: 'map' | 'battle'): string {
  return `<svg class="scene sc-${theme.scene}" viewBox="0 0 200 200" preserveAspectRatio="${fit === 'map' ? 'xMidYMid slice' : 'xMidYMax slice'}" aria-hidden="true">${SCENES[theme.scene]()}</svg>`;
}
