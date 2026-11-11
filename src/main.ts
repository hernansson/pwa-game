import './style.css';
import {
  ENEMIES_PER_WAVE,
  ENERGY_COST,
  ENERGY_MAX,
  BOOST_SECONDS,
  CAPS,
  COMBO_WINDOW,
  LEVELS_PER_WORLD,
  UPGRADES,
  UpgradeId,
  WAVES_PER_LEVEL,
  enemyAttackSeconds,
  shieldReduction,
  swordBonus,
  enemyHp,
  upgradeCost,
} from './balance';
import { Skin, enemyName, enemySvg, famIcon, heroSvg, levelEnemy, levelEnemyName, levelEnemySvg, pieceFrame, pieceSvg, skinById } from './art';
import { Cell, FAMILIES, FAMILY_INFO, Family, colsOf, rowsOf } from './board';
import { ClearReport, Game, MergeResult } from './game';
import { RARITY_COLORS } from './items';
import {
  DIVISIONS,
  DIVISION_COLORS,
  LEAGUE_SIZE,
  PROMOTE,
  DEMOTE,
  rewardForRank,
  rolloverLeague,
  standings,
  timeLeftInWeek,
} from './league';
import { esc, fmt } from './format';
import { ARMS, ArmDef, ArmFam, CHESTS, LEVEL_STAT, MAX_ARM_LEVEL, armById, unlockShards, upgradeGold, upgradeShards } from './arsenal';
import {
  armShape,
  exportCode,
  critChance,
  importCode,
  load,
  maxHp,
  power,
  regenEnergy,
  resetSave,
  save,
  secondsToNextEnergy,
  track,
  damageMultiplier,
} from './state';

let game = new Game(load());
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const REFILL_GEMS = 30;
const WORLD_NAMES = ['Bosque Viscoso', 'Cuevas del Eco', 'Picos de Piedra'];

function worldOf(level: number) {
  return Math.ceil(level / LEVELS_PER_WORLD);
}
function worldName(w: number) {
  return WORLD_NAMES[(w - 1) % WORLD_NAMES.length] + (w > WORLD_NAMES.length ? ` ${Math.ceil(w / WORLD_NAMES.length)}` : '');
}
function myLook(): Skin {
  return skinById(armById(game.s.arms.skin)?.skin ?? 'caballero');
}
/** Dibujo de una variante del Arsenal en su diseño base. Los diseños de niveles más altos se descubren jugando. */
function armIcon(def: ArmDef): string {
  if (def.fam === 'skin') return heroSvg(skinById(def.skin ?? 'caballero'), 1);
  return pieceSvg(def.fam, 1, FAMILY_INFO[def.fam].color, def.shape);
}
/** El arma sola, sin el marco de la pieza, para la vitrina del Arsenal. */
function armShowcase(def: ArmDef): string {
  if (def.fam === 'skin') return armIcon(def);
  return `<svg viewBox="4 4 56 56" aria-hidden="true">${famIcon(def.fam, def.shape, 1, FAMILY_INFO[def.fam].color)}</svg>`;
}
function boardShape(f: Family): number {
  return f === 'pocion' ? 0 : armShape(game.s, f);
}
/** Si hay algo para hacer con una variante (desbloquearla o subirla). */
function armReady(def: ArmDef): boolean {
  const st = game.s.arsenal[def.id];
  if (st.lvl === 0) return st.shards >= unlockShards(def.rarity);
  return st.lvl < MAX_ARM_LEVEL && st.shards >= upgradeShards(st.lvl) && game.s.gold >= upgradeGold(st.lvl);
}
const VIP_FROM = 8; // la zona VIP aparece después de superar el nivel 7
function myHero(): string {
  return heroSvg(myLook(), 1, {
    swordShape: armShape(game.s, 'espada'),
    shield: 1,
    shieldShape: armShape(game.s, 'escudo'),
  });
}

// ---------- Estructura de la pantalla ----------

document.querySelector('#app')!.innerHTML = `
  <header class="topbar">
    <div class="res gold" title="Oro"><span class="ico">🪙</span><b id="gold">0</b></div>
    <div class="res gems" title="Gemas"><span class="ico">💠</span><b id="gems">0</b></div>
    <button class="res energy" id="energy" title="Energía"><span class="ico">⚡</span><b id="energy-val">0</b><small id="energy-time"></small></button>
    <button id="install" class="install" hidden>Instalar</button>
    <button class="gear" id="settings" aria-label="Ajustes">⚙️</button>
  </header>

  <section class="lobby" id="lobby">
    <div class="lobby-top">
      <button class="me-chip" data-open="heroe"><span class="me-hero" id="me-hero"></span><span><b id="me-name"></b><small>⚔️ <b id="me-power"></b></small></span></button>
    </div>
    <div class="lobby-main">
      <div class="rail left">
        <button class="rail-btn" data-open="cofres"><span class="ri">🎁</span><small id="rail-chest">Cofres</small><i class="dot" data-dot="cofres" hidden></i></button>
        <button class="rail-btn" data-open="liga"><span class="ri">🏆</span><small id="rail-league">Liga</small></button>
      </div>
      <div class="stage-card" id="stage-card"></div>
      <div class="rail right">
        <button class="rail-btn" data-open="eventos"><span class="ri">🐉</span><small>Eventos</small><em>Pronto</em></button>
        <button class="rail-btn vip" id="vip-btn" data-open="vip" hidden><span class="ri">👑</span><small>VIP</small></button>
      </div>
    </div>
    <div class="lobby-play" id="lobby-play"></div>
  </section>

  <section class="stage" id="stage" hidden>
    <div class="battle" id="battle">
      <div class="run-top">
        <button class="flee" id="flee" aria-label="Abandonar">✕</button>
        <div class="run-title" id="run-title"></div>
        <div class="route" id="route"></div>
      </div>
      <div class="arena">
        <div class="hero-wrap">
          <div class="hp hero-hp"><div class="hp-fill" id="hero-hp"></div><div class="shield-fill" id="hero-shield"></div></div>
          <div class="shield-label" id="shield-label"></div>
          <div class="gear-bonus" id="gear-bonus"></div>
          <div class="hero" id="hero"></div>
          <div class="hero-fx" id="hero-fx"></div>
          <div class="boost-ring" id="boost-ring"></div>
        </div>
        <div class="enemy-wrap">
          <div class="enemy-name" id="enemy-name"></div>
          <div class="hp"><div class="hp-fill" id="hp-fill"></div></div>
          <div class="atk" title="Próximo golpe"><div id="atk-fill"></div></div>
          <div class="enemy" id="enemy"></div>
        </div>
        <div class="fx" id="fx"></div>
      </div>
      <div class="combo" id="combo"></div>
      <div class="boost-label" id="boost-label"></div>
    </div>
  </section>

  <section class="lower" id="lower" hidden>
    <div class="forge" id="forge" hidden>
      <div class="legend" id="legend"></div>
      <div class="pboard" id="board">
        <div class="pieces" id="pieces"></div>
      </div>
      <p class="hint" id="hint">Arrastra una pieza sobre otra igual para juntarlas. Arrástrala hacia arriba, fuera del tablero, para tirarla.</p>
    </div>
  </section>

  <nav class="tabs" id="tabs">
    <button data-tab="heroe"><span>🧝</span>Héroe<i class="dot" data-dot="heroe" hidden></i></button>
    <button data-tab="arsenal"><span>⚔️</span>Arsenal<i class="dot" data-dot="arsenal" hidden></i></button>
    <button data-tab="cofres"><span>🎁</span>Cofres<i class="dot" data-dot="cofres" hidden></i></button>
    <button data-tab="liga"><span>🏆</span>Liga</button>
    <button data-tab="eventos"><span>🐉</span>Eventos</button>
  </nav>

  <div class="sheet" id="sheet" hidden>
    <div class="sheet-card">
      <div class="sheet-head"><div class="sheet-titles"><h2 id="sheet-title"></h2><small id="sheet-sub"></small></div><button class="close" id="sheet-close" aria-label="Cerrar">✕</button></div>
      <div class="sheet-body" id="sheet-body"></div>
    </div>
  </div>

  <div class="modal" id="modal" hidden><div class="modal-card" id="modal-card"></div></div>
`;

// ---------- Pantalla principal ----------

let viewLevel = game.s.unlocked;
let lobbyKey = '';
let rankCache = { t: 0, rank: 0 };

function leagueRank(): number {
  if (Date.now() - rankCache.t > 5000) rankCache = { t: Date.now(), rank: standings(game.s).findIndex((x) => x.isPlayer) + 1 };
  return rankCache.rank;
}

