# Diseño de experiencia e interfaz (TUI)

Estado: borrador v0.1 — se refinará con los hallazgos de `docs/research/`.

## 1. Nombre y carácter

Nombre de trabajo: **Remanso** (binario `remanso`). Un remanso es el tramo de un río
donde el agua se detiene y se calma. El nombre describe la intención del producto:
un lugar al que ir a pensar, no una herramienta que reclama atención.

Tono: sereno, adulto, directo. Sin exclamaciones, sin emojis, sin felicitaciones
automáticas, sin «¡Ánimo!». Los textos informan y preguntan; nunca evalúan.

## 2. Restricciones de diseño

- Terminal de **80 × 24** como tamaño mínimo garantizado; 100 × 30 como tamaño
  de referencia; tamaños mayores aprovechan el espacio sin cambiar la estructura.
- Consola Linux (`TERM=linux`, 16 colores, fuente de consola con cobertura
  Unicode limitada) como entorno más restrictivo. Todo lo que se dibuja con
  caracteres de caja o bloques debe tener alternativa ASCII (`--ascii` o
  detección por `TERM`/`LANG`).
- Sin ratón. Todo accesible con teclado.
- Sin animaciones ni temporizadores de refresco. Se redibuja sólo ante eventos.

## 3. Sistema visual

### Paleta (16 colores ANSI, semántica)

| Rol               | Oscuro (por defecto) | Claro        | Uso                                      |
|-------------------|----------------------|--------------|------------------------------------------|
| texto             | default              | default      | contenido                                |
| atenuado          | dark gray            | gray         | metadatos, fechas, ayuda                 |
| acento            | cyan                 | blue         | título de pantalla, elemento seleccionado|
| énfasis           | bold                 | bold         | títulos de nota, nombres de objetivos    |
| aviso             | yellow               | yellow       | pendientes, recordatorios vencidos       |
| alerta            | red                  | red          | sólo acciones destructivas               |
| positivo          | green                | green        | completado (nunca para «racha»)          |

Reglas:
- El color nunca es el único portador de significado: siempre va acompañado de un
  glifo o palabra (`●`/`○` + «hecha»/«pendiente»).
- Máximo tres colores visibles simultáneamente en una pantalla, además del texto.
- Rojo reservado a confirmar borrados o a errores reales. Nunca para «no cumplido».

### Glifos (con alternativa ASCII)

| Significado         | Unicode | ASCII |
|---------------------|---------|-------|
| marco               | ╭─╮│╰╯  | +-+|  |
| separador           | ─       | -     |
| hecho / pendiente   | ● ○     | * o   |
| barra de progreso   | █▓░     | #=-   |
| sparkline           | ▁▂▃▄▅▆▇ | .:-=+*#|
| selección           | ▍ (margen) | > |
| truncado            | …       | ...   |

### Composición

Toda pantalla sigue la misma estructura vertical:

```
 Remanso · Diario                                    mié 5 nov 2026   ← 1 línea: módulo + fecha
 ─────────────────────────────────────────────────────────────────
 (contenido)                                                        ← 21 líneas en 80×24
 ─────────────────────────────────────────────────────────────────
 n nueva  ↵ abrir  / buscar  Esc volver  ? ayuda                    ← 1 línea: acciones contextuales
```

- Margen interior de 1 columna a cada lado. Sin marcos dobles ni cajas anidadas.
- Las listas usan una línea por elemento con metadatos atenuados a la derecha.
- Un único panel por pantalla en 80 columnas. A partir de 100 columnas, el diario
  y los cuadernos pueden mostrar lista + vista previa en dos columnas.
- La línea inferior de acciones muestra entre 4 y 6 teclas, nunca más.

### Estados vacíos

Cada módulo vacío muestra dos o tres líneas: qué es, qué tecla crea el primer
elemento. Sin ilustraciones ASCII, sin tono motivacional.

```
 Todavía no hay entradas.
 Pulsa  n  para escribir la primera.
```

## 4. Mapa de navegación (poca profundidad)

```
Bloqueo ──▶ Inicio
             ├─ d  Diario ──── entrada (editor)
             ├─ c  Cuadernos ─ cuaderno ── nota (editor)
             ├─ t  Tareas ──── tarea
             ├─ o  Objetivos ─ objetivo ── métricas / hitos / acciones / planes / revisión
             ├─ i  Impulso (acceso inmediato a la intervención configurada)
             ├─ r  Revisión (apertura / cierre / semanal, según lo configurado)
             ├─ /  Búsqueda global
             ├─ ,  Ajustes
             └─ ?  Ayuda
```

