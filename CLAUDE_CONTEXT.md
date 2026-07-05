# CLAUDE_CONTEXT.md

Memoria viva del proyecto. **Actualizar esta ficha cada vez que se termine
trabajo importante o se tome una decision tecnica relevante.** La
informacion permanente (arquitectura, comandos, convenciones) vive en
[CLAUDE.md](CLAUDE.md), no aqui.

Ultima actualizacion: 2026-07-05.

## Estado actual

Version funcional y completa del generador, con analisis SEO on-page nativo
añadido en esta sesion. El nucleo (crawler, sitemap builder, config, CLI,
API programatica, SEO) esta implementado, probado (38 tests, todos en verde)
y verificado manualmente contra un sitio real (`https://example.com`, con
`--max-depth`/`--max-urls` acotados, incluyendo `--seo`). No hay release
publicado ni empaquetado npm — se usa directo desde el repo.

Ademas, en `repos/repos-SEO/Laravel-YoastSeo-master` (un proyecto de
referencia, no parte del build) se actualizo la integracion de `yoastseo`
de `1.57.0` a `3.6.0` a pedido explicito del usuario — ver la seccion de
decisiones tecnicas mas abajo para el detalle de la migracion de API.

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
  de `<a>`, `<meta>`, `<link>`, `<base>`, `<img>` sin importar el orden de
  atributos; tambien extrae `metaDescription`, `headings` (`h1`-`h6`) e
  `images` (`{src, alt}`), y expone `stripHtmlToText()` para obtener el
  texto visible de una pagina (usado por el analisis SEO).
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
  `--no-crawl`, `--seo`, `--focus-keyword`, `--dry-run`, `--verbose`/`-v`,
  `--version`, `--help`/`-h`.
- **Reporte de diagnostico** (`*-report.json`, activado por default,
  `config.report`): cuenta de URLs, archivos escritos, y si hubo crawl,
  `visited`/`excludedByRobots`/`excludedByNoindex`/`brokenLinks` con detalle.
- **Analisis SEO on-page nativo** (`src/seoAnalysis.js`, opt-in via
  `config.seo.enabled` / `--seo`, escribe `*-seo-report.json`): por cada URL
  HTML crawleada corre checks de `titleLength`, `descriptionLength`,
  `singleH1`, `imageAlt` (% de `<img>` con `alt`), `wordCount`, `readability`
  (Flesch reading ease con un contador de silabas heuristico propio,
  `countSyllables`/`fleschReadingEase`), `internalLinks`/`externalLinks`, y
  si se define `focusKeyword`/`--focus-keyword`: `keywordInTitle`,
  `keywordInDescription`, `keywordDensity`. Cada check tiene rating
  `good`/`ok`/`bad` + mensaje; `analyzePage()` calcula un `score` 0-100
  propio de esta herramienta (promedio ponderado de ratings, **no** es la
  escala/algoritmo de Yoast). `analyzeSite()` ademas agrupa
  `duplicateTitles`/`duplicateDescriptions` entre paginas. El crawler
  (`crawler.js`) recolecta los datos crudos por pagina (`seoPages`) solo
  cuando `collectSeoData` esta activo, sin afectar las entries del sitemap.
  Decision de diseño: **implementacion nativa, sin depender del paquete
  `yoastseo`** — ver seccion de decisiones tecnicas.
- **Ejemplos de programacion periodica**: `examples/cron/crontab.example`
  (Linux/macOS), `examples/cron/windows-task-scheduler.md` (`schtasks` +
  GUI), `examples/cron/github-actions.yml` (workflow con `schedule:` +
  `workflow_dispatch`).
- **Tests** (`test/*.test.js`, `node:test` nativo, 38 tests): unitarios para
  robots.js, htmlParser.js (incluye headings/images/meta description/
  stripHtmlToText), sitemapBuilder.js, helpers de crawler.js, seoAnalysis.js
  (`seoAnalysis.test.js`); un test de integracion (`integration.test.js`)
  que levanta un servidor `node:http` real y valida crawl -> sitemap.xml
  completo (incluye caso noindex, robots disallow, y exclusion de dominio
  externo); un test de reporte (`report.test.js`) que valida `brokenLinks` y
  `sitemap.txt`; un test de integracion SEO (`seoIntegration.test.js`) que
  valida el flujo completo crawl -> `*-seo-report.json` (checks buenos vs.
  malos segun contenido real de la pagina, y que el reporte no se escribe
  si `seo.enabled` es false).

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
- **Extraccion automatica de imagenes para el sitemap de imagenes** (distinto
  del analisis SEO): `htmlParser.js` ya extrae `<img>` (`{src, alt}`), pero
  solo se usa para el check `imageAlt` de `seoAnalysis.js` — el crawler
  todavia no puebla `entry.images` en las entries del *sitemap* (la
  extension `<image:image>` de `sitemapBuilder.js` solo se activa pasando
  entries manualmente via `additionalUrls`). Si se pide soporte de Google
  Images sitemap real desde el crawl, conectar `parsedHtml.images` (ya
  disponible) a `results.set(loc, {..., images})` en `crawler.js`.
