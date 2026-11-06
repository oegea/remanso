# Decisiones de producto y su justificación científica

**Fecha:** 2026-11-06 · **Ámbito:** Remanso 0.1.0, esquema de datos v5 · **Tipo:** trazabilidad código ↔ especificación ↔ evidencia

Este documento responde a tres preguntas: qué decisiones de diseño toma Remanso, en qué evidencia se apoya cada una y dónde está implementada. Sintetiza `docs/research/interventions.md` (§a–h), `docs/research/safety.md` (§4–5), las recomendaciones de diseño de las notas C (objetivos), E (recordatorios y procrastinación, §8–9) y F (autoseguimiento, §12), y el código de `src/`. Todas las referencias [Autor, Año] figuran en `docs/research/references.md`; cuando la nota de origen las verificó sólo parcialmente se indica «(parcial)» y no se toman cifras de ellas.

Convenciones de la tabla de trazabilidad (§2): «Dónde» cita `fichero::función` o la constante de `src/text.rs` con el texto literal (prefijo `text::`); «Estado» es *implementada* (la conducta coincide con la regla), *parcial* (coincide en lo esencial, falta un elemento detallado en §3) o *pendiente*.

---

## 1. Principios → decisiones

Los diez principios transversales de `interventions.md` §a se traducen así en producto:

| Principio | Decisión de producto | Razón (evidencia) |
|---|---|---|
| **Lenguaje de apoyo a la autonomía** | Toda cadena visible vive en `src/text.rs`: sin imperativos, exclamaciones ni comparación con otros. La razón que se muestra es la que el usuario escribió (`goals.why`), literal. Un test en `text.rs` y otro en `interventions/mod.rs` fallan ante una expresión vetada. | Los mensajes controladores generan reactancia [Dillard & Shen, 2005; Rains, 2013]; la motivación controlada no predice mantenimiento [Ntoumanis et al., 2021; Teixeira et al., 2020]. |
| **Ningún castigo por rachas** | No hay contador de días consecutivos. La consistencia es frecuencia en ventana («3 de 3 esta semana», «11 de los últimos 30 días») y, sólo si llega a dos, «N semanas seguidas con la frecuencia alcanzada». Un día sin registro es un hueco, no un «no hecho». | Una racha rota reduce la continuación (53 % frente a 78 %; 29 % si se autoatribuye) [Silverman & Barasch, 2023]; dependencia y abandono [Renfree et al., 2016]; saltarse un día no afectó al hábito [Lally et al., 2010 (parcial)]. |
| **Proceso por encima de resultado** | Tipo `proceso` por defecto; toda métrica nace con dirección `observe`; la pestaña Métricas vacía recuerda que «registrar la conducta suele ayudar más que registrar el resultado». | Monitorizar la conducta la mueve (d+ = 0,79) y monitorizar el resultado apenas (0,14) [Harkin et al., 2016]; foco en resultado y desinhibición tras lapsos [Freund & Hennecke, 2012]. |
| **Autocompasión tras un lapso** | El lapso se llama «desliz», «es un dato, no un veredicto», va seguido de un paso pequeño opcional y de una frase de autoperdón ofrecida una sola vez. | Violación de la abstinencia [Witkiewitz & Marlatt, 2004; Larimer, Palmer & Marlatt, 1999]; perdonarse predijo menos procrastinación [Wohl, Pychyl & Bennett, 2010]; [Sirois, Kitner & Hirsch, 2015]. |
| **Mínima fricción** | Registrar una acción es una tecla que cicla hecha → no hecha → sin registro; crear, aplazar o completar una tarea, una tecla y un texto. Ningún formulario pide datos que no se usen. | Defaults y fricción gobiernan la ejecución [Jachimowicz et al., 2019]; la carga predice el abandono [Eysenbach, 2005]. |
| **Todo es opt-in** | El primer arranque pide contraseña, tema y caracteres. No hay objetivos, preguntas, métricas ni recordatorios hasta que el usuario los crea; cada conjunto de preguntas se activa y desactiva en Ajustes sin perder respuestas. | `safety.md` §5.1; adherencia a un diario con prompts del 47,8 % y descendente [Smyth et al., 2018]; el uso decreciente es la norma [Eysenbach, 2005; Baumel et al., 2019]. |
| **Sin inferencia automática** | Cuenta, suma, promedia y compara con la semana anterior. No analiza texto, no estima ánimo, no calcula correlaciones. «Patrón» nombra recuentos comprobables a mano. | Correlaciones automáticas y lecturas erróneas [Choe et al., 2014]; las preguntas abstractas sobre causas empeoran la resolución de problemas [Watkins, 2008]. |
| **Honestidad sobre la evidencia** | Cada técnica del catálogo lleva confianza, evidencia con cifras sólo de fuentes leídas, límites y marca «experimental»; visible en Ajustes y con `?` en el episodio. Nada promete que un impulso baje ni que un hábito se forme en N días. | El craving sigue alto a los 30 min [Lundahl & Greenwald, 2016]; mediana de 66 días con rango 18–254 [Lally et al., 2010 (parcial)]; beneficio pequeño y diferido de escribir [Frattaroli, 2006]. |
| **Comparación sólo con el propio pasado** | La revisión semanal abre con datos sin preguntas («4 de 5 esta semana; la anterior 3»); las métricas comparan la media de 7 días con la de los 7 anteriores; nunca «hoy frente a ayer» ni con otros. | Igual de eficaz que comparar con la meta [Harkin et al., 2016]; el ruido día a día supera la señal [Orsama et al., 2014; Turicchi et al., 2020a]. |
| **Límite de seguridad fijo** | Lista cerrada de categorías; cinco con `red_flag` muestran una vez, sin bloquear, la derivación con su línea específica (024 para autolesión e ideación suicida). La misma derivación aparece si el usuario declara daño en el desliz, seriedad al preparar el módulo, o si se cumple la regla aritmética de cuatro semanas. | Autoayuda no guiada inferior a la guiada en gravedad moderada-alta [Karyotaki et al., 2021; Cuijpers, Noma, Karyotaki, Cipriani & Furukawa, 2019]; [Jesse et al., 2017]; [Witt et al., 2021]. |

