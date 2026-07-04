# CLAUDE.md

Guia permanente del proyecto para Claude Code. Contiene solo informacion
estable (arquitectura, convenciones, comandos). El estado de desarrollo
(que esta hecho, que falta, decisiones recientes) vive en
**[CLAUDE_CONTEXT.md](CLAUDE_CONTEXT.md)**.

> **Regla obligatoria**: antes de hacer cualquier cambio importante
> (nueva funcionalidad, refactor, cambio de arquitectura, o retomar el
> trabajo en una sesion nueva), **lee primero `CLAUDE_CONTEXT.md` completo**.
> Contiene el estado real del desarrollo y decisiones tecnicas que no estan
> repetidas aqui.

## Que es este proyecto

Generador y auto-generador de `sitemap.xml` para sitios web. Es una
herramienta de linea de comandos (y libreria) en Node.js, **sin
dependencias de produccion**, que:

1. Escanea un sitio (crawler HTTP propio) o toma URLs de fuentes locales
   (directorio estatico, lista manual).
2. Construye uno o varios archivos `sitemap.xml` (con `sitemap-index.xml`
   automatico si se superan los limites del protocolo: 50.000 URLs / 50MB).
3. Opcionalmente actualiza `robots.txt`, notifica a buscadores (ping/IndexNow)
   y escribe un reporte de diagnostico (`*-report.json`).

Esta pensado para ejecutarse **una vez por invocacion** y salir — la
programacion periodica se delega al sistema operativo (cron, Task
Scheduler) o a CI (GitHub Actions), no hay un scheduler interno. Ver
`examples/cron/` para los tres casos documentados.

El directorio `repos/` contiene 10 proyectos de referencia (PHP, Node, Go,
Ruby, frameworks, una GUI Electron) que se revisaron para diseñar esta
herramienta. **No forman parte del build, no se ejecutan, no se modifican.**
Son solo material de consulta.

## Tecnologias

- **Runtime**: Node.js >= 18.3 (usa `fetch` y `node:util.parseArgs`
  nativos; probado en Node 24). CommonJS (`require`/`module.exports`), no
  ESM, no TypeScript.
- **Dependencias de produccion**: ninguna (deliberado — ver
  CLAUDE_CONTEXT.md, seccion de decisiones tecnicas).
- **Tests**: `node:test` + `node:assert/strict`, nativos de Node. Sin
  Jest/Mocha/Vitest.
- **Plataforma de desarrollo**: Windows (rutas de ejemplo en `E:\...`), pero
  el codigo es multiplataforma (usa `path`/`node:path`, no asume `/`).

## Arquitectura y estructura de carpetas

```
bin/sitemap-generator.js   Entry point ejecutable (shebang), delega a src/cli.js
src/
  cli.js                   Parseo de argumentos (node:util.parseArgs) + salida de consola
  index.js                 generateSitemap() — orquestador y API publica
  config.js                DEFAULT_CONFIG, loadConfig() (merge file+overrides), defineConfig()
  crawler.js                crawlSite(): BFS con pool de concurrencia; devuelve {entries, stats}
  http.js                   fetchUrl(): wrapper de fetch con timeout/retries/AbortController
  robots.js                 RobotsTxt: parser/evaluador (Allow/Disallow/Crawl-delay, wildcards)
  htmlParser.js              parseHtml(): extraccion de <a>/<meta>/<link canonical>/<base>/<title>
  sources.js                fromStaticDir(), fromUrlsFile(): fuentes de URLs no-HTTP
  sitemapBuilder.js          buildUrlsetXml/buildSitemapIndexXml/buildTxtSitemap/splitEntries/gzip
  robotsTxtWriter.js         ensureSitemapReference(): edicion no destructiva de robots.txt
  ping.js                    pingSearchEngines(), submitIndexNow()
  logger.js                  Logger por niveles (silent/error/warn/info/verbose)
examples/                  Config de ejemplo, urls.example.txt, ejemplos de cron/Task Scheduler/GH Actions
test/                       Tests node:test (unitarios + un test de integracion con servidor HTTP real)
repos/                      Material de referencia (solo lectura, no tocar)
```

