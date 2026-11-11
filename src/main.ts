import './style.css';
import {
  ENEMIES_PER_WAVE,
  ENERGY_COST,
  ENERGY_MAX,
  LEVELS_PER_WORLD,
  UPGRADES,
  UpgradeId,
  WAVES_PER_LEVEL,
  enemyHp,
  upgradeCost,
} from './balance';
import { Skin, enemyName, enemySvg, heroSvg, itemIconSvg, skinById, tierFor, weaponName, weaponSvg } from './art';
import { ClearReport, Game, Loot } from './game';
import {
  CHEST_GEMS,
  ITEMS,
  Item,
  RARITY_BONUS,
  RARITY_COLORS,
  SLOTS,
  Slot,
  lookFor,
  slotItem,
  statText,
  weaponTier,
} from './items';
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
import {
  bestWeapon,
  exportCode,
  goldMultiplier,
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
/** Los enemigos cambian de especie con cada mundo. */
function enemyKey(level: number) {
  return (worldOf(level) - 1) * 10 + 1;
}
function myLook(): Skin {
  return lookFor(game.s.equipped);
}
function myHero(): string {
  return heroSvg(myLook(), weaponTier(game.s.equipped));
}

// ---------- Estructura de la pantalla ----------

document.querySelector('#app')!.innerHTML = `
  <header class="topbar">
    <div class="res gold" title="Oro"><span class="ico">🪙</span><b id="gold">0</b></div>
    <div class="res gems" title="Gemas"><span class="ico">💠</span><b id="gems">0</b></div>
    <button class="res energy" id="energy" title="Energía"><span class="ico">⚡</span><b id="energy-val">0</b><small id="energy-time"></small></button>
    <button id="install" class="install" hidden>Instalar</button>
  </header>

  <section class="stage" id="stage">
    <button class="home" id="home">
      <div class="home-hero" id="home-hero"></div>
      <div class="home-info">
        <b id="home-name"></b>
        <span class="power">⚔️ Poder <b id="home-power"></b></span>
        <span class="equip-cta">Equipar ›</span>
      </div>
    </button>
    <div class="battle" id="battle" hidden>
      <div class="run-top">
        <button class="flee" id="flee" aria-label="Abandonar">✕</button>
        <div class="run-title" id="run-title"></div>
        <div class="route" id="route"></div>
      </div>
      <div class="arena">
        <div class="hero-wrap">
          <div class="hp hero-hp"><div class="hp-fill" id="hero-hp"></div></div>
          <div class="hero" id="hero"></div>
        </div>
        <div class="enemy-wrap">
          <div class="enemy-name" id="enemy-name"></div>
          <div class="hp"><div class="hp-fill" id="hp-fill"></div></div>
          <div class="enemy" id="enemy"></div>
        </div>
        <div class="fx" id="fx"></div>
      </div>
      <div class="combo" id="combo"></div>
    </div>
  </section>

  <section class="lower">
    <div class="map" id="map"></div>
    <div class="forge" id="forge" hidden>
      <div class="forge-head"><span>Mejor arma del nivel: <em id="best-weapon"></em></span></div>
      <div class="board" id="board"></div>
      <p class="hint" id="hint"></p>
    </div>
  </section>

  <nav class="tabs" id="tabs">
    <button data-tab="heroe"><span>🛡️</span>Héroe</button>
    <button data-tab="talentos"><span>✨</span>Talentos</button>
    <button data-tab="liga"><span>🏆</span>Liga</button>
    <button data-tab="eventos"><span>🐉</span>Eventos</button>
  </nav>

  <div class="sheet" id="sheet" hidden>
    <div class="sheet-card">
      <div class="sheet-head"><h2 id="sheet-title"></h2><button class="close" id="sheet-close" aria-label="Cerrar">✕</button></div>
      <div class="sheet-body" id="sheet-body"></div>
    </div>
  </div>

  <div class="modal" id="modal" hidden><div class="modal-card" id="modal-card"></div></div>
`;

// ---------- Pantalla principal ----------

let homeKey = '';
function renderHome() {
  const key = `${JSON.stringify(game.s.equipped)}:${game.s.playerName}:${power(game.s)}`;
  if (key === homeKey) return;
  homeKey = key;
  $('#home-hero').innerHTML = myHero();
  $('#home-name').textContent = game.s.playerName || 'Tu héroe';
  $('#home-power').textContent = fmt(power(game.s));
}
$('#home').addEventListener('click', () => openSheet('heroe'));

let viewWorld = worldOf(game.s.unlocked);
let mapKey = '';

function renderMap() {
  const s = game.s;
  const key = `${viewWorld}:${s.unlocked}:${JSON.stringify(s.stars)}`;
  if (key === mapKey) return;
  mapKey = key;
  const first = (viewWorld - 1) * LEVELS_PER_WORLD + 1;
  const maxWorld = worldOf(s.unlocked);
  const nodes = Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
    const lvl = first + i;
    const locked = lvl > s.unlocked;
    const stars = s.stars[lvl] ?? 0;
    const boss = lvl % LEVELS_PER_WORLD === 0;
    const current = lvl === s.unlocked;
    // Recorrido en zigzag: fila 1 izquierda→derecha, fila 2 derecha→izquierda.
    const row = Math.floor(i / 5);
    const col = row % 2 === 0 ? i % 5 : 4 - (i % 5);
    return `<button class="node ${locked ? 'locked' : ''} ${boss ? 'boss' : ''} ${current ? 'current' : ''}" data-level="${lvl}"
      style="grid-row:${row + 1};grid-column:${col + 1}" ${locked ? 'disabled' : ''}>
      <span class="n">${locked ? '🔒' : boss ? '👑' : lvl}</span>
      <span class="st">${locked ? '' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
    </button>`;
  }).join('');
  const target = Math.min(s.unlocked, first + LEVELS_PER_WORLD - 1);
  $('#map').innerHTML = `
    <div class="map-head">
      <button class="wbtn" data-world="-1" ${viewWorld <= 1 ? 'disabled' : ''}>‹</button>
      <div><small>Mundo ${viewWorld}</small><b>${worldName(viewWorld)}</b></div>
      <button class="wbtn" data-world="1" ${viewWorld >= maxWorld ? 'disabled' : ''}>›</button>
    </div>
    <div class="path">${nodes}</div>
    <div class="next-level">
      <div class="next-enemy">${enemySvg(enemyKey(target), target % LEVELS_PER_WORLD === 0)}</div>
      <div class="next-info"><small>${target % LEVELS_PER_WORLD === 0 ? 'Jefe del mundo' : `${WAVES_PER_LEVEL} oleadas + jefe`}</small>
        <b>Nivel ${target}</b><span>${target < s.unlocked ? 'Ya superado: repite para ganar oro' : 'Primera victoria: equipo + gemas'}</span></div>
    </div>
    <button class="play" data-level="${target}">Jugar nivel ${target} <span>⚡${ENERGY_COST}</span></button>`;
}

