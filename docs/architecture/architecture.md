# Arquitectura de Remanso

Estado: v0.1 (esquema de datos v5). Este documento describe cómo está construido el programa tal y como existe en `src/`. Para el *por qué* de la pila técnica remite al memo `docs/research/notes/T-evaluacion-tecnica.md` (en adelante «memo T»); para el *qué* funcional, a `docs/design/ux.md` y `docs/research/interventions.md`. El modelo de datos tabla por tabla está en `data-model.md`.

## 1. Propósito y restricciones

Remanso es un diario, cuaderno, gestor de tareas y herramienta de cambio conductual personal, en modo texto, que corre en un netbook Acer Aspire One con antiX Linux arrancado a consola (tty1, `TERM=linux`). De ese hardware y de la naturaleza de los datos (lo que una persona escribe sobre sí misma) salen las restricciones que gobiernan todas las decisiones de este documento:

| Restricción | Consecuencia en el código |
|---|---|
| **Offline absoluto.** Sin red, sin telemetría, sin IA. | No hay ningún socket; la única E/S es el terminal y el directorio de datos. El texto «Sin red, sin telemetría, sin IA» aparece literalmente en Ajustes → Acerca de. |
| **≤ 2 GB de RAM, CPU Atom N270 de 32 bits** (i686 + SSE3/SSSE3, sin x86-64, un núcleo in-order). | Binario estático `i686-unknown-linux-musl`; perfil release con `opt-level = "s"`, `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip = true`. Argon2id limitado a 32 MiB. `cache_size` de SQLite en ~2 MiB. |
| **Consola de 80 × 24, 16 colores, fuente con cobertura Unicode limitada, sin ratón.** | Tema semántico sobre colores ANSI; cada glifo tiene alternativa ASCII; detección automática por `LANG`/`LC_ALL`; `render()` se niega a dibujar por debajo de 60 × 12 y muestra un aviso. |
| **Sin procesos residentes.** La aplicación sólo existe mientras el usuario la tiene abierta. | Sin demonio de notificaciones, sin cron, sin hilos de fondo. Los recordatorios se evalúan al abrir y al interactuar; el bucle de eventos duerme en `poll()` y no consume CPU en reposo. |
| **Datos sensibles en un disco sin cifrar y posible pérdida del portátil.** | Toda la base está cifrada con SQLCipher; la clave se deriva con Argon2id y se borra de memoria al bloquear; `kdf.json` y `prefs.json` son los únicos ficheros en claro y no contienen datos del usuario. |
| **Tono sereno; nunca reproche.** | Todos los textos visibles están en `text.rs`; hay una prueba que prohíbe ciertas palabras en el catálogo de técnicas. |

## 2. Pila técnica

Dependencias directas (`cargo tree --depth 1`; 167 líneas en el árbol completo):

| Crate | Versión fijada | Uso | Nota |
|---|---|---|---|
| `ratatui` | 0.29 (`default-features = false`, feature `crossterm`) | Dibujo por diferencias en doble búfer | Ver §13 sobre 0.29 frente a 0.30 |
| `crossterm` | 0.28 | Modo crudo, eventos de teclado/pegado/redimensión | `poll(timeout)` bloquea en `epoll`: cero *busy-loop* |
| `rusqlite` | 0.32, feature `bundled-sqlcipher-vendored-openssl` | SQLite + SQLCipher 4 + FTS5, OpenSSL estático | `libsqlite3-sys` 0.30.1, `openssl-src` 3.6.x |
| `argon2` | 0.5 (`default-features = false`, `alloc`) | Derivación de clave Argon2id | RustCrypto |
| `zeroize` | 1 (`derive`) | Borrado de secretos al soltarlos | `Key`, `Password`, cadena hex de `PRAGMA key` |
| `chrono` | 0.4 (`clock`, `std`) | Fechas locales | Sin dependencias de *locale*: los nombres en español están en `dates.rs` |
| `serde`, `serde_json` | 1 | `prefs.json`, `kdf.json`, `manifest.json`, `datos.json`, `builtin.json` | |
| `unicode-width`, `unicode-segmentation` | 0.2, 1 | Ancho de celdas y ajuste de línea en el editor | |
| `tempfile` (dev) | 3 | Bases de datos temporales en pruebas | |

Justificación breve (memo T §3–4 y §8): Rust es el único de los stacks comparados que combina soporte oficial para i686, ausencia de recolector de basura, control explícito de la memoria que contiene secretos y un ecosistema de cifrado maduro (SQLCipher 4, Argon2, zeroize). SQLCipher da acceso aleatorio por página, transacciones atómicas, WAL cifrado y FTS5 dentro del mismo fichero; un formato propio tendría que reinventar todo eso con más riesgo. musl estático elimina la dispersión de versiones de glibc entre ediciones de antiX. El edition es 2021 y `rust-version = "1.80"`. Lo que falta de la lista (CLI, aleatoriedad, editor) se explica en §13.