Dos decisiones de arquitectura derivan de ello. **Catálogo declarativo**: las técnicas no están codificadas en las pantallas sino en `src/interventions/builtin.json`, de modo que la transparencia del nivel de evidencia (`safety.md` §5.8) es un dato y el lint de palabras prohibidas se aplica al conjunto. **Sin proceso residente ni red**: Remanso sólo existe mientras está abierta y la pantalla de Inicio es el recordatorio, lo que resuelve de raíz la fatiga de notificaciones [Klasnja et al., 2019; Paine et al., 2016] y la privacidad de pantalla (`safety.md` §5.4).

---

## 2. Tabla de trazabilidad

Una fila por funcionalidad, agrupadas por módulo.

### 2.1 Diario y preguntas de reflexión

| Funcionalidad | Dónde en el código | Regla de diseño aplicada | Evidencia / nota de origen | Estado |
|---|---|---|---|---|
| Diario libre, sin preguntas ni métricas por defecto | `app/diary.rs` (sin plantillas); `domain/prompts.rs` (nada instalado en v1); `ux.md` §9 | Escritura libre por defecto; toda plantilla opt-in (`safety.md` §2.7, §5.1) | Sin RCT de diario autónomo (nota D); [Smyth et al., 2018] | Implementada |
| Preguntas opt-in, por conjunto, en Ajustes; desactivar archiva, no borra | `settings.rs::activate` → `prompts::install_set` / `disable_set` | «Nada se instala en la primera ejecución» (§d) | [Eisele et al., 2022]; [Vachon et al., 2019]; [Ulitzsch et al., 2025] | Implementada |
| ≤ 3 preguntas por pantalla (una por pantalla), todas omisibles; Esc guarda lo respondido | `review.rs::Session::start` (`truncate` 2/3/6), `handle_session` | §d: responder a una o a ninguna es válido | Menos evaluaciones por día → más cumplimiento [Vachon et al., 2019] | Implementada |
| Textos concretos, orientados a proceso, sin «por qué» | `prompts::templates` | `safety.md` §4 (preguntas concretas) | [Watkins, 2008]; [Lyubomirsky, Sousa & Dickerhoof, 2006] | Implementada |
| Una sesión guiada al día (la semanal cuenta como la de su día) | `reviews::guided_today`; `review.rs::ReviewMenu::open` → `text::REVIEW_DONE_TODAY` | §d, regla de carga | [Vachon et al., 2019]; [Smyth et al., 2018] | Parcial: informa, no impide (§3.1.5) |
| Cierre del día: la tercera respuesta crea tareas para mañana | `review.rs::Session::finish` (`kind == "close"`, separador «;») → `tasks::create`; `text::REVIEW_TASKS_CREATED` | `cierre_del_dia` (§b.20); sin lista de «completadas» | Lista de pendientes y latencia de sueño (15,8 frente a 25,1 min, d = 0,63) [Scullin et al., 2018] | Implementada |
| «Una cosa que fue bien hoy, y qué hizo que fuera bien», sin «por qué» ni recuento | `prompts::templates("close")[1]` | `tres_cosas_buenas` (§b.19): describir, no analizar | [Seligman, Steen, Park & Peterson, 2005]; [Cregg & Cheavens, 2021] | Implementada (como pregunta, no como plantilla) |
| Revisión semanal: datos primero, ≤ 6 preguntas, guardar el cambio propuesto como tarea; tras tres vacías se ofrece desactivarla; día sugerido domingo | `review.rs::Session::start` (bloque `data`), `ReviewAction::SaveAsTask`, `reviews::empty_weekly_streak`; `text::REVIEW_OFFER_DISABLE` | `revision_semanal` (§b.8), **experimental** | [Harkin et al., 2016]; [Wrosch et al., 2013] | Implementada |

