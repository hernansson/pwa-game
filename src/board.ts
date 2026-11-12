// Tablero siempre lleno: juntas dos piezas iguales y caen piezas nuevas desde arriba.

export const BASE_COLS = 5;
export const BASE_ROWS = 6;
export const MAX_EXTRA_COLS = 1;
export const MAX_EXTRA_ROWS = 1;
export const MAX_LEVEL = 10;

export type Family = 'espada' | 'escudo' | 'pocion' | 'rayo';
export const FAMILIES: Family[] = ['espada', 'escudo', 'pocion', 'rayo'];

export const FAMILY_INFO: Record<Family, { name: string; effect: string; color: string; weight: number }> = {
  espada: { name: 'Espadas', effect: 'Daño al enemigo', color: '#c9d3dd', weight: 42 },
  escudo: { name: 'Escudos', effect: 'Bloquean golpes', color: '#5c9bff', weight: 26 },
  pocion: { name: 'Pociones', effect: 'Curan al héroe', color: '#ff5a8a', weight: 10 },
  rayo: { name: 'Rayos', effect: 'Potencian el daño unos segundos', color: '#ffd25a', weight: 20 },
};

/** Piezas especiales que caen a veces: bomba (se junta con cualquiera y arrastra todas las de esa familia),
 * comodín (sirve con cualquier pieza de su nivel) y cofre (dos cofres iguales suben; en nivel 3 se abre y da oro). */
export type Special = 'bomb' | 'star' | 'chest';
/** Un cofre se abre al llegar a este nivel. */
export const CHEST_OPEN = 3;

export interface Piece {
  fam: Family;
  lvl: number;
  id: number; // para animaciones
  sp?: Special;
  /** Segundos que queda trabada (telaraña o hielo): no se puede juntar. */
  web?: number;
  /** Segundos para quemarse (diablillo/dragón): si no la usas, se pierde y te hace daño. */
  burn?: number;
  /** La traba es hielo (no telaraña). */
  ice?: boolean;
}

/** grid[col][row], row 0 = abajo. El tamaño puede crecer con las ampliaciones. */
export type Grid = (Piece | null)[][];

export interface Cell {
  col: number;
  row: number;
}

export interface MergeEvent {
  fam: Family;
  lvl: number; // nivel resultante
  size: number; // cuántas piezas se juntaron
  col: number;
  row: number;
  burst: boolean; // se juntaron piezas de nivel máximo: explotan
  kind?: Special; // se usó una bomba / un comodín / se juntaron cofres
  /** Bomba: fuerza sumada de todas las piezas que arrastró. */
  value?: number;
  /** Cofre que llegó al nivel máximo y se abrió. */
  opened?: boolean;
}

export const colsOf = (g: Grid) => g.length;
export const rowsOf = (g: Grid) => g[0]?.length ?? 0;

let nextId = 1;
export function makePiece(fam: Family, lvl: number): Piece {
  return { fam, lvl, id: nextId++ };
}

/** Chances de que una pieza nueva llegue en nivel 2 o 3. */
export interface PieceOdds { two: number; three: number }

export function randomPiece(odds: PieceOdds, rand = Math.random): Piece {
  const total = FAMILIES.reduce((a, f) => a + FAMILY_INFO[f].weight, 0);
  let r = rand() * total;
  let fam: Family = 'espada';
  for (const f of FAMILIES) {
    r -= FAMILY_INFO[f].weight;
    if (r <= 0) {
      fam = f;
      break;
    }
  }
  // Siempre nivel 1 salvo con el pase mensual.
  const r2 = rand();
  const lvl = r2 < odds.three ? 3 : r2 < odds.three + odds.two ? 2 : 1;
  return makePiece(fam, lvl);
}

/** Tablero lleno de piezas al azar. */
export function startingGrid(cols: number, rows: number, odds: PieceOdds, rand = Math.random): Grid {
  return Array.from({ length: cols }, () => Array.from({ length: rows }, () => randomPiece(odds, rand)));
}

/** Si dos piezas se pueden juntar (iguales, o con comodín, bomba o cofres). */
export function canMerge(a: Piece | null | undefined, b: Piece | null | undefined): boolean {
  if (!a || !b || a === b || a.web || b.web) return false;
  if (a.sp === 'bomb' || b.sp === 'bomb') return !a.sp !== !b.sp && a.sp !== 'chest' && b.sp !== 'chest' && a.sp !== 'star' && b.sp !== 'star';
  if (a.sp === 'chest' || b.sp === 'chest') return a.sp === b.sp && a.lvl === b.lvl;
  if (a.sp === 'star' || b.sp === 'star') return !(a.sp && b.sp) && a.lvl === b.lvl;
  return a.fam === b.fam && a.lvl === b.lvl;
}

