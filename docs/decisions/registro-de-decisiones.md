# Registro de decisiones

Formato de cada entrada: **Contexto** (qué problema o petición había), **Decisión**,
**Evidencia** (referencias de `docs/research/references.md`) y **Dónde** (código). Las
fechas son las de la decisión. Todas las decisiones respetan la regla de `README.md`:
la evidencia manda.

## ADR-001 · Autoperdón sin presuponer culpa (2026-11-06)

- **Contexto.** La revisión de una tarea aplazada y la pantalla de desliz ofrecían frases
  del tipo «Me perdono por…». Una frase así presupone culpa y puede inducirla en quien no
  la sentía.
- **Decisión.** Las frases de autoperdón son condicionales y opcionales: sólo se ofrecen
  «si notas culpa o malestar», y no afirman que haya nada que perdonar. Ejemplo: «Un
  impulso no me hace peor persona. Si noto culpa, puedo soltarla: ahora sé qué lo hizo
  difícil».
- **Evidencia.** Wohl, Pychyl & Bennett (2010) midieron el autoperdón en quien ya se
  sentía culpable; Sirois (2014) y la nota E §6 advierten de que una autocompasión mal
  formulada suena a permiso.
- **Dónde.** `src/text.rs` (terminal y web comparten los textos).

## ADR-002 · Sin categoría «dejar de tener pensamientos de muerte» (2026-11-06)

- **Contexto.** Una categoría de objetivo así banaliza algo complejo, como si fuera una
  meta para mañana.
- **Decisión.** Se retira de las categorías visibles; «dejar de hacerme daño» basta. El
  valor interno se conserva para no romper bases antiguas. La señal de derivación (112,
  024) se mantiene por otras vías.
- **Evidencia.** `docs/research/safety.md` §3.2.
- **Dónde.** `CATEGORIES` en ambas versiones; `docs/architecture/data-model.md`.

## ADR-003 · Los avisos de seguridad nunca en un toast (2026-11-06)

- **Contexto.** El aviso de derivación tras un episodio con apuesta o daño salía en un
  toast que cortaba el texto.
- **Decisión.** Todo aviso de seguridad o con texto largo va en una hoja o en un bloque en
  línea con botón «Entendido». El toast se reserva a confirmaciones breves y envuelve el
  texto.
- **Evidencia.** `safety.md` §4: el aviso debe poder leerse entero y conservar el 024.
- **Dónde.** `web/src/domain/safety.ts`; hojas en el episodio y en la preparación.

## ADR-004 · Histórico de impulsos legible y comparación sólo con uno mismo (2026-11-06)

- **Contexto.** Los episodios de impulso se registraban pero eran difíciles de encontrar.
- **Decisión.** Pantalla «Episodios de impulso» con la lista (fecha, objetivo, vía,
  intensidad antes → después, resultado), detalle en hoja, resumen de 30 días y
  comparación descriptiva con los 30 anteriores. Recuentos y medias; nunca porcentajes de
  «éxito», colores de fallo ni comparación con otras personas.
- **Evidencia.** Monitorizar el progreso mejora el logro (Harkin et al., 2016, d+ = 0,40) y
  comparar con la propia referencia pasada funciona (d+ = 0,43); el feedback ha de ser
  informativo, no evaluativo (Kluger & DeNisi, 1996), sin recompensas tangibles (Deci et
  al., 1999). Nota B: guardar intensidad inicial y final para que la persona vea su curva,
  recordando que el impulso puede no bajar.
- **Dónde.** `web/src/screens/ImpulseHistory.tsx`, `web/src/domain/impulses.ts`
  (`pattern`, `recent` con ventana acotada).

## ADR-005 · Respiración guiada 4 s / 6 s (2026-11-06)

- **Contexto.** Contar segundos mientras se respira es una carga.
- **Decisión.** Un círculo que crece cuatro segundos y decrece seis, con «Inspira» /
  «Espira»; con `prefers-reduced-motion` sólo alterna el texto. En la vía «respirar» y en
  el tercer paso de «surfear». No se añade a vías que piden atención fuera de la pantalla.
  Es la primera excepción a la regla «sin animaciones en bucle» de `web/DESIGN.md` §3.4.
- **Evidencia.** Laborde et al. (2022): respiración lenta con espiración más larga.
- **Dónde.** `web/src/ui/Breath.tsx`.

## ADR-006 · Uso con acompañamiento profesional (2026-11-06)

- **Contexto.** Quien usa Remanso con un profesional de la salud mental no necesita los
  avisos completos cada vez.
- **Decisión.** Opción en Ajustes con confirmación expresa. Los avisos se acortan pero no
  desaparecen: el 112 se conserva, igual que los matices médico (sustancias) y de
  autocuidado (alimentación), y se repiten tras apuesta o daño. La bandera vive en la base
  cifrada. Sólo en la web; la terminal muestra siempre los avisos completos.
- **Evidencia.** `safety.md` §3.4.
- **Dónde.** `web/src/screens/Settings.tsx`, `web/src/domain/safety.ts`.

## ADR-007 · Presentación inicial en primera persona y licencia AGPL (2026-11-06)

- **Contexto.** El primer arranque debe explicar por qué existe la aplicación: nace del
  conocimiento que la comunidad científica publicó; ayuda sin distracciones, sin vender
  nada y sin enganchar a nadie; cada cual es dueño de sus actos y de su atención; se
  ofrece como regalo; sin telemetría ni servidores; copias de seguridad; aviso de salud al
  final.
- **Decisión.** Siete pasos con animación suave y «Siguiente», saltables salvo el aviso de
  salud, repetibles desde Ajustes → Acerca de. La voz es la del autor y nada se inventa
  sobre él. Licencia AGPL-3.0-or-later (`LICENSE`, `Cargo.toml`, `web/package.json`), con
  enlace al repositorio público en la explicación de la licencia, como pide la AGPL.
