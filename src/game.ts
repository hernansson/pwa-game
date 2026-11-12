import {
  BASE_DAMAGE,
  ENEMIES_PER_WAVE,
  ENERGY_COST,
  UpgradeId,
  WAVES_PER_LEVEL,
  comboMultiplier,
  enemyAttackSeconds,
  enemyGold,
  enemyHit,
  enemyHp,
  firstClearGems,
  leaguePointsForClear,
  levelPower,
  pieceValue,
  boostMultiplier,
  shieldReduction,
  swordBonus,
  boostSeconds,
  CAPS,
  starsFor,
  upgradeCost,
} from './balance';
import { BASE_COLS, BASE_ROWS, Cell, Family, MAX_EXTRA_COLS, MAX_EXTRA_ROWS, MergeEvent, discard, hasPair, makePiece, mergePair, randomPiece, refill, startingGrid } from './board';
import {
  GameState,
  Run,
  comboTime,
  damageMultiplier,
  critChance,
  maxHp,
  pieceOdds,
  regenEnergy,
  arsenalMods,
  track,
  upgradeDef,
} from './state';
import { ARMS, CHESTS, FENIX_SET, LEGEND_PLAY_CHANCE, FREE_CHEST_HOURS, MAX_ARM_LEVEL, Mods, PITY, armById, pityPick, rollShards, unlockShards, upgradeGold, upgradeShards } from './arsenal';
import { DAILY_BONUS, DAILY_MISSIONS, ENERGY_MAX, LOGIN_GEMS, Mission, MissionStat, dayNumber, GOLD_PACKS, LEVELS_PER_WORLD, PASS, REFILL_GEMS, chestPrice, goldPackAmount } from './balance';

export interface ClearReport {
  level: number;
  win: boolean;
  stars: number;
  gold: number;
  gems: number;
  points: number;
  maxCombo: number;
  firstClear: boolean;
  shards: Record<string, number>; // fragmentos del Arsenal ganados
  damage?: number; // solo en el reto contra el jefe
}

/** Lo que salió de los cofres: fragmentos por variante y qué garantías tocaron. */
export interface ChestResult {
  got: Record<string, number>;
  pity: { id: string; big: boolean }[];
}

/** Reto contra el jefe: dura esto y gana quien le hace más daño. */
export const DUEL_SECONDS = 60;
/** En el reto cada golpe del jefe quita esta parte de la vida máxima (antes de escudos). */
export const DUEL_HIT = 0.065;

/** Lo que produjo una fusión, para mostrarlo en pantalla. */
export interface MergeResult {
  ev: MergeEvent;
  combo: number;
  dmg: number;
  crit: boolean;
  gold: number;
  shield: number;
  heal: number;
  stun: number;
  boost: number;
  boostMult: number;
}

export type GameEvent =
  | { type: 'merge'; r: MergeResult }
  | { type: 'hurt'; dmg: number; blocked: number }
  | { type: 'kill'; gold: number; boss: boolean }
  | { type: 'wave'; wave: number; boss: boolean }
  | { type: 'spawn'; ids: number[] }
  | { type: 'discard'; col: number; row: number }
  | { type: 'rebirth'; seconds: number }
  | { type: 'end'; report: ClearReport };

/** Renacer del Fénix: segundos de furia inmune y cuánto multiplica el daño mientras dura. */
export const REBIRTH_SECONDS = 8;
export const REBIRTH_DAMAGE = 2;
/** En la furia no hay defensa: los escudos se vuelven espadas y las pociones, rayos. */
const FURY_FAM: Partial<Record<Family, Family>> = { escudo: 'espada', pocion: 'rayo' };

type Listener = (e: GameEvent) => void;

/** Jugada anotada: [paso, 0 juntar, de col, de fila, a col, a fila] · [paso, 1 tirar, col, fila] · [paso, 2 abandonar]. */
export type RunAction = number[];

export class Game {
  s: GameState;
  private respawnDelay = 0;
  private listeners: Listener[] = [];
  rand = Math.random;

