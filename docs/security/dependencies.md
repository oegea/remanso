# Dependencias de Remanso

Inventario de todo el código ajeno que acaba dentro del binario (o que se ejecuta
durante la compilación), con el motivo de cada uno. Fuente: `Cargo.lock` y
`cargo tree -e normal --prefix depth` ejecutado el 2026-11-06 sobre `remanso 0.1.0`,
más la lectura del `Cargo.toml` de cada crate en el registro local para licencia y
*features*. Donde algo no se ha comprobado se dice «no verificado».

Resumen:

- **10 dependencias directas** declaradas en `Cargo.toml`; **67 crates** en total
  en tiempo de ejecución para Linux (incluidos los `-sys`); **18 crates** que sólo
  existen como macros procedimentales y sus auxiliares (se ejecutan dentro de
  `rustc`, no en el binario); **8 crates** de *scripts* de construcción.
- **Ninguna dependencia de red.** Ni directa ni transitiva: no hay `reqwest`,
  `hyper`, `tokio`, `ureq`, `curl`, `rustls`, `native-tls`, `url` ni nada similar.
- Dos bibliotecas C enlazadas **estáticamente**: SQLCipher 4.5.7 (community, con
  SQLite 3.45.3) y OpenSSL 3.6.3, ambas compiladas desde fuente durante `cargo build`.

## 1. Dependencias de ejecución

Columna «Red»: si el crate contiene código capaz de abrir conexiones de red. En todos
los casos la respuesta es **no**, con una matización para `mio` (véase su fila) y otra
para OpenSSL (§3). Licencias tomadas literalmente del campo `license` de cada crate.

### 1.1 Interfaz de terminal

| Crate | Versión | Para qué | Por qué está justificada | Licencia | Red |
|---|---|---|---|---|---|
| `ratatui` | 0.29.0 | Dibujo de la interfaz por diferencias | Dependencia directa; sin `default-features`, sólo `crossterm` | MIT | No |
| `crossterm` | 0.28.1 | Modo crudo del terminal, eventos de teclado, pantalla alternativa, lectura de contraseña sin eco | Dependencia directa; único *backend* multiplataforma mantenido | MIT | No |
| `mio` | 1.2.4 | Espera bloqueante en el descriptor del terminal (`epoll`) para que el bucle de eventos no consuma CPU | Lo exige `crossterm` para `event::poll` con tiempo límite | MIT | **No se usa**, pero el crate se compila con la *feature* `net` porque `signal-hook-mio` la activa. Esa *feature* sólo añade tipos (`TcpStream`, `UdpSocket`) que ningún código de Remanso ni de crossterm instancia; el enlazador los descarta. Verificación conductual en §4. |
| `signal-hook`, `signal-hook-mio`, `signal-hook-registry` | 0.3.18, 0.2.5, 1.4.8 | Recibir `SIGWINCH` (cambio de tamaño del terminal) como evento | Lo exige `crossterm` | Apache-2.0/MIT | No |
| `rustix` | 0.38.44 | `termios` (modo crudo) y E/S estándar sin pasar por `libc` | Lo exige `crossterm`; *features* `termios`, `stdio` | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | No |
| `linux-raw-sys` | 0.4.15 | Constantes de llamadas al sistema para `rustix` (sólo Linux) | Lo exige `rustix` | ídem | No |
| `errno` | 0.3.14 | Lectura de `errno` | `rustix`, `signal-hook-registry` | MIT OR Apache-2.0 | No |
| `libc` | 0.2.191 | Enlaces a la libc del sistema | `mio`, `rustix`, `openssl-sys`, `signal-hook` | MIT OR Apache-2.0 | No (expone `socket()`, pero nadie lo llama) |
| `parking_lot`, `parking_lot_core`, `lock_api`, `scopeguard` | 0.12.5, 0.9.12, 0.4.14, 1.2.0 | Mutex interno de `crossterm` para el lector de eventos | `crossterm` | MIT OR Apache-2.0 | No |
| `bitflags` | 2.13.2 | Conjuntos de banderas (modificadores de teclas, `OpenFlags`) | `crossterm`, `ratatui`, `rusqlite`, `rustix` | MIT OR Apache-2.0 | No |
| `cassowary` | 0.3.0 | Resolución de restricciones de *layout* | `ratatui` | MIT / Apache-2.0 | No |
| `compact_str`, `castaway`, `static_assertions`, `itoa`, `ryu` | 0.8.2, 0.2.4, 1.1.0, 1.0.18, 1.0.23 | Cadenas cortas en línea y formateo numérico de celdas | `ratatui` | MIT; MIT; MIT OR Apache-2.0; MIT OR Apache-2.0; Apache-2.0 OR BSL-1.0 | No |
| `itertools`, `either` | 0.13.0, 1.19.0 | Utilidades de iteradores | `ratatui`, `unicode-truncate` | MIT OR Apache-2.0 | No |
| `lru`, `hashbrown` (0.15), `allocator-api2`, `equivalent`, `foldhash` | 0.12.5, 0.15.5, 0.2.21, 1.0.3, 0.1.5 | Caché LRU de anchuras de celda | `ratatui` | MIT; MIT OR Apache-2.0; MIT OR Apache-2.0; Apache-2.0 OR MIT; Zlib | No |
| `strum` | 0.26.3 | Enumeraciones iterables | `ratatui` | MIT | No |
| `unicode-truncate`, `unicode-width` (0.1.14) | 1.1.0, 0.1.14 | Recorte de texto por anchura | `ratatui` (segunda copia de `unicode-width`, la que usa ratatui 0.29) | MIT OR Apache-2.0 | No |
| `log` | 0.4.35 | Fachada de registro | La arrastra `mio`. **Remanso no instala ningún *logger***: los mensajes se descartan. | MIT OR Apache-2.0 | No |
| `smallvec` | 1.16.4 | Vectores pequeños en pila | `parking_lot_core`, `rusqlite` | MIT OR Apache-2.0 | No |
| `cfg-if` | 1.0.5 | Compilación condicional | varios | MIT OR Apache-2.0 | No |

