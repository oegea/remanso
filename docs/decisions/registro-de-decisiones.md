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
- Sección de meditación (idea en estudio); hasta entonces los sonidos no se enlazan desde
  la respiración guiada.
