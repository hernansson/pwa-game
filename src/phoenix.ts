// Fénix heráldico: alas grandes levantadas en V con borde de plumas en punta (como llamas), cuello largo en S,
// cabeza chica de ave rapaz con penacho que flamea hacia atrás, y cola de plumas largas de fuego.
// Lo usan el escudo y la skin del Fénix en sus formas altas.

const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (x: number, y: number) => `${r1(x)} ${r1(y)}`;

export interface WingOpts {
  /** Largo del ala desde el hombro hasta la punta. */
  len: number;
  /** Ángulo de la punta (grados, 0 = derecha, 270 = arriba) y de la última pluma de abajo. */
  tip: number;
  low: number;
  /** Cantidad de plumas del borde. */
  n: number;
  /** Colores de las capas: de atrás (la más grande, oscura) hacia adelante (chica, clara). */
  layers: string[];
  stroke: string;
}

/** Contorno de un ala izquierda con el hombro en (0,0) y el borde de atrás hecho de plumas en punta. */
function wingPath(len: number, tip: number, low: number, n: number): string {
  const P: [number, number][] = [];
  const V: [number, number][] = [];
  const rad = (t: number) => len * (1 - 0.55 * Math.pow(t, 2.2));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = ((tip + (low - tip) * t) * Math.PI) / 180;
    P.push([Math.cos(a) * rad(t), Math.sin(a) * rad(t)]);
    if (i < n - 1) {
      const t2 = t + 0.5 / (n - 1);
      const a2 = ((tip + (low - tip) * t2) * Math.PI) / 180;
      V.push([Math.cos(a2) * rad(t2) * 0.58, Math.sin(a2) * rad(t2) * 0.58]);
    }
  }
  const ta = (tip * Math.PI) / 180;
  // Borde de adelante: sube como un brazo arqueado hasta la punta.
  const lead = pt(Math.cos(ta + 0.5) * len * 0.62, Math.sin(ta + 0.5) * len * 0.62);
  let d = `M0 0 Q${lead} ${pt(...P[0])}`;
  for (let i = 0; i < n - 1; i++) {
    // Cada pluma termina en una punta curvada, como una lengua de fuego.
    const [px, py] = P[i];
    const [vx, vy] = V[i];
    const [nx, ny] = P[i + 1];
    d += ` Q${pt(px * 0.75 + vx * 0.25 + 1, py * 0.75 + vy * 0.25 + 3.5)} ${pt(vx, vy)} Q${pt(vx * 0.45 + nx * 0.55 - 3, vy * 0.45 + ny * 0.55 - 1)} ${pt(nx, ny)}`;
  }
  const [lx, ly] = P[n - 1];
  d += ` Q${pt(lx * 0.4, ly * 0.4 + 3)} 0 0Z`;
  return d;
}

/** Ala izquierda completa con capas de plumas y nervaduras. */
export function featherWing(o: WingOpts): string {
  let out = '';
  o.layers.forEach((fill, k) => {
    const s = 1 - k * (0.5 / Math.max(1, o.layers.length - 1));
    const d = wingPath(o.len * s, o.tip + k * 6, o.low - k * 4, Math.max(4, o.n - k));
    out += `<path${k === o.layers.length - 1 ? ' class="fx-fl f2"' : ''} d="${d}" fill="${fill}"${k === 0 ? ` stroke="${o.stroke}" stroke-width="1" stroke-linejoin="round"` : ''}/>`;
  });
  // Nervaduras de las plumas grandes.
  let ribs = '';
  for (let i = 0; i < o.n - 1; i++) {
    const t = i / (o.n - 1);
    const a = ((o.tip + (o.low - o.tip) * t) * Math.PI) / 180;
    const r = o.len * (1 - 0.55 * Math.pow(t, 2.2)) * 0.9;
    ribs += `M${pt(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55)} L${pt(Math.cos(a) * r, Math.sin(a) * r)} `;
  }
  out += `<path d="${ribs}" stroke="${o.stroke}" stroke-width=".7" opacity=".4" fill="none" stroke-linecap="round"/>`;
  return out;
}