Profundidad máxima: 3 niveles (Inicio → módulo → elemento). Las vistas de detalle
del objetivo son pestañas horizontales, no niveles adicionales.

## 5. Teclado

Principios: una tecla por acción frecuente, mnemónica en español, coherente en todas
las pantallas, sin combinaciones con Alt (no fiables en consola Linux).

Globales (siempre):

| Tecla        | Acción                                            |
|--------------|---------------------------------------------------|
| `Esc`        | Volver / cancelar (nunca pierde texto escrito)     |
| `?`          | Ayuda contextual                                   |
| `/`          | Buscar en el módulo actual; desde Inicio, global   |
| `Ctrl+L`     | Bloquear ahora                                     |
| `Ctrl+Q`     | Guardar y salir                                    |
| `Ctrl+S`     | Guardar (el guardado también es automático)        |

Listas:

| Tecla          | Acción                 |
|----------------|------------------------|
| `j`/`↓` `k`/`↑`| mover                  |
| `↵`            | abrir                  |
| `n`            | nuevo                  |
| `e`            | editar                 |
| `x`            | archivar (reversible)  |
| `D`            | borrar (pide confirmar)|
| `g` / `G`      | principio / fin        |

Editor:

- Edición directa (no modal): flechas, Inicio/Fin, PgUp/PgDn, `Ctrl+←/→` por palabra,
  `Ctrl+Z` deshacer, `Ctrl+Y` rehacer.
- `Ctrl+F` modo escritura: oculta cabecera y pie; sólo texto con márgenes.
- `Esc` sale del editor **guardando**. Nunca hay un «¿descartar cambios?» porque
  el texto siempre se conserva; para deshacer hay historial.
- Guardado automático a los 2 s de inactividad de escritura y al salir.

## 6. Flujos de referencia (criterio de «pocos segundos»)

| Tarea                               | Pulsaciones desde Inicio             |
|-------------------------------------|--------------------------------------|
| Escribir una reflexión               | `d` `n` … `Esc` (3 + texto)          |
| Registrar una medición               | `o` `↵` `m` valor `↵`                |
| Añadir una tarea                     | `t` `n` texto `↵`                    |
| Abrir intervención ante un impulso   | `i` (1 pulsación; luego pasos opcionales) |
| Recuperar una nota antigua           | `/` texto `↵` `↵`                    |
| Bloquear                             | `Ctrl+L`                             |

## 7. Pantalla de bloqueo

Muestra únicamente: nombre de la aplicación, fecha, campo de contraseña (asteriscos o
nada, configurable). No muestra número de entradas, objetivos ni recordatorios.
Tras un fallo: «Contraseña incorrecta» sin más detalle. Sin límite de intentos
(no hay nada que proteger de fuerza bruta en pantalla que no proteja ya Argon2id
sobre el fichero; un bloqueo de intentos sólo molestaría al propietario).

## 8. Inicio

Configurable por secciones, todas ocultables desde Ajustes. Orden por defecto:

1. Fecha y, si existen, recordatorios pendientes (máximo 3 visibles; «y 2 más»).
2. Accesos: Diario · Cuadernos · Tareas · Objetivos.
3. «Hoy»: acciones pequeñas del día (sólo las que el usuario haya definido).
4. Objetivos activos con una línea de estado neutra («última medición hace 3 días»).
5. Revisión programada si toca («Revisión semanal disponible»), nunca como aviso
   insistente.

En una primera ejecución, Inicio sólo muestra la fecha, los accesos y una línea de
ayuda. Nada más aparece hasta que el usuario crea contenido o activa módulos.

## 9. Onboarding (menos de un minuto)

1. Elegir contraseña (dos veces) + aviso explícito: «Si la olvidas, los datos no se
   pueden recuperar. Remanso no guarda ninguna copia de la contraseña.»
2. Elegir tema (oscuro/claro/automático) y juego de caracteres (Unicode/ASCII) con
   una vista previa de una línea.
3. Fin. Se entra en Inicio con el diario y los cuadernos disponibles. Tareas,
   objetivos, revisiones y recordatorios se activan la primera vez que se usan.

No se crean objetivos, categorías, recordatorios ni preguntas por defecto.

## 10. Lo que la interfaz nunca hace

- Mostrar «racha rota», «has fallado», «llevas N días sin…» con tono de reproche.
  La información equivalente se presenta como hecho neutro: «Última entrada: hace 9 días».
- Insertar confeti, medallas o puntos.
- Interrumpir la escritura con preguntas o avisos.
- Mostrar estadísticas que el usuario no haya pedido.
- Copiar al portapapeles ni exportar sin confirmación explícita.
