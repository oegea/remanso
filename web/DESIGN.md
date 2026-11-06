# Remanso · Sistema de diseño (versión web y móvil)

Versión 1.0 · 2026-11-06 · Vale para toda la interfaz web. Cualquier pantalla que no
pueda explicarse con este documento está mal diseñada o el documento está incompleto.

## 1. Idea

Remanso es un lugar al que ir a pensar. La interfaz no compite por la atención: muestra
lo que la persona ha venido a hacer, lo deja hacer con el mínimo de pasos y se aparta.
El éxito es que la persona viva mejor fuera de la aplicación.

Tres palabras que deben describir cualquier pantalla: **serena, clara, honesta**.

- Serena: pocas cosas a la vista, mucho espacio, movimiento lento y escaso, colores de
  papel y tinta. Nada parpadea, nada insiste, nada celebra.
- Clara: cada pantalla tiene una tarea principal evidente; cada control se ve y se
  entiende sin descubrirlo; cada estado se nombra con palabras.
- Honesta: los datos se muestran como son («4 de los últimos 7 días»), la incertidumbre
  se dice («todavía no hay datos suficientes»), los límites se explican (qué protege el
  cifrado y qué no; qué no es esta aplicación).

Lo que Remanso no es: un panel de métricas, un juego, una red social, un asistente que
opina. No hay puntos, medallas, rachas, confeti, avatares, frases motivacionales ni
mascotas. No hay «¡Genial!». No hay rojo para «fallo».

## 2. Principios de interacción

1. **Foco único.** Una tarea principal por pantalla, arriba y a la izquierda (en móvil,
   arriba). El resto, si existe, es secundario y se ve menos.
2. **Nada escondido.** No hay gestos ocultos ni menús de tres puntos como única vía.
   Toda acción tiene un control visible con texto; los gestos (deslizar) son atajos
   opcionales que duplican un botón.
3. **Opt-in total.** Al instalar no hay objetivos, métricas, recordatorios ni preguntas.
   Cada módulo se activa desde su propio lugar y se desactiva igual de fácil.
4. **Sin reproches ni juicios.** Los huecos son huecos; las tareas vencidas son
   «pendientes»; cerrar un objetivo es una decisión. Nunca «has fallado», «racha rota»,
   «deberías», exclamaciones.
5. **Reversible y seguro.** Guardado automático y continuo. Borrar pide confirmación
   explícita; archivar no borra. Salir nunca pierde texto.
6. **Explicar lo justo.** Cada cifra lleva su frase de contexto («las variaciones de un
   día a otro son normales»). Cada técnica muestra su nivel de evidencia. Las
   explicaciones son cortas, adultas y están donde se necesitan.
7. **Privacidad visible.** La pantalla de bloqueo no muestra nada. Un texto fijo y
   corto, al alcance desde Ajustes y en el primer uso, dice qué se guarda, dónde
   (sólo este dispositivo), cómo (cifrado) y qué pasa si se olvida la contraseña.
8. **Escribir primero.** Abrir la aplicación y escribir en el diario debe costar dos
   toques. El editor es la pantalla más cuidada de todas.

## 3. Lenguaje visual

### 3.1 Color

Papel y tinta. Un único acento, el verde-azulado del agua en calma. Dos modos (claro y
oscuro) que siguen al sistema y se pueden fijar.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#F6F3EC` papel | `#14161A` | fondo de la aplicación |
| `--bg-raised` | `#FFFFFF` | `#1C1F24` | tarjetas, hojas, editor |
| `--bg-sunken` | `#EEEAE1` | `#0F1113` | campos, pistas, zonas secundarias |
| `--ink` | `#1E2126` | `#ECE9E2` | texto principal |
| `--ink-2` | `#5A5F68` | `#A7ACB5` | texto secundario, metadatos |
| `--ink-3` | `#9A9FA8` | `#6B707A` | texto terciario, separadores sutiles |
| `--line` | `#E3DED3` | `#2A2E35` | bordes de 1 px |
| `--accent` | `#2F7F76` agua | `#6FBBB1` | acción principal, selección, foco |
| `--accent-soft` | `#DCEBE8` | `#1F3634` | fondo de chips y estados activos |
| `--warn` | `#9A6B1E` | `#D9A854` | pendientes, avisos, nunca «error moral» |
| `--danger` | `#9B3B3B` | `#D97A7A` | sólo acciones destructivas (borrar) |
| `--done` | `#4E7D4A` | `#8FB98A` | hecho/alcanzado, nunca para «éxito» global |

