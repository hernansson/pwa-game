// Qué monstruo hay en cada pelea y qué truco tiene. Lo usan la pelea (y el servidor al rejugarla)
// y el dibujo de los monstruos, así lo que ves es lo que pelea.

export type Species = 'slime' | 'mushroom' | 'wolf' | 'bat' | 'spider' | 'skeleton' | 'golem' | 'scorpion' | 'imp' | 'yeti';
export type BossSpecies = 'treant' | 'queen' | 'titan' | 'sphinx' | 'icedragon' | 'firedragon';
export type Foe = Species | BossSpecies;

/** Especies de las oleadas y jefe de cada mundo (se repiten después del sexto). */
export const WORLD_FOES: { mobs: Species[]; boss: BossSpecies }[] = [
  { mobs: ['slime', 'mushroom', 'wolf'], boss: 'treant' },
  { mobs: ['bat', 'spider', 'skeleton'], boss: 'queen' },
  { mobs: ['golem', 'wolf', 'bat'], boss: 'titan' },
  { mobs: ['scorpion', 'skeleton', 'slime'], boss: 'sphinx' },
  { mobs: ['yeti', 'wolf', 'slime'], boss: 'icedragon' },
  { mobs: ['imp', 'golem', 'scorpion'], boss: 'firedragon' },
];

export function worldOfLevel(level: number): number {
  return Math.ceil(level / 10);
}

/** Índice de la especie (0..2) de un enemigo; el jefe del nivel es una versión élite de una de ellas. */
export function foeIndex(level: number, wave: number, enemy: number, boss: boolean): number {
  const world = worldOfLevel(level);
  return boss ? (level + world) % 3 : (wave * 2 + enemy + level) % 3;
}

export function foeOf(level: number, wave: number, enemy: number, boss: boolean): Foe {
  const f = WORLD_FOES[(worldOfLevel(level) - 1) % WORLD_FOES.length];
  if (boss && level % 10 === 0) return f.boss;
  return f.mobs[foeIndex(level, wave, enemy, boss)];
}

/**
 * Trucos:
 * regen: se cura en cada golpe · spores/poison: veneno que atraviesa el escudo · fast: pega más seguido ·
 * dodge: esquiva tu primer golpe después de cada ataque suyo · web/freeze: traba piezas unos segundos ·
 * revive: se rearma una vez · armor: los golpes chicos (nivel 1-2) casi no le hacen nada ·
 * burn: prende fuego una pieza; si no la usas a tiempo, se quema y te hace daño.
 */
export type Trick = 'regen' | 'spores' | 'poison' | 'fast' | 'dodge' | 'web' | 'freeze' | 'revive' | 'armor' | 'burn';

export const FOE_TRICK: Record<Foe, Trick> = {
  slime: 'regen', mushroom: 'spores', wolf: 'fast', bat: 'dodge', spider: 'web', skeleton: 'revive',
  golem: 'armor', scorpion: 'poison', imp: 'burn', yeti: 'freeze',
  treant: 'regen', queen: 'web', titan: 'armor', sphinx: 'dodge', icedragon: 'freeze', firedragon: 'burn',
};

/** Cartel corto que aparece cuando el truco se activa, y explicación para la ficha del nivel. */
export const TRICK_INFO: Record<Trick, { icon: string; name: string; text: string }> = {
  regen: { icon: '💚', name: 'Regenera', text: 'Se cura un poco en cada ataque' },
  spores: { icon: '🍄', name: 'Esporas', text: 'Sus esporas envenenan: el veneno atraviesa el escudo' },
  poison: { icon: '☠️', name: 'Veneno', text: 'Su aguijón envenena fuerte: el veneno atraviesa el escudo' },
  fast: { icon: '💨', name: 'Veloz', text: 'Ataca más seguido' },
  dodge: { icon: '🌀', name: 'Esquiva', text: 'Esquiva tu primer golpe después de cada ataque suyo' },
  web: { icon: '🕸️', name: 'Telaraña', text: 'Atrapa piezas en telarañas unos segundos' },
  freeze: { icon: '❄️', name: 'Congela', text: 'Congela piezas unos segundos' },
  revive: { icon: '💀', name: 'Se rearma', text: 'Cuando lo vences se vuelve a levantar una vez' },
  armor: { icon: '🪨', name: 'Coraza', text: 'Los golpes de nivel 1 y 2 casi no le hacen daño: sube las piezas' },
  burn: { icon: '🔥', name: 'Quema', text: 'Prende fuego piezas: úsalas rápido o se queman y te dañan' },
};