## 3. Estructura de módulos

`src/main.rs` declara doce módulos. La dependencia va siempre hacia abajo; ningún módulo inferior conoce al superior.

```
                 ┌──────────┐
                 │   cli    │  argumentos, prompt de contraseña sin eco, confirmaciones
                 └────┬─────┘
                      │
                 ┌────▼─────┐
                 │   app    │  bucle de eventos, enum Screen, Modal/Deferred,
                 │          │  una submódulo por pantalla (diary, goals, impulse…)
                 └─┬──┬──┬──┘
       ┌───────────┘  │  └───────────────┐
       ▼              ▼                  ▼
 ┌──────────┐  ┌─────────────┐  ┌───────────────┐    ┌──────┐  ┌───────┐
 │  domain  │  │  analysis   │  │ interventions │    │  ui  │  │ text  │
 │ modelos y│  │ ewma, medias│  │ Catalog desde │    │theme │  │ const │
 │ consultas│  │ sparklines  │  │ builtin.json  │    │glyphs│  │ &str  │
 │ por tabla│  │ (puro)      │  │ (puro)        │    │editor│  │       │
 └────┬─────┘  └─────────────┘  └───────────────┘    │widget│  └───────┘
      │                                              └──────┘
 ┌────▼─────┐
 │ storage  │  Db (una conexión SQLCipher), migrations, backup, export
 └────┬─────┘
      │
 ┌────▼─────┐
 │  crypto  │  KdfParams, Key, Password, random_salt
 └──────────┘

 Transversales (hojas, sin dependencias internas): paths, prefs, dates
```

- **`cli`** interpreta `--dir`, `--ascii`, `--light|--dark`, `--backup`, `--restore`, `--export`, `--check`, `--bench`, `--version`, `--help`. Ninguna opción acepta la contraseña (hay una prueba que lo garantiza); `prompt_password` la lee en modo crudo sin eco.
- **`app`** es el único módulo que conoce a todos los demás. `app/mod.rs` contiene el bucle, los enums `Screen`, `Deferred` y `Modal`, y el struct `App`; cada pantalla vive en su fichero (`diary.rs`, `notebooks.rs`, `tasks.rs`, `reminders.rs`, `goals.rs`, `impulse.rs`, `review.rs`, `search.rs`, `settings.rs`, `lock.rs`, `home.rs`) con tres funciones públicas convencionales: `open(db)`, `handle(app, s, k) -> Screen` y `render(s, frame, area, ctx)`. `app/bench.rs` implementa `--bench`.
- **`domain`** son repositorios finos sobre `rusqlite::Connection`: un fichero por tabla o grupo (`diary`, `notebooks`, `tags`, `tasks`, `reminders`, `recurrence`, `goals`, `metrics`, `milestones`, `actions`, `plans`, `impulses`, `prompts`, `reviews`, `search`). Reciben `&Connection`, no `&Db`, para que las pruebas y `bench` puedan usarlos directamente. Las enumeraciones de dominio (`GoalStatus`, `MetricKind`, `Schedule`, `Rule`…) viven aquí con `as_str`/`parse`/`label`.
- **`analysis`** es código puro sin SQL: `trend.rs` (EWMA, media móvil, nivel actual, N mínimo, pendiente, semana contra semana, regularidad horaria) y `spark.rs` (sparkline, barra de progreso, filas de actividad, gráfico de líneas), siempre con la alternativa textual al lado.
- **`interventions`** carga el catálogo declarativo (§8).
- **`storage`** expone `Db`, los errores `DbError`, `migrations::MIGRATIONS`, y los submódulos `backup` y `export`.
- **`crypto`** no implementa criptografía propia: combina Argon2id (RustCrypto) con la clave en crudo de SQLCipher.
- **`ui`** es el sistema visual (§9); **`text`** los textos (§10); **`paths`** resuelve el directorio de datos y escribe ficheros atómicamente; **`prefs`** son las preferencias en claro; **`dates`** las fechas locales en español y los analizadores de entradas como «mañana 9:00» o «cada 2 semanas».

## 4. El bucle de eventos dirigido por plazos

El principio es que **no hay temporizador permanente**: el programa duerme hasta que el usuario pulsa algo o hasta el próximo instante en que tiene algo que hacer por sí solo. `App::event_loop` es:

```
mientras !quit:
    terminal.draw(render)
    plazo = next_deadline()
    evento = si plazo:  poll(plazo - ahora) ? read() : None
             si no:     read()                     ← bloquea indefinidamente
    según evento:
        Key (no Release)  → last_activity = ahora; handle_key
        Paste             → last_activity = ahora; insertar en el editor activo
        Resize            → nada (el siguiente draw ya usa el nuevo tamaño)
        None (expiró)     → tick()
```