function renderLobby() {
  const s = game.s;
  viewLevel = Math.max(1, Math.min(s.unlocked, viewLevel));
  const lvl = viewLevel;
  const wait = game.freeChestIn();
  const key = `${lvl}:${s.unlocked}:${s.stars[lvl] ?? 0}:${s.playerName}:${power(s)}:${JSON.stringify(s.arms)}:${Math.ceil(wait / 60000)}:${leagueRank()}`;
  if (key === lobbyKey) return;
  lobbyKey = key;
  $('#me-hero').innerHTML = myHero();
  $('#me-name').textContent = s.playerName || 'Tu héroe';
  $('#me-power').textContent = fmt(power(s));
  $('#rail-chest').textContent = wait ? timeShort(wait) : '¡Gratis!';
  $('#rail-league').textContent = `#${leagueRank()}`;

  const world = worldOf(lvl);
  const first = (world - 1) * LEVELS_PER_WORLD + 1;
  const worldBoss = lvl % LEVELS_PER_WORLD === 0;
  const stars = s.stars[lvl] ?? 0;
  const e = levelEnemy(lvl);
  const track = Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
    const n = first + i;
    const cls = n === lvl ? 'now' : n > s.unlocked ? 'locked' : s.stars[n] ? 'done' : 'open';
    return `<i class="${cls} ${n % LEVELS_PER_WORLD === 0 ? 'crown' : ''}" data-view="${n}">${n % LEVELS_PER_WORLD === 0 ? '👑' : ''}</i>`;
  }).join('');
  $('#stage-card').innerHTML = `
    <div class="sc-bg" style="--h:${e.hue};--w:${(world * 67) % 360}"></div>
    <button class="world-name" data-worlds><small>Mundo ${world}</small><b>${worldName(world)}</b><span>🗺️</span></button>
    <div class="lvl-nav">
      <button data-step="-1" ${lvl <= 1 ? 'disabled' : ''} aria-label="Nivel anterior">‹</button>
      <div class="lvl-title"><small>${worldBoss ? 'Jefe del mundo' : 'Nivel'}</small><b>${lvl}</b></div>
      <button data-step="1" ${lvl >= s.unlocked ? 'disabled' : ''} aria-label="Nivel siguiente">›</button>
    </div>
    <div class="boss-art ${worldBoss ? 'world-boss' : ''}"><div class="boss-glow"></div>${levelEnemySvg(lvl, true)}</div>
    <div class="boss-name">${levelEnemyName(lvl, worldBoss)}</div>
    <div class="lvl-stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('')}</div>
    <div class="world-track">${track}</div>`;
  const cleared = lvl < s.unlocked;
  $('#lobby-play').innerHTML = `
    <button class="play big" data-level="${lvl}"><b>${cleared ? 'Repetir' : 'Jugar'}</b><span>⚡${ENERGY_COST}</span></button>
    <small class="play-note">${cleared ? 'Ya superado: repite por oro y fragmentos' : `${WAVES_PER_LEVEL} oleadas y el jefe · primera victoria: fragmentos + gemas`}</small>`;
}

function timeShort(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

function stepLevel(d: number) {
  const next = Math.max(1, Math.min(game.s.unlocked, viewLevel + d));
  if (next === viewLevel) return;
  viewLevel = next;
  renderLobby();
  restartAnim($('#stage-card'), d > 0 ? 'slide-l' : 'slide-r');
}

function showWorlds() {
  const s = game.s;
  const maxWorld = worldOf(s.unlocked);
  const rows = Array.from({ length: maxWorld + 1 }, (_, i) => {
    const w = maxWorld - i + 1; // el más nuevo arriba, y el próximo bloqueado como adelanto
    const first = (w - 1) * LEVELS_PER_WORLD + 1;
    const locked = first > s.unlocked;
    let st = 0;
    for (let n = first; n < first + LEVELS_PER_WORLD; n++) st += s.stars[n] ?? 0;
    const done = Math.max(0, Math.min(LEVELS_PER_WORLD, s.unlocked - first));
    return `<button class="world-row ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `data-goto-world="${w}"`} style="--h:${(w * 67) % 360}">
      <span class="wr-art">${locked ? '🔒' : levelEnemySvg(first + LEVELS_PER_WORLD - 1, true)}</span>
      <span class="wr-main"><small>Mundo ${w} · niveles ${first}-${first + LEVELS_PER_WORLD - 1}</small><b>${worldName(w)}</b>
        <i class="wr-bar"><i style="width:${done * 10}%"></i></i></span>
      <span class="wr-stars">${locked ? '' : `★ ${st}/${LEVELS_PER_WORLD * 3}`}</span>
    </button>`;
  }).join('');
  showModal(`<div class="worlds"><button class="x" data-close aria-label="Cerrar">✕</button><h2>Mundos</h2><div class="world-list">${rows}</div></div>`);
}

$('#lobby').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const open = t.closest('[data-open]') as HTMLElement | null;
  if (open) return openSheet(open.dataset.open as Tab);
  const step = t.closest('[data-step]') as HTMLElement | null;
  if (step) return stepLevel(Number(step.dataset.step));
  const view = t.closest('[data-view]') as HTMLElement | null;
  if (view && Number(view.dataset.view) <= game.s.unlocked) {
    viewLevel = Number(view.dataset.view);
    return renderLobby();
  }
  if (t.closest('[data-worlds]')) return showWorlds();
  const n = t.closest('[data-level]') as HTMLElement | null;
  if (n) startLevel(Number(n.dataset.level));
});

// Deslizar la tarjeta del nivel para pasar al anterior o al siguiente.
let swipeX: number | null = null;
$('#stage-card').addEventListener('pointerdown', (ev) => (swipeX = ev.clientX));
$('#stage-card').addEventListener('pointerup', (ev) => {
  if (swipeX === null) return;
  const dx = ev.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 50) stepLevel(dx < 0 ? 1 : -1);
});

function startLevel(level: number) {
  regenEnergy(game.s);
  if (game.s.energy < ENERGY_COST) {
    showEnergyModal();
    return;
  }
  if (game.start(level)) {
    heroKeyCache = enemyKeyCache = '';
    resetBoardView();
    closeSheet();
    hideModal();
  }
}

// ---------- Combate ----------

let heroKeyCache = '';
function renderHero() {
  const look = game.s.run?.look ?? {};
  const key = JSON.stringify(game.s.arms) + JSON.stringify(look);
  if (key === heroKeyCache) return;
  const changed = heroKeyCache !== '';
  heroKeyCache = key;
  // En combate, la espada y el escudo son los de la última fusión; las pociones dan brillo.
  $('#hero').innerHTML = heroSvg(myLook(), look.sword ?? 1, { shield: look.shield, swordShape: armShape(game.s, 'espada'), shieldShape: armShape(game.s, 'escudo') });
  if (changed) restartAnim($('#hero'), 'gear-up');
}

let enemyKeyCache = '';
function renderScreen() {
  const run = game.s.run;
  $('#lobby').hidden = !!run;
  $('#stage').hidden = !run;
  $('#lower').hidden = !run;
  $('#forge').hidden = !run;
  $('#app').classList.toggle('in-run', !!run);
  if (!run) {
    renderLobby();
    return;
  }
  renderBoard();
  const boss = game.isBossWave(run);
  renderHero();
  const ek = `${run.level}:${boss}`;
  if (ek !== enemyKeyCache) {
    enemyKeyCache = ek;
    const el = $('#enemy');
    el.innerHTML = levelEnemySvg(run.level, boss);
    el.classList.toggle('boss', boss);
    $('#enemy-name').textContent = boss ? levelEnemyName(run.level, run.level % LEVELS_PER_WORLD === 0) : enemyName(levelEnemy(run.level).wave, false);
  }
  const max = enemyHp(run.level, boss);
  $('#hp-fill').style.width = (game.respawning || run.result === 'win' ? 0 : Math.max(0, run.enemyHp / max) * 100) + '%';
  $('#hero-hp').style.width = Math.max(0, run.heroHp / maxHp(game.s)) * 100 + '%';
  $('#hero-hp').classList.toggle('low', run.heroHp / maxHp(game.s) < 0.3);
  $('#enemy').classList.toggle('dead', game.respawning || run.result === 'win');
  const hpMax = maxHp(game.s);
  $('#hero-shield').style.width = Math.min(1, run.shield / hpMax) * 100 + '%';
  $('#shield-label').textContent = run.shield >= 1 ? `🛡️ ${fmt(run.shield)}` : '';
  const atk = $('#atk-fill');
  atk.style.width = (run.stun > 0 ? 100 : Math.max(0, 1 - run.enemyTimer / enemyAttackSeconds(boss)) * 100) + '%';
  atk.parentElement!.classList.toggle('stunned', run.stun > 0);
  atk.parentElement!.classList.toggle('soon', run.stun <= 0 && run.enemyTimer < 1);
  $('#enemy').classList.toggle('stunned', run.stun > 0);
  const combo = $('#combo');
  const comboText = run.combo >= 2 && !run.result ? `COMBO x${run.combo}` : '';
  if (combo.textContent !== comboText) {
    combo.textContent = comboText;
    if (comboText) restartAnim(combo, 'pop');
  }
  $('#hero').classList.toggle('walking', game.respawning && !run.result && run.drops > 0);
  $('#hero').classList.toggle('down', run.result === 'lose');
  const boosted = run.boost > 0 && !run.result;
  const sw = run.look.sword ?? 1;
  const sh = run.look.shield ?? 1;
  const gb = [sw > 1 ? `⚔️ +${Math.round((swordBonus(sw) - 1) * 100)}%` : '', sh > 1 ? `🛡️ -${Math.round(shieldReduction(sh) * 100)}%` : '']
    .filter(Boolean)
    .join('  ');
  const gbe = $('#gear-bonus');
  if (gbe.textContent !== gb) {
    gbe.textContent = gb;
    restartAnim(gbe, 'pop');
  }
  // Potenciador: un aura pequeña sobre el héroe que crece con el nivel del rayo.
  const ring = $('#boost-ring');
  const bLvl = boosted ? Math.round((run.boostMult - 1) / 0.3) + 1 : 0;
  if (ring.dataset.l !== String(bLvl)) {
    ring.dataset.l = String(bLvl);
    ring.innerHTML = bLvl ? Array.from({ length: Math.min(6, bLvl - 1) }, (_, i) => `<i style="--i:${i};--n:${Math.min(6, bLvl - 1)}">⚡</i>`).join('') : '';
    ring.style.setProperty('--s', String(0.8 + Math.min(bLvl, 10) * 0.07));
  }
  ring.classList.toggle('on', boosted);
  const bl = $('#boost-label');
  bl.textContent = boosted ? `⚡ x${run.boostMult.toFixed(2).replace(/0$/, '')} ${run.boost.toFixed(1)}s` : '';
  $('#run-title').textContent = `Nivel ${run.level}`;
  const route: string[] = [];
  for (let w = 0; w < WAVES_PER_LEVEL; w++) {
    for (let e = 0; e < ENEMIES_PER_WAVE; e++) {
      const done = w < run.wave || (w === run.wave && e < run.enemyInWave);
      const now = w === run.wave && e === run.enemyInWave;
      route.push(`<i class="${done ? 'on' : ''} ${now ? 'now' : ''}"></i>`);
    }
    route.push('<b class="sep"></b>');
  }
  route.push(`<span class="boss-ico ${boss ? 'now' : ''}">👑</span>`);
  const html = route.join('');
  const r = $('#route');
  if (r.dataset.k !== html) {
    r.innerHTML = html;
    r.dataset.k = html;
  }
}