  /**
   * La pelea avanza en pasos fijos de 1/30 s y cada jugada se anota con el paso en que ocurrió.
   * Así el servidor puede rejugar la pelea exacta (misma semilla + mismas jugadas = mismo resultado)
   * y calcular él las recompensas: el celu no puede inventarlas.
   */
  static readonly STEP = 1 / 30;
  step = 0;
  log: RunAction[] = [];
  private acc = 0;

  constructor(s: GameState) {
    this.s = s;
  }

  on(l: Listener) {
    this.listeners.push(l);
  }

  private emit(e: GameEvent) {
    for (const l of this.listeners) l(e);
  }

  get respawning() {
    return this.respawnDelay > 0;
  }

  get fighting() {
    const run = this.s.run;
    return !!run && !run.result;
  }

  isBossWave(run: Run) {
    return run.wave >= WAVES_PER_LEVEL;
  }

  canStart(level: number): boolean {
    regenEnergy(this.s);
    return !this.s.run && level <= this.s.unlocked && this.s.energy >= ENERGY_COST;
  }

  private newPiece() {
    const p = randomPiece(pieceOdds(this.s), this.rand);
    if (this.s.run?.reborn?.left) p.fam = FURY_FAM[p.fam] ?? p.fam;
    return p;
  }

  /** El Caballero Fénix en nivel 40 renace una vez por nivel. */
  canRebirth(run: Run): boolean {
    return !run.duel && !run.reborn?.used && this.s.arms.skin === 'fenix' && (this.s.arsenal['fenix']?.lvl ?? 0) >= 40;
  }

  get furyLeft(): number {
    return this.s.run?.reborn?.left ?? 0;
  }

  private rebirth(run: Run) {
    run.heroHp = 1;
    run.shield = 0;
    run.reborn = { left: REBIRTH_SECONDS, used: true };
    // Las piezas de defensa arden y se vuelven de ataque (piezas nuevas, para que se vean cambiar).
    for (const col of run.grid)
      for (let r = 0; r < col.length; r++) {
        const p = col[r];
        const to = p && FURY_FAM[p.fam];
        if (p && to) {
          col[r] = makePiece(to, p.lvl);
        }
      }
    this.emit({ type: 'rebirth', seconds: REBIRTH_SECONDS });
    if (!hasPair(run.grid)) this.afterChange(run);
  }

  start(level: number): boolean {
    if (!this.canStart(level)) return false;
    this.s.energy -= ENERGY_COST;
    this.modsCache = null;
    this.s.run = {
      level,
      wave: 0,
      enemyInWave: 0,
      enemyHp: enemyHp(level, false),
      enemyTimer: enemyAttackSeconds(false),
      stun: 0,
      heroHp: maxHp(this.s),
      shield: maxHp(this.s) * Math.min(1, arsenalMods(this.s).startShield),
      boost: 0,
      boostMult: 1,
      look: {},
      grid: startingGrid(BASE_COLS + this.s.board.cols, BASE_ROWS + this.s.board.rows, pieceOdds(this.s), this.rand),
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      gold: 0,
      drops: 0,
      merges: 0,
      result: null,
    };
    this.respawnDelay = 0.6;
    this.step = 0;
    this.acc = 0;
    this.log = [];
    track(this.s, `start:${level}`);
    this.emit({ type: 'wave', wave: 0, boss: false });
    return true;
  }

  /**
   * Reto contra el jefe: sin energía ni premios. El jefe del nivel no muere (se le vuelve a llenar la vida)
   * y hay 60 segundos para hacerle todo el daño posible. Mismo nivel y misma semilla para todos.
   */
  startDuel(level: number): boolean {
    if (this.s.run || !Number.isInteger(level) || level < 1) return false;
    this.modsCache = null;
    const boss = true;
    this.s.run = {
      level,
      wave: WAVES_PER_LEVEL,
      enemyInWave: 0,
      enemyHp: enemyHp(level, boss),
      enemyTimer: enemyAttackSeconds(boss),
      stun: 0,
      heroHp: maxHp(this.s),
      shield: maxHp(this.s) * Math.min(1, arsenalMods(this.s).startShield),
      boost: 0,
      boostMult: 1,
      look: {},
      grid: startingGrid(BASE_COLS + this.s.board.cols, BASE_ROWS + this.s.board.rows, pieceOdds(this.s), this.rand),
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      gold: 0,
      drops: 0,
      merges: 0,
      result: null,
      duel: { left: DUEL_SECONDS, dmg: 0 },
    };
    this.respawnDelay = 1;
    this.step = 0;
    this.acc = 0;
    this.log = [];
    this.emit({ type: 'wave', wave: WAVES_PER_LEVEL, boss: true });
    return true;
  }

