# Instalación y uso sin conexión en un Acer Aspire One con antiX Linux

**Fecha:** 2026-11-06 · **Ámbito:** Remanso 0.1.x · **Público:** quien va a instalar la aplicación en un netbook Acer Aspire One (Atom N270/N280, Pineview, Cedarview o modelos AMD) con antiX 23.

Remanso es una aplicación de terminal (TUI) escrita en Rust. No usa red, no tiene servicio residente y guarda todo en un único directorio cifrado. Esta guía cubre desde identificar la máquina hasta arrancar directamente en la aplicación sin escritorio gráfico, con copias de seguridad en USB.

## Cómo leer esta guía

Cada paso lleva una de estas dos marcas:

- **[Verificado en el proyecto]**: comprobado con el código y la batería de pruebas de este repositorio (el binario compila como ejecutable estático, arranca en un pseudoterminal de 80×24 con `TERM=xterm-256color` y `LANG=es_ES.UTF-8` mediante `tools/tui_smoke.py` y `tools/perf.py`, y se ha ejecutado bajo emulación de x86 de 32 bits). Lo que se afirma del comportamiento de la aplicación procede de leer su código fuente.
- **[Receta documental]**: procede de manuales (`agetty(8)`, `setfont(8)`, `console_codes(4)`, `crypttab(5)`), de la documentación de Debian/antiX o de foros, y **todavía no se ha probado en un Acer Aspire One real**. Las fuentes y su grado de verificación están en `docs/research/notes/T-evaluacion-tecnica.md` (memo técnico, citado aquí como «memo T»).

Si una receta documental no funciona en tu equipo, anótalo: es exactamente la información que falta para cerrar los riesgos abiertos del memo T (§8).

---

## 1. Comprobar la arquitectura y la CPU

**[Receta documental]** (los comandos son estándar de Linux; la interpretación sigue el memo T §1.2).

En una terminal de antiX:

```sh
uname -m                              # i686 → kernel de 32 bits; x86_64 → kernel de 64 bits
getconf LONG_BIT                      # 32 o 64 (del sistema instalado, no de la CPU)
grep -o -w lm /proc/cpuinfo | head -1 # si imprime «lm», la CPU admite 64 bits
grep -m1 -oE '\b(pni|ssse3|sse4_1|sse4_2|avx)\b' /proc/cpuinfo | sort -u
free -m                               # RAM total
cat /sys/class/graphics/fb0/virtual_size 2>/dev/null   # resolución del framebuffer
```

Interpretación:

| Resultado | Significado | Binario a usar |
|---|---|---|
| `uname -m` = `i686` y **no** aparece `lm` | CPU sólo de 32 bits (Atom N270/N280, Z520). Es el caso de los Aspire One de 2008-2009 (A110, A150, ZG5, D150, D250, 531h). | `dist/remanso-i686-linux-musl` |
| `uname -m` = `i686` y **sí** aparece `lm` | CPU de 64 bits con antiX de 32 bits instalado (posible en Pineview/Cedarview). | `dist/remanso-i686-linux-musl` |
| `uname -m` = `x86_64` | antiX de 64 bits (Pineview, Cedarview, modelos AMD). | `dist/remanso-x86_64-linux-musl` (o el de i686, que también funciona si el kernel tiene `CONFIG_IA32_EMULATION`, lo habitual) |

Notas:

- `pni` es el nombre que el kernel da a SSE3. El Atom N270 tiene SSE2/SSE3/SSSE3 y **no** SSE4 ni AVX; el binario de i686 se compila con la base `pentium4` (SSE2), suficiente para toda la familia (memo T §1.3).
- Los dos binarios son **estáticos** (musl): no dependen de la versión de glibc de antiX ni de ninguna biblioteca del sistema. Esto es lo que permite copiarlos por USB sin instalar nada más (memo T §5).
- En los modelos con 1 GB de RAM la aplicación cabe de sobra: su objetivo es menos de 20 MiB residentes más 32 MiB durante unos segundos al desbloquear (§10).

---

## 2. Copiar el binario por USB y verificarlo

**[Verificado en el proyecto]**: el ejecutable es un único fichero sin dependencias; el nombre del binario es `remanso` y acepta las opciones de §3.
**[Receta documental]**: los pasos de montaje y permisos en antiX.

