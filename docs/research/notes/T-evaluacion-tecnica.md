# T — Evaluación técnica: TUI offline para Acer Aspire One con antiX Linux

**Fecha:** 2026-11-05 · **Autor:** ingeniería de sistemas/seguridad · **Tipo:** memo de investigación (sin código)

Alcance: hardware objetivo, sistema operativo, elección de stack TUI, almacenamiento cifrado, cross-compilation desde macOS arm64, metodología de medición y modelo de amenazas. Cada afirmación factual lleva URL en `## Referencias`; lo que no he podido verificar está marcado como **[NO verificado]** o **[estimación]**. Nota de método: el presupuesto de búsqueda web de la sesión se agotó a mitad del trabajo; el resto se completó con lecturas directas de páginas conocidas (man pages, docs.rs, GitHub, sqlite.org, zetetic.net). Los huecos resultantes se indican explícitamente.

---

## 1. Hardware: la familia Acer Aspire One

### 1.1 Modelos y CPUs

La tabla de Wikipedia [R1] agrupa la familia en tres generaciones Intel más una rama AMD:

| Generación | Modelos | CPU | x86-64 | RAM máx. (según [R1]) |
|---|---|---|---|---|
| Diamondville (2008-09) | A110, A150, ZG5, D150, D250, 531h | Atom **N270** (1,6 GHz) / **N280** (1,67 GHz) | **No** | D150: 2 GB; 531h: 2 GB; D250: 4 GB (dudoso, ver nota) |
| Silverthorne | 751h (ZA3) | Atom **Z520** (1,33 GHz) | **No** | 2 GB |
| Pineview (2010-11) | 532h, D255, D257, D260 | Atom N450, N455, N475, N550, N570 | Sí | 2 GB |
| Cedarview (2012) | D270 | Atom N2600 / N2800 | Sí (ver nota) | 2 GB |
| AMD | 521, 522, 721, 722 | Neo K125/V105, C-50/C-60 | Sí | 4-12 GB |
| Celeron/Pentium | 752, 753, 756 | Celeron M 743, Celeron M U3400, Celeron 877 / Pentium B987 | Sí | 4-16 GB |

Notas:

- El artículo de Wikipedia sobre Intel Atom afirma literalmente que "The Atom N2xx and Z5xx series Atom models cannot run x86-64 code" y que el soporte x86-64 llegó con Diamondville de sobremesa (230/330) y Pineview móvil [R2]. La lista de procesadores Atom marca Intel 64 en N450/N455/N470/N475/N550/N570/N2600/N2800 y no lo lista en N270/N280/Z520 [R3]. Las páginas de Intel ARK para N270/N450 ya no existen (redirigen a un 404), así que no he podido confirmarlo en fuente primaria de Intel; la triangulación Wikipedia + QEMU (abajo) es consistente.
- El modelo de CPU `n270` de QEMU (`target/i386/cpu.c`) está definido como familia 6, modelo 28, stepping 2, con `SSE3, MONITOR, SSSE3, MOVBE` en CPUID.1:ECX, `NX` en 80000001:EDX y **sin `LM` (long mode)** [R4]. Es la descripción más precisa y verificable del conjunto de instrucciones del N270: **i686 + SSE/SSE2/SSE3/SSSE3, sin SSE4.x, sin AVX, sin x86-64**.
- Microarquitectura Bonnell: Wikipedia la describe sin reordenación de instrucciones, sin ejecución especulativa y sin renombrado de registros, es decir, un núcleo **in-order** [R2]. Esto penaliza mucho el código con dependencias de memoria (KDFs, parsers) frente a cualquier CPU moderna del mismo GHz.
- RAM: los Aspire One basados en el chipset Intel 945GSE sólo admiten 2 GB y fallan el POST con módulos mayores [R1]. La cifra de 4 GB para el D250 en la tabla de Wikipedia es inconsistente con esa nota del mismo artículo; para planificar hay que asumir **1-2 GB DDR2** en los modelos N270/N280 y 1-2 GB DDR2/DDR3 en Pineview/Cedarview [R1, R3].
- Almacenamiento: los primeros A110 llevaban SSD de 8-16 GB; el resto HDD 2,5" de 120-500 GB a 5400 rpm [R1]. Para una app de diario esto implica latencias de disco altas en arranque frío (medirlo, §6).
- Pantalla: 1024×600 en los modelos de 10" (dato de catálogo, ver [R1]); en consola con fuente 8×16 son ~128×37 celdas. **[parcialmente verificado]**

### 1.2 Receta para que el usuario identifique su máquina (en antiX)

```sh
uname -m                       # i686 → kernel de 32 bits; x86_64 → kernel de 64 bits
getconf LONG_BIT               # 32 o 64 (del userland actual, no de la CPU)
lscpu | grep -E 'Model name|Flags|Architecture'
grep -m1 -oE '\b(lm|sse4_1|sse4_2|ssse3|sse3|pni|avx)\b' /proc/cpuinfo | sort -u
free -m                        # RAM total
cat /sys/class/graphics/fb0/virtual_size 2>/dev/null   # resolución del framebuffer
```

Interpretación: si **no** aparece `lm` en los flags, la CPU es sólo 32 bits (N270/N280/Z520). `pni` es el nombre que el kernel da a SSE3. Si aparece `lm` pero `uname -m` da `i686`, el usuario instaló antiX de 32 bits en una CPU de 64 (posible en Pineview/Cedarview).

### 1.3 Conclusión sobre targets Rust

- La página oficial de soporte de plataformas de Rust lista `i686-unknown-linux-gnu` como **Tier 1 con host tools** ("32-bit Linux (kernel 3.2+, glibc 2.17+, Pentium 4)") e `i686-unknown-linux-musl` como **Tier 2 sin host tools** (musl 1.2.5, Pentium 4). `x86_64-unknown-linux-musl` es Tier 2 con host tools. Existen además `i586-unknown-linux-{gnu,musl}` (Tier 2, "original Pentium", sin SSE2) [R5].
- Caveat 2025: el PR rust-lang/rust#135408 ("x86: use SSE2 to pass float and SIMD types"), fusionado en febrero de 2025 con milestone 1.87, hizo **SSE2 obligatorio** en los targets `i686` y cambió el ABI de retorno de `f64` a registros SSE [R6]. El propio spec del target advierte que x86 sin SSE2 "is *not* considered a Tier 1 target" por problemas de corrección en coma flotante x87 [R7]. El bug Debian #1095862 documenta que la baseline i386 de Debian (i686 sin SSE) es incompatible con esto y que upstream lo considera "unsound and unfixable" [R8]. **Para nosotros no es un problema**: el N270 tiene SSE2/SSE3/SSSE3, así que `i686-unknown-linux-*` con la baseline por defecto (`pentium4`) es correcto. No usar `i586-*`.
- La nota [1] de la página de plataformas recuerda que en `i686` los retornos en coma flotante del ABI C pasan por registros x87 y pueden perder bits de payload de NaN [R5]; irrelevante para una app de diario.
- Recomendación: compilar **`i686-unknown-linux-musl` como artefacto por defecto** (cubre todas las CPUs de la familia, incluidas las de 64 bits con kernel de 64 bits, que ejecutan binarios de 32 bits si el kernel tiene `CONFIG_IA32_EMULATION`, lo habitual) y **`x86_64-unknown-linux-musl` como segundo artefacto** para Pineview/Cedarview con antiX x64. No activar `-C target-cpu` por encima de `pentium4`; si se quiere afinar para Bonnell, LLVM tiene el nombre de CPU `bonnell`/`atom`, pero no he verificado su efecto real sobre el scheduling in-order **[NO verificado]**; medir antes de usarlo.

