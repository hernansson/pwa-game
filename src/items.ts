// Catálogo de equipo del héroe. Cada pieza cambia cómo se ve y da un bonus.

import { Skin } from './art';

export type Slot = 'casco' | 'armadura' | 'capa';
export type Rarity = 'común' | 'rara' | 'épica' | 'legendaria';

export const SLOTS: { id: Slot; name: string; icon: string; stat: string }[] = [
  { id: 'casco', name: 'Casco', icon: '⛑️', stat: 'vida' },
  { id: 'armadura', name: 'Armadura', icon: '🛡️', stat: 'vida' },
  { id: 'capa', name: 'Capa', icon: '🧣', stat: 'oro' },
];

export const RARITIES: Rarity[] = ['común', 'rara', 'épica', 'legendaria'];
export const RARITY_COLORS: Record<Rarity, string> = {
  común: '#a7b0bd',
  rara: '#4f9dff',
  épica: '#b56bff',
  legendaria: '#ffc23d',
};
/** Bonus en % que da una pieza según su rareza. */
export const RARITY_BONUS: Record<Rarity, number> = { común: 5, rara: 12, épica: 25, legendaria: 45 };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  // Visual
  helm?: Skin['helm'];
  helmColor?: string;
  visor?: string;
  armor?: string;
  armorDark?: string;
  trim?: string;
  cape?: string;
  aura?: string | null;
}

export const ITEMS: Item[] = [
  // Cascos
  { id: 'casco_hierro', slot: 'casco', name: 'Casco de hierro', rarity: 'común', helm: 'knight', helmColor: '#8e99a8', visor: '#1b1f2a' },
  { id: 'yelmo_bosque', slot: 'casco', name: 'Yelmo del bosque', rarity: 'rara', helm: 'knight', helmColor: '#3f8a52', visor: '#0f2416' },
  { id: 'yelmo_azul', slot: 'casco', name: 'Yelmo azur', rarity: 'rara', helm: 'knight', helmColor: '#4a78c9', visor: '#0d1a33' },
  { id: 'kabuto_carmesi', slot: 'casco', name: 'Kabuto carmesí', rarity: 'épica', helm: 'kabuto', helmColor: '#b3263a', visor: '#0e0a0c' },
  { id: 'kabuto_sombra', slot: 'casco', name: 'Kabuto de sombra', rarity: 'épica', helm: 'kabuto', helmColor: '#2a2a3a', visor: '#9b4dff' },
  { id: 'visor_neon', slot: 'casco', name: 'Visor neón', rarity: 'legendaria', helm: 'cyber', helmColor: '#1e2236', visor: '#29f0ff' },
  { id: 'corona_solar', slot: 'casco', name: 'Yelmo solar', rarity: 'legendaria', helm: 'kabuto', helmColor: '#f2c641', visor: '#5a3a00' },
  // Armaduras
  { id: 'cota_hierro', slot: 'armadura', name: 'Cota de hierro', rarity: 'común', armor: '#8e99a8', armorDark: '#5d6776', trim: '#d9b45a' },
  { id: 'coraza_bosque', slot: 'armadura', name: 'Coraza del bosque', rarity: 'rara', armor: '#3f8a52', armorDark: '#24533a', trim: '#d9c65a' },
  { id: 'coraza_azul', slot: 'armadura', name: 'Coraza azur', rarity: 'rara', armor: '#4a78c9', armorDark: '#2b4a85', trim: '#e8e8f0' },
  { id: 'armadura_carmesi', slot: 'armadura', name: 'Armadura carmesí', rarity: 'épica', armor: '#b3263a', armorDark: '#6e1322', trim: '#f0c24b' },
  { id: 'armadura_sombra', slot: 'armadura', name: 'Armadura de sombra', rarity: 'épica', armor: '#2a2a3a', armorDark: '#15151f', trim: '#9b4dff' },
  { id: 'traje_neon', slot: 'armadura', name: 'Traje neón', rarity: 'legendaria', armor: '#1e2236', armorDark: '#11131f', trim: '#29f0ff' },
  { id: 'armadura_solar', slot: 'armadura', name: 'Armadura solar', rarity: 'legendaria', armor: '#f2c641', armorDark: '#a8781a', trim: '#fff4c2' },
  // Capas
  { id: 'capa_azul', slot: 'capa', name: 'Capa azul', rarity: 'común', cape: '#3557a8', aura: null },
  { id: 'capa_verde', slot: 'capa', name: 'Capa verde', rarity: 'común', cape: '#2f7a45', aura: null },
  { id: 'capa_purpura', slot: 'capa', name: 'Capa púrpura', rarity: 'rara', cape: '#6b3fa8', aura: null },
  { id: 'capa_negra', slot: 'capa', name: 'Capa del ronin', rarity: 'épica', cape: '#24151c', aura: '#ff5a6e' },
  { id: 'capa_neon', slot: 'capa', name: 'Capa neón', rarity: 'legendaria', cape: '#ff2fb4', aura: '#29f0ff' },
  { id: 'capa_solar', slot: 'capa', name: 'Manto solar', rarity: 'legendaria', cape: '#ff9a2f', aura: '#ffd75a' },
];

