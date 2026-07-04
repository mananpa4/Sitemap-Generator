# CLAUDE_CONTEXT.md

Memoria viva del proyecto. **Actualizar esta ficha cada vez que se termine
trabajo importante o se tome una decision tecnica relevante.** La
informacion permanente (arquitectura, comandos, convenciones) vive en
[CLAUDE.md](CLAUDE.md), no aqui.

Ultima actualizacion: 2026-07-04.

## Estado actual

Primera version funcional y completa del generador. El nucleo (crawler,
sitemap builder, config, CLI, API programatica) esta implementado, probado
(23 tests, todos en verde) y verificado manualmente contra un sitio real
(`https://example.com`, con `--max-depth`/`--max-urls` acotados). No hay
release publicado ni empaquetado npm — se usa directo desde el repo.

## Funcionalidades implementadas

- **Crawler HTTP propio** (`src/crawler.js`): BFS con pool de concurrencia,
  mismo-origen, respeta `robots.txt` (Allow/Disallow/Crawl-delay, wildcards
  `*`/`$`, precedencia por regla mas larga), respeta
  `<meta name="robots">` (noindex/nofollow), sigue `<link rel="canonical">`,
  ignora paginas AMP, filtra por extension (lista negra configurable) y por
  `excludePatterns` (regex). Devuelve `{ entries, stats }` donde `stats`
  trae `visited`, `excludedByRobots`, `excludedByNoindex` y `brokenLinks`
  (URLs con status no-2xx).
- **Parser HTML sin dependencias** (`src/htmlParser.js`): tokeniza atributos
  de `<a>`, `<meta>`, `<link>`, `<base>` sin importar el orden de atributos.
- **Parser de robots.txt** (`src/robots.js`): agrupacion correcta de
  bloques `User-agent` consecutivos, `Allow`/`Disallow` con wildcards y
  ancla `$`, eleccion de grupo mas especifico vs. `*`.
- **Sitemap builder** (`src/sitemapBuilder.js`): XML con namespaces
  condicionales (image/video/news/xhtml segun lo que traigan las entries),
  `buildSitemapIndexXml`, `buildTxtSitemap` (formato plano), `splitEntries`
  (respeta 50.000 URLs y ~50MB por archivo), `gzip` via `node:zlib`.
- **Fuentes alternativas** (`src/sources.js`): `fromStaticDir` (escaneo
  recursivo de `.html`/`.htm` locales, usa `mtime` como `lastmod`) y
  `fromUrlsFile` (`.txt` uno por linea o `.json` array de strings/objetos).
  Se fusionan con el crawl por `loc` (dedupe, ultima fuente gana).
- **robots.txt writer** (`src/robotsTxtWriter.js`): `ensureSitemapReference`
  no destructivo — crea un robots.txt minimo si no existe, o agrega la
  linea `Sitemap:` solo si no esta ya presente.
- **Notificacion a buscadores** (`src/ping.js`): `pingSearchEngines`
  (default solo `bing`; incluye advertencia si se fuerza `google`, ya
  deprecado) y `submitIndexNow` (protocolo IndexNow via POST JSON).
- **Config** (`src/config.js`): `DEFAULT_CONFIG` + `deepMerge` (config file
  `.js`/`.json` + overrides de CLI/programaticos), `defineConfig()` helper
  identidad para autocompletado en editores.
- **CLI** (`src/cli.js`): usa `node:util.parseArgs` (sin dependencias).
  Flags: `--config`, `--site`, `--out`, `--static-dir`, `--urls-file`,
  `--max-depth`, `--max-urls`, `--concurrency`, `--gzip`, `--txt-sitemap`,
  `--no-report`, `--update-robots-txt`, `--robots-txt-file`, `--ping`,
  `--no-crawl`, `--dry-run`, `--verbose`/`-v`, `--version`, `--help`/`-h`.
- **Reporte de diagnostico** (`*-report.json`, activado por default,
  `config.report`): cuenta de URLs, archivos escritos, y si hubo crawl,
  `visited`/`excludedByRobots`/`excludedByNoindex`/`brokenLinks` con detalle.
