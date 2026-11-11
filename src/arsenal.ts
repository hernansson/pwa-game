// Arsenal: variantes de cada familia del tablero. Se desbloquean y suben de nivel con fragmentos.

import { Family } from './board';

/** Lo que se puede equipar: tres familias del tablero y la skin del héroe. Las pociones no tienen variantes por ahora. */
export type ArmFam = Exclude<Family, 'pocion'> | 'skin';
export const ARM_FAMS: ArmFam[] = ['espada', 'escudo', 'rayo', 'skin'];
import { Rarity } from './items';

/** Modificadores que dan el nivel y las habilidades de lo que tienes equipado. */
export interface Mods {
  dmg: number; // % de daño extra
  crit: number; // probabilidad de crítico extra
  critMult: number; // multiplicador de crítico extra
  shield: number; // % de escudo extra por fusión
  reduce: number; // % menos daño recibido
  startShield: number; // escudo inicial, en fracción de la vida máxima
  heal: number; // % de curación extra
  boostSec: number; // segundos extra del potenciador
  boostMult: number; // % de potencia extra del potenciador
  combo: number; // segundos extra para mantener el combo
  hp: number; // % de vida extra
}

export const NO_MODS: Mods = { dmg: 0, crit: 0, critMult: 0, shield: 0, reduce: 0, startShield: 0, heal: 0, boostSec: 0, boostMult: 0, combo: 0, hp: 0 };

export interface Skill {
  at: number;
  text: string;
  mod: Partial<Mods>;
}

export interface ArmDef {
  id: string;
  fam: ArmFam;
  name: string;
  rarity: Rarity;
  shape: number; // 0, 1 o 2: el diseño de la pieza
  skin?: string; // para las skins: qué apariencia usa
  skills: Skill[];
}

/** Niveles en los que se desbloquean habilidades. Después solo sube el stat. */
export const SKILL_LEVELS = [5, 10, 20, 40];
export const MAX_ARM_LEVEL = 100;

/**
 * Lo que sube cada nivel, por familia. Están emparejados para que subir 10 niveles cualquier familia
 * rinda parecido con el equipo completo puesto (medido con tools/verify.ts, ver BALANCE.md).
 * El escudo y el rayo llevan un segundo stat porque solos valen muy poco.
 */
export interface LevelGain { key: keyof Mods; per: number; label: string }
export const LEVEL_STAT: Record<ArmFam, LevelGain[]> = {
  espada: [{ key: 'dmg', per: 0.025, label: 'daño' }],
  escudo: [{ key: 'shield', per: 0.0125, label: 'escudo' }, { key: 'hp', per: 0.0035, label: 'vida' }],
  rayo: [{ key: 'boostMult', per: 0.03, label: 'potencia' }, { key: 'dmg', per: 0.02, label: 'daño' }],
  skin: [{ key: 'hp', per: 0.0055, label: 'vida' }],
};

const pctText = (v: number) => `+${(Math.round(v * 10000) / 100).toString().replace('.', ',')}%`;
const join = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]);

/** "+3% de daño", "+4% de escudo y +1,2% de vida": lo que suma cada nivel. */
export function levelGainText(fam: ArmFam): string {
  return join(LEVEL_STAT[fam].map((g) => `${pctText(g.per)} de ${g.label}`));
}

const s = (at: number, text: string, mod: Partial<Mods>): Skill => ({ at, text, mod });