`next_deadline()` toma el mínimo de estos candidatos, todos opcionales:

| Fuente | Plazo | Qué hace `tick()` al vencer |
|---|---|---|
| Mensaje de estado | `instante + STATUS_TTL` (4 s) | Lo borra |
| Bloqueo por inactividad | `last_activity + prefs.lock_after_minutes × 60` (sólo con sesión abierta y minutos > 0) | `lock()` |
| Autoguardado | `editor.autosave_deadline(AUTOSAVE_IDLE)` = `last_edit + 2 s` si hay cambios sin guardar, en `DiaryEdit`, `NoteEdit` y `TaskDetail` | `autosave(false)`: guarda si `needs_autosave` |
| Espera activa del episodio de impulso | `Impulse::next_deadline()`: durante `Step::Wait`, el menor entre lo que falta para `wait_seconds` y 30 s, nunca menos de 1 s | Nada que hacer: basta redibujar el tiempo transcurrido |
| Próximo recordatorio | `reminders::next_due_at(now)` → `ahora + (due − now)` | Nada: al redibujar, Inicio lo muestra como pendiente |

Así, el contador de la espera activa se redibuja cada ≤ 30 s en lugar de cada segundo, el autoguardado ocurre exactamente dos segundos después de la última tecla y no antes, y si no hay nada pendiente `read()` bloquea sin despertar jamás. `tools/perf.py` mide precisamente esto (CPU en 20 s de reposo ≈ 0).

El autoguardado forzado (`autosave(true)`) se ejecuta al bloquear y al salir, de modo que `Esc` nunca pregunta «¿descartar cambios?».

## 5. La máquina de estados de pantallas

### `Screen`

`App.screen` es un `enum Screen` con 22 variantes, cada una propietaria de su estado: `Blank`, `Lock`, `Setup`, `Home`, `Diary`, `DiaryEdit`, `Notebooks`, `Notes`, `NoteEdit`, `Search`, `Settings`, `Tasks`, `TaskDetail`, `PostponeReview`, `Reminders`, `Goals`, `GoalDetail`, `MetricView`, `Impulse`, `Pattern`, `Review`, `ReviewSession`. No hay pila de navegación genérica: las pantallas que necesitan «volver» guardan su origen (p. ej. `Search.back: Box<Screen>`); las demás vuelven a Inicio con `app.go_home()`.

### El patrón `mem::replace`

Los manejadores reciben la pantalla **por valor** y devuelven la siguiente, a la vez que necesitan `&mut App` para abrir diálogos, consultar la base o mostrar errores. Para evitar el préstamo doble, `handle_key` hace:

```rust
let screen = std::mem::replace(&mut self.screen, Screen::Blank);
let screen = match screen {
    Screen::Diary(s) => diary::handle_list(self, s, k),
    …
};
if matches!(self.screen, Screen::Blank) {
    self.screen = screen;
}
```

Mientras el manejador corre, `self.screen` es `Blank`. Si el manejador asigna directamente `app.screen` (como hace `go_home()`), esa asignación gana; si no, se restaura la pantalla devuelta. `run_deferred` sigue exactamente el mismo esquema. El coste es una variante `Blank` que `render` ignora.

Antes de despachar, `handle_key` borra el mensaje de estado, da prioridad al modal si hay uno y procesa las teclas globales `Ctrl+Q` (salir) y `Ctrl+L` (bloquear), ambas sólo con sesión abierta.

### `Modal` y `Deferred`

Los diálogos no son pantallas: son un `Option<Modal>` que se dibuja encima y captura el teclado.

```rust
pub enum Modal {
    Confirm { message, destructive, then: Deferred },   // s/S/Intro acepta; n/N/Esc cancela
    Choice  { title, options, sel, then: Deferred },    // ↑↓/jk, 1–9, Intro → índice como texto
    Prompt  { label, input: LineInput, then: Deferred },// Intro → valor; modo secreto para contraseñas
    Help    { title, entries },
    Info    { title, lines },
}
```

`Deferred` es la acción que se ejecutará al confirmar. Es un enum plano para diario, cuadernos, ajustes, tareas y recordatorios (`DeleteDiaryEntry(i64)`, `CreateNotebook`, `BackupTo`, `ChangePwRepeat(Password, Password)`, `PostponeTask(i64)`, `ReminderWhen(String)`…) y envuelve sub-enums para los módulos grandes: `Deferred::Goal(GoalAction)`, `Deferred::Impulse(ImpulseAction)`, `Deferred::Review(ReviewAction)`. `App::run_deferred(d, value)` despacha por grupo a la función `run_deferred(app, screen, d, value) -> Screen` del módulo correspondiente, que recibe el valor introducido (`Option<String>`) y puede encadenar otro diálogo (por ejemplo, `ChangePwCurrent` → `ChangePwNew` → `ChangePwRepeat`, o la cadena de preparación P0 del impulso). Como `Deferred` lleva sus datos consigo, un flujo de varios pasos no necesita estado adicional en la pantalla.