### 1.2 Persistencia cifrada

| Crate | Versión | Para qué | Por qué está justificada | Licencia | Red |
|---|---|---|---|---|---|
| `rusqlite` | 0.32.1 | API Rust sobre SQLite/SQLCipher | Dependencia directa; *feature* `bundled-sqlcipher-vendored-openssl` | MIT | No |
| `libsqlite3-sys` | 0.30.1 | Compila y enlaza el amalgama de **SQLCipher 4.5.7 community** (define `CIPHER_VERSION_NUMBER 4.5.7`, `SQLITE_VERSION "3.45.3"` en su `sqlcipher/sqlite3.c`) con `SQLITE_HAS_CODEC`, `SQLITE_TEMP_STORE=2`, FTS5, JSON1, RTREE | Lo exige `rusqlite`. `PRAGMA cipher_version` en ejecución devuelve `4.5.7 community` | MIT (el amalgama SQLCipher es BSD-3 de Zetetic; SQLite es dominio público) | No |
| `openssl-sys` | 0.9.118 | Enlaces a libcrypto, que SQLCipher usa para AES, HMAC-SHA512 y aleatoriedad (`SQLCIPHER_CRYPTO_OPENSSL`) | Lo exige `libsqlite3-sys`; *feature* `vendored` → OpenSSL se compila con `openssl-src` y se enlaza estáticamente (§3) | MIT (OpenSSL: Apache-2.0) | Ver §3 |
| `hashlink`, `hashbrown` (0.14), `ahash`, `once_cell`, `zerocopy` | 0.9.1, 0.14.5, 0.8.12, 1.21.4, 0.8.63 | Caché LRU de sentencias preparadas | `rusqlite` | MIT OR Apache-2.0 (zerocopy: BSD-2-Clause OR Apache-2.0 OR MIT) | No |
| `fallible-iterator`, `fallible-streaming-iterator` | 0.3.0, 0.1.9 | Iteradores que pueden fallar al recorrer filas | `rusqlite` | MIT/Apache-2.0 | No |

### 1.3 Derivación de clave y secretos

