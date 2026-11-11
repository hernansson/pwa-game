// Todas las fórmulas de equilibrio en un solo lugar, para poder ajustarlas fácil.

export const BOARD_SIZE = 16; // tablero 4x4
export const BOSS_EVERY = 10;
export const BOSS_TIME = 25; // segundos para vencer al jefe
export const OFFLINE_CAP_HOURS = 8;
export const OFFLINE_RATE = 0.5; // lo ganado sin jugar rinde la mitad
export const PRESTIGE_MIN_WAVE = 30;

export function weaponDamage(level: number): number {
  return 4 * Math.pow(2.05, level - 1);
}

export function enemyHp(wave: number): number {
  const base = 8 * Math.pow(1.16, wave - 1);
  return isBoss(wave) ? base * 7 : base;
}

export function enemyGold(wave: number): number {
  const base = 1 + 0.9 * Math.pow(1.145, wave - 1);
  return isBoss(wave) ? base * 12 : base;
}

export function isBoss(wave: number): boolean {
  return wave % BOSS_EVERY === 0;
}

/** Enemigos que hay que vencer para pasar de oleada (los jefes son uno solo). */
export function killsPerWave(wave: number): number {
  return isBoss(wave) ? 1 : 5;
}

export function leaguePointsForKill(wave: number): number {
  return isBoss(wave) ? 25 : 1 + Math.floor(wave / 25);
}

export function soulsForPrestige(maxWave: number): number {
  if (maxWave < PRESTIGE_MIN_WAVE) return 0;
  return Math.floor(Math.pow(maxWave / 10, 1.6));
}

export function soulMultiplier(souls: number): number {
  return 1 + souls * 0.1;
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

export type UpgradeId = 'fuerza' | 'velocidad' | 'forja' | 'calidad' | 'codicia';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'fuerza',
    name: 'Fuerza',
    desc: (l) => `+15% de daño por nivel (ahora +${l * 15}%)`,
    baseCost: 10,
    growth: 1.45,
    max: 999,
    icon: '💪',
  },
  {
    id: 'velocidad',
    name: 'Velocidad',
    desc: (l) => `+8% de velocidad de ataque (ahora +${l * 8}%)`,
    baseCost: 30,
    growth: 1.75,
    max: 25,
    icon: '⚡',
  },
  {
    id: 'forja',
    name: 'Forja',
    desc: (l) => `Cae un arma cada ${forgeInterval(l).toFixed(1)} s`,
    baseCost: 40,
    growth: 1.8,
    max: 20,
    icon: '🔨',
  },
  {
    id: 'calidad',
    name: 'Calidad',
    desc: (l) => `Las armas nuevas salen de nivel ${l + 1}`,
    baseCost: 400,
    growth: 7,
    max: 15,
    icon: '💎',
  },
  {
    id: 'codicia',
    name: 'Codicia',
    desc: (l) => `+20% de oro (ahora +${l * 20}%)`,
    baseCost: 25,
    growth: 1.5,
    max: 999,
    icon: '🪙',
  },
];

export function upgradeCost(def: UpgradeDef, lvl: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.growth, lvl));
}

export function forgeInterval(forgeLvl: number): number {
  return 6 * Math.pow(0.9, forgeLvl);
}

export function attacksPerSecond(speedLvl: number): number {
  return 1.2 * (1 + speedLvl * 0.08);
}
