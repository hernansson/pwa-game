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

export function enemyHp(level: number, boss: boolean): number {
  const base = 100 * Math.pow(1.33, level - 1) * earlyEase(level);
  return boss ? base * 4 : base;
}

/** Daño de cada golpe del enemigo. */
export function enemyHit(level: number, boss: boolean): number {
  const base = 14 * Math.pow(1.23, level - 1) * earlyEase(level);
  return boss ? base * 1.6 : base;
}

/** Segundos entre golpes del enemigo. */
export function enemyAttackSeconds(boss: boolean): number {
  return boss ? 2.4 : 2.8;
}

export function enemyGold(level: number, boss: boolean): number {
  const base = 3 * Math.pow(1.33, level - 1);
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

/** Segundos que tienes entre fusiones para no perder el combo. */
export function comboWindow(ritmo: number): number {
  return 1.5 + ritmo * 0.1;
}

/** Probabilidad de que una pieza nueva llegue ya en nivel 2. */
export function levelTwoChance(calidad: number): number {
  return Math.min(0.5, calidad * 0.05);
}

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

export type UpgradeId = 'fuerza' | 'vida' | 'calma' | 'calidad' | 'codicia';

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
    id: 'calma',
    name: 'Ritmo',
    desc: (l) => `Tienes ${comboWindow(l).toFixed(1)} s entre fusiones para mantener el combo`,
    baseCost: 40,
    growth: 1.8,
    max: 15,
    icon: '🔥',
  },
  {
    id: 'calidad',
    name: 'Calidad',
    desc: (l) => `${Math.round(levelTwoChance(l) * 100)}% de piezas que llegan en nivel 2`,
    baseCost: 120,
    growth: 2.2,
    max: 10,
    icon: '💎',
  },
  {
    id: 'codicia',
    name: 'Codicia',
    desc: (l) => `+20% de oro (ahora +${l * 20}%)`,
    baseCost: 30,
    growth: 1.55,
    max: 999,
    icon: '🪙',
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
