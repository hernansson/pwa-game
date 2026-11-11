import {
  BOSS_CHEST,
  DROP_CHANCE,
  ENEMIES_PER_WAVE,
  ENERGY_COST,
  UpgradeId,
  WAVES_PER_LEVEL,
  dropLevel,
  enemyDps,
  enemyGold,
  enemyHp,
  firstClearGems,
  forgeCost,
  leaguePointsForClear,
  starsFor,
  upgradeCost,
} from './balance';
import {
  GameState,
  Run,
  attackRate,
  damagePerHit,
  goldMultiplier,
  maxHp,
  regenEnergy,
  track,
  upgradeDef,
} from './state';

export interface ClearReport {
  level: number;
  win: boolean;
  stars: number;
  gold: number;
  gems: number;
  points: number;
  drops: number;
  firstClear: boolean;
}

export type GameEvent =
  | { type: 'hit'; dmg: number; crit: boolean }
  | { type: 'hurt'; dmg: number }
  | { type: 'kill'; gold: number; boss: boolean }
  | { type: 'wave'; wave: number; boss: boolean }
  | { type: 'drop'; indexes: number[]; lost: number }
  | { type: 'end'; report: ClearReport };

type Listener = (e: GameEvent) => void;

export class Game {
  s: GameState;
  private attackClock = 0;
  private respawnDelay = 0;
  private endDelay = 0;
  private listeners: Listener[] = [];

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

  isBossWave(run: Run) {
    return run.wave >= WAVES_PER_LEVEL;
  }

  canStart(level: number): boolean {
    regenEnergy(this.s);
    return !this.s.run && level <= this.s.unlocked && this.s.energy >= ENERGY_COST;
  }

  start(level: number): boolean {
    if (!this.canStart(level)) return false;
    this.s.energy -= ENERGY_COST;
    this.s.run = {
      level,
      wave: 0,
      enemyInWave: 0,
      enemyHp: enemyHp(level, false),
      heroHp: maxHp(this.s),
      gold: 0,
      drops: 0,
      result: null,
    };
    this.attackClock = 0;
    this.respawnDelay = 0.6;
    this.endDelay = 0;
    track(this.s, `start:${level}`);
    this.emit({ type: 'wave', wave: 0, boss: false });
    return true;
  }

  /** Abandona el nivel actual (la energía no se devuelve). */
  abandon() {
    const run = this.s.run;
    if (!run || run.result) return;
    this.finish(false);
  }

  tick(dt: number) {
    regenEnergy(this.s);
    const run = this.s.run;
    if (!run) return;
    if (run.result) {
      this.endDelay -= dt;
      return;
    }
    if (this.respawnDelay > 0) {
      this.respawnDelay -= dt;
      return;
    }
    const boss = this.isBossWave(run);

    // El enemigo golpea al héroe de forma continua.
    const incoming = enemyDps(run.level, boss) * dt;
    run.heroHp -= incoming;
    if (Math.random() < dt * 1.2) this.emit({ type: 'hurt', dmg: enemyDps(run.level, boss) / 1.2 });
    if (run.heroHp <= 0) {
      run.heroHp = 0;
      this.finish(false);
      return;
    }

    this.attackClock += dt;
    const interval = 1 / attackRate(this.s);
    while (this.attackClock >= interval && !run.result) {
      this.attackClock -= interval;
      this.attack(run);
      if (this.respawnDelay > 0) break;
    }
  }

  private attack(run: Run) {
    const crit = Math.random() < 0.1;
    const dmg = damagePerHit(this.s) * (crit ? 2.5 : 1);
    run.enemyHp -= dmg;
    this.emit({ type: 'hit', dmg, crit });
    if (run.enemyHp <= 0) this.kill(run);
  }

  private dropWeapons(count: number, level: number): void {
    const indexes: number[] = [];
    let lost = 0;
    for (let i = 0; i < count; i++) {
      const idx = this.s.board.indexOf(null);
      if (idx === -1) {
        lost++;
        continue;
      }
      this.s.board[idx] = level;
      indexes.push(idx);
    }
    if (this.s.run) this.s.run.drops += indexes.length;
    this.emit({ type: 'drop', indexes, lost });
  }