---

## 2. antiX Linux

### 2.1 Base, init y ediciones

- antiX 23 ("Arditi del Popolo") se basa en **Debian 12 Bookworm**, sin systemd ni libsystemd0, sin elogind, con **eudev**, y se ofrece con **sysVinit o runit** en ISOs de 32 y 64 bits, en cuatro ediciones (full, base, core, net). Kernels: 5.10 "legacy" y 6.1 "modern" (6.1 por defecto tras instalar la edición x64 full) [R9, R10, R11]. antiX 23.1 y 23.2 son correcciones sobre la misma base [R12].
- glibc: Debian bookworm lleva **libc6 2.36-9+deb12u14**, con arquitectura i386 disponible [R13]. Para antiX 19 (base Buster) la glibc sería 2.28; bullseye 2.31; trixie 2.41 [R14]. Que antiX 19 se base en Buster lo sé de memoria y **no lo he verificado** en esta sesión (el sitio antixlinux.com rechazó conexiones durante la investigación).
- Terminal por defecto en X: antiX usa roxterm/urxvt según edición **[NO verificado]**. Para nuestro caso es secundario: el objetivo es la consola.

### 2.2 Arrancar a TTY sin X

- Un hilo del foro de antiX indica que el bootcode **`3`** mantiene el sistema en modo línea de comandos (equivalente a runlevel 3 de sysVinit, en antiX X arranca desde el runlevel por defecto 5 vía slim/slimski) [R15]. La documentación oficial de boot menu (antiX 13) no lista un código explícito de "texto", pero sí `desktop=`, `disable=`, `lean/mean/Xtralean`, `nomodeset`, `xorg=safe`, `vga=` [R16]. Un post del foro de DSL (2024) advierte de un bug en la variante **runit** que no permitía arrancar directamente a tty [R17]; no sé si está corregido → **validar en la ISO runit actual**.
- Recomendación práctica: instalar la edición **sysVinit** (comportamiento de `/etc/inittab` clásico y mejor documentado) y fijar `id:3:initdefault:`.

### 2.3 Autologin y autolanzado en tty1

- `agetty -a/--autologin <usuario>` "Automatically log in the specified user without asking for a username or password", añadiendo `-f usuario` a `/bin/login` [R18]. Con sysVinit la línea de `/etc/inittab` es del estilo `1:2345:respawn:/sbin/agetty --autologin <usuario> --noclear 38400 tty1 linux` (forma documentada por Gentoo y Alpine; Alpine advierte que cualquiera que arranque la máquina accede a la cuenta) [R19, R20]. Para runit hay ejemplos en el foro de Devuan (`chpst` + `agetty -a`) pero no documentación oficial [R21].
- Lanzar la app: en `~/.bash_profile`, condicionar a `tty1` y hacer `exec <app>` para que al salir vuelva al login; **sin `exec`** si se quiere caer a una shell (patrón discutido en foros de Arch para `startx`) [R22]. Alternativa más robusta: definir la propia app como comando de login (`-l`), pero entonces la shell de rescate desaparece.
- Seguridad: el autologin reduce la autenticación del sistema a la clave de la app (§4, §7). Es aceptable sólo porque el disco contendrá la base de datos cifrada y la máquina es de un único usuario.

### 2.4 Consola Linux (fbcon): glifos, Unicode y colores

- **Glifos**: `setfont(8)` explica que el hardware VGA usa el bit de intensidad o para brillo o para direccionar 512 glifos; con una fuente de más de 256 glifos "the console will be reduced to 8 (instead of 16) colors" [R23]. La consola es por tanto **≤256 glifos con 16 colores, o ≤512 glifos con 8 colores**. Una propuesta en LKML (febrero 2025) añade un modo de 24 bits para superar 256/512 glifos en fbcon; es un parche propuesto, no confirmado como fusionado [R24]. Las fuentes de fbcon se compilan en el kernel y se eligen con `fbcon=font:`; en userland se cargan PSF con `setfont` desde `/usr/share/consolefonts` [R25, R23].
- **Consecuencia para la UI**: con Terminus/Lat15 de 256 glifos tenemos ASCII, Latin-1/Latin-9 (castellano/catalán completos), y un subconjunto de box-drawing (los glifos de línea están además en posiciones fijas que espera el hardware [R23]). **Fallarán**: emoji, CJK, braille (U+2800-28FF, usado por sparklines de ratatui), bloques finos (▁▂▃…) salvo que la fuente los incluya, y la mayoría de símbolos de Nerd Fonts. La app debe tener un **modo "ASCII/VGA"** con verificación al inicio (ej. probar `TERM=linux` y leer la tabla Unicode cargada con `showconsolefont`/`psfgettable`) y usar sólo `─│┌┐└┘├┤┬┴┼═║` y bloques `█▓▒░` que sí están en las fuentes estándar.
- **Modo UTF-8**: la consola conmuta con `ESC % G`; en UTF-8 ensambla códigos de 16 bits [R26]. Debian/antiX arrancan en UTF-8 por defecto (unicode_start) **[NO verificado para antiX]**.
- **Colores**: `console_codes(4)` documenta SGR 30-37/40-47, 90-97 para fondo brillante **no** ("bright not supported" en 100-107), y que las secuencias 256-color `38;5;n` y 24-bit `38;2;r;g;b` se aceptan pero se "shoehorn" a los **16 colores básicos** (primer plano) y **8** (fondo). La paleta de 16 entradas sí es redefinible con `ESC ] P nrrggbb` [R26]. Un commit de systemd fecha el soporte de parseo 256-color en el kernel 3.16 [R27]. Conclusión: diseñar la paleta de la app para **16 colores de frente / 8 de fondo**, con un tema propio cargado vía `ESC ] P` si se quiere estética (y restaurarlo con `ESC ] R` al salir). Terminfo: la entrada `linux` declara `colors#8` y existe `linux-16color` **[NO verificado: no pude leer la sección de terminfo.src]**; en cualquier caso crossterm no usa terminfo, emite ANSI directamente.
- **Scrollback**: Linus Torvalds eliminó el "soft scrollback" de fbcon ("fbcon: remove soft scrollback code") por casos especiales inmantenibles [R28]; esto ocurrió en 5.9 según mi memoria **[NO verificado]**. Para la app es incluso una ventaja (menos texto residual en pantalla, §7).

### 2.5 Alternativas a fbcon

