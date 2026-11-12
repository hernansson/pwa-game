import './style.css';
import {
  ENEMIES_PER_WAVE,
  ENERGY_COST,
  REFILL_GEMS,
  ENERGY_MAX,
  LEVELS_PER_WORLD,
  UPGRADES,
  UpgradeId,
  WAVES_PER_LEVEL,
  enemyAttackSeconds,
  shieldReduction,
  swordBonus,
  enemyHp,
  upgradeCost,
  PASS,
  comboMultiplier,
  GEM_PACKS,
  GOLD_PACKS,
  chestPrice,
  goldPackAmount,
} from './balance';
import { Skin, enemyName, enemySvg, famIcon, heroSvg, levelEnemy, levelEnemyName, levelEnemySvg, pieceFrame, pieceSvg, skinById } from './art';
import { BASE_COLS, BASE_ROWS, Cell, FAMILIES, FAMILY_INFO, Family, colsOf, rowsOf } from './board';
import { ChestResult, ClearReport, DUEL_SECONDS, Game, MergeResult } from './game';
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
import { ARMS, ArmDef, ArmFam, CHESTS, MAX_ARM_LEVEL, pityLeft, RARITY_LEVEL_BONUS, armById, armStatText, levelGainText, unlockShards, upgradeGold, upgradeShards } from './arsenal';
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
  passActive,
  passDaysLeft,
  migrate,
  comboTime,
  GameState,
} from './state';
import { act, errorText, fetchState, loginWithGoogle, logout, me, mountGoogleButton, online } from './net';
import { seeded } from './rng';

let game = new Game(load());

// ---------- Servidor ----------
// Con sesión iniciada, el servidor es el dueño del progreso: cada acción se hace también allá y lo que
// responde reemplaza lo del celu. Sin sesión se juega como invitado, solo en este dispositivo.
const PROD = location.hostname === 'hernansson.github.io';
const LOGIN_HERE = PROD || location.hostname === 'localhost';
const GUEST_KEY = 'heroes-forja-guest';
/** Las herramientas de prueba: solo la cuenta admin (o fuera de la página publicada, para probar). */
const testTools = () => (online() ? !!me()?.admin : !PROD);
let runId: string | null = null;

function applyServer(state: GameState) {
  const s = migrate(state);
  s.run = game.s.run; // si hay una pelea en pantalla, sigue
  game.setState(s);
  save(game.s);
  lobbyKey = heroKeyCache = enemyKeyCache = '';
  renderLegend();
  refreshSheet();
}

function resync() {
  if (!online()) return;
  fetchState().then((a) => applyServer(a.state), () => {});
}

/** Manda al servidor una acción que el celu ya hizo; si el servidor no la acepta, vuelve a su versión. */
function sync(type: string, data: Record<string, unknown> = {}) {
  if (!online()) return;
  act(type, data).then(
    (a) => applyServer(a.state),
    (e) => {
      toast(errorText(e));
      resync();
    },
  );
}
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
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
    <button class="res gold" id="gold-btn" title="Oro"><span class="ico">🪙</span><b id="gold">0</b><i class="res-plus">+</i></button>
    <button class="res gems" id="gems-btn" title="Gemas"><span class="ico">💠</span><b id="gems">0</b><i class="res-plus">+</i></button>
    <button class="res energy" id="energy" title="Energía"><span class="ico">⚡</span><b id="energy-val">0</b><small id="energy-time"></small><i class="res-plus">+</i></button>
    <button id="install" class="install" hidden>Instalar</button>
    <button class="gear" id="fullscreen" aria-label="Pantalla completa">⛶</button>
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
        <button class="rail-btn" data-open="eventos"><span class="ri">🐉</span><small>Eventos</small><em>Retos</em></button>
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
      <div class="combo-hud" id="combo-hud" hidden><div class="ch-row"><small>COMBO</small><b id="ch-n">x2</b><span id="ch-name"></span></div><div class="ch-bar"><i id="ch-bar"></i></div></div>
      <div class="pboard" id="board">
        <div class="pieces" id="pieces"></div>
      </div>
      <p class="hint" id="hint">Arrastra una pieza sobre otra igual para juntarlas. Arrástrala hacia arriba, fuera del tablero, para tirarla.</p>
    </div>
  </section>

  <nav class="tabs" id="tabs">
    <button data-tab="cofres"><span>🛒</span>Tienda<i class="dot" data-dot="cofres" hidden></i></button>
    <button data-tab="heroe"><span>🧝</span>Héroe<i class="dot" data-dot="heroe" hidden></i></button>
    <button data-tab="combate" class="center"><span>⚔️</span>Combate</button>
    <button data-tab="arsenal"><span>🛡️</span>Equipo<i class="dot" data-dot="arsenal" hidden></i></button>
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
  if (online()) {
    // El servidor cobra la energía y da la semilla de la pelea; al terminar, la rejuega él.
    if (starting) return;
    starting = true;
    act<{ runId: string; seed: number }>('run_start', { level }).then(
      (a) => {
        starting = false;
        runId = a.result.runId;
        game.rand = seeded(a.result.seed);
        beginRun(level);
      },
      (e) => {
        starting = false;
        toast(errorText(e));
        resync();
      },
    );
    return;
  }
  game.rand = Math.random;
  beginRun(level);
}
let starting = false;

function beginRun(level: number) {
  if (game.start(level)) {
    heroKeyCache = enemyKeyCache = '';
    resetBoardView();
    closeSheet();
    hideModal();
  }
}

/** Al terminar una pelea con sesión iniciada: el servidor la rejuega y da las recompensas de verdad. */
function finishOnline(local: ClearReport) {
  if (!runId) return;
  const id = runId;
  runId = null;
  act<{ report: ClearReport }>('run_finish', { runId: id, log: game.log }).then(
    (a) => {
      applyServer(a.state);
      if (JSON.stringify(a.result.report) !== JSON.stringify(local)) toast('El servidor ajustó el resultado de la pelea');
    },
    (e) => {
      toast(errorText(e));
      resync();
    },
  );
}

// ---------- Retos entre amigos ----------
// Uno crea un código, los demás lo ponen y todos pelean contra el mismo jefe con las mismas piezas
// durante 60 segundos. El servidor rejuega cada pelea: el daño no se puede inventar.

type DuelEntry = { name: string; damage: number; combo: number; done: boolean; me: boolean };
type DuelInfo = {
  code: string;
  level: number;
  seconds: number;
  expires: number;
  expired: boolean;
  mineCreated: boolean;
  played: boolean;
  myDamage: number | null;
  rank: number;
  players: number;
  entries: DuelEntry[];
};
type DuelMine = { code: string; level: number; created: number; mine: number; myDamage: number | null; players: number; best: number | null };

let duelRunId: string | null = null;
let duelCode: string | null = null;
let duelBusy = false;

function duelBox(): string {
  const login = online()
    ? `<div class="duel-actions">
        <button class="primary" data-duel-create>⚔️ Crear reto</button>
        <div class="duel-join"><input id="duel-code" maxlength="7" placeholder="CÓDIGO" autocomplete="off" autocapitalize="characters" spellcheck="false"><button data-duel-join>Unirme</button></div>
      </div>
      <div id="duel-mine" class="duel-mine"></div>`
    : `<button class="primary" data-login-settings>Entra con Google para retar amigos</button>`;
  return `<div class="event duel">
    <div class="duel-head"><div class="ev-art">${levelEnemySvg(Math.max(1, game.s.unlocked), true)}</div>
      <div class="ev-body"><small>NUEVO</small><b>Reto contra el jefe</b>
      <p>Crea un código y pásaselo a tus amigos. Todos pelean contra el mismo jefe, con las mismas piezas, durante ${DUEL_SECONDS} segundos. Gana quien le hace más daño. Un solo intento cada uno.</p></div></div>
    ${login}
  </div>`;
}