// Cada rareza vale un poco más que la anterior (rara ~+15–25% de poder con el equipo puesto, épica ~+30–40%),
// pero sobre todo cambia el estilo. tools/report.ts muestra cuánto vale cada una; ver BALANCE.md.
export const ARMS: ArmDef[] = [
  // Espadas
  { id: 'espada_recta', fam: 'espada', name: 'Espada recta', rarity: 'común', shape: 0, skills: [
    s(5, '+5% de crítico', { crit: 0.05 }),
    s(10, '+7% de daño', { dmg: 0.07 }),
    s(20, 'Los críticos pegan x2,5 y +10% de daño', { critMult: 0.5, dmg: 0.1 }),
    s(40, '+13% de daño', { dmg: 0.13 }),
  ] },
  { id: 'cimitarra', fam: 'espada', name: 'Cimitarra', rarity: 'rara', shape: 1, skills: [
    s(5, '+0,2 s para mantener el combo', { combo: 0.2 }),
    s(10, '+9% de crítico', { crit: 0.09 }),
    s(20, '+13% de daño', { dmg: 0.13 }),
    s(40, '+0,5 s para mantener el combo', { combo: 0.5 }),
  ] },
  { id: 'mandoble', fam: 'espada', name: 'Mandoble', rarity: 'épica', shape: 2, skills: [
    s(5, '+7% de daño', { dmg: 0.07 }),
    s(10, 'Los críticos pegan x2,5 y +9% de daño', { critMult: 0.5, dmg: 0.09 }),
    s(20, '+0,3 s para mantener el combo y +8% de daño', { combo: 0.3, dmg: 0.08 }),
    s(40, '+10% de crítico y los críticos pegan x3', { crit: 0.1, critMult: 0.5 }),
  ] },
  // Escudos
  { id: 'escudo_redondo', fam: 'escudo', name: 'Rodela', rarity: 'común', shape: 0, skills: [
    s(5, 'Empiezas el nivel con escudo (10% de la vida)', { startShield: 0.1 }),
    s(10, '-5% de daño recibido', { reduce: 0.05 }),
    s(20, '+33% de escudo', { shield: 0.33 }),
    s(40, 'Empiezas con más escudo (25% de la vida) y +15% de escudo', { startShield: 0.15, shield: 0.15 }),
  ] },
  { id: 'escudo_cometa', fam: 'escudo', name: 'Escudo cometa', rarity: 'rara', shape: 1, skills: [
    s(5, '-4% de daño recibido', { reduce: 0.04 }),
    s(10, '+27% de escudo', { shield: 0.27 }),
    s(20, '-8% de daño recibido', { reduce: 0.08 }),
    s(40, '+50% de escudo', { shield: 0.5 }),
  ] },
  { id: 'paves', fam: 'escudo', name: 'Pavés', rarity: 'épica', shape: 2, skills: [
    s(5, 'Empiezas el nivel con escudo (15% de la vida)', { startShield: 0.15 }),
    s(10, '-6% de daño recibido', { reduce: 0.06 }),
    s(20, '+20% de escudo y empiezas con más (20% de la vida)', { shield: 0.2, startShield: 0.05 }),
    s(40, '-8% de daño recibido', { reduce: 0.08 }),
  ] },
  // Rayos
  { id: 'chispa', fam: 'rayo', name: 'Chispa', rarity: 'común', shape: 0, skills: [
    s(5, 'El potenciador dura +1 s', { boostSec: 1 }),
    s(10, '+50% de potencia', { boostMult: 0.5 }),
    s(20, 'El potenciador dura +1 s y +40% de potencia', { boostSec: 1, boostMult: 0.4 }),
    s(40, '+100% de potencia', { boostMult: 1 }),
  ] },
  { id: 'doble_rayo', fam: 'rayo', name: 'Rayo doble', rarity: 'rara', shape: 1, skills: [
    s(5, '+45% de potencia y +5% de daño', { boostMult: 0.45, dmg: 0.05 }),
    s(10, 'El potenciador dura +1 s y +30% de potencia', { boostSec: 1, boostMult: 0.3 }),
    s(20, '+100% de potencia y +8% de daño', { boostMult: 1, dmg: 0.08 }),
    s(40, 'El potenciador dura +1 s y +90% de potencia', { boostSec: 1, boostMult: 0.9 }),
  ] },
  { id: 'tormenta', fam: 'rayo', name: 'Tormenta', rarity: 'épica', shape: 2, skills: [
    s(5, 'El potenciador dura +1 s y +15% de potencia', { boostSec: 1, boostMult: 0.15 }),
    s(10, '+75% de potencia', { boostMult: 0.75 }),
    s(20, '+5% de crítico y +85% de potencia', { crit: 0.05, boostMult: 0.85 }),
    s(40, '+150% de potencia', { boostMult: 1.5 }),
  ] },
  // Skins del héroe
  { id: 'caballero', fam: 'skin', name: 'Caballero', rarity: 'común', shape: 0, skin: 'caballero', skills: [
    s(5, '+4% de vida', { hp: 0.04 }),
    s(10, 'Empiezas el nivel con escudo (13% de la vida)', { startShield: 0.13 }),
    s(20, '+8% de vida', { hp: 0.08 }),
    s(40, '-5% de daño recibido y +4% de vida', { reduce: 0.05, hp: 0.04 }),
  ] },
  { id: 'samurai', fam: 'skin', name: 'Samurái Carmesí', rarity: 'rara', shape: 1, skin: 'samurai', skills: [
    s(5, '+6% de daño y +4% de vida', { dmg: 0.06, hp: 0.04 }),
    s(10, '+5% de crítico y +6% de vida', { crit: 0.05, hp: 0.06 }),
    s(20, '+8% de crítico', { crit: 0.08 }),
    s(40, 'Los críticos pegan x2,5 y +0,3 s para mantener el combo', { critMult: 0.5, combo: 0.3 }),
  ] },
  { id: 'cyber', fam: 'skin', name: 'Ronin Neón', rarity: 'épica', shape: 2, skin: 'cyber', skills: [
    s(5, 'El potenciador dura +1 s y +2% de daño', { boostSec: 1, dmg: 0.02 }),
    s(10, '+10% de daño y +6% de vida', { dmg: 0.1, hp: 0.06 }),
    s(20, '+0,5 s para mantener el combo', { combo: 0.5 }),
    s(40, '+60% de potencia y +12% de daño', { boostMult: 0.6, dmg: 0.12 }),
  ] },
];