| Opción | Pros | Contras |
|---|---|---|
| **fbcon + fuente PSF** | 0 RAM extra, 0 dependencias, arranque inmediato | 256/512 glifos, 16/8 colores |
| **kmscon** (upstream reactivado en 2025 tras 11 años en el fork de Aetf) | backends fbdev/drm2d/drm3d; fuentes 8x16, Unifont, PSF, FreeType, Pango; teclado vía libxkbcommon [R29, R30] | depende de libtsm, libudev, libxkbcommon; estado de paquetes en Debian bookworm desconocido; RAM/CPU no documentados |
| **fbterm** 1.7 | fontconfig + freetype, fallback entre fuentes, CJK [R31] | proyecto antiguo sin mantenimiento aparente |
| **yaft** | UTF-8, 256 colores, sixel, fuentes BDF compiladas (mplus, unifont, terminus…) [R32] | última actualización del README 2018; glifos fijados en compilación |
| **X mínimo + xterm/st/urxvt** | Unicode completo, truecolor en st/urxvt | arranque de Xorg + WM: decenas de MB y segundos en un Atom; alacritty **requiere OpenGL ES 2.0** [R33], inviable en GMA 950 |

No he encontrado cifras publicadas y comparables de RSS de xterm/st/urxvt **[NO verificado]**; hay que medirlas (§6). Mi recomendación: **fbcon como objetivo primario**, kmscon/yaft como experimento si el modo ASCII resulta pobre.

---

## 3. Comparativa de stacks TUI

### 3.1 Rust + ratatui + crossterm

- **Estado**: ratatui **0.30.2** (2026-06-19), MSRV **1.88.0**. Desde 0.30 el proyecto está dividido en crates: `ratatui-core` (0.1.x, API estable para autores de widgets), `ratatui-widgets`, backends `ratatui-crossterm`, `ratatui-termion`, `ratatui-termwiz`, `ratatui-termina`, y `ratatui-macros`; el crate `ratatui` los reexporta [R34, R35, R36]. Features por defecto: `crossterm`, `layout-cache`, `macros`, `underline-color`, `all-widgets` (`widget-calendar`) [R37]; crossterm pinneado a 0.29 y termion a 4 [R36].
- **Render**: inmediate-mode con **doble buffer**; `Terminal::draw` dibuja en un `Buffer`, `flush()` compara con el buffer anterior y **escribe sólo las celdas que cambian**, luego intercambia buffers [R38]. En una consola de 128×37 celdas sobre un Atom, esto es lo que hace viable repintar a 10-30 fps sin saturar el TTY.
- **Eventos**: en Unix crossterm usa `mio` (epoll) con tres tokens: TTY, señal (`SIGWINCH` vía `signal_hook_mio`) y waker; `poll(timeout)` **bloquea en epoll**, reintenta en `EINTR` respetando el tiempo restante, y al recibir `SIGWINCH` consulta el tamaño y emite `Event::Resize` [R39, R40]. Dos avisos del propio código: `terminal::size()` puede lanzar `tput` (lento) y el bucle de lectura no trata explícitamente `read()==0` (EOF) [R40]. **No hay busy-loop**: la app puede dormir en `event::poll(Duration::from_secs(N))` y despertar sólo por teclado, resize o un temporizador grueso. En `TERM=linux` no hay eventos de ratón ni de foco salvo que se active gpm.
- **Tamaño de binario**: no existe una cifra publicada para un "hello world" de ratatui **[NO verificado]**. El Rust Performance Book documenta `opt-level="z"/"s"`, LTO fat/thin, `codegen-units=1`, `panic="abort"` y `strip`; una guía advierte que `"s"` a veces produce binarios más pequeños que `"z"` [R41, R42]. **Estimación propia, a medir**: 1-2 MiB para ratatui+crossterm estático en musl; +1,5-3 MiB al añadir SQLite/SQLCipher bundled; +2-4 MiB si OpenSSL va vendored (por eso §4 propone libtomcrypt o `-lcrypto` estático podado). En un HDD de 5400 rpm, 5-8 MiB se cargan en <0,2 s en frío; no es el cuello de botella.
- **RSS**: sin cifras publicadas comparables **[NO verificado]**. Un post de DEV Community afirma, sin metodología ni absolutos, 30-40 % menos memoria y 15 % menos CPU que Bubbletea en un dashboard [R43]; anecdótico. Objetivo realista a validar: **< 20 MiB RSS** con la DB abierta (el page cache de SQLite por defecto ~2 MiB; Argon2 añade 19-64 MiB sólo durante la derivación).
- **Dependencias**: ratatui (core+widgets+crossterm) arrastra del orden de 30-45 crates (mio, signal-hook, libc, unicode-width, unicode-segmentation, itertools, strum, etc.) **[estimación; contar con `cargo tree`]**.

### 3.2 Rust + termion

Termion 4 es backend soportado por ratatui pero **excluido del workspace por defecto porque no compila en Windows** [R36]. Sus dependencias directas son `libc` y `libredox` (en 2.0.3) [R44]; es más ligero que crossterm pero su detección de resize y su parser de teclas son menos completos, y la comunidad se ha concentrado en crossterm. Sólo tiene sentido si la medición muestra que crossterm pesa de forma apreciable, lo cual dudo.

### 3.3 C + ncurses

Madurez máxima, RSS históricamente de pocos MiB **[NO verificado con cifra]**, y la consola Linux es su hábitat natural (terminfo `linux`). Contras para este proyecto: gestión de memoria y strings manual en una app que maneja secretos (zeroize es trivial en Rust, artesanal en C), FTS y cifrado requieren más pegamento, y el soporte Unicode (`ncursesw`) es correcto pero el ancho de celdas depende de `wcwidth` de la libc.

### 3.4 C++ FTXUI

"No dependencies", UTF-8 y caracteres fullwidth, plataformas Linux/macOS/Windows/WASM [R45]. Diseño declarativo agradable, pero sin ecosistema de cifrado/SQLite comparable al de Rust y con los mismos problemas de gestión de secretos que C.

### 3.5 Go (Bubbletea), Zig, Nim

Go: runtime con GC y goroutines; las cifras de 15-30 MiB RSS que se citan habitualmente para TUIs Go **no las he podido verificar** en esta sesión **[NO verificado]**. Go sigue soportando `GOARCH=386` pero su recolector introduce picos de CPU periódicos indeseables en un Atom in-order. Zig/Nim: ecosistema TUI inmaduro; descartados por riesgo de mantenimiento.

---

## 4. Almacenamiento y cifrado

### 4.1 rusqlite + SQLCipher

