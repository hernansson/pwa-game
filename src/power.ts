// Puntaje de poder. El ataque y la defensa se MULTIPLICAN (pegas más fuerte × aguantas más tiempo),
// así que el puntaje también: poder = ataque × defensa. Eso da rendimientos decrecientes solos:
// +10% de daño vale mucho si no tienes nada y menos si ya tienes +200%.
// Los pesos salen de tools/valuate.ts (miles de niveles con un jugador simulado). Si cambia el combate,
// hay que volver a medir. Ver BALANCE.md.

import { ArmDef, Mods, NO_MODS, armMods } from './arsenal';

/** Cuánto pesa cada efecto dentro de su factor. 1 = igual que el daño (o la vida, en la defensa). */
export const POWER_WEIGHTS = {
  hp: 1.43, // la vida vale ~1,4 veces lo que el daño
  reduce: 1.43, // se aplica como 1 / (1 - reducción), con el mismo peso que la vida
  shield: 0.33,
  startShield: 0.52,
  heal: 0.19,
  combo: 0.32, // por segundo extra
  boostMult: 0.13,
  boostSec: 0.05, // por segundo extra
};

export function attackFactor(m: Mods): number {
  const W = POWER_WEIGHTS;
  return (1 + m.dmg) * (1 + Math.min(0.5, m.crit) * (1 + m.critMult)) * (1 + W.combo * m.combo) * (1 + W.boostMult * m.boostMult) * (1 + W.boostSec * m.boostSec);
}

export function defenseFactor(m: Mods): number {
  const W = POWER_WEIGHTS;
  return Math.pow((1 + m.hp) / (1 - Math.min(0.6, m.reduce)), W.hp) * (1 + W.shield * m.shield) * (1 + W.startShield * Math.min(0.4, m.startShield)) * (1 + W.heal * m.heal);
}

/** Poder total de unos modificadores: 100 = nada extra, 200 = el doble de fuerte. */
export function modsPower(m: Mods): number {
  return 100 * attackFactor(m) * defenseFactor(m);
}

/** Puntos que suma una variante sola (0 = nada). 1 punto ≈ +1% de poder. */
export function armScore(def: ArmDef, lvl: number): number {
  return modsPower(armMods(def, lvl, { ...NO_MODS })) - 100;
}

/** Cuánto sube el poder al poner esta variante en vez de otra, con el resto del equipo puesto (en %). */
export function swapGain(rest: Mods, from: Mods, to: Mods): number {
  const add = (a: Mods, b: Mods) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k as keyof Mods] + b[k as keyof Mods]])) as unknown as Mods;
  return (modsPower(add(rest, to)) / modsPower(add(rest, from)) - 1) * 100;
}