  /** Abandona el nivel actual (la energía no se devuelve). */
  abandon() {
    if (!this.fighting) return;
    this.log.push([this.step, 2]);
    this.finish(false);
  }

  /** Tira una pieza que no quieres; cae otra nueva en su lugar. */
  discardAt(at: Cell): boolean {
    const run = this.s.run;
    if (!run || run.result || !discard(run.grid, at)) return false;
    this.log.push([this.step, 1, at.col, at.row]);
    this.emit({ type: 'discard', col: at.col, row: at.row });
    this.afterChange(run);
    return true;
  }

  private afterChange(run: Run) {
    const added = refill(run.grid, () => this.newPiece());
    if (!hasPair(run.grid)) {
      // Nunca dejar el tablero sin jugadas: copia una pieza en otra casilla.
      const p = run.grid[0][0]!;
      const q = makePiece(p.fam, p.lvl);
      run.grid[run.grid.length - 1][run.grid[0].length - 1] = q;
      added.push(q);
    }
    run.drops += added.length;
    this.emit({ type: 'spawn', ids: added.map((p) => p.id) });
  }

  /** Junta dos piezas iguales. Devuelve true si se fusionaron. */
  merge(from: Cell, to: Cell): boolean {
    const run = this.s.run;
    if (!run || run.result) return false;
    const ev = mergePair(run.grid, from, to);
    if (!ev) return false;
    this.log.push([this.step, 0, from.col, from.row, to.col, to.row]);
    this.applyMerge(run, ev);
    // Caen piezas nuevas al instante para seguir juntando.
    if (!run.result) this.afterChange(run);
    return true;
  }

  private applyMerge(run: Run, ev: MergeEvent) {
    this.s.stats.merges++;
    this.bump('merges');
    run.merges++;
    run.combo = run.comboTimer > 0 ? run.combo + 1 : 1;
    run.comboTimer = comboTime(this.s) + this.mods.combo;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    this.bump('combo', run.combo, true);
    const v = pieceValue(ev.lvl, ev.size) * (ev.burst ? 3 : 1);
    const m = this.mods;
    const crit = this.rand() < critChance(this.s);
    // La mejor espada y el mejor escudo del nivel quedan en el héroe y dan un bonus fijo.
    if (ev.fam === 'espada') run.look.sword = Math.max(run.look.sword ?? 1, ev.lvl);
    if (ev.fam === 'escudo') run.look.shield = Math.max(run.look.shield ?? 1, ev.lvl);
    const boost = run.boost > 0 ? run.boostMult : 1;
    const hit = swordBonus(run.look.sword) * BASE_DAMAGE * levelPower(run.level) * damageMultiplier(this.s) * v * comboMultiplier(run.combo - 1) * (crit ? 2 + m.critMult : 1) * boost * (1 + m.dmg) * (run.reborn?.left ? REBIRTH_DAMAGE : 1);
    const hp = maxHp(this.s);
    const r: MergeResult = { ev, combo: run.combo, dmg: 0, crit, gold: 0, shield: 0, heal: 0, stun: 0, boost: 0, boostMult: 1 };
    const fam: Family = ev.fam;
    if (fam === 'espada') r.dmg = hit;
    else {
      r.dmg = hit * 0.25;
      if (fam === 'escudo') {
        r.shield = Math.min(hp - run.shield, hp * 0.05 * v * (1 + m.shield));
        run.shield += r.shield;
      } else if (fam === 'pocion') {
        r.heal = Math.min(hp - run.heroHp, hp * 0.04 * v * (1 + m.heal));
        run.heroHp += r.heal;
      } else if (fam === 'rayo') {
        // Potenciador: siempre dura lo mismo; el nivel sube cuánto multiplica.
        r.boost = boostSeconds(ev.lvl) + m.boostSec;
        r.boostMult = 1 + (boostMultiplier(ev.lvl) - 1) * (1 + m.boostMult);
        run.boostMult = run.boost > 0 ? Math.max(run.boostMult, r.boostMult) : r.boostMult;
        run.boost = Math.max(run.boost, r.boost);
      }
    }
    this.emit({ type: 'merge', r });
    if (r.dmg > 0 && run.duel) {
      run.duel.dmg += r.dmg;
      run.enemyHp -= r.dmg;
      const max = enemyHp(run.level, true);
      while (run.enemyHp <= 0) run.enemyHp += max; // el jefe del reto no muere
    } else if (r.dmg > 0) {
      run.enemyHp -= r.dmg;
      if (run.enemyHp <= 0) this.kill(run);
    }
  }