- **Evidencia.** `safety.md` §1.3 (aviso de salud) y §5.1 (todo opt-in).
- **Dónde.** `web/src/text/about.ts`, `web/src/screens/FirstUse.tsx`, `Settings.tsx`.

## ADR-008 · Tono de las explicaciones (2026-11-06)

- **Contexto.** «Técnicas y su evidencia» y varias pantallas estaban escritas para
  especialistas, en frases telegráficas.
- **Decisión.** El tono de la presentación rige toda explicación: entender bien las cosas,
  no dar nada por hecho, párrafos claros antes que listas, un ejemplo donde haga falta
  (planes si–entonces). Cada técnica lleva qué es, cómo se usa aquí, qué se sabe y qué no,
  y una leyenda de lo que significa la confianza.
- **Dónde.** `web/src/text/help.ts`, catálogo en `web/src/text/builtin.json`.

## ADR-009 · Reglas de carga de las revisiones (2026-11-06)

- **Contexto.** Más cuestionarios al día bajan el cumplimiento. Apertura (2 preguntas),
  cierre (3) y semanal (hasta 6) vienen apagados.
- **Decisión.** Una sesión de cada tipo al día. Apertura y cierre pueden convivir (cinco
  preguntas, por debajo de las seis de la semanal) sólo si la persona enciende ambos
  conjuntos a sabiendas; la semanal cuenta como la sesión de su día. Hoy propone la
  apertura al abrir la aplicación (antes de las 20:00) y el cierre a partir de las 20:00,
  siempre con «Ahora no» (recordado ese día) y acceso manual desde Revisión.
- **Evidencia.** Vachon et al. (2019) y Smyth et al. (2018): menos evaluaciones por día,
  más cumplimiento; `interventions.md` («no ambas por defecto»).
- **Dónde.** `web/src/domain/reviews.ts` (`doneToday`, `dismissed`), `Today.tsx`.

## ADR-010 · Cada dato introducido tiene un sitio donde leerse (2026-11-06)

- **Contexto.** Las respuestas de apertura, cierre y semanal se guardaban pero no podían
  releerse en ninguna pantalla; si un dato no se puede leer, la persona no sabe para qué
  sirve.
- **Decisión.** Revisión → «Sesiones anteriores» (fecha, tipo, respuestas); Hoy muestra
  «Tu apertura / Tu cierre de hoy»; la automaticidad aparece en la tarjeta de la acción. La
  tabla `docs/architecture/donde-se-lee-cada-dato.md` se mantiene al día con cada dato.
- **Dónde.** `reviews.history`, `Review.tsx`, `Today.tsx`, `Goals.tsx`.

## ADR-011 · Explicaciones en hoja, no desplegadas; resúmenes con pantalla propia (2026-11-06)

- **Contexto.** Los bloques plegables movían la página (layout shift) y el patrón de
  impulsos pedía dos toques para llegar a la lista.
- **Decisión.** Toda explicación larga se abre en una hoja modal (`Intro`, icono de ayuda
  en la cabecera). Un resumen y su listado viven en una pantalla propia: Impulsos muestra
  el resumen de 30 días, la comparación y la lista, con «Preparar» en la cabecera.
- **Dónde.** `web/src/ui/Intro.tsx`, `ImpulseHistory.tsx`, `Review.tsx`.

## ADR-012 · Las tareas hechas no desaparecen (2026-11-06)

- **Contexto.** Al marcar una tarea, la fila se esfumaba.
- **Decisión.** El cambio se guarda al momento, pero la fila se queda un instante: el
  punto se rellena, el título se tacha con una línea que crece, la fila se atenúa y se
  pliega en altura; después aparece con un fundido bajo «Hechas hoy», al final de su vista
  (máximo diez). Reabrir hace el camino inverso. Con `prefers-reduced-motion`, sólo
  fundidos cortos.
- **Evidencia.** `web/DESIGN.md` §3.4: el movimiento explica de dónde viene algo y a dónde
  va; los elementos eliminados se pliegan.
- **Dónde.** `web/src/screens/Tasks.tsx` (`TaskRow`), `web/src/domain/tasks.ts`
  (`doneToday`), `web/src/styles/app.css`.

## ADR-013 · Marca con olas (2026-11-06)

- **Contexto.** La aplicación necesitaba una marca reconocible y coherente en bloqueo,
  presentación, barra lateral y Hoy en móvil.
- **Decisión.** Dos líneas de onda que derivan a 9 s y 15 s por periodo, amplitud mínima,
  bucle sin costura, quietas con `prefers-reduced-motion`. Las velocidades son distintas a
  propósito: leídas como dos capas de agua con profundidad; a la misma velocidad
  parecerían una línea doblada. En móvil sólo la ola, centrada, dentro del aire que ya
  tenía la fecha de Hoy. Segunda y última excepción a «sin animaciones en bucle».
- **Dónde.** `web/src/ui/Wave.tsx`, `web/DESIGN.md` §3.4.

## ADR-014 · Criterio de interfaz: experiencia, limpieza, movimiento con sentido, coherencia (2026-11-06)

- **Contexto.** Cubrir la funcionalidad no basta; varias pantallas se habían dado por
  hechas sin recorrerlas como usuario (hover pegado al texto, ficha de tarea a base de
  chips, proyecto como pestaña, salto al marcar una tarea).
