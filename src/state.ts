import {
  BOARD_SIZE,
  UPGRADES,
  UpgradeId,
  attacksPerSecond,
  enemyGold,
  enemyHp,
  forgeInterval,
  killsPerWave,
  leaguePointsForKill,
  soulMultiplier,
  weaponDamage,
  OFFLINE_CAP_HOURS,
  OFFLINE_RATE,
} from './balance';

export interface GameState {
  version: number;
  playerName: string;
  gold: number;
  gems: number;
  souls: number;
  wave: number;
  maxWave: number; // récord de esta vuelta (se reinicia con prestigio)
  bestWaveEver: number;
  killsInWave: number;
  enemyHp: number;
  bossTimer: number;
  farming: boolean; // si perdió con un jefe, se queda en la oleada anterior
  board: (number | null)[]; // nivel del arma en cada casilla
  upgrades: Record<UpgradeId, number>;
  forgeProgress: number;
  skin: string;
  ownedSkins: string[];
  league: {
    week: number;
    points: number;
    division: number;
    joinedAt: number; // si entró a mitad de semana, los rivales cuentan desde ahí
    lastResult: { week: number; rank: number; moved: -1 | 0 | 1; gems: number } | null;
  };
  stats: { kills: number; merges: number; prestiges: number; bossesBeaten: number };
  bossFirstClears: number[];
  lastSeen: number;
  events: { t: number; e: string }[];
}

const SAVE_KEY = 'heroes-forja-save-v1';

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
  board[0] = 1;
  board[1] = 1;
  return {
    version: 1,
    playerName: '',
    gold: 0,
    gems: 20,
    souls: 0,
    wave: 1,
    maxWave: 1,
    bestWaveEver: 1,
    killsInWave: 0,
    enemyHp: enemyHp(1),
    bossTimer: 0,
    farming: false,
    board,
    upgrades: { fuerza: 0, velocidad: 0, forja: 0, calidad: 0, codicia: 0 },
    forgeProgress: 0,
    skin: 'caballero',
    ownedSkins: ['caballero'],
    league: { week: currentWeek(), points: 0, division: 0, joinedAt: Date.now(), lastResult: null },
    stats: { kills: 0, merges: 0, prestiges: 0, bossesBeaten: 0 },
    bossFirstClears: [],
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

export function bestWeapon(s: GameState): number {
  let best = 1;
  for (const w of s.board) if (w !== null && w > best) best = w;
  return best;
}

export function damagePerHit(s: GameState): number {
  return (
    weaponDamage(bestWeapon(s)) * (1 + s.upgrades.fuerza * 0.15) * soulMultiplier(s.souls)
  );
}

export function attackRate(s: GameState): number {
  return attacksPerSecond(s.upgrades.velocidad);
}

export function goldMultiplier(s: GameState): number {
  return (1 + s.upgrades.codicia * 0.2) * soulMultiplier(s.souls);
}

export function dps(s: GameState): number {
  return damagePerHit(s) * attackRate(s);
}

export function forgeSeconds(s: GameState): number {
  return forgeInterval(s.upgrades.forja);
}

export function spawnLevel(s: GameState): number {
  return 1 + s.upgrades.calidad;
}

export function upgradeDef(id: UpgradeId) {
  return UPGRADES.find((u) => u.id === id)!;
}

export interface OfflineReport {
  seconds: number;
  gold: number;
  points: number;
  weapons: number;
}

/**
 * Calcula lo ganado mientras el jugador no estaba. Se asume que el héroe
 * sigue luchando en la oleada actual (sin avanzar) a la mitad de rendimiento.
 */
export function applyOffline(s: GameState, now = Date.now()): OfflineReport | null {
  const elapsed = Math.min((now - s.lastSeen) / 1000, OFFLINE_CAP_HOURS * 3600);
  if (elapsed < 20) return null;
  const farmWave = s.farming || s.wave % 10 === 0 ? Math.max(1, s.wave - 1) : s.wave;
  const timePerKill = Math.max(enemyHp(farmWave) / dps(s), 1 / attackRate(s)) + 0.35;
  const kills = (elapsed / timePerKill) * OFFLINE_RATE;
  const gold = kills * enemyGold(farmWave) * goldMultiplier(s);
  // Los puntos de liga solo cuentan dentro de la semana actual.
  const weekElapsed = Math.min(elapsed, (now - weekStart(currentWeek(now))) / 1000);
  const points = Math.floor((weekElapsed / timePerKill) * OFFLINE_RATE * leaguePointsForKill(farmWave));
  let weapons = 0;
  const forged = Math.floor((elapsed / forgeSeconds(s)) * OFFLINE_RATE);
  for (let i = 0; i < forged; i++) {
    const idx = s.board.indexOf(null);
    if (idx === -1) break;
    s.board[idx] = spawnLevel(s);
    weapons++;
  }
  s.gold += gold;
  s.league.points += points;
  s.stats.kills += Math.floor(kills);
  return { seconds: elapsed, gold, points, weapons };
}

export { killsPerWave };
