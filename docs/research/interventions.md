# Intervenciones — especificación declarativa para Remanso

Fecha: 2026-11-06. Traduce la `evidence-matrix.md` (filas A1–F8) y las notas
`docs/research/notes/A–F` en comportamientos concretos de la aplicación. Implementa
`src/interventions/` (catálogo `interventions/builtin.json` + motor paso a paso),
`src/analysis/` (tendencias y recuentos) y las pantallas de revisión, impulso, métricas y
recordatorios. Todo texto entre comillas «» es literal de interfaz: se copia tal cual, en
español, sin exclamaciones, sin emojis y sin evaluaciones.

Convenciones:

- `clave`: identificador snake_case de cada técnica; se guarda en `strategies.technique`
  y en `prompts.source_ref`, y es la clave del catálogo `builtin.json`.
- «Confianza»: Alta / Media / Baja para el uso que hace la app. Las técnicas Baja o
  marcadas **experimental** muestran siempre el texto fijo: «Función experimental: la
  evidencia que la respalda es limitada o indirecta. Puedes probarla y desactivarla cuando
  quieras.»
- «Trigger»: *usuario* (tecla o menú), *programado* (fecha/hora fijada por el usuario) o
  *evento* (un hecho de los datos: recuento, fecha, estado; nunca una inferencia).
- Las referencias [Autor, Año] remiten a las notas A–F; las cifras son las que las notas
  marcan como verificadas. El detalle de la evidencia está en la matriz; aquí sólo se
  cita lo que justifica una decisión de diseño.

---

## a. Principios transversales

Derivados de las filas A9, A10, A11, C1, C3, E3, E10, F4 y de la nota D.

1. **Lenguaje de apoyo a la autonomía.** La interfaz ofrece opciones y razones; no da
   órdenes. Permitido: «podrías», «si quieres», «¿ahora, más tarde o lo revisamos?».
   Prohibido: «debes», «deberías», «otra vez», «no lo dejes», exclamaciones, comparación
   con otras personas. La razón que se muestra es siempre la que el usuario escribió
   (`goals.why`), literal [Teixeira et al., 2020; Dillard & Shen, 2005; Ntoumanis et al., 2021].
2. **Ningún castigo por rachas.** No hay contador de días consecutivos como métrica
   principal, ni alertas de rotura, ni reinicio a cero. La consistencia es frecuencia en
   ventana («4 de 7 esta semana», «22 de los últimos 30 días») y, si el usuario lo activa,
   racha de *semanas* cumplidas con reparación retroactiva de 1–2 días. Un hueco es un
   hueco [Silverman & Barasch, 2023; Lally et al., 2010; Renfree et al., 2016].
3. **Proceso por encima de resultado.** Toda meta nace como meta de conducta; un indicador
   de resultado se *observa* (dirección `none`) y no se puntúa [Harkin et al., 2016;
   Freund & Hennecke, 2012].
4. **Autocompasión tras un lapso.** El lapso se llama «desliz», es un dato y va seguido de
   un paso pequeño. Nunca «has fallado», «racha rota», «vuelta a cero» [Sirois, Kitner &
   Hirsch, 2015; Wohl, Pychyl & Bennett, 2010].
5. **Mínima fricción.** Registrar una acción cuesta una tecla; crear, aplazar o completar
   una tarea, una tecla y un texto. Ningún formulario pide datos que no se usen
   [Jachimowicz et al., 2019; Eysenbach, 2005].
6. **Todo es opt-in.** En la primera ejecución no hay objetivos, preguntas, métricas ni
   recordatorios (`ux.md` §9). Cada técnica se activa desde un menú y se desactiva desde el
   mismo sitio sin perder datos.
7. **Sin inferencia automática.** La app cuenta, suma, promedia y muestra fechas. No
   detecta ánimo, no interpreta el diario, no infiere causas ni correlaciones. «Patrón» y
   «tendencia» nombran recuentos que el usuario puede comprobar a mano [Watkins, 2008;
   Choe et al., 2014].
8. **Honestidad sobre la evidencia.** Nunca se promete que un impulso desaparezca, que un
   hábito se forme en N días o que escribir cure algo [Lundahl & Greenwald, 2016;
   Frattaroli, 2006].
9. **Comparación sólo con el propio pasado.** Feedback descriptivo («3 de 5 días; la
   semana pasada 2») frente a la semana anterior o a la meta fijada [Harkin et al., 2016].
10. **Límite de seguridad fijo.** Ante señales que el *usuario* declara (daño físico,
    deuda, abstinencia, autolesión, pensamientos de muerte) o un recuento creciente de
    episodios durante cuatro semanas, se muestra una sola vez, sin bloquear: «Lo que
    describes puede necesitar más apoyo del que esta aplicación puede ofrecer. Considera
    hablar con un profesional de la salud. Remanso no diagnostica ni sustituye esa ayuda.»
    Si existe `settings.safety_contact`, se añade «Contacto que guardaste: …». La app no
    trata adicciones, trastornos alimentarios, autolesión ni juego [Jesse et al., 2017;
    Witt et al., 2021].

**Vocabulario.** Evitar: fallo, fracaso, recaída, racha rota, has perdido, reiniciar desde
cero, días perdidos, fuerza de voluntad, batería, no pienses en, ignóralo, deberías,
ideal, quemar, castigo, permitido, bueno/malo. Preferir: desliz, reanudar, pausar,
retomar, esta semana, X de Y, registro, tendencia, variación normal, contexto, nota el
deseo, déjalo estar mientras haces X.

---

## b. Catálogo de técnicas incluidas

Forma de cada entrada en `builtin.json` (el motor la interpreta sin lógica por técnica):

```json
{ "clave": "plan_si_entonces", "nombre": "Plan si–entonces", "experimental": false,
  "trigger": ["usuario", "evento:crear_accion", "evento:aplazar_tarea"],
  "pasos": [ {"id": "situacion", "texto": "Si… (hora, lugar o acción que lo precede)", "tipo": "texto", "obligatorio": true},
             {"id": "respuesta", "texto": "…entonces (acción concreta)", "tipo": "texto", "obligatorio": true} ],
  "guarda_en": {"tabla": "if_then_plans", "campos": {"situation": "situacion", "response": "respuesta"}},
  "duracion": {"booster_dias": [7, 14]}, "parada": ["archivar_plan"], "seguridad": null,
  "evidencia": ["Gollwitzer & Sheeran, 2006", "Sheeran, Listrom & Gollwitzer, 2025"] }
```

Tipos de respuesta: `texto`, `escala` (entero con mínimo, máximo y anclas), `opcion`,
`multi`, `fecha_hora`, `confirmar`. Todo paso es omisible con `Esc` salvo `obligatorio`;
`Esc` nunca pierde lo escrito.

### 1. `registro_conducta` — Registro de la acción

- **Finalidad:** que registrar lo hecho sea el acto central y más barato de la app.
- **Mecanismo y evidencia:** teoría del control; el registro físico añade efecto [Harkin et al., 2016: d+ = 0,40; Michie et al., 2009]. Lo que predice el efecto es la frecuencia de registro, no el detalle [Helsel, Jakicic & Otto, 2007: r = 0,53]. **Confianza:** Alta.
- **Trigger:** usuario (tecla en «Hoy» o en el objetivo).
- **Pasos:** (1) Sobre la acción, una tecla marca «hecha» (`action_log.done = 1`). (2) Misma tecla otra vez: «Nota breve (opcional)». (3) Tecla distinta para «no la hice» → `done = 0`; si la acción pertenece a un objetivo con estrategias de impulso, abre `pantalla_desliz` (§16).
- **Respuesta:** `confirmar`; `texto` opcional. **Datos:** `action_log(action_id, day, done, note, logged_at)`.
- **Frecuencia:** en el momento o al cierre del día; se puede registrar hasta 2 días atrás sin marca especial.
- **Parada:** pausar la acción; nada se borra.
- **Riesgos:** medir lo placentero resta disfrute [Etkin, 2016]. Si el usuario marca «la hago por gusto», la app ofrece «modo ligero»: sólo sí/no y «¿cómo me sentí?» en vez de cuánto.
- **Qué NO hace:** no muestra días sin registro como «no hecho»; no calcula rachas de días; no avisa por no registrar.

### 2. `meta_proceso` — Meta específica de conducta

- **Finalidad:** crear objetivos que la persona controla y puede medir.
- **Mecanismo y evidencia:** especificidad y dificultad elegida [Epton, Currie & Armitage, 2017: d = 0,34]; correspondencia entre lo medido y lo que se quiere mover [Harkin et al., 2016: conducta 0,79 vs resultado 0,14]. **Confianza:** Alta.
- **Trigger:** usuario (`o` → `n`).
- **Pasos:** (1) «¿Qué quieres hacer? (verbo + cantidad + contexto)» → `goals.name`. (2) «¿Por qué te importa?» → `goals.why`. (3) «Tipo: proceso (lo que haces) / resultado (lo que cambia) / aprendizaje (lo que quieres descubrir)», por defecto proceso; si elige resultado: «Una meta de resultado depende de cosas que no controlas del todo. ¿Qué acción concreta la acerca? Registraremos la acción; el resultado se observa.» (4) «Dificultad que sientes: fácil / moderada / exigente» con la nota «Las metas exigentes funcionan mejor si crees que puedes alcanzarlas.» (5) «¿Cuántas veces por semana?» (sugerido 3–5; nunca «todos los días» por defecto). (6) «¿Cuándo empiezas?» → `started_on`. (7) «Horizonte (opcional)»; si > 4 semanas: «¿Quieres marcar 3–5 hitos? El primero puede ser simplemente la primera vez.» (8) Encadena con `plan_accion`.
- **Respuesta:** texto, opción, número, fecha. **Datos:** `goals(name, why, started_on, status)`, `actions.schedule = per_week:N`, `milestones`.
- **Frecuencia:** una vez; revisión según `review_every_days` (por defecto 14).
- **Parada:** `status = paused | closed` (§10).
- **Qué NO hace:** no sugiere metas ni cifras de peso, calorías o pasos; metas de peso o ingesta pasan por §e.5.

