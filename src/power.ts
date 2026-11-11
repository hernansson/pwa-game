// Puntaje de poder: cuánto vale cada efecto, medido en "% de daño equivalente".
// 1 punto = lo mismo que +1% de daño. Los pesos salen de tools/valuate.ts, que juega miles de
// niveles con un jugador simulado y mide hasta qué nivel llega con cada efecto.
// Si se cambia el balance del combate, hay que volver a correrlo y actualizar estos números.

import { ArmDef, Mods, NO_MODS, armMods } from './arsenal';

/** Puntos de poder que da 1,0 de cada stat (por ejemplo, +100% de vida = 143 puntos). */
export const POWER_WEIGHTS: Record<keyof Mods, number> = {
  dmg: 1,
  hp: 1.43,
  shield: 0.33,
  heal: 0.19,
  boostMult: 0.13,
  crit: 0.96,
  critMult: 0.03,
  reduce: 1.57,
  startShield: 0.52,
  boostSec: 0.05,
  combo: 0.32,
};

export function modsScore(m: Mods): number {
  let s = 0;
  for (const k in m) s += m[k as keyof Mods] * POWER_WEIGHTS[k as keyof Mods] * 100;
  return s;
}

/** Puntaje de una variante a cierto nivel. */
export function armScore(def: ArmDef, lvl: number): number {
  return modsScore(armMods(def, lvl, { ...NO_MODS }));
}
