import {
  BOARD_SIZE,
  ENERGY_MAX,
  ENERGY_REGEN_SECONDS,
  UPGRADES,
  UpgradeId,
  attacksPerSecond,
  heroMaxHp,
  weaponDamage,
} from './balance';

export interface Run {
  level: number;
  wave: number; // 0..WAVES_PER_LEVEL-1 oleadas normales, WAVES_PER_LEVEL = jefe
  enemyInWave: number;
  enemyHp: number;
  heroHp: number;
  gold: number;
  drops: number;
  result: null | 'win' | 'lose';
}

export interface GameState {
  version: number;
  playerName: string;
  gold: number;
  gems: number;
  energy: number;
  energyAt: number; // momento del último cálculo de recarga
  unlocked: number; // nivel más alto disponible
  stars: Record<number, number>;
  board: (number | null)[]; // nivel del arma en cada casilla
  upgrades: Record<UpgradeId, number>;
  forged: number;
  run: Run | null;
  skin: string;
  ownedSkins: string[];
  league: {
    week: number;
    points: number;
    division: number;
    joinedAt: number; // si entró a mitad de semana, los rivales cuentan desde ahí
    lastResult: { week: number; rank: number; moved: -1 | 0 | 1; gems: number } | null;
  };
  stats: { kills: number; merges: number; clears: number; fails: number };
  lastSeen: number;
  events: { t: number; e: string }[];
}

const SAVE_KEY = 'heroes-forja-save-v2';

export function currentWeek(now = Date.now()): number {
  // Semanas que arrancan el lunes 00:00 UTC.
  const MONDAY_EPOCH = Date.UTC(2024, 0, 1); // 1 ene 2024 fue lunes
  return Math.floor((now - MONDAY_EPOCH) / (7 * 24 * 3600 * 1000));
}

export function weekStart(week: number): number {
  return Date.UTC(2024, 0, 1) + week * 7 * 24 * 3600 * 1000;
}

export function newState(): GameState {
  const board: (number | null)[] = Array(BOARD_SIZE).fill(null);
  board[0] = 2;
  board[1] = 1;
  board[2] = 1;
  return {
    version: 2,
    playerName: '',
    gold: 0,
    gems: 20,
    energy: ENERGY_MAX,
    energyAt: Date.now(),
    unlocked: 1,
    stars: {},
    board,
    upgrades: { fuerza: 0, vida: 0, velocidad: 0, calidad: 0, codicia: 0 },
    forged: 0,
    run: null,
    skin: 'caballero',
    ownedSkins: ['caballero'],
    league: { week: currentWeek(), points: 0, division: 0, joinedAt: Date.now(), lastResult: null },
    stats: { kills: 0, merges: 0, clears: 0, fails: 0 },
    lastSeen: Date.now(),
    events: [],
  };
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      return { ...newState(), ...parsed };
    }
  } catch {
    /* sin almacenamiento: partida nueva */
  }
  return newState();
}

export function save(s: GameState): void {
  s.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* modo privado o almacenamiento bloqueado */
  }
}

export function resetSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nada */
  }
}

/** Registro local de eventos para medir interés (se enviará al servidor más adelante). */
export function track(s: GameState, e: string): void {
  s.events.push({ t: Date.now(), e });
  if (s.events.length > 300) s.events.splice(0, s.events.length - 300);
}

/** Suma la energía recargada desde el último cálculo. */
export function regenEnergy(s: GameState, now = Date.now()): void {
  if (s.energy >= ENERGY_MAX) {
    s.energyAt = now;
    return;
  }
  const gained = Math.floor((now - s.energyAt) / 1000 / ENERGY_REGEN_SECONDS);
  if (gained > 0) {
    s.energy = Math.min(ENERGY_MAX, s.energy + gained);
    s.energyAt += gained * ENERGY_REGEN_SECONDS * 1000;
    if (s.energy >= ENERGY_MAX) s.energyAt = now;
  }
}

export function secondsToNextEnergy(s: GameState, now = Date.now()): number {
  if (s.energy >= ENERGY_MAX) return 0;
  return Math.max(0, ENERGY_REGEN_SECONDS - (now - s.energyAt) / 1000);
}

export function bestWeapon(s: GameState): number {
  let best = 1;
  for (const w of s.board) if (w !== null && w > best) best = w;
  return best;
}

export function damagePerHit(s: GameState): number {
  return weaponDamage(bestWeapon(s)) * (1 + s.upgrades.fuerza * 0.15);
}

export function attackRate(s: GameState): number {
  return attacksPerSecond(s.upgrades.velocidad);
}

export function goldMultiplier(s: GameState): number {
  return 1 + s.upgrades.codicia * 0.2;
}

export function maxHp(s: GameState): number {
  return heroMaxHp(s.upgrades.vida);
}

export function dps(s: GameState): number {
  return damagePerHit(s) * attackRate(s);
}

export function upgradeDef(id: UpgradeId) {
  return UPGRADES.find((u) => u.id === id)!;
}
