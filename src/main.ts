import './style.css';
import { BOSS_TIME, PRESTIGE_MIN_WAVE, UPGRADES, UpgradeId, enemyHp, isBoss, killsPerWave, upgradeCost } from './balance';
import { SKINS, enemyName, enemySvg, heroSvg, skinById, tierFor, weaponName, weaponSvg } from './art';
import { Game } from './game';
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
import { esc, fmt, fmtDuration } from './format';
import { applyOffline, bestWeapon, dps, forgeSeconds, load, resetSave, save, track } from './state';

const game = new Game(load());
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

// ---------- Estructura de la pantalla ----------

document.querySelector('#app')!.innerHTML = `
  <header class="topbar">
    <div class="res gold" title="Oro"><span class="ico">🪙</span><b id="gold">0</b></div>
    <div class="res gems" title="Gemas"><span class="ico">💠</span><b id="gems">0</b></div>
    <div class="res souls" id="souls-wrap" title="Almas (multiplicador permanente)"><span class="ico">👻</span><b id="souls">0</b></div>
    <button id="install" class="install" hidden>Instalar</button>
  </header>

  <section class="battle" id="battle">
    <div class="wave-info">
      <div class="wave-label" id="wave-label">Oleada 1</div>
      <div class="wave-progress" id="wave-progress"></div>
    </div>
    <div class="boss-bar" id="boss-bar" hidden><div id="boss-fill"></div><span id="boss-time"></span></div>
    <button class="retry" id="retry" hidden>⚔️ Reintentar jefe</button>
    <div class="arena">
      <div class="hero" id="hero"></div>
      <div class="enemy-wrap">
        <div class="enemy-name" id="enemy-name"></div>
        <div class="hp"><div class="hp-fill" id="hp-fill"></div></div>
        <div class="enemy" id="enemy"></div>
      </div>
      <div class="fx" id="fx"></div>
    </div>
    <div class="dps" id="dps"></div>
  </section>

  <section class="forge">
    <div class="forge-head">
      <span>Arsenal · <em id="best-weapon"></em></span>
      <div class="forge-bar"><div id="forge-fill"></div></div>
    </div>
    <div class="board" id="board"></div>
    <p class="hint" id="hint">Arrastra dos armas iguales para fusionarlas</p>
  </section>

  <nav class="tabs" id="tabs">
    <button data-tab="mejoras"><span>⬆️</span>Mejoras</button>
    <button data-tab="liga"><span>🏆</span>Liga</button>
    <button data-tab="heroe"><span>🛡️</span>Héroe</button>
    <button data-tab="prestigio"><span>👻</span>Prestigio</button>
  </nav>

  <div class="sheet" id="sheet" hidden>
    <div class="sheet-card">
      <div class="sheet-head"><h2 id="sheet-title"></h2><button class="close" id="sheet-close" aria-label="Cerrar">✕</button></div>
      <div class="sheet-body" id="sheet-body"></div>
    </div>
  </div>

  <div class="modal" id="modal" hidden><div class="modal-card" id="modal-card"></div></div>
`;

// ---------- Combate ----------

let heroKey = '';
function renderHero() {
  const key = `${game.s.skin}:${bestWeapon(game.s)}`;
  if (key === heroKey) return;
  heroKey = key;
  $('#hero').innerHTML = heroSvg(skinById(game.s.skin), bestWeapon(game.s));
}

let enemyKey = '';
function renderEnemy() {
  const s = game.s;
  const boss = isBoss(s.wave) && !s.farming;
  const key = `${s.wave}:${boss}`;
  if (key !== enemyKey) {
    enemyKey = key;
    const el = $('#enemy');
    el.innerHTML = enemySvg(s.wave, boss);
    el.classList.toggle('boss', boss);
    $('#enemy-name').textContent = enemyName(s.wave, boss);
  }
}