- `libsqlite3-sys` **0.39.1** (2026-10-25, rusqlite 0.41) bundlea **SQLite 3.54.0** y depende de `sqlcipher-src =419.0.6` [R46]. El crate `sqlcipher-src` más reciente (420.0.0) bundlea **SQLCipher 4.20.0 + SQLite 3.54.1 + libtomcrypt 1.18.2** [R47]. SQLCipher 4.20.0 es del 27-10-2026; la rama 5.0.0-beta (AES-256-GCM, arquitectura de codecs, incompatible con v4 por defecto) está en beta [R48]. **Quedarse en 4.x**.
- **Backend criptográfico según `build.rs`**: con `bundled-sqlcipher`, si no hay `OPENSSL_DIR`/`OPENSSL_LIB_DIR` definidos, en Apple se compila con `-DSQLCIPHER_CRYPTO_CC` y se enlazan los frameworks Security/CoreFoundation; en Windows falla; en **Linux emite `cargo:rustc-link-lib=dylib=crypto`**, es decir, enlaza **dinámicamente con la libcrypto de OpenSSL del sistema** (sin pkg-config). Con `bundled-sqlcipher-vendored-openssl` se usa `openssl-sys` con `vendored` y OpenSSL se compila y enlaza estáticamente [R49, R46]. La ruta libtomcrypt existe en el amalgama de `sqlcipher-src` (se usa cuando no hay libcrypto, p. ej. wasm) [R47] y SQLCipher 4.14.0 reincorporó el provider LibTomCrypt [R48], pero el `build.rs` de libsqlite3-sys **no expone una feature para elegirlo** [R49]. Flags relevantes: `SQLITE_HAS_CODEC`, `SQLITE_TEMP_STORE=2`, y en todos los bundled **`SQLITE_ENABLE_FTS5`**, FTS3, JSON1, RTREE [R49].
- **Implicación para i686-musl**: la única opción estática "de serie" es `bundled-sqlcipher-vendored-openssl`. `openssl-src` (400.0.2+4.0.3, OpenSSL 4.0.x) mapea `i686-unknown-linux-musl` a `linux-elf` y en musl desactiva engine y async, elimina `-static` de los CFLAGS y define `OPENSSL_NO_SECURE_MEMORY` [R50]. Es decir, **debería compilar**, pero (a) pierde el `secure heap` de OpenSSL, (b) añade minutos de compilación y varios MiB de binario, y (c) no está en el CI de `cross` para i686-musl **[NO verificado que esté probado]**. Alternativa a evaluar: compilar libcrypto estática propia recortada (`no-shared`, `no-*` masivo) y pasar `OPENSSL_DIR`. **Riesgo abierto nº 1: validar la compilación `bundled-sqlcipher-vendored-openssl` para `i686-unknown-linux-musl` en la primera semana.**
- **Defaults SQLCipher 4** (verificados): AES-256-CBC; KDF **PBKDF2-HMAC-SHA512 con 256.000 iteraciones**; HMAC-SHA512 por página (clave HMAC derivada con PBKDF2 de 2 iteraciones y salt variante); página de **4096 bytes**; salt aleatorio de 16 bytes en los primeros 16 bytes del fichero; IV aleatorio por página regenerado en cada escritura [R51, R52].
- **Clave en crudo**: `PRAGMA key = "x'<64 hex>'"` usa los 32 bytes directamente **sin derivación**; con 96 hex los 32 últimos son el salt suministrado por la app [R52]. Zetetic recomienda precisamente la clave raw para evitar el coste de PBKDF2 en cada apertura [R53]. Patrón propuesto: **Argon2id(passphrase, salt_app) → 32 bytes → `PRAGMA key = x'…'`**, con el salt de Argon2 guardado en un fichero lateral o en el header. Esto sustituye PBKDF2 (GPU-friendly) por un KDF memory-hard y mantiene todo el cifrado de páginas de SQLCipher.
- `PRAGMA cipher_memory_security`: desactivado por defecto desde 4.5.0 por coste; SQLCipher siempre sanitiza la memoria de las operaciones criptográficas, el PRAGMA extiende el wipe a todas las asignaciones [R52, R53]. En un Atom hay que **medir** antes de activarlo.
- **WAL**: el documento de diseño afirma que con `PRAGMA journal_mode = WAL` las páginas del fichero `-wal` se cifran con la clave de la DB [R51]. Orden obligatorio: `PRAGMA key` antes de cualquier otro PRAGMA, incluido `journal_mode` [R54]. Un informe de usuario (SQLCipher 3.4.0) de "disk image malformed" tras `sqlcipher_export` con ficheros `-wal/-shm` residuales recomienda hacer export en modo DELETE [R55].
- **FTS5**: soportado por SQLCipher desde 3.4.0 [R56] y compilado por libsqlite3-sys [R49]. Las tablas FTS5 son tablas virtuales cuyas tablas sombra viven en el mismo fichero, por lo que **quedan cifradas a nivel de página como el resto**; no he encontrado una declaración explícita de Zetetic sobre FTS5+cifrado **[inferencia razonable, verificar con `hexdump` del fichero como sugiere el propio doc de diseño]**.
- Overhead: Zetetic cita 5-15 % en escenarios típicos; recomienda una única conexión abierta durante la vida de la app para no repetir la derivación [R53].

### 4.2 Argon2id: parámetros y coste en un Atom

- OWASP (Password Storage Cheat Sheet) lista cinco configuraciones equivalentes: **m=47104 (46 MiB), t=1, p=1**; **m=19456 (19 MiB), t=2, p=1**; m=12288 (12 MiB), t=3; m=9216, t=4; m=7168, t=5 [R57]. RFC 9106 §4 recomienda **t=1, p=4, m=2 GiB** como primera opción y **t=3, p=4, m=64 MiB** como segunda, salt 128 bits, tag 256 bits, y un procedimiento: fijar m y p, subir t hasta agotar el presupuesto de tiempo [R58].
- Datos de tiempo disponibles: en un i5-9300HF, Argon2id 64 MiB, t=3, p=1 tarda **0,178 s**; 128 MiB 0,370 s; 256 MiB 0,741 s [R59]. Un hilo de Bitwarden mide que Argon2 satura a ~5,4-5,8 GB/s de ancho de banda efectivo en un i7-4500 [R60]; una regla aproximada de un blog divide el ancho de banda entre 4×m [R61].
- **Extrapolación al Atom N270 [estimación, no medida]**: núcleo in-order a 1,6 GHz con un solo canal DDR2-533 (~4,3 GB/s teóricos en 945GSE **[NO verificado]**) y BLAKE2b sin SIMD útil. Esperaría un factor 10-20× respecto al i5-9300HF: **64 MiB/t=3 ≈ 2-4 s; 19 MiB/t=2 ≈ 0,5-1 s; 46 MiB/t=1 ≈ 0,7-1,5 s**. Con 1-2 GB de RAM, 64 MiB es asumible; p=4 no ayuda en un núcleo con 2 hilos SMT. Propuesta: **Argon2id m=64 MiB, t=3, p=1** como objetivo si la medición en hardware real queda por debajo de ~3 s en el desbloqueo (una vez por sesión); si no, caer a m=46 MiB, t=1 (OWASP). Mostrar un indicador de progreso durante la derivación. **Riesgo abierto nº 2: medir Argon2 en el Atom real antes de fijar parámetros.**

### 4.3 Alternativas a SQLCipher

- **Fichero cifrado con age/ChaCha20-Poly1305 + formato propio**: obliga a leer/escribir el fichero completo (o a inventar un formato paginado con AEAD por bloque, MAC de árbol, journaling y recuperación ante corte de luz). Es reimplementar lo que SQLCipher ya hace (acceso aleatorio por página, transacciones atómicas, WAL). Más trabajo y más riesgo. Descartado salvo para exportaciones/backups (ahí sí encaja un `age`-like).
- **libsql / Turso**: libsql tiene `encryption` como feature opcional que requiere cmake; Turso Database (reescritura en Rust) está en beta, "not production ready", con cifrado detrás de `--experimental-encryption` [R62, R63]. Descartado hoy; revisar en 2027.
- **Durabilidad**: `pragma.html` establece que con WAL + `synchronous=NORMAL` la DB **siempre es consistente** pero una transacción confirmada **puede deshacerse** tras un corte de energía; con FULL es ACID en WAL; y "transactions are durable across application crashes regardless of the synchronous setting" [R64, R65]. En un netbook con batería el riesgo de corte es bajo; propongo **WAL + NORMAL** por defecto y un `PRAGMA wal_checkpoint(TRUNCATE)` al guardar explícitamente y al cerrar, con opción `FULL` en ajustes. WAL necesita el fichero `-shm` mmapeado y no funciona en sistemas de ficheros de red [R64]; irrelevante en local.