### Contexto de dibujo

`render` desestructura `App` en `Ctx { theme, glyphs, db, prefs, zen, modal_open }`, un contexto de sólo lectura. Dibuja la pantalla, encima el mensaje de estado y encima el modal. `zen` (`Ctrl+F` en los editores) oculta cabecera y pie.

### Sesión, bloqueo y reanudación

`App.db: Option<Db>` es la sesión. `lock()` fuerza el autoguardado, cierra la conexión (`wal_checkpoint(TRUNCATE)`), descarta el modal y vuelve a `Screen::Lock`; la `Key` se borra al soltarse (`ZeroizeOnDrop`). `after_unlock()` registra `last_open` en `settings` y, si han pasado ≥ 3 días y hay tareas pendientes o recordatorios vencidos, muestra un único aviso neutro (nada se marca como incumplido).

## 6. Persistencia

### Una conexión, cifrada

`storage::Db` envuelve una única `rusqlite::Connection` abierta con `SQLITE_OPEN_READ_WRITE | SQLITE_OPEN_NO_MUTEX` (más `CREATE` al crear). Lo primero que recibe es `PRAGMA key = "x'<64 hex>'"`: 32 bytes en crudo que SQLCipher usa sin su PBKDF2 interno. La cadena hexadecimal vive en un `Zeroizing<String>` y se borra inmediatamente. Después, en este orden:

| PRAGMA | Por qué |
|---|---|
| `cipher_memory_security = ON` | SQLCipher borra toda la memoria sensible al liberarla, no sólo la de las operaciones criptográficas. Coste medible en un Atom; se acepta (§13). |
| `temp_store = MEMORY` | Ningún fichero temporal de ordenación o índice en claro en disco. |
| `secure_delete = ON` | Lo borrado se sobrescribe con ceros dentro de las páginas antes de cifrarlas; una página reutilizada no arrastra texto antiguo. |
| `foreign_keys = ON` | SQLite las ignora por defecto; sin esto las cláusulas `ON DELETE` del esquema no harían nada. |
| `journal_mode = WAL` | Escrituras concurrentes con lecturas y commits más baratos; el WAL también va cifrado. |
| `synchronous = FULL` | Con WAL, `FULL` hace cada commit duradero ante un corte de energía, no sólo ante un fallo del proceso (§13). |
| `cache_size = -2000` | ≈ 2 MiB de caché de páginas: suficiente para las listas y acotado para la RAM del equipo. |

Con una clave errónea la primera página no se autentica (HMAC) y SQLite informa `NotADatabase`; `Db::open_with_key` lo traduce a `DbError::WrongPassword`, el único detalle que se da. Los mensajes de error nunca incluyen contenido del usuario.

### Derivación de clave

`crypto::KdfParams` guarda `version`, `algorithm` (`"argon2id"`), `salt`, `m_kib`, `t`, `p`, `key_len`. La sal son 24 caracteres alfanuméricos (≈ 143 bits, muestreo con rechazo sobre `/dev/urandom`) **imprimibles a propósito**: sus bytes UTF-8 son la sal real, de modo que la clave puede rederivarse con la herramienta `argon2` de línea de órdenes sin esta aplicación. `derive()` usa Argon2id v0x13 con los parámetros guardados y produce `Key([u8; 32])`. `change_password` genera sal nueva, deriva, hace `PRAGMA rekey` y **sólo después** escribe `kdf.json`.

### Migraciones *append-only* con `user_version`

`migrations::MIGRATIONS` es un `&[&str]` de cinco bloques SQL. `Db::migrate()` lee `PRAGMA user_version`; si es mayor que `CURRENT_VERSION` (= número de bloques) devuelve `Incompatible { found, supported }` y no toca nada; si no, aplica cada bloque pendiente en su propia transacción y fija `user_version` al índice + 1 antes de hacer *commit*. Nunca se edita un bloque publicado: cualquier cambio de esquema es un bloque nuevo, incluidos los `ALTER TABLE … ADD COLUMN` (v5). No hay migraciones hacia atrás.

### FTS5 externo con triggers