### 3. `plan_accion` — Plan de acción (cuándo, dónde, cómo)

- **Finalidad:** convertir la meta en una acción recurrente con contexto.
- **Mecanismo y evidencia:** fase volitiva de HAPA [Sniehotta, Scholz & Schwarzer, 2006]; la repetición en contexto estable construye automaticidad [Keller et al., 2021]. **Confianza:** Alta.
- **Trigger:** evento `crear_meta`; usuario desde el objetivo.
- **Pasos:** (1) «La acción, en una frase: ¿qué harás exactamente?» → `actions.name`. (2) `senal_contexto` (§4). (3) `entorno_checklist` (§11), omisible. (4) `plan_afrontamiento` (§5), omisible. (5) Resumen con el texto fijo: «La mayoría de las personas tarda entre dos y tres meses en que una acción se vuelva automática, con un rango muy amplio. Un día sin hacerla no estropea el proceso.»
- **Datos:** `actions(goal_id, name, cue, schedule)`. **Frecuencia:** una vez por acción; se revisa en `revision_objetivo`. **Parada:** `paused_at` / `archived_at`.
- **Qué NO hace:** no promete plazos; no obliga a rellenar entorno ni barreras.

### 4. `senal_contexto` — Señal de contexto por acción

- **Finalidad:** anclar cada acción a una señal estable.
- **Mecanismo y evidencia:** la señal recurrente dispara la respuesta; rutina y hora funcionan igual [Keller et al., 2021; Lally et al., 2010]. **Confianza:** Alta.
- **Trigger:** dentro de `plan_accion`; usuario (`e` sobre la acción).
- **Pasos:** (1) «¿Cuándo la harás? Elige una señal: después de… / a las… / al llegar a… / otra». (2) Texto breve → `actions.cue`. Si queda vacío: «Sin señal también vale; muchas personas la añaden más tarde.»
- **Respuesta:** opción + texto. **Datos:** `actions.cue`.
- **Frecuencia:** se vuelve a preguntar sólo si cambia la acción o si en `revision_objetivo` el usuario indica que su entorno cambió.
- **Qué NO hace:** no deduce la señal de la hora de registro; no avisa a la hora de la señal salvo recordatorio creado por el usuario.

### 5. `plan_afrontamiento` — Barrera → respuesta

- **Finalidad:** anticipar obstáculos con una respuesta concreta.
- **Mecanismo y evidencia:** la planificación de afrontamiento predice el mantenimiento [Sniehotta et al., 2005; Sniehotta, Scholz & Schwarzer, 2006]; el manejo de barreras aumenta el efecto de los planes [Bélanger-Gravel et al., 2013]. **Confianza:** Alta.
- **Trigger:** `plan_accion` paso 4; `pantalla_desliz`; `revision_semanal`.
- **Pasos:** (1) «¿Qué puede impedírtelo?» con las etiquetas propias del usuario (cansancio, cambio de rutina, estado de ánimo, compañía, lugar) o texto. (2) «Si pasa eso, ¿qué harás?» (obligatorio si se rellenó el 1: anticipar barreras sin respuesta desanima [Schwarzer, 2008]). (3) Hasta tres pares → `if_then_plans(situation, response, action_id)`.
- **Frecuencia:** 2–3 pares por acción; revisión con el booster de §6.
- **Qué NO hace:** no propone barreras que el usuario no haya escrito.

### 6. `plan_si_entonces` — Plan si–entonces

- **Finalidad:** delegar el inicio de una conducta a una señal concreta.
- **Mecanismo y evidencia:** intenciones de implementación [Gollwitzer & Sheeran, 2006: d = 0,65; Sheeran, Listrom & Gollwitzer, 2025: mayor con formato condicional explícito y ensayo mental; Milkman et al., 2011: fecha **y** hora]. **Confianza:** Alta.
- **Trigger:** usuario; evento `aplazar_tarea`; dentro de §3 y §5.
- **Pasos:** (1) «Si…» con tres huecos: *cuándo* (día/hora), *dónde*, *después de qué*; al menos uno con texto. (2) «…entonces: ¿cuál es la primera acción concreta?». (3) Validación: si ningún hueco tiene texto o coincide con una lista cerrada de frases vagas («cuando pueda», «algún día», «cuando tenga tiempo», «si me apetece»): «Este plan es poco concreto. ¿Puedes añadir hora, lugar o la acción que lo precede?»; se puede guardar igualmente. (4) «Léelo dos veces imaginando la situación. Después, guarda.» Al guardar: «Si la situación no se da, el plan simplemente no se activa; no es un incumplimiento.» (5) Booster a 7 y 14 días (`reminders.ref_kind = 'plan'`): el plan literal y «¿Te sirvió este plan?» → `plan_reviews.helpful ∈ {yes, partly, no, not_used}`, «¿Lo cambias?».
- **Respuesta:** texto × 2, opción. **Datos:** `if_then_plans`, `plan_reviews`.
- **Frecuencia:** uno por acción o tarea; booster 7–14 días [Hagger & Luszczynska, 2014].
- **Parada:** archivar; tras dos revisiones `not_used`: «¿Lo archivamos?».
- **Qué NO hace:** no genera planes; no comprueba si se cumplió.

### 7. `automaticidad_srbai` — Comprobación de automaticidad

- **Finalidad:** medir si una acción se vuelve hábito sin contar días.
- **Mecanismo y evidencia:** SRBAI, 4 ítems [Gardner et al., 2012: α ≥ 0,80]. **Confianza:** Alta (medida); Media (utilidad).
- **Trigger:** programado cada 21 días por acción activa (14–28 configurable); usuario.
- **Pasos:** escala 1–5 («nada de acuerdo» – «totalmente de acuerdo»): (1) «[Acción] es algo que hago automáticamente.» (2) «[Acción] es algo que hago sin tener que recordarlo.» (3) «[Acción] es algo que hago sin pensar.» (4) «[Acción] es algo que empiezo a hacer antes de darme cuenta.» (5) «Automaticidad: 3,2 sobre 5. Hace tres semanas: 2,5.» o «Primera medida. La próxima, en tres semanas.»
- **Datos:** `prompts(schedule='event:srbai', kind='scale', source_ref)` × 4, `prompt_answers.value`; media en `analysis`.
- **Frecuencia:** cada 2–4 semanas; se omite si en las dos semanas previas hay < 2 registros de la acción.
- **Parada:** desactivar por acción; se detiene al pausarla.
- **Qué NO hace:** no dice «ya es un hábito»; no compara acciones; no fija umbral.

### 8. `revision_semanal` — Revisión semanal del progreso

- **Finalidad:** mirar la semana frente a la anterior y decidir un cambio pequeño.
- **Mecanismo y evidencia:** comparar con el propio pasado funciona igual que con la meta [Harkin et al., 2016]; reflexión orientada a acción [Di Stefano et al., 2014 (parcial)]; ajuste de metas [Wrosch, Scheier & Miller, 2013]. **Confianza:** Media; **experimental** (sin ECA de revisión semanal de metas personales).
- **Trigger:** programado (día y hora elegidos; por defecto domingo, como línea en Inicio «Revisión semanal disponible»); usuario (`r`).
- **Pasos:** (1) Datos sin preguntas: por acción «4 de 5 esta semana; la anterior 3»; por métrica, tendencia (§e); por impulsos, «X de Y sin actuar». (2) Preguntas «semanal» de §d, hasta seis en dos pantallas, todas omisibles. (3) Si una respuesta propone un cambio, ofrecer guardarlo como plan si–entonces o tarea. (4) «Revisión guardada. La próxima, cuando quieras; se sugiere el domingo.»
- **Datos:** `reviews(kind='weekly')`, `prompt_answers.review_id`.
- **Frecuencia:** semanal; es la sesión guiada de ese día.
- **Parada:** desactivar; tras tres revisiones abiertas y cerradas sin respuestas: «¿Quieres dejar de ofrecer la revisión semanal?».
- **Qué NO hace:** no puntúa la semana; no colorea en rojo; sólo compara con la semana anterior y las últimas cuatro.

### 9. `nuevo_comienzo` — Reanudar tras una ausencia