---

## 5. Cross-compilation desde macOS arm64

| Vía | Qué aporta | Caveats verificados |
|---|---|---|
| **`cross`** (Docker) | Imágenes para `i686-unknown-linux-gnu` (libc **2.39**, GCC 13.3) e `i686-unknown-linux-musl` (musl 1.2.5, GCC 14.4); MSRV 1.85 [R66] | La imagen gnu enlaza contra **glibc 2.39 > 2.36 de bookworm**: un binario dinámico de ahí puede exigir símbolos `GLIBC_2.38/2.39` inexistentes en antiX 23 → sólo sirve la variante **musl**. En macOS la FAQ recomienda Docker (no Podman/Lima) y registrar binfmt (`tonistiigi/binfmt --install all`) para imágenes amd64 en host arm64 [R67]; emulación lenta. |
| **`cargo-zigbuild`** | Linker Zig nativo en macOS, sin Docker; permite fijar glibc con sufijo (`x86_64-unknown-linux-gnu.2.17`; por defecto 2.28 en Zig 0.12-0.14); recomienda `*-musl` para estático [R68] | Usa `-nostdinc`: los crates `cc` (SQLite, OpenSSL) pueden no encontrar cabeceras → `CFLAGS`/`CMAKE_TOOLCHAIN_FILE` manuales; **no menciona i686** explícitamente **[verificar]**; OpenSSL vendored con Zig es la parte más frágil. |
| **Docker `i386/debian:bookworm`** | Imagen oficial existente [R69]; glibc idéntica a antiX 23; `apt install libssl-dev` y compilar nativo (emulado) con `bundled-sqlcipher` enlazando `-lcrypto` del sistema | Emulación qemu-user de i386 sobre arm64: compilaciones muy lentas; el binario resultante depende de la libssl3 de Debian 12 (bien si el usuario mantiene antiX 23; mal si cambia). |

**Recomendación**: `i686-unknown-linux-musl` **estático** vía `cross` (y `x86_64-unknown-linux-musl` igual), con OpenSSL vendored (o libcrypto estática propia). Esto elimina por completo el problema de versiones de glibc entre antiX 19/21/23 (2.28/2.31/2.36 [R14]) y hace que el binario sea un único fichero copiable por USB. Caveat musl: su `malloc` sufre contención en workloads multihilo (Tweag midió hasta 20× en wasmtime y lo arregló incrustando mimalloc en libc.a) [R70]; nuestra app es esencialmente monohilo (UI + SQLite + un hilo para Argon2), así que **no añadir mimalloc** salvo que la medición lo exija. Para pruebas de ejecución en el Mac: contenedor `i386/debian:bookworm` o QEMU (§6).

---

## 6. Metodología de medición

Todo lo que sigue debe ejecutarse **en el netbook real** además de en emulación; Docker con `--cpus=0.3 --memory=512m` limita cuota y RAM pero **no modela** un núcleo in-order sin SSE4 ni la latencia de DDR2.

- **Arranque frío/caliente**: `hyperfine` ejecuta ≥10 runs, soporta `--warmup N` (caché caliente) y `--prepare 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches'` antes de cada run (caché fría), con exportación JSON/CSV y detección de outliers [R71]. Medir "tiempo hasta primer frame" instrumentando la app (timestamp en `main` y tras el primer `draw`) y "tiempo hasta desbloqueo" (Argon2 + `PRAGMA key` + primera consulta).
- **CPU**: `perf stat -p <PID> -- sleep 60` (`-p` "stat events on existing process id") y `-r N` para repetir con media y desviación [R72]; `task-clock` da los ms de CPU consumidos. Complementar con `top -d 10 -p PID` y `strace -c -p PID -f` durante 60 s en reposo: el objetivo es **0 syscalls salvo el `epoll_wait` que expira**, lo que confirma que crossterm no hace busy-loop (§3.1). Nota: `perf` puede no estar empaquetado para el kernel de antiX; alternativa `/proc/<pid>/stat` (campos utime/stime) muestreado.
- **Memoria**: `/proc/<pid>/status` expone `VmRSS` (= RssAnon + RssFile + RssShmem), `VmHWM` (pico), `VmSwap` y `VmLck` (memoria bloqueada con mlock) [R73]; el propio man avisa de que son valores aproximados. `ps -o rss,vsz` y `smem` (PSS/USS) para comparar con xterm/kmscon si se evalúan.
- **Emulación del Atom**: `qemu-system-i386 -cpu n270 -m 1024 -smp 1` expone exactamente el conjunto SSE3/SSSE3/MOVBE sin LM que define QEMU [R4]; añadir `,enforce` para que falle si TCG no puede ofrecer algún flag (TCG avisa de flags no soportados [R74]). Sirve para validar que el binario **no usa instrucciones ilegales** (SIGILL) y para pruebas funcionales en antiX de 32 bits; **no** sirve para tiempos absolutos (TCG es mucho más lento y no in-order). antiX publica ISOs de 32 bits (386) para 23.x [R9, R10] **[la página de descarga no pudo leerse en esta sesión]**.
- **Consola**: probar la app en `TERM=linux` real (tty1), no sólo en `xterm`; comprobar fuente cargada (`setfont -v`, `showconsolefont`) y modo UTF-8.
- **Compilación**: comparar `opt-level = "s"` vs `"z"` con `lto = "fat"`, `codegen-units = 1`, `panic = "abort"`, `strip = true` y reportar tamaño + tiempo de arranque de cada variante [R41, R42].

---

## 7. Modelo de amenazas en Linux (notas de implementación)

Adversario principal: acceso físico al netbook apagado o robado (disco sin cifrar). Secundario: otro proceso del mismo usuario, o residuos en swap/core/scrollback.