- **Decisión.** Cada pantalla se recorre en móvil y escritorio antes de darse por hecha.
  Reglas derivadas: el título de una entidad se edita tocándolo; cada entidad con pantalla
  propia y «Atrás» (proyecto en `/tareas/proyecto/:id`, con opciones de nombre, archivo y
  borrado); el fondo del hover respira 12 px sin mover el contenido; nada desaparece de
  golpe; los resúmenes son visuales (baldosas y barras en un solo tono, sin colores de
  fallo); una fila por dato con etiqueta, valor y chevron en las fichas; las acciones
  secundarias de un editor (etiquetas, fijar, mover, archivar, borrar) van en una hoja de
  opciones («···»), no en una fila de chips bajo la cabecera.
- **Evidencia.** `web/DESIGN.md` §3.1 (color) y §3.4 (movimiento); `interventions.md` §a
  (mínima fricción).
- **Dónde.** `Tasks.tsx` (`ProjectTasks`, `TaskDetail`, `FieldRow`), `DiaryEntry.tsx`,
  `NoteEntry.tsx`, `ui/Chart.tsx` (`HBars`, `Tile`), `styles/app.css`.

## ADR-015 · El foco vuelve al botón un tick después de cerrar una hoja (2026-11-06)

- **Contexto.** Al crear una tarea con Enter, la hoja se cerraba, el foco volvía al botón
  que la abrió antes de que terminara la pulsación y la hoja se reabría vacía.
- **Decisión.** La devolución del foco se difiere con `setTimeout(…, 0)`.
- **Dónde.** `web/src/ui/Sheet.tsx`.

## ADR-016 · Sonidos de fondo sintetizados, opcionales y sin promesas (2026-11-06)

- **Contexto.** Poder poner lluvia, ruido continuo o un ambiente mientras se escribe, para
  calmarse o para dormir. Debe ser invisible para quien no lo use, funcionar sin conexión
  y no cargar el repositorio con audio ni licencias.
- **Decisión.** Sección «Sonidos» (en Más) con once ambientes que la propia aplicación
  sintetiza con Web Audio: ruidos blanco, rosa, marrón y gris; lluvia suave, intensa y
  tormenta lejana; olas, viento, arroyo y fuego. Capas de ruido filtrado en bucle sin
  costura, vaivenes lentos y ráfagas programadas con semilla fija: cero bytes, sin
  repetición audible, sin licencias. Filtro por uso (escribir, calmarse, dormir),
  temporizador de apagado con fundido (30, 60, 90 min) y minirreproductor que sólo existe
  mientras hay un sonido elegido (pausa, siguiente, parar, volumen), sobre la barra
  inferior en móvil y al pie de la barra lateral en escritorio. Controles del sistema por
  Media Session; sigue sonando con la aplicación bloqueada. Nada suena sin un gesto; sin
  recomendaciones ni inferencia de estado de ánimo. Pistas musicales (fase posterior) irán
  bajo demanda y con licencia propia, nunca dentro de la AGPL.
- **Evidencia.** Calmarse: música lenta y sonidos de naturaleza reducen ansiedad y
  activación (de Witte et al., 2020; Buxton et al., 2021). Dormir: el ruido continuo ayuda
  a conciliar el sueño en entornos ruidosos; ruido rosa con estudios pequeños favorables.
  Escribir o concentrarse: la música de fondo no mejora leer ni escribir aunque sí el
  ánimo (Kämpfe et al., 2011). Por eso la interfaz habla de «ambiente», no de técnica, y
  no afirma mejoras de concentración. Límite declarado: en iOS una web instalada deja de
  sonar con la pantalla apagada.
- **Dónde.** `web/src/audio/` (`synth.ts` generadores puros con pruebas, `catalog.ts`,
  `engine.ts`, `player.ts`), `web/src/screens/Sounds.tsx`, `web/src/ui/MiniPlayer.tsx`.

## ADR-017 · Sección de meditación: calma y atención, por sí misma (2026-11-06)

- **Contexto.** Una sección para meditar por meditar, separada de los impulsos y de los
  objetivos: explicar qué es y qué se sabe, la actitud (los pensamientos vienen y van; no
  se trata de poner la mente en blanco sino de observar y volver al objeto de atención, sin
  reproche), y guiar sesiones que no sean siempre iguales, aptas para hacerse con los ojos
  cerrados.
- **Decisión.** Sesiones de 5, 10, 15 o 20 minutos con una estructura fija y variantes
  elegidas por semilla: reflexión amable para empezar → gong → tres respiraciones
  profundas con el círculo → parte de cuerpo (asentarse, recorrido o sonidos, con
  proporción variable) → atención a la respiración (nariz, vientre o contando, con dos a
  cuatro recordatorios de «volver sin reproche») → gong → tres respiraciones → abrir los
  ojos. Cambios señalados por vibración (donde el navegador lo permite), gong sintetizado
  y, opcionalmente, una voz local breve (Web Speech), para no depender de la vista. Pausa y
  parada en cualquier momento; pantalla encendida durante la sesión; sonido de fondo
  opcional. Al terminar: cómo te sientes (cinco opciones), si hubo algo desagradable
  (bandera) y notas; diario de sesiones en la misma pantalla. Sin rachas, sin objetivos de
  minutos, sin puntuaciones. Esquema: migración v6 `meditation_sessions`, idéntica en la
  terminal para que las bases sigan siendo compatibles. Vocabulario neutro: ninguna
  tradición ni palabra de escuela aparece en la interfaz.
- **Evidencia.** Goyal et al. (2014): ansiedad 0,38 y depresión 0,30 a las ocho semanas;
  Norris et al. (2018): una sesión de diez minutos mejora la atención en novatos
  (preliminar); Farias et al. (2020) y Lindahl et al. (2017) para los efectos adversos y la
  pregunta de seguridad (`safety.md` §2.11).