`diary_fts` y `notes_fts` son tablas FTS5 de **contenido externo** (`content='diary_entries', content_rowid='id'`): no duplican el texto, sólo el índice, y viven en el mismo fichero cifrado. Tres triggers por tabla (`*_ai`, `*_ad`, `*_au`) mantienen el índice en cada `INSERT`, `DELETE` y `UPDATE`; el borrado usa la orden especial `INSERT INTO x_fts(x_fts, rowid, …) VALUES ('delete', …)` que exige FTS5 para contenido externo. El *tokenizer* es `unicode61 remove_diacritics 2`, de modo que «sueño» y «sueno» coinciden. `domain::search::fts_query` convierte la entrada del usuario en términos entrecomillados con prefijo (`"camin"*`) para que la sintaxis FTS nunca se interprete. `Db::check()` ejecuta `quick_check` más `integrity-check` de ambas FTS; `rebuild_search()` las reconstruye tras una restauración.

### Directorio de datos

`paths::DataDir::resolve` sigue este orden: `--dir`, `$REMANSO_DIR`, `$XDG_DATA_HOME/remanso`, `$HOME/.local/share/remanso`. Crea el directorio con 0700 y los ficheros con 0600. `write_atomic` escribe en `.tmp`, hace `fsync`, renombra y sincroniza el directorio. Ficheros: `remanso.db` (+ `-wal`, `-shm` mientras está abierta), `kdf.json`, `prefs.json`; tras una restauración, `remanso.db.anterior` y `kdf.json.anterior`.

## 7. Copias y exportación

**Copia de seguridad** (`storage::backup`). Un directorio con `remanso.db`, `kdf.json` y `manifest.json` (`format: 1`, `app_version`, `schema_version`, `created_at`, `db_bytes`). Se genera con `ATTACH DATABASE` + `SELECT sqlcipher_export('backup')`, el mecanismo documentado de SQLCipher, por lo que la copia se abre con la herramienta `sqlcipher` sin Remanso. Como `sqlcipher_export` no copia `user_version`, se fija a mano. El destino debe estar vacío; la copia queda cifrada con la misma clave (misma `kdf.json`). `verify_backup` la abre y pasa `check()`. `restore_from` deriva la clave desde la `kdf.json` **de la copia**, verifica, renombra lo existente a `.anterior` (nunca borra), copia, y reconstruye las FTS. `list_backups` y `rotate(keep)` permiten conservar las N más recientes. Disponible desde Ajustes (ruta propuesta `copias/remanso-AAAA-MM-DD-HHMM`) y desde `--backup`, `--restore`, `--check`.

**Exportación** (`storage::export`). Deliberadamente **en claro** y sólo tras confirmación explícita, tanto en Ajustes como en `--export`. Produce `diario/AAAA/AAAA-MM-DD-<id>.md` (una entrada por fichero, sin las marcadas `deleted_at`), `cuadernos/<cuaderno>/<id>-<título>.md` (una nota por fichero, incluidas las archivadas) y `datos.json`, un volcado genérico que recorre `sqlite_master`, excluye las tablas `%_fts%` (índice y tablas sombra) y vuelca cada fila como objeto; cualquier tabla futura queda incluida sin tocar el código. Los BLOB se codifican en hexadecimal.

## 8. El catálogo declarativo de intervenciones

`interventions/builtin.json` (versión 1, 23 técnicas) se incrusta con `include_str!` y se deserializa en `Catalog { version, tecnicas: Vec<Technique> }`. Cada `Technique` tiene `clave`, `nombre`, `experimental`, `confianza` (`Alta | Media | Baja | Muy baja`), `finalidad`, `evidencia: Vec<String>` (citas con cifras), `limites` y, opcionalmente, `pasos: Vec<String>`.

El catálogo es la **única fuente** de tres cosas: los textos de los pasos de las vías del episodio de impulso (`Pathway::key()` ∈ {`surfear_impulso`, `respiracion_lenta`, `distraccion_concreta`, `espera_activa`, `respuesta_competidora`} se resuelven con `Catalog::steps`), las tarjetas de ayuda «Técnicas» en Ajustes (`Technique::card()` muestra nombre, calidad de la evidencia, finalidad, citas y límites tal cual) y el valor de `strategies.technique` en la base de datos, que conserva la trazabilidad de cada episodio con su técnica. Dos pruebas lo custodian: una exige que estén las claves que la interfaz usa y que toda técnica tenga evidencia; otra prohíbe en el JSON las palabras «racha rota», «has fallado», «fracaso», «deberías» y el signo «¡».

## 9. Sistema visual

**Tema** (`ui/theme.rs`). `Theme` es un struct de 16 `Style` semánticos (`text`, `dim`, `accent`, `title`, `emphasis`, `warn`, `alert`, `positive`, `selected`, `input`, `rule`, `md_heading`, `md_marker`, `md_quote`, `bar_fill`, `bar_empty`) construidos sólo con los 16 colores ANSI y los modificadores `BOLD`, `ITALIC`, `UNDERLINED`. El tema oscuro usa cian como acento y gris oscuro como atenuado; el claro, azul y gris. Rojo sólo para `alert` (borrados y errores reales); verde nunca para «rachas». Las pantallas no eligen colores: eligen roles.