export interface BirdOpts {
  layers: string[];
  stroke: string;
  /** Degradado del cuerpo (abajo → arriba). */
  body: [string, string];
  beak: string;
  eye: string;
  wing: { len: number; tip: number; low: number; n: number };
  /** Un segundo par de alas detrás, más altas y largas (forma celestial). */
  wing2?: { len: number; tip: number; low: number; n: number; layers: string[] };
  tail: { n: number; len: number; spread: number; star?: string };
  crown?: string;
  halo?: string;
  /** Sin cuerpo (cuando el escudo lo tapa). */
  noBody?: boolean;
  id: string;
}

/** Cabeza chica de perfil mirando a la derecha en (0,0): pico ganchudo, ojo fiero y penacho de llamas largo. */
export function phoenixHead(o: BirdOpts): string {
  const light = o.layers[o.layers.length - 1];
  const crest = [
    ['M-3 -3 Q-12 -8 -20 -4 Q-14 -6 -10 -2 Q-16 -1 -21 4 Q-11 1 -4 1Z', o.layers[0]],
    ['M-2 -4 Q-9 -12 -18 -13 Q-11 -10 -8 -6 Q-13 -7 -17 -5 Q-9 -3 -3 -1Z', o.layers[1] ?? o.layers[0]],
    ['M-1 -5 Q-4 -13 -11 -17 Q-6 -11 -5 -7 Q-8 -9 -11 -9 Q-5 -5 -1 -2Z', light],
  ];
  return `<g class="pb-crest">${crest.map(([d, f], i) => `<path class="fx-fl f${i + 1}" d="${d}" fill="${f}" stroke="${o.stroke}" stroke-width=".6" stroke-linejoin="round"/>`).join('')}</g>
    <path d="M-4.5 3.5 Q-5.5 -3.5 -0.5 -5.2 Q4 -6 6.2 -2.8 Q7 -0.6 5.6 1.6 Q3.6 5 -0.6 5.4 Q-3.4 5.4 -4.5 3.5Z" fill="url(#${o.id}B)" stroke="${o.stroke}" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M5.4 -3 Q10 -3.2 12 0.6 Q12.3 2.3 11 3 Q10.4 1.4 9 1.2 Q7.4 1.3 5.8 2Z" fill="${o.beak}" stroke="${o.stroke}" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M0.8 -2.4 Q3 -3.4 5 -1.8 Q3 -0.4 0.8 -2.4Z" fill="${o.eye}" stroke="${o.stroke}" stroke-width=".5"/>
    <circle cx="3.2" cy="-2.1" r=".7" fill="${o.stroke}"/>
    <path d="M0.2 -3.5 Q3 -5 5.6 -3.2" stroke="${o.stroke}" stroke-width=".9" fill="none" stroke-linecap="round"/>
    ${o.crown ? `<path d="M-3.2 -5 L-2.8 -10 L-0.4 -7 L1.4 -11.5 L3.2 -7 L5.4 -10 L5.6 -5 Q1.2 -6.6 -3.2 -5Z" fill="${o.crown}" stroke="${o.stroke}" stroke-width=".6" stroke-linejoin="round"/><circle cx="1.4" cy="-8.4" r=".9" fill="#2ad8ff"/>` : ''}`;
}