### 2.2 Objetivos, acciones y métricas

| Funcionalidad | Dónde en el código | Regla de diseño aplicada | Evidencia / nota de origen | Estado |
|---|---|---|---|---|
| Aviso único al crear el primer objetivo | `goals.rs::handle_list` (`goals_safety_shown`); `text::GOAL_SAFETY_TEXT` | `safety.md` §1.3, texto exacto | [Harkin et al., 2016]; [Epton, Currie & Armitage, 2017] | Implementada |
| Tipo `proceso` por defecto; `resultado` y `aprendizaje` disponibles | `domain/goals.rs::GoalKind` (`ALL[0]`, `parse` → `Process`) | Nota C, modelo de meta | [Harkin et al., 2016]; [Freund & Hennecke, 2012] | Implementada |
| Motivo («¿Por qué te importa?») y contexto («¿Cuándo y dónde…?»), opcionales y editables | `goals.rs::handle_summary`; `goals::set_why`, `set_context` | Nota C: `motivo`, `contexto_habitual` | [Kwasnicka et al., 2016]; [Keller et al., 2021] | Implementada |
| Categorías cerradas; cinco con `red_flag`; derivación no bloqueante una vez por objetivo, con la línea del 024 | `domain/goals.rs::CATEGORIES`, `mark_safety_shown`; `goals.rs::run_deferred` (`Category`); `text::DERIVATION_*`; Ajustes → «Si necesitas ayuda» | `safety.md` §3.2–3.3 (024 verificado 2026-11-05) | [Jesse et al., 2017]; [Witt et al., 2021]; [Levinson, Fewell & Brosof, 2017] | Implementada |
| Cierre con motivo neutro («una decisión, no un fallo») y aprendizaje guardado en el diario | `goals.rs::run_deferred` (`CloseReason`, `Learned`); `goals::CLOSE_REASONS`; `text::GOAL_CLOSE_INTRO`, `GOAL_LEARNED_PROMPT` | `safety.md` §5.2; `revision_objetivo` (§b.10) | [Wrosch et al., 2003]; [Epstein et al., 2016] | Implementada |
| Pausar conserva todo | `goals::set_status(Paused)`, `actions::set_paused`, `metrics::set_archived` | Derecho a parar sin perder nada (`safety.md` §5.2; F §12.6) | [Epstein et al., 2015]; [Epstein et al., 2016] | Implementada |
| Revisión de objetivo programada, ≤ 5 preguntas, decisión mantener/ajustar/pausar/cerrar; nunca «vencida» | `goals::create` (7 días), `due_for_review`; `review.rs::Session::start` (`goal_review`) | `revision_objetivo` (§b.10); nota C (semanal) | [Kwasnicka et al., 2016]; [Epton, Currie & Armitage, 2017] | Implementada (7 días, no 14; §3.1.2) |
| Acciones con frecuencia semanal («3 veces por semana» sugerido; «cada día» nunca por defecto) y señal de contexto opcional | `domain/actions.rs::Schedule`, `set_cue`; `goals.rs::run_deferred` (`ActionName` → `ActionCue`) | `meta_proceso`, `senal_contexto` (§b.2, §b.4); nota C §4 | [Lally et al., 2010 (parcial)]; [Wood & Neal, 2016] | Implementada |
| Registro con una tecla; «hueco ≠ fallo»: hecha / no hecha sólo si el usuario lo marca / sin registro | `actions::log` (`None` borra), `status_on`; `text::ACTION_TODAY_BLANK` | `registro_conducta` (§b.1); nota E §8.12 | d+ = 0,40 [Harkin et al., 2016; Michie et al., 2009]; [Helsel, Jakicic & Otto, 2007] | Implementada |
| Sin rachas de días: «últimos 7/30», «esta semana frente a la anterior», semanas seguidas (sólo si ≥ 2) | `actions::summary`; `goals.rs::render_actions_tab`; `text::ACTION_WEEKS_OK` | §a.2; nota C §4 | [Silverman & Barasch, 2023]; [Renfree et al., 2016] | Implementada |
| Calendario sin rojo (`●` hecho, `·` sin registro, `○` no hecho); tareas vencidas como «pendiente (fecha)» en gris | `spark::activity_rows`; `tasks.rs::render_task_rows` (`text::TASK_PENDING`) | Nota C §3; nota E §8.12 | [Silverman & Barasch, 2023]; [Sirois & Pychyl, 2013] | Implementada |
| Métricas: dirección `observe` por defecto | `metrics::create` (`'observe'`), `Direction::ALL[0]` | F §12.2 (ampliado a todo tipo) | [Elo, Leppänen & Jahkola, 2003]; [Harkin et al., 2016] | Implementada |
| N mínimo antes de dibujar tendencia, con texto literal («Todavía no hay datos suficientes…») | `trend::enough_for_trend` (número diario ≥ 7 en ≥ 7 días; semanal ≥ 4; escala ≥ 5) | F §12.3; §e.4 | [Turicchi et al., 2020b]; [Bhutani et al., 2017] | Implementada |
| Media de 7 días en primer plano, crudo atenuado; sin deltas día a día; «respecto a la media de la semana anterior» | `trend::moving_average`, `current_level`, `week_over_week`, `describe_change`; `goals.rs::render_metric` | F §12.3; §e.3, §e.7 | [Turicchi et al., 2020a]; [Orsama et al., 2014] | Implementada |
| Aviso de métricas sensibles una vez, texto exacto; semanal por defecto; nota fija sobre la variación del peso | `goals.rs::run_deferred` (`MetricSensitive`, `sensitive_warning_shown`); `metrics::create`; `text::METRIC_SENSITIVE_TEXT`, `METRIC_WEIGHT_NOTE`, `METRIC_FREQ_TITLE` | `safety.md` §5.6; F §12.4–12.5 | [Madigan et al., 2015]; [Pacanowski et al., 2015; Quick et al., 2012]; [Levinson, Fewell & Brosof, 2017; Simpson & Mazzeo, 2017] | Implementada |
| Límite blando de seis métricas | `goals.rs::handle_metrics_tab` → `text::METRIC_TOO_MANY` | F §12.6; §e.9 | [Choe et al., 2014]; [Lazar et al., 2015] | Implementada |
| Sin colores de juicio; sólo el positivo para «hecha» | `goals.rs::render_metric`, `render_actions_tab` | F §12.3; §e.8 | [Kluger & DeNisi, 1996 (parcial)] | Implementada |
| Hitos sobre conducta acumulada (N registros, N semanas, valor de métrica, fecha, manual), reprogramables con historial, mensaje descriptivo | `domain/milestones.rs::MilestoneKind`, `reschedule` → `milestone_history`, `evaluate`; `text::MILESTONES_EMPTY` | Nota C §2 | [Bandura & Schunk, 1981]; sin insignias [Deci et al., 1999] | Implementada |
| Barra con texto del lado pequeño («llevas 3 de 10» / «faltan 2 km de 10 km») | `spark::progress_bar`; `goals.rs::render_milestones_tab` | Nota C §3; §e.7 | [Koo & Fishbach, 2012 (parcial)]; [Koo & Fishbach, 2008] | Implementada |
| Planes si–entonces: aviso de vaguedad (lista cerrada), «léelo dos veces», «no es un incumplimiento», refuerzos a 7 y 14 días, «¿te sirvió?», archivar tras dos «no se dio» | `plans::is_vague`, `create` (boosters 09:00), `review`; `text::PLAN_VAGUE`, `PLAN_SAVED`, `PLAN_OFFER_ARCHIVE` | `plan_si_entonces` (§b.6); nota E §3 | d = 0,65 [Gollwitzer & Sheeran, 2006]; [Sheeran, Listrom & Gollwitzer, 2025]; [Milkman et al., 2011]; [Hagger & Luszczynska, 2014] | Implementada |
| SRBAI: cuatro ítems 1–5, media y comparación con la medida anterior, sin umbral de «ya es hábito» | `prompts::templates("srbai")`, `ensure_srbai`, `srbai_history`; `review.rs::Session::finish`; `text::SRBAI_*` | `automaticidad_srbai` (§b.7) | α ≥ 0,80 [Gardner et al., 2012] | Parcial: sólo a demanda (§3.2.13) |
| Catálogo con confianza, evidencia, límites y marca experimental | `interventions/builtin.json`; `Technique::card`; `settings.rs` (`Row::Techniques`); `impulse.rs` (`?`) | `safety.md` §5.8 | Cifras sólo de fuentes leídas | Implementada |