$('#map').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const w = t.closest('[data-world]') as HTMLElement | null;
  if (w) {
    viewWorld = Math.max(1, Math.min(worldOf(game.s.unlocked), viewWorld + Number(w.dataset.world)));
    renderMap();
    return;
  }
  const n = t.closest('[data-level]') as HTMLElement | null;
  if (n) startLevel(Number(n.dataset.level));
});

function startLevel(level: number) {
  regenEnergy(game.s);
  if (game.s.energy < ENERGY_COST) {
    showEnergyModal();
    return;
  }
  if (game.start(level)) {
    heroKeyCache = enemyKeyCache = '';
    boardDirty = true;
    closeSheet();
    hideModal();
  }
}

// ---------- Combate ----------

let heroKeyCache = '';
function renderHero() {
  const key = JSON.stringify(game.s.equipped);
  if (key === heroKeyCache) return;
  heroKeyCache = key;
  $('#hero').innerHTML = myHero();
}

let enemyKeyCache = '';
function renderScreen() {
  const run = game.s.run;
  $('#home').hidden = !!run;
  $('#battle').hidden = !run;
  $('#map').hidden = !!run;
  $('#forge').hidden = !run;
  if (!run) {
    renderHome();
    renderMap();
    return;
  }
  renderBoard();
  const boss = game.isBossWave(run);
  renderHero();
  const ek = `${run.level}:${boss}`;
  if (ek !== enemyKeyCache) {
    enemyKeyCache = ek;
    const el = $('#enemy');
    el.innerHTML = enemySvg(enemyKey(run.level), boss);
    el.classList.toggle('boss', boss);
    $('#enemy-name').textContent = enemyName(enemyKey(run.level), boss);
  }
  const max = enemyHp(run.level, boss);
  $('#hp-fill').style.width = (game.respawning || run.result === 'win' ? 0 : Math.max(0, run.enemyHp / max) * 100) + '%';
  $('#hero-hp').style.width = Math.max(0, run.heroHp / maxHp(game.s)) * 100 + '%';
  $('#hero-hp').classList.toggle('low', run.heroHp / maxHp(game.s) < 0.3);
  $('#enemy').classList.toggle('dead', game.respawning || run.result === 'win');
  ($('.enemy-wrap') as HTMLElement).style.transform = `translateX(${-(1 - run.enemyPos) * 70}%)`;
  $('#enemy').classList.toggle('attacking', run.enemyPos <= 0 && !game.respawning && !run.result);
  const combo = $('#combo');
  const comboText = run.combo >= 2 && !run.result ? `COMBO x${run.combo}` : '';
  if (combo.textContent !== comboText) {
    combo.textContent = comboText;
    if (comboText) restartAnim(combo, 'pop');
  }
  $('#hero').classList.toggle('walking', game.respawning && !run.result);
  $('#hero').classList.toggle('down', run.result === 'lose');
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

function wireGame() {
  game.on((e) => {
    if (e.type === 'hit') {
      restartAnim($('#hero'), 'attack');
      restartAnim($('#enemy'), 'hurt');
      if (e.merge) {
        floatText(fmt(e.dmg) + (e.crit ? '!' : ''), e.crit ? 'crit big' : 'merge-hit', 66, 36);
        restartAnim($('#stage'), e.combo >= 5 || e.crit ? 'shake-big' : 'shake');
      } else {
        floatText(fmt(e.dmg) + (e.crit ? '!' : ''), e.crit ? 'crit' : 'dmg');
      }
    } else if (e.type === 'hurt') {
      restartAnim($('#hero'), 'hit');
      floatText('-' + fmt(e.dmg), 'ouch', 24, 34);
    } else if (e.type === 'kill') {
      floatText('+' + fmt(e.gold) + ' 🪙', 'gold', 70, 18);
    } else if (e.type === 'wave') {
      if (e.boss) toast('¡Llegó el jefe!');
    } else if (e.type === 'drop') {
      boardDirty = true;
      for (const i of e.indexes) spawned.add(i);
    } else if (e.type === 'end') {
      setTimeout(() => showResult(e.report), 1100);
    }
  });
}
wireGame();

$('#flee').addEventListener('click', () => {
  if (confirm('¿Abandonar el nivel? No se devuelve la energía.')) game.abandon();
});

function lootCard(l: Loot): string {
  const it = l.item;
  const tier = it.tier ?? 1;
  const look = lookFor({ ...game.s.equipped, [it.slot]: it.id });
  return `<div class="loot" style="--rar:${RARITY_COLORS[it.rarity]}">
    <div class="loot-icon">${itemIconSvg(it.slot, look, tier)}</div>
    <div><small>${it.rarity.toUpperCase()} · ${SLOTS.find((x) => x.id === it.slot)!.name}</small><b>${it.name}</b>
    <span>${l.duplicate ? `Repetida: +${fmt(l.gold)} 🪙` : statText(it)}</span></div>
    ${l.duplicate ? '' : `<button data-equip-new="${it.id}" data-slot="${it.slot}">Equipar</button>`}
  </div>`;
}

function showResult(r: ClearReport) {
  if (r.win) {
    const stars = [1, 2, 3].map((i) => `<span class="${i <= r.stars ? 'on' : ''}" style="animation-delay:${i * 0.15}s">★</span>`).join('');
    showModal(
      `<div class="result win"><div class="stars">${stars}</div><h2>¡Nivel ${r.level} superado!</h2>
      ${r.loot ? lootCard(r.loot) : ''}
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
      <p>Encadena fusiones más rápido, mejora tu equipo o sube tus talentos con el oro que juntaste.</p>
      <div class="stat-row"><span>Oro</span><b>+${fmt(r.gold)} 🪙</b></div>
      <div class="stat-row"><span>Mejor combo</span><b>x${r.maxCombo}</b></div>
      <div class="btns"><button data-leave>Inicio</button><button data-next="${r.level}" class="primary">Reintentar ⚡${ENERGY_COST}</button></div></div>`,
      true,
    );
  }
}

// ---------- Tablero de fusión (solo durante el nivel) ----------

let boardDirty = true;
const spawned = new Set<number>();
let mergedIndex = -1;
const boardEl = $('#board');

function renderBoard() {
  if (!boardDirty) return;
  boardDirty = false;
  const best = bestWeapon(game.s);
  boardEl.innerHTML = game.s.board
    .map((lvl, i) => {
      if (lvl === null) return `<div class="cell" data-i="${i}"></div>`;
      const t = tierFor(lvl);
      const cls = ['cell', 'filled', spawned.has(i) ? 'spawned' : '', i === mergedIndex ? 'merged' : ''].filter(Boolean).join(' ');
      return `<div class="${cls}" data-i="${i}" style="--tier:${t.blade};--glow:${t.glow === 'none' ? 'transparent' : t.glow}">
        ${weaponSvg(lvl, 52)}<span class="lvl">${lvl}</span></div>`;
    })
    .join('');
  spawned.clear();
  mergedIndex = -1;
  $('#best-weapon').textContent = best ? weaponName(best) : '—';
  const free = game.s.board.filter((x) => x === null).length;
  const hint = $('#hint');
  hint.textContent =
    free === 0 ? '¡Tablero lleno! Fusiona para que sigan cayendo armas' : 'Cada fusión golpea al enemigo. ¡Encadénalas para hacer combo!';
  hint.classList.toggle('warn', free === 0);
}

let drag: { from: number; ghost: HTMLElement; startX: number; startY: number; moved: boolean } | null = null;

function cellAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest('.cell') as HTMLElement | null;
}