**Glifos** (`ui/glyphs.rs`). `Glyphs` es un struct de cadenas estáticas con dos constructores, `unicode()` y `ascii()`: `─`/`-`, `●`/`*`, `○`/`o`, `◐`/`+`, `▍`/`>`, `…`/`...`, `█`/`#`, `░`/`-`, `↑↓→`/`^v=`, `▲`/`^`, `✓`/`x` y ocho niveles de sparkline (`▁▂▃▄▅▆▇█` / `.:-=+*%#`). Se elige con `--ascii`, con la preferencia guardada o por `detect_ascii_env()` (sin «utf» en `LANG`/`LC_ALL`). `truncate()` recorta por ancho de celda respetando la elipsis del juego activo. Ningún glifo transmite significado solo: va acompañado de palabra o color.

**Widgets** (`ui/widgets.rs`). `chrome` dibuja la estructura común (título · fecha arriba, teclas abajo, regla entre ambos) y devuelve el área de contenido; `LineInput` es la entrada de una línea con modo secreto y asteriscos opcionales; `Selector` encapsula cursor, desplazamiento y paginación de listas; `dialog`, `confirm_dialog` y `help_dialog` dibujan los modales.

**Editor** (`ui/editor.rs`). Modelo `Vec<String>` de líneas lógicas; ajuste por palabras calculado al dibujar con el ancho de la última pasada; cursor en (línea, índice de carácter); deshacer/rehacer por instantáneas; resaltado ligero de Markdown; seguimiento de `dirty` y `last_edit` para el autoguardado. `Editor::from_text` sobre una nota de 3 000 líneas es uno de los casos de `--bench`.

## 10. Internacionalización

`text.rs` concentra unas 360 constantes `pub const … : &str` (o `&[&str]`) agrupadas por pantalla con comentarios de sección: bloqueo, inicio, diario, cuadernos, búsqueda, ajustes, genéricos, tareas, revisión de aplazamientos, recordatorios, objetivos, métricas, hitos, acciones, impulso, revisiones, planes. Las plantillas usan marcadores `{n}`, `{t}`, `{x}` sustituidos con `replace`. La cabecera fija las reglas de tono: sin exclamaciones, sin emojis, sin felicitaciones automáticas, sin reproches. `dates.rs` aporta nombres de meses y días en español sin tocar el *locale* del sistema.

Es internacionalización **en tiempo de compilación**: traducir es sustituir `text.rs`. Hay tres excepciones conscientes que un traductor debe conocer: las etiquetas de las enumeraciones de dominio (`GoalStatus::label()`, `MetricKind::label()`, `CLOSE_REASONS`, `OUTCOMES`, `HELPFUL`), las plantillas de preguntas en `domain::prompts::templates` (copiadas literalmente de `interventions.md` §d) y el catálogo `builtin.json`.

## 11. Pruebas

**Unitarias** (73 funciones `#[test]` en 27 ficheros, `cargo test`). `storage::test_support::temp_db()` crea una base real en un `tempfile::TempDir` con parámetros Argon2 baratos (1 MiB, t = 1) para que cada prueba pague milisegundos y no segundos. Las pruebas de `storage` comprueban que el fichero y el WAL no contienen texto en claro ni la cabecera `SQLite format 3`, que una contraseña errónea produce exactamente `WrongPassword`, que el cambio de contraseña invalida la antigua, y que las migraciones son idempotentes. `backup` prueba el ciclo copia → verificación → restauración con contraseña mala y buena y que las FTS funcionan tras restaurar; `export` que no aparecen tablas FTS en `datos.json`. Los módulos de dominio prueban reglas de negocio (plazo de revisión, hitos por recuento, SRBAI, reactivar preguntas no duplica). `cli` prueba que `--password` es rechazado.

**Humo en pseudo-terminal** (`tools/tui_smoke.py <binario> <dir-datos>`). Lanza el binario en un `pty` de 80 × 24 con `TERM=xterm-256color` y `LANG=es_ES.UTF-8`, alimenta la salida a `pyte.Screen` (que reconstruye la pantalla a partir del redibujado diferencial de ratatui, cosa que una comparación de bytes no permite) y envía pulsaciones reales: crear contraseña, elegir tema, escribir una entrada con título y modo zen, crear cuaderno y nota con `[[enlace]]`, buscar, tareas con aplazamiento, subtarea, proyecto y calendario, recordatorios con «mañana 9:00» y «semanal», un objetivo completo con métrica, hito, acción, plan si-entonces, un episodio de impulso de principio a fin, activar preguntas de cierre y completar una revisión que crea dos tareas, patrón de impulsos, bloqueo con contraseña incorrecta (comprobando que la pantalla de bloqueo no muestra datos), verificación de integridad y salida con `Ctrl+Q`. Cada paso afirma textos esperados; `DUMP=1` imprime las pantallas. `tools/perf.py` mide tiempo hasta el primer fotograma, creación de la base, memoria residente y CPU en 20 s de reposo. `remanso --bench` ejecuta en un directorio temporal: Argon2id a 19/32/64 MiB, creación con migraciones, 2 000 entradas + 3 000 notas, listado, búsqueda FTS, apertura de una nota de 3 000 líneas, `quick_check` y reapertura, e imprime `VmRSS`/`VmHWM` en Linux.