/** Cofres de la tienda. */
export interface ChestDef {
  id: string;
  name: string;
  desc: string;
  fams: ArmFam[];
  gems: number;
  shards: number;
  icon: string;
}

export const CHESTS: ChestDef[] = [
  { id: 'armas', name: 'Cofre de armas', desc: 'Fragmentos de espadas y escudos', fams: ['espada', 'escudo'], gems: 40, shards: 30, icon: '⚔️' },
  { id: 'skins', name: 'Cofre de skins', desc: 'Fragmentos de skins del héroe', fams: ['skin'], gems: 60, shards: 20, icon: '🎭' },
  { id: 'poder', name: 'Cofre de potenciadores', desc: 'Fragmentos de rayos', fams: ['rayo'], gems: 30, shards: 25, icon: '⚡' },
];
export const FREE_CHEST_HOURS = 4;

export const STARTER_ARMS: Record<ArmFam, string> = { espada: 'espada_recta', escudo: 'escudo_redondo', rayo: 'chispa', skin: 'caballero' };

export function armById(id: string | undefined): ArmDef | undefined {
  return ARMS.find((a) => a.id === id);
}

/** Fragmentos para desbloquear según la rareza. */
export function unlockShards(r: Rarity): number {
  return { común: 10, rara: 20, épica: 40, legendaria: 80 }[r];
}

/** Costo para pasar de `lvl` a `lvl + 1`. */
export function upgradeShards(lvl: number): number {
  return Math.ceil(2 + lvl * 0.5);
}
export function upgradeGold(lvl: number): number {
  return Math.ceil(15 * Math.pow(1.09, lvl));
}

/**
 * Contra el power creep: una variante más rara arranca como si fuera una básica de más nivel,
 * pero todas suben lo mismo por nivel. Así una avanzada nueva nunca supera a una básica muy trabajada:
 * una épica nivel 1 equivale a una básica nivel 16, y una básica nivel 40 le gana hasta que la épica llega al 25.
 * Las habilidades de cada rareza son distintas (otro estilo), no simplemente más fuertes.
 */
export const RARITY_LEVEL_BONUS: Record<Rarity, number> = { común: 0, rara: 7, épica: 15, legendaria: 25 };

/** Cuántos "niveles de stat" tiene una variante: su nivel más el arranque por rareza. */
export function armStatLevels(def: ArmDef, lvl: number): number {
  return lvl <= 0 ? 0 : lvl - 1 + RARITY_LEVEL_BONUS[def.rarity];
}

/** Lo que suman los niveles de una variante, en texto: "+45% de escudo y +13,2% de vida". */
export function armStatText(def: ArmDef, lvl: number): string {
  const n = armStatLevels(def, lvl);
  return join(LEVEL_STAT[def.fam].map((g) => `${pctText(g.per * n)} de ${g.label}`));
}

/** Suma los modificadores de una variante a cierto nivel. */
export function armMods(def: ArmDef, lvl: number, into: Mods = { ...NO_MODS }): Mods {
  if (lvl <= 0) return into;
  for (const g of LEVEL_STAT[def.fam]) into[g.key] += g.per * armStatLevels(def, lvl);
  for (const sk of def.skills) if (lvl >= sk.at) for (const k in sk.mod) into[k as keyof Mods] += sk.mod[k as keyof Mods]!;
  return into;
}

/** Peso de cada rareza al repartir fragmentos. */
export const SHARD_WEIGHT: Record<Rarity, number> = { común: 50, rara: 35, épica: 15, legendaria: 5 };

/** Reparte `total` fragmentos entre 2 o 3 variantes al azar de esas familias. */
export function rollShards(total: number, fams: ArmFam[] = ['espada', 'escudo', 'rayo'], rand = Math.random): Record<string, number> {
  const out: Record<string, number> = {};
  const pool = ARMS.filter((a) => fams.includes(a.fam));
  const parts = total >= 12 ? 3 : 2;
  let left = total;
  for (let i = 0; i < parts; i++) {
    // Cada parte va a una variante distinta mientras haya de dónde elegir.
    const avail = pool.filter((d) => !(d.id in out));
    const from = avail.length ? avail : pool;
    let r = rand() * from.reduce((a, d) => a + SHARD_WEIGHT[d.rarity], 0);
    let pick = from[0];
    for (const d of from) {
      r -= SHARD_WEIGHT[d.rarity];
      if (r <= 0) {
        pick = d;
        break;
      }
    }
    const n = i === parts - 1 ? left : Math.max(1, Math.round(total / parts));
    out[pick.id] = (out[pick.id] ?? 0) + n;
    left -= n;
    if (left <= 0) break;
  }
  return out;
}