En el ordenador donde descargaste o compilaste Remanso, copia al USB el binario y su suma de comprobación:

```sh
cp dist/remanso-i686-linux-musl /media/usb/remanso
sha256sum dist/remanso-i686-linux-musl > /media/usb/remanso.sha256
```

En el Acer, con el USB montado (antiX lo monta normalmente en `/media/<usuario>/<etiqueta>` o `/media/usb`; `lsblk` y `mount | grep media` muestran la ruta real):

```sh
cd /media/usb
sha256sum remanso                     # compara a ojo con remanso.sha256
# o, si copiaste el fichero .sha256 con el mismo nombre de binario:
sed 's#dist/remanso-i686-linux-musl#remanso#' remanso.sha256 | sha256sum -c -
```

Instálalo para tu usuario (no requiere `root`):

```sh
mkdir -p ~/bin
cp /media/usb/remanso ~/bin/remanso
chmod 755 ~/bin/remanso
```

o para todos los usuarios:

```sh
sudo install -m 755 /media/usb/remanso /usr/local/bin/remanso
```

Comprueba que arranca sin red ni dependencias:

```sh
~/bin/remanso --version            # debe imprimir «remanso 0.1.0» (o la versión que corresponda)
file ~/bin/remanso                 # «statically linked» confirma que no necesita bibliotecas
```

Si `~/bin` no está en tu `PATH`, antiX lo añade al iniciar sesión si el directorio existe (comportamiento del `.profile` de Debian); cierra sesión y vuelve a entrar, o usa la ruta completa.

---

## 3. Primer arranque y dónde quedan los datos

**[Verificado en el proyecto]** (código: `src/paths.rs`, `src/cli.rs`, `src/app/lock.rs`, `src/prefs.rs`, `src/storage/mod.rs`).

```sh
remanso
```

La primera vez aparece la pantalla «Primer uso»: pide una contraseña maestra (dos veces, mínimo 8 caracteres) y avisa de que **no se guarda en ningún sitio: si la olvidas, no hay forma de recuperar los datos**. Después, una pantalla «Aspecto» permite elegir tema (oscuro/claro) y juego de caracteres (Unicode/ASCII) con una vista previa; Intro para empezar. Todo se puede cambiar después en Ajustes.

### Directorio de datos

La aplicación resuelve el directorio en este orden:

1. `--dir RUTA` en la línea de órdenes.
2. Variable de entorno `REMANSO_DIR`.
3. `$XDG_DATA_HOME/remanso` si `XDG_DATA_HOME` está definida.
4. `~/.local/share/remanso` (lo normal en antiX).

Contenido:

| Fichero | Qué es | Cifrado |
|---|---|---|
| `remanso.db` | Base de datos SQLCipher 4 (AES-256-CBC, HMAC-SHA512 por página) con diario, cuadernos, tareas, objetivos, etc. | Sí |
| `kdf.json` | Sal y parámetros Argon2id para derivar la clave desde la contraseña. No es secreto, pero sin él la base de datos no se puede abrir. | No (no lo necesita) |
| `prefs.json` | Tema, juego de caracteres, minutos de bloqueo, mostrar asteriscos. Nunca contiene datos del usuario. | No |
| `copias/` | Destino por defecto de las copias hechas desde Ajustes. | Las copias sí |
| `exportacion/` | Destino por defecto de la exportación en texto plano (sólo si la pides). | **No** |

Permisos: la aplicación pone el directorio a `0700` y los ficheros a `0600` al crearlos (`paths::restrict_permissions`), de modo que otros usuarios del sistema no pueden leerlos. Si copias los ficheros a mano, conserva esos permisos (`chmod 700 ~/.local/share/remanso; chmod 600 ~/.local/share/remanso/*`).

Opciones de línea de órdenes (`remanso --help`):

```
--dir RUTA        Directorio de datos (por defecto $REMANSO_DIR o $XDG_DATA_HOME/remanso).
--ascii           Usar sólo caracteres ASCII (consolas sin Unicode).
--light | --dark  Forzar tema claro u oscuro para esta sesión.
--backup RUTA     Crear una copia de seguridad cifrada y salir.
--restore RUTA    Restaurar una copia de seguridad y salir.
--export DIR      Exportar todo en texto plano (Markdown + JSON) y salir. NO cifrado.
--check           Verificar integridad de la base de datos y salir.
--bench           Medir arranque, derivación de clave y consultas y salir.
--version         Mostrar la versión.
```