Reglas:
- El color nunca es el único portador de significado: acompaña a un icono o palabra.
- Máximo tres colores no neutros visibles a la vez.
- Las métricas sensibles (peso, alimentación) y las escalas de ánimo se dibujan sólo con
  `--ink-2` y `--accent`. Sin verde/rojo.
- Contraste mínimo WCAG AA (4,5:1 texto, 3:1 componentes). `--ink-3` sólo para texto
  decorativo no esencial.

### 3.2 Tipografía

Sin fuentes externas: la aplicación no descarga nada. Pilas del sistema.

- **Texto de interfaz**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif`.
- **Lectura y escritura (diario, notas)**: `"Iowan Old Style", "Palatino Linotype",
  Palatino, Charter, Georgia, "Times New Roman", serif` a 18 px en móvil, 19 px en
  escritorio, interlineado 1,6, ancho máximo 36 em. Es la fuente del contenido de la
  persona; la interfaz es sans para que el contenido destaque.
- **Cifras**: `font-variant-numeric: tabular-nums` en listas y métricas.

Escala (móvil / escritorio): 13/13 pie · 15/15 cuerpo · 17/17 destacado · 22/24 título
de pantalla · 28/32 fecha del día en Inicio. Pesos: 400 y 600. Nada en mayúsculas
sostenidas salvo etiquetas de dos letras.

### 3.3 Espacio, forma, profundidad

- Retícula de 4 px; espaciado habitual 8, 12, 16, 24, 32.
- Margen lateral 20 px en móvil, 32 px en escritorio; contenido centrado con ancho
  máximo 680 px (lectura 36 em).
- Radios: 10 px controles, 14 px tarjetas, 20 px hojas inferiores, `9999px` chips.
- Sin sombras duras. Las superficies se distinguen por tono (`--bg-raised` sobre
  `--bg`) y una línea de 1 px `--line`. En oscuro, una sombra muy difusa
  (`0 8px 24px rgba(0,0,0,.35)`) sólo en hojas y diálogos.
- Iconos: trazo de 1,75 px, 20 px, esquinas redondeadas, un solo color (`currentColor`),
  siempre con etiqueta de texto visible o `aria-label`. Conjunto propio y pequeño
  (≈ 24 iconos); sin emojis.

### 3.4 Movimiento

El movimiento explica de dónde viene algo y a dónde va. Nunca decora.

- Duraciones: 160 ms (estados), 240 ms (aparición de hojas y tarjetas), 320 ms
  (transición entre pantallas). Curva `cubic-bezier(.2,.8,.2,1)`.
- Transición entre pantallas: deslizamiento horizontal corto (24 px) + fundido; volver
  atrás invierte la dirección.
- Hojas inferiores: suben desde el borde con amortiguación suave; el fondo se atenúa.
- Listas: los elementos nuevos aparecen con un fundido de 160 ms; los eliminados se
  pliegan en altura.
- Progreso: las barras se rellenan en 320 ms al entrar en pantalla; los números no
  cuentan hacia arriba.
- `prefers-reduced-motion: reduce` desactiva todo desplazamiento y conserva sólo fundidos
  de 120 ms.
- Prohibido: rebotes, confeti, pulsos, parpadeos, animaciones en bucle, «skeletons».
  Única excepción: la guía de respiración del episodio de impulso (`Breath`), que marca
  el ritmo 4 s / 6 s de Laborde et al. (2022). Es contenido, no decoración: se detiene al
  salir y con `prefers-reduced-motion` sólo alterna el texto «Inspira» / «Espira»
  brillantes. Un indicador de espera es un círculo fino que gira despacio.
  Segunda excepción, decorativa y acotada: la marca con olas (`WaveMark`) en la pantalla
  de bloqueo y en la presentación, donde no compite con ningún contenido. Dos líneas que
  derivan a 9 s y 15 s por periodo, amplitud mínima, sin costura; con
  `prefers-reduced-motion` queda quieta. Es la misma marca, con el mismo movimiento, en la
  barra lateral de escritorio y centrada sobre la fecha de Hoy en móvil (decisión del autor,
  2026-11-06: la marca ha de ser una sola en toda la app). Las dos líneas van a velocidades
  distintas a propósito: leídas como dos capas de agua con profundidad; a la misma velocidad
  parecerían una línea doblada. No se usa en ninguna otra cabecera.

### 3.5 Tono de los textos

Español, tú, frases cortas, sin exclamaciones ni emojis. Describe, pregunta, ofrece.
Mismo vocabulario que la versión de terminal (`src/text.rs`) y mismas reglas de
`docs/research/safety.md` §4: evitar «fracaso», «fallo», «racha rota», «deberías»,
«otra vez», «días perdidos»; preferir «pendiente», «reanudar», «esta semana»,
«4 de 7», «variación normal», «pausar».

## 4. Estructura de la aplicación

### 4.1 Navegación

Móvil (< 720 px): barra inferior de cinco destinos con icono y texto, siempre visible
salvo en el editor a pantalla completa: **Hoy · Diario · Cuadernos · Objetivos · Más**.
«Más» agrupa Tareas, Recordatorios, Revisión, Impulso, Buscar y Ajustes en una lista
clara (no un menú contextual). El botón **Impulso** también está en Hoy, grande, porque
debe alcanzarse en un toque cuando hace falta.

Escritorio (≥ 720 px): barra lateral izquierda de 240 px con los mismos destinos, todos
visibles, sin agrupar.

Profundidad máxima: tres niveles (destino → elemento → detalle). Cada pantalla interior
tiene un botón «Atrás» con texto a la izquierda de la cabecera. El botón del sistema
(Android, gesto iOS, tecla del navegador) hace lo mismo: las pantallas tienen URL.

### 4.2 Cabecera

Una línea: «Atrás» (si procede) · título · hasta dos acciones con texto o icono
etiquetado. El título es el nombre de la cosa, no una descripción. Sin subtítulos
motivacionales. Debajo, cuando hace falta, un segmento de pestañas (máximo cinco,
desplazable en móvil).

En los editores (diario, nota) y en las fichas (tarea), el título **se edita tocándolo**:
es un campo que parece un título (`.title-input`), guarda al salir o con Enter, y no hay
botón «Título». Las acciones secundarias (etiquetas, fijar, mover, archivar, borrar)
viven en una hoja de opciones abierta desde «···» en la cabecera, nunca en una fila de
chips bajo ella. Cada entidad con lista propia (proyecto, cuaderno) es una pantalla con
«Atrás», no una pestaña.

### 4.3 Pantallas

**Bloqueo.** Centrado: «Remanso», la fecha, un campo de contraseña con botón «Mostrar»,
«Entrar». Nada más. Debajo, en `--ink-3`: «Todo se guarda cifrado en este dispositivo.
Si olvidas la contraseña, los datos no se pueden recuperar.» Error: «Contraseña
incorrecta.» en `--warn`, sin contar intentos.

**Primer uso.** Tres pasos en una hoja: (1) qué es y qué no es Remanso (texto de
`safety.md` §1.3 más el aviso de emergencia: «Si estás en peligro, llama al 112 o a una
persona de confianza; en España, el 024 atiende la conducta suicida las 24 horas»), un
único botón «Entendido»; (2) contraseña y repetición, con la advertencia de pérdida; (3)
tema. Fin. Se entra en Hoy, vacío.

**Hoy.** La fecha, grande. Después, sólo si existe cada cosa: «Escribir» (acceso al
diario con la última entrada en una línea neutra), recordatorios pendientes (máximo
tres), acciones de hoy con sus puntos, «Revisión disponible», objetivos activos en una
línea. Botón **Impulso** fijo abajo a la derecha (acción flotante, único elemento
flotante de la aplicación). Vacío de verdad en el primer uso: fecha, «Escribir», y una
frase: «Esto es tu Hoy. Se irá llenando sólo con lo que tú añadas».

**Editor (diario y notas).** Pantalla completa, sin barra inferior. Arriba: «Listo»
(guarda y vuelve), fecha/título, contador de palabras y estado «Guardado». Cuerpo:
texto serif, márgenes generosos, cursor al final al abrir una entrada existente.
Teclado móvil: el área de texto crece con el contenido; la barra superior permanece
fija; una fila opcional sobre el teclado con «Título», «Etiquetas», «Fecha» (iconos con
texto). Markdown ligero: `#`, `-`, `>` se resaltan sin convertir. Autoguardado a los
2 s y al perder el foco. Modo lectura (sin cursor) para releer. Ninguna pregunta
aparece sola; las preguntas opcionales se abren desde un botón «Pregunta» que el usuario
toca.