| Crate | Versión | Para qué | Por qué está justificada | Licencia | Red |
|---|---|---|---|---|---|
| `argon2` | 0.5.3 | Argon2id (RustCrypto) | Dependencia directa; sin `default-features` (sin `rand`, sin `std` innecesario), *feature* `alloc` | MIT OR Apache-2.0 | No |
| `blake2`, `digest`, `block-buffer`, `crypto-common`, `generic-array`, `typenum` | 0.10.6, 0.10.7, 0.10.4, 0.1.7, 0.14.7, 1.20.1 | BLAKE2b, la función de compresión de Argon2 | `argon2` | MIT OR Apache-2.0 (generic-array: MIT) | No |
| `cpufeatures` | 0.2.17 | Detección de SIMD en x86 (sólo Linux/x86) | `blake2` | MIT OR Apache-2.0 | No |
| `subtle` | 2.6.1 | Comparaciones en tiempo constante | `argon2`, `password-hash` | BSD-3-Clause | No |
| `password-hash`, `base64ct`, `rand_core` | 0.5.0, 1.8.3, 0.6.4 | Tipos del formato PHC. Remanso no usa el formato PHC pero la *feature* `password-hash` de `argon2` está activa por su `alloc`. `rand_core` va **sin** `getrandom`: Remanso lee `/dev/urandom` directamente (`crypto::random_bytes`) | `argon2` | MIT OR Apache-2.0 | No |
| `zeroize` | 1.9.1 | Borrado de contraseña y clave al soltarlas | Dependencia directa; sin dependencias propias | Apache-2.0 OR MIT | No |

### 1.4 Fechas, serialización y texto

| Crate | Versión | Para qué | Por qué está justificada | Licencia | Red |
|---|---|---|---|---|---|
| `chrono` | 0.4.45 | Fecha local, formato `AAAA-MM-DD` | Dependencia directa; sin `default-features`, sólo `clock` y `std` | MIT OR Apache-2.0 | No |
| `iana-time-zone` | 0.1.65 | Zona horaria local (`/etc/localtime`, `TZ`) | `chrono` con `clock` | MIT OR Apache-2.0 | No |
| `num-traits` | 0.2.19 | Aritmética genérica | `chrono` | MIT OR Apache-2.0 | No |
| `serde`, `serde_core` | 1.0.229 | Serialización de `kdf.json`, `prefs.json`, `manifest.json`, exportación | Dependencia directa | MIT OR Apache-2.0 | No |
| `serde_json` | 1.0.154 | JSON | Dependencia directa | MIT OR Apache-2.0 | No |
| `memchr`, `zmij` | 2.8.3, 1.0.23 | Búsqueda de bytes y formateo de flotantes | `serde_json` | Unlicense OR MIT; MIT | No |
| `unicode-width` | 0.2.0 | Anchura de celdas para el editor | Dependencia directa | MIT OR Apache-2.0 | No |
| `unicode-segmentation` | 1.13.3 | Límites de grafema y palabra en el editor | Dependencia directa; también la usa `unicode-truncate` | MIT OR Apache-2.0 | No |

Nota: en el árbol generado desde macOS aparece además `core-foundation-sys` 0.8.7
(zona horaria en Apple); en el *target* Linux se sustituye por `cpufeatures` y
`linux-raw-sys`. El resto del árbol es idéntico en ambos.

## 2. Dependencias sólo de compilación

Nada de esto acaba en el binario. Igual de importante auditarlas, porque se
ejecutan en la máquina que compila con los permisos del usuario.

### 2.1 Macros procedimentales y sus auxiliares (18)

Se ejecutan dentro de `rustc` para generar código. `cargo tree -e normal` las lista
porque Cargo las modela como dependencias normales, pero el código generado es lo
único que llega al binario.