function loadMyDuels() {
  act<{ duels: DuelMine[] }>('duel_mine').then(
    (a) => {
      const el = document.querySelector('#duel-mine');
      if (!el) return;
      const list = a.result.duels;
      el.innerHTML = list.length
        ? `<small class="duel-mine-t">Tus retos</small>` +
          list
            .map(
              (d) => `<button class="duel-row" data-duel-open="${d.code}"><b>${d.code}</b><span>Nivel ${d.level} · ${d.players} ${d.players === 1 ? 'jugador' : 'jugadores'}</span>
              <em>${d.myDamage == null ? (d.mine ? 'Te falta jugar' : 'Sin jugar') : d.myDamage === d.best && d.best ? '👑 ' + fmt(d.myDamage) : '💥 ' + fmt(d.myDamage)}</em></button>`,
            )
            .join('')
        : '';
    },
    () => {},
  );
}

function createDuel() {
  if (duelBusy) return;
  duelBusy = true;
  act<{ code: string }>('duel_create').then(
    (a) => {
      duelBusy = false;
      openDuel(a.result.code, true);
    },
    (e) => {
      duelBusy = false;
      toast(errorText(e));
    },
  );
}

function openDuel(raw: string, fresh = false) {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) return toast('El código tiene 6 letras o números.');
  if (!online()) return toast('Entra con Google en Ajustes para jugar retos.');
  act<DuelInfo>('duel_get', { code }).then(
    (a) => showDuel(a.result, fresh),
    (e) => toast(errorText(e)),
  );
}

function duelRanking(d: DuelInfo): string {
  const done = d.entries.filter((e) => e.done);
  const playing = d.entries.filter((e) => !e.done);
  if (!d.entries.length) return `<p class="note">Todavía nadie jugó. ¡Sé el primero!</p>`;
  return `<ol class="duel-rank">${done
    .map((e, i) => `<li class="${e.me ? 'me' : ''}"><span class="pos">${i === 0 ? '👑' : i + 1}</span><b>${esc(e.name)}</b><small>combo x${e.combo}</small><em>💥 ${fmt(e.damage)}</em></li>`)
    .join('')}${playing.map((e) => `<li class="${e.me ? 'me' : ''} playing"><span class="pos">…</span><b>${esc(e.name)}</b><small></small><em>jugando</em></li>`).join('')}</ol>`;
}

function showDuel(d: DuelInfo, fresh = false) {
  const left = d.expires - Date.now();
  const when = d.expired ? 'Terminado' : left > 36 * 3600_000 ? `Termina en ${Math.round(left / 86400_000)} días` : `Termina en ${timeText(left)}`;
  const action = d.expired
    ? ''
    : d.played
      ? `<p class="duel-done">${d.myDamage == null ? 'Tu intento quedó sin terminar.' : `Hiciste 💥 <b>${fmt(d.myDamage)}</b> · puesto <b>#${d.rank}</b> de ${d.players}`}</p>`
      : `<button class="primary big" data-duel-play="${d.code}">⚔️ Jugar mi intento</button>`;
  showModal(`<div class="duel-modal">
    <button class="x" data-close>✕</button>
    <div class="duel-boss">${levelEnemySvg(d.level, true)}</div>
    <h2>Reto contra ${esc(levelEnemyName(d.level, d.level % LEVELS_PER_WORLD === 0))}</h2>
    <p class="duel-meta">Nivel ${d.level} · ${d.seconds} segundos · ${when}</p>
    <div class="duel-code-big">${d.code.split('').map((c) => `<span>${c}</span>`).join('')}</div>
    ${fresh ? `<p class="note">Pásale este código a tus amigos, o toca Compartir.</p>` : ''}
    <div class="duel-btns"><button data-duel-share="${d.code}">📤 Compartir</button><button data-duel-refresh="${d.code}">🔄 Actualizar</button></div>
    ${action}
    <div class="sec-head"><b>Ranking</b><small>${d.players} ${d.players === 1 ? 'jugador' : 'jugadores'}</small></div>
    ${duelRanking(d)}
  </div>`);
}

function duelLink(code: string) {
  return `${location.origin}${location.pathname}?reto=${code}`;
}

async function shareDuel(code: string) {
  const text = `¡Te reto en Héroes de la Forja! Código ${code}. ¿Quién le hace más daño al jefe en ${DUEL_SECONDS} segundos?`;
  const url = PROD ? duelLink(code) : '';
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Reto contra el jefe', text, ...(url ? { url } : {}) });
      return;
    }
  } catch {
    return; // canceló
  }
  try {
    await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
    toast('Copiado. Pégalo en el chat con tus amigos.');
  } catch {
    toast(`Código: ${code}`);
  }
}

function playDuel(code: string) {
  if (duelBusy || game.s.run) return;
  duelBusy = true;
  act<{ runId: string; seed: number; level: number }>('duel_start', { code }).then(
    (a) => {
      duelBusy = false;
      applyServer(a.state);
      duelRunId = a.result.runId;
      duelCode = code;
      game.rand = seeded(a.result.seed);
      if (game.startDuel(a.result.level)) {
        heroKeyCache = enemyKeyCache = '';
        resetBoardView();
        closeSheet();
        hideModal();
        toast(`¡${DUEL_SECONDS} segundos! Hazle todo el daño que puedas`);
      }
    },
    (e) => {
      duelBusy = false;
      toast(errorText(e));
    },
  );
}

function finishDuel(local: ClearReport) {
  const id = duelRunId;
  const code = duelCode;
  duelRunId = null;
  if (!id || !code) return;
  const t0 = Date.now();
  const alive = (game.s.run?.heroHp ?? 0) > 0;
  const show = (html: string) => setTimeout(() => showModal(html, true), Math.max(0, 1100 - (Date.now() - t0)));
  act<{ damage: number; info: DuelInfo }>('duel_finish', { runId: id, log: game.log }).then(
    (a) => {
      const d = a.result.info;
      const first = d.rank === 1 && d.entries.filter((e) => e.done).length > 1;
      show(`<div class="result duel-result ${first ? 'win' : ''}">
        <div class="big-ico">${first ? '👑' : '💥'}</div>
        <h2>${fmt(a.result.damage)} de daño</h2>
        <p class="duel-meta">${local.win ? '¡Aguantaste los ' + DUEL_SECONDS + ' segundos!' : alive ? 'Terminaste antes de tiempo.' : 'Tu héroe cayó antes de tiempo.'} Mejor combo x${local.maxCombo}.</p>
        <p class="duel-done">Puesto <b>#${d.rank}</b> de ${d.players} en el reto <b>${d.code}</b></p>
        ${duelRanking(d)}
        <div class="btns"><button data-leave>Inicio</button><button class="primary" data-duel-share="${d.code}">📤 Retar a más</button></div>
      </div>`);
      if (a.result.damage !== local.damage) console.warn('daño local', local.damage, 'servidor', a.result.damage);
    },
    (e) => {
      show(`<div class="result lose"><div class="big-ico">⚠️</div><h2>No se pudo anotar</h2><p>${errorText(e)}</p><div class="btns"><button data-leave>Inicio</button></div></div>`);
    },
  );
}