**Listas (diario, notas, tareas, objetivos).** Una fila por elemento, dos líneas máximo:
principal y metadatos en `--ink-2`. Agrupación por fecha con cabeceras pequeñas. Acción
de crear como botón visible arriba a la derecha («Nueva entrada»), nunca sólo flotante.
Deslizar a la izquierda muestra «Archivar» y «Borrar» como botones; el mismo menú
existe en el detalle.

**Objetivo.** Cabecera con nombre y estado. Pestañas: Resumen · Métricas · Hitos ·
Acciones · Planes. Resumen muestra «Por qué», «Cuándo y dónde», «Cómo sabré que va
bien» como bloques editables al tocar. Métricas: tarjeta por métrica con último valor,
«registrar» como botón primario y sparkline en `--accent`; el detalle muestra la
tendencia (línea) con los puntos crudos en `--ink-3`, el texto de N mínimo y la frase
fija sobre variaciones. Acciones: fila con la semana en puntos (● hecho · sin registro ○
marcado no hecho) y «2 de 3 esta semana»; tocar el punto de hoy cicla el estado.

**Impulso.** Secuencia a pantalla completa, un paso por pantalla, botón «Siguiente» y
«Guardar y salir» siempre visibles, barra de progreso discreta arriba (puntos, no
porcentaje). La espera activa muestra la vía elegida y el tiempo transcurrido en
minutos, nunca una cuenta atrás ni un anillo que se vacía. Las intensidades 0–10 son
un control deslizante grande con el número visible y un botón «Omitir».