- **Ejemplos de programacion periodica**: `examples/cron/crontab.example`
  (Linux/macOS), `examples/cron/windows-task-scheduler.md` (`schtasks` +
  GUI), `examples/cron/github-actions.yml` (workflow con `schedule:` +
  `workflow_dispatch`).
- **Tests** (`test/*.test.js`, `node:test` nativo): unitarios para robots.js,
  htmlParser.js, sitemapBuilder.js, helpers de crawler.js; un test de
  integracion (`integration.test.js`) que levanta un servidor `node:http`
  real y valida crawl -> sitemap.xml completo (incluye caso noindex, robots
  disallow, y exclusion de dominio externo); un test de reporte
  (`report.test.js`) que valida `brokenLinks` y `sitemap.txt`.

## Funcionalidades en progreso

Ninguna a medio terminar en este momento — el alcance planteado para la v1
esta cerrado.

## Tareas pendientes / mejoras recomendadas (no bloqueantes)

- **CI para este repo**: no hay workflow de GitHub Actions que corra
  `npm test` en cada push/PR (si el repo se sube a GitHub, vale la pena
  añadirlo — no confundir con `examples/cron/github-actions.yml`, que es un
  ejemplo para el repo del *sitio*, no para este generador).
- **Flags CLI para reglas avanzadas**: `priorityMap` y `perUrlRules` solo
  son configurables via config file (`.js`/`.json`), no hay equivalente por
  linea de comandos. Es una limitacion aceptada, no un bug: estas
  estructuras (arrays de objetos/regex) no se prestan bien a flags planos.
- **Extraccion automatica de imagenes para el sitemap de imagenes**: el
  crawler no puebla `entry.images` a partir de los `<img>` de la pagina;
  hoy esa extension solo se puede usar pasando entries manualmente via
  `additionalUrls`. Si se pide soporte de Google Images sitemap real, hay
  que extender `htmlParser.js` (extraer `<img>`) y `crawler.js`.
- **Prueba a escala**: el split en 50.000 URLs / 50MB esta cubierto por
  tests unitarios de `splitEntries`, pero no se probo un crawl real que
  genere multiples archivos (requeriria un sitio de decenas de miles de
  paginas). Si aparece un caso real grande, validar ahi.
- **Regeneracion incremental**: cada corrida recalcula todo desde cero; no
  hay merge con un sitemap.xml previo para preservar `lastmod` historico de
  paginas no recrawleadas en esa corrida. No se penso necesario para el
  caso de uso (crawl completo periodico), pero si se pide "incremental",
  es un cambio de diseño a discutir antes de implementar.
- **Empaquetado**: no se publico a npm ni se genero un instalador; el
  `package.json` tiene `"private": true` a proposito. Si se quiere
  distribuir, decidir primero si sigue siendo de uso interno o publico.

## Decisiones tecnicas tomadas

- **Cero dependencias de produccion.** Motivo: varios de los repos de
  referencia en `repos/` presumen "zero dependencies" como caracteristica
  (`Sitemap-Generator-Crawler-master`, `super-sitemap-main`) y Node 18+ ya
  trae `fetch` global y `node:util.parseArgs`, suficientes para todo el
  alcance. Reduce superficie de mantenimiento y riesgo de supply-chain.
  Como aplicar: antes de añadir un paquete npm, confirmar que realmente no
  se puede resolver con la stdlib.
- **Sin scheduler interno.** Motivo: el usuario pidio explicitamente que se
  sugiera cron o ejecucion manual, no un daemon. Un proceso Node de larga
  duracion (setInterval/node-cron) añade una fuente de fallos (memory
  leaks, crashes silenciosos) que cron/Task Scheduler/CI ya resuelven de
  forma robusta. Como aplicar: cualquier pedido de "que corra solo cada
  X tiempo" se resuelve documentando/programando cron o CI, no agregando un
  loop interno.