- **Swap**: antiX instala una partición swap sin cifrar por defecto **[NO verificado para el instalador de antiX 23]**. `mlock(2)` mantiene las páginas en RAM, pero el man advierte que **suspend-to-disk copia toda la RAM al disco "regardless of memory locks"** y que el límite `RLIMIT_MEMLOCK` acota lo que un proceso sin `CAP_IPC_LOCK` puede bloquear [R75, R76]; el valor por defecto (64 KiB antiguo / 8 MiB en kernels recientes) **no lo he verificado**: comprobar con `ulimit -l`. Medidas, de más a menos simple: (1) **desactivar swap** (con 2 GB y una app de <50 MiB es viable) o `vm.swappiness=0`; (2) **swap cifrada con clave aleatoria**: `crypttab` con `/dev/urandom` como keyfile y `swap,cipher=aes-xts-plain64,size=512` (plain dm-crypt, clave descartada al apagar; no usar `/dev/random` por riesgo de bloqueo de arranque) [R77, R78]; (3) `mlock` sólo de la clave y buffers de Argon2 (64 MiB superaría el límite por defecto; SQLCipher ya hace mlock de sus buffers "cuando puede" [R51]). Recomendar al usuario (1)+(2) en la guía de instalación y deshabilitar la hibernación.
- **Core dumps**: `core(5)`: no se genera volcado si `RLIMIT_CORE` es 0, pero **ese límite no se aplica si `core_pattern` es una tubería** (p. ej. `|/usr/lib/systemd/systemd-coredump`, inexistente en antiX pero posible con otros handlers); el flag dumpable sí lo impide [R79]. Por tanto la app debe llamar a **`prctl(PR_SET_DUMPABLE, 0)`** al inicio: desactiva el core dump, impide `PTRACE_ATTACH` y cambia la propiedad de `/proc/<pid>/*` [R80]. Complementar con `ulimit -c 0` en el lanzador.
- **`/proc/<pid>/mem` y ptrace del mismo usuario**: el acceso a `/proc/pid/mem` está gobernado por `PTRACE_MODE_ATTACH_FSCREDS` [R81]; con Yama `ptrace_scope=0` cualquier proceso del mismo UID puede adjuntarse a un proceso **dumpable**; con 1 sólo descendientes; 2 sólo `CAP_SYS_PTRACE`; 3 nadie [R82]. El valor por defecto de Debian/antiX **no lo he verificado**. Con `PR_SET_DUMPABLE=0` la app queda protegida frente a procesos del mismo usuario en modo 0 (no frente a root). Documentar `kernel.yama.ptrace_scope=1` como hardening opcional.
- **Scrollback y pantalla**: fbcon ya no tiene scrollback blando [R28], así que al salir basta limpiar pantalla (`ESC [2J`, `ESC c`) y restaurar paleta. Si el usuario corre la app dentro de tmux/screen, el historial del multiplexor sí retiene lo mostrado: desaconsejar tmux o documentar `history-limit 0`. Un bloqueo automático por inactividad (re-pedir passphrase, borrar buffers de ratatui) mitiga el shoulder-surfing.
- **`~/.bash_history`**: la app no debe aceptar la passphrase por argumento de línea de comandos ni variable de entorno (aparecerían en `/proc/<pid>/cmdline`/`environ` y en el history); sólo por prompt propio en raw mode.
- **Material de clave en memoria**: `zeroize` 1.9.1 usa `write_volatile` + fences, sin dependencias, MSRV 1.85; **no** puede borrar copias dejadas por moves, spills de pila o reasignaciones de `Vec`/`String` (dimensionar buffers de antemano y evitar realloc), y declara `mlock`/`mprotect` fuera de alcance; recomienda `ZeroizeOnDrop` sobre `Zeroize` manual para evitar use-after-zeroize [R83]. `secrecy` 0.10.3 (`SecretBox`, `SecretString`, `ExposeSecret`) envuelve el acceso explícito y borra al soltar usando zeroize [R84]. Patrón: passphrase → `SecretString` (capacidad fija) → Argon2 → `Zeroizing<[u8;32]>` → hex para `PRAGMA key` también en `Zeroizing<String>` → drop inmediato. Advertir de que la libc/OpenSSL/SQLCipher tienen sus propias copias (SQLCipher las sanitiza [R51]); `cipher_memory_security=ON` extiende el wipe a coste de rendimiento [R52].
- **Fichero de DB**: permisos 0600 en el directorio de datos; el header SQLCipher es opaco (salt en los 16 primeros bytes) y el fichero no es reconocible como SQLite sin `cipher_plaintext_header_size`, que **no** debemos usar [R52].

---

## 8. Recomendación

**Stack**: **Rust (MSRV ≥ 1.88) + ratatui 0.30 + crossterm 0.29 + rusqlite/libsqlite3-sys con `bundled-sqlcipher-vendored-openssl` + argon2 + zeroize/secrecy**, compilado como **binarios estáticos `i686-unknown-linux-musl` (por defecto) y `x86_64-unknown-linux-musl`**, con `-C target-cpu=pentium4` implícito (nunca superior), perfil release `opt-level="s"` (comparar con `"z"`), `lto="fat"`, `codegen-units=1`, `panic="abort"`, `strip=true`. Ejecución objetivo: **tty1 con fbcon**, `TERM=linux`, autologin sysVinit con `agetty --autologin` y `exec` desde `.bash_profile`; modo de dibujo "VGA-safe" (16 colores de frente/8 de fondo, sólo box-drawing simple/doble y bloques `█▓▒░`) activado por defecto cuando `TERM=linux`.

**Por qué**:
1. Es el único stack entre los comparados que combina tier 1/2 oficial para i686, cero GC, control de memoria para secretos, render por diff y un ecosistema de cifrado (SQLCipher 4, Argon2, zeroize) maduro y auditable [R5, R38, R46-R53, R83].
2. SQLCipher da acceso aleatorio por página, transacciones atómicas, WAL cifrado y FTS5 dentro del mismo fichero cifrado; un formato propio reproduciría todo eso con más riesgo [R51, R56, R64].
3. musl estático neutraliza la dispersión de glibc entre versiones de antiX (2.28 → 2.36) y el problema de que la imagen gnu de `cross` enlace contra glibc 2.39 [R14, R66].

**Riesgos abiertos que deben validarse con medición (orden de prioridad)**:
1. **Compilación de `bundled-sqlcipher-vendored-openssl` para `i686-unknown-linux-musl`** (OpenSSL 4.x vendored en musl 32 bits no está en el CI de cross) y su impacto en tamaño/arranque; plan B: libcrypto estática recortada vía `OPENSSL_DIR`, plan C: exponer el provider libtomcrypt del amalgama.
2. **Tiempo de Argon2id en el Atom real** (objetivo < 3 s para m=64 MiB/t=3/p=1; fallback OWASP m=46 MiB/t=1).
3. **Cobertura de glifos y 16 colores en fbcon** con la fuente que antiX carga por defecto; decidir si kmscon/yaft merecen el coste.
4. **Arranque a tty con autologin en la variante runit** (bug reportado en 2024) — por defecto recomendar sysVinit.
5. **RSS y CPU en reposo** (< 20 MiB; 0 wakeups salvo timer) y arranque frío en HDD 5400 rpm (< 2 s hasta prompt de passphrase).
6. **`cipher_memory_security=ON`** y `mlock` de buffers: coste medible en un in-order; decidir tras medir.
7. Confirmar en el instalador de antiX 23 si crea swap sin cifrar y documentar swap cifrada con clave aleatoria o sin swap.

---

## Referencias