function floatText(text: string, cls: string, xPct = 72, yPct = 40) {
  const fx = $('#fx');
  if (fx.childElementCount > 14) fx.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  el.style.left = xPct + (Math.random() * 10 - 5) + '%';
  el.style.top = yPct + (Math.random() * 8 - 4) + '%';
  fx.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function toast(text: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function restartAnim(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Corte sobre el enemigo: más grande, con el color del material y más chispas según el nivel. */
function slashFx(lvl: number) {
  const fx = $('#fx');
  const el = document.createElement('div');
  el.className = 'slash';
  el.style.setProperty('--c', pieceFrame(lvl));
  el.style.setProperty('--s', String(0.7 + Math.min(lvl, 10) * 0.09));
  const sparks = Math.min(10, lvl * 1);
  el.innerHTML = '<b></b>' + Array.from({ length: sparks }, (_, i) => `<i style="--a:${(360 / sparks) * i + Math.random() * 20}deg;--d:${18 + lvl * 3}px"></i>`).join('');
  fx.appendChild(el);
  setTimeout(() => el.remove(), 500);
}

/** Curación: cruces verdes que suben desde el héroe; más cruces y más brillo con el nivel. */
function healFx(lvl: number) {
  const box = $('#hero-fx');
  const n = Math.min(8, 1 + lvl);
  const glow = document.createElement('div');
  glow.className = 'heal-glow';
  glow.style.setProperty('--o', String(Math.min(0.7, 0.2 + lvl * 0.08)));
  box.appendChild(glow);
  setTimeout(() => glow.remove(), 700);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = 'plus';
    p.textContent = '+';
    p.style.left = 20 + Math.random() * 55 + '%';
    p.style.animationDelay = i * 0.06 + 's';
    p.style.fontSize = 12 + Math.min(lvl, 8) * 1.5 + 'px';
    box.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

/** Rayo: una chispa amarilla sobre el héroe al activar el potenciador. */
function boltFx(lvl: number) {
  const box = $('#hero-fx');
  const b = document.createElement('div');
  b.className = 'bolt-pop';
  b.textContent = '⚡';
  b.style.fontSize = 18 + Math.min(lvl, 10) * 2.5 + 'px';
  box.appendChild(b);
  setTimeout(() => b.remove(), 600);
}

/** Efectos en pantalla de cada fusión. */
function onMergeFx(r: MergeResult) {
  const { ev } = r;
  burstAt(ev.col, ev.row, FAMILY_INFO[ev.fam].color, ev.burst || ev.size >= 4);
  if (r.dmg > 0) {
    restartAnim($('#hero'), 'attack');
    restartAnim($('#enemy'), 'hurt');
    const big = r.crit || r.combo >= 5 || ev.burst;
    floatText(fmt(r.dmg) + (r.crit ? '!' : ''), r.crit ? 'crit big' : ev.fam === 'espada' ? 'merge-hit' : 'dmg', 68, 34);
    if (ev.fam === 'espada' || big) restartAnim($('#stage'), big ? 'shake-big' : 'shake');
  }
  if (r.shield >= 1) floatText('+' + fmt(r.shield) + ' 🛡️', 'shield', 22, 30);
  if (r.heal >= 1) floatText('+' + fmt(r.heal) + ' ❤️', 'heal', 22, 40);
  if (r.stun > 0) floatText(`🔮 ${r.stun.toFixed(1)}s`, 'stun', 74, 22);
  if (r.boost > 0) {
    floatText(`⚡ x${r.boostMult.toFixed(2).replace(/0$/, '')}`, 'boost', 50, 30);
  }
  // Cuanto más alto el nivel, un poco mejor se ve el efecto (sin iluminar toda la pantalla).
  if (ev.fam === 'espada' && r.dmg > 0) slashFx(ev.lvl);
  if (r.heal > 0 || ev.fam === 'pocion') healFx(ev.lvl);
  if (r.boost > 0) boltFx(ev.lvl);
  if (ev.lvl >= 8) restartAnim($('#board'), 'quake');
  if (ev.burst) toast(`¡Explosión de ${FAMILY_INFO[ev.fam].name.toLowerCase()}!`);
  if (navigator.vibrate) navigator.vibrate(ev.burst ? 40 : 12);
}

function wireGame() {
  game.on((e) => {
    if (e.type === 'merge') onMergeFx(e.r);
    else if (e.type === 'hurt') {
      restartAnim($('#enemy'), 'lunge');
      if (e.dmg > 0) {
        restartAnim($('#hero'), 'hit');
        floatText('-' + fmt(e.dmg), 'ouch', 24, 34);
      }
      if (e.blocked > 0) floatText(`🛡️ ${fmt(e.blocked)}`, 'shield', 30, 22);
    } else if (e.type === 'kill') {
      floatText('+' + fmt(e.gold) + ' 🪙', 'gold', 70, 18);
    } else if (e.type === 'wave') {
      if (e.boss) toast('¡Llegó el jefe!');
    } else if (e.type === 'discard') {
      // La pieza sale volando por arriba.
    } else if (e.type === 'spawn') {
      for (const id of e.ids) fromTop.add(id);
    } else if (e.type === 'end') {
      setTimeout(() => showResult(e.report), 1100);
    }
  });
}
wireGame();

$('#flee').addEventListener('click', () => {
  if (confirm('¿Abandonar el nivel? No se devuelve la energía.')) game.abandon();
});

function shardList(sh: Record<string, number>, title = 'Fragmentos para el Arsenal'): string {
  const ids = Object.keys(sh);
  if (!ids.length) return '';
  return `<div class="shards-won"><small>${title}</small><div>${ids
    .map((id) => {
      const def = armById(id)!;
      return `<span style="--rar:${RARITY_COLORS[def.rarity]}" class="${def.fam === 'skin' ? 'skin' : ''}">${armIcon(def)}<b>+${sh[id]}</b><small>${def.name}</small></span>`;
    })
    .join('')}</div></div>`;
}

function showResult(r: ClearReport) {
  if (r.win) {
    const stars = [1, 2, 3].map((i) => `<span class="${i <= r.stars ? 'on' : ''}" style="animation-delay:${i * 0.15}s">★</span>`).join('');
    showModal(
      `<div class="result win"><div class="stars">${stars}</div><h2>¡Nivel ${r.level} superado!</h2>
      ${shardList(r.shards)}
      <div class="stat-row"><span>Oro</span><b>+${fmt(r.gold)} 🪙</b></div>
      <div class="stat-row"><span>Mejor combo</span><b>x${r.maxCombo}</b></div>
      <div class="stat-row"><span>Puntos de liga</span><b>+${fmt(r.points)}</b></div>
      ${r.gems ? `<div class="stat-row"><span>Primera victoria</span><b>+${r.gems} 💠</b></div>` : ''}
      <div class="btns"><button data-leave>Inicio</button><button data-next="${r.level + 1}" class="primary">Siguiente ⚡${ENERGY_COST}</button></div></div>`,
      true,
    );
  } else {
    showModal(
      `<div class="result lose"><div class="big-ico">💀</div><h2>Tu héroe cayó</h2>
      <p>Junta más rápido para hacer combo, sube piezas de nivel antes de usarlas y usa escudos y pociones cuando el enemigo aprieta. Sube tus armas en el Arsenal y tu entrenamiento en Héroe.</p>
      <div class="stat-row"><span>Oro</span><b>+${fmt(r.gold)} 🪙</b></div>
      <div class="stat-row"><span>Mejor combo</span><b>x${r.maxCombo}</b></div>
      <div class="btns"><button data-leave>Inicio</button><button data-next="${r.level}" class="primary">Reintentar ⚡${ENERGY_COST}</button></div></div>`,
      true,
    );
  }
}

// ---------- Tablero de piezas (solo durante el nivel) ----------

const piecesEl = $('#pieces');
const pieceEls = new Map<number, HTMLElement>();
const fromTop = new Set<number>();
let playedMerges = 0;

function renderLegend() {
  $('#legend').innerHTML = FAMILIES.map(
    (f) => `<span title="${FAMILY_INFO[f].effect}">${pieceSvg(f, 1, FAMILY_INFO[f].color, boardShape(f))}<small>${legendWord(f)}</small></span>`,
  ).join('');
}
renderLegend();
function legendWord(f: Family) {
  return { espada: 'daño', escudo: 'escudo', pocion: 'cura', rayo: 'poder' }[f];
}

function resetBoardView() {
  renderLegend();
  pieceEls.forEach((el) => el.remove());
  pieceEls.clear();
  fromTop.clear();
  playedMerges = 0;
  $('#hint').hidden = false;
}

let COLS = 5;
let ROWS = 6;
function cellPos(col: number, row: number) {
  return { left: (col * 100) / COLS + '%', bottom: (row * 100) / ROWS + '%' };
}

function burstAt(col: number, row: number, color: string, big: boolean) {
  const el = document.createElement('div');
  el.className = 'burst' + (big ? ' big' : '');
  const p = cellPos(col, row);
  el.style.left = p.left;
  el.style.bottom = p.bottom;
  el.style.setProperty('--c', color);
  piecesEl.appendChild(el);
  setTimeout(() => el.remove(), 500);
}

function renderBoard() {
  const run = game.s.run;
  if (!run) return;
  if (colsOf(run.grid) !== COLS || rowsOf(run.grid) !== ROWS) {
    COLS = colsOf(run.grid);
    ROWS = rowsOf(run.grid);
    const b = $('#board');
    b.style.setProperty('--cols', String(COLS));
    b.style.setProperty('--rows', String(ROWS));
  }
  const alive = new Set<number>();
  const spawnedInCol: number[] = Array(COLS).fill(0);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const p = run.grid[c][r];
      if (!p) continue;
      alive.add(p.id);
      const pos = cellPos(c, r);
      let el = pieceEls.get(p.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'pc';
        el.dataset.k = p.fam + p.lvl;
        el.dataset.col = String(c);
        el.innerHTML = pieceSvg(p.fam, p.lvl, FAMILY_INFO[p.fam].color, boardShape(p.fam));
        el.style.left = pos.left;
        if (fromTop.has(p.id)) {
          // Las piezas nuevas entran desde arriba del tablero y caen.
          fromTop.delete(p.id);
          el.style.bottom = 100 + (spawnedInCol[c]++ * 100) / ROWS + '%';
          el.classList.add('falling');
          piecesEl.appendChild(el);
          void el.offsetWidth;
        } else {
          el.style.bottom = pos.bottom;
          if (run.merges > 0) el.classList.add('born');
          piecesEl.appendChild(el);
        }
        pieceEls.set(p.id, el);
      }
      el.dataset.col = String(c);
      el.dataset.row = String(r);
      if (el.style.left !== pos.left) el.style.left = pos.left;
      if (el.style.bottom !== pos.bottom) el.style.bottom = pos.bottom;
    }
  }
  pieceEls.forEach((el, id) => {
    if (alive.has(id)) return;
    pieceEls.delete(id);
    el.classList.add('gone');
    setTimeout(() => el.remove(), 200);
  });
}

// Tocar una pieza la junta con la igual más cercana; arrastrarla la junta con la que sueltes.
let drag: { from: Cell; el: HTMLElement; x: number; y: number; moved: boolean } | null = null;

function cellFromPoint(x: number, y: number): Cell | null {
  const r = piecesEl.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
  const col = Math.min(COLS - 1, Math.floor(((x - r.left) / r.width) * COLS));
  const row = Math.min(ROWS - 1, Math.floor(((r.bottom - y) / r.height) * ROWS));
  return { col, row };
}

function markMatches(from: Cell | null) {
  const run = game.s.run;
  const p = from && run ? run.grid[from.col][from.row] : null;
  pieceEls.forEach((el) => {
    const q = run?.grid[Number(el.dataset.col)]?.[Number(el.dataset.row)];
    el.classList.toggle('match', !!p && !!q && q !== p && q.fam === p.fam && q.lvl === p.lvl);
  });
}

function doMerge(from: Cell, to: Cell) {
  if (!game.merge(from, to)) return false;
  playedMerges++;
  if (playedMerges >= 3) $('#hint').hidden = true;
  return true;
}

piecesEl.addEventListener('pointerdown', (ev) => {
  const from = cellFromPoint(ev.clientX, ev.clientY);
  if (!from || !game.fighting) return;
  const el = (ev.target as HTMLElement).closest('.pc') as HTMLElement | null;
  if (!el) return;
  ev.preventDefault();
  drag = { from, el, x: ev.clientX, y: ev.clientY, moved: false };
  el.classList.add('lifting');
  markMatches(from);
});

window.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const dx = ev.clientX - drag.x;
  const dy = ev.clientY - drag.y;
  if (Math.hypot(dx, dy) > 8) drag.moved = true;
  if (drag.moved) drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
});