Flujo de datos (`generateSitemap` en `src/index.js`):

1. `loadConfig()` fusiona defaults + config file + overrides de CLI.
2. Se recolectan entries de cada fuente habilitada (`crawl`, `staticDir`,
   `urlsFile`, `additionalUrls`) y se fusionan por `loc` (dedupe).
3. `applyRulesAndDefaults()` aplica `defaults`, `priorityMap` (por
   profundidad) y `perUrlRules` (por patron regex).
4. `splitEntries()` divide en chunks respetando 50.000 URLs / 50MB.
5. Se escriben los archivos (`sitemap.xml` o `sitemap-N.xml` +
   `sitemap.xml` como indice), y opcionalmente `.gz`, `.txt`,
   `*-report.json`.
6. Opcionalmente: actualizar `robots.txt`, ping a buscadores, IndexNow.

## Convenciones de codigo

- CommonJS (`'use strict'` + `require`/`module.exports`) en todo `src/`.
- Sin dependencias externas de produccion — antes de añadir un `require` de
  un paquete npm, evaluar si se puede resolver con la stdlib de Node
  (`node:fs`, `node:path`, `node:zlib`, `node:crypto`, `fetch` global,
  `node:util.parseArgs`, `node:test`). Esto es una decision de diseño
  explicita, no un descuido.
- Cada modulo en `src/` tiene una responsabilidad unica y exporta funciones
  puras donde es posible (ver `crawler.js`, `sitemapBuilder.js`) para que
  sean testeables sin mocks pesados.
- Los tests de integracion usan un servidor `node:http` real levantado en
  un puerto efimero (`server.listen(0, ...)`), no mocks de `fetch`.
- Comentarios solo cuando explican un "por que" no obvio (p. ej. por que no
  hay dependencias, por que Google ya no soporta el ping de sitemaps). No
  hay comentarios que describan que hace el codigo.

## Comandos

```bash
# Ejecutar el generador
node bin/sitemap-generator.js --site https://example.com
node bin/sitemap-generator.js --config sitemap.config.js
node bin/sitemap-generator.js --help

# Tests (todos)
npm test
# equivalente directo (en Windows/Bash, usar el glob explicito):
node --test "test/*.test.js"

# Probar con el config de ejemplo
npm run example
```

No hay paso de build/compilacion (JS plano, sin bundler ni transpilacion) ni
paso de despliegue propio: "desplegar" significa copiar/clonar este
directorio donde vaya a ejecutarse y programarlo con cron/Task
Scheduler/CI (ver `examples/cron/`).

## Reglas de trabajo para Claude

- **Leer `CLAUDE_CONTEXT.md` antes de cambios importantes.** Ahi esta el
  estado real: que falta, que decisiones ya se tomaron y por que.
- **Actualizar `CLAUDE_CONTEXT.md`** despues de completar trabajo
  significativo o tomar una decision tecnica relevante (no despues de cada
  edicion menor).
- **No tocar `repos/`.** Es material de referencia congelado, no parte del
  proyecto activo.
- **Mantener cero dependencias de produccion** salvo que el usuario pida
  explicitamente lo contrario; si una funcionalidad realmente lo requiere,
  discutirlo antes de añadir un paquete.
- **No añadir un scheduler interno** (node-cron, setInterval de larga
  duracion, etc.) — la programacion periodica es responsabilidad del SO/CI
  por diseño (ver seccion de arquitectura).
- Antes de dar por buena una funcionalidad, correr `npm test` y, si el
  cambio toca el crawler o el CLI, probar contra un sitio real (ver
  ejemplo en CLAUDE_CONTEXT.md, seccion "Como probar manualmente").