### 2.3 Tareas y recordatorios

| Funcionalidad | Dónde en el código | Regla de diseño aplicada | Evidencia / nota de origen | Estado |
|---|---|---|---|---|
| Contador de aplazamientos neutro («aplazada 3×»), visible a partir del umbral | `tasks::postpone`, `POSTPONE_REVIEW_THRESHOLD = 3`; `tasks.rs::render_task_rows` | Nota E §8.17; §f.19 (umbral como inferencia de diseño) | [Steel, 2007]; [Sirois & Pychyl, 2013] | Implementada |
| Revisión al tercer aplazamiento: oferta con una tecla, cabecera «algo sobre la tarea, no sobre ti», cinco preguntas, «Aplazar no es fallar» | `tasks.rs::run_deferred` (`PostponeTask` → `text::TASK_REVIEW_OFFER`), `PostponeReview`, `handle_review`; `text::REVIEW_INTRO`, `REVIEW_Q1`–`Q5`, `REVIEW_CLOSE` | Nota E §9 (texto literal); §b.21 | [Steel, 2007]; [Bandura & Schunk, 1981]; [Gollwitzer & Sheeran, 2006]; [Milkman et al., 2011; Owens, Bowman & Dill, 2008] | Implementada |
| Autoperdón opcional, una vez por tarea | `tasks.rs::handle_review` (`step = 99`); `text::REVIEW_FORGIVE_OPTS` | Nota E §9: nunca obligatorio ni repetido | [Wohl, Pychyl & Bennett, 2010]; [Sirois, 2014] | Implementada |
| «Ya no» cierra la tarea como gestión, no abandono | `PostponeReview::answer_text` (paso 0) → `tasks::drop_task`; `text::REVIEW_CLOSED_TASK` | Nota E §9, pregunta 1 | Liberar compromisos sin castigo (nota E §6) | Implementada |
| Recordatorios: ninguno hasta que el usuario crea el primero; se comprueban al abrir y mientras está abierta; sin proceso residente | `domain/reminders.rs`; `app/mod.rs::next_deadline`; `text::REMINDERS_EMPTY` | §f.4, §f.14; `safety.md` §2.8 | [Klasnja et al., 2019; Bidargaddi et al., 2018]; [Paine et al., 2016] | Implementada (sin notificaciones del sistema; §3.2.9) |
| Bloque único en Inicio, ≤ 3 visibles y «y N más»; nunca mientras se escribe | `home.rs::render` (`take(3)`) | §f.5; nota E §8.4 | [Mehrotra et al., 2016] | Implementada |
| Un aviso no se repite más de dos veces; a la tercera se ofrece revisarlo | `reminders::MAX_SHOWS_DEFAULT = 2`, `needs_review`; `app/reminders.rs` → `text::REMINDER_REVIEW_HINT` | Nota E §8.5; §f.6 | [Klasnja et al., 2019]; [Paine et al., 2016] | Parcial: reprogramar/repetir/cerrar, no el flujo completo (§3.2.14) |
| Posponer pide fecha y hora («+1h, mañana 9:00») | `app/reminders.rs` (`z`), `dates::parse_datetime_input` | Nota E §8.16; §f.18 | [Milkman et al., 2011] | Implementada (tareas: sólo día; §3.2.15) |
| Nunca «incumplido»: lo vencido es «Pendientes»; lo repetitivo salta desde hoy sin cola de apariciones pasadas | `reminders::due`, `dismiss` (test `repeating_reminder_rolls_forward_from_today`) | Nota E §8.12; §f.17 | [Sirois & Pychyl, 2013]; [Wohl, Pychyl & Bennett, 2010] | Implementada |
| Texto literal del usuario; sin contadores negativos | `reminders::create`; boosters «Plan: si … → …» en `plans::create` | Nota E §8.7–8.9 | Inferencia de [Gollwitzer & Sheeran, 2006; Milkman et al., 2011] | Implementada |
| Bienvenida neutra tras ≥ 3 días: «Han pasado N días… Nada se ha marcado como incumplido.» | `app/mod.rs::after_unlock` (`last_open`); `text::WELCOME_BACK_*` | Nota E §8.13; `nuevo_comienzo` (§b.9) | [Silverman & Barasch, 2023]; [Dai, Milkman & Riis, 2014] | Parcial: sin acciones en bloque ni anclaje (§3.2.12) |
| Semanal por defecto para revisar objetivos y la revisión semanal; diaria sólo si el usuario la pide | `goals::create` (7 días); `reviews::weekly_available`; `metrics::create` (sensibles → semanal) | Nota E §8.1; §f.1 | [Pop-Eleches et al., 2011]; [Thakkar et al., 2016] | Implementada |