  private hurt(run: Run, dmg: number, blockable: boolean) {
    if (run.reborn?.left) return; // inmune durante la furia
    if (blockable) dmg *= Math.max(1 - CAPS.reduce, 1 - shieldReduction(run.look.shield) - this.mods.reduce);
    const blocked = blockable ? Math.min(run.shield, dmg) : 0;
    run.shield -= blocked;
    run.heroHp -= dmg - blocked;
    this.emit({ type: 'hurt', dmg: dmg - blocked, blocked });
    if (run.heroHp <= 0) {
      if (this.canRebirth(run)) return this.rebirth(run);
      run.heroHp = 0;
      this.finish(false);
    }
  }

  /** Avanza el tiempo real en pasos fijos (lo que usa la pantalla). */
  advance(dt: number) {
    this.acc += dt;
    while (this.acc >= Game.STEP) {
      this.acc -= Game.STEP;
      this.stepOnce();
    }
  }

  /** Un paso fijo de la pelea. El servidor usa esto mismo para rejugarla. */
  stepOnce() {
    const was = this.fighting;
    this.tick(Game.STEP);
    if (was) this.step++;
  }

  tick(dt: number) {
    regenEnergy(this.s);
    const run = this.s.run;
    if (!run || run.result) return;

    if (run.boost > 0) run.boost = Math.max(0, run.boost - dt);
    if (run.comboTimer > 0) {
      run.comboTimer -= dt;
      if (run.comboTimer <= 0) run.combo = 0;
    }

    if (run.reborn?.left) {
      run.reborn.left = Math.max(0, run.reborn.left - dt);
      if (run.reborn.left <= 0) {
        // Se acabó la furia sin ganar: ahora sí cae.
        run.heroHp = 0;
        this.finish(false);
        return;
      }
    }
    if (this.respawnDelay > 0) {
      this.respawnDelay -= dt;
      return;
    }
    if (run.duel) {
      run.duel.left = Math.max(0, run.duel.left - dt);
      if (run.duel.left <= 0) {
        this.finish(true);
        return;
      }
    }
    if (run.stun > 0) {
      run.stun = Math.max(0, run.stun - dt);
      return;
    }
    run.enemyTimer -= dt;
    if (run.enemyTimer <= 0) {
      const boss = this.isBossWave(run);
      run.enemyTimer = enemyAttackSeconds(boss);
      // En el reto el jefe pega una parte de tu vida: así un amigo nuevo también puede aguantar y competir.
      this.hurt(run, run.duel ? maxHp(this.s) * DUEL_HIT : enemyHit(run.level, boss), true);
    }
  }

  private kill(run: Run) {
    const boss = this.isBossWave(run);
    const gold = enemyGold(run.level, boss);
    run.gold += gold;
    this.s.gold += gold;
    this.s.stats.kills++;
    this.bump('kills');
    this.emit({ type: 'kill', gold, boss });

    if (boss) {
      this.finish(true);
      return;
    }
    this.respawnDelay = 0.35;
    run.enemyInWave++;
    if (run.enemyInWave >= ENEMIES_PER_WAVE) {
      run.wave++;
      run.enemyInWave = 0;
      // Pequeña curación entre oleadas.
      if (!run.reborn?.left) run.heroHp = Math.min(maxHp(this.s), run.heroHp + maxHp(this.s) * 0.15);
      this.respawnDelay = 0.9;
      this.emit({ type: 'wave', wave: run.wave, boss: this.isBossWave(run) });
    }
    run.enemyHp = enemyHp(run.level, this.isBossWave(run));
    run.enemyTimer = enemyAttackSeconds(this.isBossWave(run));
  }