/** Fénix completo con el pecho en (0,0). Con alas de 30 mide unas 64 unidades de punta a punta. */
export function phoenixBird(o: BirdOpts): string {
  const pair = (w: { len: number; tip: number; low: number; n: number }, layers: string[], cls: string) => {
    const left = featherWing({ ...w, layers, stroke: o.stroke });
    return `<g transform="translate(-3 -5)"><g class="pb-wing ${cls}">${left}</g></g><g transform="translate(3 -5) scale(-1 1)"><g class="pb-wing ${cls}">${left}</g></g>`;
  };
  const light = o.layers[o.layers.length - 1];
  // Cola: plumas largas de fuego que caen y se curvan hacia afuera.
  let tail = '';
  const { n, len, spread, star } = o.tail;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const l = len * (1 - Math.abs(t) * 0.35);
    const ex = t * spread;
    const ey = 8 + l;
    const cx1 = t * spread * 0.2;
    const curl = t === 0 ? 0 : Math.sign(t) * 7;
    const w = 4 - Math.abs(t) * 2;
    const d = `M${pt(-w, 8)} Q${pt(cx1 - w * 1.4, 8 + l * 0.55)} ${pt(ex + curl, ey)} Q${pt(ex - curl * 0.4, ey - 4)} ${pt(ex - curl * 0.2 + t * 2, ey - 6)} Q${pt(cx1 + w * 1.4, 8 + l * 0.5)} ${pt(w, 8)}Z`;
    tail += `<path class="fx-fl f${(i % 3) + 1}" d="${d}" fill="${i % 2 ? light : o.layers[1] ?? o.layers[0]}" stroke="${o.stroke}" stroke-width=".7" stroke-linejoin="round"/>`;
    if (star) tail += `<path d="M${pt(ex + curl, ey - 2.4)} l1 2.4 l2.4 1 l-2.4 1 l-1 2.4 l-1 -2.4 l-2.4 -1 l2.4 -1z" fill="${star}"/>`;
  }
  const body = o.noBody
    ? ''
    : `<path d="M0 -10 Q6 -6 5.6 2 Q5 9 0 13 Q-5 9 -5.6 2 Q-6 -6 0 -10Z" fill="url(#${o.id}B)" stroke="${o.stroke}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M0 -4 Q2.4 0 2 5 Q1 8 0 9.5 Q-1 8 -2 5 Q-2.4 0 0 -4Z" fill="${light}" opacity=".85"/>`;
  // Cuello largo en S que lleva la cabeza arriba y un poco a la derecha.
  const neck = `<path d="M-3.6 -7 Q-5.6 -13 -2.4 -17 Q0 -20 -0.6 -23 L3.8 -23.6 Q5.4 -19 2.6 -15.6 Q0.6 -12.6 3.6 -7Z" fill="url(#${o.id}B)" stroke="${o.stroke}" stroke-width=".9" stroke-linejoin="round"/>`;
  return `<defs><linearGradient id="${o.id}B" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${o.body[0]}"/><stop offset="1" stop-color="${o.body[1]}"/></linearGradient></defs>
    ${o.halo ? `<g class="pb-halo"><circle cx="2" cy="-27" r="9" fill="none" stroke="${o.halo}" stroke-width="1.3" opacity=".9"/><circle cx="2" cy="-27" r="12" fill="none" stroke="${o.halo}" stroke-width=".6" stroke-dasharray="1.5 3" opacity=".8"/></g>` : ''}
    ${o.wing2 ? pair(o.wing2, o.wing2.layers, 'w2') : ''}
    <g class="pb-tail">${tail}</g>
    ${pair(o.wing, o.layers, 'w1')}
    ${body}${neck}
    <g transform="translate(1.6 -25.5) scale(.82)">${phoenixHead(o)}</g>`;
}

/** Paletas del fénix: fuego (forma 20) y celestial (forma 40). */
export const FIRE_BIRD = {
  layers: ['#d42a0c', '#ff6a1a', '#ffaa2a', '#ffe27a'],
  stroke: '#5a0e04',
  body: ['#ff5a1f', '#ffd34d'] as [string, string],
  beak: '#ffd700',
  eye: '#fff6c8',
};
export const STAR_BIRD = {
  layers: ['#1f45d8', '#3a9bff', '#8fe4ff', '#f0fcff'],
  stroke: '#0b1450',
  body: ['#3a7bff', '#e8fbff'] as [string, string],
  beak: '#ffd700',
  eye: '#ffffff',
};