- **Finalidad:** facilitar la vuelta sin reproche y, si procede, anclarla a un hito temporal.
- **Mecanismo y evidencia:** nuevo comienzo [Dai, Milkman & Riis, 2014: correlacional]; un reset ayuda tras mal rendimiento y perjudica tras uno bueno [Dai, 2018 (parcial)]; la autoculpa reduce la continuación [Silverman & Barasch, 2023]. **Confianza:** Media; **experimental**.
- **Trigger:** evento `reapertura` con ≥ 3 días sin abrir (bienvenida); ≥ 14 días sin registros en una acción (anclaje).
- **Pasos:** (1) Bienvenida única: «Han pasado N días. Esto es lo que había pendiente. Puedes retomar, replanificar o cerrar lo que ya no aplique.» con «Replanificar todo» / «Archivar lo que ya no importa» / «Verlo una a una». (2) Si hoy es lunes o día 1 y hay acciones con ≥ 14 días sin registro: «Hoy es lunes. Si quieres, puede ser un punto de partida para [acción]. ¿Reanudar hoy, el lunes 10 o dejarla pausada?» (3) «Suele funcionar volver a la versión mínima de la acción, en el mismo momento y lugar de antes, durante una o dos semanas, sin compensar el tiempo pasado.» (4) «¿Qué pasó estas semanas? (viaje, trabajo, salud, otra cosa)» → etiqueta que externaliza la causa.
- **Datos:** `settings.last_opened_at`, `action_log`, nota en el objetivo.
- **Frecuencia:** una pantalla por reapertura; el anclaje, una vez por acción y periodo.
- **Parada:** desactivar el anclaje en Ajustes (la bienvenida neutra se mantiene).
- **Qué NO hace:** no se ofrece a acciones con < 14 días sin registro [Dai, 2018]; nunca «reiniciar»; nunca marca nada como fallido.

### 10. `revision_objetivo` — Mantener, ajustar, pausar, cerrar

- **Finalidad:** revisar si la meta sigue teniendo sentido y cerrarla sin lenguaje de fracaso.
- **Mecanismo y evidencia:** mantenimiento según motivos, autorregulación, recursos, hábito y entorno [Kwasnicka et al., 2016]; desenganche y reenganche adaptativos [Wrosch et al., 2003]; revisión cada 2–4 semanas [Epton et al., 2017]. **Confianza:** Media (plantilla); Alta (pausar/cerrar sin penalización).
- **Trigger:** programado según `goals.review_every_days` (por defecto 14); usuario; evento `cerrar_objetivo`.
- **Pasos:** (1) `goals.why` literal y resumen descriptivo de 4 semanas. (2) Las ≤ 5 preguntas «revisión de objetivo» de §d. (3) «Mantener / Ajustar (subir o bajar frecuencia) / Pausar / Cerrar». (4) Cerrar: «¿Por qué se cierra? Alcanzado / Ya no me importa / No es alcanzable ahora / Lo sustituye otra cosa» → `goals.status` (`achieved` | `closed`) + `close_reason`; después «¿Qué ocupa su lugar, si algo?» (omisible). (5) Pausar: «¿Hasta cuándo, aproximadamente?» (opcional).
- **Datos:** `reviews(kind='goal')`, `goals(status, last_reviewed_at, close_reason)`.
- **Frecuencia:** cada 2–4 semanas y a demanda. **Parada:** `review_every_days = NULL`.
- **Seguridad:** si el objetivo lleva la etiqueta «tratamiento» al cerrar: «Si esto forma parte de un tratamiento, conviene hablarlo antes con quien lo indicó.» **Experimental:** si responde «Lo dudo» a «¿sigue mereciendo la pena?», tres campos: «Pros de seguir / pros de dejarlo / qué versión mínima aún tendría sentido» [Brandstätter et al., 2013 (parcial)].
- **Qué NO hace:** no aconseja abandonar; no presenta el cierre como pérdida; no borra historial.

### 11. `entorno_checklist` — Cambios en el entorno

- **Finalidad:** cambiar la situación antes de que aparezca el impulso o la pereza.
- **Mecanismo y evidencia:** modificar la situación supera a resistir [Duckworth, White et al., 2016]; «añadir objetos al entorno» predice mantenimiento [Samdal et al., 2017]; las señales presentes elevan el craving [Carter & Tiffany, 1999: d = 0,92]. **Confianza:** Alta.
- **Trigger:** `plan_accion` paso 3; P0 del episodio (§c); `revision_semanal`.
- **Pasos:** (1) «¿Qué cambiarás para que [acción] sea más fácil? (dejar algo a la vista, preparar algo la noche antes…)». (2) Para conductas a evitar: «¿Qué cambiarás para que [conducta] sea más difícil o menos visible?». (3) Hasta tres frases → `strategies(technique, instructions)`. (4) Semanal: «Cambios en el entorno: [lista]. ¿Siguen en pie? Sí / Algunos / No».
- **Frecuencia:** al configurar y en cada revisión semanal. **Parada:** archivar la estrategia.
- **Qué NO hace:** no sugiere cambios más allá de los ejemplos genéricos; no detecta cambios vitales en el diario (el usuario puede etiquetar una entrada como «cambio de rutina» y la app sólo la enlaza).

### 12. `pausa_stop` — Pausa STOP

- **Finalidad:** romper el automatismo en los primeros segundos de un impulso.
- **Mecanismo y evidencia:** habilidad DBT de tolerancia al malestar [Valentine et al., 2015; Linehan et al., 2015]. **Confianza:** Media.
- **Trigger:** usuario (`i` desde cualquier pantalla).
- **Pasos:** (1) Tarjeta fija: «Para.» / «Un paso atrás.» / «¿Qué notas, dónde lo notas?» / «Luego decides.» (2) «Intensidad ahora, de 0 a 10» → `intensity_before`. (3) «¿Qué había justo antes?» → aburrimiento / estrés / tristeza / enfado / cansancio / ganas / nada en particular → `trigger_text`. (4) Sigue en P2 (§c) o sale.
- **Datos:** `impulse_episodes(started_at, goal_id, intensity_before, trigger_text)`.
- **Duración:** 10–20 s; sin temporizador. **Parada:** `Esc` guarda lo que haya.
- **Qué NO hace:** no pregunta por qué; no bloquea; no dice «no lo hagas».

### 13. `surfear_impulso` — Surfear el impulso

- **Finalidad:** observar el impulso sin actuar ni suprimir.
- **Mecanismo y evidencia:** desacoplar deseo y conducta; en el ECA de referencia la urgencia no bajó pero el consumo sí [Bowen & Marlatt, 2009; Tapper, 2018]. **Confianza:** Media.
- **Trigger:** P3 del episodio; usuario.
- **Pasos** (pantalla única, avanza con `↵`, 60–180 s): (1) «Nota el impulso. No tienes que hacer nada con él.» (2) «¿Dónde lo notas en el cuerpo? ¿Qué forma tiene: presión, calor, inquietud?» (texto opcional). (3) «Respira y míralo como una ola: puede subir y bajar. Tu tarea es mirarlo, no obedecerlo.» (4) «Puede que no baje. Lo que entrenas es no actuar en automático.» (5) «Intensidad ahora, de 0 a 10».
- **Datos:** `strategy_id`, `intensity_after`.
- **Duración:** 1–3 min, una vez por episodio (una instrucción breve basta en el ECA; los programas largos requieren instructor).
- **Parada:** salida libre; si el usuario marca «esto me angustia»: «Está bien parar. Puedes elegir otra vía o salir.»
- **Riesgos:** eventos adversos en prácticas meditativas (8,3 %) [Farias et al., 2020]: sólo prácticas breves. **Qué NO hace:** no promete alivio; no mide «éxito» por la bajada de intensidad.

### 14. `espera_activa` — Espera activa con reevaluación e imagen futura

- **Finalidad:** poner tiempo *con contenido* entre el impulso y la acción.
- **Mecanismo y evidencia:** no hay evidencia de que el deseo pase en 3–5 min; dura ≥ 30 min tras señales [Lundahl & Greenwald, 2016]; pensar en consecuencias a largo plazo reduce el craving [Kober et al., 2010]; imaginar el futuro reduce el descuento temporal [Colton et al., 2024: g = 0,55]; sólo el afrontamiento cognitivo fue eficaz en tentaciones reales [Shiffman et al., 1996]. **Confianza:** Media (Alta como contenedor; Baja como «esperar» aislado).
- **Trigger:** P4 del episodio.
- **Pasos:** (1) Pantalla con la vía elegida, `goals.why` y la imagen futura del usuario (`imagen_futura`). (2) «Si lo hago ahora, ¿cómo estaré dentro de una hora? ¿Y la semana que viene?» (texto opcional). (3) «¿Qué otra lectura hay de lo que está pasando?» (texto opcional). (4) Tiempo transcurrido discreto (mm:ss), sin cuenta atrás. (5) Al cumplirse `strategies.wait_seconds` (600 por defecto, 300–1200) o al pulsar «Terminar»: «Intensidad ahora, de 0 a 10» y cierre (P5).
- **Datos:** `waited_seconds`, `intensity_after`, `reflection`.
- **Duración:** 10 min por defecto. Justificación: no existe cifra óptima documentada; 10 min bastan para una técnica cognitiva y caben en la vida real; como el deseo puede seguir alto, el texto nunca promete que baje; actuar pronto supera a esperar sin más [Duckworth, Gendler & Gross, 2016], por eso la espera siempre lleva contenido.
- **Parada:** «Terminar» en cualquier momento; el episodio se guarda igual.
- **Seguridad:** en dependencia física esperar no sustituye tratamiento (§a.10). **Qué NO hace:** no muestra «faltan 4:32 para que pase»; no felicita al terminar.