**Revisión.** Lista de sesiones con su estado en palabras. Sesión: una pregunta por
pantalla, campo de respuesta serif, «Omitir» y «Siguiente», «Terminar aquí» siempre
disponible; máximo tres preguntas por pantalla cuando son de opción.

**Ajustes.** Lista agrupada: Aspecto · Preguntas y revisiones · Seguridad (bloqueo,
contraseña) · Datos (copia cifrada: descargar / restaurar; exportación en claro con
confirmación en dos pasos; verificar) · Técnicas y su evidencia · Si necesitas ayuda ·
Acerca de (qué es, qué no es, dónde están los datos).

### 4.4 Componentes

- **Botón primario**: fondo `--accent`, texto blanco, 44 px de alto mínimo, texto en
  minúsculas con mayúscula inicial. Uno por pantalla.
- **Botón secundario**: borde `--line`, texto `--ink`. **Botón de texto**: sólo texto en
  `--accent`. **Destructivo**: texto `--danger`, nunca relleno.
- **Chip**: estado o etiqueta, `--accent-soft` cuando está activo. No es un botón de
  acción ni un campo: para eso están la fila «etiqueta · valor ›» y la hoja de opciones.
- **Fila de lista** (`.list-item`): 56 px, separador alineado con el texto; el fondo del
  hover respira 12 px a cada lado sin mover el contenido. En una ficha, la fila
  «etiqueta · valor ›» abre la hoja que cambia ese dato.
- **Sesión de meditación** (`MeditateSession`): pantalla completa sin barras; una línea
  con la parte actual y puntos de progreso; en el centro, el círculo de respiración o una
  sola frase en serifa; el tiempo restante en `--ink-3`; abajo, Pausar y Terminar. Nada
  más: la pantalla está pensada para no mirarse. La voz guía dice la versión larga y
  explicativa de cada frase; en pantalla sólo cabe la corta.
- **Minirreproductor** (`MiniPlayer`): sólo existe mientras hay un sonido elegido. Una
  línea sobre la barra inferior en móvil (nombre, estado o tiempo hasta el apagado,
  pausa, siguiente, parar; volumen a partir de 480 px) y un bloque al pie de la barra
  lateral en escritorio. Parar lo quita. Nunca aparece solo ni suena nada sin un toque.
- **Baldosa y barras** (`Tile`, `HBars`): cifra grande con pie, y barras horizontales en un
  solo tono (`--accent`; gris `--ink-3` para la referencia pasada) con etiqueta y valor en
  texto. Nunca colores de fallo ni porcentajes de éxito.
- **Hoja inferior**: para elegir entre opciones y para formularios cortos; siempre con
  título y botón «Cancelar»; cierra con Escape, con el gesto y con el botón.
- **Diálogo de confirmación**: título como pregunta, una frase de consecuencia, dos
  botones (destructivo a la derecha en `--danger`). Nunca para información.
- **Aviso en línea** (`--bg-sunken`, borde izquierdo de 2 px): para los textos de
  seguridad y los límites. Se cierra con un botón y recuerda que se cerró.
- **Campo**: etiqueta encima, siempre visible; ayuda debajo en `--ink-2`; error en
  `--warn` con texto, no sólo color. Fecha y hora con entradas nativas más atajos en
  chips («hoy», «mañana», «lunes»).