/** Link de invitación: ?reto=CODIGO abre el reto apenas carga el juego. */
function duelFromLink() {
  const code = new URLSearchParams(location.search).get('reto');
  if (!code) return;
  history.replaceState(null, '', location.pathname);
  if (online()) openDuel(code);
  else {
    pendingDuel = code;
    toast('Entra con Google en Ajustes para jugar el reto');
  }
}
let pendingDuel: string | null = null;

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
  combo.textContent = '';
  // Medidor de combo arriba del tablero: número grande y una barra que se vacía (si llega a cero, se corta).
  const hud = $('#combo-hud');
  const on = run.combo >= 2 && !run.result;
  if (hud.hidden === on) hud.hidden = !on;
  $('#legend').classList.toggle('dim', on);
  if (on) {
    const n = $('#ch-n');
    const txt = 'x' + run.combo;
    if (n.textContent !== txt) {
      n.textContent = txt;
      restartAnim(hud, 'pop');
    }
    const max = comboTime(game.s) + game.mods.combo;
    $('#ch-bar').style.width = Math.max(0, Math.min(1, run.comboTimer / max)) * 100 + '%';
  }
  const tier = run.result ? 0 : Math.min(4, Math.floor(run.combo / 10));
  if (tier !== frenzyTier) {
    const board = $('#board');
    const app = $('#app');
    for (let t = 1; t <= 4; t++) {
      board.classList.toggle('fz' + t, t === tier);
      hud.classList.toggle('fz' + t, t === tier);
      app.classList.toggle('fz' + t, t === tier);
    }
    app.classList.toggle('fz-on', tier > 0);
    $('#ch-name').textContent = tier ? FRENZY_NAMES[tier - 1] : '';
    if (tier > frenzyTier) frenzyUp(tier);
    else if (tier === 0 && frenzyTier > 0 && !run.result) comboBroken();
    frenzyTier = tier;
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
  const app = $('#app');
  app.classList.toggle('in-duel', !!run.duel);
  if (run.duel) {
    $('#run-title').textContent = `Reto ${duelCode ?? ''}`;
    const left = Math.ceil(run.duel.left);
    const html = `<span class="duel-time ${left <= 10 ? 'hurry' : ''}">⏱ ${left}s</span><span class="duel-dmg">💥 ${fmt(run.duel.dmg)}</span>`;
    const r = $('#route');
    if (r.dataset.k !== html) {
      r.innerHTML = html;
      r.dataset.k = html;
    }
    return;
  }
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

let frenzyTier = 0;
const FRENZY_NAMES = ['¡FRENESÍ!', '¡SÚPER COMBO!', '¡IMPARABLE!', '¡LEGENDARIO!'];
const FRENZY_COLORS = ['#4fd8ff', '#b07bff', '#ff4fd8', '#ffd84f'];

/** Subiste de nivel de frenesí: cartel gigante, destello, chispas y temblor. Cuanto más alto, más fuerte. */
function frenzyUp(tier: number) {
  const app = $('#app');
  const col = FRENZY_COLORS[tier - 1];
  document.querySelectorAll('.fz-announce').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = `fz-announce t${tier}`;
  el.style.setProperty('--c', col);
  const ns = 14 + tier * 6;
  const sparks = Array.from({ length: ns }, (_, i) => `<i style="--a:${(i * 360) / ns}deg;--d:${140 + (i % 4) * 40 + tier * 20}px;--t:${(i % 5) * 0.03}s"></i>`).join('');
  el.innerHTML = `<div class="fza-flash"></div><div class="fza-ring"></div><div class="fza-sparks">${sparks}</div>
    <div class="fza-text"><b>${FRENZY_NAMES[tier - 1]}</b><small>COMBO x${tier * 10} · daño x${comboMultiplier(tier * 10 - 1).toFixed(1).replace('.', ',')}</small></div>`;
  app.appendChild(el);
  setTimeout(() => el.remove(), 1500);
  restartAnim($('#board'), 'zap');
  restartAnim(app, tier >= 3 ? 'fz-shake-big' : 'fz-shake');
  if (navigator.vibrate) navigator.vibrate(tier >= 3 ? [40, 30, 40, 30, 90] : [30, 30, 60]);
}

/** Se cortó un combo de frenesí: el tablero se apaga un instante. */
function comboBroken() {
  const el = document.createElement('div');
  el.className = 'fz-broken';
  el.textContent = 'Se cortó el combo';
  $('#forge').appendChild(el);
  setTimeout(() => el.remove(), 1100);
  restartAnim($('#board'), 'fz-off');
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
      if (e.report.damage !== undefined) return finishDuel(e.report);
      finishOnline(e.report);
      setTimeout(() => showResult(e.report), 1100);
    }
  });
}
wireGame();