- **Dónde.** `web/src/domain/meditation.ts` (plan y diario, con pruebas), `web/src/audio/cues.ts`
  (gong, vibración, voz, pantalla encendida), `web/src/screens/Meditate.tsx`.

## ADR-018 · Freno a la fuerza bruta en el desbloqueo (2026-11-06)

- **Contexto.** La web guarda el archivo cifrado en el propio navegador y la contraseña
  sólo se comprueba al derivar la clave. Nada impedía probar contraseñas sin parar desde la
  pantalla de desbloqueo.
- **Decisión.** Tras tres fallos seguidos, cada intento siguiente espera el doble (10 s,
  20 s, 40 s… hasta cinco minutos), con cuenta atrás visible y el botón desactivado. Se
  guarda en `localStorage` (`remanso.intentos`) para que sobreviva a recargar; acertar lo
  limpia. Con honestidad: esto frena a quien tiene el dispositivo en la mano; a quien copia
  el archivo y lo ataca fuera de la aplicación lo frena Argon2id (32 MiB, tres pasadas,
  entre medio segundo y dos por intento), no este contador. La terminal no lo necesita: el
  sistema operativo ya protege el acceso al archivo.
- **Dónde.** `web/src/app/lockout.ts` (con pruebas), `web/src/app/session.ts`,
  `web/src/screens/Lock.tsx`.

## ADR-019 · Voz guía pregrabada con un modelo abierto, en vez de la voz del sistema (2026-11-06)

- **Contexto.** La voz de la sesión de meditación usaba Web Speech, la síntesis del propio
  navegador. Resultó poco fiable (Chrome se quedaba «hablando» en silencio, la cola es común
  a todas las pestañas, iOS exige un gesto, cada dispositivo suena distinto y a menudo mal) y
  las explicaciones, al depender de una voz robótica, se habían quedado cortas.
- **Decisión.** Las frases de la sesión son un conjunto cerrado (31: la bienvenida, seis
  reflexiones, las instrucciones de cada parte, las zonas del recorrido del cuerpo y seis
  recordatorios), así que se generan una sola vez con un modelo abierto (Qwen3-TTS, Apache
  2.0, en el ordenador del autor con `web/tools/gen_voice.py`) y se sirven como MP3 desde
  `public/voz/<voz>/<id>.mp3`, reproducidos con un `<audio>`. Dos voces a elegir, Serena y
  Ryan. Los textos viven en `src/audio/voice-lines.json`, identificados por nombre, y se
  escribieron de nuevo para que expliquen cada cosa sin dar nada por sabido (qué es un
  recorrido del cuerpo, qué es el punto de apoyo, cómo contar, qué hacer cuando la mente se
  va). El texto en pantalla sigue siendo breve. El service worker guarda cada frase la
  primera vez que suena y, al empezar una sesión, se piden todas para que funcione sin
  conexión. Licencia de los archivos: CC BY 4.0, aparte del código (`public/voz/LICENSE.md`).
- **Lo que se pierde.** La voz ya no sigue el idioma del sistema, y cambiar un texto exige
  regenerar su archivo (sólo ese: el modelo muestrea, y se repite hasta que convence).
- **Dónde.** `web/src/audio/voice.ts` (reproducción y caché), `web/src/audio/voice-lines.json`,
  `web/tools/gen_voice.py`, `web/src/domain/meditation.ts` (cada fase y paso lleva el
  identificador de su frase), `web/src/screens/Meditate.tsx`.

## ADR-020 · Las versiones nuevas se avisan y se aplican cuando la persona quiere (2026-11-06)

- **Contexto.** El service worker se registraba en modo «prompt» sin ningún aviso: la
  versión nueva quedaba esperando y, en un iPhone con la aplicación en la pantalla de
  inicio, la vieja seguía sirviéndose durante días.
- **Decisión.** Un aviso fijo abajo («Hay una versión nueva… Luego / Actualizar») que
  aplica la versión al pulsar, nunca solo: una recarga a mitad de una entrada o de una
  sesión de meditación sería peor que esperar. Se comprueba si hay versión nueva al volver a
  la aplicación (visibilidad y foco) y cada hora. `web/src/app/Update.tsx`.

## ADR-021 · Tareas en una sola lista por cercanía; lo de hoy en la pantalla Hoy (2026-11-07)

- **Contexto.** Las tareas se repartían en pestañas «Hoy / Próximas / Sin fecha / Hechas»
  según reglas que había que aprender: una tarea sin día previsto pero con fecha límite
  a más de siete días no salía en ninguna pestaña (sólo en el calendario), y al crear o
  aplazar una tarea había que adivinar a qué pestaña se había ido. La pantalla Hoy sólo
  enseñaba un contador («3 tareas pendientes hoy»).
- **Evidencia consultada.** Bellotti et al. (CHI 2004) observaron que el problema no es
  priorizar sino *asegurar que lo importante se haga*; su prototipo era una sola lista
  siempre visible con un orden inteligente por fecha límite, avisos que cambian de color
  al acercarse y pequeñas «listas de prioridades» del día; tener fecha límite no predijo
  por sí solo que una tarea se hiciera. Haraty, McGrenere y Tang (2016) encontraron que
  una fuente de insatisfacción es no tener «una vista de todas las tareas en un sitio» y
  que las fechas límite piden aviso, no categoría. Masicampo y Baumeister (2011): decidir
  un plan concreto («cuándo») elimina la intrusión mental de lo pendiente, que es el
  argumento para invitar a elegir día sin exigirlo (Gollwitzer y Sheeran, 2006, para el
  efecto de las intenciones de implementación). Zhu, Yang y Hsee (2018): la gente prefiere
  lo urgente a lo importante («mere urgency effect») salvo si la importancia se ve junto a
  la fecha, de ahí que la prioridad se vea en la fila y ordene dentro de cada grupo.
  Patrón común en Things, Todoist y Recordatorios de Apple: una vista «Hoy» que mezcla
  vencidas, previstas hoy y límite hoy; las vencidas arriba y señaladas; la fecha límite
  como aviso dentro de la lista. Detalle en `docs/research/references.md`.
