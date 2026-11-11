// Todas las fórmulas de equilibrio en un solo lugar, para poder ajustarlas fácil.

export const WAVES_PER_LEVEL = 3;
export const ENEMIES_PER_WAVE = 3;
export const LEVELS_PER_WORLD = 10;
export const ENERGY_MAX = 30;
export const ENERGY_COST = 5;
export const ENERGY_REGEN_SECONDS = 5 * 60; // 1 de energía cada 5 minutos
export const BASE_DAMAGE = 7;

/** Las piezas de los mundos avanzados pegan más fuerte. */
export function levelPower(level: number): number {
  return Math.pow(1.2, level - 1);
}

/** Los primeros niveles son más suaves, para aprender a jugar. */
function earlyEase(level: number): number {
  return Math.min(1, 0.55 + 0.15 * (level - 1));
}

/**
 * Crecimiento por nivel. Hasta el nivel LATE.from los enemigos crecen rápido (el enganche inicial);
 * después crecen más despacio para que el avance siga siendo constante en mundos lejanos.
 */
export const LATE = { from: 30, hp: 1.24, hit: 1.13, gold: 1.24 };
function grow(level: number, early: number, late: number): number {
  const a = Math.min(level, LATE.from) - 1;
  const b = Math.max(0, level - LATE.from);
  return Math.pow(early, a) * Math.pow(late, b);
}

export function enemyHp(level: number, boss: boolean): number {
  const base = 140 * grow(level, 1.33, LATE.hp) * earlyEase(level);
  return boss ? base * 4 : base;
}

/** Daño de cada golpe del enemigo. */
export function enemyHit(level: number, boss: boolean): number {
  const base = 14 * grow(level, 1.21, LATE.hit) * earlyEase(level);
  return boss ? base * 1.6 : base;
}

/** Segundos entre golpes del enemigo. */
export function enemyAttackSeconds(boss: boolean): number {
  return boss ? 2.4 : 2.8;
}

export function enemyGold(level: number, boss: boolean): number {
  const base = 3 * grow(level, 1.33, LATE.gold);
  return boss ? base * 10 : base;
}

/** Fuerza de una fusión según el nivel que resulta y cuántas piezas juntó. */
export function pieceValue(lvl: number, size: number): number {
  return Math.pow(2, lvl - 2) * (1 + 0.5 * (size - 2));
}

/**
 * El potenciador de un rayo siempre dura lo mismo: alcanza para 3 o 4 fusiones
 * (un jugador tarda entre 0,5 y 0,8 s por fusión). El nivel solo sube cuánto multiplica.
 */
export const BOOST_SECONDS = 2.5;
export function boostSeconds(_lvl: number): number {
  return BOOST_SECONDS;
}

/** Cuánto multiplica el daño el potenciador: x1,3 en nivel 2, x3,4 en nivel 9, x4 en nivel 10. */
export function boostMultiplier(lvl: number): number {
  return 1 + 0.3 * (lvl - 1);
}

/** Bonus de daño de la mejor espada armada en el nivel: +10% por nivel. */
export function swordBonus(lvl = 1): number {
  return 1 + 0.1 * (lvl - 1);
}

/** El mejor escudo armado en el nivel reduce cada golpe del enemigo: 5% por nivel (45% en nivel 10). */
export function shieldReduction(lvl = 1): number {
  return 0.05 * (lvl - 1);
}

/** Segundos que tienes entre fusiones para no perder el combo. */
export const COMBO_WINDOW = 2.5;

/** Probabilidad base de crítico; el talento Crítico suma 0,5% por nivel. */
export const BASE_CRIT = 0.05;

/**
 * Topes de los stats en porcentaje. Daño, vida, escudo y potencia no tienen tope porque los
 * enemigos crecen sin parar; lo que se expresa como probabilidad, tiempo o reducción sí,
 * para que nadie llegue a 100% de crítico o a no recibir daño.
 */
export const CAPS = {
  crit: 0.5, // probabilidad de crítico total
  critMult: 1, // golpe crítico máximo x3
  reduce: 0.6, // daño recibido: como mucho -60% sumando escudo fusionado y Arsenal
  combo: 1.5, // tiempo extra de combo: hasta 4 s
  boostSec: 2, // duración extra del potenciador: hasta 4,5 s
  startShield: 0.4, // escudo al empezar: hasta 40% de la vida
};

/** Probabilidad de que una pieza nueva llegue ya en nivel 2 sin el pase (siempre 0). */
export const LEVEL_TWO_CHANCE = 0;

/** Pase mensual: dura 30 días y hace que parte de las piezas nuevas lleguen en nivel 2 o 3. */
export const PASS = { days: 30, lvl2: 0.3, lvl3: 0.1 };

export function firstClearGems(level: number): number {
  return level % LEVELS_PER_WORLD === 0 ? 30 : 5;
}

export function leaguePointsForClear(level: number, stars: number): number {
  return Math.round((50 + level * 15) * (0.5 + stars * 0.25));
}

export function starsFor(hpLeftRatio: number): number {
  if (hpLeftRatio >= 0.6) return 3;
  if (hpLeftRatio >= 0.3) return 2;
  return 1;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: (lvl: number) => string;
  baseCost: number;
  growth: number;
  max: number;
  icon: string;
}

export type UpgradeId = 'fuerza' | 'vida' | 'critico';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'fuerza',
    name: 'Fuerza',
    desc: (l) => `+15% de daño por nivel (ahora +${l * 15}%)`,
    baseCost: 15,
    growth: 1.5,
    max: 999,
    icon: '💪',
  },
  {
    id: 'vida',
    name: 'Vida',
    desc: (l) => `Vida máxima ${Math.round(heroMaxHp(l))}`,
    baseCost: 15,
    growth: 1.5,
    max: 999,
    icon: '❤️',
  },
  {
    id: 'critico',
    name: 'Crítico',
    desc: (l) => `+0,5% de probabilidad de crítico por nivel, hasta +10% (ahora +${(l * 0.5).toString().replace('.', ',')}%)`,
    baseCost: 50,
    growth: 1.8,
    max: 20,
    icon: '🎯',
  },
];

export function upgradeCost(def: UpgradeDef, lvl: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.growth, lvl));
}

export function heroMaxHp(vidaLvl: number): number {
  return 100 * Math.pow(1.18, vidaLvl);
}

export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, 20) * 0.1;
}
