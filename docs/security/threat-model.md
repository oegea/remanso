# Modelo de amenazas de Remanso

Versión analizada: `remanso 0.1.0` (Cargo.lock del 2026-11-06). Documento vivo: cada
afirmación remite al código que la sustenta; donde algo no se ha podido comprobar
se dice «no verificado».

Remanso es una aplicación de terminal, sin red, que guarda un diario íntimo y
métricas personales en una base SQLCipher. Este documento explica qué protege, frente
a quién, cómo y, sobre todo, qué **no** protege.

---

## 1. Activos

| Activo | Dónde vive | Sensibilidad |
|---|---|---|
| **Diario** (entradas, títulos, fechas) | `remanso.db` (tablas `diary_entries`, `diary_fts`) | Máxima: texto íntimo |
| **Cuadernos y notas** | `remanso.db` (`notebooks`, `notes`, `notes_fts`) | Alta |
| **Métricas y seguimiento conductual** (objetivos, episodios de impulso, tareas, recordatorios, revisiones) | `remanso.db` | Alta: puede revelar salud mental, hábitos, adicciones |
| **Contraseña maestra** | Sólo en la cabeza del usuario y, transitoriamente, en memoria del proceso | Máxima: da acceso a todo lo anterior |
| **Clave de cifrado** (32 bytes derivados de la contraseña) | Memoria del proceso mientras la sesión está abierta | Máxima |
| **Metadatos** (tamaño de la base, fechas de modificación, parámetros KDF, tema, existencia de copias) | Sistema de ficheros, en claro | Baja/media: no revela contenido, pero sí uso |

No se protege el hecho de usar Remanso, cuándo ni cuánto: el modelo no oculta la
existencia del diario.

## 2. Qué hay en el disco

Directorio de datos (`$REMANSO_DIR`, `$XDG_DATA_HOME/remanso` o
`~/.local/share/remanso`; `src/paths.rs`), creado con permisos `0700`:

| Fichero | Contenido | ¿Cifrado? | Permisos |
|---|---|---|---|
| `remanso.db` | Base de datos SQLCipher | Sí, por página | `0600` |
| `remanso.db-wal` | Diario de escritura anticipada (WAL) de SQLite | Sí (páginas cifradas con la misma clave) | Lo fija SQLite según `umask`; dentro de un directorio `0700` |
| `remanso.db-shm` | Índice del WAL en memoria compartida: números de página y sumas de control, **no** contenido | No (no contiene datos de usuario) | Ídem |
| `kdf.json` | Sal y parámetros Argon2id | No: no es secreto | `0600` |
| `prefs.json` | Tema, modo ASCII, minutos de bloqueo, eco de contraseña | No: no contiene datos de usuario (`src/prefs.rs`) | `0600` |
| `copias/<nombre>/` (ruta por defecto) | Copias de seguridad (ver §3.5) | La base sí; `manifest.json` y `kdf.json` no | `0700` / `0600` |
| `exportacion/` (ruta por defecto) | Exportación **en claro** (ver §3.6) | **No** | `umask` del usuario |
| `remanso.db.anterior`, `kdf.json.anterior` | Base y KDF previos tras una restauración | Sí (con su clave antigua) | Los que tuvieran |

Lo que un atacante con el disco aprende **sin** la contraseña:

- El tamaño de `remanso.db` (múltiplo de 4096): una estimación del volumen escrito.
  `secure_delete=ON` sobrescribe lo borrado dentro de la página, no reduce el fichero.
- Fechas de modificación: cuándo se usó la aplicación.
- `kdf.json`: algoritmo, sal, `m_kib`, `t`, `p`, `key_len`. No son secretos, pero dicen
  al atacante el coste exacto de cada intento.
- `prefs.json`: tema, ASCII, minutos de bloqueo (0 = nunca), eco de asteriscos.
- Nombres de copias (`remanso-AAAA-MM-DD-HHMM`) y su `manifest.json` (versiones,
  fecha, bytes).

Nada de esto revela una palabra del contenido.

## 3. Actores y escenarios

### 3.1 Robo o pérdida del portátil (equipo apagado o bloqueado)

**Adversario**: quien se queda con el disco y lo monta en otro equipo.