- **Decisión.** Una pestaña «Pendientes» con todo lo abierto en una sola lista, agrupada
  por cercanía: pendientes de días anteriores (con «A hoy» de un toque), hoy, mañana,
  próximos siete días, más adelante y, al final y visible, sin fecha. El día que manda es
  el más cercano entre el previsto y el límite (`tasks.effectiveDay`), así ninguna tarea
  se pierde; la fecha límite se lee en la fila como aviso («límite mañana», en ámbar si es
  hoy, mañana o ya pasó) y nunca mueve la tarea de grupo. Dentro de cada grupo: prioridad
  alta primero, luego el día, luego la más antigua. Al crear una tarea, la hoja pregunta
  «¿Cuándo?» con fichas (hoy, mañana, sin fecha, otro día) y dice dónde saldrá; sin
  fecha es un estado legítimo. Calendario, Proyectos y Hechas siguen como otras maneras de
  mirar lo mismo. En la pantalla Hoy, «Tareas de hoy» muestra las vencidas y las de hoy
  (máximo seis, marcables, con «y N más») y debajo, más apagado, hasta tres de los
  próximos días. Las rutas antiguas (`/tareas/hoy`, `/tareas/proximas`,
  `/tareas/sin-fecha`) llevan a la lista.
- **Consecuencias.** La versión de terminal conserva las vistas antiguas hasta el trabajo
  de paridad (sigue teniendo el hueco de las tareas con sólo fecha límite lejana). Las
  pruebas unitarias cubren la agrupación y el caso de la fecha límite sola.

## ADR-022 · Cierre de la meditación: ojos abiertos antes del círculo, despedida entera, notas editables (2026-11-07)

- **Contexto.** Tres fallos vistos en uso real. (1) La voz decía «tres respiraciones
  siguiendo el círculo» cuando el círculo ya llevaba un rato en marcha, y la frase inicial
  de las respiraciones (unos 30 s) duraba tanto como la fase entera. (2) El guion pedía
  seguir el círculo con los ojos cerrados y sólo después decía «abre los ojos». (3) La
  frase final se cortaba porque el formulario aparecía en cuanto acababa el tiempo. Además,
  las notas de una sesión no se podían cambiar ni borrar la sesión.
- **Decisión.** Las fases con círculo llevan un tramo inicial (`Phase.lead`) en el que se
  ve la indicación mientras la voz explica, y el círculo aparece cuando la explicación ha
  terminado; sin voz no hay tramo y la fase dura lo de siempre, así el total sigue siendo
  exacto (`makePlan(minutes, seed, voice)`). El cierre pasa a ser: gong → «Para terminar»
  (abre los ojos, mira alrededor, y se anuncia lo que viene) → tres respiraciones con el
  círculo, ya con los ojos abiertos → despedida («Hemos terminado…») que suena entera
  antes del formulario: se espera a que acabe lo último, el tiempo o el audio, con un tope
  de 30 s por si el audio no carga. En el diario, las notas de una sesión se pueden
  cambiar y la sesión se puede borrar; la duración, cómo te sentiste y la bandera de
  experiencia desagradable no se editan (son el registro de aquel momento). Lo mismo en
  impulsos: un episodio se puede borrar desde su ficha o nada más terminarlo, y el
  asistente tiene «Paso anterior» sin perder lo elegido.
- **Ninguna frase se corta y el tiempo es un mínimo exacto (añadido el 2026-11-08).** En
  uso real, la explicación del recorrido del cuerpo (36 s) se cortaba a los 10 s por el
  primer paso. Dos capas. (1) La voz nunca interrumpe a la voz: pasos y cambios de parte
  van a una cola FIFO (`queueLine`) y una parte no termina mientras haya una frase sonando
  o esperando (`voice.busy()`). (2) El plan es un presupuesto: `tools/voice_durations.py`
  mide cada frase (el mayor de las dos voces, `voice-durations.json`, que `gen_voice.py`
  regenera); cada frase cuesta su duración más un silencio mínimo (`GAP_S`, 4 s; tras la
  explicación de una parte, `INTRO_GAP_S`, 8 s); cada parte necesita su explicación y todos
  sus pasos (`needSeconds`); la suma de las partes es el mínimo del plan
  (`planMinSeconds`). Nada se omite: lo que se elige según el tiempo es la combinación
  (reflexión inicial, foco de la respiración, variante de cuerpo, número de recordatorios
  entre uno y cuatro), al azar entre las que caben enteras; el tiempo sobrante se reparte
  como silencio (`placeSteps`), con más silencio al final de la respiración para que nada
  caiga sobre el gong. **Diez minutos como mínimo** (la opción de cinco se retira y las
  preferencias guardadas con cinco pasan a diez): con cinco, sólo la voz ya ocupaba unos
  200 de los 300 segundos y no quedaba práctica en silencio. Desde diez entran las tres
  variantes de cuerpo enteras con tiempo de práctica proporcional; quince y veinte añaden
  recordatorios y silencio. Lo que la persona valoraba del formato (las tres respiraciones
  con el círculo al principio y al final, la estructura) no cambia.
- **Consecuencias.** Se regeneraron tres frases (`deep_breaths`, `closing`, `farewell`;
  `open_eyes` desaparece) en las dos voces. El campo de contraseña ya no se enfoca solo en
  pantallas táctiles: en iOS, como aplicación instalada, el foco programático dejaba el
  campo con aspecto de activo pero sin aceptar teclas.

