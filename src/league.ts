import { GameState, currentWeek, weekStart } from './state';
import { SKINS } from './art';

// Liga de prueba: mientras no haya servidor, los otros 29 rivales son simulados
// de forma determinística por semana y división (todos los jugadores ven lo mismo).

export const DIVISIONS = ['Bronce', 'Plata', 'Oro', 'Diamante', 'Leyenda'];
export const DIVISION_COLORS = ['#c58a4f', '#c3ccd6', '#f2c641', '#6fe3ff', '#ff6bd6'];
export const LEAGUE_SIZE = 30;
export const PROMOTE = 5;
export const DEMOTE = 5;
const WEEK_MS = 7 * 24 * 3600 * 1000;

const NAMES = [
  'Valkiria', 'NachoX', 'Sombra_77', 'LaMeli', 'Kuro', 'Thorin', 'Pibe_Forja', 'Luna',
  'Ragnar', 'Mati.exe', 'Nyx', 'ElTano', 'Brisa', 'Gaucho', 'Zafira', 'Toro', 'Kira',
  'Fénix', 'Juli_GG', 'Draco', 'Mora', 'Pampa', 'Iker', 'Runa', 'Coloso', 'Vega',
  'Tincho', 'Akira', 'Selene', 'Bruma', 'Oso', 'Lince', 'Yeti', 'Nina',
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rival {
  name: string;
  skin: string;
  weapon: number;
  target: number; // puntos al final de la semana
  curve: number;
  isPlayer?: boolean;
  points: number;
}

function rivals(week: number, division: number): Rival[] {
  const r = rng(week * 97 + division * 13 + 7);
  const scale = Math.pow(1.7, division);
  const names = [...NAMES].sort(() => r() - 0.5).slice(0, LEAGUE_SIZE - 1);
  return names.map((name) => {
    // Distribución log-uniforme entre 2.000 y 70.000 puntos semanales (en Bronce).
    const target = Math.round(2000 * Math.pow(35, r()) * scale);
    const skinRoll = r();
    const skin = skinRoll > 0.93 ? 'cyber' : skinRoll > 0.75 ? 'samurai' : 'caballero';
    return {
      name,
      skin,
      weapon: Math.max(1, Math.round(3 + division * 3 + r() * 6)),
      target,
      curve: 0.75 + r() * 0.5,
      points: 0,
    };
  });
}

export function standings(s: GameState, now = Date.now()): Rival[] {
  const week = s.league.week;
  const start = Math.max(weekStart(week), s.league.joinedAt ?? 0);
  const progress = Math.min(1, Math.max(0, (now - start) / WEEK_MS));
  const list = rivals(week, s.league.division).map((b) => ({
    ...b,
    points: Math.floor(b.target * Math.pow(progress, b.curve)),
  }));
  list.push({
    name: s.playerName || 'Tú',
    skin: s.skin,
    weapon: 0,
    target: 0,
    curve: 1,
    isPlayer: true,
    points: Math.floor(s.league.points),
  });
  list.sort((a, b) => b.points - a.points);
  return list;
}

export function rewardForRank(rank: number): number {
  if (rank === 1) return 100;
  if (rank === 2) return 70;
  if (rank === 3) return 50;
  if (rank <= 10) return 30;
  return 10;
}

/** Si cambió la semana, cierra la liga anterior y entrega premios. */
export function rolloverLeague(s: GameState, now = Date.now()): boolean {
  const week = currentWeek(now);
  if (week === s.league.week) return false;
  const final = standings(s, weekStart(s.league.week) + WEEK_MS - 1);
  const rank = final.findIndex((x) => x.isPlayer) + 1;
  let moved: -1 | 0 | 1 = 0;
  if (rank <= PROMOTE && s.league.division < DIVISIONS.length - 1) moved = 1;
  else if (rank > LEAGUE_SIZE - DEMOTE && s.league.division > 0) moved = -1;
  const gems = rewardForRank(rank);
  s.gems += gems;
  s.league.lastResult = { week: s.league.week, rank, moved, gems };
  s.league.division += moved;
  s.league.week = week;
  s.league.points = 0;
  return true;
}

export function timeLeftInWeek(s: GameState, now = Date.now()): string {
  const ms = weekStart(s.league.week) + WEEK_MS - now;
  const h = Math.max(0, Math.floor(ms / 3600000));
  const d = Math.floor(h / 24);
  return d > 0 ? `${d} d ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

export const skinIds = SKINS.map((s) => s.id);