### 15. `respuesta_competidora` — Respuesta competidora (hábitos motores)

- **Finalidad:** redirigir el primer movimiento de una conducta repetitiva corporal (uñas, pelo, piel) hacia uno incompatible.
- **Mecanismo y evidencia:** inversión de hábitos y decoupling [Bate et al., 2011: d = 0,80; Moritz et al., 2023: autoayuda d = 0,52–0,54]. **Confianza:** Alta en su ámbito.
- **Trigger:** usuario, al crear una acción `kind = 'avoid'` marcada «hábito motor»; P3 del episodio.
- **Pasos:** (1) «¿Cuál es el primer movimiento que notas? (la mano sube hacia la cara…)». (2) «¿Qué movimiento incompatible harás en su lugar? (cerrar el puño 30 s, apoyar la mano en el muslo, desviarla hacia la oreja…)» → `strategies.alternative`. (3) «¿En qué situaciones ocurre más?» (≤ 3). (4) En «Hoy», una tecla suma un episodio notado (métrica `count`). (5) Tarjeta: «Nota el movimiento. Cambia su dirección. Mantén la respuesta 30 segundos.»
- **Datos:** `actions(kind='avoid')`, `strategies(alternative)`, métrica `count`.
- **Duración:** práctica diaria 4 semanas, luego revisión [Moritz & Rufer, 2011]. **Parada:** pausar la acción.
- **Seguridad:** al crear: «Si hay heridas, infecciones o esto te causa un malestar importante, conviene consultarlo con un profesional.» **Qué NO hace:** no diagnostica; no cuenta «días limpios».

### 16. `pantalla_desliz` — Después de un desliz

- **Finalidad:** registrar lo ocurrido sin culpa y extraer una señal para el plan de afrontamiento.
- **Mecanismo y evidencia:** evitar el efecto de violación de la abstinencia [Witkiewitz & Marlatt, 2004]; autocompasión [Sirois, Kitner & Hirsch, 2015]; externalizar la atribución [Silverman & Barasch, 2023: autoatribución 29 % vs 53 %]. **Confianza:** Alta (redacción); Media (pantalla).
- **Trigger:** evento `impulse_episodes.outcome = 'acted'`; `action_log.done = 0`; usuario.
- **Pasos:** (1) «Un desliz es un dato, no un veredicto.» (2) «¿Qué viste antes? (opcional)» → multi: cansancio / cambio de rutina / estado de ánimo / compañía / lugar / otra cosa. (3) «Un paso pequeño para la próxima vez (opcional):» → texto; ofrece guardarlo como `if_then_plans`. (4) «[Acción]: 22 de los últimos 30 días.» (5) Una sola vez por conducta, opcional: «Un impulso no me hace peor persona. Si noto culpa, puedo soltarla: ahora sé qué lo hizo difícil.» (o texto propio). Redacción condicional: el autoperdón de Wohl et al. (2010) sólo tiene sentido en quien siente culpa; la frase no debe presuponerla (decisión 2026-11-06, `docs/decisions/encargos-pendientes.md`).
- **Datos:** `impulse_episodes.reflection` o `action_log.note`; etiqueta.
- **Duración:** 30–60 s. **Parada:** `Esc`; desactivable en Ajustes («sólo registrar»).
- **Seguridad:** casilla «Hubo daño físico, deuda o riesgo serio» → mensaje fijo de §a.10 y `settings.safety_shown_at`. **Qué NO hace:** no muestra rachas; no pregunta «¿por qué lo hiciste?»; no repite la frase de autoperdón.

### 17. `modo_observador` — Modo observador

- **Finalidad:** escribir sobre algo doloroso desde fuera.
- **Mecanismo y evidencia:** autodistanciamiento [Yang & Yang, 2026: > expresiva clásica, d = −0,49; Kross et al., 2014 (parcial)]. **Confianza:** Media.
- **Trigger:** usuario (editor del diario → plantilla).
- **Pasos:** (1) Inserta: «Escribe sobre esto como si lo vieras desde fuera, usando tu nombre o “él/ella”.» (2) Al final, opcional: «¿Qué le dirías a alguien que te importa si le pasara esto?» (3) Cierre sugerido: «¿Qué harás con esto, aunque sea pequeño, en los próximos días?»
- **Datos:** `diary_entries.body`, etiqueta `modo_observador`. **Duración:** libre. **Parada:** borrar la instrucción.
- **Qué NO hace:** no reescribe el texto; no evalúa si «se distanció».

### 18. `escritura_expresiva` — Escritura sobre algo difícil (experimental)

- **Finalidad:** ofrecer el paradigma clásico de 3–4 sesiones con información honesta.
- **Mecanismo y evidencia:** efecto pequeño y diferido [Frattaroli, 2006: r = 0,075; Guo, 2023: g = −0,12]; malestar inmediato [Smyth, 1998: d = 0,84]; mejor con ≥ 3 sesiones ≥ 15 min y preguntas dirigidas. **Confianza:** Media-Baja; **experimental**.
- **Trigger:** usuario (menú de plantillas); nunca sugerida por la app.
- **Pasos:** (1) Una vez por serie: «Escribir sobre algo difícil puede dejarte peor durante un rato; los beneficios, si aparecen, suelen notarse semanas después y son modestos. Si estás en tratamiento o esto tiene que ver con un trauma grave, habla antes con un profesional. ¿Quieres continuar?» (2) «Escribe 15–20 minutos sobre tus pensamientos y tus sentimientos acerca de esto. Incluye lo que pensaste, no sólo lo que sentiste. Puedes repetir el tema en 3 o 4 días seguidos o alternos.» (3) Temporizador opcional de 15–20 min. (4) «¿Qué harás con esto, aunque sea pequeño, en los próximos días?» (5) Oferta de `modo_observador` para la siguiente sesión.
- **Datos:** entradas etiquetadas con número de sesión.
- **Duración:** 3–4 sesiones de 15–20 min con 1–3 días de separación; la serie termina y la app no propone otra.
- **Parada:** «Puedes parar aquí. No hace falta terminar la serie.»
- **Riesgos:** malestar inmediato; empeoramiento en personas poco expresivas [Niles et al., 2014]; no para TEPT, depresión mayor, duelo complicado ni ideación suicida sin apoyo. **Qué NO hace:** no la propone; no la programa como diaria; no evalúa el contenido.

### 19. `tres_cosas_buenas` — Una o tres cosas que fueron bien

- **Finalidad:** redirigir la atención a lo que fue bien, saboreándolo sin analizarlo.
- **Mecanismo y evidencia:** [Seligman et al., 2005; Emmons & McCullough, 2003]; analizar lo positivo lo empeora [Lyubomirsky, Sousa & Dickerhoof, 2006]; efecto pequeño frente a controles activos [Davis et al., 2016 (parcial)]. **Confianza:** Media.
- **Trigger:** usuario (plantilla o pregunta de cierre).
- **Pasos:** (1) «Una cosa que fue bien hoy, y qué hizo que fuera bien.» (2) «¿Otra?» hasta tres. (3) Variante: «Algo que alguien hizo por ti.»
- **Datos:** `prompt_answers` o entrada etiquetada.
- **Frecuencia:** la que el usuario elija; la app sugiere «Muchas personas lo hacen una vez por semana.»
- **Parada:** desactivar; tras tres veces vacía: «¿Quieres quitar esta pregunta por ahora?».
- **Riesgos:** autocrítica en estados bajos; ayuda: «Si hoy no encuentras nada, no pasa nada; déjalo en blanco.» **Qué NO hace:** no exige el «por qué»; no cuenta ni puntúa.

### 20. `cierre_del_dia` — Cierre del día

- **Finalidad:** hechos, una cosa que funcionó y los pendientes de mañana por escrito.
- **Mecanismo y evidencia:** la lista detallada de pendientes acorta la latencia de sueño [Scullin et al., 2018: 15,8 vs 25,1 min, d = 0,63]. **Confianza:** Media.
- **Trigger:** usuario (`r` → cierre); programado si el usuario fijó hora.
- **Pasos:** las tres preguntas «cierre» de §d, omisibles; la tercera crea tareas con `scheduled_day = mañana` al confirmar línea a línea.
- **Datos:** `reviews(kind='close')`, `prompt_answers`, `tasks`.
- **Duración:** 3–5 min, una vez al día; excluyente con la apertura ese día.
- **Parada:** desactivar; una sola respuesta es válida.
- **Riesgos:** ninguna pregunta pide evaluar el día (rumiación). **Qué NO hace:** no genera lista de «completadas» (no ayudó al sueño); no puntúa.

### 21. `revision_aplazamientos` — Tarea aplazada N veces

