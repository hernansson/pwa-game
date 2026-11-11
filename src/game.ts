import {
  APPROACH_SECONDS,
  AUTO_ATTACK_FACTOR,
  AUTO_ATTACK_RATE,
  BOSS_APPROACH_SECONDS,
  COMBO_WINDOW,
  ENEMIES_PER_WAVE,
  ENERGY_COST,
  MERGE_PUSHBACK,
  UpgradeId,
  WAVES_PER_LEVEL,
  comboMultiplier,
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
  autoDamage,
  goldMultiplier,
  maxHp,
  mergeDamage,
  regenEnergy,
  spawnSeconds,
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

export type GameEvent =
  | { type: 'hit'; dmg: number; crit: boolean; merge: boolean; combo: number }
  | { type: 'hurt'; dmg: number }
  | { type: 'kill'; gold: number; boss: boolean }
  | { type: 'wave'; wave: number; boss: boolean }
  | { type: 'drop'; indexes: number[]; lost: number }
  | { type: 'end'; report: ClearReport };

type Listener = (e: GameEvent) => void;

export class Game {
  s: GameState;
  private autoClock = 0;
  private respawnDelay = 0;
  private hurtClock = 0;
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

  start(level: number): boolean {
    if (!this.canStart(level)) return false;
    this.s.energy -= ENERGY_COST;
    this.s.board = this.s.board.map(() => null); // cada nivel arranca con el tablero vacío
    this.s.run = {
      level,
      wave: 0,
      enemyInWave: 0,
      enemyHp: enemyHp(level, false),
      enemyPos: 1,
      heroHp: maxHp(this.s),
      spawnClock: 0,
      combo: 0,
      comboTimer: 0,
      maxCombo: 0,
      gold: 0,
      drops: 0,
      result: null,
    };
    this.autoClock = 0;
    this.respawnDelay = 0.5;
    track(this.s, `start:${level}`);
    this.emit({ type: 'wave', wave: 0, boss: false });
    return true;
  }

  /** Abandona el nivel actual (la energía no se devuelve). */
  abandon() {
    if (this.fighting) this.finish(false);
  }

  tick(dt: number) {
    regenEnergy(this.s);
    const run = this.s.run;
    if (!run || run.result) return;

    // Lluvia de armas: es lo que alimenta el tablero durante el nivel.
    run.spawnClock += dt;
    const every = spawnSeconds(this.s);
    while (run.spawnClock >= every) {
      run.spawnClock -= every;
      this.dropWeapons(1, dropLevel(run.level, this.s.upgrades.calidad));
    }

    if (run.comboTimer > 0) {
      run.comboTimer -= dt;
      if (run.comboTimer <= 0) run.combo = 0;
    }

    if (this.respawnDelay > 0) {
      this.respawnDelay -= dt;
      return;
    }
    const boss = this.isBossWave(run);

    // El enemigo avanza hacia el héroe.
    run.enemyPos = Math.max(0, run.enemyPos - dt / (boss ? BOSS_APPROACH_SECONDS : APPROACH_SECONDS));
    if (run.enemyPos <= 0) {
      // Llegó: golpea al héroe, y el héroe responde con su arma equipada.
      const dps = enemyDps(run.level, boss);
      run.heroHp -= dps * dt;
      this.hurtClock += dt;
      if (this.hurtClock > 0.7) {
        this.hurtClock = 0;
        this.emit({ type: 'hurt', dmg: dps * 0.7 });
      }
      if (run.heroHp <= 0) {
        run.heroHp = 0;
        this.finish(false);
        return;
      }
      this.autoClock += dt;
      if (this.autoClock >= 1 / AUTO_ATTACK_RATE) {
        this.autoClock = 0;
        const crit = Math.random() < 0.1;
        this.damage(run, autoDamage(this.s, run.level) * AUTO_ATTACK_FACTOR * (crit ? 2.5 : 1), crit, false);
      }
    }
  }

  private damage(run: Run, dmg: number, crit: boolean, merge: boolean) {
    run.enemyHp -= dmg;
    this.emit({ type: 'hit', dmg, crit, merge, combo: run.combo });
    if (run.enemyHp <= 0) this.kill(run);
  }

  /** Golpe producido por una fusión durante el nivel. */
  private mergeAttack(level: number) {
    const run = this.s.run;
    if (!run || run.result || this.respawnDelay > 0) return;
    run.combo = run.comboTimer > 0 ? run.combo + 1 : 1;
    run.comboTimer = COMBO_WINDOW;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.enemyPos = Math.min(1, run.enemyPos + MERGE_PUSHBACK);
    const crit = Math.random() < 0.08;
    const dmg = mergeDamage(this.s, level) * comboMultiplier(run.combo - 1) * (crit ? 2 : 1);
    this.damage(run, dmg, crit, true);
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
    run.enemyPos = 1;
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

  /** Mueve o fusiona armas. Durante un nivel, cada fusión golpea al enemigo. */
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
      this.mergeAttack(b[to] as number);
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