| Crate | Versión | Para quién | Licencia |
|---|---|---|---|
| `serde_derive` | 1.0.229 | `#[derive(Serialize, Deserialize)]` | MIT OR Apache-2.0 |
| `zeroize_derive` | 1.5.0 | `#[derive(Zeroize, ZeroizeOnDrop)]` | Apache-2.0 OR MIT |
| `strum_macros`, `heck` | 0.26.4, 0.5.0 | `ratatui` (enumeraciones) | MIT; MIT OR Apache-2.0 |
| `instability`, `darling`, `darling_core`, `darling_macro`, `ident_case`, `strsim` | 0.3.14, 0.24.1, 0.24.1, 0.24.1, 1.0.1, 0.11.1 | `ratatui` (marcado de API inestable) | MIT |
| `indoc`, `paste`, `rustversion` | 2.0.8, 1.0.15, 1.0.23 | `ratatui`, `compact_str`, `strum` | MIT OR Apache-2.0 |
| `syn` (2.0.119 y 3.0.9), `quote`, `proc-macro2`, `unicode-ident` | —, 1.0.47, 1.0.107, 1.0.27 | Infraestructura de todas las anteriores | MIT OR Apache-2.0 (`unicode-ident`: (MIT OR Apache-2.0) AND Unicode-3.0) |

### 2.2 Scripts de construcción (`build.rs`) (8)

| Crate | Versión | Qué hace | Licencia |
|---|---|---|---|
| `cc` | 1.11.0 | Invoca el compilador de C para SQLCipher y OpenSSL | MIT OR Apache-2.0 |
| `openssl-src` | 300.6.1+3.6.3 | Contiene el **código fuente de OpenSSL 3.6.3** (`VERSION.dat`: 3.6.3, fecha de publicación 9 jun 2026) y lo compila con `./Configure` | MIT/Apache-2.0 (OpenSSL: Apache-2.0) |
| `pkg-config` | 0.3.34 | Buscaría una libsqlite3/OpenSSL del sistema; con `bundled-*` no se usa en la práctica | MIT OR Apache-2.0 |
| `vcpkg` | 0.2.15 | Equivalente para Windows; inerte en Linux | MIT/Apache-2.0 |
| `shlex` | 2.0.1 | Partición de `CFLAGS` para `cc` | MIT OR Apache-2.0 |
| `find-msvc-tools` | 0.1.15 | Localiza MSVC; sólo Windows, no se compila en Linux | MIT OR Apache-2.0 |
| `autocfg`, `version_check` | 1.5.1, 0.9.5 | Detección de versión del compilador | Apache-2.0 OR MIT; MIT/Apache-2.0 |

### 2.3 Sólo para tests

`tempfile` 3.27.0 (y sus dependencias `fastrand`, `getrandom` 0.4.3, `rustix` 1.1.6):
directorios temporales en los tests. No participa en el binario de distribución.

El `Cargo.lock` contiene también entradas `windows-*`, `wasm-bindgen*`, `js-sys`,
`bumpalo`, `wasi`, `android_system_properties`: son ramas condicionales de `chrono`,
`iana-time-zone`, `mio` y `getrandom` para otras plataformas. Cargo las registra en el
*lock* pero **no se compilan** para Linux (comprobado con
`cargo tree --target x86_64-unknown-linux-gnu`).

## 3. Bibliotecas C: SQLCipher y OpenSSL

- **SQLCipher 4.5.7 community / SQLite 3.45.3**: amalgama incluido en
  `libsqlite3-sys` 0.30.1, compilado con `SQLCIPHER_CRYPTO_OPENSSL`. En ejecución,
  `PRAGMA cipher_version` devuelve `4.5.7 community`. No es la última versión de la
  rama 4 (la evaluación técnica, §4.1, cita 4.20.0 en octubre de 2026); subir exige
  pasar a `rusqlite` ≥ 0.41 / `libsqlite3-sys` ≥ 0.39 y revisar los cambios de
  parámetros por defecto, porque un cambio de defaults rompería `recovery.md`.
  Vulnerabilidades conocidas en 4.5.7 o SQLite 3.45.3 que afecten al uso de Remanso:
  **no verificado**.
- **OpenSSL 3.6.3** (`openssl-src` 300.6.1+3.6.3), compilado desde fuente y
  **enlazado estáticamente**: el binario no depende de la `libcrypto.so` del sistema,
  así que las actualizaciones de la distribución no lo parchean; hay que recompilar
  Remanso para obtener correcciones de OpenSSL. Sólo se usa `libcrypto` (AES, HMAC,
  RAND); `libssl` no interviene.