### 2.4 Episodio de impulso

| Funcionalidad | Dónde en el código | Regla de diseño aplicada | Evidencia / nota de origen | Estado |
|---|---|---|---|---|
| P1 STOP: tarjeta de cuatro líneas, intensidad 0–10, «¿Qué había justo antes?»; Esc guarda en cualquier estado | `impulse.rs::handle` (`Stop`, `Trigger`, Esc → `save_and_close`); `builtin.json` (`pausa_stop.pasos`) | `pausa_stop` (§b.12); §c P1 | [Valentine et al., 2015]; [Linehan et al., 2015] | Implementada |
| P2 Contexto («contexto, no causa») con nota de que no explica el impulso | `impulse.rs` (`Context`); `text::IMPULSE_CONTEXT_HELP` | §c P2: HALT sólo como checklist | [Hagger et al., 2016]; [Vohs et al., 2021] | Implementada |
| P3 Elegir vía con descripción honesta («puede no bajar»); última vía preseleccionada | `impulse.rs::choose_pathway`; `impulses::Pathway`, `cfg.last_pathway`; `text::IMPULSE_PATHWAY_*` | §c P3 | [Bowen & Marlatt, 2009; Tapper, 2018]; [Laborde et al., 2022]; [Duckworth, Gendler & Gross, 2016] | Implementada |
| P4 Espera activa de 10 min (5–20) con contenido; tiempo transcurrido sin cuenta atrás; al cumplirse «Puedes seguir o terminar», sin sonido ni color | `impulse.rs` (`Wait`, `pathway_steps`, `next_deadline`); `impulses::DEFAULT_WAIT = 600`, `save_config` (`clamp(300, 1200)`); `text::IMPULSE_WAIT_ELAPSED`, `IMPULSE_WAIT_DONE` | `espera_activa` (§b.14); §c P4 | [Lundahl & Greenwald, 2016]; [Kober et al., 2010]; [Colton et al., 2024]; [Duckworth, Gendler & Gross, 2016] | Implementada |
| Texto que no promete que baje («Puede que no baje…»; «La intensidad puede no bajar aunque no actúes») | `builtin.json` (`surfear_impulso.pasos[3]`); `text::PATTERN_INTENSITY_NOTE` | §a.8; §c P6 | [Lundahl & Greenwald, 2016]; [Bowen & Marlatt, 2009] | Implementada |
| «Esto me angustia» → «Está bien parar…» | `impulse.rs` (`Wait`, tecla `a`); `text::IMPULSE_DISTRESS` | `surfear_impulso` (§b.13), parada | Eventos adversos 8,3 % [Farias et al., 2020] | Implementada |
| P5 Cierre: intensidad después, cinco etiquetas neutras, reflexión opcional, «Registrado.» | `impulse.rs` (`IntensityAfter`, `Outcome`); `impulses::OUTCOMES`, `finish` | §c P5 | `safety.md` §4 (feedback descriptivo) | Implementada |
| Desliz tras «Lo hice»: «un dato, no un veredicto», qué viste antes, paso pequeño guardable como plan, casilla de daño, autoperdón una vez | `impulse.rs` (`Lapse`, `LapseStep`, `LapsePlanSituation`, `LapseHarm`, tecla `f`); `text::LAPSE_*` | `pantalla_desliz` (§b.16) | [Witkiewitz & Marlatt, 2004]; [Silverman & Barasch, 2023]; [Sirois, Kitner & Hirsch, 2015] | Parcial: no desde una acción «no hecha» (§3.1.7) |
| P0 Preparar: entorno, para qué, imagen futura, tres alternativas, respuesta competidora, minutos de espera, pregunta de seriedad | `impulse.rs::start_prep`, `run_deferred` (`Prep*`); `impulses::save_config`; `text::PREP_*` | §c P0; §b.11, §b.15 | [Duckworth, White, Matteucci, Shearer & Gross, 2016]; d = 0,92 [Carter & Tiffany, 1999]; [Bate, Malouff, Thorsteinsson & Bhullar, 2011; Moritz et al., 2023] | Implementada |
| Seguridad: «¿Afecta de forma seria…?» y casilla de daño → derivación una vez | `impulse.rs::run_deferred` (`PrepSerious`, `LapseHarm`; claves `*_warning_shown`) | §c Seguridad; `safety.md` §3.2 | [Jesse et al., 2017]; [Witt et al., 2021] | Implementada |
| P6 Patrón: recuentos 7/30 días por franja, disparador, contexto y vía; «X de Y sin actuar»; intensidad media; «¿siguen en pie?»; sin porcentaje de éxito ni color | `impulses::pattern`; `impulse.rs::render_pattern`; también en la revisión semanal | §c P6 | [Harkin et al., 2016]; [Choe et al., 2014] | Implementada |
| Regla aritmética de cuatro semanas: crecimiento semanal de «lo hice» → los cuatro números y la derivación | `impulses::Pattern::rising_four_weeks`; `text::PATTERN_RISING` + `DERIVATION_BASE` | §a.10; `safety.md` §3.2 señal 3 | [Jesse et al., 2017]; principio de precaución (`safety.md` §7) | Implementada (cada vez que se abre el patrón; §3.1.6) |