export const STARTER: Record<Slot, string> = {
  casco: 'casco_hierro',
  armadura: 'cota_hierro',
  capa: 'capa_azul',
};

/** Las skins de la primera versión se convierten en conjuntos de piezas. */
export const LEGACY_SETS: Record<string, string[]> = {
  samurai: ['kabuto_carmesi', 'armadura_carmesi', 'capa_negra'],
  cyber: ['visor_neon', 'traje_neon', 'capa_neon'],
};

/** Espadas de la versión anterior: se convierten en fragmentos del Arsenal. */
export const OLD_WEAPONS: Record<string, Rarity> = {
  espada_hierro: 'común', espada_bronce: 'común', espada_plata: 'rara', espada_esmeralda: 'rara',
  espada_rubi: 'épica', espada_amatista: 'épica', espada_obsidiana: 'legendaria', espada_celestial: 'legendaria',
};

export const CHEST_GEMS = 40;
export const LEVELS_PER_WORLD_ITEMS = 10; // cada 10 niveles hay un jefe de mundo

export function itemById(id: string | undefined): Item {
  return ITEMS.find((i) => i.id === id) ?? ITEMS[0];
}

export function slotItem(id: string | undefined, slot: Slot): Item {
  const it = ITEMS.find((i) => i.id === id && i.slot === slot);
  return it ?? itemById(STARTER[slot]);
}

export function bonusOf(item: Item): number {
  return RARITY_BONUS[item.rarity] / 100;
}

export function statText(item: Item): string {
  const stat = SLOTS.find((s) => s.id === item.slot)!.stat;
  return `+${RARITY_BONUS[item.rarity]}% de ${stat}`;
}

/** Valor en oro si sale repetida. */
export function duplicateGold(item: Item, level: number): number {
  return Math.ceil(30 * (RARITIES.indexOf(item.rarity) + 1) * Math.pow(1.33, level - 1));
}

/** Arma una apariencia completa a partir del equipo puesto. */
export function lookFor(equipped: Record<Slot, string>): Skin {
  const h = slotItem(equipped.casco, 'casco');
  const a = slotItem(equipped.armadura, 'armadura');
  const c = slotItem(equipped.capa, 'capa');
  return {
    id: 'equipo',
    name: 'Equipo',
    rarity: 'común',
    price: 0,
    armor: a.armor!,
    armorDark: a.armorDark!,
    trim: a.trim!,
    cape: c.cape!,
    visor: h.visor!,
    aura: c.aura ?? null,
    helm: h.helm!,
    helmColor: h.helmColor,
  };
}


/**
 * Elige una pieza al azar. `luck` sube las probabilidades de rarezas altas
 * (los niveles avanzados y los cofres pagos tienen más suerte).
 */
export function rollItem(luck: number, minRarity: Rarity = 'común', owned: string[] = [], rand = Math.random): Item {
  const base = [60, 28, 10, 2];
  const weights = base.map((w, i) => (i < RARITIES.indexOf(minRarity) ? 0 : w * Math.pow(1 + luck, i)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  let rarity: Rarity = minRarity;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      rarity = RARITIES[i];
      break;
    }
  }
  // Prefiere piezas que todavía no tiene, para que cada premio se sienta nuevo.
  const all = ITEMS.filter((i) => i.rarity === rarity);
  const fresh = all.filter((i) => !owned.includes(i.id));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(rand() * pool.length)];
}