  private kill(run: Run) {
    const boss = this.isBossWave(run);
    const gold = enemyGold(run.level, boss) * goldMultiplier(this.s);
    run.gold += gold;
    this.s.gold += gold;
    this.s.stats.kills++;
    this.emit({ type: 'kill', gold, boss });
    const lvl = dropLevel(run.level, this.s.upgrades.calidad);

    if (boss) {
      this.dropWeapons(BOSS_CHEST, lvl + 1);
      this.finish(true);
      return;
    }
    if (Math.random() < DROP_CHANCE) this.dropWeapons(1, lvl);

    this.respawnDelay = 1.0; // el héroe camina hasta el siguiente enemigo
    run.enemyInWave++;
    if (run.enemyInWave >= ENEMIES_PER_WAVE) {
      run.wave++;
      run.enemyInWave = 0;
      // Pequeña curación entre oleadas.
      run.heroHp = Math.min(maxHp(this.s), run.heroHp + maxHp(this.s) * 0.15);
      this.respawnDelay = 1.8;
      this.emit({ type: 'wave', wave: run.wave, boss: this.isBossWave(run) });
    }
    run.enemyHp = enemyHp(run.level, this.isBossWave(run));
  }

  private finish(win: boolean) {
    const run = this.s.run!;
    run.result = win ? 'win' : 'lose';
    this.endDelay = 1.2;
    let stars = 0;
    let gems = 0;
    let points = 0;
    let firstClear = false;
    if (win) {
      stars = starsFor(run.heroHp / maxHp(this.s));
      firstClear = !this.s.stars[run.level];
      if (firstClear) {
        gems = firstClearGems(run.level);
        this.s.gems += gems;
      }
      this.s.stars[run.level] = Math.max(this.s.stars[run.level] ?? 0, stars);
      this.s.unlocked = Math.max(this.s.unlocked, run.level + 1);
      points = leaguePointsForClear(run.level, stars);
      this.s.league.points += points;
      this.s.stats.clears++;
      track(this.s, `clear:${run.level}:${stars}`);
    } else {
      this.s.stats.fails++;
      track(this.s, `fail:${run.level}:${run.wave}`);
    }
    this.emit({
      type: 'end',
      report: { level: run.level, win, stars, gold: run.gold, gems, points, drops: run.drops, firstClear },
    });
  }

  /** Cierra la pantalla de resultado y vuelve al mapa. */
  leave() {
    this.s.run = null;
  }

  get forgePrice(): number {
    return forgeCost(this.s.forged, this.s.unlocked);
  }

  forge(): boolean {
    if (this.s.gold < this.forgePrice || !this.s.board.includes(null)) return false;
    this.s.gold -= this.forgePrice;
    this.s.forged++;
    this.dropWeapons(1, dropLevel(this.s.unlocked, this.s.upgrades.calidad));
    return true;
  }

  /** Mueve o fusiona armas. Devuelve 'merge', 'move', 'swap' o null. */
  drop(from: number, to: number): 'merge' | 'move' | 'swap' | null {
    const b = this.s.board;
    if (from === to || b[from] === null) return null;
    if (b[to] === null) {
      b[to] = b[from];
      b[from] = null;
      return 'move';
    }
    if (b[to] === b[from]) {
      b[to] = (b[to] as number) + 1;
      b[from] = null;
      this.s.stats.merges++;
      return 'merge';
    }
    [b[to], b[from]] = [b[from], b[to]];
    return 'swap';
  }

  /** Vende un arma por oro (para liberar lugar). */
  sell(index: number): number {
    const lvl = this.s.board[index];
    if (lvl === null) return 0;
    const value = Math.ceil(3 * Math.pow(2, lvl - 1));
    this.s.board[index] = null;
    this.s.gold += value;
    return value;
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
