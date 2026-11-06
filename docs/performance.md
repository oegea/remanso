# Rendimiento

Presupuestos (del encargo) y mediciones. Las mediciones en este Mac (Apple Silicon)
y bajo emulación QEMU i386 **no sustituyen** la medición en el Acer Aspire One;
indican orden de magnitud y confirman la ausencia de trabajo en reposo.

## Presupuestos

| Magnitud | Objetivo | Estado |
|---|---|---|
| Memoria residente en reposo | < 40–50 MiB | 17 MiB en Linux i686 (emulado); 43 MiB en macOS por el asignador (ver nota) |
| CPU en reposo | tendente a cero | 0 ms de CPU en 20 s sin interacción (medido) |
| Arranque en caliente | < 1 s | 6 ms hasta el primer fotograma (Mac) |
| Arranque en frío | < 3 s | pendiente de medir en el Acer |
| Respuesta a pulsaciones | inmediata | ~0,3 ms de CPU por pulsación con redibujo (Mac) |
| Desbloqueo (Argon2id 32 MiB, t=3) | aceptable | 63 ms Mac; ~0,6 s QEMU i386; estimación Atom N270: 1–3 s |

Nota macOS: el buffer de 32 MiB de Argon2id se libera, pero el asignador de macOS
no devuelve esa memoria al sistema; en Linux (glibc y musl) sí, como muestra la
medida bajo emulación (VmHWM 38 MiB durante la derivación, VmRSS 17 MiB después).

## Cómo se mide

- `tools/perf.py <binario> <dir>`: arranque hasta el primer fotograma, creación de la
  base, desbloqueo, RSS y CPU (`ps -o cputime`) tras 20 s en reposo, CPU al teclear
  300 caracteres con autoguardado, tamaño del binario.
- `remanso --bench`: Argon2id con tres parámetros, inserción de 2 000 entradas y
  3 000 notas, listado, búsqueda FTS, apertura de una nota de 3 000 líneas,
  verificación e inicio de sesión.
- Bajo Linux: `/proc/<pid>/status` (VmRSS, VmHWM), `perf stat -p PID -- sleep 60`,
  `strace -c` para confirmar que no hay despertares.

## Resultados — macOS (M-series, 2026-11-06)

```
arranque_hasta_primer_fotograma_ms: 6
crear_base_ms: 98
desbloqueo_ms: 63
rss_reposo_kib: 43376
cpu_time_inicio: 0:00.15
cpu_time_tras_20s_reposo: 0:00.15        ← cero consumo en reposo
escritura_300_chars_s: 1.62
cpu_time_tras_escribir: 0:00.24          ← 90 ms para 300 pulsaciones con redibujo
tamano_binario_bytes: 5534448
```

`remanso --bench` (mismo equipo):

```
argon2id m=19 MiB t=2:     32 ms
argon2id m=32 MiB t=3:     57 ms
argon2id m=64 MiB t=3:    112 ms
crear base + migraciones: 75 ms
insertar 2000 entradas + 3000 notas: 989 ms
listar diario (2000): 1 ms
búsqueda FTS (41 resultados): 2825 µs
abrir nota de 3000 líneas: 15 ms (ajuste de 3001 filas: 0 ms)
quick_check + fts integrity: 15 ms
abrir base existente (incluye Argon2id 32 MiB): 50 ms
```

## Resultados — Linux i686 bajo QEMU (Docker `--platform linux/386`)

Prototipo técnico (misma pila: ratatui + SQLCipher + Argon2), binario estático
musl de 4,7 MB:

```
argon2id(64MiB,t=3,p=1)=1239ms  insert5000x2=604ms  fts search=11,7 ms
VmHWM: 38340 kB   VmRSS: 16920 kB   (tras derivar la clave con 32 MiB)
```

La emulación QEMU de usuario es varias veces más lenta que un Atom real en
operaciones de memoria, de modo que 1,2 s para 64 MiB es un techo pesimista; aun
así se eligió 32 MiB por defecto (≈ la mitad) y los parámetros son configurables.

Aplicación completa, binario estático `dist/remanso-i686-linux-musl` (5,6 MB),
`--bench` bajo QEMU i386 (2026-11-06):

```
argon2id m=19 MiB t=2:    241 ms
argon2id m=32 MiB t=3:    620 ms          ← parámetros por defecto
argon2id m=64 MiB t=3:   1226 ms
crear base + migraciones: 884 ms
insertar 2000 entradas + 3000 notas: 6833 ms   (3,4 ms por fila con FTS y synchronous=FULL)
listar diario (2000): 32 ms
búsqueda FTS (41 resultados): 36 ms
abrir nota de 3000 líneas: 407 ms (ajuste de 3001 filas: 9 ms)
quick_check + fts integrity: 357 ms
abrir base existente (incluye Argon2id 32 MiB): 1000 ms
VmHWM: 72 208 kB (pico durante el bench: Argon2 64 MiB + 5 000 inserciones)
VmRSS: 22 676 kB (al terminar)
```

Lectura: bajo emulación, desbloquear cuesta ~1 s y la memoria residente queda en
~23 MiB tras un bench exigente (en uso normal, ~17 MiB). Un Atom N270 real debería
situarse entre estas cifras y las del Mac; la medición real sigue pendiente.

`strace -e trace=network` no funciona bajo QEMU de usuario (sin `ptrace`); la
comprobación de ausencia de red debe hacerse en el Acer (véase
`docs/install/antix.md`) o leyendo `docs/security/dependencies.md`.

## Diseño que sostiene estas cifras

- Bucle de eventos bloqueante (`event::poll(timeout)`), sin temporizador de refresco.
  Los únicos plazos son: autoguardado (2 s tras escribir), bloqueo por inactividad,
  caducidad de un mensaje de estado (4 s), próximo recordatorio y, sólo durante la
  espera activa de un episodio de impulso, un redibujo cada ≤ 30 s.
- Redibujado diferencial de ratatui (sólo celdas cambiadas).
- SQLite en WAL con `synchronous=FULL`: cada commit es duradero; el coste lo paga el
  usuario a su ritmo (un commit por acción), no un hilo de fondo.
- Consultas con índices sobre `day`, `status` y `metric_id`; FTS5 de contenido
  externo para búsqueda.
- Sin hilos auxiliares, sin asignaciones grandes salvo la derivación de clave.

## Pendiente

- Medir en el Acer: arranque en frío desde disco, Argon2id, RSS, latencia de
  teclado en consola Linux, cobertura de glifos.
- Repetir `--bench` con una base de 10 000 entradas.