- **`sitemap.xml` se convierte en el indice cuando hay >1 archivo.** Sigue
  la convencion mas comun vista en los repos de referencia (go-sitemap,
  gemas Ruby, next-sitemap): el nombre "principal" configurado por el
  usuario pasa a ser el `sitemapindex`, y las partes se nombran
  `${base}-1.xml`, `${base}-2.xml`, etc. Alternativa descartada: mantener
  `sitemap.xml` como la primera parte y nombrar el indice aparte — se
  descarto por ser menos intuitivo para quien solo referencia "sitemap.xml"
  en robots.txt/Search Console.
- **`lastmod` normalizado a ISO 8601 (`toIsoDate` en crawler.js).** El
  header HTTP `Last-Modified` viene en formato RFC 1123
  (`Wed, 01 Jul 2026 17:52:37 GMT`), invalido para el protocolo de
  sitemaps (que exige W3C Datetime). Se detecto en pruebas manuales contra
  `https://example.com` y se corrigio antes de cerrar la v1.
- **robots.txt: agrupacion de `User-agent`.** El parser inicial tenia un
  bug (grupos con multiples `User-agent` consecutivos no se resolvian bien
  frente a un grupo `*` posterior). Se reescribio con una regla simple y
  correcta: un `User-agent` extiende el grupo actual salvo que ya se haya
  visto una regla (`Allow`/`Disallow`/`Crawl-delay`) desde que ese grupo
  empezo, en cuyo caso abre un grupo nuevo. Cubierto por
  `test/robots.test.js`.
- **Ping a Google deshabilitado por default.** Google retiro su endpoint de
  ping de sitemaps en junio de 2023; se deja la opcion (`engines:
  ['google']`) mas por completitud/documentacion que porque vaya a
  funcionar, con warning explicito en el log.
- **`repos/` se mantiene como material de solo lectura**, no como parte del
  proyecto ni del build. Sirvio para decidir que tomar de cada uno (ver
  tabla en el README, seccion "Repos de referencia").

## Problemas conocidos

- **`node --test test/` (sin glob) falla en este entorno Windows** con
  `MODULE_NOT_FOUND` (intenta resolver `test` como modulo en vez de
  directorio). Workaround aplicado: usar siempre
  `node --test "test/*.test.js"` (asi esta en `package.json` -> `npm test`
  y en `CLAUDE.md`). No investigado a fondo si es un bug de esta version de
  Node en Windows o un tema de como bash expande la ruta; no bloqueante
  porque el workaround funciona de forma estable.
- Ninguno abierto sin workaround a la fecha de esta nota.

## Como probar manualmente

```bash
# Suite completa
npm test

# Smoke test contra un sitio real, acotado para no crawlear de mas
node bin/sitemap-generator.js --site https://example.com \
  --out ./tmp-test/sitemap.xml --max-depth 2 --max-urls 20 --verbose
# revisar tmp-test/sitemap.xml y tmp-test/sitemap-report.json, luego borrar tmp-test/
```

## Proximos pasos recomendados

1. Si este repo se va a subir/mantener en GitHub: añadir un workflow de CI
   propio (`.github/workflows/test.yml`) que corra `npm test` en cada push.
2. Si aparece un caso de uso real con sitio grande (>50k URLs o multiples
   dominios/subdominios), validar el split de sitemaps y considerar
   soporte multi-sitio en un solo config (array de "sites", como hacia el
   CLI de `Sitemap-Generator-Crawler-master` para hosting compartido).
3. Si se pide indexacion de imagenes reales del sitio (no solo manual),
   extender `htmlParser.js` para extraer `<img>` y poblar `entry.images`
   automaticamente durante el crawl.
4. Antes de cualquier cambio de arquitectura (scheduler interno, agregar
   una dependencia, cambiar el formato de salida por defecto), releer la
   seccion "Decisiones tecnicas tomadas" de este archivo — varias de esas
   decisiones fueron pedidos explicitos del usuario, no defaults
   arbitrarios.