boardEl.addEventListener('pointerdown', (ev) => {
  const cell = (ev.target as HTMLElement).closest('.cell') as HTMLElement | null;
  if (!cell || !cell.classList.contains('filled')) return;
  ev.preventDefault();
  const from = Number(cell.dataset.i);
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = weaponSvg(game.s.board[from]!, 60);
  ghost.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 30}px)`;
  document.body.appendChild(ghost);
  cell.classList.add('lifting');
  drag = { from, ghost, startX: ev.clientX, startY: ev.clientY, moved: false };
});

window.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 6) drag.moved = true;
  drag.ghost.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 30}px)`;
  boardEl.querySelectorAll('.over').forEach((c) => c.classList.remove('over'));
  cellAt(ev.clientX, ev.clientY)?.classList.add('over');
});

function endDrag(ev: PointerEvent) {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.ghost.remove();
  const target = cellAt(ev.clientX, ev.clientY);
  if (target && d.moved) {
    const to = Number(target.dataset.i);
    if (game.drop(d.from, to) === 'merge') onMerge(to);
  } else if (!d.moved) {
    // Toque simple: fusión rápida con la primera pareja igual.
    const lvl = game.s.board[d.from];
    const pair = game.s.board.findIndex((x, i) => i !== d.from && x === lvl);
    if (pair !== -1 && game.drop(d.from, pair) === 'merge') onMerge(pair);
  }
  boardDirty = true;
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function onMerge(index: number) {
  mergedIndex = index;
  if (navigator.vibrate) navigator.vibrate(15);
}

// ---------- Paneles ----------

type Tab = 'heroe' | 'talentos' | 'liga' | 'eventos';
let openTab: Tab | null = null;
let heroSlot: Slot = 'casco';

function openSheet(tab: Tab) {
  openTab = tab;
  $('#sheet').hidden = false;
  $('#sheet').classList.toggle('tall', tab === 'heroe');
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab));
  track(game.s, `open:${tab}`);
  renderSheet(true);
}