- **Control deslizante 0–10**: pista fina, pulgar de 28 px, número grande encima.
- **Sparkline / línea**: trazo de 1,5 px `--accent`; puntos crudos de 3 px `--ink-3`;
  ejes sin rejilla; etiquetas mínimas. Siempre acompañado de la frase de contexto.
- **Puntos de semana**: siete círculos de 10 px con las iniciales L M X J V S D debajo.
- **Barra de progreso de hito**: 4 px, `--accent` sobre `--bg-sunken`, texto del lado
  pequeño («llevas 3 de 10» / «faltan 2 de 10»).

## 5. Accesibilidad

- Toda la aplicación se usa con teclado: orden lógico, foco visible (anillo de 2 px
  `--accent` con 2 px de separación), Escape cierra hojas y diálogos, atajos opcionales
  en escritorio (n nuevo, / buscar, Esc atrás) anunciados en Ayuda.
- HTML semántico: `main`, `nav`, `h1` por pantalla, listas reales, botones reales.
  Nada clicable que no sea `button` o `a`.
- Objetivos táctiles de 44×44 px mínimo; separación de 8 px.
- Lectores de pantalla: cada icono tiene nombre; los cambios de estado (guardado,
  registrado) se anuncian en una región `aria-live="polite"`; las gráficas tienen una
  alternativa textual que es el texto que ya se muestra.
- Zoom y tamaño de texto del sistema respetados (unidades `rem`, sin alturas fijas).
- `prefers-reduced-motion`, `prefers-color-scheme` y `prefers-contrast` respetados.
- Idioma declarado (`lang="es"`), texto plano, sin mayúsculas sostenidas.

## 6. Privacidad y datos en la interfaz

- Un texto fijo, visible en el primer uso y en Ajustes → Acerca de: «Remanso guarda todo
  en este dispositivo, cifrado con tu contraseña. No hay servidor, no hay cuenta, nada
  se envía a ningún sitio. Si borras los datos del navegador o pierdes el dispositivo sin
  copia, se pierden. Si olvidas la contraseña, no se pueden recuperar.»
- Copia de seguridad: un botón descarga un único fichero cifrado con los parámetros de
  derivación dentro; otro lo restaura. La exportación en claro avisa dos veces.
- La pantalla de bloqueo y la vista previa del sistema (cambio de aplicación) no muestran
  contenido: al perder la visibilidad la aplicación se bloquea tras el tiempo configurado
  y, mientras, cubre el contenido con un velo neutro.
- No hay analítica, ni fuentes externas, ni iconos remotos, ni peticiones de red tras la
  carga. El manifiesto y el service worker sólo sirven la propia aplicación sin conexión.

## 7. Salud y límites en la interfaz

Los mismos textos que la versión de terminal, en los mismos lugares, más uno:

- **Primer uso (una vez)**: «Remanso es un cuaderno personal de notas, objetivos y
  hábitos. No es un servicio sanitario: no diagnostica, no trata y no sustituye a un
  profesional de la salud. Las técnicas proceden de la investigación en autoayuda; sus
  efectos suelen ser modestos y varían de una persona a otra. Si lo que quieres cambiar
  afecta a tu salud, o te preocupa, un profesional puede acompañarte mejor que esta
  aplicación. Si estás en peligro, llama al 112 o a una persona de confianza. En España,
  el 024 atiende la conducta suicida las 24 horas, gratis y de forma confidencial.»
- **Al activar el módulo de objetivos** (una vez): texto de `safety.md` §1.3.
- **Categorías de riesgo** (una vez por objetivo): mensaje de derivación de `safety.md`
  §3.3 con sus líneas específicas.
- **Métricas sensibles** (una vez): texto de `safety.md` §5.6.
- **Si necesitas ayuda**: siempre accesible desde Ajustes y desde la pantalla de
  impulso.

Estos avisos son avisos en línea con botón «Entendido», no diálogos modales
bloqueantes salvo el del primer uso.

## 8. Lo que este documento prohíbe

Gamificación (puntos, niveles, insignias, rachas de días, confeti), comparaciones con
otras personas, porcentajes de «éxito» coloreados, cuentas atrás, notificaciones
insistentes, textos con exclamaciones, emojis, degradados llamativos, sombras duras,
tipografías decorativas, animaciones en bucle, pantallas de carga con frases, consejos
no solicitados, cualquier inferencia sobre el estado mental de la persona, cualquier
petición de red.