$('#flee').addEventListener('click', () => {
  if (game.s.run?.duel) {
    if (confirm('¿Terminar el reto ahora? Cuenta el daño que llevas y no hay otro intento.')) game.abandon();
    return;
  }
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
      <div class="btns"><button data-leave class="primary">Continuar</button></div></div>`,
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
  if (colsOf(run.grid) !== COLS || rowsOf(run.grid) !== ROWS || !$('#board').dataset.ready) {
    COLS = colsOf(run.grid);
    ROWS = rowsOf(run.grid);
    const b = $('#board');
    b.dataset.ready = '1';
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
  heroe: ['Tu héroe', 'Entrena ataque, vida y crítico'],
  arsenal: ['Equipo', 'Armas, escudos, potenciadores y skins'],
  cofres: ['Tienda', 'Cofres, oro y gemas'],
  liga: ['Liga semanal', 'Compite contra otros 29 héroes'],
  eventos: ['Eventos', 'Retos con amigos y lo que viene'],
  vip: ['Zona VIP', 'Ventajas para los que van en serio'],
};

function openSheet(tab: Tab) {
  openTab = tab;
  $('#sheet').hidden = false;
  $('#sheet').dataset.tab = tab;
  $('#sheet-title').textContent = TAB_TITLES[tab][0];
  $('#sheet-sub').textContent = TAB_TITLES[tab][1];
  setNavActive(tab);
  track(game.s, `open:${tab}`);
  $('#sheet-body').scrollTop = 0;
  renderSheet(true);
}

function closeSheet() {
  openTab = null;
  $('#sheet').hidden = true;
  setNavActive('combate');
}

/** En la barra de abajo queda marcado lo que se ve; sin panel abierto, es Combate. */
function setNavActive(tab: string) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab));
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
  const tab = btn.dataset.tab as Tab | 'combate';
  if (tab === 'combate' || openTab === tab) closeSheet();
  else openSheet(tab);
});
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (ev) => {
  if (ev.target === $('#sheet')) closeSheet();
});
// Pantalla completa (Android y computadora; en iPhone hay que agregarlo a la pantalla de inicio).
{
  const fsBtn = $('#fullscreen');
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const can = !!(root.requestFullscreen || root.webkitRequestFullscreen) && !matchMedia('(display-mode: fullscreen)').matches;
  fsBtn.hidden = !can;
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.())?.catch?.(() => toast('Tu navegador no deja usar pantalla completa acá'));
  });
}
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
  $('#vip-btn').hidden = !!s.run;
}

/** Héroe: el personaje al centro, sus 3 números (ataque, crítico y vida) para entrenar, y atajos al equipo. */
function renderHeroSheet() {
  const s = game.s;
  const skin = armById(s.arms.skin)!;
  const dmg = Math.round((damageMultiplier(s) * (1 + game.mods.dmg) - 1) * 100);
  const stat = (id: UpgradeId, ico: string, label: string, value: string) => `<div class="hs-stat">
      <span class="hs-ico">${ico}</span><small>${label}</small><b>${value}</b>
      <button class="upgrade hs-up" data-up="${id}"><span data-lvl></span><span class="u-cost" data-cost></span><span data-desc hidden></span></button>
    </div>`;
  const slot = (f: ArmFam) => {
    const d = armById(s.arms[f])!;
    const st = s.arsenal[d.id];
    const goal = shardGoal(d.id);
    const ready = armReady(d);
    return `<button class="hs-slot ${ready ? 'ready' : ''}" data-goto-arm="${f}" style="--rar:${RARITY_COLORS[d.rarity]}">
      <span class="t-icon">${armIcon(d)}</span><small>Nv ${st.lvl}</small>
      <span class="hs-bar"><i style="width:${Math.min(100, (st.shards / goal) * 100)}%"></i></span><em>${st.shards}/${goal}</em>
      ${ready ? '<i class="dot"></i>' : ''}
    </button>`;
  };
  $('#sheet-body').innerHTML = `
    <div class="hs" style="--rar:${RARITY_COLORS[skin.rarity]}">
      <div class="hs-slots left">${slot('espada')}${slot('escudo')}</div>
      <div class="hs-hero">${myHero()}</div>
      <div class="hs-slots right">${slot('rayo')}${slot('skin')}</div>
    </div>
    <div class="hs-name"><b>${esc(s.playerName || 'Tu héroe')}</b><span>⚔️ Poder <b>${fmt(power(s))}</b></span></div>
    <div class="hs-stats">
      ${stat('fuerza', '⚔️', 'Ataque', `+${dmg}%`)}
      ${stat('critico', '🎯', 'Crítico', `${Math.round(critChance(s) * 100)}%`)}
      ${stat('vida', '❤️', 'Vida', fmt(maxHp(s)))}
    </div>
    <p class="note">Toca un arma, el escudo, el potenciador o la skin para subirlos en Equipo.</p>`;
  updateTalents();
}

function updateTalents() {
  const gold = $('#sheet-body').querySelector('.train-head b');
  if (gold) gold.textContent = `🪙 ${fmt(game.s.gold)}`;
  $('#sheet-body')
    .querySelectorAll<HTMLElement>('.upgrade')
    .forEach((el) => {
      const id = el.dataset.up as UpgradeId;
      const def = UPGRADES.find((u) => u.id === id)!;
      const lvl = game.s.upgrades[id];
      const maxed = lvl >= def.max;
      el.querySelector('[data-lvl]')!.textContent = el.classList.contains('hs-up') ? (maxed ? `Nv ${lvl}` : `Nv ${lvl} → ${lvl + 1}`) : `Nv ${lvl}`;
      el.querySelector('[data-desc]')!.textContent = def.desc(lvl);
      el.querySelector('[data-cost]')!.textContent = maxed ? 'MÁX' : `🪙 ${fmt(upgradeCost(def, lvl))}`;
      el.classList.toggle('can', game.canBuy(id));
      el.classList.toggle('maxed', maxed);
    });
}

/** Precio de referencia de cada ampliación del tablero (dinero real, todavía sin cobro). */
const BOARD_PRICE = 'US$ 1,99';

function expandBox(): string {
  const s = game.s;
  const item = (kind: 'rows' | 'cols', label: string) =>
    s.board[kind] ? `<button disabled>${label} ✓</button>` : `<button data-interest="board_${kind}" class="money">${label} <span>${BOARD_PRICE}</span></button>`;
  return `<div class="vip-card">
    <div class="vip-ico">▦</div>
    <div class="vip-main"><b>Tablero más grande</b><p>Ahora es de ${BASE_COLS + s.board.cols}×${BASE_ROWS + s.board.rows}. Más piezas en pantalla, más parejas para juntar rápido.</p>
    <div class="expand-btns">${item('rows', '+1 fila')}${item('cols', '+1 columna')}</div></div>
  </div>`;
}

function renderVip() {
  const s = game.s;
  $('#sheet-body').innerHTML = `
    <div class="vip-hero"><span>👑</span><p>Llegaste lejos. Acá están las mejoras especiales para tu héroe.</p></div>
    ${expandBox()}
    <div class="vip-card soon">
      <div class="vip-ico">🚫</div>
      <div class="vip-main"><b>Sin anuncios</b><p>Juega sin interrupciones para siempre.</p><button data-interest="noads">¡Me interesa!</button></div>
    </div>
    <div class="vip-card pass${passActive(s) ? ' on' : ''}">
      <div class="vip-ico">✨</div>
      <div class="vip-main"><b>Pase mensual</b><p>Durante 30 días, ${Math.round(PASS.lvl2 * 100)}% de las piezas nuevas llegan en nivel 2 y ${Math.round(PASS.lvl3 * 100)}% en nivel 3. Fusiones más fuertes desde el primer toque.</p>
      ${passActive(s) ? `<div class="pass-on">✅ Activo · quedan ${passDaysLeft(s)} días</div>` : ''}${testTools() ? `<button data-pass class="${passActive(s) ? '' : 'can'}">${passActive(s) ? 'Sumar 30 días (prueba)' : 'Activar (prueba)'}</button>` : passActive(s) ? '' : `<button data-interest="pass" class="money">Muy pronto <span>US$ 4,99 / mes</span></button>`}</div>
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

type ShopTab = 'cofres' | 'oro' | 'gemas';
let shopTab: ShopTab = 'cofres';

function openShop(tab: ShopTab = 'cofres') {
  shopTab = tab;
  if (openTab === 'cofres') {
    renderShop();
    $('#sheet-body').scrollTop = 0;
  } else openSheet('cofres');
}

function usd(n: number) {
  return 'US$ ' + n.toFixed(2).replace('.', ',');
}

function renderShop() {
  const s = game.s;
  const seg = `<div class="seg shop-seg">${(
    [
      ['cofres', '🎁', 'Cofres'],
      ['oro', '🪙', 'Oro'],
      ['gemas', '💠', 'Gemas'],
    ] as [ShopTab, string, string][]
  )
    .map(([k, ico, label]) => `<button data-shop-tab="${k}" class="${shopTab === k ? 'on' : ''}"><span>${ico}</span>${label}${k === 'cofres' && !game.freeChestIn() ? '<i class="dot"></i>' : ''}</button>`)
    .join('')}</div>`;
  let inner = '';
  if (shopTab === 'cofres') {
    const wait = game.freeChestIn();
    const free = CHESTS.find((c) => c.id === 'armas')!;
    inner = `
    <div class="free-chest ${wait ? '' : 'ready'}">
      <div class="chest-art">${chestSvg('armas')}</div>
      <div class="fc-main"><small>Cofre gratis</small><b>${free.name}</b><span data-free-timer>${wait ? `Listo en ${timeText(wait)}` : `${Math.round(free.shards / 2)} fragmentos de regalo`}</span></div>
      <button data-free-chest ${wait ? 'disabled' : ''}>${wait ? 'Esperando' : 'Abrir'}</button>
    </div>
    ${CHESTS.map((c) => {
      const left = pityLeft(s.pulls[c.id] ?? 0);
      const p1 = c.gems;
      const p10 = chestPrice(c.gems, 10);
      return `<div class="shop-chest c-${c.id}">
        <div class="chest-art">${chestSvg(c.id)}</div>
        <div class="sc-main">
          <b>${c.name}</b>
          <p>${c.desc} · ${c.shards} por cofre</p>
          <div class="pity"><span>🎯 Épica segura en <b>${left.small}</b></span><span>👑 Legendaria en <b>${left.big}</b></span></div>
          <div class="sc-buy">
            <button data-chest="${c.id}" data-count="1" class="${s.gems >= p1 ? 'can' : ''}"><small>Abrir x1</small>💠 ${p1}</button>
            <button data-chest="${c.id}" data-count="10" class="x10 ${s.gems >= p10 ? 'can' : ''}"><em>Paga 9</em><small>Abrir x10</small>💠 ${p10}</button>
          </div>
        </div>
      </div>`;
    }).join('')}
    <p class="note">Cada 10 cofres de un mismo tipo sale seguro una variante épica, y cada 100 una legendaria (mientras no haya legendarias, una épica completa para desbloquear). Los niveles también dan fragmentos.</p>`;
  } else if (shopTab === 'oro') {
    inner = `<div class="shop-grid">${GOLD_PACKS.map(
      (p, i) => `<button class="shop-pack gold ${s.gems >= p.gems ? 'can' : ''}" data-gold-pack="${i}">
        ${p.tag ? `<em>${p.tag}</em>` : ''}
        <span class="pk-ico">${'🪙'.repeat(i + 1)}</span>
        <b>${fmt(goldPackAmount(i, s.unlocked))}</b>
        <span class="pk-price">💠 ${p.gems}</span>
      </button>`,
    ).join('')}</div>
    <p class="note">El oro de cada paquete crece con tu nivel: siempre rinde como unos ${GOLD_PACKS[0].levels}, ${GOLD_PACKS[1].levels} o ${GOLD_PACKS[2].levels} niveles jugados donde estás.</p>`;
  } else {
    inner = `<div class="shop-grid gems">${GEM_PACKS.map(
      (p, i) => `<button class="shop-pack gem" data-gem-pack="${i}">
        ${p.tag ? `<em>${p.tag}</em>` : ''}
        <span class="pk-ico">${'💠'.repeat(Math.min(3, i + 1))}</span>
        <b>${fmt(p.gems)}</b>
        <span class="pk-price money">${usd(p.usd)}</span>
      </button>`,
    ).join('')}</div>
    <p class="note">Muy pronto se van a poder comprar. Toca el que te interesa y te avisamos.</p>`;
  }
  $('#sheet-body').innerHTML = seg + inner;
}

const CHEST_PAL: Record<string, [string, string, string]> = {
  armas: ['#5f86e8', '#2b3f86', '#c9d6ff'],
  skins: ['#b56be8', '#552a86', '#f0d2ff'],
  poder: ['#f2b53a', '#8a5410', '#fff1b8'],
};

/** Cofre dibujado: cuerpo y tapa por separado para poder animar la apertura. */
function chestSvg(id: string): string {
  const [c, d, l] = CHEST_PAL[id] ?? CHEST_PAL.armas;
  return `<svg viewBox="0 0 200 180" class="chest-svg">
    <ellipse cx="100" cy="168" rx="78" ry="9" fill="rgba(0,0,0,.45)"/>
    <g class="ch-body">
      <rect x="22" y="78" width="156" height="86" rx="12" fill="${d}" stroke="#120a22" stroke-width="5"/>
      <rect x="30" y="84" width="140" height="18" rx="6" fill="rgba(0,0,0,.25)"/>
      <rect x="40" y="78" width="16" height="86" fill="#e8b54a" stroke="#120a22" stroke-width="4"/>
      <rect x="144" y="78" width="16" height="86" fill="#e8b54a" stroke="#120a22" stroke-width="4"/>
      <rect x="22" y="128" width="156" height="10" fill="${c}" opacity=".55"/>
    </g>
    <ellipse class="ch-light" cx="100" cy="82" rx="70" ry="14" fill="${l}"/>
    <g class="ch-lid">
      <path d="M22 84 V60 Q22 22 100 22 Q178 22 178 60 V84 Z" fill="${c}" stroke="#120a22" stroke-width="5"/>
      <path d="M34 60 Q38 34 100 32 Q162 34 166 60" fill="none" stroke="${l}" stroke-width="5" stroke-linecap="round" opacity=".6"/>
      <path d="M40 84 V40 M56 84 V30" stroke="#120a22" stroke-width="4"/>
      <rect x="40" y="26" width="16" height="58" fill="#e8b54a" stroke="#120a22" stroke-width="4"/>
      <rect x="144" y="26" width="16" height="58" fill="#e8b54a" stroke="#120a22" stroke-width="4"/>
      <rect x="84" y="68" width="32" height="34" rx="6" fill="#ffd25c" stroke="#120a22" stroke-width="4"/>
      <circle cx="100" cy="82" r="5" fill="#120a22"/><rect x="98" y="84" width="4" height="10" fill="#120a22"/>
    </g>
  </svg>`;
}

const RAR_RANK: Record<string, number> = { común: 0, rara: 1, épica: 2, legendaria: 3 };
const RAR_LABEL: Record<string, string> = { común: 'Común', rara: 'Rara', épica: 'Épica', legendaria: 'Legendaria' };

/** Fragmentos que le faltan a una variante para el próximo paso (desbloquear o subir). */
function shardGoal(id: string): number {
  const st = game.s.arsenal[id];
  return st.lvl === 0 ? unlockShards(armById(id)!.rarity) : upgradeShards(st.lvl);
}

function openChestUi(id: string, free: boolean, count = 1) {
  const chest = CHESTS.find((c) => c.id === id)!;
  const price = chestPrice(chest.gems, count);
  const before: Record<string, number> = {};
  for (const a of ARMS) before[a.id] = game.s.arsenal[a.id].shards;
  const name = count > 1 ? `${chest.name} x${count}` : chest.name;
  if (!free && game.s.gems < price) {
    track(game.s, `chest_nogems:${id}`);
    toast(`Te faltan ${price - game.s.gems} 💠`);
    openShop('gemas');
    return;
  }
  if (online()) {
    // Los dados del cofre los tira el servidor.
    if (free && game.freeChestIn() > 0) return;
    act<ChestResult>('chest', { id, free, count }).then(
      (a) => {
        applyServer(a.state);
        refreshSheet();
        chestShow(chest.id, name, a.result, before, free, count);
      },
      (e) => {
        toast(errorText(e));
        resync();
      },
    );
    return;
  }
  const r = game.openChest(id, free, count);
  if (!r) return;
  save(game.s);
  refreshSheet();
  chestShow(chest.id, name, r, before, free, count);
}

/**
 * La apertura del cofre: cae, se toca 3 veces (cada toque brilla más y deja adivinar la rareza),
 * explota y van saliendo las cartas boca abajo, de la menos rara a la más rara.
 */
function chestShow(id: string, name: string, res: ChestResult, before: Record<string, number>, free: boolean, count = 1) {
  const got = res.got;
  const pityIds = new Set(res.pity.map((p) => p.id));
  const cards = Object.keys(got)
    .map((k) => ({ def: armById(k)!, n: got[k] }))
    .sort((a, b) => RAR_RANK[a.def.rarity] - RAR_RANK[b.def.rarity]);
  const best = cards[cards.length - 1].def.rarity;
  const bestCol = RARITY_COLORS[best];
  const total = cards.reduce((a, c) => a + c.n, 0);
  const el = document.createElement('div');
  el.className = 'chest-ov';
  el.style.setProperty('--rar', '#8ea0ff');
  el.innerHTML = `<div class="cel-rays"></div><div class="co-flash"></div>
    <button class="co-skip">Saltar ⏭</button>
    <div class="co-stage">
      <div class="co-title"><small>${free ? 'Cofre gratis' : 'Cofre'}</small><b>${name}</b></div>
      <div class="co-chest" data-hits="0">${chestSvg(id)}<div class="cel-sparks"></div></div>
      <div class="co-hint">Toca el cofre para abrirlo</div>
      <div class="co-cards"></div>
      <div class="co-count"></div>
    </div>`;
  document.body.appendChild(el);
  const chestEl = el.querySelector('.co-chest') as HTMLElement;
  const hint = el.querySelector('.co-hint') as HTMLElement;
  const cardsEl = el.querySelector('.co-cards') as HTMLElement;
  const countEl = el.querySelector('.co-count') as HTMLElement;
  let hits = 0;
  let phase: 'chest' | 'cards' | 'done' = 'chest';
  let shown = 0;
  const vib = (p: number | number[]) => navigator.vibrate?.(p);
  const sparks = (n: number, color: string) =>
    Array.from({ length: n }, (_, i) => `<i style="--a:${(i * 360) / n}deg;--d:${120 + (i % 4) * 35}px;--t:${(i % 5) * 0.04}s;background:${color};box-shadow:0 0 12px ${color}"></i>`).join('');

  const hit = () => {
    hits++;
    chestEl.dataset.hits = String(hits);
    chestEl.classList.remove('shake');
    void chestEl.offsetWidth;
    chestEl.classList.add('shake');
    // En el segundo toque el brillo ya toma el color de la mejor carta: la intriga.
    if (hits >= 2) el.style.setProperty('--rar', bestCol);
    vib(hits === 3 ? 60 : 25);
    hint.textContent = hits === 1 ? '¡Otra vez!' : hits === 2 ? (RAR_RANK[best] >= 2 ? '¡Algo brilla adentro…!' : '¡Una más!') : '';
    if (hits >= 3) setTimeout(burst, 260);
  };

  const burst = () => {
    chestEl.classList.add('open');
    el.classList.add('opened');
    hint.textContent = '';
    (chestEl.querySelector('.cel-sparks') as HTMLElement).innerHTML = sparks(24, bestCol) + sparks(12, '#ffd25c');
    vib([40, 40, 80]);
    setTimeout(() => {
      phase = 'cards';
      cardsEl.innerHTML = cards
        .map(
          (c, i) => `<div class="co-card" style="--rar:${RARITY_COLORS[c.def.rarity]};--i:${i};z-index:${cards.length - i}">
            <div class="co-back"><span>?</span></div>
            <div class="co-front"></div>
          </div>`,
        )
        .join('');
      // La primera carta queda arriba: se muestran en orden inverso al apilado.
      [...cardsEl.children].forEach((n, i) => ((n as HTMLElement).style.zIndex = String(cards.length - i)));
      countEl.textContent = `${cards.length} cartas · toca para darlas vuelta`;
    }, 650);
  };

  const flip = () => {
    const c = cards[shown];
    const node = cardsEl.children[shown] as HTMLElement;
    const st = game.s.arsenal[c.def.id];
    const goal = shardGoal(c.def.id);
    const was = before[c.def.id];
    const ready = st.shards >= goal && st.lvl < MAX_ARM_LEVEL;
    const locked = st.lvl === 0;
    const tag = ready ? (locked ? '¡Lista para desbloquear!' : '¡Puede subir de nivel!') : locked ? 'Bloqueada' : `Nivel ${st.lvl}`;
    (node.querySelector('.co-front') as HTMLElement).innerHTML = `
      <div class="co-rar">${RAR_LABEL[c.def.rarity]}</div>${pityIds.has(c.def.id) ? '<div class="co-pity">🎯 Garantía</div>' : ''}
      <div class="co-art">${armShowcase(c.def)}</div>
      <b>${c.def.name}</b>
      <div class="co-n">+${c.n} 🧩</div>
      <div class="co-bar"><i style="--from:${Math.min(100, (was / goal) * 100)}%;--to:${Math.min(100, (st.shards / goal) * 100)}%"></i><span>${st.shards}/${goal}</span></div>
      <div class="co-tag ${ready ? 'ready' : ''}">${tag}</div>`;
    node.classList.add('flipped');
    if (RAR_RANK[c.def.rarity] >= 2) {
      el.classList.remove('epic');
      void el.offsetWidth;
      el.classList.add('epic');
      vib([50, 50, 120]);
    } else vib(20);
    shown++;
    // La carta anterior se corre para dejar ver la siguiente.
    if (shown > 1) (cardsEl.children[shown - 2] as HTMLElement).classList.add('gone');
    countEl.textContent = shown < cards.length ? `${cards.length - shown} más · toca para seguir` : 'Toca para ver el resumen';
  };

  const summary = () => {
    if (phase === 'done') return;
    phase = 'done';
    const chest = CHESTS.find((c) => c.id === id)!;
    const again = chestPrice(chest.gems, count);
    const canMore = game.s.gems >= again;
    const readyIds = cards.filter((c) => game.s.arsenal[c.def.id].shards >= shardGoal(c.def.id)).map((c) => c.def.id);
    el.classList.add('summary');
    (el.querySelector('.co-stage') as HTMLElement).innerHTML = `
      <div class="co-title"><small>Conseguiste</small><b>${total} fragmentos</b></div>
      <div class="co-sum">${cards
        .map((c) => {
          const st = game.s.arsenal[c.def.id];
          const goal = shardGoal(c.def.id);
          const r = st.shards >= goal;
          return `<div class="co-mini ${r ? 'ready' : ''}" style="--rar:${RARITY_COLORS[c.def.rarity]}">
            <div class="co-mini-art">${armIcon(c.def)}</div>
            <b>+${c.n}</b><small>${c.def.name}</small>
            <div class="co-bar sm"><i style="--from:${Math.min(100, (st.shards / goal) * 100)}%;--to:${Math.min(100, (st.shards / goal) * 100)}%"></i></div>
            ${r ? '<em>¡Lista!</em>' : pityIds.has(c.def.id) ? '<em class="pity">Garantía</em>' : ''}
          </div>`;
        })
        .join('')}</div>
      <div class="co-btns">
        ${readyIds.length ? `<button class="primary" data-co-arm="${readyIds[readyIds.length - 1]}">Mejorar ahora</button>` : `<button class="primary" data-co-arm="${cards[cards.length - 1].def.id}">Ver en el Arsenal</button>`}
        <button data-co-again class="${canMore ? 'can' : ''}">${count > 1 ? `Abrir 10 más · 💠 ${again}` : `Abrir otro · 💠 ${again}`}</button>
        <button data-co-close class="co-ghost">Listo</button>
      </div>`;
  };

  el.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('.co-skip')) {
      summary();
      return;
    }
    const arm = t.closest('[data-co-arm]') as HTMLElement | null;
    if (arm) {
      const def = armById(arm.dataset.coArm)!;
      armTab = def.fam;
      armSel[def.fam] = def.id;
      petsTab = false;
      el.remove();
      closeSheet();
      openSheet('arsenal');
      return;
    }
    if (t.closest('[data-co-again]')) {
      el.remove();
      openChestUi(id, false, count);
      return;
    }
    if (t.closest('[data-co-close]')) {
      el.remove();
      return;
    }
    if (phase === 'chest' && hits < 3) hit();
    else if (phase === 'cards') shown < cards.length ? flip() : summary();
  });
  track(game.s, `chest_show:${id}:${best}`);
}

