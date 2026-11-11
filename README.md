# Héroes de la Forja (prototipo)

Juego web instalable como PWA: tu héroe pelea solo, fusionas armas en un tablero
y compites cada semana en una liga.

## Desarrollo

```bash
npm install
npm run dev          # servidor local
npm run build        # dist/ lista para publicar (PWA)
npm run build:single # dist-single/index.html en un solo archivo (vista previa)
```

## Estructura

- `src/balance.ts`: todas las fórmulas de equilibrio (daño, vida, oro, costos).
- `src/game.ts`: lógica del combate, fusión, mejoras y prestigio.
- `src/state.ts`: estado, guardado local y ganancias mientras no juegas.
- `src/league.ts`: liga semanal (rivales simulados hasta tener servidor).
- `src/art.ts`: arte SVG de héroes, skins, armas y enemigos.
- `src/main.ts`: interfaz.

## Pendiente

- Servidor (Cloudflare Workers + D1) para liga real, validación de puntajes y métricas.
- Publicación en Cloudflare Pages.
- Pagos y anuncios, después de validar que el juego engancha.