- **Finalidad:** pasar del aplazamiento silencioso a un diagnóstico funcional de la tarea.
- **Mecanismo y evidencia:** aversión, retraso, autoeficacia, impulsividad [Steel, 2007]; fecha y hora concretas [Milkman et al., 2011; Owens, Bowman & Dill, 2008]; autoperdón [Wohl, Pychyl & Bennett, 2010]. **Confianza:** Media; el umbral es inferencia de diseño.
- **Trigger:** `tasks.postpone_count ≥ 3` (configurable); tercera aparición de un recordatorio; usuario.
- **Pasos:** (1) «[Tarea] se ha aplazado 3 veces. Es muy frecuente; suele indicar algo sobre la tarea, no sobre ti. ¿Miramos qué lo hace difícil? (1 minuto)» → Sí / Ahora no. (2) «Si la completaras, ¿qué cambiaría?» → Sí, importa / Ya no / No lo sé; «Ya no» → «Decidí no hacerla porque…» y `status = dropped`. (3) «¿Sabes cuál sería el primer paso de menos de 15 minutos?» → Sí / No; «No» → «Escribe ese primer paso» → tarea hija; la original pasa a proyecto. (4) «¿Falta algo? (información, material, otra persona, un momento libre)» → texto o «Nada concreto»; si hay obstáculo, la nueva tarea es resolverlo, con `plan_si_entonces`. (5) «¿La evitas porque es aburrida, incómoda o temes hacerla mal?» → Aburrida / Incómoda / Miedo a hacerlo mal / No; Aburrida → acotar a 10–15 min o «5 minutos de prueba» (experimental); Miedo → «¿Cuál sería la versión borrador aceptable?» y mostrar `goals.why` si existe. (6) «Si decides mantenerla: ¿qué día y hora, y qué será distinto esa vez?» (7) «Hecho. [Resumen en las palabras del usuario]. Aplazar no es fallar: ahora la tarea es más clara.» Opcional, una vez por tarea: frase de autoperdón.
- **Datos:** `tasks(postpone_count, scheduled_day, notes, status, parent_id)`, `if_then_plans`.
- **Duración:** ≈ 1 min. **Parada:** «Ahora no» aplaza el flujo al siguiente aplazamiento; desactivable por tarea.
- **Qué NO hace:** no pregunta «¿por qué no lo hiciste?»; no muestra el histórico como gráfico; no sugiere problemas psicológicos; no compara tareas.

### 22. `diario_sueno` — Diario de sueño y regularidad

- **Finalidad:** registrar horarios de sueño con pocos campos y ver su regularidad.
- **Mecanismo y evidencia:** el diario es fiable para el *momento* del sueño [Dietch & Taylor, 2021: r = 0,92–0,99]; la regularidad se asocia a mejores resultados [Phillips et al., 2017; Windred et al., 2024, observacional]. **Confianza:** Alta (diario y regularidad); lo terapéutico queda fuera.
- **Trigger:** usuario (activar plantilla); programado cada mañana si lo pide.
- **Pasos (≤ 7, CSD Core adaptado):** (1) «¿A qué hora te acostaste?» (2) «¿A qué hora intentaste dormir?» (3) «¿Cuánto tardaste en dormirte, aproximadamente?» (4) «¿Cuántas veces te despertaste?» (5) «¿A qué hora te despertaste por última vez?» (6) «¿A qué hora te levantaste?» (7) «Calidad del sueño, de 1 a 5.» Vista: horas como puntos, punto medio del sueño y «Regularidad: tus horas de acostarte variaron ±48 min esta semana (la anterior ±70)».
- **Datos:** métricas `time` (nuevo, §h), `count`, `scale`.
- **Frecuencia:** cada mañana; ≥ 7 noches antes de mostrar regularidad. **Parada:** pausar las métricas.
- **Seguridad:** nunca «puntuación de sueño» ni fases [Baron et al., 2017]. Texto fijo: «El diario tiende a sobreestimar el tiempo dormido; lo más fiable son las horas.» Si la calidad media es ≤ 2 durante 4 semanas, una vez: «Si el sueño lleva tiempo siendo un problema, un profesional puede ayudar más que un registro.» **Qué NO hace:** no prescribe restricción de sueño ni ventanas en cama; sólo texto de ayuda sobre rutina y usar la cama para dormir.

### 23. `recordatorio_accionable` — Recordatorio como señal, no como orden

- **Finalidad:** recordar una intención ya formada en el momento elegido, con salida de una tecla.
- **Mecanismo y evidencia:** los prompts actúan sobre la ejecución, no la motivación [Thakkar et al., 2016]; semanal ≥ diario [Pop-Eleches et al., 2011]; el efecto decae [Klasnja et al., 2019]. **Confianza:** Media.
- **Trigger:** programado (`reminders.due_at`); sólo al abrir la app o en el bloque de Inicio.
- **Pasos:** (1) «Pendiente: *[primera acción]* (lo planeaste para hoy a las 9). ¿Ahora, más tarde o lo revisamos?» (2) Teclas: `h` hacer ahora · `5` empezar 5 min (experimental) · `a` aplazar · `d` dividir · `r` revisar · `x` descartar. (3) Aplazar: «¿Para cuándo? (día y, si puedes, hora)» y «¿Qué será distinto entonces? (opcional)».
- **Datos:** `reminders(title, due_at, repeat, ref_kind, ref_id, snoozed_until, shown_count, max_shows)`.
- **Frecuencia:** §f. **Parada:** `done_at`; autosilencio tras 7 días sin respuesta.
- **Qué NO hace:** contadores negativos; repetir el mismo texto más de dos veces; interrumpir la escritura.

### Técnicas auxiliares (ficha breve)

| clave | Qué hace / trigger | Texto literal clave | Confianza | Evidencia |
|---|---|---|---|---|
| `respiracion_lenta` | Guía 4 s / 6 s, 3–5 min, salida libre; P3 | «Inspira 4… espira 6. Si te mareas, respira normal.» | Media | [Laborde et al., 2022] |
| `distraccion_concreta` | Muestra las 3 distracciones que el usuario escribió; P3 | «Elige una y hazla ahora: [lista]. Déjalo estar mientras la haces.» | Media | [Webb, Miles & Sheeran, 2012] (parcial); [May, Kavanagh & Andrade, 2015] |
| `imagen_futura` | Texto propio a 1–6 meses, escrito en P0; se muestra en la espera activa | «Describe en dos o tres frases cómo te gustaría estar dentro de unos meses respecto a esto.» | Media | [Colton et al., 2024]; [Kober et al., 2010] |
| `volver_a_lo_concreto` | Plantilla de tres campos en el editor | «¿Qué pasó exactamente? / ¿Qué parte depende de ti? / Primer paso pequeño, y cuándo.» | Media (ejercicio voluntario, no tratamiento) | [Watkins, 2008]; [Watkins et al., 2012] |
| `mejor_yo_posible` | Ejercicio único de 10–15 min al crear un objetivo | «Imagina que dentro de unos años todo ha ido lo mejor posible en [ámbito]. Descríbelo con detalle.» | Media; dosis baja | [Carrillo et al., 2019] |
| `empezar_cinco_min` | Temporizador de 5 min y una pregunta; desde recordatorio o §21 | «Cinco minutos. Después decides. … ¿Seguiste? Sí / No / Un poco.» | Baja; **experimental** | [Ghibellini & Meier, 2025] |
| `temporizador_bloques` | Trabajo/pausa con duraciones elegidas | «Elige cuánto trabajas y cuánto paras. No hay una cifra mejor que otra.» | Baja; **experimental** | [Biwer et al., 2023] (parcial) |
| `exportar_resumen` | Resumen semanal en texto plano para la persona de apoyo, tras confirmar | «Resumen de la semana para [nombre]. Se copia o guarda sólo si confirmas.» | Media | [Harkin et al., 2016: comunicado 0,47 vs privado 0,19] |
| `autorrecompensa` | Campo opcional en un hito | «Recompensa que te darás al llegar (opcional). Las recompensas funcionan mientras duran.» | Baja; **experimental** | [Mantzari et al., 2015] |
| `registro_alimentacion` | Qué, cuándo, dónde, con quién, hambre 1–5, nota; métrica sensible | «Sin calorías. Lo útil es ver cuándo y en qué situaciones comes.» | Media; **experimental**, opt-in | [Helsel, Jakicic & Otto, 2007]; [Krukowski et al., 2022] |
| `autopesaje` | Métrica `number` sensible, semanal por defecto, EWMA | Aviso de §e.5 | Media; **experimental**, opt-in | [Madigan et al., 2015]; [Pacanowski et al., 2015] |

---

## c. Protocolo del episodio de impulso

Máquina de estados del módulo `i`. Todo estado es opcional y `Esc` guarda el episodio con
lo que haya. Duración total 2–12 min. Un episodio es una fila de `impulse_episodes`.

```
 i (una tecla)
   │
   ▼
 P1 STOP (pausa_stop) ───── 10–20 s · intensity_before · trigger_text
   │ ↵ (Esc → guardar y salir en cualquier estado)
   ▼
 P2 Contexto (opcional) ─── 15 s · multi → context
   │
   ▼
 P3 Elegir vía ──────────── surfear_impulso · respiracion_lenta · distraccion_concreta
   │                         · reevaluación (espera_activa) · respuesta_competidora → strategy_id
   ▼
 P4 Espera activa ───────── 10 min por defecto (5–20) · waited_seconds · intensity_after
   │ Terminar / tiempo cumplido
   ▼
 P5 Cierre ──────────────── outcome ∈ {changed, partly, acted, unknown, unsaid} · reflection
   │                         · acted → pantalla_desliz
   ▼
 P6 Revisión semanal ────── recuentos · «X de Y episodios sin actuar en 30 días»
```