## 12. Compilación cruzada

El objetivo principal es un **binario estático `i686-unknown-linux-musl`**, y en paralelo `x86_64-unknown-linux-musl` para equipos de 64 bits. musl evita la dependencia de la glibc de cada edición de antiX (2.28 → 2.36) y permite copiar un único fichero por USB. La construcción se hace desde macOS arm64 dentro de la imagen Docker `messense/rust-musl-cross`, que trae la *toolchain* musl y el compilador C necesario para `sqlcipher`, `openssl-src` y la amalgama de SQLite:

```sh
docker run --rm -v "$PWD":/home/rust/src messense/rust-musl-cross:i686-musl \
    cargo build --release
# → target/i686-unknown-linux-musl/release/remanso

docker run --rm -v "$PWD":/home/rust/src messense/rust-musl-cross:x86_64-musl \
    cargo build --release
```

Los binarios se copian a `dist/` (ignorado por git). `rust-version = "1.80"` acota la *toolchain* mínima. Con la feature `bundled-sqlcipher-vendored-openssl`, OpenSSL se compila y enlaza estáticamente; el memo T (§4.1, riesgo 1) señala que `openssl-src` mapea `i686-unknown-linux-musl` a `linux-elf` y desactiva *engine*, *async* y la memoria segura, y que esta combinación añade minutos de compilación y varios MiB de binario. El perfil `release` (`opt-level = "s"`, `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip`) compensa en tamaño. Para validar que el binario no usa instrucciones fuera de SSE3/SSSE3, el memo T §6 propone `qemu-system-i386 -cpu n270`; las cifras de tiempo sólo valen medidas en el netbook real.

## 13. Compromisos adoptados

- **Respuestas libres de una sola línea en las revisiones.** Las preguntas de apertura, cierre y revisión semanal se contestan en `Modal::Prompt` con un `LineInput`, no en el editor multilínea. Razones: una pregunta por pantalla cabe en 80 × 24 junto al contador «2 de 3», `Esc` sale sin perder nada y la cadena `ReviewAction::Answer(idx)` → siguiente pregunta no necesita estado de edición. Quien quiera escribir largo tiene el diario; la respuesta «¿Qué queda pendiente?» separa con «;» para crear tareas.
- **Argon2id m = 32 MiB, t = 3, p = 1.** Entre la configuración «baja memoria» de RFC 9106 (64 MiB, t = 3) y la de OWASP (19 MiB, t = 2). 64 MiB tardaría varios segundos en un Atom (memo T §4.2) y 19 MiB se consideró demasiado poco para un fichero que puede acabar en manos ajenas. `--bench` mide las tres para decidir con datos; los parámetros son modificables sin recifrar (basta rederivar y `rekey`).
- **`secure_delete = ON` y `cipher_memory_security = ON`.** El memo T aconsejaba medir antes de activarlos. Se activan por defecto porque el volumen de escritura de un diario es minúsculo y la garantía (ninguna página reutilizada conserva texto, ninguna asignación liberada conserva clave) vale más que los milisegundos.
- **WAL + `synchronous = FULL`** en lugar del `NORMAL` propuesto en el memo T §4.3: durabilidad ACID real ante cortes de corriente en un portátil con batería vieja.
- **Sin libsql ni Turso.** Su cifrado es experimental o requiere cmake (memo T §4.3). SQLCipher 4 es estable y su formato lo abre la herramienta `sqlcipher` de serie. Revisar en 2027.
- **ratatui 0.29 con crossterm 0.28, no 0.30.** ratatui 0.30 exige MSRV 1.88 y divide el crate en `ratatui-core`, `ratatui-widgets` y backends separados (memo T §3.1). El proyecto fija `rust-version = "1.80"` para poder compilar con *toolchains* más conservadoras en la imagen musl; 0.29 ya ofrece el doble búfer con escritura de celdas cambiadas. Migrar a 0.30 es un cambio de `Cargo.toml` y de `use`, no de arquitectura.
- **Sin demonio de notificaciones.** Los recordatorios son filas de `reminders` que se consultan al desbloquear y en cada vuelta del bucle (`next_due_at` despierta el bucle justo cuando vence uno, pero sólo con la aplicación abierta). Un recordatorio nunca se considera incumplido porque el programa estuviera cerrado: aparece como pendiente, y tras `max_shows` apariciones la interfaz ofrece revisarlo en vez de insistir. Un proceso residente contradiría la restricción de §1 y añadiría un vector de fuga (texto del recordatorio fuera del cifrado).
- **CLI, aleatoriedad y editor propios.** Un `match` sobre los argumentos, una lectura de `/dev/urandom` y un editor de ~750 líneas evitan tres dependencias y sus árboles; el editor existe porque el ajuste de línea por palabras no era negociable.
- **Columna `deleted_at` reservada, borrado real en la práctica.** `diary_entries.deleted_at` existe y todas las consultas la filtran, pero `diary::delete` ejecuta un `DELETE`: con `secure_delete` el borrado real es la opción coherente con la privacidad, y la columna permite introducir una papelera sin migración.
- **Pendiente, no implementado.** El memo T §7 recomienda `prctl(PR_SET_DUMPABLE, 0)` y `mlock` de la clave; hoy no se hace. El directorio 0700, el `ZeroizeOnDrop` y el bloqueo por inactividad son las mitigaciones vigentes. Los documentos `docs/security/recovery.md` y `docs/performance.md`, citados desde `crypto.rs` y `backup.rs`, están por escribir.

