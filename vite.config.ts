import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Cada build tiene un número: el juego abierto lo compara con version.json para avisar que hay una versión nueva.
const BUILD = String(Date.now());

// `npm run build` -> dist/ (PWA, para hosting).
// `npm run build:single` -> dist-single/index.html (un solo archivo, para compartir una vista previa).
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: mode === 'single'
    ? [viteSingleFile()]
    : [{ name: 'version-json', apply: 'build', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }); } }],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    copyPublicDir: mode !== 'single',
  },
}));
