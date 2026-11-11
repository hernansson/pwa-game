// Tablero de piezas que caen: 5 columnas, las piezas iguales que se tocan se fusionan.

export const COLS = 5;
export const ROWS = 7;
export const MAX_LEVEL = 6;

export type Family = 'espada' | 'escudo' | 'pocion' | 'orbe' | 'moneda';
export const FAMILIES: Family[] = ['espada', 'escudo', 'pocion', 'orbe', 'moneda'];

export const FAMILY_INFO: Record<Family, { name: string; effect: string; color: string; weight: number }> = {
  espada: { name: 'Espadas', effect: 'Daño al enemigo', color: '#c9d3dd', weight: 34 },
  escudo: { name: 'Escudos', effect: 'Bloquean golpes', color: '#5c9bff', weight: 18 },
  pocion: { name: 'Pociones', effect: 'Curan al héroe', color: '#ff5a8a', weight: 18 },
  orbe: { name: 'Orbes', effect: 'Frenan al enemigo', color: '#b77bff', weight: 15 },
  moneda: { name: 'Monedas', effect: 'Oro extra', color: '#ffd25a', weight: 15 },
};

export interface Piece {
  fam: Family;
  lvl: number;
  id: number; // para animaciones
}

/** grid[col][row], row 0 = abajo. null = vacío. */
export type Grid = (Piece | null)[][];

let nextId = 1;
export function makePiece(fam: Family, lvl: number): Piece {
  return { fam, lvl, id: nextId++ };
}

export function randomPiece(levelTwoChance: number, rand = Math.random): Piece {
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
  // Nivel 1 casi siempre; el talento Calidad sube la chance de nivel 2.
  const lvl = rand() < levelTwoChance ? 2 : 1;
  return makePiece(fam, lvl);
}

export function emptyGrid(): Grid {
  return Array.from({ length: COLS }, () => Array(ROWS).fill(null));
}

export function height(grid: Grid, col: number): number {
  const c = grid[col];
  let h = 0;
  while (h < ROWS && c[h]) h++;
  return h;
}

export function isFull(grid: Grid, col: number): boolean {
  return height(grid, col) >= ROWS;
}

/** Llena las filas de abajo sin dejar fusiones listas, para arrancar con el tablero cargado. */
export function startingGrid(rows: number, levelTwoChance: number, rand = Math.random): Grid {
  const g = emptyGrid();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      for (let tries = 0; tries < 30; tries++) {
        const p = randomPiece(levelTwoChance, rand);
        const left = col > 0 ? g[col - 1][row] : null;
        const below = row > 0 ? g[col][row - 1] : null;
        const clash = (q: Piece | null) => q && q.fam === p.fam && q.lvl === p.lvl;
        if (!clash(left) && !clash(below)) {
          g[col][row] = p;
          break;
        }
      }
    }
  }
  return g;
}

/** Suelta una pieza en una columna. Devuelve la fila donde quedó o -1 si está llena. */
export function dropInto(grid: Grid, col: number, piece: Piece): number {
  const h = height(grid, col);
  if (h >= ROWS) return -1;
  grid[col][h] = piece;
  return h;
}

export interface MergeEvent {
  fam: Family;
  lvl: number; // nivel resultante
  size: number; // cuántas piezas se juntaron
  col: number;
  row: number;
  burst: boolean; // se juntaron piezas de nivel máximo: explotan
}

function key(c: number, r: number) {
  return c * 100 + r;
}

/**
 * Busca grupos de 2 o más piezas iguales conectadas y los fusiona.
 * La pieza resultante queda en la posición más baja del grupo (preferente la `prefer`).
 * No aplica gravedad: eso se hace con `settle` para poder animar por pasos.
 */
export function mergeStep(grid: Grid, prefer?: { col: number; row: number }): MergeEvent[] {
  const seen = new Set<number>();
  const events: MergeEvent[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const p = grid[c][r];
      if (!p || seen.has(key(c, r))) continue;
      const group: [number, number][] = [];
      const stack: [number, number][] = [[c, r]];
      seen.add(key(c, r));
      while (stack.length) {
        const [x, y] = stack.pop()!;
        group.push([x, y]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(key(nx, ny))) continue;
          const q = grid[nx][ny];
          if (q && q.fam === p.fam && q.lvl === p.lvl) {
            seen.add(key(nx, ny));
            stack.push([nx, ny]);
          }
        }
      }
      if (group.length < 2) continue;
      // Dónde queda la pieza nueva.
      let target = group[0];
      const pref = prefer && group.find(([x, y]) => x === prefer.col && y === prefer.row);
      if (pref) target = pref;
      else for (const g of group) if (g[1] < target[1] || (g[1] === target[1] && g[0] < target[0])) target = g;
      for (const [x, y] of group) grid[x][y] = null;
      const burst = p.lvl >= MAX_LEVEL;
      const lvl = Math.min(MAX_LEVEL, p.lvl + 1);
      // Grupos de 4 o más saltan un nivel extra.
      const finalLvl = burst ? MAX_LEVEL : Math.min(MAX_LEVEL, lvl + (group.length >= 4 ? 1 : 0));
      if (!burst) grid[target[0]][target[1]] = makePiece(p.fam, finalLvl);
      events.push({ fam: p.fam, lvl: finalLvl, size: group.length, col: target[0], row: target[1], burst });
    }
  }
  return events;
}

/** Aplica gravedad: las piezas caen a los huecos. Devuelve true si algo se movió. */
export function settle(grid: Grid): boolean {
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    const col = grid[c].filter((p): p is Piece => !!p);
    for (let r = 0; r < ROWS; r++) {
      const p = col[r] ?? null;
      if (grid[c][r] !== p) moved = true;
      grid[c][r] = p;
    }
  }
  return moved;
}

/** Busca dónde está una pieza (sirve para seguirla mientras cae). */
export function findPiece(grid: Grid, id: number): { col: number; row: number } | undefined {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (grid[c][r]?.id === id) return { col: c, row: r };
  return undefined;
}

export function boardFull(grid: Grid): boolean {
  for (let c = 0; c < COLS; c++) if (!isFull(grid, c)) return false;
  return true;
}

export function totalPieces(grid: Grid): number {
  return grid.reduce((a, c) => a + c.filter(Boolean).length, 0);
}