**Ninguna opción acepta la contraseña**: siempre se pide de forma interactiva, sin eco, para que no quede en el historial del intérprete ni en `/proc/<pid>/cmdline` (`cli::prompt_password`).

---

## 4. Arrancar sin escritorio y entrar directamente en la aplicación

El objetivo es que el netbook encienda, entre en la consola de texto (tty1), inicie sesión solo y lance Remanso; al salir de la aplicación, vuelve al inicio de sesión. Esto evita cargar X, ahorra memoria y hace que la pantalla de bloqueo de Remanso sea lo primero y lo último que se ve.

Seguridad previa: el autologin reduce la autenticación del sistema a la contraseña de Remanso. Es aceptable sólo porque la base de datos está cifrada y la máquina es de un único usuario (memo T §2.3). Si otras personas usan el equipo para otras cosas, no actives el autologin.

### 4.1 Arranque a consola

**[Receta documental, verificada sólo en foros]**. Un hilo del foro de antiX indica que el código de arranque **`3`** mantiene el sistema en modo texto (equivalente al runlevel 3 de sysVinit; antiX arranca X desde el runlevel 5 con slim/slimski). La documentación oficial del menú de arranque de antiX no lista un código explícito de «texto» (memo T §2.2, [R15], [R16]).

Para probarlo una vez, en el menú de GRUB pulsa `e`, añade ` 3` al final de la línea `linux ...` y arranca con `Ctrl+X` o `F10`. Si entras en una consola de texto con «login:», funciona.

Para dejarlo fijo, con **sysVinit** (edición recomendada por el memo T; `/etc/inittab` clásico):

```sh
sudo sed -i 's/^id:5:initdefault:/id:3:initdefault:/' /etc/inittab
grep initdefault /etc/inittab          # debe mostrar id:3:initdefault:
```

Alternativa: añadir `3` a `GRUB_CMDLINE_LINUX_DEFAULT` en `/etc/default/grub` y ejecutar `sudo update-grub`.

Con **runit**: un post de 2024 informa de un fallo que impedía arrancar directamente a tty en la variante runit de antiX; no se sabe si está corregido (memo T §2.2, [R17]). Si tu instalación es runit, prueba primero el bootcode `3` en GRUB; si no funciona, desactiva el servicio del gestor de sesión (`sudo rm /etc/service/slimski` o el enlace equivalente en `/etc/sv/`; comprueba con `ls /etc/service`). Reinstalar la edición sysVinit es la vía con menos incógnitas.

Para volver al escritorio en cualquier momento desde la consola: `startx` (o restaurar `id:5:initdefault:`).

### 4.2 Autologin en tty1

**[Receta documental]** (`agetty(8)`, wikis de Gentoo y Alpine; memo T §2.3).

`agetty --autologin USUARIO` inicia sesión sin pedir usuario ni contraseña. Con sysVinit, edita la línea de tty1 en `/etc/inittab`. Primero mira cómo está:

```sh
grep '^1:' /etc/inittab
# típico: 1:2345:respawn:/sbin/getty 38400 tty1
```

Sustitúyela (cambia `usuario` por tu nombre de usuario):

```sh
sudo cp /etc/inittab /etc/inittab.bak
sudo sed -i 's#^1:.*#1:2345:respawn:/sbin/agetty --autologin usuario --noclear 38400 tty1 linux#' /etc/inittab
sudo telinit q                          # relee inittab sin reiniciar
```

Comprueba que `/sbin/agetty` existe (`ls -l /sbin/agetty`; en Debian es parte de `util-linux`). Si tu `/etc/inittab` usa `getty` en vez de `agetty`, en Debian ambos nombres son el mismo programa.

Con **runit** no hay documentación oficial; los ejemplos del foro de Devuan usan un `run` del estilo:

```sh
#!/bin/sh
exec chpst -P /sbin/agetty --autologin usuario --noclear 38400 tty1 linux
```

en `/etc/sv/agetty-tty1/run` (memo T [R21]). Hay que validarlo en la ISO runit actual.

### 4.3 Lanzar Remanso al iniciar sesión, sólo en tty1

