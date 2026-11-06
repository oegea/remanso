# Remanso · versión web

La misma aplicación que la versión de terminal, como página instalable (PWA) para
móvil y escritorio. **Todo ocurre en el dispositivo**: no hay servidor, cuenta ni
red tras la carga inicial. Los datos se guardan cifrados en el almacenamiento del
navegador (IndexedDB) y se pueden descargar y restaurar como un archivo `.remanso`.

## Cómo funciona

| Capa | Qué | Por qué |
|---|---|---|
| Datos | SQLite oficial en WebAssembly (`@sqlite.org/sqlite-wasm`), en memoria, **mismo esquema SQL** que la versión de terminal (`src/db/migrations.ts`) | Una sola definición de datos; FTS5 para buscar; migraciones append-only |
| Cifrado | Argon2id (`hash-wasm`, 32 MiB, 3 pasadas, en un *worker*) → clave AES-256-GCM no extraíble de WebCrypto; contenedor autenticado (`src/crypto/container.ts`) | Primitivas auditadas; la cabecera (sal, parámetros) va autenticada por la etiqueta GCM |
| Persistencia | El archivo SQLite serializado se cifra entero y se guarda en IndexedDB 1,5 s después del último cambio, al ocultar la pestaña y al bloquear; se conserva la versión anterior por si una escritura se interrumpe | Sencillo y robusto; sin índices en claro |
| Interfaz | React 19 + Vite, `wouter` para rutas, `motion` para transiciones; sin fuentes ni recursos externos | Pantallas con URL (botón atrás del móvil), accesibilidad con HTML semántico |
| Sin conexión | `vite-plugin-pwa` sirve la propia aplicación; `vercel.json` añade CSP estricta (`connect-src 'self'`) | Imposible enviar datos fuera aunque hubiera un error |

Decisiones de diseño: `DESIGN.md`. Reglas conductuales y de seguridad: las mismas de
`../docs/research/` (los textos se generan de `../src/text.rs` con `../tools/port_texts.py`).

## Desarrollo

```bash
pnpm install
pnpm dev            # http://localhost:5173
./node_modules/.bin/vitest run   # 67 pruebas (dominio, cifrado, SQLite, exportación)
./node_modules/.bin/tsc -b       # tipos
./node_modules/.bin/playwright test   # extremo a extremo: móvil, escritorio y móvil oscuro
pnpm build          # dist/ estático
```

Las pruebas de extremo a extremo recorren la aplicación entera como una persona
(primer uso, diario, cuadernos, tareas, recordatorios, objetivos, revisión,
impulso, copia, bloqueo y recarga) y dejan capturas de cada pantalla en
`e2e/shots/<proyecto>/` para la revisión de diseño. Hacen falta los navegadores de
Playwright: `./node_modules/.bin/playwright install chromium`.

## Despliegue en Vercel

Proyecto estático: *Framework preset* Vite, directorio raíz `web`, comando
`pnpm build`, salida `dist`. `vercel.json` ya incluye la reescritura a
`index.html` para las rutas y las cabeceras de seguridad (CSP, COOP/COEP,
`Referrer-Policy: no-referrer`). No hay funciones ni variables de entorno.

## Límites honestos

- **Recordatorios**: sin servidor no hay notificaciones *push*. La aplicación
  comprueba los recordatorios al abrirse y mientras está abierta; puede mostrar
  avisos del navegador si se le da permiso, pero no despierta sola el dispositivo.
- **Datos del navegador**: si se borran los datos del sitio o se pierde el
  dispositivo sin copia, los datos se pierden. La app pide «almacenamiento
  persistente» al navegador para reducir el riesgo de limpieza automática, y
  recuerda descargar copias.
- **Contraseña olvidada**: no hay recuperación posible, por diseño.
- **Memoria**: mientras la sesión está abierta, los datos descifrados están en
  memoria del navegador; el bloqueo por inactividad (10 min por defecto) y el velo
  al cambiar de aplicación limitan la exposición. Una extensión maliciosa del
  navegador podría leerlos: fuera del alcance, como en la versión de terminal.
- **Rendimiento**: cada guardado cifra la base entera; con cientos de miles de
  palabras sigue siendo rápido (decenas de ms), y el cifrado corre en el hilo
  principal mientras la derivación de clave corre en un *worker*.

## Recuperar los datos sin la aplicación

El archivo `.remanso` es: `RMNS1\n` · longitud de cabecera (u32 LE) · cabecera
JSON (`kdf`: sal imprimible y parámetros Argon2id; `meta`) · nonce de 12 bytes ·
AES-256-GCM del archivo SQLite. Con la sal y la contraseña, `argon2 <sal> -id -t 3
-m 15 -p 1 -l 32 -r` da la clave; cualquier biblioteca AES-GCM con `aad` = cabecera
descifra; el resultado es un archivo SQLite normal que abre `sqlite3`.