function endDrag(ev: PointerEvent) {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.el.classList.remove('lifting');
  d.el.style.transform = '';
  markMatches(null);
  if (ev.type === 'pointercancel' || !d.moved) return;
  const top = piecesEl.getBoundingClientRect().top;
  if (ev.clientY < top - 10) {
    // Arrastrada hacia arriba, fuera del tablero: se descarta.
    const fly = d.el.cloneNode(true) as HTMLElement;
    fly.classList.remove('lifting', 'match');
    fly.classList.add('tossed');
    fly.style.transform = `translate(${ev.clientX - d.x}px, ${ev.clientY - d.y}px)`;
    piecesEl.appendChild(fly);
    setTimeout(() => fly.remove(), 400);
    d.el.style.visibility = 'hidden';
    if (game.discardAt(d.from)) track(game.s, 'discard');
    return;
  }
  const to = cellFromPoint(ev.clientX, ev.clientY);
  if (to && doMerge(d.from, to)) return;
  if (to) restartAnim(d.el, 'nope');
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

// ---------- Paneles ----------

type Tab = 'heroe' | 'arsenal' | 'cofres' | 'liga' | 'eventos' | 'vip';
let openTab: Tab | null = null;

const TAB_TITLES: Record<Tab, [string, string]> = {
  heroe: ['Tu héroe', 'Resumen y entrenamiento'],
  arsenal: ['Arsenal', 'Armas, potenciadores y skins'],
  cofres: ['Cofres', 'Fragmentos para el Arsenal'],
  liga: ['Liga semanal', 'Compite contra otros 29 héroes'],
  eventos: ['Eventos', 'Lo que viene'],
  vip: ['Zona VIP', 'Ventajas para los que van en serio'],
};

function openSheet(tab: Tab) {
  openTab = tab;
  $('#sheet').hidden = false;
  $('#sheet').dataset.tab = tab;
  $('#sheet-title').textContent = TAB_TITLES[tab][0];
  $('#sheet-sub').textContent = TAB_TITLES[tab][1];
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab));
  track(game.s, `open:${tab}`);
  $('#sheet-body').scrollTop = 0;
  renderSheet(true);
}

function closeSheet() {
  openTab = null;
  $('#sheet').hidden = true;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
}

/** Vuelve a dibujar la pestaña abierta sin perder dónde estaba el scroll. */
function refreshSheet() {
  if (!openTab) return;
  const body = $('#sheet-body');
  const scroll = body.scrollTop;
  renderSheet(true);
  body.scrollTop = scroll;
}

$('#tabs').addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button') as HTMLElement | null;
  if (!btn) return;
  const tab = btn.dataset.tab as Tab;
  if (openTab === tab) closeSheet();
  else openSheet(tab);
});
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (ev) => {
  if (ev.target === $('#sheet')) closeSheet();
});
$('#vip-btn').addEventListener('click', () => (openTab === 'vip' ? closeSheet() : openSheet('vip')));
$('#settings').addEventListener('click', showSettings);