/**
 * Junta la pieza de `from` con la de `to`. La nueva queda en `to` y `from` queda vacía.
 * Dos piezas de nivel máximo explotan. La bomba se lleva todas las piezas de la familia con la que la juntaste.
 */
export function mergePair(grid: Grid, from: Cell, to: Cell): MergeEvent | null {
  if (from.col === to.col && from.row === to.row) return null;
  const a = grid[from.col]?.[from.row];
  const b = grid[to.col]?.[to.row];
  if (!canMerge(a, b) || !a || !b) return null;
  if (a.sp === 'bomb' || b.sp === 'bomb') {
    const fam = (a.sp === 'bomb' ? b : a).fam;
    let value = 0;
    let n = 0;
    let top = 1;
    grid[from.col][from.row] = null;
    for (const col of grid)
      for (let r = 0; r < col.length; r++) {
        const p = col[r];
        if (p && !p.sp && p.fam === fam) {
          value += Math.pow(2, p.lvl - 1);
          top = Math.max(top, p.lvl);
          n++;
          col[r] = null;
        }
      }
    return { fam, lvl: top, size: n, col: to.col, row: to.row, burst: false, kind: 'bomb', value: value / 2 };
  }
  if (a.sp === 'chest') {
    const lvl = a.lvl + 1;
    const opened = lvl >= CHEST_OPEN;
    grid[from.col][from.row] = null;
    grid[to.col][to.row] = opened ? null : { ...makePiece(a.fam, lvl), sp: 'chest' };
    return { fam: a.fam, lvl, size: 2, col: to.col, row: to.row, burst: false, kind: 'chest', opened };
  }
  const real = a.sp === 'star' ? b : a;
  const burst = a.lvl >= MAX_LEVEL;
  grid[from.col][from.row] = null;
  grid[to.col][to.row] = burst ? null : makePiece(real.fam, a.lvl + 1);
  return { fam: real.fam, lvl: burst ? MAX_LEVEL : a.lvl + 1, size: 2, col: to.col, row: to.row, burst, kind: a.sp === 'star' || b.sp === 'star' ? 'star' : undefined };
}

/** Aplica gravedad: las piezas caen a los huecos. */
export function settle(grid: Grid): void {
  const rows = rowsOf(grid);
  for (let c = 0; c < grid.length; c++) {
    const col = grid[c].filter((p): p is Piece => !!p);
    for (let r = 0; r < rows; r++) grid[c][r] = col[r] ?? null;
  }
}

/** Deja caer lo de arriba y rellena los huecos con piezas nuevas. Devuelve las piezas nuevas. */
export function refill(grid: Grid, make: () => Piece): Piece[] {
  settle(grid);
  const added: Piece[] = [];
  for (let c = 0; c < grid.length; c++)
    for (let r = 0; r < grid[c].length; r++)
      if (!grid[c][r]) {
        const p = make();
        grid[c][r] = p;
        added.push(p);
      }
  return added;
}

/** La pieza igual más cercana a una casilla, o undefined si no hay. */
export function nearestPair(grid: Grid, at: Cell): Cell | undefined {
  const p = grid[at.col]?.[at.row];
  if (!p) return undefined;
  let best: Cell | undefined;
  let bd = Infinity;
  for (let c = 0; c < grid.length; c++)
    for (let r = 0; r < grid[c].length; r++) {
      const q = grid[c][r];
      if (!canMerge(p, q)) continue;
      const d = Math.abs(c - at.col) + Math.abs(r - at.row);
      if (d < bd) {
        bd = d;
        best = { col: c, row: r };
      }
    }
  return best;
}

/** Descarta una pieza (la tiraste hacia arriba). */
export function discard(grid: Grid, at: Cell): boolean {
  if (!grid[at.col]?.[at.row]) return false;
  grid[at.col][at.row] = null;
  return true;
}

export function hasPair(grid: Grid): boolean {
  const all = grid.flat().filter((p): p is Piece => !!p);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (canMerge(all[i], all[j])) return true;
  return false;
}