**Protección**: el contenido está cifrado por SQLCipher con una clave que no está en
ningún sitio del disco. Sólo puede obtenerse (a) sabiendo la contraseña o (b) por
fuerza bruta (§3.3). No hay ningún «archivo de recuperación» ni clave de respaldo.

**Límite**: ver §2 (metadatos) y §3.8 (swap e hibernación: si el equipo estaba
suspendido a disco con la sesión abierta, la clave puede estar en la partición de
swap en claro).

### 3.2 Acceso físico con la sesión del sistema desbloqueada

**Adversario**: alguien que se sienta ante el equipo mientras el usuario está ausente.

**Protección**:

- **Bloqueo por inactividad** (`src/app/mod.rs`): configurable en Ajustes entre
  0 (nunca), 5, 10, 15, 30 y 60 minutos (`LOCK_STEPS`); por defecto 10. Al bloquear,
  `App::lock()` guarda el editor activo, **cierra la conexión** (`Db::close`: checkpoint
  del WAL y `Connection::close`), descarta cualquier diálogo abierto y sustituye la
  pantalla por la de bloqueo. La clave vive dentro de la conexión SQLCipher; al
  cerrarla se libera, y con `cipher_memory_security=ON` SQLCipher sobrescribe esa
  memoria al liberarla.
- **Bloqueo manual**: `Ctrl+L` en cualquier pantalla con sesión abierta.
- **La pantalla de bloqueo no muestra nada** (`src/app/lock.rs`): sólo el nombre de la
  aplicación, la fecha de hoy, el campo de contraseña y una línea de ayuda o de
  error genérico («Contraseña incorrecta.»). No hay previsualización, ni nombre de
  la última nota, ni contadores.
- Desbloquear requiere volver a derivar la clave (segundos en hardware antiguo).

**Límite, dicho sin rodeos**: con la sesión abierta, **todo es accesible**: quien
llegue antes de que venza el temporizador puede leer, buscar y exportar en claro. El
bloqueo reduce la ventana, no la elimina; con «nunca» (0) es indefinida. Un bloqueo
de pantalla del sistema (`vlock`, `physlock`) es complementario y recomendable.

### 3.3 Lectura directa del disco: cifrado y fuerza bruta

**Cifrado del fichero** (SQLCipher 4.5.7 *community*, compilado con OpenSSL 3.6.3
vendorizado; `Cargo.lock`, `libsqlite3-sys 0.30.1`):

- Cada página de 4096 bytes se cifra con **AES-256-CBC** con un IV aleatorio
  regenerado en cada escritura, y se autentica con **HMAC-SHA512** por página.
  Modificar un byte del fichero hace que la página no se autentique y SQLite
  informe de corrupción, no de datos alterados silenciosamente.
- La cabecera del fichero son 16 bytes de sal aleatoria; **no** aparece la cadena
  `SQLite format 3` (lo comprueba el test `storage::tests::file_is_not_plaintext`).
  No se usa `cipher_plaintext_header_size`.
- El WAL hereda el cifrado de la conexión. Los ficheros temporales van a memoria
  (`temp_store=MEMORY`), así que ningún ordenamiento ni índice intermedio toca el
  disco en claro.
- Los índices de búsqueda FTS5 son tablas sombra dentro del mismo fichero: también
  cifradas.

**Derivación de la clave** (`src/crypto.rs`): la contraseña nunca se da a SQLCipher.
Se deriva una clave «raw» de 32 bytes con **Argon2id v1.3, 32 MiB de memoria, 3
pasadas, 1 hilo**, con una sal de 24 caracteres alfanuméricos (≈143 bits de entropía,
leída de `/dev/urandom` con rechazo de sesgo). La clave se pasa como `PRAGMA key =
"x'…'"`, de modo que SQLCipher **no** aplica su PBKDF2 de 256.000 iteraciones (sería
redundante y es menos resistente a GPU que Argon2id). El cambio de contraseña genera
sal nueva y hace `PRAGMA rekey`, recifrando todas las páginas; `kdf.json` sólo se
reescribe si el `rekey` tuvo éxito.

**Coste de la fuerza bruta (estimación honesta, no medida en hardware de ataque)**:

- Argon2id con 32 MiB obliga a cada intento a tocar 32 MiB de memoria tres veces. En
  una CPU de sobremesa actual, un intento cuesta del orden de **50–150 ms por núcleo**
  (extrapolado del dato de 0,178 s para 64 MiB/t=3 en un i5-9300HF, §4.2 de la
  evaluación técnica), es decir, ~10–20 intentos/s por núcleo.