### 2.5 Redacción y lint

| Funcionalidad | Dónde en el código | Regla de diseño aplicada | Evidencia / nota de origen | Estado |
|---|---|---|---|---|
| Textos centralizados; sin exclamaciones, «fracaso», «has fallado», «racha rota», «deberías», «otra vez», «días perdidos», «has roto», «quemar calorías», «castigo» | `text.rs::tests::no_forbidden_wording_in_ui_texts` (lee el propio fichero) | `safety.md` §4; §a Vocabulario; F §12.7 | [Dillard & Shen, 2005]; [Wohl, Pychyl & Bennett, 2010]; [Gardner et al., 2024] | Implementada |
| Lint del catálogo | `interventions/mod.rs::tests::no_forbidden_wording_in_catalog` | Misma regla sobre el JSON | — | Implementada |
| «No hay datos» como hueco con umbral; lapso como dato neutro; logro con «lado pequeño» | `trend::enough_for_trend`; `text::LAPSE_LINE1`; `spark::progress_bar` | `safety.md` §4 («Cómo redactar…») | [Turicchi et al., 2020b]; [Koo & Fishbach, 2012 (parcial)] | Implementada |
| Única excepción al veto de imperativos: «llama al 112» | `text::DERIVATION_SUICIDAL` | `safety.md` §4 | — | Implementada |

