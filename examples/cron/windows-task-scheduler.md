# Programar en Windows con Task Scheduler

## Opcion A: linea de comandos (`schtasks`)

Ejecuta en PowerShell (una sola vez, como administrador si se requiere ejecutar
aunque el usuario no haya iniciado sesion):

```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "SitemapGenerator" `
  /TR "node \"E:\Usuarios\Tony\OneDrive\Documents\GitHub\Sitemap-Generator\bin\sitemap-generator.js\" --config \"E:\Usuarios\Tony\OneDrive\Documents\GitHub\Sitemap-Generator\sitemap.config.js\""
```

Variantes de frecuencia: `/SC DAILY`, `/SC WEEKLY /D MON`, `/SC MONTHLY /D 1`.

Comandos utiles:

```powershell
schtasks /Run /TN "SitemapGenerator"      # ejecutar ahora, para probar
schtasks /Query /TN "SitemapGenerator" /V # ver detalles
schtasks /Delete /TN "SitemapGenerator" /F # eliminar la tarea
```

## Opcion B: interfaz grafica

1. Abrir **Task Scheduler** (`taskschd.msc`).
2. **Create Task...** (no "Basic Task", para poder ajustar todos los detalles).
3. **General**: nombre `SitemapGenerator`, marcar "Run whether user is logged
   on or not" si el sitio debe actualizarse sin sesion abierta.
4. **Triggers**: New... -> Daily/Weekly/Monthly segun se necesite, hora deseada.
5. **Actions**: New... -> Program/script: `node`, Add arguments:
   `bin\sitemap-generator.js --config sitemap.config.js`, Start in:
   la carpeta raiz del proyecto (`E:\Usuarios\Tony\OneDrive\Documents\GitHub\Sitemap-Generator`).
6. **Conditions/Settings**: ajustar segun se prefiera (p. ej. reintentar si falla).

Node debe estar en el PATH del sistema o usar la ruta completa al ejecutable
(`(Get-Command node).Source`).