## 14. Cómo añadir un módulo nuevo

Supongamos un módulo «Lecturas» con su tabla, su pantalla y sus diálogos.

1. **Migración.** Añade un sexto bloque `r#"…"#` al final de `storage::migrations::MIGRATIONS` con `CREATE TABLE readings (…)`, sus índices y, si hay texto buscable, su tabla FTS5 de contenido externo con los tres triggers. Respeta las convenciones: `INTEGER PRIMARY KEY`, marcas de tiempo en segundos Unix, días locales `TEXT 'AAAA-MM-DD'`, `archived_at` en lugar de borrar, claves foráneas con `ON DELETE` explícito. No toques los bloques anteriores; `CURRENT_VERSION` sube solo. Si la tabla debe excluirse del volcado JSON, su nombre no puede contener `_fts`.
2. **Dominio.** Crea `src/domain/readings.rs` y decláralo en `domain/mod.rs`. Define el struct, las enumeraciones con `as_str`/`parse`/`label`, una constante `SELECT` con la lista de columnas y una función `map(&Row)`, y funciones `create`, `get`, `list`, `set_*`, `set_archived`, `delete` que reciban `&Connection` y devuelvan `crate::storage::Result`. Escribe sus pruebas con `storage::test_support::temp_db()`.
3. **Pantalla.** Crea `src/app/readings.rs` con `pub struct Readings { sel: Selector, items: Vec<…> }`, `impl Readings { pub fn open(db: &Db) -> Result<Self> }`, `pub fn handle(app: &mut App, s: Readings, k: KeyEvent) -> Screen` y `pub fn render(s: &Readings, frame, area, ctx: &Ctx)`. Usa `widgets::chrome` para la estructura, `Selector::handle_key` para la lista, `?` para la ayuda (`app.help(...)` con `global_help()` al final) y `Esc` → `app.go_home()`. Declara `mod readings;` en `app/mod.rs`, añade `Screen::Readings(readings::Readings)` y sus dos brazos en `handle_key` y `render`. Si la pantalla tiene editor, añádela también a `next_deadline`, `autosave` y `handle_paste`. Da de alta el acceso en `home::Item` con su letra.
4. **Diálogos.** Añade las variantes a `Deferred` (o, si son muchas, un `enum ReadingAction` envuelto en `Deferred::Reading(ReadingAction)`), agrúpalas en el `match` de `App::run_deferred` hacia `readings::run_deferred(app, screen, d, value) -> Screen`. Abre diálogos con `app.prompt`, `app.choice`, `app.confirm` (con `destructive: true` para borrados) e `app.info`.
5. **Textos.** Todos los literales visibles van a `text.rs` bajo un comentario `// Lecturas`: título, estado vacío de dos líneas (qué es, qué tecla crea el primero), etiquetas de diálogos, confirmación de borrado. Sin exclamaciones ni reproches. Si el módulo expone una técnica conductual, añádela a `builtin.json` con evidencia y límites, y referénciala por su `clave`.
6. **Pruebas.** Además de las unitarias del dominio, añade al final de `tools/tui_smoke.py` un bloque que entre en la pantalla, cree un elemento, compruebe textos con `expect` y vuelva a Inicio. Comprueba que `dump_json` incluye la tabla nueva y que cada glifo que uses tiene par ASCII en `Glyphs`.