**[Receta documental]** para el mecanismo de shell; **[Verificado en el proyecto]** que Remanso termina limpiamente con `q` o Esc desde Inicio y devuelve el control al intérprete.

Añade al final de `~/.bash_profile` (créalo si no existe; si tu shell de login es otra, usa su fichero de perfil):

```sh
# Lanzar Remanso sólo en la consola 1; al salir, vuelve al login.
if [ "$(tty)" = /dev/tty1 ]; then
    export LANG=es_ES.UTF-8
    ulimit -c 0
    exec remanso
fi
```

Qué hace cada línea:

- `[ "$(tty)" = /dev/tty1 ]`: en tty2–tty6 (`Alt+F2`…) sigues teniendo una shell normal para administrar el sistema. Esa es la vía de rescate si algo falla.
- `exec remanso`: sustituye la shell por la aplicación; al salir de Remanso el proceso termina, `agetty` reaparece (`respawn`) y vuelve a iniciar sesión, con lo que Remanso vuelve a arrancar en su pantalla de bloqueo. Si prefieres caer a una shell al salir, quita `exec`.
- `ulimit -c 0`: desactiva los volcados de memoria (§6).
- `LANG`: véase §5.3.

Si `~/bin` no está en el `PATH` en ese momento, escribe la ruta completa (`exec "$HOME/bin/remanso"`).

Para apagar el equipo desde esta configuración: sal de Remanso, pasa a tty2 (`Alt+F2`), inicia sesión y ejecuta `sudo poweroff`; o añade a `sudoers` un permiso sin contraseña para `poweroff` y crea un alias. Remanso no tiene orden de apagado propia.

---

## 5. Consola Linux: fuente, caracteres, colores, idioma y teclado

### 5.1 Fuente con cobertura suficiente

**[Receta documental]** (`setfont(8)`, documentación de fbcon; memo T §2.4).

La consola Linux (fbcon) dibuja con una fuente de **256 glifos y 16 colores**, o de **512 glifos y 8 colores**; no hay término medio. Remanso, en modo Unicode, usa sólo estos caracteres fuera de ASCII y Latin-1: `─ ● ○ ◐ · ▍ … █ ░ ↑ ↓ → ▲ ✓` y los bloques `▁▂▃▄▅▆▇█` para las gráficas. Varias fuentes de 256 glifos **no** contienen los bloques finos ni `●○◐✓`; en ese caso verás cuadrados, signos de interrogación o espacios.

Prueba la fuente cargada y los glifos:

```sh
setfont -v 2>&1 | head -3           # fuente actual
showconsolefont                     # tabla de glifos disponibles
printf '─ ● ○ ◐ · ▍ … █ ░ ↑ ↓ → ▲ ✓ ▁▂▃▄▅▆▇█\n'
```

Fuentes a probar (todas en `/usr/share/consolefonts/`, paquete `console-setup` o `kbd`):

```sh
setfont Lat2-Terminus16          # Latin-2, 256 glifos, 16 colores; castellano y catalán completos
setfont Uni2-Terminus16          # Unicode «Uni2», 512 glifos, 8 colores; más símbolos
setfont Uni3-Terminus16          # otra variante Unicode de 512 glifos
```

Para fijarla al arrancar, edita `/etc/default/console-setup`:

```
CHARMAP="UTF-8"
CODESET="Lat2"        # o Uni2
FONTFACE="Terminus"
FONTSIZE="16"
```

y ejecuta `sudo setupcon --save` (o reinicia). Con la pantalla de 1024×600 y una fuente de 8×16 obtienes unas 128 columnas por 37 filas, suficiente para Remanso (mínimo 80×24).

### 5.2 Si los glifos salen mal: modo ASCII

**[Verificado en el proyecto]** (`src/ui/glyphs.rs`, `src/cli.rs`, `src/app/settings.rs`).

Remanso tiene un juego de caracteres alternativo íntegramente ASCII (`-`, `*`, `o`, `#`, `>`…) que se activa de tres formas:

1. **Automática**: si `LANG` y `LC_ALL` no contienen «UTF» (consola sin UTF-8), la aplicación arranca en ASCII por sí sola (`Glyphs::detect_ascii_env`).
2. **Por sesión**: `remanso --ascii`.
3. **Permanente**: Ajustes → «Caracteres» → `ASCII` (se guarda en `prefs.json`). También se elige en la pantalla «Aspecto» del primer arranque.

