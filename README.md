# Remanso

Diario, cuadernos, tareas, objetivos y cambio conductual en un terminal.
Personal, completamente offline, cifrado, pensado para un ordenador antiguo
dedicado (Acer Aspire One con antiX Linux, consola de 80×24).

> Un remanso es el tramo de un río donde el agua se detiene. La aplicación no
> reclama atención: es un lugar al que ir a pensar.

## Qué hace

- **Diario** de texto libre, varias entradas por día, Markdown ligero, búsqueda.
- **Cuadernos** de notas con enlaces `[[Título]]`, notas fijadas y archivo.
- **Tareas** con proyectos, subtareas, repetición, calendario y una revisión no
  culpabilizadora cuando una tarea se aplaza tres veces.
- **Recordatorios** locales sin proceso residente: se comprueban al abrir y al usar
  la aplicación; nada se marca como «incumplido» por haber estado cerrada.
- **Objetivos** genéricos (proceso, resultado o aprendizaje) con métricas de siete
  tipos, tendencias prudentes, hitos reprogramables con historial y acciones con
  frecuencia semanal («4 de los últimos 7 días», nunca rachas).
- **Cambio conductual** con base en la evidencia revisada en `docs/research/`:
  episodio de impulso (pausa, contexto, vía, espera activa, cierre neutro), planes
  si–entonces con refuerzo a 7 y 14 días, preguntas de apertura, cierre y revisión
  semanal opcionales, revisión de objetivo, medida de automaticidad (SRBAI) y patrón
  de episodios.
- **Seguridad**: SQLCipher (AES-256-CBC + HMAC-SHA512) con clave derivada por
  Argon2id, bloqueo por inactividad, copias cifradas, exportación en claro sólo
  explícita. Sin red, sin telemetría, sin IA.

Todo es opt-in: al instalar, Remanso es un cuaderno vacío.

## Estado

Las seis etapas del plan están implementadas y probadas en macOS y bajo emulación
Linux i686. Falta la validación en el Acer real (tiempos de Argon2, glifos de la
consola, autologin). Véase `docs/performance.md` y `docs/install/antix.md`.

Existe además una **versión web** instalable (móvil y escritorio) con la misma
funcionalidad, el mismo esquema de datos y cifrado local equivalente, en `web/`
(véase `web/README.md` y `web/DESIGN.md`).

## Compilar y ejecutar

```bash
# Rust estable (https://rustup.rs). En este repositorio: ~/.cargo/bin
cargo build --release
./target/release/remanso --dir ~/remanso-pruebas     # datos de prueba aparte
./target/release/remanso --help
```

Binario estático para el Acer (32 bits), construido con Docker:

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/home/rust/src \
  messense/rust-musl-cross:i686-musl cargo build --release
# → target/i686-unknown-linux-musl/release/remanso
```

## Pruebas

```bash
cargo test                                   # unitarias e integración (SQLCipher real)
tools/tui_smoke.py target/release/remanso /tmp/remanso-smoke   # recorrido completo en un pty
tools/perf.py target/release/remanso /tmp/remanso-perf         # arranque, reposo, memoria
```

El script de humo necesita `pyte` (`pip install pyte`).

## Documentación

| Carpeta | Contenido |
|---|---|
| `docs/research/` | Revisión bibliográfica, matriz de evidencia, intervenciones, seguridad psicológica, bibliografía verificada, decisiones de diseño |
| `docs/research/notes/` | Informes temáticos de investigación (A–F) y evaluación técnica (T) |
| `docs/decisions/` | Registro de decisiones de producto (ADR): contexto, decisión, evidencia, dónde |
| `docs/design/ux.md` | Sistema visual, navegación, teclado, tono |
| `docs/architecture/` | Arquitectura y modelo de datos |
| `docs/security/` | Modelo de amenazas, recuperación sin la aplicación, dependencias |
| `docs/install/antix.md` | Instalación offline y arranque sin escritorio en antiX |
| `docs/manual.md` | Guía de uso y atajos |
| `docs/performance.md` | Mediciones y presupuestos |

## Licencia y autoría

Remanso es software libre bajo la **GNU Affero General Public License v3.0 o posterior**
(`LICENSE`). Puedes usarlo, leerlo, modificarlo y redistribuirlo con la misma libertad; si
ofreces una versión modificada como servicio, la AGPL te pide publicar también su código.

Código: <https://github.com/oegea/remanso>.

Lo escribió [Oriol Egea](https://www.oriol.im); existe gracias a las investigadoras e
investigadores citados en `docs/research/`. Se ofrece como regalo: si te sirve, compártelo.
Contacto: imoriol@duck.com.