/** Puntos de aviso en las pestañas: algo listo para subir o un cofre gratis. */
function renderDots() {
  const s = game.s;
  const dots: Record<string, boolean> = {
    heroe: UPGRADES.some((u) => game.canBuy(u.id)),
    arsenal: ARMS.some((a) => armReady(a)),
    cofres: game.freeChestIn() === 0,
  };
  document.querySelectorAll<HTMLElement>('[data-dot]').forEach((d) => (d.hidden = !dots[d.dataset.dot!]));
  $('#vip-btn').hidden = s.unlocked < VIP_FROM || !!s.run;
}

function section(title: string, sub: string, inner: string): string {
  return `<section class="sec"><div class="sec-head"><b>${title}</b><small>${sub}</small></div>${inner}</section>`;
}

function renderHeroSheet() {
  const s = game.s;
  const dmg = Math.round((damageMultiplier(s) * (1 + game.mods.dmg) - 1) * 100);
  const crit = Math.round(critChance(s) * 100);
  const skin = armById(s.arms.skin)!;
  const skinLvl = s.arsenal[skin.id].lvl;
  const talents = UPGRADES.map(
    (u) => `<button class="upgrade" data-up="${u.id}">
      <span class="u-ico">${u.icon}</span>
      <span class="u-main"><b>${u.name} <small data-lvl></small></b><span class="u-desc" data-desc></span></span>
      <span class="u-cost" data-cost></span>
    </button>`,
  ).join('');
  $('#sheet-body').innerHTML = `
    <div class="hero-card" style="--rar:${RARITY_COLORS[skin.rarity]}">
      <div class="hero-big">${myHero()}</div>
      <div class="hero-stats">
        <b class="hero-name">${esc(s.playerName || 'Tu héroe')}</b>
        <small class="hero-skin">${skin.name} · Nv ${skinLvl}</small>
        <div class="power-big"><small>Poder</small><b>${fmt(power(s))}</b></div>
      </div>
    </div>
    <div class="chips">
      <span><small>Vida</small><b>❤️ ${fmt(maxHp(s))}</b></span>
      <span><small>Daño</small><b>⚔️ +${dmg}%</b></span>
      <span><small>Crítico</small><b>🎯 ${crit}%</b></span>
    </div>
    ${section('Equipado', 'toca para verlo en el Arsenal', `<div class="gear-row">${(['espada', 'escudo', 'rayo', 'skin'] as ArmFam[])
      .map((f) => {
        const d = armById(s.arms[f])!;
        const lv = s.arsenal[d.id].lvl;
        return `<button class="gear-slot" data-goto-arm="${f}" style="--rar:${RARITY_COLORS[d.rarity]}"><div class="t-icon">${armIcon(d)}</div><b>${d.name}</b><small>Nv ${lv}</small></button>`;
      })
      .join('')}</div>`)}
    ${section('Estadísticas', 'todo lo que tienes activo', `<div class="stat-grid">${heroStats().map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`)}
    ${section('Habilidades activas', 'de lo que tienes equipado', activeSkills())}
    ${section('Entrenamiento', 'mejoras permanentes con oro', talents)}`;
  updateTalents();
}

/** Resumen de números del héroe: base + talentos + Arsenal. */
function heroStats(): [string, string][] {
  const s = game.s;
  const m = game.mods;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    ['❤️ Vida máxima', fmt(maxHp(s))],
    ['⚔️ Daño extra', '+' + pct(damageMultiplier(s) * (1 + m.dmg) - 1)],
    ['🎯 Crítico', `${pct(critChance(s))} (máx ${pct(CAPS.crit)})`],
    ['💥 Golpe crítico', `x${String(2 + m.critMult).replace('.', ',')}`],
    ['🛡️ Escudo por fusión', '+' + pct(m.shield)],
    ['🧱 Daño recibido', `${m.reduce ? '-' + pct(m.reduce) : '0%'} (máx -${pct(CAPS.reduce)})`],
    ['🔰 Escudo al empezar', m.startShield ? pct(m.startShield) + ' de la vida' : 'no'],
    ['⚡ Potenciador', `${String(BOOST_SECONDS + m.boostSec).replace('.', ',')} s · +${pct(m.boostMult)}`],
    ['🔥 Tiempo de combo', `${String(COMBO_WINDOW + m.combo).replace('.', ',')} s`],
    ['🧪 Curación', m.heal ? '+' + pct(m.heal) : 'normal'],
  ];
}

/** Habilidades desbloqueadas de todo lo equipado. */
function activeSkills(): string {
  const items: string[] = [];
  for (const f of ['espada', 'escudo', 'rayo', 'skin'] as ArmFam[]) {
    const d = armById(game.s.arms[f])!;
    const lv = game.s.arsenal[d.id].lvl;
    for (const sk of d.skills) if (lv >= sk.at) items.push(`<li><span class="t-icon">${armIcon(d)}</span><span>${sk.text}</span><small>${d.name}</small></li>`);
  }
  if (!items.length) return `<p class="note">Todavía ninguna. Sube tus armas y tu skin al nivel 5 en el Arsenal para desbloquear la primera habilidad de cada una.</p>`;
  return `<ul class="active-skills">${items.join('')}</ul>`;
}

function updateTalents() {
  $('#sheet-body')
    .querySelectorAll<HTMLElement>('.upgrade')
    .forEach((el) => {
      const id = el.dataset.up as UpgradeId;
      const def = UPGRADES.find((u) => u.id === id)!;
      const lvl = game.s.upgrades[id];
      const maxed = lvl >= def.max;
      el.querySelector('[data-lvl]')!.textContent = `Nv ${lvl}`;
      el.querySelector('[data-desc]')!.textContent = def.desc(lvl);
      el.querySelector('[data-cost]')!.textContent = maxed ? 'MÁX' : `🪙 ${fmt(upgradeCost(def, lvl))}`;
      el.classList.toggle('can', game.canBuy(id));
      el.classList.toggle('maxed', maxed);
    });
}

function expandBox(): string {
  const s = game.s;
  const btn = (kind: 'rows' | 'cols', label: string) => {
    const price = game.expandPrice(kind);
    return price === null
      ? `<button disabled>${label} ✓</button>`
      : `<button data-expand="${kind}" class="${s.gems >= price ? 'can' : ''}">${label} <span>💠 ${price}</span></button>`;
  };
  return `<div class="vip-card">
    <div class="vip-ico">▦</div>
    <div class="vip-main"><b>Tablero más grande</b><p>Ahora es de ${5 + s.board.cols}×${6 + s.board.rows}. Más piezas en pantalla, más parejas para juntar rápido.</p>
    <div class="expand-btns">${btn('rows', '+1 fila')}${btn('cols', '+1 columna')}</div></div>
  </div>`;
}

function renderVip() {
  $('#sheet-body').innerHTML = `
    <div class="vip-hero"><span>👑</span><p>Llegaste lejos. Acá están las mejoras especiales para tu héroe.</p></div>
    ${expandBox()}
    <div class="vip-card soon">
      <div class="vip-ico">🚫</div>
      <div class="vip-main"><b>Sin anuncios</b><p>Juega sin interrupciones para siempre.</p><button data-interest="noads">¡Me interesa!</button></div>
    </div>
    <div class="vip-card soon">
      <div class="vip-ico">✨</div>
      <div class="vip-main"><b>Pase VIP</b><p>Animaciones especiales, un cofre gratis extra por día y empezar niveles con piezas de nivel 2.</p><button data-interest="vippass">¡Me interesa!</button></div>
    </div>
    <div class="vip-card">
      <div class="vip-ico">💠</div>
      <div class="vip-main"><b>Gemas</b><p>Ganas gemas con las primeras victorias y con los premios de la liga.</p><button data-gemshop>Comprar gemas</button></div>
    </div>`;
}

// ---------- Cofres ----------

