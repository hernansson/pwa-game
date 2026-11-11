import {
  BOSS_TIME,
  PRESTIGE_MIN_WAVE,
  UpgradeId,
  enemyGold,
  enemyHp,
  isBoss,
  killsPerWave,
  leaguePointsForKill,
  soulsForPrestige,
  upgradeCost,
} from './balance';
import {
  GameState,
  attackRate,
  damagePerHit,
  forgeSeconds,
  goldMultiplier,
  newState,
  spawnLevel,
  track,
  upgradeDef,
} from './state';

export type GameEvent =
  | { type: 'hit'; dmg: number; crit: boolean }
  | { type: 'kill'; gold: number; boss: boolean }
  | { type: 'wave'; wave: number; boss: boolean }
  | { type: 'bossFail' }
  | { type: 'spawn'; index: number }
  | { type: 'gems'; amount: number; reason: string };

type Listener = (e: GameEvent) => void;

export class Game {
  s: GameState;
  private attackClock = 0;
  private respawnDelay = 0;
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

  tick(dt: number) {
    const s = this.s;
    // Forja: cae un arma nueva cada cierto tiempo si hay lugar.
    s.forgeProgress += dt / forgeSeconds(s);
    if (s.forgeProgress >= 1) {
      const idx = s.board.indexOf(null);
      if (idx !== -1) {
        s.board[idx] = spawnLevel(s);
        s.forgeProgress -= 1;
        this.emit({ type: 'spawn', index: idx });
      } else {
        s.forgeProgress = 1; // espera a que haya lugar
      }
    }

    if (this.respawnDelay > 0) {
      this.respawnDelay -= dt;
      return;
    }

    if (isBoss(s.wave) && !s.farming) {
      s.bossTimer -= dt;
      if (s.bossTimer <= 0) {
        // Perdió contra el jefe: vuelve a la oleada anterior a juntar fuerza.
        s.farming = true;
        s.wave -= 1;
        s.killsInWave = 0;
        s.enemyHp = enemyHp(s.wave);
        this.emit({ type: 'bossFail' });
        this.emit({ type: 'wave', wave: s.wave, boss: false });
        return;
      }
    }

    this.attackClock += dt;
    const interval = 1 / attackRate(s);
    while (this.attackClock >= interval) {
      this.attackClock -= interval;
      this.attack();
      if (this.respawnDelay > 0) break;
    }
  }

  private attack() {
    const s = this.s;
    const crit = Math.random() < 0.1;
    const dmg = damagePerHit(s) * (crit ? 2.5 : 1);
    s.enemyHp -= dmg;
    this.emit({ type: 'hit', dmg, crit });
    if (s.enemyHp <= 0) this.kill();
  }

  private kill() {
    const s = this.s;
    const boss = isBoss(s.wave) && !s.farming;
    const gold = enemyGold(s.wave) * goldMultiplier(s);
    s.gold += gold;
    s.league.points += leaguePointsForKill(s.wave);
    s.stats.kills++;
    this.emit({ type: 'kill', gold, boss });
    this.respawnDelay = 0.35;

    if (boss) {
      s.stats.bossesBeaten++;
      if (!s.bossFirstClears.includes(s.wave)) {
        s.bossFirstClears.push(s.wave);
        const gems = 3 + Math.floor(s.wave / 20);
        s.gems += gems;
        this.emit({ type: 'gems', amount: gems, reason: `Primer triunfo contra el jefe ${s.wave}` });
      }
    }

    s.killsInWave++;
    if (s.farming) {
      // Mientras junta fuerza, reintenta al jefe automáticamente cada 3 oleadas completas.
      if (s.killsInWave >= killsPerWave(s.wave) * 3) {
        s.farming = false;
        this.advance();
      } else {
        s.enemyHp = enemyHp(s.wave);
      }
      return;
    }
    if (s.killsInWave >= killsPerWave(s.wave)) this.advance();
    else s.enemyHp = enemyHp(s.wave);
  }

  private advance() {
    const s = this.s;
    s.wave += 1;
    s.killsInWave = 0;
    s.enemyHp = enemyHp(s.wave);
    if (isBoss(s.wave)) s.bossTimer = BOSS_TIME;
    s.maxWave = Math.max(s.maxWave, s.wave);
    s.bestWaveEver = Math.max(s.bestWaveEver, s.wave);
    this.emit({ type: 'wave', wave: s.wave, boss: isBoss(s.wave) });
  }

  /** Reintento manual del jefe mientras está juntando fuerza. */
  retryBoss() {
    const s = this.s;
    if (!s.farming) return;
    s.farming = false;
    this.advance();
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

  prestigeSouls(): number {
    return soulsForPrestige(this.s.maxWave);
  }

  canPrestige(): boolean {
    return this.s.maxWave >= PRESTIGE_MIN_WAVE && this.prestigeSouls() > 0;
  }

  prestige() {
    if (!this.canPrestige()) return;
    const old = this.s;
    const fresh = newState();
    // Se conserva lo permanente.
    fresh.playerName = old.playerName;
    fresh.gems = old.gems;
    fresh.souls = old.souls + this.prestigeSouls();
    fresh.bestWaveEver = old.bestWaveEver;
    fresh.skin = old.skin;
    fresh.ownedSkins = old.ownedSkins;
    fresh.league = old.league;
    fresh.stats = { ...old.stats, prestiges: old.stats.prestiges + 1 };
    fresh.bossFirstClears = old.bossFirstClears;
    fresh.events = old.events;
    track(fresh, `prestige:${old.maxWave}`);
    this.s = fresh;
    this.attackClock = 0;
    this.respawnDelay = 0;
  }
}