  private finish(win: boolean) {
    const run = this.s.run!;
    run.result = win ? 'win' : 'lose';
    if (run.duel) {
      const damage = Math.round(run.duel.dmg);
      this.emit({ type: 'end', report: { level: run.level, win, stars: 0, gold: 0, gems: 0, points: 0, maxCombo: run.maxCombo, firstClear: false, shards: {}, damage } });
      return;
    }
    let stars = 0;
    let gems = 0;
    let points = 0;
    let firstClear = false;
    let shards: Record<string, number> = {};
    if (win) {
      stars = starsFor(run.heroHp / maxHp(this.s));
      firstClear = !this.s.stars[run.level];
      if (firstClear) {
        gems = firstClearGems(run.level);
        this.s.gems += gems;
      }
      // Fragmentos del Arsenal: más en la primera victoria y en los jefes de mundo.
      const worldBoss = run.level % LEVELS_PER_WORLD === 0;
      const total = (firstClear ? 10 + run.level * 2 : 3 + stars + Math.floor(run.level / 3)) * (worldBoss ? 2 : 1);
      shards = rollShards(total, ['espada', 'escudo', 'rayo'], this.rand, true);
      // Los jefes de mundo además dejan fragmentos de skin.
      if (worldBoss) for (const [id, n] of Object.entries(rollShards(10, ['skin'], this.rand, true))) shards[id] = (shards[id] ?? 0) + n;
      // Legendarias ya desbloqueadas: muy de vez en cuando, 1 fragmento (2 en jefe de mundo).
      for (const a of ARMS) {
        if (a.rarity !== 'legendaria' || !this.s.arsenal[a.id]?.lvl) continue;
        if (this.rand() < LEGEND_PLAY_CHANCE) shards[a.id] = (shards[a.id] ?? 0) + (worldBoss ? 2 : 1);
      }
      for (const id in shards) this.s.arsenal[id].shards += shards[id];
      this.s.stars[run.level] = Math.max(this.s.stars[run.level] ?? 0, stars);
      this.s.unlocked = Math.max(this.s.unlocked, run.level + 1);
      points = leaguePointsForClear(run.level, stars);
      this.s.league.points += points;
      this.s.stats.clears++;
      this.bump('clears');
      track(this.s, `clear:${run.level}:${stars}:${run.maxCombo}`);
    } else {
      this.s.stats.fails++;
      track(this.s, `fail:${run.level}:${run.wave}`);
    }
    this.emit({
      type: 'end',
      report: { level: run.level, win, stars, gold: run.gold, gems, points, maxCombo: run.maxCombo, firstClear, shards },
    });
  }

  // ---------- Misiones diarias y premio por entrar ----------

  /** Si cambió el día, las misiones vuelven a cero. */
  rollDay(now = Date.now()) {
    const d = dayNumber(now);
    const dl = this.s.daily;
    if (dl.day !== d) {
      dl.day = d;
      dl.prog = {};
      dl.claimed = [];
    }
    return dl;
  }

  /** Suma progreso a las misiones (el combo cuenta el mejor del día). */
  bump(stat: MissionStat, n = 1, best = false) {
    const p = this.rollDay().prog;
    p[stat] = best ? Math.max(p[stat] ?? 0, n) : (p[stat] ?? 0) + n;
  }

  /** Qué día de la racha toca hoy (0 a 6). Si ayer no entraste, vuelve al primero. */
  loginStep(now = Date.now()): number {
    const dl = this.s.daily;
    const d = dayNumber(now);
    if (dl.loginDay === d) return (dl.streak - 1 + 7) % 7;
    return dl.loginDay === d - 1 ? dl.streak % 7 : 0;
  }
  loginReady(now = Date.now()): boolean {
    return this.s.daily.loginDay !== dayNumber(now);
  }
  claimLogin(now = Date.now()): number | null {
    if (!this.loginReady(now)) return null;
    const step = this.loginStep(now);
    const gems = LOGIN_GEMS[step];
    this.s.gems += gems;
    this.s.daily.streak = step + 1;
    this.s.daily.loginDay = dayNumber(now);
    track(this.s, `login:${step + 1}`);
    return gems;
  }