**P0 — Prevención (al configurar la conducta; reutilizable).** En este orden, todo
omisible: (a) `entorno_checklist`, 2–3 cambios situacionales; (b) el «para qué»
(`goals.why`); (c) `imagen_futura` a 1–6 meses; (d) tres distracciones
(`distraccion_concreta`); (e) si es hábito motor, `respuesta_competidora`; (f) tiempo de
espera preferido (`strategies.wait_seconds`, 600 por defecto). Cambiar la situación antes
supera a resistir en el momento [Duckworth, White et al., 2016].

**P1 — STOP.** §b.12. Único estado que aparece siempre al pulsar `i`.

**P2 — Contexto.** «¿Algo de esto se da ahora? (contexto, no causa)» con hambre / sueño
< 6 h / enfado / soledad / estrés / alcohol → `context` (lista separada por comas). Ayuda:
el cansancio o el hambre acompañan a muchos impulsos pero no los explican; la «batería de
voluntad» que se agota no se ha confirmado [Hagger et al., 2016; Vohs et al., 2021].

**P3 — Elegir una vía.** Lista de una tecla con descripción honesta: «Surfear (2–3 min):
mirar el impulso sin obedecerlo; puede no bajar.» · «Respirar (3–5 min): 4 segundos
dentro, 6 fuera.» · «Cambiar de sitio o hacer otra cosa: [tus distracciones].» · «Pensar
a largo plazo (1 min): tu para qué y tu imagen futura.» · «Respuesta competidora (hábitos
motores).» La última vía elegida queda preseleccionada.

**P4 — Espera activa.** §b.14. Siempre muestra la vía elegida, nunca una cuenta atrás
vacía. Al cumplirse el tiempo no suena nada ni cambia el color: «Han pasado 10 minutos.
Puedes seguir o terminar.» Justificación del tiempo: no hay cifra óptima documentada; los
cravings inducidos por señales siguen altos a los 30 min [Lundahl & Greenwald, 2016], así
que el texto nunca promete que el impulso desaparezca; 10 min caben en la vida real y
bastan para una técnica cognitiva [Kober et al., 2010].

**P5 — Cierre.** «Intensidad ahora, de 0 a 10» → `intensity_after`. «¿Qué pasó?» con cinco
etiquetas neutras de una tecla, sin color: «No lo hice» (`changed`) · «En parte» (`partly`)
· «Lo hice» (`acted`) · «No lo sé» (`unknown`) · «Prefiero no decirlo» (`unsaid`). Después
«¿Algo que quieras anotar? (opcional)» → `reflection`. Si `acted`, abre `pantalla_desliz`.
Si `changed` o `partly`: «Registrado.» Sin fanfarria. `ended_at` se fija al salir.

**P6 — Revisión semanal del patrón.** Dentro de `revision_semanal` o desde `i`: recuentos
descriptivos de 7 y 30 días por franja horaria (mañana, mediodía, tarde, noche), emoción
previa, etiqueta de contexto y vía elegida; «X de Y episodios sin actuar en los últimos 30
días» (`changed` + `partly` sobre episodios con resultado conocido); intensidad media antes
y después con la nota «La intensidad puede no bajar aunque no actúes»; lista de cambios en
el entorno con «¿Siguen en pie?». Nunca «racha», nunca porcentaje de «éxito» en color.

**Seguridad.** Al configurar una conducta de impulso, una pregunta única: «¿Esta conducta
afecta de forma seria a tu salud física, tu dinero, tu trabajo o tus relaciones? Sí / No /
Prefiero no decirlo». Con «Sí», el mensaje fijo de §a.10 una vez y la oferta de guardar un
contacto. El mismo mensaje, también una sola vez, si el usuario marca daño en
`pantalla_desliz` o si el recuento semanal de episodios `acted` ha crecido en cada una de
las últimas cuatro semanas (regla aritmética, mostrada con los números: «En las últimas
cuatro semanas los episodios han ido en aumento: 3, 5, 6, 8.»). Si el usuario etiqueta la
conducta como «alcohol» o «medicación», P0 añade: «Si bebes o tomas esta medicación a
diario, reducirla de golpe puede ser peligroso; conviene hacerlo con ayuda médica.»
[Jesse et al., 2017].

---

## d. Preguntas de reflexión

Reglas: **una sesión guiada al día como máximo** (apertura o cierre, no ambas por
defecto; la semanal cuenta como la sesión de su día) y **≤ 3 preguntas por pantalla**,
todas omisibles; responder a una sola o a ninguna es válido. Evidencia de carga: los
cuestionarios largos aumentan la carga y degradan los datos [Eisele et al., 2022]; la
frecuencia aumenta las respuestas descuidadas [Ulitzsch et al., 2025]; menos evaluaciones
por día → más cumplimiento [Vachon et al., 2019: 79 estudios, N = 8 013]; la adherencia a
un diario online con prompts fue del 47,8 % y descendente [Smyth et al., 2018]. Todas las
preguntas están en registro concreto y orientado a proceso («qué», «cómo», «qué harás»),
nunca «por qué» ni juicios globales [Watkins, 2008]; las positivas piden describir, no
analizar [Lyubomirsky, Sousa & Dickerhoof, 2006].

Se instalan en `prompts` (`schedule`, `kind`, `source_ref`, `position`) al activar el
conjunto; el usuario puede editarlas, reordenarlas o archivarlas. Nada se instala en la
primera ejecución.

### Apertura del día (`schedule = open`, ≤ 2) — experimental

| # | Texto literal | kind | source_ref |
|---|---|---|---|
| 1 | «¿Qué es lo único que, si lo haces hoy, hará que el día valga la pena?» | free | `apertura_del_dia` · D §6 (sin ensayos directos) |
| 2 | «¿Qué puede complicarse hoy y qué harás si pasa?» | free (si–entonces) | `plan_si_entonces` · A §5–6 |

Se evita «¿Cómo te sientes hoy?» como primera pregunta (abierta, abstracta) [nota D].

### Cierre del día (`schedule = close`, ≤ 3)

| # | Texto literal | kind | source_ref |
|---|---|---|---|
| 1 | «¿Qué pasó hoy que quieras recordar?» | free | `cierre_del_dia` · D §6 |
| 2 | «Una cosa que fue bien hoy, y qué hizo que fuera bien.» | free | `tres_cosas_buenas` · D §3 [Seligman et al., 2005] |
| 3 | «¿Qué queda pendiente para mañana? Escríbelo con detalle.» | free → tareas | `cierre_del_dia` · D §6 [Scullin et al., 2018] |

### Semanal (`schedule = weekly`, ≤ 6, en dos pantallas de tres)

| # | Texto literal | kind | source_ref |
|---|---|---|---|
| 1 | «Leyendo la semana, ¿qué se repite?» | free | `revision_semanal` · D §6 |
| 2 | «¿Qué funcionó esta semana?» | free | `revision_semanal` · C revisión estructurada |
| 3 | «¿Qué lo impidió, cuando no salió?» | choice (etiquetas propias) + free | `plan_afrontamiento` · A §6, §12 |
| 4 | «¿Qué cambio concreto pruebas la semana que viene?» | free (ofrece guardar como plan o tarea) | `revision_semanal` · C, D |
| 5 | «Cambios en el entorno: [lista]. ¿Siguen en pie?» | choice: Sí / Algunos / No | `entorno_checklist` · B control de estímulos |
| 6 | «¿Sigue mereciendo la pena [objetivo]?» | choice: Sí / Lo dudo / Ya no (→ `revision_objetivo`) | `revision_objetivo` · C [Wrosch et al., 2003] |

### Revisión de objetivo (`schedule = goal_review`, ≤ 5)

| # | Texto literal | kind | source_ref |
|---|---|---|---|
| 1 | «Escribiste que te importaba porque: “[why]”. ¿Sigue siendo así?» | choice: Sigue importando / Menos que antes / Ya no | `revision_objetivo` · A §15 [Kwasnicka et al., 2016] |
| 2 | «Registros en las últimas cuatro semanas: [n]. ¿Quieres seguir registrándolo así?» | choice: Sí / Menos / Más / De otra forma | `registro_conducta` · A §15 |
| 3 | «¿Tienes ahora el tiempo y la energía que esto pide?» | choice: Sí / A ratos / No | `revision_objetivo` · A §15 |
| 4 | «¿Ha cambiado algo en tu rutina o tu entorno que afecte a esto?» | free | `senal_contexto` · A §4, §15 |
| 5 | «Decisión: mantener / ajustar frecuencia / pausar / cerrar» | choice | `revision_objetivo` · C [Wrosch, Scheier & Miller, 2013] |

La automaticidad (SRBAI) se mide en su propia sesión breve (§b.7); cuando toca, sustituye
a la pregunta 2 para no superar las cinco.

---

## e. Métricas y feedback

Reglas del motor (`src/analysis/`), de la nota F §12 y las filas F1–F8, C1, A8.

