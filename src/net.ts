// Conexión con el servidor del juego. Con sesión iniciada, el servidor es el dueño del progreso:
// cada acción se manda y la respuesta del servidor reemplaza lo que haya en el celu.

import type { GameState } from './state';

const DEFAULT_API = 'https://forja-api.hernan-ss.workers.dev';
/** Dirección del servidor. Para probar con uno local: localStorage['forja-api'] = 'http://localhost:8787'. */
export const API = (() => {
  try {
    return localStorage.getItem('forja-api') || DEFAULT_API;
  } catch {
    return DEFAULT_API;
  }
})();
export const GOOGLE_CLIENT_ID = '554911510319-s9etahete05ilh86dd2r2bfnilq1jgkm.apps.googleusercontent.com';
const AUTH_KEY = 'forja-auth';

export interface Me {
  name: string;
  email: string;
  admin: boolean;
}
interface Auth {
  session: string;
  me: Me;
}

let auth: Auth | null = null;
try {
  auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
} catch {
  auth = null;
}

export const online = () => !!auth;
export const me = () => auth?.me ?? null;

export class NetError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request(path: string, body?: unknown): Promise<any> {
  let r: Response;
  try {
    r = await fetch(API + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth.session } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetError(0, 'offline');
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && auth && path !== '/auth/google') logoutLocal();
  if (!r.ok) throw new NetError(r.status, j.error || 'error');
  return j;
}

function logoutLocal() {
  auth = null;
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

export async function loginWithGoogle(credential: string): Promise<Me> {
  const j = await request('/auth/google', { credential });
  auth = { session: j.session, me: j.me };
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    /* sin almacenamiento */
  }
  return j.me;
}

export async function logout() {
  try {
    await request('/auth/logout', {});
  } catch {
    /* igual se cierra en el celu */
  }
  logoutLocal();
}

export interface Answer<T = any> {
  state: GameState;
  me: Me;
  result: T;
}

// Las acciones van de a una y en orden, para que el servidor las vea igual que el jugador.
let queue: Promise<unknown> = Promise.resolve();
function keep(a: { me?: Me }) {
  if (auth && a.me) {
    auth.me = a.me;
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } catch {
      /* sin almacenamiento */
    }
  }
}

export function fetchState(): Promise<Answer<null>> {
  const p = queue.then(() => request('/state')).then((a) => (keep(a), a));
  queue = p.catch(() => undefined);
  return p;
}

export function act<T = any>(type: string, data: Record<string, unknown> = {}): Promise<Answer<T>> {
  const p = queue.then(() => request('/act', { type, ...data })).then((a) => (keep(a), a));
  queue = p.catch(() => undefined);
  return p;
}

/** Carga el botón de Google dentro de `el`. */
export function mountGoogleButton(el: HTMLElement, onCredential: (c: string) => void, onFail: () => void) {
  const w = window as unknown as { google?: any };
  const render = () => {
    try {
      w.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: { credential: string }) => onCredential(r.credential), auto_select: false });
      w.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', locale: 'es', width: 260 });
    } catch {
      onFail();
    }
  };
  if (w.google?.accounts?.id) return render();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = render;
  s.onerror = onFail;
  document.head.appendChild(s);
}

/** Lo que dice cada error del servidor, en palabras del jugador. */
export function errorText(e: unknown): string {
  const code = e instanceof NetError ? e.code : 'error';
  const m: Record<string, string> = {
    offline: 'Sin conexión. Revisa tu internet.',
    unauthorized: 'Tu sesión venció. Entra de nuevo.',
    too_many_requests: 'Vas muy rápido, espera un momento.',
    too_fast: 'Esa pelea no cuenta: terminó más rápido de lo posible.',
    needs_payment: 'Muy pronto se va a poder comprar.',
    admin_only: 'Solo para administradores.',
    run_expired: 'La pelea tardó demasiado y venció.',
    bad_code: 'El código tiene 6 letras o números.',
    duel_not_found: 'No existe un reto con ese código.',
    duel_expired: 'Ese reto ya terminó.',
    duel_already_played: 'Ya jugaste este reto: hay un solo intento.',
    too_many_duels: 'Creaste muchos retos hoy. Prueba mañana.',
    already_claimed: 'Ya cobraste el premio de hoy.',
    not_ready: 'Todavía no está lista.',
  };
  if (m[code]) return m[code];
  if (code.startsWith('replay_')) return 'El servidor no pudo validar esa pelea.';
  if (code.startsWith('cannot_')) return 'No alcanza o no se puede hacer eso.';
  return 'Algo falló con el servidor. Prueba de nuevo.';
}