function closeSheet() {
  openTab = null;
  $('#sheet').hidden = true;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
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

function itemTile(it: Item, owned: boolean, equipped: boolean): string {
  const look = lookFor({ ...game.s.equipped, [it.slot]: it.id });
  return `<button class="item ${owned ? '' : 'missing'} ${equipped ? 'on' : ''}" style="--rar:${RARITY_COLORS[it.rarity]}"
    ${owned ? `data-equip="${it.id}" data-slot="${it.slot}"` : 'disabled'} title="${esc(it.name)}">
    <div class="item-icon">${owned ? itemIconSvg(it.slot, look, it.tier ?? 1) : '?'}</div>
    <span>${owned ? esc(it.name) : it.rarity}</span>
  </button>`;
}

function renderHeroSheet() {
  const s = game.s;
  const dmg = Math.round((damageMultiplier(s) - 1) * 100);
  const gold = Math.round((goldMultiplier(s) - 1) * 100);
  const owned = (slot: Slot) => ITEMS.filter((i) => i.slot === slot && s.items.includes(i.id)).length;
  const total = (slot: Slot) => ITEMS.filter((i) => i.slot === slot).length;
  $('#sheet-body').innerHTML = `
    <div class="hero-card">
      <div class="hero-big">${myHero()}</div>
      <div class="hero-stats">
        <div class="power-big">⚔️ <b>${fmt(power(s))}</b><small>Poder</small></div>
        <div class="stat-row"><span>❤️ Vida</span><b>${fmt(maxHp(s))}</b></div>
        <div class="stat-row"><span>🗡️ Daño</span><b>+${dmg}%</b></div>
        <div class="stat-row"><span>🪙 Oro</span><b>+${gold}%</b></div>
      </div>
    </div>
    <div class="slots">${SLOTS.map((sl) => {
      const it = slotItem(s.equipped[sl.id], sl.id);
      return `<button class="slot ${heroSlot === sl.id ? 'sel' : ''}" data-slot-tab="${sl.id}" style="--rar:${RARITY_COLORS[it.rarity]}">
        <div class="item-icon">${itemIconSvg(sl.id, myLook(), weaponTier(s.equipped))}</div>
        <small>${sl.name}</small><b>+${RARITY_BONUS[it.rarity]}%</b></button>`;
    }).join('')}</div>
    <div class="inv-head"><b>${SLOTS.find((x) => x.id === heroSlot)!.name}s</b><small>${owned(heroSlot)} de ${total(heroSlot)} · ${statText(slotItem(s.equipped[heroSlot], heroSlot)).replace(/^\+\d+% de /, 'dan ')}</small></div>
    <div class="inventory">${ITEMS.filter((i) => i.slot === heroSlot)
      .map((i) => itemTile(i, s.items.includes(i.id), s.equipped[heroSlot] === i.id))
      .join('')}</div>
    <div class="chest-box">
      <div class="chest-ico">🎁</div>
      <div><b>Cofre de equipo</b><p>Una pieza rara o mejor. También ganas equipo al superar niveles por primera vez.</p></div>
      <button data-chest class="${s.gems >= CHEST_GEMS ? 'can' : ''}">💠 ${CHEST_GEMS}</button>
    </div>
    <div class="gem-shop"><b>¿Te faltan gemas?</b><p>Ganas gemas con las primeras victorias y con los premios de la liga.</p><button data-gemshop>Comprar gemas</button></div>
    <div class="name-row"><label>Nombre en la liga <input id="name-input" maxlength="14" value="${esc(s.playerName)}"></label></div>
    <div class="save-box">
      <b>Guardar progreso</b>
      <p>Tu progreso se guarda en este dispositivo. Para pasarlo a otro, copia tu código y cárgalo allá.</p>
      <div class="save-btns"><button data-export>Copiar mi código</button><button data-import>Cargar un código</button></div>
    </div>
    <details class="danger"><summary>Opciones</summary><button data-reset>Borrar progreso</button></details>`;
}

function renderSheet(full: boolean) {
  if (!openTab) return;
  const body = $('#sheet-body');
  if (openTab === 'talentos') {
    $('#sheet-title').textContent = 'Talentos';
    if (full) {
      body.innerHTML =
        `<p class="league-note">Los talentos son permanentes y se compran con el oro que ganas en los niveles.</p>` +
        UPGRADES.map(
          (u) => `<button class="upgrade" data-up="${u.id}">
          <span class="u-ico">${u.icon}</span>
          <span class="u-main"><b>${u.name} <small data-lvl></small></b><span class="u-desc" data-desc></span></span>
          <span class="u-cost" data-cost></span>
        </button>`,
        ).join('');
    }
    body.querySelectorAll<HTMLElement>('.upgrade').forEach((el) => {
      const id = el.dataset.up as UpgradeId;
      const def = UPGRADES.find((u) => u.id === id)!;
      const lvl = game.s.upgrades[id];
      const maxed = lvl >= def.max;
      el.querySelector('[data-lvl]')!.textContent = `nv ${lvl}`;
      el.querySelector('[data-desc]')!.textContent = def.desc(lvl);
      el.querySelector('[data-cost]')!.textContent = maxed ? 'MÁX' : `🪙 ${fmt(upgradeCost(def, lvl))}`;
      el.classList.toggle('can', game.canBuy(id));
      el.classList.toggle('maxed', maxed);
    });
  } else if (openTab === 'liga') {
    $('#sheet-title').textContent = 'Liga semanal';
    const sig = String(Math.floor(Date.now() / 3000));
    if (!full && body.dataset.sig === sig) return;
    body.dataset.sig = sig;
    const s = game.s;
    const list = standings(s);
    const div = s.league.division;
    const rank = list.findIndex((x) => x.isPlayer) + 1;
    const scroll = body.scrollTop;
    body.innerHTML = `
      <div class="league-head" style="--div:${DIVISION_COLORS[div]}">
        <div class="div-badge">${DIVISIONS[div]}</div>
        <div><b>Puesto ${rank} de ${LEAGUE_SIZE}</b><br><small>Cierra en ${timeLeftInWeek(s)} · premio actual ${rewardForRank(rank)} 💠</small></div>
      </div>
      <p class="league-note">Los ${PROMOTE} primeros suben de división y los ${DEMOTE} últimos bajan. Sumas puntos al superar niveles, más con 3 estrellas.</p>
      <ol class="ranking">${list
        .map((r, i) => {
          const zone = i < PROMOTE ? 'up' : i >= LEAGUE_SIZE - DEMOTE ? 'down' : '';
          const sk = r.isPlayer ? null : skinById(r.skin);
          const art = r.isPlayer ? myHero() : heroSvg(sk!, Math.min(10, r.weapon));
          const label = r.isPlayer ? slotItem(s.equipped.armadura, 'armadura').name : sk!.name;
          const rar = r.isPlayer ? slotItem(s.equipped.armadura, 'armadura').rarity : sk!.rarity;
          return `<li class="${zone} ${r.isPlayer ? 'me' : ''} rar-${rar}">
            <span class="pos">${i + 1}</span>
            <span class="mini">${art}</span>
            <span class="who">${esc(r.name)}${r.isPlayer ? ' (tú)' : ''}<small>${label}</small></span>
            <span class="pts">${fmt(r.points)}</span>
          </li>`;
        })
        .join('')}</ol>
      <p class="league-note small">Versión de prueba: los rivales son simulados hasta que conectemos el servidor.</p>`;
    body.scrollTop = scroll;
    if (full) body.querySelector('.me')?.scrollIntoView({ block: 'center' });
  } else if (openTab === 'heroe') {
    $('#sheet-title').textContent = 'Tu héroe';
    if (full) renderHeroSheet();
  } else if (openTab === 'eventos') {
    $('#sheet-title').textContent = 'Eventos';
    if (!full) return;
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
    if (game.buy(up.dataset.up as UpgradeId)) restartAnim(up, 'bought');
    renderSheet(false);
    return;
  }
  const slotTab = t.closest('[data-slot-tab]') as HTMLElement | null;
  if (slotTab) {
    heroSlot = slotTab.dataset.slotTab as Slot;
    renderHeroSheet();
    return;
  }
  const equip = t.closest('[data-equip]') as HTMLElement | null;
  if (equip) {
    game.equip(equip.dataset.equip!, equip.dataset.slot as Slot);
    track(game.s, `equip:${equip.dataset.equip}`);
    const scroll = $('#sheet-body').scrollTop;
    renderHeroSheet();
    $('#sheet-body').scrollTop = scroll;
    return;
  }
  if (t.closest('[data-chest]')) {
    const loot = game.openChest();
    if (!loot) {
      track(game.s, 'chest_nogems');
      toast(`Te faltan ${CHEST_GEMS - game.s.gems} 💠`);
      return;
    }
    renderHeroSheet();
    showModal(`<div class="result"><div class="big-ico chest-open">🎁</div><h2>¡Abriste un cofre!</h2>${lootCard(loot)}<button data-close>Genial</button></div>`);
    return;
  }
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
    return;
  }
  if (t.closest('[data-export]')) {
    const code = exportCode(game.s);
    track(game.s, 'save_export');
    navigator.clipboard?.writeText(code).then(
      () => toast('Código copiado. Guárdalo en un lugar seguro.'),
      () => {},
    );
    showModal(`<h2>Tu código de guardado</h2><p>Cópialo y guárdalo. En otro dispositivo, ve a Héroe → Cargar un código.</p>
      <textarea class="code" readonly>${code}</textarea><button data-close>Listo</button>`);
    ($('#modal-card textarea') as HTMLTextAreaElement).select();
    return;
  }
  if (t.closest('[data-import]')) {
    showModal(`<h2>Cargar progreso</h2><p>Pega tu código. <b>Reemplaza</b> el progreso de este dispositivo.</p>
      <textarea class="code" id="import-code" placeholder="FORJA-..."></textarea>
      <div class="btns"><button data-close>Cancelar</button><button data-do-import class="primary">Cargar</button></div>`);
    return;
  }
  if (t.closest('[data-reset]')) {
    if (confirm('¿Seguro? Se borra todo tu progreso.')) {
      resetSave();
      location.reload();
    }
  }
});