---

## 3. Desviaciones respecto a la especificación y pendientes

### 3.1 Desviaciones deliberadas

1. **Respuestas libres en una sola línea.** Preguntas de reflexión, paso pequeño del desliz, «qué será distinto» y situaciones de los planes se responden en el diálogo de línea única (`app/mod.rs::prompt`, `LineInput`). Razón: coherencia con «mínima fricción» (responder cuesta segundos; Esc nunca pierde la pantalla de fondo); la escritura larga tiene su sitio en el diario. Consecuencia: los pendientes de mañana se separan con «;» en vez de «línea a línea», y la propia pregunta lo indica.
2. **Revisión de objetivo cada 7 días, no 14.** `goals::create` fija 7. `interventions.md` §b.2 y §b.10 decían 14; la nota C y `safety.md` §5.3 dicen «semanal». Se siguió la regla de producto; el valor es editable por objetivo. Hay que alinear los tres documentos.
3. **`observe` por defecto para todas las métricas**, no sólo `scale` y sensibles: más simple y conservador. Pendiente de una línea: el orden de `Direction::ALL` (observar, subir, bajar, mantener, intervalo) no cumple que para el peso `mantener` y `observar` vayan *antes* que `bajar` (F §12.2).
4. **Terminal mínimo.** El texto dice «80×24» pero el aviso sólo aparece por debajo de 60×12 (`app/mod.rs::render`), para no bloquear consolas algo menores; el diseño asume 80×24.
5. **Una sesión guiada al día: informativa, no bloqueante.** El menú muestra «ya hay una sesión guiada hoy» pero `review.rs::activate` no impide abrir otra. Se prefirió no prohibir nada al usuario; la regla de carga depende de él.
6. **La regla de las cuatro semanas se muestra siempre que se cumple**, no una vez. Aparece sólo en una pantalla que el usuario pide y no interrumpe nada.
7. **La pantalla de desliz sólo se abre desde el episodio** (`outcome = acted`), no al marcar una acción «no hecha» como preveía §b.16. Así marcar «hoy no» sigue costando una tecla; la nota del día cubre el registro breve.
8. **Al elegir una categoría con `red_flag`, el asistente muestra la derivación y no encadena «¿Por qué te importa?»**; el motivo se añade desde la ficha. Conviene reencadenar la pregunta al cerrar el aviso.

### 3.2 Pendientes