- [R1] Acer Aspire One — Wikipedia. URL: https://en.wikipedia.org/wiki/Acer_Aspire_One · Verificado: sí (tabla de modelos leída).
- [R2] Intel Atom — Wikipedia (N2xx/Z5xx sin x86-64; Bonnell). URL: https://en.wikipedia.org/wiki/Intel_Atom · Verificado: sí.
- [R3] List of Intel Atom processors — Wikipedia. URL: https://en.wikipedia.org/wiki/List_of_Intel_Atom_processors · Verificado: sí (primeros 100k caracteres; artículo con aviso de exactitud).
- [R4] QEMU `target/i386/cpu.c`, definición `n270`. URL: https://raw.githubusercontent.com/qemu/qemu/master/target/i386/cpu.c · Verificado: sí.
- [R5] Rust Platform Support. URL: https://doc.rust-lang.org/nightly/rustc/platform-support.html · Verificado: sí.
- [R6] rust-lang/rust PR #135408 "x86: use SSE2 to pass float and SIMD types". URL: https://github.com/rust-lang/rust/pull/135408 · Verificado: sí.
- [R7] rustc target spec `i686_unknown_linux_gnu.rs` (comentario sobre SSE2 y tier 1). URL: https://doc.rust-lang.org/stable/nightly-rustc/src/rustc_target/spec/targets/i686_unknown_linux_gnu.rs.html · Verificado: parcialmente (resultado de búsqueda).
- [R8] Debian bug #1095862 (debian-rust, feb. 2025): baseline i386 sin SSE vs rustc. URL: https://lists.debian.org/debian-rust/2025/02/msg00003.html · Verificado: sí.
- [R9] antiX-23 released (antixlinux.com). URL: https://antixlinux.com/antix-23-released/ · Verificado: parcialmente (resumen de búsqueda; el sitio rechazó la conexión directa).
- [R10] BetaNews, antiX-23 review (Bookworm, sin systemd, sysVinit/runit). URL: https://betanews.com/2023/08/30/antix-23-debian-bookworm-systemd-free-linux-distro-review/ · Verificado: parcialmente.
- [R11] DebugPoint, antiX 23 review. URL: https://www.debugpoint.com/antix-23-review/ · Verificado: parcialmente.
- [R12] Linuxiac, antiX 23.2 released. URL: https://linuxiac.com/?p=137587 · Verificado: parcialmente.
- [R13] Debian bookworm, paquete libc6 (2.36-9+deb12u14, i386). URL: https://packages.debian.org/bookworm/libc6 · Verificado: sí.
- [R14] sources.debian.org API, versiones de glibc por suite. URL: https://sources.debian.org/api/src/glibc/ · Verificado: sí.
- [R15] Foro antiX: "full antiX install, no X at boot" (bootcode `3`). URL: https://antixlinux.com/forum-archive/full-antix-install-no-x-at-boot-t3837.html · Verificado: parcialmente (sólo listado de búsqueda).
- [R16] antiX gfxboot help (boot options). URL: https://absinthe.tuxfamily.org/antix/docs-antiX-13/Boot_Menu/antiX-gfxboot.html · Verificado: sí.
- [R17] Foro DSL: bug en antiX runit al arrancar a tty (2024). URL: https://www.damnsmalllinux.org/forums/printthread.php?tid=89 · Verificado: parcialmente.
- [R18] agetty(8). URL: https://man7.org/linux/man-pages/man8/agetty.8.html · Verificado: sí.
- [R19] Gentoo wiki, Automatic login to virtual console. URL: https://wiki.gentoo.org/wiki/Automatic_login_to_virtual_console · Verificado: parcialmente.
- [R20] Alpine wiki, TTY Autologin. URL: https://wiki.alpinelinux.org/wiki/TTY_Autologin · Verificado: parcialmente.
- [R21] Devuan forum, autologin con runit. URL: https://dev1galaxy.org/viewtopic.php?id=5421 · Verificado: parcialmente.
- [R22] Arch BBS, `exec startx` en `.bash_profile`. URL: https://bbs.archlinux.org/viewtopic.php?id=222762 · Verificado: parcialmente.
- [R23] setfont(8). URL: https://man7.org/linux/man-pages/man8/setfont.8.html · Verificado: sí.
- [R24] LKML (feb. 2025), "More than 256/512 glyphs on the Linux console". URL: https://lkml.rescloud.iu.edu/2502.2/09593.html · Verificado: parcialmente.
- [R25] Kernel docs, The Framebuffer Console. URL: https://www.kernel.org/doc/html/latest/fb/fbcon.html · Verificado: sí.
- [R26] console_codes(4). URL: https://man7.org/linux/man-pages/man4/console_codes.4.html · Verificado: sí.
- [R27] systemd commit "terminal-util: use 256 color mode for PID 1 output" (kernel 3.16). URL: https://git.alternativebit.fr/picnoir/Systemd/commit/ddbf960574a3bb4b0be3dba929ad922bfa037a99 · Verificado: parcialmente.
- [R28] Linux commit "fbcon: remove soft scrollback code" (L. Torvalds). URL: https://github.com/torvalds/linux/commit/50145474f6ef4a9c19205b173da6264a644c7489 · Verificado: sí (versión 5.9 NO verificada).
- [R29] kmscon (upstream, reactivado 2025). URL: https://github.com/kmscon/kmscon · Verificado: sí.
- [R30] kmscon, fork de Aetf. URL: https://github.com/Aetf/kmscon · Verificado: sí.
- [R31] fbterm(1). URL: https://www.mankier.com/1/fbterm · Verificado: parcialmente.
- [R32] yaft. URL: https://github.com/uobikiemukot/yaft · Verificado: sí.
- [R33] Alacritty (requisito OpenGL ES 2.0). URL: https://github.com/alacritty/alacritty · Verificado: sí.
- [R34] ratatui 0.30.2 en docs.rs. URL: https://docs.rs/crate/ratatui/latest · Verificado: sí.
- [R35] ratatui-core en lib.rs / docs.rs. URL: https://lib.rs/crates/ratatui-core · Verificado: parcialmente.
- [R36] ratatui workspace `Cargo.toml` (MSRV 1.88, crossterm 0.29, termion 4). URL: https://raw.githubusercontent.com/ratatui/ratatui/main/Cargo.toml · Verificado: sí.
- [R37] ratatui crate `Cargo.toml` (features). URL: https://raw.githubusercontent.com/ratatui/ratatui/main/ratatui/Cargo.toml · Verificado: sí.
- [R38] Ratatui docs, Rendering under the hood (doble buffer/diff). URL: https://ratatui.rs/concepts/rendering/under-the-hood/ · Verificado: sí.
- [R39] crossterm::event docs. URL: https://docs.rs/crossterm/latest/crossterm/event/index.html · Verificado: sí.
- [R40] crossterm `event/source/unix/mio.rs`. URL: https://docs.rs/crate/crossterm/latest/source/src/event/source/unix/mio.rs · Verificado: sí.
- [R41] The Rust Performance Book, Build Configuration. URL: https://nnethercote.github.io/perf-book/build-configuration.html · Verificado: parcialmente.
- [R42] Microsoft Rust Training, release profiles and binary size. URL: https://microsoft.github.io/RustTraining/engineering-book/ch07-release-profiles-and-binary-size.html · Verificado: parcialmente.
- [R43] DEV Community, Go vs Rust for TUI (Bubbletea vs Ratatui), anecdótico. URL: https://dev.to/dev-tngsh/go-vs-rust-for-tui-development-a-deep-dive-into-bubbletea-and-ratatui-2b7 · Verificado: parcialmente.
- [R44] deps.rs termion 2.0.3. URL: https://deps.rs/crate/termion/2.0.3 · Verificado: parcialmente.
- [R45] FTXUI. URL: https://github.com/ArthurSonzogni/FTXUI · Verificado: sí.
- [R46] libsqlite3-sys 0.39.1 en docs.rs. URL: https://docs.rs/crate/libsqlite3-sys/latest · Verificado: sí.
- [R47] sqlcipher-src 420.0.0 en docs.rs. URL: https://docs.rs/crate/sqlcipher-src/latest · Verificado: sí.
- [R48] SQLCipher releases (4.13-4.20, 5.0.0-beta). URL: https://github.com/sqlcipher/sqlcipher/releases · Verificado: sí.
- [R49] rusqlite `libsqlite3-sys/build.rs`. URL: https://github.com/rusqlite/rusqlite/blob/master/libsqlite3-sys/build.rs · Verificado: sí.
- [R50] openssl-src `src/lib.rs` (mapeo de targets, musl). URL: https://docs.rs/crate/openssl-src/latest/source/src/lib.rs · Verificado: sí.
- [R51] SQLCipher Design. URL: https://www.zetetic.net/sqlcipher/design/ · Verificado: sí.
- [R52] SQLCipher API (PRAGMAs). URL: https://www.zetetic.net/sqlcipher/sqlcipher-api/ · Verificado: sí.
- [R53] SQLCipher Performance. URL: https://www.zetetic.net/sqlcipher/performance/ · Verificado: sí.
- [R54] eventcore PR #333 "apply PRAGMA key before WAL mode". URL: https://git.johnwilger.com/jwilger/eventcore/pulls/333 · Verificado: parcialmente.
- [R55] Zetetic discuss, "Possible 3.4.0 bug encrypting a database in WAL journal_mode". URL: https://discuss.zetetic.net/t/possible-3-4-0-bug-encrypting-a-database-in-wal-journal-mode/1324 · Verificado: parcialmente.
- [R56] Zetetic blog, SQLCipher 3.4.0 release (FTS5). URL: https://www.zetetic.net/blog/2016/4/5/sqlcipher-340-release/ · Verificado: parcialmente.
- [R57] OWASP Password Storage Cheat Sheet. URL: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html · Verificado: sí.
- [R58] RFC 9106, §4 Parameter Choice. URL: https://www.rfc-editor.org/rfc/rfc9106.html#section-4 · Verificado: sí.
- [R59] DEV Community, "Architecture vs brute force: benchmarking KDFs" (Argon2id 64 MB/t=3/p=1 = 0,178 s en i5-9300HF). URL: https://dev.to/treszyk/architecture-vs-brute-force-what-i-learned-benchmarking-kdfs-for-my-thesis-18bo · Verificado: sí.
- [R60] Bitwarden community, Argon2id settings (saturación de ancho de banda). URL: https://community.bitwarden.com/t/argon2id-settings/66626?page=5 · Verificado: parcialmente.
- [R61] G5 Cybersecurity blog, estimación de Argon2 por ancho de banda. URL: https://blog.g5cybersecurity.com/?p=176133 · Verificado: parcialmente.
- [R62] Turso docs, Rust SDK reference (libsql `encryption` feature). URL: https://docs.turso.tech/sdk/rust/reference.md · Verificado: parcialmente.
- [R63] Turso blog, native encryption (experimental). URL: https://turso.tech/blog/introducing-fast-native-encryption-in-turso-database · Verificado: parcialmente.
- [R64] SQLite, Write-Ahead Logging. URL: https://www.sqlite.org/wal.html · Verificado: sí.
- [R65] SQLite, PRAGMA synchronous. URL: https://www.sqlite.org/pragma.html#pragma_synchronous · Verificado: sí.
- [R66] cross-rs, Supported targets. URL: https://github.com/cross-rs/cross#supported-targets · Verificado: sí.
- [R67] cross-rs wiki FAQ (macOS, binfmt). URL: https://github.com/cross-rs/cross/wiki/FAQ · Verificado: sí.
- [R68] cargo-zigbuild. URL: https://github.com/rust-cross/cargo-zigbuild · Verificado: sí.
- [R69] Docker Hub, i386/debian. URL: https://hub.docker.com/r/i386/debian · Verificado: sí.
- [R70] Tweag, "Why link statically against musl?" (malloc de musl, mimalloc). URL: https://blog.tweag.io/blog/2023-08-10-rust-static-link-with-mimalloc/ · Verificado: parcialmente.
- [R71] hyperfine. URL: https://github.com/sharkdp/hyperfine · Verificado: sí.
- [R72] perf-stat(1). URL: https://man7.org/linux/man-pages/man1/perf-stat.1.html · Verificado: sí.
- [R73] proc_pid_status(5). URL: https://man7.org/linux/man-pages/man5/proc_pid_status.5.html · Verificado: sí.
- [R74] OpenEmbedded, "tune-core2: use n270 instead of core2duo" (avisos TCG lm/syscall). URL: https://www.openembedded.org/pipermail/openembedded-core/2018-September/274107.html · Verificado: parcialmente.
- [R75] mlock(2). URL: https://man7.org/linux/man-pages/man2/mlock.2.html · Verificado: sí.
- [R76] getrlimit(2). URL: https://man7.org/linux/man-pages/man2/getrlimit.2.html · Verificado: sí.
- [R77] crypttab(5). URL: https://www.linux.org/docs/man5/crypttab.html · Verificado: parcialmente.
- [R78] Arch wiki, dm-crypt/Swap encryption (mirror). URL: https://wikipedia.jakami.de/content/archlinux_en_all_maxi_2026-04/Encrypted_swap · Verificado: parcialmente.
- [R79] core(5). URL: https://man7.org/linux/man-pages/man5/core.5.html · Verificado: sí.
- [R80] PR_SET_DUMPABLE(2const). URL: https://man7.org/linux/man-pages/man2/PR_SET_DUMPABLE.2const.html · Verificado: sí.
- [R81] proc_pid_mem(5). URL: https://man7.org/linux/man-pages/man5/proc_pid_mem.5.html · Verificado: sí.
- [R82] Kernel docs, Yama LSM (ptrace_scope). URL: https://www.kernel.org/doc/html/latest/admin-guide/LSM/Yama.html · Verificado: sí.
- [R83] zeroize 1.9.1. URL: https://docs.rs/zeroize/latest/zeroize/ · Verificado: sí.
- [R84] secrecy 0.10.3. URL: https://docs.rs/secrecy/latest/secrecy/ · Verificado: sí.

**No verificado en esta sesión (requiere comprobación)**: páginas Intel ARK de N270/N450 (404); antiX 19 = Buster; terminal por defecto de antiX; código de arranque a consola en antiX 23 (sólo foro); versión de kernel de la eliminación del scrollback (5.9); `colors#` de la entrada terminfo `linux`; default de `RLIMIT_MEMLOCK` y de `kernel.yama.ptrace_scope` en Debian; ancho de banda del 945GSE; cifras de RSS de Bubbletea/ncurses/xterm/st; soporte explícito de i686 en cargo-zigbuild; que `cross` pruebe OpenSSL vendored en i686-musl; que el instalador de antiX cree swap sin cifrar.
