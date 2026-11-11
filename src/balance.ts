// Todas las fórmulas de equilibrio en un solo lugar, para poder ajustarlas fácil.

export const BOARD_SIZE = 16; // tablero 4x4
export const WAVES_PER_LEVEL = 3;
export const ENEMIES_PER_WAVE = 4;
export const LEVELS_PER_WORLD = 10;
export const ENERGY_MAX = 30;
export const ENERGY_COST = 5;
export const ENERGY_REGEN_SECONDS = 5 * 60; // 1 de energía cada 5 minutos
export const DROP_CHANCE = 0.7; // probabilidad de que un enemigo suelte un arma
export const BOSS_CHEST = 3; // armas en el cofre del jefe

export function weaponDamage(level: number): number {
  return 5 * Math.pow(2, level - 1);
}

/** Dificultad de un nivel (1, 2, 3...). Crece más rápido que el oro para pedir fusiones. */
function difficulty(level: number): number {
  return Math.pow(1.42, level - 1);
}

export function enemyHp(level: number, boss: boolean): number {
  const base = 14 * difficulty(level);
  return boss ? base * 10 : base;
}

/** Daño por segundo que recibe el héroe. */
export function enemyDps(level: number, boss: boolean): number {
  const base = 2.5 * Math.pow(1.3, level - 1);
  return boss ? base * 1.8 : base;
}

export function enemyGold(level: number, boss: boolean): number {
  const base = 2 * Math.pow(1.33, level - 1);
  return boss ? base * 10 : base;
}

/** Nivel de las armas que sueltan los enemigos en este nivel. */
export function dropLevel(level: number, calidad: number): number {
  return 1 + calidad + Math.floor((level - 1) / 4);
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

export function forgeCost(forged: number, level: number): number {
  // Forjar es caro comparado con lo que sueltan los enemigos, pero siempre está disponible.
  return Math.ceil(15 * Math.pow(1.33, level - 1) * Math.pow(1.04, forged));
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

export type UpgradeId = 'fuerza' | 'vida' | 'velocidad' | 'calidad' | 'codicia';

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
    id: 'velocidad',
    name: 'Velocidad',
    desc: (l) => `+8% de velocidad de ataque (ahora +${l * 8}%)`,
    baseCost: 40,
    growth: 1.8,
    max: 25,
    icon: '⚡',
  },
  {
    id: 'calidad',
    name: 'Calidad',
    desc: (l) => `Las armas que caen suben ${l} nivel${l === 1 ? '' : 'es'}`,
    baseCost: 300,
    growth: 6,
    max: 12,
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

export function attacksPerSecond(speedLvl: number): number {
  return 1.3 * (1 + speedLvl * 0.08);
}
