# Guía de balance

Referencias para que el juego progrese bien y para no caer en *power creep* (que algo nuevo deje inútil todo lo anterior).
Cada vez que se agregue una variante, una habilidad o un efecto nuevo, hay que medirlo con las herramientas de abajo antes de publicarlo.

## 1. El puntaje de poder

- **Poder = ataque × defensa.** Pegar más fuerte y aguantar más tiempo se multiplican. Por eso los efectos del mismo tipo rinden cada vez menos (+10% de daño vale mucho si no tienes nada, poco si ya tienes +200%), y mezclar ataque con defensa rinde más que apilar una sola cosa.
- El código está en `src/power.ts`. `armScore(variante, nivel)` da el poder de una variante sola; `swapGain` da cuánto mejora el poder cambiar una variante por otra con el resto del equipo puesto.
- Los pesos se miden con un jugador simulado que juega miles de niveles (a veces rápido, a veces lento) y anota hasta qué nivel llega. Así se puede valorar cualquier efecto, aunque no sea daño.

### Cuánto vale cada efecto (medido sin equipo, en "% de daño equivalente")

| Efecto | Vale |
|---|---|
| +10% de daño | 10% (la vara) |
| +10% de vida | ~14% |
| -5% de daño recibido | ~8% |
| +0,5 s para mantener el combo | ~16% (muy fuerte) |
| +5% de crítico | ~5% |
| Empezar con escudo (10% de la vida) | ~5% |
| +10% de escudo | ~3% |
| +0,5 s de potenciador | ~2% |
| +10% de curación | ~2% |
| +10% de potencia del rayo | ~1% |
| Críticos x2,5 | ~1% con poco crítico (sube si hay mucho crítico) |
| 20% más espadas en el tablero | **-7%**: salen menos pociones y escudos y te mueres antes |

Con el equipo puesto los valores cambian (lo que ya tienes mucho vale menos), por eso el balance final se comprueba siempre en el juego simulado con `tools/verify.ts`.

## 2. Reglas

1. **Las familias rinden parecido por nivel.** Subir 10 niveles una espada, un escudo, un rayo o una skin tiene que dar más o menos lo mismo con el equipo completo (diferencia máxima ~30%). Escudo y rayo llevan un segundo stat (vida y daño) porque solos valen muy poco.
2. **La rareza cambia desde dónde arranca, no cuánto sube.** Todas suben lo mismo por nivel. Rara arranca como una básica nivel 8, épica como nivel 16, legendaria como nivel 26 (`RARITY_LEVEL_BONUS`). Una básica muy subida le gana a una épica recién sacada.
3. **Las habilidades de cada rareza valen un poco más, pero sobre todo cambian el estilo.** Con el equipo puesto, una rara vale ~1 "subida de 10 niveles" más que la básica del mismo nivel y una épica ~2. Nada debería superar ~3.
4. **Lo que es probabilidad, tiempo o reducción tiene tope** (`CAPS` en `src/balance.ts`): crítico 50%, críticos x3, daño recibido -60%, combo +1,5 s, potenciador +2 s, escudo inicial 40%. Daño, vida, escudo y potencia no tienen tope porque los enemigos crecen sin parar.
5. **El combo extra es de lo más fuerte que hay.** Darlo en cantidades chicas (0,2–0,5 s) y como máximo en una o dos variantes por familia.
6. **El crítico sube lento.** Si en el futuro pasa de lo previsto, se pueden agregar jefes con debuff de crítico.

## 3. Ritmo de progreso

Hasta el nivel 30 los enemigos crecen rápido (el enganche); después, más despacio (`LATE` en `src/balance.ts`). La vida de los enemigos tardíos tiene que crecer **más de 1,2 por nivel** (lo que crece el daño del héroe por nivel jugado); con 1,20 o menos el jugador se escapa.

Última simulación (`sim6`, jugador que abre todos los cofres que puede):

| Partidas por día | Día 1 | Día 7 | Día 30 | Día 60 |
|---|---|---|---|---|
| 20 | 18 | 31 | 49 | 62 |
| 50 | 26 | 39 | 62 | 69 |

## 4. Herramientas

```bash
# Tabla de poder de todas las variantes (rápida, usa los pesos)
npx esbuild tools/report.ts --bundle --platform=node --outfile=/tmp/report.cjs && node /tmp/report.cjs
# Cuánto vale cada efecto, medido jugando (1 min aprox.)
npx esbuild tools/valuate.ts --bundle --platform=node --outfile=/tmp/valuate.cjs && LOADOUT=0 node /tmp/valuate.cjs 800
# Comprobar familias y variantes con el equipo completo, jugando (1 min aprox.)
npx esbuild tools/verify.ts --bundle --platform=node --outfile=/tmp/verify.cjs && LOADOUT=20 node /tmp/verify.cjs 1000
```

## 5. Ideas pendientes

- Habilidades de escudo nuevas: devolver daño al atacante, robo de vida.
- Bonus por set: misma línea de espada, escudo y skin da robo de vida u otros extras.
- Efectos de tablero (más espadas, más pociones): medirlos siempre con `valuate`, porque pueden restar en vez de sumar.
- Jefes con debuff de crítico.
