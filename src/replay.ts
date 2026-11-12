// Rejuega una pelea a partir de la semilla y la lista de jugadas. Lo usa el servidor para calcular
// las recompensas por su cuenta: el celu solo manda qué juntó y cuándo, nunca el resultado.

import { ClearReport, Game, RunAction } from './game';
import { GameState } from './state';
import { seeded } from './rng';

/** Pasos mínimos entre dos jugadas (0,1 s): más rápido que eso no lo hace una persona. */
export const MIN_GAP = 3;
/** Una pelea no dura más de 10 minutos. */
export const MAX_STEPS = 10 * 60 * 30;

export type ReplayResult = { ok: true; state: GameState; report: ClearReport; steps: number } | { ok: false; error: string };

export function replayRun(snapshot: GameState, level: number, seed: number, log: RunAction[], duel = false): ReplayResult {
  const s: GameState = JSON.parse(JSON.stringify(snapshot));
  s.energy = 999; // la energía ya se cobró al empezar
  s.run = null;
  const game = new Game(s);
  game.rand = seeded(seed);
  let report: ClearReport | null = null;
  game.on((e) => {
    if (e.type === 'end') report = e.report;
  });
  if (!(duel ? game.startDuel(level) : game.start(level))) return { ok: false, error: 'cannot_start' };
  let prev = -MIN_GAP;
  for (const a of log) {
    if (!Array.isArray(a) || a.length > 6 || !a.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_STEPS)) return { ok: false, error: 'bad_action' };
    const [step, kind] = a;
    if (step < prev || step > MAX_STEPS) return { ok: false, error: 'bad_order' };
    if (kind !== 2 && step - prev < MIN_GAP) return { ok: false, error: 'too_fast' };
    while (game.step < step && game.fighting) game.stepOnce();
    if (!game.fighting) return { ok: false, error: 'action_after_end' };
    let done = false;
    if (kind === 0) done = game.merge({ col: a[2], row: a[3] }, { col: a[4], row: a[5] });
    else if (kind === 1) done = game.discardAt({ col: a[2], row: a[3] });
    else if (kind === 2) {
      game.abandon();
      done = true;
    } else if (kind === 3) done = game.special();
    if (!done) return { ok: false, error: 'invalid_move' };
    prev = step;
  }
  while (game.fighting && game.step < MAX_STEPS) game.stepOnce();
  if (game.fighting) game.abandon();
  if (!report) return { ok: false, error: 'no_result' };
  return { ok: true, state: game.s, report, steps: game.step };
}