- En GPU, Argon2id está limitado por ancho de banda y capacidad de memoria: una
  tarjeta de 24 GB alberga unas 700 instancias de 32 MiB a la vez y mueve ~1 TB/s;
  cada intento mueve ≈190 MiB (32 MiB × 3 pasadas × lectura y escritura). Orden de
  magnitud: **10³–10⁴ intentos/s por GPU de gama alta**. Es una cota optimista para el
  atacante; la cifra real depende de la implementación.
- Con 10⁴ intentos/s: una contraseña de 8 minúsculas aleatorias (26⁸ ≈ 2·10¹¹) cae
  en unos **8 meses**; cuatro palabras de una lista de 7776 (≈3,6·10¹⁵) requieren
  **~11.000 años**; una contraseña que figure en una lista de un millón de filtradas
  cae en **menos de dos minutos**.

Conclusión: el KDF encarece cada intento 10⁵–10⁶ veces respecto a un hash rápido,
pero **no rescata una contraseña débil**. La aplicación sólo exige 8 caracteres; la
resistencia la pone el usuario. Los parámetros podrían subirse (`KdfParams::with_cost`),
pero en 0.1.0 **no hay ajuste en la interfaz**: siempre se usan los valores por defecto.

### 3.4 Otras cuentas del mismo sistema

**Adversario**: otro usuario local sin privilegios.

**Protección**: `DataDir::resolve` fija `0700` en el directorio y `restrict_permissions`
pone `0600` en la base, `kdf.json`, `prefs.json`, los ficheros de las copias y sus
directorios (`src/paths.rs`, `src/storage/backup.rs`). Las escrituras de JSON son
atómicas (fichero `.tmp` con `0600` + `rename`), así que no hay instante en que exista
una versión legible por otros.

**Límites**:

- `-wal`/`-shm` los crea SQLite con la `umask`; el directorio `0700` los cubre
  mientras no se mueva a un lugar con permisos laxos.
- La exportación en claro no restringe permisos (§3.6). `root` lee todo (§3.11).

### 3.5 Copias de seguridad

(`src/storage/backup.rs`; `remanso --backup RUTA` o Ajustes → Copia.)

- Se generan con `sqlcipher_export` a una base adjunta que **hereda la clave de la
  conexión**: la copia está cifrada con la misma clave que la original. Junto a ella se
  escriben `kdf.json` (copia exacta del original) y `manifest.json`.
- El destino debe no existir o estar vacío; se crea con `0700` y los ficheros con
  `0600`. El usuario elige la ruta (por defecto `copias/remanso-AAAA-MM-DD-HHMM` dentro
  del directorio de datos).
- La orden `--backup` **verifica** la copia tras crearla: la abre con la clave y
  ejecuta `quick_check` más la comprobación de integridad de las tablas FTS. La copia
  hecha desde Ajustes no ejecuta esa verificación automática; para comprobarla,
  restaurarla en un directorio de prueba (`remanso --dir /tmp/prueba --restore RUTA`).
- La restauración exige la contraseña de la copia, la verifica antes de tocar nada,
  conserva lo anterior como `remanso.db.anterior`/`kdf.json.anterior` y reconstruye
  los índices de búsqueda.

**Riesgos**:

- Si la copia se guarda en un USB, en la nube o en otro equipo, está tan protegida
  como la contraseña (§3.3) y nada más. `kdf.json` viaja con ella, lo que es
  necesario para recuperarla y da al atacante la sal y el coste exactos.
- La copia tiene la **misma clave**: cambiar la contraseña después no la protege
  retroactivamente. Si una contraseña se compromete, todas las copias anteriores
  siguen abiertas con ella.
- `manifest.json` revela fecha, tamaño y versión.
- Los ficheros `.anterior` que quedan tras restaurar siguen cifrados con la clave
  antigua: si se restauró precisamente porque esa contraseña se filtró, hay que
  borrarlos a mano.

### 3.6 Exportación en claro

(`src/storage/export.rs`; `remanso --export DIR` o Ajustes → Exportar.)