  missionDone(m: Mission): boolean {
    return (this.rollDay().prog[m.stat] ?? 0) >= m.goal;
  }
  claimMission(id: string): number | null {
    const dl = this.rollDay();
    if (id === 'bonus') {
      if (dl.claimed.includes('bonus') || !DAILY_MISSIONS.every((m) => dl.claimed.includes(m.id))) return null;
      dl.claimed.push('bonus');
      this.s.gems += DAILY_BONUS;
      return DAILY_BONUS;
    }
    const m = DAILY_MISSIONS.find((x) => x.id === id);
    if (!m || dl.claimed.includes(id) || !this.missionDone(m)) return null;
    dl.claimed.push(id);
    this.s.gems += m.gems;
    track(this.s, `mission:${id}`);
    return m.gems;
  }
  /** Cuántos premios diarios hay para cobrar. */
  dailyReady(now = Date.now()): number {
    const dl = this.rollDay(now);
    const ms = DAILY_MISSIONS.filter((m) => !dl.claimed.includes(m.id) && this.missionDone(m)).length;
    const bonus = !dl.claimed.includes('bonus') && DAILY_MISSIONS.every((m) => dl.claimed.includes(m.id)) ? 1 : 0;
    return ms + bonus + (this.loginReady(now) ? 1 : 0);
  }

  /** Milisegundos que faltan para el cofre gratis (0 si ya está listo). */
  freeChestIn(now = Date.now()): number {
    return Math.max(0, this.s.freeChestAt + FREE_CHEST_HOURS * 3600_000 - now);
  }

  /**
   * Abre cofres de la tienda (1 o 10; 10 cuestan como 9). El de armas puede ser gratis cada pocas horas.
   * Cada 10 cofres de un tipo sale seguro una épica y cada 100 una legendaria (la mejor que exista).
   */
  openChest(id: string, free = false, count = 1): ChestResult | null {
    const chest = CHESTS.find((c) => c.id === id);
    if (!chest || this.s.run || (count !== 1 && count !== 10) || (free && count !== 1)) return null;
    if (free) {
      if (id !== 'armas' || this.freeChestIn() > 0) return null;
      this.s.freeChestAt = Date.now();
    } else {
      const price = chestPrice(chest.gems, count);
      if (this.s.gems < price) return null;
      this.s.gems -= price;
    }
    this.bump('chests', count);
    const got: Record<string, number> = {};
    const pity: { id: string; big: boolean }[] = [];
    const add = (k: string, n: number) => (got[k] = (got[k] ?? 0) + n);
    for (let i = 0; i < count; i++) {
      const n = (this.s.pulls[id] ?? 0) + 1;
      this.s.pulls[id] = n;
      for (const [k, v] of Object.entries(rollShards(free ? Math.round(chest.shards / 2) : chest.shards, chest.fams, this.rand))) add(k, v);
      if (n % PITY.bigEvery === 0) {
        const d = pityPick(chest.fams, PITY.bigRarity, this.rand);
        add(d.id, unlockShards(d.rarity));
        pity.push({ id: d.id, big: true });
      } else if (n % PITY.every === 0) {
        const d = pityPick(chest.fams, PITY.rarity, this.rand);
        add(d.id, Math.round(unlockShards(d.rarity) / 4));
        pity.push({ id: d.id, big: false });
      }
    }
    for (const k in got) this.s.arsenal[k].shards += got[k];
    track(this.s, `chest:${id}${free ? ':free' : ''}${count > 1 ? ':x' + count : ''}`);
    return { got, pity };
  }

  /** Prueba de administrador: desbloquea y equipa el set del Fénix (cuando haya cobros, será la compra). */
  /** Prueba de administrador: da el set del Fénix (y lo pone en `lvl`, para ver cada forma). */
  unlockFenix(lvl = 0): boolean {
    if (this.s.run) return false;
    for (const id of FENIX_SET) {
      const st = this.s.arsenal[id];
      if (st && lvl > 0) st.lvl = Math.max(1, Math.min(MAX_ARM_LEVEL, Math.floor(lvl)));
      else if (st && !st.lvl) st.lvl = 1;
      this.equipArm(id);
    }
    track(this.s, 'fenix_test');
    return true;
  }