9. **Sin notificaciones del sistema** (§f.15 preveía `cron`/`at`, experimental). `text::REMINDERS_EMPTY` lo declara. Razón: aplicación offline sin proceso residente; en consola pura no hay canal de aviso razonable. Se mantiene como decisión hasta que exista una necesidad real.
10. **Sin perfil de edad** (`safety.md` §5.7 condicionaba el autopesaje a `birth_year` ≥ 18). No hay campo de edad en Ajustes ni en el esquema. Razón: no pedir un dato personal no verificable que sería la única información demográfica guardada. Alternativa en estudio: indicar en el aviso de métricas sensibles que las técnicas se estudiaron en adultos.
11. **Sin «exportar resumen» a una persona de apoyo** (`exportar_resumen`, `support_person`). Sólo existe el volcado completo en claro (`storage/export.rs`, tras confirmación). Razón: decidir qué incluir sin exponer el diario requiere diseño propio. La evidencia que lo motiva sigue vigente (progreso comunicado d+ = 0,47 frente a privado 0,19 [Harkin et al., 2016]).
12. **Sin anclaje «nuevo comienzo» por acción tras ≥ 14 días** ni acciones en bloque («Replanificar todo», «Archivar lo que ya no importa») en la bienvenida. Razón: evidencia correlacional [Dai, Milkman & Riis, 2014] y un reset perjudica tras buen rendimiento [Dai, 2018 (parcial)]; se empezó por la parte segura (no reprochar) y se dejó el anclaje, experimental, para cuando haya uso que observar.
13. **SRBAI sólo a demanda.** El catálogo lo programa cada 21 días por acción; el código lo ofrece en Revisión → «Automaticidad» y guarda histórico (`prompts::srbai_history`, `last_srbai_day`), pero no lo propone. Razón: no añadir una sesión guiada no pedida; `last_srbai_day` permite sugerirlo en Inicio cuando se decida.
14. **Recordatorios: a la tercera aparición se ofrece reprogramar, repetir o cerrar**, no el flujo de `revision_aplazamientos`, que sólo existe para tareas. Unificarlo exige vincular recordatorio y tarea (`ref_kind = 'task'`), que el esquema permite.
15. **Aplazar una tarea pide día, no día y hora**: las tareas no tienen hora en el modelo. Fecha **y** hora [Milkman et al., 2011] se aplica íntegra en recordatorios y planes (boosters a las 09:00).
16. **Plantillas del diario** (`modo_observador`, `escritura_expresiva`, `volver_a_lo_concreto`, `mejor_yo_posible`) **y diario de sueño como conjunto**: no implementadas. El tipo `time` y la regularidad horaria (`trend::time_regularity_minutes`) existen, así que el diario de sueño puede montarse con métricas. La escritura expresiva exige además el aviso y el límite de sesiones de §b.18.
17. **Técnicas auxiliares** `empezar_cinco_min`, `temporizador_bloques`, `autorrecompensa`, `registro_alimentacion`: no implementadas; todas Baja o experimental.
18. **Modo ligero para actividades placenteras** (§b.1): no existe como opción explícita, aunque el registro de acción ya es sí/no.
19. **`prctl(PR_SET_DUMPABLE, 0)`** (evaluación técnica §7) no está en el código; la guía de instalación compensa con `ulimit -c 0`.
20. **Alineación documental.** El catálogo atribuye a `escritura_expresiva` «d = 0,47» [Smyth, 1998]; `safety.md` sólo recoge el malestar inmediato (d = 0,84) y el efecto pequeño de [Frattaroli, 2006]. Revisar la cifra frente a la nota D antes de una versión pública.

---

## 4. Riesgos residuales

Lo implementado reduce la probabilidad de daño; no la elimina. `safety.md` §7 recoge las lagunas de las notas; estos son los riesgos que quedan **después** del código.

1. **Uso por una persona con un trastorno no diagnosticado.** La aplicación sólo reacciona a elecciones explícitas en listas cerradas. Alguien con un trastorno alimentario puede crear una métrica de peso en «General», responder «no» a «¿es sensible?» y no ver nunca el aviso. `observe` por defecto, la ausencia de calorías y la media de 7 días reducen el daño; no lo impiden.
2. **Reglas de carga que dependen del usuario.** «Una sesión guiada al día» es informativa; el límite de seis métricas es un aviso; nada impide crear veinte objetivos. Es coherente con la autonomía, pero el registro compulsivo [Choe et al., 2014; Lazar et al., 2015] sigue siendo posible.
3. **Derivación sin seguimiento.** El mensaje se muestra una vez y queda en Ajustes. No se sabe si la persona lo leyó. El único recurso verificado es el 024 (España, 2026-11-05); fuera de España el texto es inexacto.
4. **Autologin y pantalla.** La guía de instalación propone autologin en tty1. Con el bloqueo en «nunca», quien abra la tapa ve la aplicación desbloqueada. El bloqueo por inactividad (10 min por defecto) y la pantalla sin datos mitigan, no eliminan.
5. **Pérdida de datos por olvido de la contraseña.** Decisión declarada en el primer uso (sin recuperación). El coste es real; la única mitigación son las copias cifradas, que dependen de la misma contraseña.
6. **Evidencia prestada.** Procede de intervenciones acompañadas, en estudiantes o adultos con sobrepeso de países de renta alta, sin población hispanohablante [Gardner et al., 2024]. Los umbrales propios (3 aplazamientos, N mínimo, 10 min, 7 días, 2 apariciones, 3 días, 6 métricas) son inferencias de diseño y así se declaran.
7. **Lint parcial de redacción.** Los tests cubren `text.rs` y `builtin.json`, pero `review.rs` y `goals.rs` aún componen cadenas sueltas («Objetivo pausado. El historial se conserva.», «Primero define una acción…»). Deben moverse a `text.rs`.
8. **Sin estudio propio.** No hay datos de uso real de Remanso. Todas las decisiones son hipótesis razonadas; la primera medida tras la instalación debería ser observar, con consentimiento, qué técnicas se activan, cuántas sesiones guiadas se abren y si los avisos se ignoran.

---

## Nota sobre las referencias

Todas las citas figuran en `docs/research/references.md` con DOI/PMID y estado de verificación. Las marcadas «(parcial)» ([Lally et al., 2010], [Koo & Fishbach, 2012], [Kluger & DeNisi, 1996], [Dai, 2018]) se citan por su idea, no por sus cifras, según la regla de `safety.md`. No se ha añadido ninguna referencia nueva.