1. **Tipos** (`metrics.kind`): `yes_no`, `count`, `duration` (minutos), `number` (decimal
   con unidad; puede ser sensible), `scale` (1–5 o 0–10 con anclas; ≤ 3–4 por registro),
   `event`, `text`. Se añade `time` (hora del día) para el sueño (§h). Toda medición admite
   `note` de contexto [Choe et al., 2014].
2. **Dirección** (`metrics.direction`): `up`, `down`, `maintain`, `range`, `none`. `none`
   es el valor por defecto para toda `scale` y toda métrica `sensitive`: el ánimo no se
   optimiza. Para el peso la dirección nunca se propone; `maintain` y `none` aparecen antes
   que `down`.
3. **Tendencia frente a dato crudo.** Puntos crudos atenuados, tendencia en primer plano;
   nunca el delta respecto al registro anterior [Orsama et al., 2014; Turicchi et al.,
   2020a]. Suavizado: `number` diario ruidoso → EWMA con α = 0,1 (heurística de ingeniería;
   Turicchi 2020b confirma que ajusta bien) **o** media móvil de 7 días (anula el ciclo
   semanal); `count`/`duration` de hábitos → agregado semanal (total o días cumplidos / 7);
   `scale` → media móvil de 7 días con mín–máx. No se imputan faltantes; los huecos se
   muestran como huecos [Turicchi et al., 2020b].
4. **N mínimo** antes de dibujar tendencia: peso diario ≥ 7 registros en ≥ 7 días
   naturales; peso semanal ≥ 4; `scale` ≥ 5; hábitos ≥ 2 semanas completas. Hasta entonces,
   puntos y el texto literal: «Todavía no hay datos suficientes para ver una tendencia (3
   de 7 registros). Las variaciones de un día a otro son normales.»
5. **Métricas sensibles** (`sensitive = 1`: peso, alimentación, medidas corporales y lo que
   el usuario marque). Nunca en plantillas ni en el asistente inicial; se activan desde un
   menú. Texto literal al activar: «Registrar el peso ayuda a algunas personas a mantener
   sus hábitos y a otras les genera preocupación o malestar. Puedes activarlo y
   desactivarlo cuando quieras. Si notas que pensar en el número te ocupa más de lo que te
   ayuda, desactívalo; tus notas y reflexiones se conservan.» Si `settings.birth_year`
   indica menos de 18 años, el autopesaje no se ofrece [Pacanowski et al., 2015; Quick et
   al., 2012]. Toda vista de peso lleva: «El peso varía de un día a otro por agua y
   digestión; la línea muestra la tendencia, no el valor real de hoy.» Sin contador ni
   objetivos calóricos; sin convertir pendientes en calorías ni fechas de llegada.
6. **Frecuencias por defecto**, formuladas como pregunta («Muchas personas lo registran una
   vez por semana. ¿Con qué frecuencia quieres hacerlo tú?»): hábitos `yes_no`/`count`,
   diaria en el momento; `scale`, una vez al día, ≤ 3 ítems, < 2 min; sueño, cada mañana,
   ≤ 7 campos; peso, **semanal**, mismo día, por la mañana, tras orinar, antes de desayunar,
   misma báscula (diaria sólo si el usuario lo pide) [Madigan et al., 2015: diario ≈
   semanal]; alimentación, cualitativa, 3–4 días/semana con uno de fin de semana
   [Krukowski et al., 2022]; ejercicio, sesiones o minutos por semana, meta = línea base de
   1–2 semanas + incremento elegido; nunca 10 000 pasos [Tudor-Locke & Bassett, 2004].
7. **Comparaciones.** «Esta semana frente a la anterior» y «últimas 4 semanas»; nunca «hoy
   frente a ayer» ni con otras personas. Barra de hitos con el texto del lado pequeño:
   < 50 % «llevas 3», ≥ 50 % «faltan 3» [Koo & Fishbach, 2012 (parcial)].
8. **Redacción.** Describir, no juzgar: «subió 0,4 kg respecto a la media de la semana
   pasada», «4 de 7 días». Sin rojo/verde en métricas sensibles ni `scale`; en hábitos puede
   marcarse «hecha» con el color positivo (`ux.md`), nunca «racha».
9. **Derecho a parar.** Estados `activa` / `pausada` / `archivada`; pausar o archivar nunca
   borra. Al archivar: «¿Qué has aprendido registrando esto?» → entrada de diario. Al
   activar la sexta métrica: «Ya tienes seis métricas activas. Registrar demasiadas cosas
   es la causa más citada para dejar de registrar. ¿Quieres pausar alguna?» [Choe et al.,
   2014; Lazar et al., 2015].
10. **Lo que el motor no calcula:** correlaciones entre métricas, puntuaciones globales,
    rachas de días para métricas sensibles o `scale`, fechas estimadas de llegada, ni
    inferencias sobre causas o estado emocional.

---

## f. Recordatorios

Reglas del motor (`reminders`), de la nota E §8 y las filas E5, E6, A11, F5.

**Defaults.** (1) **Semanal** para revisión de objetivos y tareas aplazadas; **diaria** sólo
para acciones que el usuario declara diarias [Pop-Eleches et al., 2011; Thakkar et al.,
2016]. (2) El usuario elige hora y días; la app propone una ventana de transición (al abrir
la app, no en mitad de una tarea) y lo explica en una línea [Mehrotra et al., 2016]. (3)
Todo default es visible y editable donde actúa. (4) Ningún recordatorio existe hasta que el
usuario crea el primero.

**Caps.** (5) Un solo bloque de avisos por sesión, en Inicio, ≤ 3 visibles y «y N más»;
nunca mientras el usuario escribe. (6) Un mismo aviso no se repite con el mismo texto más
de **2** veces: a la tercera (`shown_count = max_shows = 3`) se ofrece
`revision_aplazamientos` en vez de otro recordatorio [Klasnja et al., 2019; Paine et al.,
2016]. (7) Recordatorios de métrica: opt-in, máximo uno al día, autosilencio tras 7 días sin
respuesta con «¿Quieres pausar [métrica] por ahora?». (8) Los boosters de planes (§b.6)
cuentan dentro del bloque único.

**Redacción.** (9) Texto literal del usuario: su primera acción, su plan, su razón. (10)
Forma informativa y de elección: «Pendiente: *escribir el primer párrafo* (lo planeaste
para hoy a las 9). ¿Ahora, más tarde o lo revisamos?» (11) Prohibido: «deberías», «otra
vez», «fallaste», exclamaciones, comparación con otros, culpa o miedo [Dillard & Shen,
2005; Tannenbaum et al., 2015]. (12) Nunca contadores negativos («3 días sin…»); sólo
descriptivos («última vez: martes»). (13) Todo aviso es accionable con una tecla (§b.23).

**Con la app cerrada.** (14) Remanso es una TUI sin red: por defecto **no notifica** fuera
de la app; Inicio es el recordatorio. (15) Integración opcional y **experimental** con el
sistema (entrada `cron`/`at` que muestra sólo el título, nunca el contenido): opt-in
explícito, máximo un aviso al día, decaimiento a las 4 semanas con «¿Quieres mantener los
avisos del sistema?» [Fry & Neff, 2009; Klasnja et al., 2019]. (16) Al reabrir tras ≥ 3
días: una sola bienvenida neutra (§b.9) con «Replanificar todo» y «Archivar lo que ya no
importa» en bloque. (17) Nada se marca como «fallido» o «perdido» retroactivamente: las
tareas vencidas aparecen como «pendientes» con su fecha original; los hábitos muestran
huecos [Sirois & Pychyl, 2013; Wohl, Pychyl & Bennett, 2010].

**Aplazar.** (18) Aplazar siempre pide *a cuándo* (día y, si es posible, hora) y,
opcionalmente, *qué será distinto* [Milkman et al., 2011]; no existe «aplazar sin fecha»
salvo «mover a algún día» explícito. (19) `tasks.postpone_count` es visible y neutro
(«aplazada 2 veces»); al llegar a 3 se ofrece `revision_aplazamientos`; umbral configurable,
inferencia de diseño.

---

## g. Lo que se descarta y por qué

