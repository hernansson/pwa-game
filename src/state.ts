import {
  ENERGY_MAX,
  ENERGY_REGEN_SECONDS,
  UPGRADES,
  UpgradeId,
  COMBO_WINDOW,
  BASE_CRIT,
  CAPS,
  heroMaxHp,
  LEVEL_TWO_CHANCE,
  PASS,
} from './balance';
import { Grid, MAX_EXTRA_COLS, MAX_EXTRA_ROWS, PieceOdds } from './board';
import { ITEMS, LEGACY_SETS, OLD_WEAPONS, STARTER } from './items';
import { ARMS, ArmFam, Mods, NO_MODS, STARTER_ARMS, armById, armMods } from './arsenal';

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
  /** Reto contra el jefe: segundos que quedan y daño total hecho. */
  duel?: { left: number; dmg: number };
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
  arsenal: Record<string, { lvl: number; shards: number }>; // lvl 0 = bloqueada
  arms: Record<ArmFam, string>; // variante equipada de cada familia y skin
  freeChestAt: number; // cuándo se abrió el último cofre gratis
  passUntil: number; // hasta cuándo dura el pase mensual
  pulls: Record<string, number>; // cofres abiertos de cada tipo (para las garantías)
  ownedSkins?: string[];
  league: {
    week: number;
    points: number;
    division: number;
    joinedAt: number; // si entró a mitad de semana, los rivales cuentan desde ahí
    lastResult: { week: number; rank: number; moved: -1 | 0 | 1; gems: number } | null;
  };
  stats: { kills: number; merges: number; clears: number; fails: number };
  /** Misiones del día y racha de entradas. */
  daily: { day: number; streak: number; loginDay: number; prog: Record<string, number>; claimed: string[] };
  lastSeen: number;
  events: { t: number; e: string }[];
}

const SAVE_KEY = 'heroes-forja-save';
const OLD_KEYS = ['heroes-forja-save-v2', 'heroes-forja-save-v1'];
export const SAVE_VERSION = 5;

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
    upgrades: { fuerza: 0, vida: 0, critico: 0 },
    run: null,
    board: { rows: 0, cols: 0 },
    arsenal: Object.fromEntries(ARMS.map((a) => [a.id, { lvl: Object.values(STARTER_ARMS).includes(a.id) ? 1 : 0, shards: 0 }])),
    arms: { ...STARTER_ARMS },
    freeChestAt: 0,
    passUntil: 0,
    pulls: {},
    league: { week: currentWeek(), points: 0, division: 0, joinedAt: Date.now(), lastResult: null },
    stats: { kills: 0, merges: 0, clears: 0, fails: 0 },
    daily: { day: 0, streak: 0, loginDay: -10, prog: {}, claimed: [] },
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
  // v5: el talento Crítico se rebalanceó (antes 1% por nivel y más barato): se devuelve su oro y vuelve a 0.
  if ((old.version ?? 0) < 5 && legacy?.critico) {
    for (let i = 0; i < Math.min(40, legacy.critico); i++) s.gold += Math.ceil(20 * Math.pow(1.55, i));
    s.upgrades.critico = 0;
  }
  // Ritmo (calma) y Codicia se quitaron: se devuelve el oro que costaron.
  const calma = Math.min(15, legacy?.calma ?? legacy?.lluvia ?? legacy?.velocidad ?? 0);
  for (let i = 0; i < calma; i++) s.gold += Math.ceil(40 * Math.pow(1.8, i));
  const codicia = Math.min(60, legacy?.codicia ?? 0);
  for (let i = 0; i < codicia; i++) s.gold += Math.ceil(30 * Math.pow(1.55, i));
  // El talento Calidad se quitó: se devuelve el oro que costó.
  const cal = Math.min(10, legacy?.calidad ?? 0);
  for (let i = 0; i < cal; i++) s.gold += Math.ceil(120 * Math.pow(2.2, i));
  for (const k of ['velocidad', 'forja', 'lluvia', 'calidad', 'calma', 'codicia']) delete (s.upgrades as Record<string, number>)[k];
  s.league = { ...base.league, ...(old.league ?? {}) };
  s.stats = { ...base.stats, ...(old.stats ?? {}) };
  s.daily = { ...base.daily, ...(old.daily ?? {}) };
  s.daily.prog = { ...(s.daily.prog ?? {}) };
  s.daily.claimed = Array.isArray(s.daily.claimed) ? s.daily.claimed : [];
  if (typeof s.unlocked !== 'number') s.unlocked = 1;
  if (!s.stars || typeof s.stars !== 'object') s.stars = {};
  if (typeof s.energy !== 'number') {
    s.energy = ENERGY_MAX;
    s.energyAt = Date.now();
  }
  // Arsenal: completa variantes nuevas y quita las que ya no existen.
  s.arsenal = { ...base.arsenal };
  for (const [id, v] of Object.entries(old.arsenal ?? {})) if (base.arsenal[id]) s.arsenal[id] = v;
  // Equipo y skins de versiones anteriores: las espadas y la ropa se convierten en fragmentos,
  // y los conjuntos samurái y neón desbloquean esas skins.
  const owned = new Set<string>([...((old.items as string[] | undefined) ?? []), ...((old.ownedSkins as string[] | undefined) ?? [])]);
  if (owned.size) {
    const bonus = { común: 4, rara: 8, épica: 16, legendaria: 30 };
    let swords = 0;
    let clothes = 0;
    for (const id of owned) {
      if (OLD_WEAPONS[id]) swords += bonus[OLD_WEAPONS[id]];
      const it = ITEMS.find((i) => i.id === id);
      if (it && !Object.values(STARTER).includes(id)) clothes += bonus[it.rarity];
    }
    for (const [skin, set] of Object.entries(LEGACY_SETS)) {
      if (owned.has(skin) || set.every((id) => owned.has(id))) {
        if (!s.arsenal[skin].lvl) s.arsenal[skin].lvl = 1;
      }
    }
    if (!old.arsenal && swords) {
      s.arsenal.cimitarra.shards += Math.ceil(swords / 2);
      s.arsenal.mandoble.shards += Math.floor(swords / 2);
    }
    if (clothes) {
      s.arsenal.samurai.shards += Math.ceil(clothes / 2);
      s.arsenal.cyber.shards += Math.floor(clothes / 2);
    }
  }
  s.arms = { ...STARTER_ARMS };
  for (const [f, id] of Object.entries((old.arms as Record<string, string> | undefined) ?? {})) {
    const def = armById(id);
    if (def && def.fam === f && s.arsenal[id]?.lvl) s.arms[f as ArmFam] = id;
  }
  if (typeof s.freeChestAt !== 'number') s.freeChestAt = 0;
  if (typeof s.passUntil !== 'number') s.passUntil = 0;
  if (!s.pulls || typeof s.pulls !== 'object') s.pulls = {};
  // El tablero ahora crece como mucho 1 fila y 1 columna, y solo con dinero: se devuelven las gemas de la 2.ª fila.
  if (s.board.rows > MAX_EXTRA_ROWS) {
    s.gems += 120;
    s.board.rows = MAX_EXTRA_ROWS;
  }
  s.board.cols = Math.min(s.board.cols, MAX_EXTRA_COLS);
  for (const k of ['items', 'equipped', 'skin', 'ownedSkins']) delete (s as unknown as Record<string, unknown>)[k];
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