- Matización sobre red: `libcrypto` incluye la capa BIO con *sockets* salvo que se
  configure con `no-sock`. Si `openssl-src` lo deshabilita: **no verificado**. En
  consecuencia, `nm`/`objdump` sobre el binario pueden mostrar símbolos como
  `connect`, `socket` o `getaddrinfo` procedentes de OpenSSL **que nada llama**. Por
  eso la verificación válida es conductual (§4), no por presencia de símbolos.
- En musl (`i686-unknown-linux-musl`) `openssl-src` define `OPENSSL_NO_SECURE_MEMORY`:
  OpenSSL pierde su montón seguro. No afecta a `cipher_memory_security` de SQLCipher,
  que hace su propio borrado (evaluación técnica, §4.1; no verificado en binario real).

## 4. Conclusión y cómo volver a auditar

**Conclusión**: no existe ninguna ruta de código en Remanso ni en sus dependencias que
abra una conexión de red. El único crate con tipos de red (`mio` con `net`) los
expone sin que nadie los use, y la única biblioteca con código de *sockets*
(libcrypto) sólo es llamada por SQLCipher para cifrado y HMAC.

Procedimiento para repetir esta auditoría tras actualizar dependencias:

1. **Árbol de dependencias**:
   ```sh
   cargo tree -e normal --prefix depth                     # ejecución (incluye proc-macro)
   cargo tree -e normal --target x86_64-unknown-linux-gnu  # lo que realmente se compila en Linux
   cargo tree -e build                                     # scripts de construcción
   cargo tree -e normal -f '{p} [{f}]' | grep -E 'mio|openssl|libsqlite3'   # features activas
   cargo tree -i mio                                       # quién arrastra un crate dado
   ```
   Buscar en la salida: `reqwest`, `hyper`, `tokio`, `ureq`, `curl`, `rustls`,
   `native-tls`, `url`, `http`, `socket2`, `async-std`, `smol`. Ninguno debe aparecer.
2. **Avisos de seguridad** (requiere instalación; no estaba instalado al redactar
   esto): `cargo install cargo-audit && cargo audit`. Comprueba el `Cargo.lock` contra
   la base RustSec; **no cubre** OpenSSL ni SQLCipher, que hay que revisar a mano
   (`openssl-src` publica versiones nuevas cuando OpenSSL corrige CVE).
3. **Comprobación conductual en Linux** (la única que cubre también el C):
   ```sh
   strace -f -e trace=network -o /tmp/remanso-net.txt ./remanso --dir /tmp/prueba
   ```
   Usar la aplicación con normalidad (crear base, escribir, copia, bloqueo, salir) y
   revisar el fichero: no debe contener `socket(AF_INET`, `connect(`, `sendto(` ni
   `getaddrinfo`. Es normal ver `socketpair`/`eventfd`/`pipe` (señales y despertar de
   `mio`): son locales. Alternativa sin `strace`: ejecutar con la red desactivada
   (`unshare -n ./remanso`) y comprobar que todo funciona igual.
4. **Versiones de las bibliotecas C**: `grep -A3 'name = "libsqlite3-sys"' Cargo.lock`,
   `grep -A1 'name = "openssl-src"' Cargo.lock`, y en ejecución `PRAGMA cipher_version`
   desde `sqlcipher` o desde Ajustes → Acerca de (la cadena fija allí dice «SQLCipher 4»;
   el número exacto sólo se obtiene del PRAGMA).
5. **Licencias**: todas las de ejecución son MIT, Apache-2.0, BSD, Zlib, BSL-1.0 o
   Unlicense, compatibles con la licencia dual MIT OR Apache-2.0 del proyecto. Para
   regenerar la lista: `cargo install cargo-license && cargo license`, o leer el campo
   `license` de cada `~/.cargo/registry/src/*/<crate>-<versión>/Cargo.toml`, que es lo
   que se hizo aquí.