- **Nunca es automática.** Sólo se ejecuta por orden explícita y tras una
  confirmación que dice literalmente que el resultado no está cifrado
  (`text::EXPORT_CONFIRM`; en la línea de órdenes se repite el aviso y se pide
  `[s/N]` antes de la contraseña).
- Produce Markdown por entrada y por nota y un volcado `datos.json` de **todas** las
  tablas (incluidas entradas marcadas como borradas, `deleted_at`, y notas
  archivadas).
- Los **nombres de fichero** contienen fechas, nombres de cuaderno y títulos de nota
  saneados: metadatos legibles incluso sin abrir los ficheros.
- Los ficheros se escriben con la `umask` del usuario (típicamente `0644`), no con
  `0600`. La ruta por defecto está dentro del directorio de datos (`0700`), lo que
  los protege de otros usuarios; **si el usuario elige otra ruta, no hay ninguna
  protección**. Esto es una limitación documentada y candidata a corregir.

La exportación existe para no atar al usuario a un formato propietario, no como
mecanismo de copia; el riesgo es suyo y la aplicación lo dice antes de actuar.

### 3.7 Ficheros temporales, registros y errores

- **Temporales**: `PRAGMA temp_store = MEMORY` (`src/storage/mod.rs`). SQLite no
  crea ficheros temporales en disco. `libsqlite3-sys` compila además con
  `SQLITE_TEMP_STORE=2`.
- **Registros**: no hay. Remanso no usa ningún *logger*; el crate `log` está presente
  por `mio` pero sin ningún consumidor instalado, así que sus mensajes se descartan.
  Los únicos textos que se escriben fuera de la base son los JSON de §2 y las copias
  y exportaciones a petición.
- **Errores**: los mensajes de `DbError`, `CryptoError` y de la línea de órdenes son
  técnicos y no incluyen contenido del usuario («contraseña incorrecta», «base de
  datos dañada: …», «error de E/S: …»). Los errores de SQLite pueden mencionar el
  nombre de una tabla o restricción, nunca el valor de una fila. Ante una contraseña
  errónea, la única información que se da es `WrongPassword` (SQLite devuelve «file
  is not a database» porque la primera página no se autentica; no se distingue
  «casi» de «nada»).
- **Fallos de la aplicación**: el perfil `release` usa `panic = "abort"` y `strip`.
  Un pánico no imprime trazas con valores; `ratatui::init` instala un gancho que
  restaura el terminal antes de abortar. Sí puede producirse un **volcado de memoria**
  si el sistema lo permite (§3.8).

### 3.8 Memoria, swap e hibernación

**Qué se hace**:

- `Password` y `Key` implementan `Zeroize` + `ZeroizeOnDrop` (`src/crypto.rs`): se
  sobrescriben al salir de ámbito. La cadena hexadecimal para `PRAGMA key` es un
  `Zeroizing<String>` y se borra explícitamente tras usarla. `Debug` de ambos tipos
  imprime `<oculta>`.
- `PRAGMA cipher_memory_security = ON`: SQLCipher sobrescribe toda la memoria que
  libera, no sólo la de las operaciones criptográficas, a costa de algo de
  rendimiento.
- Al bloquear, la conexión se cierra y con ella la clave que SQLCipher conservaba.
- El bucle de eventos es bloqueante: no hay hilos auxiliares que conserven copias.

**Límites que el usuario debe conocer**:

1. **El campo de texto de la contraseña no está zeroizado.** `LineInput.value` es un
   `String` normal (`src/ui/widgets.rs`): al crecer puede realojarse y dejar copias
   en memoria liberada; al pulsar Retroceso se descarta el carácter sin sobrescribir.
   Al pulsar Intro, el búfer se mueve a un `Password` que sí se borra, pero las copias
   anteriores pueden sobrevivir en el montón hasta que algo las pise. Lo mismo ocurre
   con los diálogos de cambio de contraseña, que comparan con un `String` sin
   zeroizar. **Trabajo futuro**: búfer de capacidad fija con `Zeroizing`.
2. `zeroize` no puede borrar copias dejadas por movimientos de valores, derrames de
   registros a la pila ni realojamientos. El Argon2 trabaja sobre 32 MiB que la
   biblioteca libera sin garantía de sobrescritura. OpenSSL y SQLCipher mantienen
   sus propias copias de la clave mientras la conexión está abierta.