  /** Compra oro con gemas. El oro de cada paquete crece con tu nivel. */
  buyGold(pack: number): number | null {
    const p = GOLD_PACKS[pack];
    if (!p || this.s.run || this.s.gems < p.gems) return null;
    const gold = goldPackAmount(pack, this.s.unlocked);
    this.s.gems -= p.gems;
    this.s.gold += gold;
    track(this.s, `gold_pack:${pack}`);
    return gold;
  }

  /** Cierra la pantalla de resultado y vuelve al mapa. */
  leave() {
    this.s.run = null;
  }

  /**
   * Ampliación del tablero: 1 fila y 1 columna como máximo, solo con dinero real (todavía sin cobro).
   * Por ahora la activa el botón de prueba en Ajustes.
   */
  setBoardExtra(kind: 'rows' | 'cols', on: boolean): boolean {
    if (this.s.run) return false;
    const max = kind === 'rows' ? MAX_EXTRA_ROWS : MAX_EXTRA_COLS;
    this.s.board[kind] = on ? max : 0;
    track(this.s, `board_test:${kind}:${on ? 1 : 0}`);
    return true;
  }

  /** Activa el pase mensual por 30 días (o los suma si ya estaba activo). Por ahora es de prueba, sin cobro. */
  activatePass(now = Date.now()) {
    this.s.passUntil = Math.max(now, this.s.passUntil) + PASS.days * 86400000;
    track(this.s, 'pass:activate');
  }

  /** Reemplaza el progreso (por ejemplo, con el que manda el servidor). */
  setState(s: GameState) {
    this.s = s;
    this.modsCache = null;
  }

  /** Llena la energía pagando gemas. */
  refillEnergy(): boolean {
    regenEnergy(this.s);
    if (this.s.run || this.s.gems < REFILL_GEMS) return false;
    this.s.gems -= REFILL_GEMS;
    this.s.energy = ENERGY_MAX;
    track(this.s, 'energy_refill');
    return true;
  }

  /** Modificadores del Arsenal. Se recalculan al empezar cada nivel. */
  private modsCache: Mods | null = null;
  get mods(): Mods {
    return (this.modsCache ??= arsenalMods(this.s));
  }

  /** Desbloquea o sube de nivel una variante. Devuelve qué pasó, o null si no alcanza. */
  upgradeArm(id: string): 'unlock' | 'up' | null {
    const def = armById(id);
    const st = this.s.arsenal[id];
    if (!def || !st || this.s.run) return null;
    if (st.lvl === 0) {
      if (st.shards < unlockShards(def.rarity)) return null;
      st.shards -= unlockShards(def.rarity);
      st.lvl = 1;
      track(this.s, `arm_unlock:${id}`);
      this.modsCache = null;
      return 'unlock';
    }
    if (st.lvl >= MAX_ARM_LEVEL || st.shards < upgradeShards(st.lvl) || this.s.gold < upgradeGold(st.lvl)) return null;
    st.shards -= upgradeShards(st.lvl);
    this.s.gold -= upgradeGold(st.lvl);
    st.lvl++;
    this.modsCache = null;
    return 'up';
  }

  equipArm(id: string): boolean {
    const def = armById(id);
    if (!def || !this.s.arsenal[id]?.lvl || this.s.run) return false;
    this.s.arms[def.fam] = id;
    this.modsCache = null;
    return true;
  }

  canBuy(id: UpgradeId): boolean {
    const def = upgradeDef(id);
    const lvl = this.s.upgrades[id];
    return lvl < def.max && this.s.gold >= upgradeCost(def, lvl);
  }

  buy(id: UpgradeId): boolean {
    if (!this.canBuy(id)) return false;
    const def = upgradeDef(id);
    this.s.gold -= upgradeCost(def, this.s.upgrades[id]);
    this.s.upgrades[id]++;
    return true;
  }
}