## ADR-023 · Atajo biométrico en la web: passkey de plataforma con PRF (2026-11-07)

- **Contexto.** Escribir la contraseña en el móvil cada vez pesa, y Argon2id tarda unos
  segundos. Face ID, Touch ID y la huella o la cara en Android están disponibles en la web
  por WebAuthn. Pero WebAuthn sólo da una firma, y aquí no hay servidor que la verifique ni
  nada que una firma pueda descifrar: hacía falta un secreto.
- **Decisión.** Se usa la extensión PRF de WebAuthn: el autenticador de plataforma deriva
  un secreto de 32 bytes que sólo entrega tras verificar a la persona y que nunca se
  guarda. De ese secreto sale por HKDF-SHA256 (sal aleatoria propia, `info` fijo) una clave
  AES-256-GCM no extraíble que envuelve los 32 bytes de la clave del contenedor (IV
  aleatorio; datos asociados con la versión y el id de la credencial). En el dispositivo
  queda sólo la clave envuelta y metadatos públicos (`IndexedDB`, clave `biometric`). Al
  entrar: verificación → secreto → desenvolver → abrir el contenedor; sin Argon2, casi
  instantáneo. `web/src/crypto/biometric.ts`.
  - La contraseña sigue sirviendo siempre y es la única forma de abrir los datos en otro
    dispositivo o desde una copia. El formato del contenedor no cambia; no se guarda la
    contraseña ni nada derivado de ella.
  - **Una sola passkey por instalación**: `user.id` es un identificador aleatorio fijo
    (guardado en `IndexedDB`), así el sistema sustituye la passkey anterior en vez de
    acumular llaves huérfanas en el llavero. Al cambiar la contraseña se vuelve a envolver
    con la misma credencial (`rewrap`): una sola verificación y ninguna passkey nueva.
  - **Cuándo se ofrece.** Sólo si el navegador declara soporte de PRF
    (`getClientCapabilities`), para no crear passkeys que luego no sirvan; se ofrece una
    sola vez tras entrar con contraseña («Ahora no» se recuerda en `localStorage`, igual
    que desactivarlo en Ajustes). Si el navegador no sabe declararlo, no se ofrece solo
    pero se puede intentar desde Ajustes, avisando de que se comprueba al activarlo.
  - **Gesto y tiempos.** Algunos navegadores exigen que WebAuthn salga de un toque
    reciente, y Argon2 tarda segundos. Por eso el alta va en dos pasos: primero la
    contraseña (se comprueba abriendo el contenedor y la clave en claro queda retenida),
    después un toque que lanza la verificación. Tras un desbloqueo con contraseña la oferta
    tiene ya la clave retenida (`heldRaw`) y «Activar» es el toque. La clave retenida se
    borra al entrar, al bloquear, al cerrar la hoja y, en la oferta, a los 90 segundos o al
    pasar la aplicación a segundo plano (entonces se entra como con «Ahora no», sin
    recordarlo). Mientras tanto no hay otra clave en claro que la que ya está en memoria
    como `CryptoKey`.
  - **Al abrir la aplicación** con el atajo activo, o al volver tras el bloqueo por
    inactividad, se pide la verificación sin esperar un toque (sólo con la pestaña a la
    vista). Tras «Bloquear ahora», que es una decisión de la persona, hace falta un toque:
    si no, Face ID reabriría la aplicación en cuanto la persona siguiera mirando la
    pantalla. Si el navegador exige gesto o la persona cancela, queda el botón y la
    contraseña debajo.
  - **Freno a la fuerza bruta (ADR-018).** Los fallos biométricos no cuentan y el atajo
    no espera al freno: pasar la verificación del sistema no es adivinar. Entrar con el
    atajo limpia el contador, como entrar con la contraseña. Comprobar la contraseña con la
    sesión abierta (activar el atajo, cambiarla) no pasa por el freno: quien tiene la sesión
    abierta ya ve todo, y la contraseña sólo protege las copias.
  - **Invalidación.** Restaurar una copia o borrar todo elimina el atajo. Si el atajo deja
    de abrir los datos por cualquier motivo (no desenvuelve, registro alterado o de otra
    versión, contraseña cambiada en otro sitio) se descarta y se pide la contraseña; un
    registro con forma inválida se descarta al leerlo.
  - Credencial de plataforma, residente, verificación requerida, sin atestación y sin datos
    personales. Desafío aleatorio en cada llamada aunque no haya servidor. La firma de la
    aserción no se verifica: no aporta nada sin servidor; la seguridad descansa en que el
    secreto PRF sólo existe tras la verificación.
- **Consecuencias y límites.** Quien tenga el dispositivo desbloqueado y pase la
  verificación del sistema (cara, huella o, según la política del sistema, el PIN) entra,
  igual que en cualquier aplicación con passkey. Si la passkey se sincroniza por el llavero
  del sistema, quien controle esa cuenta y además consiga una copia del perfil del navegador
  abriría los datos sin la contraseña: el atajo añade esa dependencia de la cuenta de Apple
  o Google, y por eso es opcional, se explica al ofrecerlo y se desactiva en Ajustes
  (modelo de amenazas §3.13). La passkey queda en el llavero aunque se desactive el atajo
  (la web no puede borrarla); se puede borrar desde los ajustes de contraseñas del
  dispositivo. Soporte: Safari 18 (iOS 18, macOS 15) y Chrome reciente (depende de la
  plataforma y del gestor de passkeys); el resto ve la opción como no disponible. Queda por
  comprobar en un iPhone real que la verificación salta sin toque al abrir. Pruebas:
  envoltura y WebAuthn simulado (`biometric.test.ts`) y flujo completo con un autenticador
  virtual con PRF (`e2e/biometria.spec.ts`): oferta, alta, apertura sin contraseña,
  bloqueo manual sin reapertura, cambio de contraseña, cancelación con reintento, freno,
  retirada del autenticador y desactivación.