La aplicación es plenamente usable en ASCII: todas las gráficas y marcas tienen equivalente textual.

### 5.3 UTF-8 e idioma

**[Receta documental]** para la configuración del sistema; **[Verificado en el proyecto]** que la detección se basa en `LANG`/`LC_ALL`.

Para que Remanso use los glifos Unicode necesita que la consola esté en modo UTF-8 **y** que la variable de entorno lo declare:

```sh
locale -a | grep -i es_ES          # ¿existe es_ES.utf8?
sudo dpkg-reconfigure locales      # si no, genera es_ES.UTF-8 y márcala por defecto
```

En `~/.bash_profile` (o en `/etc/default/locale`): `export LANG=es_ES.UTF-8`. Debian arranca la consola en UTF-8 por defecto (`unicode_start`); si ves que los acentos se muestran como dos caracteres, ejecuta `unicode_start` o comprueba `/etc/default/console-setup` (`CHARMAP="UTF-8"`).

Remanso no depende de la `locale` para los nombres de meses y días (los lleva en español en el propio binario); la `locale` sólo afecta a la detección de UTF-8.

### 5.4 Colores

**[Receta documental]** (`console_codes(4)`; memo T §2.4) y **[Verificado en el proyecto]** (`docs/design/ux.md` §3: la paleta usa los 16 colores ANSI básicos).

La consola Linux reduce cualquier color de 256 o de 24 bits a los **16 colores de primer plano y 8 de fondo**. Remanso ya está diseñado para esa paleta, en tema oscuro y claro, así que no hay nada que configurar. Si el contraste no te convence, prueba `--light` o `--dark` para una sesión, o cámbialo en Ajustes → «Tema». No es necesario (ni recomendable) poner `TERM=linux-16color`: la aplicación emite las secuencias ANSI directamente y no consulta `terminfo`.

### 5.5 Teclado español

**[Receta documental]**.

```sh
sudo loadkeys es                     # para la sesión actual
```

Permanente: en `/etc/default/keyboard`, `XKBLAYOUT="es"`, y `sudo setupcon --save`. Comprueba que `ñ`, acentos y `¿` funcionan en la consola antes de pasar a Remanso: la aplicación recibe exactamente lo que el kernel entrega.

---

## 6. Seguridad del equipo

El adversario principal es quien tenga acceso físico al netbook apagado o robado. La base de datos está cifrada; lo que hay que evitar es que copias de la clave o de textos acaben en disco **sin cifrar** por otras vías (memo T §7).

### 6.1 Swap: desactivarla o cifrarla con clave aleatoria

**[Receta documental]** (`crypttab(5)`, wiki de Arch; memo T §7). El memo no pudo confirmar si el instalador de antiX 23 crea una partición swap sin cifrar; compruébalo:

```sh
swapon --show                        # ¿hay swap activa?
grep swap /etc/fstab
```

Opción A, **sin swap** (viable con 1–2 GB de RAM para una aplicación de menos de 50 MiB):

```sh
sudo swapoff -a
sudo sed -i 's/^\([^#].*\sswap\s\)/#\1/' /etc/fstab     # comenta la línea de swap
```

Opción B, **swap cifrada con clave aleatoria en cada arranque** (la clave se descarta al apagar, así que nada de la swap sobrevive al reinicio). Con la partición de swap identificada (por ejemplo `/dev/sda2`; usa `blkid` y referencia estable como `/dev/disk/by-id/...` o `/dev/disk/by-partuuid/...`, nunca `/dev/sdX` que puede cambiar):

```sh
sudo apt install cryptsetup          # requiere conexión; hazlo antes de aislar el equipo, o desde el DVD/USB de antiX
sudo swapoff -a
```

`/etc/crypttab`:

```
cswap  /dev/disk/by-partuuid/XXXX-XX  /dev/urandom  swap,cipher=aes-xts-plain64,size=512
```

`/etc/fstab` (sustituye la línea de swap anterior):

```
/dev/mapper/cswap  none  swap  sw  0 0
```

Usa `/dev/urandom`, no `/dev/random`, para no bloquear el arranque. Reinicia y comprueba con `swapon --show` que la swap activa es `/dev/mapper/cswap`.

### 6.2 Nada de suspender a disco