- **Checks SEO adicionales no implementados**: no hay check de densidad de
  keyword por sinonimos/variantes, ni de "cornerstone content", ni
  inclusive-language (existe en yoastseo 3.x pero requiere listas de
  palabras por categoria que no vienen listas para usar en el paquete —
  ver notas de la migracion de Laravel-YoastSeo-master). Se opto por no
  implementarlos para mantener el scope acotado; agregar bajo pedido.
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
  tabla en el README, seccion "Repos de referencia"). Excepcion puntual:
  el usuario pidio explicitamente actualizar
  `repos/repos-SEO/Laravel-YoastSeo-master` (ver mas abajo) — la regla
  general sigue siendo no tocar `repos/` salvo pedido explicito.
- **Analisis SEO nativo, sin depender de `yoastseo`.** Se le pregunto
  explicitamente al usuario (via AskUserQuestion) entre tres opciones:
  nativo sin dependencias, integrar `yoastseo` real, o ambos. Eligio
  "nativo". Motivo adicional (no solo la eleccion del usuario): `yoastseo`
  es GPL-3.0, pesada, orientada a WordPress, y requiere una clase
  `Researcher` distinta por idioma — integrarla rompe la politica de cero
  dependencias documentada en CLAUDE.md sin necesidad, cuando los checks
  mas utiles (longitud de title/description, un solo H1, alt text,
  legibilidad basica, densidad de keyword) son reproducibles con JS plano.
  Como aplicar: si en el futuro se pide analisis mas fino (voz pasiva,
  palabras de transicion, reglas linguisticas por idioma), evaluar
  entonces si vale la pena reabrir la discusion de agregar `yoastseo` como
  dependencia opcional — no asumir que "nativo" sigue siendo suficiente
  sin volver a preguntar si el pedido es sustancialmente mas complejo.
- **`yoastseo` en `Laravel-YoastSeo-master` actualizado de `1.57.0` a
  `3.6.0`.** Se instalo el paquete real en un directorio scratch para
  verificar la API actual antes de escribir codigo (no se confio en
  resumenes de busqueda web). Cambios de API entre esas versiones,
  documentados tambien en el README de ese proyecto:
  - `helpers.scoreToRating` -> `interpreters.scoreToRating`.
  - `r.score` (propiedad) -> `r.getScore()` (metodo).
  - `SEOAssessor` (deep import `yoastseo/src/seoAssessor`) ->
    `SeoAssessor` (export directo del paquete, ya no hace falta deep
    import).
  - Ya no se necesita un objeto `Jed` de i18n en el constructor de los
    assessors.
  - Ya no existe una clase `Researcher` generica: hay una por idioma en
    `yoastseo/build/languageProcessing/languages/<lang>/Researcher`
    (ej. `en`, `es`, `fr`, ... 22 idiomas + `_default` de fallback).
    `VueYoastComponent.vue` ahora mapea el locale elegido en el formulario
    a la clase correcta — el codigo original con `1.57.0` siempre corria
    en modo generico sin importar el locale, lo cual era en si mismo un
    bug/limitacion que quedo corregido de paso.
  - `url` en las opciones de `Paper` esta deprecado a favor de `slug`.
  - Se removieron `babel-polyfill`/`babel-plugin-transform-regenerator`
    de `package.json` (no usados por nada mas en el proyecto tras quitar
    el import de `babel-polyfill`, y npm ya marca `babel-polyfill` como
    deprecado).

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
3. Si se pide indexacion de imagenes reales del sitio (no solo manual) en el
   sitemap (no en el analisis SEO, que ya extrae `<img>`), conectar
   `parsedHtml.images` a las entries del sitemap en `crawler.js`.
4. Antes de cualquier cambio de arquitectura (scheduler interno, agregar
   una dependencia, cambiar el formato de salida por defecto), releer la
   seccion "Decisiones tecnicas tomadas" de este archivo — varias de esas
   decisiones fueron pedidos explicitos del usuario, no defaults
   arbitrarios.
5. Si se pide profundizar el analisis SEO (mas idiomas, voz pasiva,
   inclusive language, etc.), releer la decision "Analisis SEO nativo, sin
   depender de `yoastseo`" antes de elegir entre extender `seoAnalysis.js`
   a mano o reabrir la conversacion sobre integrar `yoastseo` como
   dependencia opcional.