function timeText(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

function renderChests() {
  const s = game.s;
  const wait = game.freeChestIn();
  const free = CHESTS.find((c) => c.id === 'armas')!;
  $('#sheet-body').innerHTML = `
    <div class="free-chest ${wait ? '' : 'ready'}">
      <div class="chest-art">🎁</div>
      <div class="fc-main"><small>Cofre gratis</small><b>${free.name}</b><span data-free-timer>${wait ? `Listo en ${timeText(wait)}` : `${Math.round(free.shards / 2)} fragmentos de regalo`}</span></div>
      <button data-free-chest ${wait ? 'disabled' : ''}>${wait ? 'Esperando' : 'Abrir'}</button>
    </div>
    <div class="chests">${CHESTS.map(
      (c) => `<div class="chest-card c-${c.id}">
        <div class="chest-art">${c.icon}</div>
        <b>${c.name}</b>
        <p>${c.desc}</p>
        <small>${c.shards} fragmentos</small>
        <button data-chest="${c.id}" class="${s.gems >= c.gems ? 'can' : ''}">💠 ${c.gems}</button>
      </div>`,
    ).join('')}</div>
    <p class="note">También ganas fragmentos al superar niveles. Los jefes de mundo (cada 10 niveles) dan el doble y además fragmentos de skin.</p>`;
}

function openChestUi(id: string, free: boolean) {
  const chest = CHESTS.find((c) => c.id === id)!;
  const got = game.openChest(id, free);
  if (!got) {
    if (!free) {
      track(game.s, `chest_nogems:${id}`);
      toast(`Te faltan ${chest.gems - game.s.gems} 💠`);
    }
    return;
  }
  save(game.s);
  refreshSheet();
  const tab = 'arsenal';
  armTab = chest.fams[0];
  showModal(`<div class="result"><div class="big-ico chest-open">${chest.icon}</div><h2>¡${chest.name}!</h2>${shardList(got, 'Conseguiste')}
    <div class="btns"><button data-close>Genial</button><button data-goto="${tab}" class="primary">Ver en el Arsenal</button></div></div>`);
}

// ---------- Arsenal ----------

const FAM_TITLES: Record<ArmFam, string> = { espada: 'Espadas', escudo: 'Escudos', rayo: 'Potenciadores', skin: 'Skins' };



let armTab: ArmFam = 'espada';
const armSel: Partial<Record<ArmFam, string>> = {};
const ARM_TABS: [ArmFam, string, string][] = [['espada', '⚔️', 'Espadas'], ['escudo', '🛡️', 'Escudos'], ['rayo', '⚡', 'Poder'], ['skin', '🎭', 'Skins']];

/** Botones de desbloquear / subir / usar de una variante. */
function armButtons(def: ArmDef): string {
  const id = def.id;
  const st = game.s.arsenal[id];
  const locked = st.lvl === 0;
  const equipped = game.s.arms[def.fam] === id;
  let action = '';
  if (locked) {
    const need = unlockShards(def.rarity);
    action = `<button data-arm-up="${id}" class="primary" ${st.shards >= need ? '' : 'disabled'}>Desbloquear<small>🧩 ${st.shards}/${need}</small></button>`;
  } else if (st.lvl < MAX_ARM_LEVEL) {
    const sh = upgradeShards(st.lvl);
    const g = upgradeGold(st.lvl);
    const can = st.shards >= sh && game.s.gold >= g;
    action = `<button data-arm-up="${id}" class="primary" ${can ? '' : 'disabled'}>Subir a Nv ${st.lvl + 1}<small>🧩 ${st.shards}/${sh} · 🪙 ${fmt(g)}</small></button>`;
  } else action = `<button disabled>Nivel máximo</button>`;
  const use = !locked && !equipped ? `<button data-arm-equip="${id}">Usar</button>` : equipped ? `<button disabled>En uso ✓</button>` : '';
  return use + action;
}

function armSkills(def: ArmDef, more = true): string {
  const lvl = game.s.arsenal[def.id].lvl;
  const stat = LEVEL_STAT[def.fam];
  return (
    def.skills.map((sk) => `<li class="${lvl >= sk.at ? 'got' : ''}"><b>Nv ${sk.at}</b><span>${sk.text}</span><i>${lvl >= sk.at ? '✓' : '🔒'}</i></li>`).join('') +
    (more ? `<li class="more"><b>41+</b><span>+${Math.round(stat.per * 100)}% de ${stat.label} por nivel</span></li>` : '')
  );
}

/** Categorías de variantes: las últimas son las pagas. */
const ARM_CATS: [string, string[], boolean][] = [
  ['Básicas', ['común'], false],
  ['Avanzadas', ['rara', 'épica'], false],
  ['Premium 👑', ['legendaria'], true],
];

/** Variante en chiquito, para que entren muchas. */
function armTile(def: ArmDef, sel: boolean): string {
  const st = game.s.arsenal[def.id];
  const locked = st.lvl === 0;
  const need = locked ? unlockShards(def.rarity) : upgradeShards(st.lvl);
  const equipped = game.s.arms[def.fam] === def.id;
  return `<button class="tile ${locked ? 'locked' : ''} ${equipped ? 'on' : ''} ${sel ? 'sel' : ''} ${armReady(def) ? 'ready' : ''}" data-arm="${def.id}" style="--rar:${RARITY_COLORS[def.rarity]}" title="${esc(def.name)}">
    <div class="t-icon">${armIcon(def)}${locked ? '<span class="lock">🔒</span>' : ''}</div>
    <small>${locked ? '' : `Nv ${st.lvl}`}</small>
    <i class="t-bar"><i style="width:${Math.min(100, (st.shards / need) * 100)}%"></i></i>
  </button>`;
}

function renderArsenal() {
  const fam = armTab;
  const list = ARMS.filter((a) => a.fam === fam);
  const def = armById(armSel[fam] ?? game.s.arms[fam]) ?? list[0];
  const st = game.s.arsenal[def.id];
  const locked = st.lvl === 0;
  const stat = LEVEL_STAT[fam];
  const total = Math.round(stat.per * Math.max(0, st.lvl - 1) * 100);
  $('#sheet-body').innerHTML = `
    <div class="seg">${ARM_TABS.map(
      ([f, ico, label]) => `<button data-arm-tab="${f}" class="${f === fam ? 'on' : ''}"><span>${ico}</span>${label}${ARMS.some((a) => a.fam === f && armReady(a)) ? '<i class="dot"></i>' : ''}</button>`,
    ).join('')}</div>
    <div class="showcase" style="--rar:${RARITY_COLORS[def.rarity]}">
      <div class="sc-art ${locked ? 'locked' : ''}">${armShowcase(def)}${locked ? '<span class="lock">🔒</span>' : ''}</div>
      <div class="sc-info">
        <small class="rar">${def.rarity.toUpperCase()}</small>
        <h3>${def.name}</h3>
        <p class="sc-lvl">${locked ? 'Bloqueada' : `Nivel ${st.lvl} · +${total}% de ${stat.label}`}<br><span>+${Math.round(stat.per * 100)}% de ${stat.label} por nivel</span></p>
        <ul class="skills mini">${armSkills(def, false)}</ul>
      </div>
    </div>
    <div class="sc-btns btns">${armButtons(def)}</div>
    <div class="sec-head var-head"><b>Variantes</b><small>cada nivel +${Math.round(stat.per * 100)}% de ${stat.label}</small></div>
    ${ARM_CATS.map(([title, rars, premium]) => {
      const items = list.filter((x) => rars.includes(x.rarity));
      const tiles = items.map((x) => armTile(x, x.id === def.id)).join('') + (premium ? '<div class="tile soon"><span>👑</span><small>Pronto</small></div>'.repeat(Math.max(1, 5 - items.length)) : '');
      return `<div class="cat ${premium ? 'premium' : ''}"><small>${title}</small><div class="tiles">${tiles}</div></div>`;
    }).join('')}
    <p class="note">Consigue fragmentos superando niveles o abriendo cofres. La variante en uso define cómo se ven sus piezas en el tablero.</p>`;
}

/** Desbloquear, subir o usar una variante. Devuelve true si el clic era de esto. */
/**
 * Festejo al subir algo. Los niveles comunes muestran un aviso corto con lo que ganaste;
 * desbloquear o llegar a un nivel con habilidad (5, 10, 20, 40) muestra una pantalla completa.
 */
function celebrate(def: ArmDef, kind: 'unlock' | 'up') {
  const lvl = game.s.arsenal[def.id].lvl;
  const stat = LEVEL_STAT[def.fam];
  const skill = def.skills.find((sk) => sk.at === lvl);
  const el = document.createElement('div');
  const art = `<div class="cel-art">${armShowcase(def)}</div>`;
  if (kind === 'up' && !skill) {
    el.className = 'cel small';
    el.style.setProperty('--rar', RARITY_COLORS[def.rarity]);
    el.innerHTML = `<div class="cel-card">${art}<div><small>${def.name}</small><b>Nivel ${lvl}</b><span>+${Math.round(stat.per * 100)}% de ${stat.label}</span></div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
    if (navigator.vibrate) navigator.vibrate(15);
    return;
  }
  el.className = 'cel big';
  el.style.setProperty('--rar', RARITY_COLORS[def.rarity]);
  const sparks = Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--d:${110 + (i % 3) * 30}px;--t:${0.15 + (i % 4) * 0.05}s"></i>`).join('');
  el.innerHTML = `<div class="cel-rays"></div><div class="cel-sparks">${sparks}</div>
    <div class="cel-body">
      <small class="cel-kicker">${kind === 'unlock' ? '¡Desbloqueada!' : '¡Nueva habilidad!'}</small>
      ${art}
      <h2>${def.name}</h2>
      ${kind === 'unlock' ? `<p class="cel-rar">${def.rarity.toUpperCase()} · ya la tienes en uso</p><p>Llega al nivel 5 para su primera habilidad: <b>${def.skills[0].text}</b></p>` : `<p class="cel-lvl">Nivel ${lvl}</p><div class="cel-skill">${skill!.text}</div>`}
      <button data-cel-close>¡Genial!</button>
    </div>`;
  el.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('[data-cel-close]') || ev.target === el) el.remove();
  });
  document.body.appendChild(el);
  if (navigator.vibrate) navigator.vibrate([30, 60, 40]);
  track(game.s, `celebrate:${kind}:${def.id}:${lvl}`);
}