## ADR-024 · Más variantes de la sesión de meditación, dentro de la misma práctica (2026-11-08)

- **Contexto.** La sesión tenía seis reflexiones iniciales, tres variantes de cuerpo, tres
  focos de respiración, seis recordatorios y una despedida: 54 combinaciones. El autor
  valora que cada sesión sea distinta sin saber qué va a tocar, y pidió más variedad sin
  salirse de la práctica de calma con un objeto de atención ni añadir modas.
- **Decisión.** Veinticuatro frases nuevas (dos voces), todas elementos clásicos de esa
  práctica en lenguaje neutro:
  - Cuerpo: **la postura, punto por punto** (pies y asiento, espalda, manos, hombros,
    cabeza y cara), **el peso y el apoyo** (lo que sostiene, la quietud) y **la
    respiración en todo el cuerpo**. Con las tres anteriores, seis variantes.
  - Foco: **el ciclo completo** (entra, pausa, sale, pausa), **contar al coger aire de
    diez a uno**, **un punto a la vista** (ojos entreabiertos, mirada posada; la única
    parte con los ojos abiertos) y **mirar la mente** (los pensamientos como nubes en un
    cielo quieto). Con los tres anteriores, siete.
  - Recordatorios: los dos ajustes clásicos (contra la pesadez: enderezar y avivar; contra
    la inquietud: aflojar y posar más blando) y tres sobre el tono (vigilar de reojo, la
    atención se posa y no se aprieta, cada respiración es la primera). Once en total.
  - Dos reflexiones iniciales más (por qué te sientas hoy; nada que resolver) y dos
    despedidas alternativas, elegidas por el plan (`Phase.endVoice`).
  Las variantes viven en `BODIES` y `FOCUSES` (`meditation.ts`) con su explicación, sus
  pasos y si piden los ojos cerrados; el presupuesto de tiempo del ADR-022 decide cuáles
  caben en cada sesión. Combinaciones: 8 × 6 × 7 × 3 = 1 008, sin contar el orden de los
  recordatorios.
- **Voces.** El autor notó que Serena sonaba con más prisa que Ryan (medido: unos 13
  caracteres por segundo frente a 12). `gen_voice.py` lleva ahora una instrucción y una
  velocidad por voz, y un ritmo máximo aceptable (12,3 car/s Serena, 12,8 Ryan): cada frase
  se genera hasta cuatro veces y se queda la más pausada dentro del margen. Serena se ha
  regenerado entera con ese criterio.

## ADR-025 · Invitación a apoyar Remanso, discreta y sin contrapartidas (2026-11-08)

- **Contexto.** Remanso es gratis, sin cuentas ni anuncios, y su coste de infraestructura
  crecerá con el uso. El autor quiere una vía para que quien quiera contribuya («invítame a
  un café») sin convertirlo en una petición insistente ni en una compra de ventajas.
- **Decisión.** Una tarjeta en Hoy, como las de apertura o cierre del día, a partir de dos
  días desde el primer uso. Tres respuestas: «¡Te invito a un café!» (abre la página de
  apoyo fuera de la aplicación, sin incrustar nada de terceros), «Más adelante» (siete días
  sin tarjeta; también al pulsar el enlace) y «No volver a mostrar» (definitivo). Las
  marcas viven en la base cifrada (`settings`: `support_first_use`, `support_next_at`,
  `support_dismissed`), así sobreviven a restaurar una copia. En «Más», al final, está siempre
  «Apoyar Remanso», que abre la misma hoja. El texto dice lo que es: un regalo hecho con la convicción de que
  una herramienta para cuidarse no puede vivir de tu atención; que lo mejor que se puede
  hacer es pasarlo; que el café paga infraestructura y desarrollo con los mismos valores;
  y que no desbloquea nada. Sin el enlace configurado (`SUPPORT_URL` en
  `web/src/domain/support.ts`) no se enseña nada. Plataforma: Ko-fi (sin comisión en
  donaciones puntuales; quien dona no necesita cuenta).
- **Consecuencias.** El enlace lleva a un sitio externo con sus propias condiciones; se
  avisa de que se abre fuera. Nada cambia en la aplicación para quien contribuye.

## ADR-026 · Meditar: un modelo de tiempos, y la sesión probada de principio a fin (2026-11-09)

- **Contexto.** Una sesión de veinte minutos en uso real salió mal, y al investigarla
  aparecieron más fallos de los que se habían notado:
  1. «Empecemos» se cortaba a los dos segundos y medio. La cola de la voz del ADR-022
     esperaba a las frases encoladas, pero no a la que lanza el botón de empezar, y la
     reflexión la pisaba. Como el plan sí reservaba el tiempo de «Empecemos», tras la
     reflexión quedaban unos veinticinco segundos de silencio sin sentido antes de las
     tres respiraciones.
  2. «Asentarse» sólo nombraba los pies y las manos durante cuatro a siete minutos, cuando
     una sesión de diez podía traer el recorrido de seis zonas: más tiempo daba menos cuerpo.
  3. La aplicación se bloquea por inactividad a los diez minutos (valor por defecto), y
     meditando no se toca la pantalla: una sesión de diez minutos perdía la despedida y
     no quedaba registrada, y una de quince o veinte se cortaba en el minuto diez.
  4. Si dos frases se encolaban mientras sonaba una tercera, la segunda no sonaba nunca.
  5. El service worker guarda la voz con `CacheFirst` por nombre de archivo, de modo que
     la regeneración de Serena del ADR-024 no llegaba a quien ya la tenía guardada.
  6. Con un apoyo que no es la respiración (un punto a la vista, mirar la mente), los
     recordatorios pedían volver a la respiración.
  La causa de fondo era doble. Los tiempos de cada parte se habían ido decidiendo caso a
  caso (fracciones, márgenes y excepciones), sin una regla común; y cada arreglo se había
  comprobado por partes, nunca la sesión entera tal como la vive una persona.