function renderBattle() {
  const s = game.s;
  const boss = isBoss(s.wave) && !s.farming;
  renderHero();
  renderEnemy();
  const max = enemyHp(s.wave);
  const pct = game.respawning ? 0 : Math.max(0, s.enemyHp / max) * 100;
  $('#hp-fill').style.width = pct + '%';
  $('#enemy').classList.toggle('dead', game.respawning);
  $('#wave-label').textContent = s.farming ? `Oleada ${s.wave} · juntando fuerza` : boss ? `Oleada ${s.wave} · JEFE` : `Oleada ${s.wave}`;
  const need = killsPerWave(s.wave) * (s.farming ? 3 : 1);
  const dots = boss ? '' : Array.from({ length: Math.min(need, 15) }, (_, i) => `<i class="${i < s.killsInWave ? 'on' : ''}"></i>`).join('');
  const wp = $('#wave-progress');
  if (wp.dataset.k !== dots) {
    wp.innerHTML = dots;
    wp.dataset.k = dots;
  }
  const bb = $('#boss-bar');
  bb.hidden = !boss;
  if (boss) {
    $('#boss-fill').style.width = (Math.max(0, s.bossTimer) / BOSS_TIME) * 100 + '%';
    $('#boss-time').textContent = `${Math.max(0, s.bossTimer).toFixed(1)} s`;
  }
  $('#retry').hidden = !s.farming;
  $('#dps').textContent = `${fmt(dps(s))} daño/s`;
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

game.on((e) => {
  if (e.type === 'hit') {
    const hero = $('#hero');
    hero.classList.remove('attack');
    void hero.offsetWidth;
    hero.classList.add('attack');
    const enemy = $('#enemy');
    enemy.classList.remove('hurt');
    void enemy.offsetWidth;
    enemy.classList.add('hurt');
    floatText(fmt(e.dmg) + (e.crit ? '!' : ''), e.crit ? 'crit' : 'dmg');
  } else if (e.type === 'kill') {
    floatText('+' + fmt(e.gold) + ' 🪙', 'gold', 70, 18);
    if (e.boss) toast('¡Jefe derrotado!');
  } else if (e.type === 'bossFail') {
    toast('El jefe resistió. Mejora tu arma y vuelve a intentarlo.');
  } else if (e.type === 'spawn') {
    boardDirty = true;
    spawnedIndex = e.index;
  } else if (e.type === 'gems') {
    toast(`+${e.amount} 💠 ${e.reason}`);
  }
});

$('#retry').addEventListener('click', () => game.retryBoss());

// ---------- Tablero de fusión ----------

let boardDirty = true;
let spawnedIndex = -1;
let mergedIndex = -1;
const boardEl = $('#board');

function renderBoard() {
  if (!boardDirty) return;
  boardDirty = false;
  const best = bestWeapon(game.s);
  let equippedShown = false;
  boardEl.innerHTML = game.s.board
    .map((lvl, i) => {
      if (lvl === null) return `<div class="cell" data-i="${i}"></div>`;
      const equipped = !equippedShown && lvl === best;
      if (equipped) equippedShown = true;
      const t = tierFor(lvl);
      const cls = ['cell', 'filled', equipped ? 'equipped' : '', i === spawnedIndex ? 'spawned' : '', i === mergedIndex ? 'merged' : '']
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}" data-i="${i}" style="--tier:${t.blade};--glow:${t.glow === 'none' ? 'transparent' : t.glow}">
        ${weaponSvg(lvl, 52)}<span class="lvl">${lvl}</span></div>`;
    })
    .join('');
  spawnedIndex = -1;
  mergedIndex = -1;
  $('#best-weapon').textContent = weaponName(best);
  const free = game.s.board.filter((x) => x === null).length;
  $('#hint').textContent = free === 0 ? 'Tablero lleno: fusiona para que la forja siga' : 'Arrastra dos armas iguales para fusionarlas';
  $('#hint').classList.toggle('warn', free === 0);
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
  highlightMatches(game.s.board[from]!, from);
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
    const res = game.drop(d.from, to);
    if (res === 'merge') {
      mergedIndex = to;
      const lvl = game.s.board[to]!;
      if (lvl === bestWeapon(game.s)) floatText(`¡${weaponName(lvl)}!`, 'merge-text', 40, 30);
      if (navigator.vibrate) navigator.vibrate(15);
    }
  } else if (!d.moved) {
    // Toque simple: fusión rápida con la primera pareja igual que encuentre.
    const lvl = game.s.board[d.from];
    const pair = game.s.board.findIndex((x, i) => i !== d.from && x === lvl);
    if (pair !== -1 && game.drop(d.from, pair) === 'merge') mergedIndex = pair;
  }
  boardDirty = true;
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function highlightMatches(lvl: number, from: number) {
  boardEl.querySelectorAll<HTMLElement>('.cell').forEach((c) => {
    const i = Number(c.dataset.i);
    if (i !== from && game.s.board[i] === lvl) c.classList.add('match');
  });
}

// ---------- Paneles ----------

type Tab = 'mejoras' | 'liga' | 'heroe' | 'prestigio';
let openTab: Tab | null = null;

function openSheet(tab: Tab) {
  openTab = tab;
  $('#sheet').hidden = false;
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

function renderSheet(full: boolean) {
  if (!openTab) return;
  const body = $('#sheet-body');
  if (openTab === 'mejoras') {
    $('#sheet-title').textContent = 'Mejoras';
    if (full) {
      body.innerHTML = UPGRADES.map(
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
    const s = game.s;
    const list = standings(s);
    const div = s.league.division;
    const rank = list.findIndex((x) => x.isPlayer) + 1;
    const html = `
      <div class="league-head" style="--div:${DIVISION_COLORS[div]}">
        <div class="div-badge">${DIVISIONS[div]}</div>
        <div><b>Puesto ${rank} de ${LEAGUE_SIZE}</b><br><small>Cierra en ${timeLeftInWeek(s)} · premio actual ${rewardForRank(rank)} 💠</small></div>
      </div>
      <p class="league-note">Los ${PROMOTE} primeros suben de división y los ${DEMOTE} últimos bajan. Sumas puntos venciendo enemigos y jefes, también mientras no juegas.</p>
      <ol class="ranking">${list
        .map((r, i) => {
          const zone = i < PROMOTE ? 'up' : i >= LEAGUE_SIZE - DEMOTE ? 'down' : '';
          const sk = skinById(r.skin);
          return `<li class="${zone} ${r.isPlayer ? 'me' : ''} rar-${sk.rarity}">
            <span class="pos">${i + 1}</span>
            <span class="mini">${heroSvg(sk, r.isPlayer ? bestWeapon(s) : r.weapon)}</span>
            <span class="who">${esc(r.name)}${r.isPlayer ? ' (tú)' : ''}<small>${sk.name}</small></span>
            <span class="pts">${fmt(r.points)}</span>
          </li>`;
        })
        .join('')}</ol>
      <p class="league-note small">Versión de prueba: los rivales son simulados hasta que conectemos el servidor.</p>`;
    if (full || body.dataset.sig !== String(Math.floor(Date.now() / 3000))) {
      const scroll = body.scrollTop;
      body.innerHTML = html;
      body.scrollTop = scroll;
      body.dataset.sig = String(Math.floor(Date.now() / 3000));
      if (full) body.querySelector('.me')?.scrollIntoView({ block: 'center' });
    }
  } else if (openTab === 'heroe') {
    $('#sheet-title').textContent = 'Tu héroe';
    if (!full) return;
    body.innerHTML = `
      <p class="league-note">Las skins solo cambian la apariencia. Todos te ven con ella en la liga.</p>
      <div class="skins">${SKINS.map((sk) => {
        const owned = game.s.ownedSkins.includes(sk.id);
        const active = game.s.skin === sk.id;
        const action = active
          ? '<span class="tag">En uso</span>'
          : owned
            ? `<button data-equip="${sk.id}">Usar</button>`
            : `<button data-buy="${sk.id}" class="${game.s.gems >= sk.price ? 'can' : ''}">💠 ${sk.price}</button>`;
        return `<div class="skin rar-${sk.rarity} ${active ? 'active' : ''}">
          <div class="skin-art">${heroSvg(sk, bestWeapon(game.s))}</div>
          <b>${sk.name}</b><small class="rarity">${sk.rarity}</small>${action}</div>`;
      }).join('')}</div>
      <div class="gem-shop">
        <b>¿Te faltan gemas?</b>
        <p>Ganas gemas al vencer jefes por primera vez y con los premios de la liga.</p>
        <button data-gemshop>Comprar gemas</button>
      </div>
      <div class="name-row"><label>Nombre en la liga <input id="name-input" maxlength="14" value="${esc(game.s.playerName)}"></label></div>
      <details class="danger"><summary>Opciones</summary><button data-reset>Borrar progreso</button></details>`;
  } else if (openTab === 'prestigio') {
    $('#sheet-title').textContent = 'Prestigio';
    const s = game.s;
    const souls = game.prestigeSouls();
    const sig = `${souls}:${s.souls}:${s.maxWave}`;
    if (!full && body.dataset.sig === sig) return;
    body.dataset.sig = sig;
    body.innerHTML = `
      <div class="prestige">
        <div class="big-ico">👻</div>
        <p>Reinicia tu aventura a cambio de <b>almas</b>. Cada alma da <b>+10% de daño y oro</b> para siempre.</p>
        <p>Pierdes: oleada, oro, mejoras y armas.<br>Conservas: almas, gemas, skins y tu puesto en la liga.</p>
        <div class="stat-row"><span>Almas actuales</span><b>${s.souls} (+${s.souls * 10}%)</b></div>
        <div class="stat-row"><span>Récord de esta vuelta</span><b>Oleada ${s.maxWave}</b></div>
        <div class="stat-row"><span>Almas si reinicias ahora</span><b>+${souls}</b></div>
        <button class="prestige-btn ${game.canPrestige() ? 'can' : ''}" data-prestige ${game.canPrestige() ? '' : 'disabled'}>
          ${game.canPrestige() ? `Reiniciar y ganar ${souls} 👻` : `Disponible desde la oleada ${PRESTIGE_MIN_WAVE}`}
        </button>
      </div>`;
  }
}

$('#sheet-body').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const up = t.closest('[data-up]') as HTMLElement | null;
  if (up) {
    if (game.buy(up.dataset.up as UpgradeId)) {
      up.classList.remove('bought');
      void up.offsetWidth;
      up.classList.add('bought');
    }
    renderSheet(false);
    return;
  }
  const equip = t.closest('[data-equip]') as HTMLElement | null;
  if (equip) {
    game.s.skin = equip.dataset.equip!;
    renderSheet(true);
    return;
  }
  const buy = t.closest('[data-buy]') as HTMLElement | null;
  if (buy) {
    const sk = skinById(buy.dataset.buy!);
    track(game.s, `skin_try:${sk.id}`);
    if (game.s.gems >= sk.price) {
      game.s.gems -= sk.price;
      game.s.ownedSkins.push(sk.id);
      game.s.skin = sk.id;
      track(game.s, `skin_buy:${sk.id}`);
      toast(`¡Conseguiste ${sk.name}!`);
    } else {
      toast(`Te faltan ${sk.price - game.s.gems} 💠`);
    }
    renderSheet(true);
    return;
  }
  if (t.closest('[data-gemshop]')) {
    track(game.s, 'gemshop');
    showModal(`<h2>Tienda de gemas</h2><p>Todavía no está habilitada en esta versión de prueba.</p><p class="muted">Gracias por tocar: nos ayuda a saber qué te interesa.</p><button data-close>Entendido</button>`);
    return;
  }
  if (t.closest('[data-prestige]')) {
    if (!game.canPrestige()) return;
    const souls = game.prestigeSouls();
    game.prestige();
    boardDirty = true;
    heroKey = enemyKey = '';
    save(game.s);
    closeSheet();
    toast(`Renaciste con ${souls} almas nuevas 👻`);
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

function showModal(html: string) {
  $('#modal-card').innerHTML = html;
  $('#modal').hidden = false;
}
$('#modal').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  if (t.closest('[data-close]')) $('#modal').hidden = true;
  if (t.closest('[data-start]')) {
    const v = ($('#start-name') as HTMLInputElement).value.trim().slice(0, 14);
    game.s.playerName = v || 'Héroe' + Math.floor(Math.random() * 900 + 100);
    save(game.s);
    $('#modal').hidden = true;
  }
});

function showOfflineReport(r: { seconds: number; gold: number; points: number; weapons: number }) {
  showModal(`<h2>¡Volviste!</h2>
    <p>Tu héroe siguió peleando durante <b>${fmtDuration(r.seconds)}</b>.</p>
    <div class="stat-row"><span>Oro</span><b>+${fmt(r.gold)} 🪙</b></div>
    <div class="stat-row"><span>Puntos de liga</span><b>+${fmt(r.points)}</b></div>
    <div class="stat-row"><span>Armas forjadas</span><b>+${r.weapons}</b></div>
    <button data-close>Seguir</button>`);
}

function showLeagueResult() {
  const r = game.s.league.lastResult;
  if (!r) return;
  const msg = r.moved === 1 ? `Subiste a <b>${DIVISIONS[game.s.league.division]}</b>` : r.moved === -1 ? `Bajaste a <b>${DIVISIONS[game.s.league.division]}</b>` : `Sigues en <b>${DIVISIONS[game.s.league.division]}</b>`;
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
  $('#gold').textContent = fmt(game.s.gold);
  $('#gems').textContent = fmt(game.s.gems);
  $('#souls').textContent = fmt(game.s.souls);
  $('#souls-wrap').hidden = game.s.souls === 0;
  $('#forge-fill').style.width = Math.min(1, game.s.forgeProgress) * 100 + '%';
  $('#forge-fill').parentElement!.title = `Cae un arma cada ${forgeSeconds(game.s).toFixed(1)} s`;
}

function returnFromAway() {
  const rolled = rolloverLeague(game.s);
  const report = applyOffline(game.s);
  boardDirty = true;
  if (rolled) showLeagueResult();
  else if (report && report.seconds > 60) showOfflineReport(report);
}

let last = performance.now();
let sheetClock = 0;
let saveClock = 0;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  game.tick(dt);
  renderTop();
  renderBattle();
  renderBoard();
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
  else {
    returnFromAway();
    last = performance.now();
  }
});
window.addEventListener('pagehide', () => save(game.s));

returnFromAway();
if (!game.s.playerName) {
  showModal(`<h2>Héroes de la Forja</h2>
    <p>Tu héroe pelea solo. Tú fusionas armas para hacerlo más fuerte y compites cada semana en la liga.</p>
    <label class="start-label">¿Cómo te llamas en la liga?<input id="start-name" maxlength="14" placeholder="Tu nombre"></label>
    <button data-start>Empezar</button>`);
  track(game.s, 'first_open');
}
requestAnimationFrame(frame);