| Elemento | Decisión | Motivo | Evidencia |
|---|---|---|---|
| Racha de días consecutivos como métrica principal; alertas de rotura; reinicio a cero | Descartar (→ consistencia en ventana, racha de semanas tolerante) | Rotura autoatribuida: 29 % continúan vs 53 %; dependencia de la app; un día perdido no afecta al hábito | [Silverman & Barasch, 2023]; [Renfree et al., 2016]; [Lally et al., 2010] (parcial) |
| Puntos, niveles, insignias, penalizaciones, clasificaciones | Descartar | Recompensas tangibles reducen la motivación intrínseca (d −0,28 a −0,40); efectos negativos ligados a clasificaciones | [Deci, Koestner & Ryan, 1999]; [Cerasoli, Nicklin & Ford, 2014]; [Toda et al., 2018] (parcial) |
| Culpa, miedo y mensajes insistentes generados por la app | Descartar | El afecto negativo alimenta la evitación; la evidencia de miedo/culpa mide un mensaje único | [Wohl, Pychyl & Bennett, 2010]; [Tannenbaum et al., 2015]; [Dillard & Shen, 2005] |
| Frases motivacionales genéricas | Descartar | La persuasión verbal se asoció a menor autoeficacia | [Ashford, Edmunds & French, 2010]; [Williams & French, 2011] |
| «No pienses en ello», «ignóralo» | Descartar (regla editorial) | Rebote de la supresión, replicado | [Wegner et al., 1987]; [Wang, Hagger & Chatzisarantis, 2020] |
| «Batería de voluntad»; HALT como explicación | Descartar (HALT sólo como checklist de contexto) | Ego depletion no replicado (d 0,04–0,06); HALT sin ensayos | [Hagger et al., 2016]; [Vohs et al., 2021]; [Kretchman, 2026] (parcial) |
| Cuenta atrás que promete que el impulso pasa en 3–5 min | Descartar (→ espera activa) | Sin estudio que lo documente; el craving sigue alto a los 30 min | [Lundahl & Greenwald, 2016] |
| Contador y objetivos de calorías; peso convertido en calorías o fechas | Descartar | Asociación con sintomatología alimentaria (73,1 % lo percibe como contribuyente); sin base de datos offline | [Levinson, Fewell & Brosof, 2017]; [Simpson & Mazzeo, 2017] |
| «Puntuación de sueño», fases, restricción de sueño, ventanas en cama | Descartar | Orthosomnia; la restricción reduce el sueño objetivo y la vigilancia y requiere supervisión | [Baron et al., 2017]; [Kyle et al., 2014]; [Edinger et al., 2021] |
| Exposición escrita a trauma; escritura expresiva propuesta por la app | Descartar (la expresiva queda opt-in experimental) | Protocolo con terapeuta; malestar inmediato d = 0,84; contraindicación en poco expresivos | [Sloan et al., 2018]; [Smyth, 1998]; [Niles et al., 2014] |
| Detección automática de rumiación, ánimo o «otra vez lo mismo» | Descartar | Poco fiable sin IA ni clínico; intrusivo; repetir un tema no es rumiar | [Watkins, 2008]; nota D |
| JITAI con sensores o inferencia de contexto | Descartar | Requiere sensores y algoritmos; sin red | [Nahum-Shani et al., 2018] |
| Programas completos de TCC, mindfulness de 8 semanas, tratamiento de adicciones, TA, autolesión, juego | Descartar (la app registra y deriva) | Requieren profesional; la autoayuda no guiada es inferior en gravedad moderada-alta | [Karyotaki et al., 2021]; [Rozental et al., 2018b]; [Witt et al., 2021]; [Jesse et al., 2017] |
| Compromisos «duros»; contratos que la app reclama | Descartar (→ compromiso blando textual) | Baja adopción; culpa; control externo | [Bryan, Karlan & Nelson, 2010] (parcial) |
| Comparación social; metas públicas forzadas | Descartar | App monousuario sin red; fuente principal de efectos negativos | [Toda et al., 2018] (parcial) |
| Métricas de engagement como objetivo | Descartar | Uso ≠ beneficio; optimizar el uso daña la autonomía | [Perski et al., 2017]; [Yardley et al., 2016] |
| Plazos fijos de hábito («21 días», «66 días») como promesa; «todos los días» y 10 000 pasos por defecto | Descartar (se muestra el rango) | Mediana de 39 personas con extrapolación, rango 18–254; rachas frágiles; eslogan comercial | [Lally et al., 2010] (parcial); [Singh et al., 2024]; [Tudor-Locke & Bassett, 2004] |

---

## h. Trazabilidad

| clave | Tablas y campos | Matriz | Nota y sección |
|---|---|---|---|
| `registro_conducta` | `actions`, `action_log(action_id, day, done, note)`, `metrics`, `measurements` | A2, C1, F5 | A §8; C monitorización; F §1, §4 |
| `meta_proceso` | `goals(name, why, success_criteria, status, started_on, horizon_on, review_every_days)`, `actions.schedule`, `milestones` | A7, C1, C2 | C modelo de meta; A §7 |
| `plan_accion` | `actions(goal_id, name, cue, kind, schedule)` | A3, A6 | A §3, §6 |
| `senal_contexto` | `actions.cue` | A3 | A §3, §4 |
| `plan_afrontamiento` | `if_then_plans(action_id, situation, response)` | A6 | A §6 |
| `plan_si_entonces` | `if_then_plans`, `plan_reviews(helpful, note)`, `reminders(ref_kind='plan')` | A5 | A §5; E §3 |
| `automaticidad_srbai` | `prompts(schedule='event:srbai', kind='scale', source_ref)`, `prompt_answers.value` | A3 | A §3 |
| `revision_semanal` | `reviews(kind='weekly')`, `prompts(schedule='weekly')`, `prompt_answers.review_id` | C5, A2 | C revisión periódica; D §6; A §15 |
| `nuevo_comienzo` | `settings.last_opened_at`, `action_log`, `goals.description` | C7, A10, A11 | C lapsos y fresh start; E §6, §8 (12–15) |
| `revision_objetivo` | `reviews(kind='goal')`, `goals(status, last_reviewed_at, why, close_reason` **nuevo**`)`, `prompts(schedule='goal_review')` | C6, A7 | C desenganche; A §15 |
| `entorno_checklist` | `strategies(technique, instructions)` | A4 | A §4; B control de estímulos |
| `pausa_stop` | `impulse_episodes(started_at, goal_id, intensity_before, trigger_text)` | B3 | B tolerancia al malestar; protocolo P1 |
| `surfear_impulso` | `strategies(technique)`, `impulse_episodes(strategy_id, intensity_after)` | B1 | B urge surfing; P3 |
| `espera_activa` | `strategies.wait_seconds`, `impulse_episodes(waited_seconds, intensity_after, reflection)` | B2, B5 | B retraso deliberado, regulación emocional; P4 |
| `respuesta_competidora` | `actions(kind='avoid')`, `strategies(technique, alternative)`, métrica `count` | B8 | B inversión de hábitos |
| `pantalla_desliz` | `impulse_episodes(outcome, reflection)`, `action_log(done=0, note)`, `taggings`, `settings.safety_shown_at` | A10, B12, B13 | A §12; B autocompasión, seguridad; C lapsos |
| `modo_observador` | `diary_entries.body`, `taggings` | D4 | D §4 |
| `escritura_expresiva` | `diary_entries`, `taggings` (sesión 1–4) | D1 | D §1, §8 |
| `tres_cosas_buenas` | `prompts(schedule='close')`, `prompt_answers`, `diary_entries` | D3 | D §3 |
| `cierre_del_dia` | `reviews(kind='close')`, `prompts(schedule='close')`, `tasks(scheduled_day)` | D6 | D §6 |
| `apertura_del_dia` | `reviews(kind='open')`, `prompts(schedule='open')` | D6 | D §6 |
| `revision_aplazamientos` | `tasks(postpone_count, last_postponed_at, status, parent_id, project_id, scheduled_day, notes)`, `if_then_plans` | E1, E7, E9 | E §1, §5, §6, §9 |
| `diario_sueno` | `metrics(kind='time'` **nuevo**`, 'count', 'scale')`, `measurements` | F7 | F §10, §12 |
| `recordatorio_accionable` | `reminders(title, due_at, repeat, ref_kind, ref_id, snoozed_until, shown_count, max_shows, done_at)` | E5, E6, E10 | E §4, §8 |
| `respiracion_lenta` | `strategies(technique)`, `impulse_episodes.strategy_id` | B4 | B tolerancia al malestar |
| `distraccion_concreta` | `strategies(technique, alternative)` | B6 | B regulación emocional; P0 |
| `imagen_futura` | `strategies(technique='imagen_futura', instructions, goal_id)` | B2 | B retraso deliberado (EFT); P0 |
| `volver_a_lo_concreto` | `diary_entries`, `taggings` | D8 | D §8 |
| `mejor_yo_posible` | `diary_entries`, `goals` | D7 | D §7 |
| `empezar_cinco_min` | `reminders`, `tasks.notes` | E4 | E §2 |
| `temporizador_bloques` | `settings` | E4 | E §2 |
| `exportar_resumen` | `storage/export`, `settings.support_person` | C8 | C monitorización; F §1 |
| `autorrecompensa` | `milestones.notes` | C4 | C incentivos |
| `registro_alimentacion` | `metrics(sensitive=1, kind='text'/'scale')`, `measurements(note)` | F6 | F §9, §12.5 |
| `autopesaje` | `metrics(kind='number', sensitive=1, direction, frequency='weekly')`, `measurements` | F2, F1 | F §2, §3, §12 |
| Mensaje fijo de seguridad | `settings(safety_contact, safety_shown_at)` | B13 | B límites de seguridad |
| Motor de métricas | `metrics`, `measurements`, `src/analysis` | F1, F3, F4, F5, F8, C1, A8 | F §12; C variabilidad |

**Cambios de esquema que requiere esta especificación** (migración v5, sin tocar las
anteriores): `goals.close_reason TEXT` (achieved / no_longer_matters / unattainable /
replaced); `metrics.kind` admite `time`; `settings` usa las claves `last_opened_at`,
`safety_contact`, `safety_shown_at`, `support_person`, `birth_year` (opcional) y
`system_notifications` (experimental). Todo lo demás cabe en el esquema actual: la
configuración del episodio (entorno, imagen futura, distracciones, respuesta competidora,
tiempo de espera) son filas de `strategies` cuyo `technique` es la `clave` de este
catálogo.