function buyGoldPack(i: number) {
  const p = GOLD_PACKS[i];
  if (game.s.gems < p.gems) {
    toast(`Te faltan ${p.gems - game.s.gems} 💠`);
    return openShop('gemas');
  }
  if (online()) {
    act<{ gold: number }>('gold_pack', { pack: i }).then(
      (a) => {
        applyServer(a.state);
        toast(`+${fmt(a.result.gold)} 🪙`);
        refreshSheet();
      },
      (e) => toast(errorText(e)),
    );
    return;
  }
  const g = game.buyGold(i);
  if (g == null) return;
  save(game.s);
  toast(`+${fmt(g)} 🪙`);
  refreshSheet();
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
  return (
    def.skills.map((sk) => `<li class="${lvl >= sk.at ? 'got' : ''}"><b>Nv ${sk.at}</b><span>${sk.text}</span><i>${lvl >= sk.at ? '✓' : '🔒'}</i></li>`).join('') +
    (more ? `<li class="more"><b>41+</b><span>${levelGainText(def.fam)} por nivel</span></li>` : '')
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

let petsTab = false;
const FAM_CHEST: Record<ArmFam, string> = { espada: 'armas', escudo: 'armas', rayo: 'poder', skin: 'skins' };

function renderArsenal() {
  const segHtml = `<div class="seg arm-seg">${ARM_TABS.map(
    ([f, ico, label]) => `<button data-arm-tab="${f}" class="${!petsTab && f === armTab ? 'on' : ''}"><span>${ico}</span>${label}${ARMS.some((a) => a.fam === f && armReady(a)) ? '<i class="dot"></i>' : ''}</button>`,
  ).join('')}<button data-pets class="${petsTab ? 'on' : ''}"><span>🐾</span>Mascotas</button></div>`;
  if (petsTab) {
    $('#sheet-body').innerHTML = `${segHtml}
      <div class="pets-soon"><div class="ps-art">🐾</div><b>Mascotas</b><p>Muy pronto vas a poder tener un compañero que pelea a tu lado y suma su propia habilidad.</p><button data-interest="pets">¡Me interesa!</button></div>`;
    return;
  }
  const fam = armTab;
  const list = ARMS.filter((a) => a.fam === fam);
  const def = armById(armSel[fam] ?? game.s.arms[fam]) ?? list[0];
  const st = game.s.arsenal[def.id];
  const locked = st.lvl === 0;
  const chest = CHESTS.find((c) => c.id === FAM_CHEST[fam])!;
  $('#sheet-body').innerHTML = `
    ${segHtml}
    <div class="showcase" style="--rar:${RARITY_COLORS[def.rarity]}">
      <div class="sc-art ${locked ? 'locked' : ''}">${armShowcase(def)}${locked ? '<span class="lock">🔒</span>' : ''}</div>
      <div class="sc-info">
        <small class="rar">${def.rarity.toUpperCase()}</small>
        <h3>${def.name}</h3>
        <p class="sc-lvl">${locked ? 'Bloqueada' : `Nivel ${st.lvl} · ${armStatText(def, st.lvl)}`}<br><span>${levelGainText(fam)} por nivel${RARITY_LEVEL_BONUS[def.rarity] ? ` · arranca como una básica nivel ${1 + RARITY_LEVEL_BONUS[def.rarity]}` : ''}</span></p>
        <ul class="skills mini">${armSkills(def, false)}</ul>
      </div>
    </div>
    <div class="sc-btns btns">${armButtons(def)}</div>
    <button class="go-chest" data-go-shop="cofres"><span class="gc-art">${chestSvg(chest.id)}</span><span><b>Consigue fragmentos</b><small>${chest.name} · desde 💠 ${chest.gems}</small></span><em>Ir a cofres →</em></button>
    <div class="sec-head var-head"><b>Variantes</b><small>cada nivel ${levelGainText(fam)}</small></div>
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
  const skill = def.skills.find((sk) => sk.at === lvl);
  const el = document.createElement('div');
  const art = `<div class="cel-art">${armShowcase(def)}</div>`;
  if (kind === 'up' && !skill) {
    el.className = 'cel small';
    el.style.setProperty('--rar', RARITY_COLORS[def.rarity]);
    el.innerHTML = `<div class="cel-card">${art}<div><small>${def.name}</small><b>Nivel ${lvl}</b><span>${levelGainText(def.fam)}</span></div></div>`;
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
    sync(upEl ? 'arm_up' : 'arm_equip', { id });
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
  const isSkin = def.fam === 'skin';
  showModal(`<div class="arm-detail" style="--rar:${RARITY_COLORS[def.rarity]}">
    <button class="x" data-close aria-label="Cerrar">✕</button>
    <div class="arm-big ${isSkin ? 'skin' : ''}">${armIcon(def)}</div>
    <small class="rar">${def.rarity.toUpperCase()} · ${FAM_TITLES[def.fam]}</small>
    <h2>${def.name}</h2>
    <p class="muted">${locked ? 'Bloqueada' : `Nivel ${st.lvl} de ${MAX_ARM_LEVEL} · ${armStatText(def, st.lvl)}`}</p>
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
    if (full) return renderShop();
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
      ${duelBox()}
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
    if (online()) loadMyDuels();
  }
}

$('#sheet-body').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const up = t.closest('[data-up]') as HTMLElement | null;
  if (up) {
    if (game.buy(up.dataset.up as UpgradeId)) {
      restartAnim(up, 'bought');
      lobbyKey = '';
      sync('buy', { id: up.dataset.up });
      if (up.classList.contains('hs-up')) {
        renderHeroSheet();
        const again = $('#sheet-body').querySelector(`[data-up="${up.dataset.up}"]`) as HTMLElement | null;
        if (again) restartAnim(again.closest('.hs-stat') as HTMLElement, 'bought');
        return;
      }
    }
    updateTalents();
    return;
  }
  if (t.closest('[data-duel-create]')) return createDuel();
  if (t.closest('[data-duel-join]')) {
    const v = (document.querySelector('#duel-code') as HTMLInputElement | null)?.value ?? '';
    return openDuel(v);
  }
  const dOpen = t.closest('[data-duel-open]') as HTMLElement | null;
  if (dOpen) return openDuel(dOpen.dataset.duelOpen!);
  if (t.closest('[data-login-settings]')) return showSettings();
  if (armAction(t, false)) return;
  const gotoArm = t.closest('[data-goto-arm]') as HTMLElement | null;
  if (gotoArm) {
    armTab = gotoArm.dataset.gotoArm as ArmFam;
    petsTab = false;
    openSheet('arsenal');
    return;
  }
  const tabEl = t.closest('[data-arm-tab]') as HTMLElement | null;
  if (tabEl) {
    armTab = tabEl.dataset.armTab as ArmFam;
    petsTab = false;
    renderArsenal();
    return;
  }
  if (t.closest('[data-pets]')) {
    petsTab = true;
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
  if (t.closest('[data-pass]')) {
    if (online()) {
      act(me()?.admin ? 'admin_pass' : 'pass').then(
        (a) => {
          applyServer(a.state);
          toast('✨ ¡Pase mensual activo! Tus piezas llegan más fuertes');
        },
        (e) => toast(errorText(e)),
      );
      return;
    }
    if (!testTools()) return toast('Muy pronto se va a poder comprar.');
    game.activatePass();
    toast('✨ ¡Pase mensual activo! Tus piezas llegan más fuertes');
    refreshSheet();
    return;
  }
  if (t.closest('[data-free-chest]')) return openChestUi('armas', true);
  const chest = t.closest('[data-chest]') as HTMLElement | null;
  if (chest) return openChestUi(chest.dataset.chest!, false, Number(chest.dataset.count) === 10 ? 10 : 1);
  const shopT = t.closest('[data-shop-tab]') as HTMLElement | null;
  if (shopT) return openShop(shopT.dataset.shopTab as ShopTab);
  const goldP = t.closest('[data-gold-pack]') as HTMLElement | null;
  if (goldP) return buyGoldPack(Number(goldP.dataset.goldPack));
  const gemP = t.closest('[data-gem-pack]') as HTMLElement | null;
  if (gemP) {
    track(game.s, `interest:gems_${gemP.dataset.gemPack}`);
    toast('¡Anotado! Te avisamos cuando se puedan comprar');
    return;
  }
  const goShop = t.closest('[data-go-shop]') as HTMLElement | null;
  if (goShop) return openShop(goShop.dataset.goShop as ShopTab);
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
    ${accountBox()}
    <label class="start-label">Nombre en la liga<input id="name-input" maxlength="14" value="${esc(game.s.playerName)}"></label>
    ${online() ? '' : `<div class="set-box">
      <b>Copiar progreso</b>
      <p>Tu progreso se guarda en este dispositivo. Para pasarlo a otro, copia tu código y cárgalo allá.</p>
      <div class="btns"><button data-export>Copiar mi código</button><button data-import>Cargar un código</button></div>
    </div>`}
    ${testTools() ? `<div class="set-box test"><b>Herramientas de administrador</b><p>${online() ? 'Solo tu cuenta las ve. Los cambios se hacen en el servidor.' : 'Solo fuera de la página publicada, para probar.'}</p>
      <div class="btns"><button data-test-gems>+1.000 💠</button><button data-test-gold>+50.000 🪙</button></div>
      <div class="btns"><button data-test-board="rows">${game.s.board.rows ? 'Quitar' : 'Poner'} +1 fila</button><button data-test-board="cols">${game.s.board.cols ? 'Quitar' : 'Poner'} +1 columna</button></div></div>` : ''}
    ${!online() || me()?.admin ? `<details class="danger"><summary>Zona peligrosa</summary><button data-reset>Borrar todo el progreso</button></details>` : ''}
  </div>`);
  wireLogin();
}

$('#modal').addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === 'name-input') {
    game.s.playerName = t.value.trim().slice(0, 14);
    lobbyKey = '';
    save(game.s);
    sync('name', { name: game.s.playerName });
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
  } else if (t.closest('[data-logout]')) {
    doLogout();
  } else if (online() && t.closest('[data-test-gems], [data-test-gold], [data-test-board]')) {
    const b = t.closest('[data-test-board]') as HTMLElement | null;
    const type = b ? 'admin_board' : t.closest('[data-test-gems]') ? 'admin_gems' : 'admin_gold';
    const kind = b?.dataset.testBoard as 'rows' | 'cols' | undefined;
    act(type, kind ? { kind, on: !game.s.board[kind] } : {}).then(
      (a) => {
        applyServer(a.state);
        if (b && kind) b.textContent = `${game.s.board[kind] ? 'Quitar' : 'Poner'} +1 ${kind === 'rows' ? 'fila' : 'columna'}`;
        toast('Hecho en el servidor ✓');
      },
      (e) => toast(errorText(e)),
    );
  } else if (t.closest('[data-test-gems]')) {
    game.s.gems += 1000;
    track(game.s, 'test_gems');
    save(game.s);
    toast('+1.000 💠 de prueba');
  } else if (t.closest('[data-test-board]')) {
    const el = t.closest('[data-test-board]') as HTMLElement;
    const kind = el.dataset.testBoard as 'rows' | 'cols';
    const on = !game.s.board[kind];
    if (!game.setBoardExtra(kind, on)) return toast('Termina la pelea primero');
    save(game.s);
    el.textContent = `${on ? 'Quitar' : 'Poner'} +1 ${kind === 'rows' ? 'fila' : 'columna'}`;
    toast(on ? 'Tablero ampliado (prueba)' : 'Ampliación quitada (prueba)');
  } else if (t.closest('[data-test-gold]')) {
    game.s.gold += 50000;
    track(game.s, 'test_gold');
    save(game.s);
    toast('+50.000 🪙 de prueba');
  } else if (t.closest('[data-reset]')) {
    if (confirm('¿Seguro? Se borra todo tu progreso.')) {
      if (online()) {
        act('admin_reset').then((a) => (applyServer(a.state), hideModal(), toast('Progreso borrado')), (e) => toast(errorText(e)));
        return;
      }
      resetSave();
      location.reload();
    }
  }
});

// ---------- Cuenta ----------

function accountBox(): string {
  if (online()) {
    const m = me()!;
    return `<div class="set-box account"><b>Tu cuenta ${m.admin ? '<span class="admin-tag">ADMIN</span>' : ''}</b>
      <p>${esc(m.name)}<br><small>${esc(m.email)}</small></p><p>Tu progreso se guarda en el servidor y lo puedes seguir en cualquier dispositivo.</p>
      <div class="btns"><button data-logout>Cerrar sesión</button></div></div>`;
  }
  if (!LOGIN_HERE) return '';
  return `<div class="set-box account"><b>Guarda tu progreso</b>
    <p>Entra con Google para guardar tu progreso en la nube, jugar en cualquier dispositivo y competir en la liga de verdad.</p>
    <p class="muted">Tu cuenta empieza de cero: el progreso de invitado queda en este dispositivo.</p>
    <div id="gbtn" class="gbtn"></div></div>`;
}

/** Monta el botón de Google si la ventana de ajustes lo tiene. */
function wireLogin() {
  const el = document.getElementById('gbtn');
  if (!el) return;
  mountGoogleButton(
    el,
    (cred) => {
      el.textContent = 'Entrando…';
      loginWithGoogle(cred).then(
        () => {
          try {
            localStorage.setItem(GUEST_KEY, JSON.stringify(game.s)); // el progreso de invitado queda guardado aparte
          } catch {
            /* sin almacenamiento */
          }
          return fetchState().then((a) => {
            applyServer(a.state);
            viewLevel = game.s.unlocked;
            hideModal();
            toast(`¡Hola, ${me()?.name.split(' ')[0] ?? ''}! Tu progreso ya se guarda en la nube`);
            if (pendingDuel) {
              const c = pendingDuel;
              pendingDuel = null;
              openDuel(c);
            }
          });
        },
        (e) => {
          el.textContent = errorText(e);
        },
      );
    },
    () => (el.textContent = 'No se pudo cargar el ingreso con Google.'),
  );
}

function doLogout() {
  logout().then(() => {
    let guest: GameState | null = null;
    try {
      guest = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
    } catch {
      guest = null;
    }
    game.setState(guest ? migrate(guest) : migrate({}));
    save(game.s);
    lobbyKey = heroKeyCache = enemyKeyCache = '';
    viewLevel = game.s.unlocked;
    hideModal();
    toast('Sesión cerrada. Ahora juegas como invitado.');
  });
}

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
  } else if (t.closest('[data-duel-play]')) {
    playDuel((t.closest('[data-duel-play]') as HTMLElement).dataset.duelPlay!);
  } else if (t.closest('[data-duel-share]')) {
    shareDuel((t.closest('[data-duel-share]') as HTMLElement).dataset.duelShare!);
  } else if (t.closest('[data-duel-refresh]')) {
    openDuel((t.closest('[data-duel-refresh]') as HTMLElement).dataset.duelRefresh!);
  } else if (t.closest('[data-leave]')) backHome();
  else if (t.closest('[data-next]')) {
    const lvl = Number((t.closest('[data-next]') as HTMLElement).dataset.next);
    backHome();
    startLevel(Math.min(lvl, game.s.unlocked));
  } else if (t.closest('[data-refill]')) {
    if (game.refillEnergy()) {
      sync('refill');
      toast('Energía recargada ⚡');
      hideModal();
    } else {
      track(game.s, 'energy_refill_nogems');
      toast(`Te faltan ${REFILL_GEMS - game.s.gems} 💠`);
    }
  } else if (t.closest('[data-do-import]')) {
    if (online()) return toast('Con tu cuenta el progreso se guarda solo en el servidor');
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
    sync('name', { name: game.s.playerName });
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
$('#gold-btn').addEventListener('click', () => openShop('oro'));
$('#gems-btn').addEventListener('click', () => openShop('gemas'));

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
  game.advance(dt);
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
// Con sesión: lo que vale es lo del servidor.
if (online())
  fetchState().then(
    (a) => {
      applyServer(a.state);
      viewLevel = game.s.unlocked;
    },
    (e) => toast(errorText(e)),
  );
regenEnergy(game.s);
if (rolloverLeague(game.s)) showLeagueResult();
if (!game.s.playerName && !online()) {
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
duelFromLink();
setNavActive('combate');
// Solo fuera de la versión publicada: acceso para pruebas automáticas.
if (!PROD) Object.defineProperty(window, '__game', { get: () => game });