**[Receta documental]**. La hibernación (suspend-to-disk) copia **toda la RAM al disco**, incluidas las páginas bloqueadas con `mlock`. Si la swap no está cifrada, la clave de la base de datos abierta quedaría en el disco. Apaga el equipo en lugar de hibernarlo; si usas la opción A (sin swap), la hibernación simplemente no es posible. Suspender a RAM (tapa cerrada) es menos grave, pero cualquiera que abra la tapa ve la aplicación desbloqueada hasta que actúe el bloqueo por inactividad (§6.4).

### 6.3 Volcados de memoria

**[Receta documental]** para el sistema; **[Verificado en el proyecto]** el estado de la aplicación.

`ulimit -c 0` en el lanzador (§4.3) impide que un fallo escriba un `core` con el contenido de la memoria (incluida la clave). Para hacerlo global: en `/etc/security/limits.conf`, `*  hard  core  0`. El memo T recomienda además que la aplicación llame a `prctl(PR_SET_DUMPABLE, 0)`; **esa llamada no está en el código actual** (es un pendiente), así que el `ulimit` del lanzador es la protección vigente. Comprueba también que `/proc/sys/kernel/core_pattern` no es una tubería (`|...`), porque en ese caso `ulimit -c 0` no se aplica.

### 6.4 Bloqueo por inactividad y pantalla

**[Verificado en el proyecto]** (`src/prefs.rs`, `src/app/settings.rs`, `src/app/mod.rs`).

Ajustes → «Bloquear tras inactividad»: `nunca`, 5, 10 (por defecto), 15, 30 o 60 minutos. Al bloquearse vuelve a la pantalla de contraseña, que muestra sólo el nombre de la aplicación y la fecha: ni la última entrada, ni nombres de objetivos, ni números. Al cerrar, la aplicación limpia la pantalla; la consola Linux ya no tiene desplazamiento hacia atrás, así que no queda texto residual. No ejecutes Remanso dentro de `tmux` o `screen`: su historial sí retiene lo mostrado.

La aplicación activa `PRAGMA cipher_memory_security = ON` (SQLCipher borra la memoria de todas sus asignaciones) y borra la contraseña y la clave de la memoria al destruirlas (`zeroize`). El coste de `cipher_memory_security` en un Atom no está medido; si notas lentitud, es un parámetro a revisar en una versión futura, no algo que puedas cambiar desde fuera.

### 6.5 Otros procesos del mismo usuario

**[Receta documental]**. Como hardening opcional, `kernel.yama.ptrace_scope = 1` en `/etc/sysctl.d/10-ptrace.conf` limita que procesos del mismo usuario inspeccionen la memoria de Remanso. En un netbook de un solo usuario sin red el riesgo es bajo.

---

## 7. Copias de seguridad en USB

**[Verificado en el proyecto]** (`src/storage/backup.rs`, `src/cli.rs`).

Una copia es un **directorio** con tres ficheros: `remanso.db` (cifrada con la misma clave que la original, generada con `sqlcipher_export`), `kdf.json` (sal y parámetros, imprescindible) y `manifest.json` (versión de esquema, fecha, tamaño). La copia se **verifica al crearse** (se abre con la clave y pasa `quick_check`). El destino debe no existir o estar vacío.

Desde la consola, con el USB montado:

```sh
remanso --backup /media/usb/remanso-copias/$(date +%F)
# pide la contraseña y escribe:
# «Copia creada y verificada en /media/usb/remanso-copias/2026-11-06 (NNN bytes, esquema v5).»
sync                                   # vacía los búferes antes de extraer el USB
```

También desde Ajustes → «Crear copia de seguridad cifrada», que propone `~/.local/share/remanso/copias/<fecha>`; puedes escribir la ruta del USB.

Rotación manual: cada copia es un directorio con la fecha en el nombre. Borra las antiguas cuando el USB se llene:

```sh
ls -1d /media/usb/remanso-copias/*/ | head -n -5 | xargs -r rm -r   # conserva las 5 últimas
```

Verificación periódica:

```sh
remanso --check                                               # la base de datos en uso
remanso --dir /media/usb/remanso-copias/2026-11-06 --check    # una copia concreta
```

Restaurar (sobre un directorio de datos vacío o tras renombrar el actual):

```sh
mv ~/.local/share/remanso ~/.local/share/remanso.antes
remanso --restore /media/usb/remanso-copias/2026-11-06
```