3. **Swap**: si el núcleo pagina a disco memoria del proceso, la clave o fragmentos
   de texto pueden quedar en la partición de swap **en claro**, y sobrevivir al
   apagado. antiX instala por defecto una swap sin cifrar (no verificado para el
   instalador de antiX 23). Remanso **no** llama a `mlock`.
4. **Suspensión a disco (hibernación)**: copia **toda** la RAM al disco, con o sin
   `mlock`. Una sesión abierta hibernada es una sesión abierta en el disco.
5. **Volcado de memoria**: con `panic = "abort"` un fallo genera `SIGABRT`; si
   `ulimit -c` no es 0, o si `core_pattern` es una tubería (ese caso ignora el
   límite), el núcleo escribe toda la memoria del proceso en un fichero.
6. **`/proc/<pid>/mem` y `ptrace`**: cualquier proceso **del mismo usuario** puede
   leer la memoria de Remanso si `kernel.yama.ptrace_scope` es 0 (valor por defecto
   de Debian/antiX: no verificado) o si no hay Yama. Remanso **no** llama a
   `prctl(PR_SET_DUMPABLE, 0)`, que cerraría tanto el volcado como el `ptrace` de
   procesos sin privilegios.

**Recomendaciones al usuario** (hasta que se implementen las medidas de abajo):

- Sin swap (`swapoff -a` y fuera de `/etc/fstab`), o **swap cifrada con clave
  aleatoria** por arranque: `/etc/crypttab` → `swap /dev/sdXN /dev/urandom
  swap,cipher=aes-xts-plain64,size=512`; `fstab` → `/dev/mapper/swap none swap sw`.
  Esto inutiliza la hibernación, que es lo deseable.
- Lanzar con `ulimit -c 0` en el *script* de arranque.
- `sysctl kernel.yama.ptrace_scope=1` como endurecimiento opcional.

**Trabajo futuro (no implementado en 0.1.0)**: `prctl(PR_SET_DUMPABLE, 0)` al
arrancar; `mlock` de la clave y del campo de contraseña; búfer de entrada zeroizado;
`setrlimit(RLIMIT_CORE, 0)` desde el propio binario.

### 3.9 Historial del terminal, multiplexores y pantalla

- Remanso dibuja en la **pantalla alternativa** del terminal (`ratatui::init` →
  `EnterAlternateScreen`) y la abandona al salir, así que en emuladores de terminal
  gráficos el contenido no queda en el historial de desplazamiento.
- **tmux/screen**: el multiplexor conserva en su propio historial lo que ha pasado por
  la ventana; `Ctrl+B [` permite retroceder y leer el diario después de cerrar la
  aplicación. **Advertencia explícita**: no usar Remanso dentro de tmux/screen, o
  configurar `set -g history-limit 0` y cerrar la ventana al terminar.
- **Consola Linux (fbcon)**: no hay pantalla alternativa; al salir, la última pantalla
  dibujada puede permanecer visible hasta que algo la sobrescriba (no verificado en
  consola real). El lanzador debería ejecutar `clear` tras la aplicación.
- Al teclear la contraseña se dibujan asteriscos (`password_feedback`, desactivable),
  que revelan la longitud a quien mira.
- La contraseña **nunca** se acepta por argumento ni entorno (`src/cli.rs`; test
  `never_accepts_password_flag`): no acaba en `~/.bash_history` ni en
  `/proc/<pid>/cmdline`. El *prompt* de línea de órdenes lee en modo crudo, sin eco.

### 3.10 Portapapeles

Remanso **no escribe nunca en el portapapeles**: ni crate de portapapeles ni OSC 52.
El pegado con corchetes de crossterm sólo recibe texto. Lo que el usuario copie con el
ratón desde el emulador es cosa del emulador.

### 3.11 Software malicioso y `root`: fuera de alcance

Se dice explícitamente: **Remanso no protege frente a un atacante que ya controla el
sistema** mientras la sesión está abierta, ni frente a `root` en ningún momento.

- `root` puede leer la memoria del proceso, instalar un registrador de teclas,
  sustituir el binario o modificar el núcleo. Ningún programa de usuario se defiende
  de eso.
- Un proceso malicioso del mismo usuario puede leer la memoria (§3.8), sustituir el
  binario en `~/.local/bin`, o interceptar la contraseña desde `~/.bashrc`.