$('#sheet-body').addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'name-input') {
    game.s.playerName = t.value.trim().slice(0, 14);
    save(game.s);
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
  viewWorld = worldOf(game.s.unlocked);
  homeKey = mapKey = '';
}
$('#modal').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.closest('[data-close]')) hideModal();
  else if (t.closest('[data-equip-new]')) {
    const b = t.closest('[data-equip-new]') as HTMLElement;
    game.equip(b.dataset.equipNew!, b.dataset.slot as Slot);
    heroKeyCache = homeKey = '';
    b.textContent = 'Equipada ✓';
    b.setAttribute('disabled', '');
    if (openTab === 'heroe') renderHeroSheet();
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
    boardDirty = true;
    heroKeyCache = enemyKeyCache = mapKey = homeKey = '';
    viewWorld = worldOf(game.s.unlocked);
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
    <p>Recorre niveles cortos y vence al jefe del final. Durante el nivel caen armas: <b>cada fusión golpea al enemigo</b>, y si las encadenas rápido haces combo.</p>
    <p>Gana equipo para tu héroe y hazlo cada vez más fuerte.</p>
    <label class="start-label">¿Cómo te llamas en la liga?<input id="start-name" maxlength="14" placeholder="Tu nombre"></label>
    <button data-start>Empezar</button>`,
    true,
  );
  track(game.s, 'first_open');
}
requestAnimationFrame(frame);
