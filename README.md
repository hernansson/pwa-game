# Héroes de la Forja (prototipo)

Juego web instalable como PWA: recorres niveles cortos que terminan en un jefe,
tu héroe pelea solo, fusionas las armas que sueltan los enemigos y compites cada
semana en una liga. Cada nivel cuesta energía, que se recarga con el tiempo.

## Desarrollo

```bash
npm install
npm run dev          # servidor local
npm run build        # dist/ lista para publicar (PWA)
npm run build:single # dist-single/index.html en un solo archivo (vista previa)
```

## Estructura

- `src/balance.ts`: todas las fórmulas de equilibrio (daño, vida, oro, costos).
- `src/game.ts`: lógica de niveles, combate, fusión, forja y mejoras.
- `src/state.ts`: estado, guardado local y energía.
- `src/league.ts`: liga semanal (rivales simulados hasta tener servidor).
- `src/art.ts`: arte SVG de héroes, skins, armas y enemigos.
- `src/main.ts`: interfaz.

## Pendiente

- Servidor (Cloudflare Workers + D1) para liga real, jefe mundial, raids con amigos, validación de puntajes y métricas.
- Publicación en Cloudflare Pages.
- Pagos y anuncios, después de validar que el juego engancha.