- Un binario descargado de una fuente no fiable puede hacer cualquier cosa; la
  defensa es compilar desde el código fuente y revisar `dependencies.md`.

Lo que sí ofrece: el disco en reposo sigue cifrado, así que un malware con acceso
sólo a ficheros no obtiene más que lo descrito en §2.

### 3.12 Red

No hay. Ninguna dependencia de ejecución abre conexiones de red (verificación en
`dependencies.md`): sin telemetría, actualizaciones, sincronización ni comprobación
de versión.

## 4. Protege / No protege

| Escenario | Protege | No protege |
|---|---|---|
| Disco robado, equipo apagado | Contenido cifrado; sólo fuerza bruta contra Argon2id 32 MiB/t=3 | Metadatos: tamaño, fechas, parámetros KDF, tema, existencia y fecha de copias |
| Disco robado, equipo hibernado con sesión abierta | — | La RAM volcada a swap contiene la clave y texto |
| Alguien ante el equipo, sesión de Remanso bloqueada | Pantalla sin datos; hace falta la contraseña y rederivar | — |
| Alguien ante el equipo, sesión abierta | — | Acceso total hasta que venza el bloqueo (5–60 min o nunca) |
| Otro usuario del sistema sin privilegios | Permisos `0700`/`0600` en datos y copias | Memoria del proceso vía `ptrace`/`/proc` si `ptrace_scope=0`; exportaciones fuera del directorio de datos |
| `root` o malware con ejecución | — | Nada |
| Contraseña débil | Encarece cada intento ~10⁵–10⁶× | No evita que una contraseña de diccionario caiga en minutos |
| Contraseña olvidada | — | No hay recuperación posible, por diseño |
| Copia de seguridad en USB/nube | Cifrada igual que el original | Misma clave para siempre; metadatos en `manifest.json`/`kdf.json` |
| Exportación en claro | Sólo explícita y confirmada | Todo en claro, permisos de `umask`, títulos en nombres de fichero |
| Corte de luz o fallo | WAL + `synchronous=FULL`: nada confirmado se pierde | — |
| Manipulación del fichero | HMAC por página detecta cualquier alteración | No distingue corrupción accidental de malintencionada |
| Fallo de la aplicación | Sin trazas con contenido; terminal restaurado | Posible *core dump* si `ulimit -c > 0` o `core_pattern` es una tubería |
| Historial de terminal | Pantalla alternativa en emuladores gráficos | tmux/screen conservan todo; consola Linux: última pantalla visible (no verificado) |
| Portapapeles | Nunca se escribe | Lo que el usuario copie desde el emulador |
| Red | No existe ningún camino de red | — |
| Contraseña en historial de shell | Nunca se acepta por argumento ni entorno | — |

## 5. Qué verifican los tests

`cargo test` (2026-11-06): 74 tests, 0 fallos. Los relevantes para este documento:

- `storage::tests::file_is_not_plaintext`: tras insertar una frase secreta y cerrar,
  ni `remanso.db` ni `remanso.db-wal` contienen la frase ni la cabecera `SQLite format 3`.
- `storage::tests::create_open_and_wrong_password`: una contraseña errónea produce
  exactamente `DbError::WrongPassword`; la correcta abre y pasa `check()`.
- `storage::tests::change_password`: la contraseña antigua deja de abrir; la nueva
  conserva los datos.
- `storage::backup::tests::backup_restore_roundtrip`: la copia no contiene texto en
  claro; se verifica con la clave rederivada desde su `kdf.json`; restaurar con
  contraseña errónea falla; con la correcta recupera datos y búsqueda FTS.
  `refuses_non_empty_destination` y `rotation_keeps_newest` cubren destino no vacío y
  rotación.
- `storage::export::tests::exports_markdown_and_json`: estructura documentada, sin
  tablas FTS.
- `cli::tests::never_accepts_password_flag`: `--password x` se rechaza.
- `crypto::tests::*`: derivación determinista y sensible a sal y contraseña; sal
  imprimible; `kdf.json` sobrevive a guardar y leer.

No cubren: restos en memoria, swap, permisos reales de `-wal`/`-shm`, ausencia de
tráfico de red en ejecución (procedimiento manual en `dependencies.md`).