- **Decisión.**
  - **Un modelo de tiempos** (`docs/design/meditacion-tiempos.md`, `meditation.ts`). Cada
    frase declara su papel, es decir, lo que pide a quien la escucha (anunciar, acoger,
    explicar, reflexionar, ajustar, señalar una zona, abrir una práctica, sostener la
    práctica principal), y una única tabla (`SILENCE`) da el silencio mínimo y máximo de
    cada papel. Tres reglas: ningún guion se recorta (o cabe entero o se elige otro); lo
    que sobra se reparte estirando todos los silencios de la sesión en la misma
    proporción de su margen; y la parte principal lleva los recordatorios que dejan esa
    proporción más cerca de la mitad. El azar elige el contenido; los tiempos salen del
    modelo. Consecuencias directas: tras anunciar el círculo no hay espera (un segundo
    fijo); los recorridos van siempre enteros («Asentarse» pasa por las seis zonas en
    cualquier duración, con las frases del recorrido: no hay audios nuevos); tras
    «Empecemos» quedan unos segundos para colocarse antes de la reflexión.
  - **Cola de la voz** (`voice.ts`): lo que se encola espera también a la frase lanzada
    desde un botón; una frase directa descarta la cola; parar lo calla todo; la cola no
    pierde frases cuando se acumulan varias.
  - **Director de la sesión** (`meditationRun.ts`): módulo sin navegador que, segundo a
    segundo, decide los pasos, el círculo y el cambio de parte; la pantalla sólo ejecuta lo
    que le dice. El círculo aparece cuando su explicación ha terminado, nunca mientras la
    voz habla, y dura tres respiraciones justas.
  - **La sesión cuenta como uso** (`session.keepAlive`): mientras hay una sesión de
    meditación en marcha, o se sigue el círculo de la respiración en un episodio de
    impulso, el bloqueo por inactividad no salta. En pausa sí cuenta el tiempo.
  - **La voz lleva la huella de su contenido en la dirección** (`voiceUrl`, calculada en
    `vite.config.ts`): una frase regenerada es una dirección nueva y se descarga; al
    empezar una sesión se retiran de la caché las tomas que ya no son las vigentes.
  - **Los recordatorios encajan con el apoyo**: los que hablan de la respiración sólo se
    usan cuando el apoyo es la respiración.
- **Cómo se comprueba.** `meditation.test.ts` exige, en todas las duraciones y cientos de
  semillas, que cada silencio esté dentro de los límites de su papel y que la sesión
  comparta una sola proporción. `meditationRun.test.ts` recorre sesiones enteras (con y sin
  voz, con y sin gong, con audios más largos y más cortos de lo medido) con la cola real y
  un audio simulado (`fake-audio.ts`): todo el guion suena, en orden y sin cortes; el
  círculo sale tras su explicación y dura treinta segundos; ninguna parte acaba con la voz
  a medias; el total es el elegido; la despedida suena entera antes del formulario.
  `e2e/meditar.spec.ts` adelanta el reloj del navegador y exige que una sesión de quince
  minutos llegue al formulario sin bloqueo. Y `web/tools/session_trace.mjs` graba una
  sesión real contra la compilación de producción: qué frase suena, cuándo acaba, si algo
  la corta y qué hay en pantalla. El bloqueo sólo apareció al grabar una sesión a
  velocidad real hasta el final.
- **Consecuencias.** Para añadir una práctica basta declarar su guion con el papel de cada
  frase; para cambiar el ritmo, los números de la tabla. Cualquier cambio en la sesión
  pasa por la prueba de extremo a extremo y por una traza real antes de darse por bueno.
  Respecto al ADR-022, las fracciones de cuerpo y respiración, los márgenes por frase y el
  tope de cuatro recordatorios dejan de existir como reglas propias: salen del modelo.

## Pendientes

- Temporizador opcional de veinte minutos en el episodio de impulso («decido cuando
  acabe»). Evidencia aún por revisar: la espera sola tiene evidencia baja y el craving
  puede durar más de treinta minutos (nota B); encajaría como variante de la espera activa.
- Paridad de la versión de terminal con los cambios de la web.
- Sonidos, fase 2 (en marcha): ocho pistas instrumentales propias (CC BY 4.0, en
  `web/public/musica/`, catálogo en `web/src/audio/tracks.ts`, script
  `web/tools/add_track.py`) para escribir, calmarse, dormir y meditar; faltan unas veinte
  más y las grabaciones CC0 de ambientes. Lección de la
  fase 1: la síntesis da bien la lluvia, los ruidos y el fuego, pero el mar (y en menor
  medida el viento y el arroyo) no convence con filtros; para esos ambientes conviene usar
  grabaciones reales CC0 en bucles cortos de uno o dos minutos. Dos trampas encontradas:
  los trémolos rápidos sobre siseo suenan a válvula de olla a presión, y las rampas
  exponenciales de ganancia suben de golpe al final (suenan a golpe); usar envolventes en
  campana (`Engine.bell`). Las ráfagas muy densas (más de ~100 fuentes por segundo) cortan
  el audio.
- Meditación: enlazar los sonidos de meditación desde la sesión ya está (fondo opcional);
  queda decidir si la respiración guiada del episodio de impulso enlaza a Meditar.