function armAction(t: HTMLElement, inModal: boolean): boolean {
  const upEl = t.closest('[data-arm-up]') as HTMLElement | null;
  const eqEl = t.closest('[data-arm-equip]') as HTMLElement | null;
  if (!upEl && !eqEl) return false;
  const id = (upEl?.dataset.armUp ?? eqEl!.dataset.armEquip)!;
  let ok = false;
  if (upEl) {
    const r = game.upgradeArm(id);
    if (r) {
      if (r === 'unlock') game.equipArm(id);
      celebrate(armById(id)!, r);
      ok = true;
    }
  } else ok = game.equipArm(id);
  if (ok) {
    lobbyKey = heroKeyCache = '';
    renderLegend();
    save(game.s);
    if (inModal) showArm(id);
    refreshSheet();
  }
  return true;
}

function showArm(id: string) {
  const def = armById(id)!;
  const st = game.s.arsenal[id];
  const locked = st.lvl === 0;
  const stat = LEVEL_STAT[def.fam];
  const total = Math.round(stat.per * Math.max(0, st.lvl - 1) * 100);
  const isSkin = def.fam === 'skin';
  showModal(`<div class="arm-detail" style="--rar:${RARITY_COLORS[def.rarity]}">
    <button class="x" data-close aria-label="Cerrar">✕</button>
    <div class="arm-big ${isSkin ? 'skin' : ''}">${armIcon(def)}</div>
    <small class="rar">${def.rarity.toUpperCase()} · ${FAM_TITLES[def.fam]}</small>
    <h2>${def.name}</h2>
    <p class="muted">${locked ? 'Bloqueada' : `Nivel ${st.lvl} de ${MAX_ARM_LEVEL} · +${total}% de ${stat.label}`}</p>
    <ul class="skills">${armSkills(def)}</ul>
    <div class="btns">${armButtons(def)}</div>
  </div>`);
}

function renderLeague(full: boolean) {
  const body = $('#sheet-body');
  const sig = String(Math.floor(Date.now() / 3000));
  if (!full && body.dataset.sig === sig) return;
  body.dataset.sig = sig;
  const s = game.s;
  const list = standings(s);
  const div = s.league.division;
  const rank = list.findIndex((x) => x.isPlayer) + 1;
  const scroll = body.scrollTop;
  const mySkin = armById(s.arms.skin)!;
  body.innerHTML = `
    <div class="league-head" style="--div:${DIVISION_COLORS[div]}">
      <div class="div-badge">${DIVISIONS[div]}</div>
      <div><b>Puesto ${rank} de ${LEAGUE_SIZE}</b><br><small>Cierra en ${timeLeftInWeek(s)} · premio actual ${rewardForRank(rank)} 💠</small></div>
    </div>
    <p class="note">Los ${PROMOTE} primeros suben de división y los ${DEMOTE} últimos bajan. Sumas puntos al superar niveles, más con 3 estrellas.</p>
    <ol class="ranking">${list
      .map((r, i) => {
        const zone = i < PROMOTE ? 'up' : i >= LEAGUE_SIZE - DEMOTE ? 'down' : '';
        const sk = r.isPlayer ? null : skinById(r.skin);
        const art = r.isPlayer ? myHero() : heroSvg(sk!, Math.min(10, r.weapon));
        const label = r.isPlayer ? mySkin.name : sk!.name;
        const rar = r.isPlayer ? mySkin.rarity : sk!.rarity;
        return `<li class="${zone} ${r.isPlayer ? 'me' : ''} rar-${rar}">
          <span class="pos">${i + 1}</span>
          <span class="mini">${art}</span>
          <span class="who">${esc(r.name)}${r.isPlayer ? ' (tú)' : ''}<small>${label}</small></span>
          <span class="pts">${fmt(r.points)}</span>
        </li>`;
      })
      .join('')}</ol>
    <p class="note small">Versión de prueba: los rivales son simulados hasta que conectemos el servidor.</p>`;
  body.scrollTop = scroll;
  if (full) body.querySelector('.me')?.scrollIntoView({ block: 'center' });
}

function renderSheet(full: boolean) {
  if (!openTab) return;
  const body = $('#sheet-body');
  if (openTab === 'liga') return renderLeague(full);
  if (openTab === 'heroe') return full ? renderHeroSheet() : updateTalents();
  if (openTab === 'cofres') {
    if (full) return renderChests();
    // Si el cofre gratis quedó listo, se vuelve a dibujar; si no, solo el contador.
    const wait = game.freeChestIn();
    const btn = body.querySelector('[data-free-chest]');
    if (btn && btn.hasAttribute('disabled') !== wait > 0) return refreshSheet();
    const tm = body.querySelector('[data-free-timer]');
    if (tm && wait) tm.textContent = `Listo en ${timeText(wait)}`;
    return;
  }
  if (!full) return;
  if (openTab === 'arsenal') return renderArsenal();
  if (openTab === 'vip') return renderVip();
  if (openTab === 'eventos') {
    body.innerHTML = `
      <div class="event world-boss">
        <div class="ev-art">${enemySvg(21, true)}</div>
        <div class="ev-body"><small>PRÓXIMAMENTE</small><b>Jefe Mundial</b>
          <p>Un jefe gigante para todos los jugadores. Tienes 3 intentos por día y hay un ranking de quién le hace más daño, con premios exclusivos.</p>
          <button data-interest="worldboss">¡Me interesa!</button></div>
      </div>
      <div class="event raid">
        <div class="ev-art">${enemySvg(11, true)}</div>
        <div class="ev-body"><small>PRÓXIMAMENTE</small><b>Raids con amigos</b>
          <p>Forma un grupo de hasta 4 amigos y venzan juntos jefes que solos son imposibles. Cada uno pone su héroe con su equipo.</p>
          <button data-interest="raids">¡Me interesa!</button></div>
      </div>`;
  }
}

$('#sheet-body').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const up = t.closest('[data-up]') as HTMLElement | null;
  if (up) {
    if (game.buy(up.dataset.up as UpgradeId)) {
      restartAnim(up, 'bought');
      lobbyKey = '';
    }
    updateTalents();
    return;
  }
  if (armAction(t, false)) return;
  const gotoArm = t.closest('[data-goto-arm]') as HTMLElement | null;
  if (gotoArm) {
    armTab = gotoArm.dataset.gotoArm as ArmFam;
    openSheet('arsenal');
    return;
  }
  const tabEl = t.closest('[data-arm-tab]') as HTMLElement | null;
  if (tabEl) {
    armTab = tabEl.dataset.armTab as ArmFam;
    renderArsenal();
    return;
  }
  const arm = t.closest('[data-arm]') as HTMLElement | null;
  if (arm) {
    const def = armById(arm.dataset.arm!)!;
    if (openTab === 'arsenal') {
      armSel[def.fam] = def.id;
      renderArsenal();
      $('#sheet-body').scrollTo({ top: 0, behavior: 'smooth' });
    } else showArm(def.id);
    return;
  }
  const ex = t.closest('[data-expand]') as HTMLElement | null;
  if (ex) {
    const kind = ex.dataset.expand as 'rows' | 'cols';
    const price = game.expandPrice(kind) ?? 0;
    if (game.expand(kind)) {
      toast(kind === 'rows' ? '¡Tablero con una fila más!' : '¡Tablero con una columna más!');
    } else {
      track(game.s, 'expand_nogems');
      toast(`Te faltan ${price - game.s.gems} 💠`);
    }
    refreshSheet();
    return;
  }
  if (t.closest('[data-free-chest]')) return openChestUi('armas', true);
  const chest = t.closest('[data-chest]') as HTMLElement | null;
  if (chest) return openChestUi(chest.dataset.chest!, false);
  const interest = t.closest('[data-interest]') as HTMLElement | null;
  if (interest) {
    track(game.s, `interest:${interest.dataset.interest}`);
    interest.textContent = '¡Anotado! Te avisaremos';
    interest.setAttribute('disabled', '');
    return;
  }
  if (t.closest('[data-gemshop]')) {
    track(game.s, 'gemshop');
    showModal(`<h2>Tienda de gemas</h2><p>Todavía no está habilitada en esta versión de prueba.</p><p class="muted">Gracias por tocar: nos ayuda a saber qué te interesa.</p><button data-close>Entendido</button>`);
  }
});

// ---------- Ajustes ----------

