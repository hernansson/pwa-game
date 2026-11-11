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
  starsFor,
  upgradeCost,
} from './balance';
import { BASE_COLS, BASE_ROWS, Cell, Family, MAX_EXTRA_COLS, MAX_EXTRA_ROWS, MergeEvent, discard, hasPair, makePiece, mergePair, randomPiece, refill, startingGrid } from './board';
import {
  GameState,
  Run,
  comboTime,
  damageMultiplier,
  goldMultiplier,
  maxHp,
  pieceLevelTwoChance,
  regenEnergy,
  arsenalMods,
  track,
  upgradeDef,
} from './state';
import { CHESTS, FREE_CHEST_HOURS, MAX_ARM_LEVEL, Mods, armById, rollShards, unlockShards, upgradeGold, upgradeShards } from './arsenal';
import { LEVELS_PER_WORLD } from './balance';

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
}

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
  | { type: 'end'; report: ClearReport };

type Listener = (e: GameEvent) => void;

export class Game {
  s: GameState;
  private respawnDelay = 0;
  private listeners: Listener[] = [];
  rand = Math.random;

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
    return randomPiece(pieceLevelTwoChance(this.s), this.rand);
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
      grid: startingGrid(BASE_COLS + this.s.board.cols, BASE_ROWS + this.s.board.rows, pieceLevelTwoChance(this.s), this.rand),
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      gold: 0,
      drops: 0,
      merges: 0,
      result: null,
    };
    this.respawnDelay = 0.6;
    track(this.s, `start:${level}`);
    this.emit({ type: 'wave', wave: 0, boss: false });
    return true;
  }

  /** Abandona el nivel actual (la energía no se devuelve). */
  abandon() {
    if (this.fighting) this.finish(false);
  }

  /** Tira una pieza que no quieres; cae otra nueva en su lugar. */
  discardAt(at: Cell): boolean {
    const run = this.s.run;
    if (!run || run.result || !discard(run.grid, at)) return false;
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
    this.applyMerge(run, ev);
    // Caen piezas nuevas al instante para seguir juntando.
    if (!run.result) this.afterChange(run);
    return true;
  }

  private applyMerge(run: Run, ev: MergeEvent) {
    this.s.stats.merges++;
    run.merges++;
    run.combo = run.comboTimer > 0 ? run.combo + 1 : 1;
    run.comboTimer = comboTime(this.s) + this.mods.combo;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const v = pieceValue(ev.lvl, ev.size) * (ev.burst ? 3 : 1);
    const m = this.mods;
    const crit = this.rand() < 0.08 + m.crit;
    // La mejor espada y el mejor escudo del nivel quedan en el héroe y dan un bonus fijo.
    if (ev.fam === 'espada') run.look.sword = Math.max(run.look.sword ?? 1, ev.lvl);
    if (ev.fam === 'escudo') run.look.shield = Math.max(run.look.shield ?? 1, ev.lvl);
    const boost = run.boost > 0 ? run.boostMult : 1;
    const hit = swordBonus(run.look.sword) * BASE_DAMAGE * levelPower(run.level) * damageMultiplier(this.s) * v * comboMultiplier(run.combo - 1) * (crit ? 2 + m.critMult : 1) * boost * (1 + m.dmg);
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
    if (r.dmg > 0) {
      run.enemyHp -= r.dmg;
      if (run.enemyHp <= 0) this.kill(run);
    }
  }

  private hurt(run: Run, dmg: number, blockable: boolean) {
    if (blockable) dmg *= Math.max(0.2, 1 - shieldReduction(run.look.shield) - this.mods.reduce);
    const blocked = blockable ? Math.min(run.shield, dmg) : 0;
    run.shield -= blocked;
    run.heroHp -= dmg - blocked;
    this.emit({ type: 'hurt', dmg: dmg - blocked, blocked });
    if (run.heroHp <= 0) {
      run.heroHp = 0;
      this.finish(false);
    }
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

    if (this.respawnDelay > 0) {
      this.respawnDelay -= dt;
      return;
    }
    if (run.stun > 0) {
      run.stun = Math.max(0, run.stun - dt);
      return;
    }
    run.enemyTimer -= dt;
    if (run.enemyTimer <= 0) {
      const boss = this.isBossWave(run);
      run.enemyTimer = enemyAttackSeconds(boss);
      this.hurt(run, enemyHit(run.level, boss), true);
    }
  }

  private kill(run: Run) {
    const boss = this.isBossWave(run);
    const gold = enemyGold(run.level, boss) * goldMultiplier(this.s);
    run.gold += gold;
    this.s.gold += gold;
    this.s.stats.kills++;
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
      run.heroHp = Math.min(maxHp(this.s), run.heroHp + maxHp(this.s) * 0.15);
      this.respawnDelay = 0.9;
      this.emit({ type: 'wave', wave: run.wave, boss: this.isBossWave(run) });
    }
    run.enemyHp = enemyHp(run.level, this.isBossWave(run));
    run.enemyTimer = enemyAttackSeconds(this.isBossWave(run));
  }

  private finish(win: boolean) {
    const run = this.s.run!;
    run.result = win ? 'win' : 'lose';
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
      shards = rollShards(total, ['espada', 'escudo', 'rayo'], this.rand);
      // Los jefes de mundo además dejan fragmentos de skin.
      if (worldBoss) for (const [id, n] of Object.entries(rollShards(10, ['skin'], this.rand))) shards[id] = (shards[id] ?? 0) + n;
      for (const id in shards) this.s.arsenal[id].shards += shards[id];
      this.s.stars[run.level] = Math.max(this.s.stars[run.level] ?? 0, stars);
      this.s.unlocked = Math.max(this.s.unlocked, run.level + 1);
      points = leaguePointsForClear(run.level, stars);
      this.s.league.points += points;
      this.s.stats.clears++;
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

  /** Milisegundos que faltan para el cofre gratis (0 si ya está listo). */
  freeChestIn(now = Date.now()): number {
    return Math.max(0, this.s.freeChestAt + FREE_CHEST_HOURS * 3600_000 - now);
  }

  /** Abre un cofre de la tienda. El de armas puede ser gratis cada pocas horas. */
  openChest(id: string, free = false): Record<string, number> | null {
    const chest = CHESTS.find((c) => c.id === id);
    if (!chest || this.s.run) return null;
    if (free) {
      if (id !== 'armas' || this.freeChestIn() > 0) return null;
      this.s.freeChestAt = Date.now();
    } else {
      if (this.s.gems < chest.gems) return null;
      this.s.gems -= chest.gems;
    }
    const shards = rollShards(free ? Math.round(chest.shards / 2) : chest.shards, chest.fams, this.rand);
    for (const k in shards) this.s.arsenal[k].shards += shards[k];
    track(this.s, `chest:${id}${free ? ':free' : ''}`);
    return shards;
  }

  /** Cierra la pantalla de resultado y vuelve al mapa. */
  leave() {
    this.s.run = null;
  }

  /** Precio en gemas de la próxima ampliación del tablero, o null si ya está al máximo. */
  expandPrice(kind: 'rows' | 'cols'): number | null {
    const n = this.s.board[kind];
    if (kind === 'rows') return n >= MAX_EXTRA_ROWS ? null : [60, 120][n];
    return n >= MAX_EXTRA_COLS ? null : 150;
  }

  expand(kind: 'rows' | 'cols'): boolean {
    const price = this.expandPrice(kind);
    if (price === null || this.s.gems < price || this.s.run) return false;
    this.s.gems -= price;
    this.s.board[kind]++;
    track(this.s, `expand:${kind}:${this.s.board[kind]}`);
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
