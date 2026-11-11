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
  track,
  upgradeDef,
} from './state';
import { CHEST_GEMS, Item, LEVELS_PER_WORLD_ITEMS, duplicateGold, rollItem } from './items';

export interface Loot {
  item: Item;
  duplicate: boolean;
  gold: number;
}

export interface ClearReport {
  level: number;
  win: boolean;
  stars: number;
  gold: number;
  gems: number;
  points: number;
  maxCombo: number;
  firstClear: boolean;
  loot: Loot | null;
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
    this.s.run = {
      level,
      wave: 0,
      enemyInWave: 0,
      enemyHp: enemyHp(level, false),
      enemyTimer: enemyAttackSeconds(false),
      stun: 0,
      heroHp: maxHp(this.s),
      shield: 0,
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
    run.comboTimer = comboTime(this.s);
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const v = pieceValue(ev.lvl, ev.size) * (ev.burst ? 3 : 1);
    const crit = this.rand() < 0.08;
    const boost = run.boost > 0 ? run.boostMult : 1;
    const hit = BASE_DAMAGE * levelPower(run.level) * damageMultiplier(this.s) * v * comboMultiplier(run.combo - 1) * (crit ? 2 : 1) * boost;
    const hp = maxHp(this.s);
    const r: MergeResult = { ev, combo: run.combo, dmg: 0, crit, gold: 0, shield: 0, heal: 0, stun: 0, boost: 0, boostMult: 1 };
    const fam: Family = ev.fam;
    if (fam === 'espada') run.look.sword = ev.lvl;
    if (fam === 'escudo') run.look.shield = ev.lvl;
    if (fam === 'espada') r.dmg = hit;
    else {
      r.dmg = hit * 0.25;
      if (fam === 'escudo') {
        r.shield = Math.min(hp - run.shield, hp * 0.05 * v);
        run.shield += r.shield;
      } else if (fam === 'pocion') {
        r.heal = Math.min(hp - run.heroHp, hp * 0.04 * v);
        run.heroHp += r.heal;
      } else if (fam === 'rayo') {
        // Potenciador: siempre dura lo mismo; el nivel sube cuánto multiplica.
        r.boost = boostSeconds(ev.lvl);
        r.boostMult = boostMultiplier(ev.lvl);
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
    let loot: Loot | null = null;
    if (win) {
      stars = starsFor(run.heroHp / maxHp(this.s));
      firstClear = !this.s.stars[run.level];
      if (firstClear) {
        gems = firstClearGems(run.level);
        this.s.gems += gems;
      }
      // Equipo: siempre en la primera victoria, a veces al repetir.
      if (firstClear || Math.random() < 0.15) {
        const worldBoss = run.level % LEVELS_PER_WORLD_ITEMS === 0;
        const min = firstClear && (worldBoss || run.level === 1) ? 'rara' : 'común';
        loot = this.grant(rollItem(run.level / 25, min, firstClear ? this.s.items : []), run.level);
      }
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
      report: { level: run.level, win, stars, gold: run.gold, gems, points, maxCombo: run.maxCombo, firstClear, loot },
    });
  }

  /** Entrega una pieza; si ya la tenía, se convierte en oro. */
  private grant(item: Item, level: number): Loot {
    if (this.s.items.includes(item.id)) {
      const gold = duplicateGold(item, level);
      this.s.gold += gold;
      return { item, duplicate: true, gold };
    }
    this.s.items.push(item.id);
    track(this.s, `item:${item.id}`);
    return { item, duplicate: false, gold: 0 };
  }

  /** Cofre de equipo pagado con gemas: siempre rara o mejor. */
  openChest(): Loot | null {
    if (this.s.gems < CHEST_GEMS) return null;
    this.s.gems -= CHEST_GEMS;
    track(this.s, 'chest');
    return this.grant(rollItem(0.6, 'rara', this.s.items), this.s.unlocked);
  }

  equip(id: string, slot: Item['slot']) {
    if (this.s.items.includes(id)) this.s.equipped[slot] = id;
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
