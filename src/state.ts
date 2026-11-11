import {
  ENERGY_MAX,
  ENERGY_REGEN_SECONDS,
  UPGRADES,
  UpgradeId,
  comboWindow,
  heroMaxHp,
  LEVEL_TWO_CHANCE,
} from './balance';
import { Grid } from './board';
import { LEGACY_SETS, STARTER, Slot, bonusOf, slotItem } from './items';

export interface Run {
  level: number;
  wave: number; // 0..WAVES_PER_LEVEL-1 oleadas normales, WAVES_PER_LEVEL = jefe
  enemyInWave: number;
  enemyHp: number;
  enemyTimer: number; // segundos hasta el próximo golpe del enemigo
  stun: number; // segundos que el enemigo queda frenado (sin uso por ahora)
  heroHp: number;
  shield: number; // vida extra de los escudos, absorbe golpes
  grid: Grid;
  boost: number; // segundos que quedan de potenciador (rayos)
  boostMult: number;
  look: { sword?: number; shield?: number; glow?: number }; // cómo se ve el héroe en este combate
  combo: number;
  comboTimer: number;
  maxCombo: number;
  gold: number;
  drops: number;
  merges: number;
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
  upgrades: Record<UpgradeId, number>;
  run: Run | null;
  board: { rows: number; cols: number }; // ampliaciones del tablero compradas
  items: string[]; // piezas de equipo que tiene
  equipped: Record<Slot, string>;
  skin?: string; // solo para migrar guardados viejos
  ownedSkins?: string[];
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

const SAVE_KEY = 'heroes-forja-save';
const OLD_KEYS = ['heroes-forja-save-v2', 'heroes-forja-save-v1'];
export const SAVE_VERSION = 4;

export function currentWeek(now = Date.now()): number {
  // Semanas que arrancan el lunes 00:00 UTC.
  const MONDAY_EPOCH = Date.UTC(2024, 0, 1); // 1 ene 2024 fue lunes
  return Math.floor((now - MONDAY_EPOCH) / (7 * 24 * 3600 * 1000));
}

export function weekStart(week: number): number {
  return Date.UTC(2024, 0, 1) + week * 7 * 24 * 3600 * 1000;
}

export function newState(): GameState {
  return {
    version: SAVE_VERSION,
    playerName: '',
    gold: 0,
    gems: 20,
    energy: ENERGY_MAX,
    energyAt: Date.now(),
    unlocked: 1,
    stars: {},
    upgrades: { fuerza: 0, vida: 0, calma: 0, codicia: 0 },
    run: null,
    board: { rows: 0, cols: 0 },
    items: Object.values(STARTER),
    equipped: { ...STARTER },
    league: { week: currentWeek(), points: 0, division: 0, joinedAt: Date.now(), lastResult: null },
    stats: { kills: 0, merges: 0, clears: 0, fails: 0 },
    lastSeen: Date.now(),
    events: [],
  };
}

/**
 * Convierte cualquier guardado viejo al formato actual, para que actualizar el
 * juego nunca borre el progreso.
 */
export function migrate(raw: unknown): GameState {
  const base = newState();
  if (!raw || typeof raw !== 'object') return base;
  const old = raw as Partial<GameState> & Record<string, unknown>;
  const s: GameState = { ...base, ...old } as GameState;
  s.upgrades = { ...base.upgrades, ...(old.upgrades ?? {}) };
  const legacy = old.upgrades as Record<string, number> | undefined;
  // Versiones viejas: velocidad → lluvia de armas → calma.
  const oldRain = legacy?.lluvia ?? legacy?.velocidad;
  if (typeof oldRain === 'number' && !legacy?.calma) s.upgrades.calma = Math.min(15, oldRain);
  // El talento Calidad se quitó: se devuelve el oro que costó.
  const cal = Math.min(10, legacy?.calidad ?? 0);
  for (let i = 0; i < cal; i++) s.gold += Math.ceil(120 * Math.pow(2.2, i));
  for (const k of ['velocidad', 'forja', 'lluvia', 'calidad']) delete (s.upgrades as Record<string, number>)[k];
  s.league = { ...base.league, ...(old.league ?? {}) };
  s.stats = { ...base.stats, ...(old.stats ?? {}) };
  if (typeof s.unlocked !== 'number') s.unlocked = 1;
  if (!s.stars || typeof s.stars !== 'object') s.stars = {};
  if (typeof s.energy !== 'number') {
    s.energy = ENERGY_MAX;
    s.energyAt = Date.now();
  }
  // Las skins viejas pasan a ser conjuntos de equipo.
  if (!Array.isArray(old.items)) {
    s.items = Object.values(STARTER);
    s.equipped = { ...STARTER };
    for (const skin of old.ownedSkins ?? []) for (const id of LEGACY_SETS[skin] ?? []) if (!s.items.includes(id)) s.items.push(id);
    const set = LEGACY_SETS[old.skin ?? ''];
    if (set) {
      s.equipped.casco = set[0];
      s.equipped.armadura = set[1];
      s.equipped.capa = set[2];
    }
  }
  s.equipped = { ...STARTER, ...(s.equipped ?? {}) };
  delete s.skin;
  delete s.ownedSkins;
  // Campos de versiones anteriores que ya no se usan.
  const b = old.board as unknown;
  s.board = b && !Array.isArray(b) && typeof b === 'object' ? { rows: 0, cols: 0, ...(b as object) } : { rows: 0, cols: 0 };
  for (const k of ['forged', 'souls', 'wave', 'maxWave', 'bestWaveEver', 'killsInWave', 'enemyHp', 'bossTimer', 'farming', 'forgeProgress', 'bossFirstClears']) {
    delete (s as unknown as Record<string, unknown>)[k];
  }
  s.run = null;
  s.version = SAVE_VERSION;
  return s;
}

export function load(): GameState {
  try {
    for (const key of [SAVE_KEY, ...OLD_KEYS]) {
      const raw = localStorage.getItem(key);
      if (raw) return migrate(JSON.parse(raw));
    }
  } catch {
    /* sin almacenamiento: partida nueva */
  }
  return newState();
}

/** Código de texto con todo el progreso, para pasarlo a otro dispositivo. */
export function exportCode(s: GameState): string {
  const { events: _events, run: _run, ...rest } = s;
  const json = JSON.stringify(rest);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'FORJA-' + btoa(bin);
}

export function importCode(code: string): GameState | null {
  try {
    const clean = code.trim().replace(/^FORJA-/, '').replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || !data.upgrades) return null;
    return migrate(data);
  } catch {
    return null;
  }
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
    for (const key of [SAVE_KEY, ...OLD_KEYS]) localStorage.removeItem(key);
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

function gearBonus(s: GameState, slot: Slot): number {
  return bonusOf(slotItem(s.equipped[slot], slot));
}

export function damageMultiplier(s: GameState): number {
  return (1 + s.upgrades.fuerza * 0.15) * (1 + gearBonus(s, 'arma'));
}

export function goldMultiplier(s: GameState): number {
  return (1 + s.upgrades.codicia * 0.2) * (1 + gearBonus(s, 'capa'));
}

export function maxHp(s: GameState): number {
  return heroMaxHp(s.upgrades.vida) * (1 + gearBonus(s, 'casco') + gearBonus(s, 'armadura'));
}

export function comboTime(s: GameState): number {
  return comboWindow(s.upgrades.calma);
}

export function pieceLevelTwoChance(_s: GameState): number {
  return LEVEL_TWO_CHANCE;
}

/** Número único para mostrar qué tan fuerte es el héroe. */
export function power(s: GameState): number {
  return Math.round(Math.sqrt(damageMultiplier(s) * (maxHp(s) / 100)) * 100);
}

export function upgradeDef(id: UpgradeId) {
  return UPGRADES.find((u) => u.id === id)!;
}