function showSettings() {
  track(game.s, 'settings');
  showModal(`<div class="settings">
    <button class="x" data-close aria-label="Cerrar">✕</button>
    <h2>Ajustes</h2>
    <label class="start-label">Nombre en la liga<input id="name-input" maxlength="14" value="${esc(game.s.playerName)}"></label>
    <div class="set-box">
      <b>Guardar progreso</b>
      <p>Tu progreso se guarda en este dispositivo. Para pasarlo a otro, copia tu código y cárgalo allá.</p>
      <div class="btns"><button data-export>Copiar mi código</button><button data-import>Cargar un código</button></div>
    </div>
    <div class="set-box test"><b>Versión de prueba</b><p>Para probar todo sin esperar. En la versión final esto se compra.</p>
      <div class="btns"><button data-test-gems>+1.000 💠</button><button data-test-gold>+50.000 🪙</button></div></div>
    <details class="danger"><summary>Zona peligrosa</summary><button data-reset>Borrar todo el progreso</button></details>
  </div>`);
}

$('#modal').addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'name-input') {
    game.s.playerName = t.value.trim().slice(0, 14);
    lobbyKey = '';
    save(game.s);
  }
});

$('#modal').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.closest('[data-export]')) {
    const code = exportCode(game.s);
    track(game.s, 'save_export');
    navigator.clipboard?.writeText(code).then(
      () => toast('Código copiado. Guárdalo en un lugar seguro.'),
      () => {},
    );
    showModal(`<h2>Tu código de guardado</h2><p>Cópialo y guárdalo. En otro dispositivo, ve a ⚙️ Ajustes → Cargar un código.</p>
      <textarea class="code" readonly>${code}</textarea><button data-close>Listo</button>`);
    ($('#modal-card textarea') as HTMLTextAreaElement).select();
  } else if (t.closest('[data-import]')) {
    showModal(`<h2>Cargar progreso</h2><p>Pega tu código. <b>Reemplaza</b> el progreso de este dispositivo.</p>
      <textarea class="code" id="import-code" placeholder="FORJA-..."></textarea>
      <div class="btns"><button data-close>Cancelar</button><button data-do-import class="primary">Cargar</button></div>`);
  } else if (t.closest('[data-test-gems]')) {
    game.s.gems += 1000;
    track(game.s, 'test_gems');
    save(game.s);
    toast('+1.000 💠 de prueba');
  } else if (t.closest('[data-test-gold]')) {
    game.s.gold += 50000;
    track(game.s, 'test_gold');
    save(game.s);
    toast('+50.000 🪙 de prueba');
  } else if (t.closest('[data-reset]')) {
    if (confirm('¿Seguro? Se borra todo tu progreso.')) {
      resetSave();
      location.reload();
    }
  }
});

// ---------- Ventanas ----------

let modalBlocking = false;
function showModal(html: string, blocking = false) {
  $('#modal-card').innerHTML = html;
  $('#modal').hidden = false;
  modalBlocking = blocking;
}
function hideModal() {
  $('#modal').hidden = true;
  modalBlocking = false;
}
function backHome() {
  game.leave();
  hideModal();
  viewLevel = game.s.unlocked;
  lobbyKey = '';
}
$('#modal').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.closest('[data-close]')) hideModal();
  else if (armAction(t, true)) {
    /* hecho */
  } else if (t.closest('[data-goto-world]')) {
    const w = Number((t.closest('[data-goto-world]') as HTMLElement).dataset.gotoWorld);
    viewLevel = Math.min(game.s.unlocked, w * LEVELS_PER_WORLD);
    lobbyKey = '';
    hideModal();
  } else if (t.closest('[data-goto]')) {
    hideModal();
    openSheet((t.closest('[data-goto]') as HTMLElement).dataset.goto as Tab);
  } else if (t.closest('[data-leave]')) backHome();
  else if (t.closest('[data-next]')) {
    const lvl = Number((t.closest('[data-next]') as HTMLElement).dataset.next);
    backHome();
    startLevel(Math.min(lvl, game.s.unlocked));
  } else if (t.closest('[data-refill]')) {
    if (game.s.gems >= REFILL_GEMS) {
      game.s.gems -= REFILL_GEMS;
      game.s.energy = ENERGY_MAX;
      track(game.s, 'energy_refill');
      toast('Energía recargada ⚡');
      hideModal();
    } else {
      track(game.s, 'energy_refill_nogems');
      toast(`Te faltan ${REFILL_GEMS - game.s.gems} 💠`);
    }
  } else if (t.closest('[data-do-import]')) {
    const loaded = importCode(($('#import-code') as HTMLTextAreaElement).value);
    if (!loaded) {
      toast('Ese código no es válido');
      return;
    }
    game = new Game(loaded);
    wireGame();
    save(game.s);
    resetBoardView();
    heroKeyCache = enemyKeyCache = lobbyKey = '';
    viewLevel = game.s.unlocked;
    hideModal();
    closeSheet();
    toast('¡Progreso cargado!');
  } else if (t.closest('[data-start]')) {
    const v = ($('#start-name') as HTMLInputElement).value.trim().slice(0, 14);
    game.s.playerName = v || 'Héroe' + Math.floor(Math.random() * 900 + 100);
    save(game.s);
    hideModal();
  } else if (ev.target === $('#modal') && !modalBlocking) hideModal();
});

function showEnergyModal() {
  regenEnergy(game.s);
  track(game.s, 'energy_modal');
  const secs = secondsToNextEnergy(game.s);
  const full = Math.ceil((ENERGY_MAX - game.s.energy) * 5);
  showModal(`<h2>⚡ Energía</h2>
    <p>Cada nivel cuesta <b>${ENERGY_COST}</b> de energía. Se recarga 1 cada 5 minutos, aunque no estés jugando.</p>
    <div class="stat-row"><span>Energía</span><b>${game.s.energy} / ${ENERGY_MAX}</b></div>
    ${game.s.energy < ENERGY_MAX ? `<div class="stat-row"><span>Próxima</span><b>${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}</b></div>
    <div class="stat-row"><span>Llena en</span><b>~${full} min</b></div>` : ''}
    <div class="btns"><button data-close>Esperar</button><button data-refill class="primary">Recargar 💠${REFILL_GEMS}</button></div>`);
}
$('#energy').addEventListener('click', showEnergyModal);

function showLeagueResult() {
  const r = game.s.league.lastResult;
  if (!r) return;
  const d = DIVISIONS[game.s.league.division];
  const msg = r.moved === 1 ? `Subiste a <b>${d}</b>` : r.moved === -1 ? `Bajaste a <b>${d}</b>` : `Sigues en <b>${d}</b>`;
  showModal(`<h2>Cerró la liga</h2><p>Terminaste en el puesto <b>${r.rank}</b>.</p><p>${msg}.</p>
    <div class="stat-row"><span>Premio</span><b>+${r.gems} 💠</b></div><button data-close>¡Vamos!</button>`);
}

// ---------- Instalación como app ----------

let deferredPrompt: (Event & { prompt: () => Promise<void> }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as Event & { prompt: () => Promise<void> };
  $('#install').hidden = false;
});
$('#install').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  track(game.s, 'install_click');
  await deferredPrompt.prompt();
  deferredPrompt = null;
  $('#install').hidden = true;
});

if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'single') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ---------- Ciclo principal ----------

function renderTop() {
  const s = game.s;
  $('#gold').textContent = fmt(s.gold);
  $('#gems').textContent = fmt(s.gems);
  $('#energy-val').textContent = `${s.energy}/${ENERGY_MAX}`;
  const secs = secondsToNextEnergy(s);
  $('#energy-time').textContent = s.energy < ENERGY_MAX ? ` ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}` : '';
  $('#energy').classList.toggle('low', s.energy < ENERGY_COST);
}

let last = performance.now();
let sheetClock = 0;
let saveClock = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.tick(dt);
  renderTop();
  renderScreen();
  sheetClock += dt;
  if (sheetClock > 0.25) {
    sheetClock = 0;
    renderSheet(false);
    renderDots();
  }
  saveClock += dt;
  if (saveClock > 5) {
    saveClock = 0;
    if (rolloverLeague(game.s)) showLeagueResult();
    save(game.s);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(game.s);
  else last = performance.now();
});
window.addEventListener('pagehide', () => save(game.s));

// Si se cerró la página en medio de un nivel, ese intento se pierde.
if (game.s.run) game.leave();
regenEnergy(game.s);
if (rolloverLeague(game.s)) showLeagueResult();
if (!game.s.playerName) {
  showModal(
    `<h2>Héroes de la Forja</h2>
    <p>Recorre niveles cortos y vence al jefe del final. <b>Arrastra una pieza sobre otra igual</b> (mismo dibujo y mismo número) para juntarlas. Al juntarlas actúan y caen piezas nuevas al instante. Si una pieza no te sirve, tírala hacia arriba.</p><p>⚔️ Espadas pegan · 🛡️ escudos protegen · 🧪 pociones curan · ⚡ rayos potencian tu daño unos segundos. Si juntas rápido, haces combo.</p>
    <p>Gana fragmentos para desbloquear armas y skins, y hazte cada vez más fuerte.</p>
    <label class="start-label">¿Cómo te llamas en la liga?<input id="start-name" maxlength="14" placeholder="Tu nombre"></label>
    <button data-start>Empezar</button>`,
    true,
  );
  track(game.s, 'first_open');
}
requestAnimationFrame(frame);