Recomendaciones:

- Dos USB alternos guardados en sitios distintos. La copia está cifrada con tu contraseña: sin ella no sirve a nadie, **incluida tú si la olvidas**.
- Los USB baratos fallan sin aviso: `--check` de la copia tras escribirla y de vez en cuando.
- `--export DIR` produce Markdown y JSON **en claro**. Es útil para migrar a otra herramienta; no es una copia de seguridad y no debe ir a un USB que viaje contigo sin cifrar.

---

## 8. Comprobar que la aplicación no usa la red

**[Verificado en el proyecto]**: el código no abre sockets; no hay dependencias de red en `Cargo.toml` (ratatui, crossterm, rusqlite/SQLCipher, argon2, zeroize, chrono, serde). El texto de Ajustes → «Acerca de» lo resume: «Sin red, sin telemetría, sin IA».
**[Receta documental]**: las herramientas de comprobación.

Puedes verificarlo tú mismo con herramientas estándar:

```sh
# 1. Trazar llamadas de red: no debe aparecer ninguna línea con socket/connect/sendto
strace -f -e trace=network ./remanso --version
strace -f -e trace=network -o /tmp/red.txt ./remanso --check ; cat /tmp/red.txt

# 2. Ejecutarla en un espacio de nombres sin interfaces de red (ni siquiera loopback)
sudo unshare -n -- su - "$USER" -c remanso

# 3. O simplemente apagar las interfaces
sudo ip link set wlan0 down ; sudo ip link set eth0 down
```

En un equipo dedicado a esto, la medida más simple es **no configurar la Wi-Fi** en antiX (o `sudo rfkill block all`) y hacer las copias por USB. Remanso no comprueba actualizaciones, no envía nada y no necesita hora de red: usa el reloj del sistema para fechar entradas, así que conviene que la hora de la BIOS sea correcta (`date`; `sudo date -s "2026-11-06 21:30"` y `sudo hwclock -w` si no lo es).

---

## 9. Actualizar la aplicación

**[Verificado en el proyecto]** (`src/storage/migrations.rs`, `src/storage/mod.rs`).

Actualizar es sustituir el binario:

```sh
remanso --backup /media/usb/remanso-copias/$(date +%F)-pre-actualizacion   # primero
cp /media/usb/remanso-nuevo ~/bin/remanso
chmod 755 ~/bin/remanso
remanso --version
```

Las migraciones del esquema de datos son **automáticas y sólo añaden** (append-only): al abrir, la aplicación compara `PRAGMA user_version` con su lista de migraciones (v1 a v5 en esta versión) y aplica las que falten dentro de una transacción. Nunca se edita una migración publicada; se añade otra.

Dos consecuencias prácticas:

- **No vuelvas a una versión anterior** del binario tras abrir los datos con una nueva: si la base de datos tiene un esquema más reciente del que el binario conoce, se niega a abrirla (error «incompatible») para no corromper nada. Por eso la copia previa.
- La actualización no toca `kdf.json` ni `prefs.json`; la contraseña sigue siendo la misma.

Si una versión futura cambiara los parámetros de Argon2 por defecto, sólo afectaría a bases nuevas: la existente conserva los suyos en `kdf.json` (y pueden cambiarse desde «Cambiar la contraseña», que rederiva la clave y recifra con `rekey`).

---