export function damageMultiplier(s: GameState): number {
  return 1 + s.upgrades.fuerza * 0.15;
}

/** Suma lo que dan las variantes equipadas del Arsenal (nivel + habilidades). */
export function arsenalMods(s: GameState): Mods {
  const m = { ...NO_MODS };
  for (const id of Object.values(s.arms)) {
    const def = armById(id);
    if (def) armMods(def, s.arsenal[id]?.lvl ?? 0, m);
  }
  m.critMult = Math.min(CAPS.critMult, m.critMult);
  m.reduce = Math.min(CAPS.reduce, m.reduce);
  m.combo = Math.min(CAPS.combo, m.combo);
  m.boostSec = Math.min(CAPS.boostSec, m.boostSec);
  m.startShield = Math.min(CAPS.startShield, m.startShield);
  return m;
}

export function armShape(s: GameState, fam: ArmFam): number {
  return armById(s.arms[fam])?.shape ?? 0;
}


/** Probabilidad de crítico: base + talento + Arsenal. */
export function critChance(s: GameState): number {
  return Math.min(CAPS.crit, BASE_CRIT + s.upgrades.critico * 0.005 + arsenalMods(s).crit);
}

export function maxHp(s: GameState): number {
  return heroMaxHp(s.upgrades.vida) * (1 + arsenalMods(s).hp);
}

export function comboTime(_s: GameState): number {
  return COMBO_WINDOW;
}

export function passActive(s: GameState, now = Date.now()): boolean {
  return s.passUntil > now;
}

/** Días que le quedan al pase mensual (0 si no está activo). */
export function passDaysLeft(s: GameState, now = Date.now()): number {
  return passActive(s, now) ? Math.ceil((s.passUntil - now) / 86400000) : 0;
}

export function pieceOdds(s: GameState): PieceOdds {
  return passActive(s) ? { two: PASS.lvl2, three: PASS.lvl3 } : { two: LEVEL_TWO_CHANCE, three: 0 };
}

/** Número único para mostrar qué tan fuerte es el héroe. */
export function power(s: GameState): number {
  const m = arsenalMods(s);
  return Math.round(Math.sqrt(damageMultiplier(s) * (1 + m.dmg) * ((1 + critChance(s) * (1 + m.critMult)) / (1 + BASE_CRIT)) * (maxHp(s) / 100) * (1 + m.shield / 2 + m.heal / 4)) * 100);
}

export function upgradeDef(id: UpgradeId) {
  return UPGRADES.find((u) => u.id === id)!;
}