## 10. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer | Estado |
|---|---|---|---|
| «Terminal demasiado pequeño: se necesitan 80×24.» | La consola tiene menos columnas o filas de las necesarias (una fuente muy grande, o un `vga=` que fija 640×480). | Cambia la fuente a 8×16 (`setfont Lat2-Terminus16`) o la resolución del framebuffer. En 1024×600 con fuente 8×16 hay ~128×37. El aviso aparece por debajo de 60×12; la aplicación está diseñada para 80×24 o más. | Verificado en el proyecto (`app/mod.rs`, `text::TERMINAL_TOO_SMALL`) |
| «Contraseña incorrecta.» | Contraseña distinta a la usada al crear la base; o el `kdf.json` no es el de esta `remanso.db` (por ejemplo, al mezclar ficheros de dos copias). | Comprueba mayúsculas y disposición de teclado (`loadkeys es`: `ñ` y símbolos cambian de sitio con un mapa inglés). Ajustes → «Mostrar asteriscos al escribir la contraseña» ayuda a contar caracteres. Si has restaurado a mano, usa siempre `remanso.db` y `kdf.json` **del mismo directorio de copia**. No existe recuperación sin la contraseña. | Verificado en el proyecto (`storage::Db::open`) |
| Glifos como cuadrados, `?` o huecos; líneas que no encajan. | Fuente de consola sin esos glifos, o consola sin UTF-8 pero `LANG` declara UTF-8. | `remanso --ascii` para comprobarlo al instante; si se arregla, fija «Caracteres: ASCII» en Ajustes o cambia de fuente (§5.1). Comprueba `echo $LANG` y `unicode_start`. | Verificado (modo ASCII); receta (fuentes) |
| Acentos y `ñ` salen como dos caracteres raros. | Consola en modo Latin-1 con `LANG` UTF-8, o viceversa. | `unicode_start`; `CHARMAP="UTF-8"` en `/etc/default/console-setup`. | Receta documental |
| Desbloquear tarda varios segundos; aparece «Comprobando…». | Derivación de clave Argon2id (32 MiB de memoria, 3 pasadas, 1 hilo) en una CPU in-order de 1,6 GHz. | Es esperable. Estimación del memo T extrapolada desde un i5: **entre 1 y 3 s en un Atom N270**; **debe medirse** en el equipo real con `remanso --bench`, que imprime tiempo de arranque, de derivación y de consultas. Si supera ~3 s de forma molesta, es un parámetro a bajar en una versión futura (la OWASP admite 19 MiB con 2 pasadas); no lo cambies editando `kdf.json`: la clave dejaría de coincidir. | Verificado (parámetros, `--bench`); estimación (tiempo) |
| La aplicación arranca lenta la primera vez tras encender. | Disco de 5400 rpm en frío: carga del binario y de las páginas de la base de datos. | Normal; las siguientes aperturas son más rápidas. `--bench` separa arranque frío de caliente si lo ejecutas dos veces. | Estimación del memo T |
| Al salir de Remanso la pantalla queda en «login:» y vuelve a entrar sola. | Es el comportamiento buscado con `exec remanso` y autologin. | Para administrar, usa `Alt+F2` (tty2). Para quedarte en una shell en tty1, quita `exec` del `.bash_profile`. | Receta documental |
| No aparece el aviso de recordatorios aunque haya pasado la hora. | Remanso no tiene proceso residente: los recordatorios se comprueban al abrir la aplicación y mientras está abierta; nada avisa con ella cerrada. | Deja la aplicación abierta (bloqueada) o entra al menos una vez al día. Es una decisión de diseño, no un fallo. | Verificado en el proyecto |
| Ratón sin efecto. | En `TERM=linux` no hay eventos de ratón salvo con `gpm`. | Remanso se maneja íntegramente con teclado (`?` muestra la ayuda de cada pantalla). | Verificado en el proyecto |
| `--backup` falla con «el destino existe y no está vacío». | Protección contra sobrescribir una copia anterior. | Usa un directorio nuevo (la fecha con hora: `$(date +%F-%H%M)`). | Verificado en el proyecto |
| Error «incompatible» al abrir tras cambiar de binario. | Binario más antiguo que el esquema de la base de datos (§9). | Vuelve al binario nuevo, o restaura la copia previa a la actualización. | Verificado en el proyecto |

---

## Resumen de lo que falta por validar en el Acer real

Ordenado por prioridad, siguiendo el memo T §8:

1. Tiempo de Argon2id al desbloquear (`remanso --bench`) y, si procede, ajuste de parámetros por defecto.
2. Cobertura de glifos y colores con la fuente que antiX carga por defecto en fbcon; decidir si recomendar `Lat2-Terminus16`, `Uni2-Terminus16` o directamente ASCII.
3. Bootcode `3` y autologin con `agetty` en la ISO actual (sysVinit y runit).
4. Si el instalador de antiX 23 crea swap sin cifrar, y que la receta de `crypttab` arranca sin intervención.
5. Memoria residente y CPU en reposo (`tools/perf.py` o `top`), y arranque frío en el disco de 5400 rpm.
6. Añadir `prctl(PR_SET_DUMPABLE, 0)` al arranque de la aplicación (pendiente de código; mientras tanto, `ulimit -c 0`).
