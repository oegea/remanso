# E. Recordatorios y procrastinación

Nota de investigación para una app TUI offline, sin IA y sin clínico, de uso individual.
Fecha: 2026-11-05. Idioma: español (títulos, autores, escalas y términos técnicos en el original).

Nota metodológica: el presupuesto de búsqueda web de la sesión se agotó a mitad de la
investigación; a partir de ahí las verificaciones se hicieron por consulta directa de PubMed
(E-utilities), Crossref y repositorios institucionales. Lo que no pudo abrirse se marca como
`parcialmente` o `NO verificado` en las referencias y no se citan cifras de ello.

---

## 1. Marco conceptual: la procrastinación como fallo de autorregulación

### Procrastinación como fallo de autorregulación y reparación del estado de ánimo a corto plazo
- **Mecanismo propuesto:** la procrastinación es un *retraso voluntario de una acción prevista a pesar de esperar estar peor por ello*. La Temporal Motivation Theory (TMT; Steel & König 2006) la modela como el producto de expectativa × valor dividido por la impulsividad y el retraso hasta la recompensa (descuento hiperbólico): las tareas aversivas con recompensa lejana pierden frente a alternativas gratificantes inmediatas. Sirois & Pychyl (2013) añaden la lectura emocional: procrastinar es priorizar la reparación del estado de ánimo *ahora* (evitar la aversión de la tarea) a costa del *yo futuro*.
- **Objetivo conductual:** entender qué palancas tocar: aversión percibida de la tarea, distancia temporal, autoeficacia, impulsividad/distractibilidad.
- **Evidencia a favor:** Steel (2007), meta-análisis en *Psychological Bulletin* sobre 691 correlaciones: los predictores más fuertes y consistentes son aversión de la tarea, retraso de la recompensa, baja autoeficacia, impulsividad y facetas de responsabilidad (autocontrol, distractibilidad, organización, motivación de logro); neuroticismo, rebeldía y búsqueda de sensaciones muestran vínculos débiles. Sirois & Pychyl (2013) es una revisión teórica (no empírica). Rozental & Carlbring (2014) estiman prevalencia de ~20 % en adultos y ~50 % en estudiantes y proponen el análisis funcional como herramienta clínica.
- **Limitaciones metodológicas:** evidencia **correlacional** (autoinforme, muestras mayoritariamente universitarias); la TMT es un marco integrador, no una teoría contrastada experimentalmente en su conjunto.
- **Calidad y consistencia de la evidencia:** Moderada para la *descripción* de correlatos (meta-análisis grande, hallazgos replicados); Baja para las afirmaciones causales.
- **Poblaciones estudiadas:** sobre todo estudiantes universitarios occidentales; algunos adultos de comunidad.
- **Riesgos / efectos adversos:** etiquetar al usuario como "procrastinador" (rasgo) puede reforzar la identidad y la vergüenza; la literatura apunta a que la vergüenza y el afecto negativo *alimentan* la evitación.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** el modelo da directamente las cuatro preguntas del flujo de revisión (sección 13): ¿la tarea es aversiva/aburrida? ¿la recompensa está lejos (hacerla más próxima: subobjetivo)? ¿dudas de poder hacerla (bajar el escalón)? ¿hay un distractor más atractivo? También justifica tratar los recordatorios como *ayudas de autorregulación* y no como control externo.
- **Confianza en su utilidad:** Alta como marco; no es una intervención.
- **Decisión sugerida:** Incluir (como marco de diseño y de las preguntas de revisión, nunca como etiqueta diagnóstica).

### Intervenciones psicológicas para la procrastinación (TCC, autoayuda, autorregulación)
- **Mecanismo propuesto:** reestructuración cognitiva de creencias ("tengo que estar motivado para empezar"), exposición graduada a tareas aversivas, planificación, control de estímulos, autorrefuerzo.
- **Objetivo conductual:** reducir la procrastinación medida con escalas (Pure Procrastination Scale, Irrational Procrastination Scale, Aitken).
- **Evidencia a favor:**
  - van Eerde & Klingsieck (2018), meta-análisis, 24 estudios, k = 44, N = 1 173: "gran reducción" de la procrastinación tras la intervención, estable en seguimiento; la TCC parece la modalidad más eficaz; la duración de la intervención no moderó el efecto. (El resumen no da el tamaño de efecto; no lo cito.)
  - Rozental et al. (2018a), meta-análisis de 12 ECA (21 comparaciones, N = 718) con comparador inactivo: g = 0,34 [0,11; 0,56], I² = 61 %; subgrupo TCC (3 estudios, N = 236) g = 0,55 [0,32; 0,77]. Efecto *pequeño* en conjunto.
  - Malouff & Schutte (2019), meta-análisis de 12 ECA, N = 646: g = 1,18; efectos mayores con formato presencial, muestras de estudiantes y control sin tratamiento.
  - Rozental et al. (2018b), ECA pragmático, N = 92 estudiantes con procrastinación severa: TCC por internet autoguiada vs TCC grupal, 8 semanas; mejoras intra-grupo grandes en ambas (d = 1,29 y 1,24), sin diferencias entre condiciones; 33,7 % respondedores post y 46,7 % a 6 meses; pero la condición **autoguiada** mostró signos de deterioro al seguimiento, mientras que la grupal mantuvo o mejoró.
  - Turner & Hodis (2023), revisión sistemática en *Educational Psychology Review* sobre intervenciones para procrastinación académica (sólo metadatos verificados; no cito hallazgos).
- **Limitaciones metodológicas:** las tres meta-análisis discrepan mucho (g de 0,34 a 1,18) por criterios de inclusión y comparadores; estudios pequeños (6–50 por brazo), muchas tesis doctorales, autoinforme no cegado, asimetría en el funnel plot; casi nada de seguimiento largo.
- **Calidad y consistencia de la evidencia:** Moderada-Baja: la dirección es consistente (las intervenciones reducen la procrastinación), la magnitud es incierta.
- **Poblaciones estudiadas:** estudiantes universitarios casi exclusivamente.
- **Riesgos / efectos adversos:** el hallazgo de Rozental 2018b es la señal más relevante para este proyecto: **la autoayuda sin apoyo humano puede no sostenerse**; un programa autoguiado que "falla" puede confirmar la creencia de incapacidad.
- **Frecuencia o dosis estudiada:** 8 semanas, módulos semanales (ECA); duración no moderadora en la meta-análisis.
- **Aplicabilidad a una app offline sin IA:** se pueden implementar componentes aislados y de bajo riesgo (análisis funcional guiado por preguntas, descomposición de tareas, planificación si-entonces, registro de "qué pasó cuando lo aplacé"), presentados como experimentos personales, no como "tratamiento". No intentar replicar un programa de TCC completo.
- **Confianza en su utilidad:** Media.
- **Decisión sugerida:** Incluir como experimental (componentes), Descartar (programa clínico completo).

---

## 2. Reducir la fricción y las barreras de inicio

### Arquitectura de decisiones: defaults y "sludge"
- **Mecanismo propuesto:** la gente tiende a mantener la opción por defecto (inercia, aprobación implícita, dotación); la fricción administrativa innecesaria ("sludge", Sunstein 2019) reduce la ejecución de intenciones ya formadas.
- **Objetivo conductual:** que la acción deseada requiera el mínimo de pasos y la opción saludable sea la por defecto.
- **Evidencia a favor:** Jachimowicz et al. (2019), meta-análisis de 58 conjuntos de datos (55 estudios, N = 73 675): d = 0,68 [0,53; 0,83] a favor del opt-out frente al opt-in (≈ +27 puntos absolutos en resultados binarios); mayor efecto cuando el default se percibe como recomendación ("endorsement") o como statu quo; I² ≈ 98 %. Sunstein (2019) "Sludge and Ordeals" es un ensayo normativo (no empírico). Thaler & Sunstein (2008) es un libro de síntesis.
- **Limitaciones metodológicas:** heterogeneidad enorme; dominios (pensiones, donación de órganos, consumo) lejanos a la autogestión personal; casi ningún estudio de defaults *autoimpuestos* en apps.
- **Calidad y consistencia de la evidencia:** Alta para el efecto default en políticas públicas; Muy baja para su traslado directo a una app personal.
- **Poblaciones estudiadas:** adultos en contextos de política pública y consumo.
- **Riesgos / efectos adversos:** defaults que el usuario no eligió erosionan la autonomía (ver sección 11); la percepción de manipulación genera reactancia.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** (1) auditar el "sludge" interno: crear una tarea o marcar un hábito debe costar una tecla; (2) defaults sensatos pero *visibles y editables* en la primera pantalla (p. ej. recordatorio semanal, no diario); (3) nunca pedir datos que no se usan.
- **Confianza en su utilidad:** Alta (para el diseño de la propia interfaz).
- **Decisión sugerida:** Incluir.

### Efecto Zeigarnik / Ovsiankina y "empieza sólo 5 minutos"
- **Mecanismo propuesto:** las tareas interrumpidas se recordarían mejor (Zeigarnik) y generarían una tendencia a retomarlas (Ovsiankina); de ahí el consejo popular de "empezar aunque sea 5 minutos" para que la tarea "tire" de uno.
- **Objetivo conductual:** iniciar la tarea.
- **Evidencia a favor:** Ghibellini & Meier (2025), meta-análisis: **no** hay ventaja de memoria para tareas inacabadas (efecto Zeigarnik no sostenido), pero sí una tendencia general a reanudar tareas interrumpidas (Ovsiankina), posiblemente dependiente de autoridad del experimentador e implicación en la tarea. El "regla de los 5 minutos" no tiene estudios propios que haya podido localizar: es **folclore** plausible apoyado indirectamente en (a) Ovsiankina y (b) la evidencia de que las intenciones de implementación facilitan la *iniciación* eficiente de la acción (Brandstätter, Lengfelder & Gollwitzer 2001, cuatro estudios, incluidos pacientes con esquizofrenia y en desintoxicación).
- **Limitaciones metodológicas:** literatura antigua, de laboratorio, con tareas triviales; el meta-análisis no da cifras en el resumen.
- **Calidad y consistencia de la evidencia:** Baja (Ovsiankina), Muy baja (Zeigarnik, "5 minutos").
- **Poblaciones estudiadas:** estudiantes, laboratorio.
- **Riesgos / efectos adversos:** ninguno relevante; riesgo de prometer un efecto ("una vez empiezas no parás") que no se cumple.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** ofrecer la opción "empezar 5 min" como *experimento* (temporizador corto + pregunta posterior "¿seguiste?") y registrar si al usuario le funciona; nunca presentarla como ley psicológica.
- **Confianza en su utilidad:** Media (barato, inocuo).
- **Decisión sugerida:** Incluir como experimental.

### Pomodoro y pausas sistemáticas
- **Mecanismo propuesto:** bloques cortos de trabajo con pausas fijas reducirían la fatiga y el coste de iniciar.
- **Objetivo conductual:** sostener la concentración, completar tareas.
- **Evidencia a favor:** Biwer et al. (2023), 87 estudiantes en un día de estudio real: pausas sistemáticas (incluida una condición tipo Pomodoro 24/6) vs pausas autorreguladas: **sin diferencia** en esfuerzo invertido ni en tareas completadas; los que se autorregulaban hacían sesiones y pausas más largas y reportaban más fatiga y distracción y menos concentración y motivación. Un estudio de seguimiento (2025, PMC) comparando autorregulado/Pomodoro/Flowtime: Pomodoro aumentó la fatiga más rápido y la motivación decayó más rápido, sin diferencias en tareas completadas. La evidencia es pequeña y contradictoria.
- **Limitaciones metodológicas:** N pequeño, un solo día, autoinforme, aleatorización no confirmada.
- **Calidad y consistencia de la evidencia:** Baja.
- **Poblaciones estudiadas:** estudiantes universitarios holandeses.
- **Riesgos / efectos adversos:** interrumpir el flujo en tareas creativas; rigidez.
- **Frecuencia o dosis estudiada:** 24–25 min trabajo / 5–6 min pausa.
- **Aplicabilidad a una app offline sin IA:** un temporizador opcional con duración elegida por el usuario; no vender el 25/5 como óptimo.
- **Confianza en su utilidad:** Baja-Media.
- **Decisión sugerida:** Incluir como experimental (opcional, configurable).

---

## 3. Intenciones de implementación (planes si-entonces)

### Intenciones de implementación para iniciar tareas y vencer la procrastinación
- **Mecanismo propuesto:** vincular una señal situacional concreta ("si es lunes a las 9 y he abierto el portátil…") a una acción ("…entonces escribo el primer párrafo") delega el inicio a un proceso automático y protege la intención frente a la aversión del momento.
- **Objetivo conductual:** pasar de la intención a la acción; iniciación puntual.
- **Evidencia a favor:**
  - Gollwitzer & Sheeran (2006), meta-análisis de 94 tests: d = 0,65 sobre consecución de metas, frente a controles que *ya tenían* la intención.
  - Sheeran, Listrom & Gollwitzer (2024), meta-análisis de 642 tests: estimaciones más modestas (según resúmenes secundarios, d global ≈ 0,36 y menor tras corrección por sesgo de publicación; **cifras no verificadas de primera mano**).
  - Owens, Bowman & Dill (2008), N = 152 estudiantes: formar una intención de implementación para acudir a una cita hizo casi 8 veces más probable acudir; la interacción con el nivel de procrastinación no fue significativa (funciona igual en procrastinadores altos y bajos).
  - Milkman et al. (2011), experimento de campo aleatorizado en una gran empresa (vacuna de la gripe): pedir anotar fecha +1,5 puntos (n.s.); anotar fecha **y hora** +4,2 puntos (significativo) sobre un control del 33,1 %.
  - Gollwitzer & Brandstätter (1997), JPSP (sólo metadatos verificados; el hallazgo clásico sobre metas difíciles no se cita en cifras).
- **Limitaciones metodológicas:** sesgo de publicación evidente entre 2006 y 2024; muchos estudios de laboratorio o de una sola conducta; los efectos sobre conductas repetidas y complejas son menores que sobre actos puntuales.
- **Calidad y consistencia de la evidencia:** Moderada (efecto real, probablemente pequeño-moderado, dirección muy consistente).
- **Poblaciones estudiadas:** estudiantes, empleados, pacientes; también poblaciones con control ejecutivo deteriorado (Brandstätter 2001).
- **Riesgos / efectos adversos:** planes demasiado rígidos pueden generar culpa si la señal falla; planes impuestos (no elegidos) pierden eficacia.
- **Frecuencia o dosis estudiada:** una formulación por meta; el detalle (hora + lugar) importa (Milkman 2011).
- **Aplicabilidad a una app offline sin IA:** al crear o aplazar una tarea, campo opcional "¿Cuándo y dónde exactamente?" con plantilla *Si [señal], entonces [primera acción]*; el recordatorio muestra ese texto literal del usuario, no un genérico.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir.

---

## 4. Diseño de recordatorios

### Recordatorios (SMS / prompts) como técnica de cambio conductual
- **Mecanismo propuesto:** el recordatorio actúa como señal externa ("prompt/cue", BCT 7.1) que compensa el olvido y la falta de saliencia; su efecto es sobre la *ejecución* de una intención ya existente, no sobre la motivación.
- **Objetivo conductual:** adherencia a medicación, asistencia a citas, conductas de salud periódicas.
- **Evidencia a favor:**
  - Thakkar et al. (2016), meta-análisis de 16 ECA, N = 2 742 adultos con enfermedad crónica: OR = 2,11 para adherencia; OR ajustada por sesgo de publicación 1,68 [1,18; 2,39]; I² = 62 %; equivalente a pasar de 50 % a ~68 % de adherencia; la personalización, la bidireccionalidad y la frecuencia diaria **no** modificaron el efecto. Ensayos de ~12 semanas, mayoría con adherencia autoinformada.
  - Gurol-Urganci et al. (2013), revisión Cochrane: SMS vs nada, 7 ECA, N = 5 841, RR = 1,14 [1,03; 1,26] en asistencia a citas (evidencia moderada); SMS equivalente a llamada telefónica (RR 0,99) y más barato.
  - Fry & Neff (2009), revisión sistemática de 19 estudios (N = 15 655) sobre prompts periódicos en promoción de la salud: 11 con resultados positivos; mayor efecto con prompts frecuentes y combinados con contacto personal de un consejero; sin datos de largo plazo.
  - Pop-Eleches et al. (2011), ECA, N = 431, adherencia a antirretrovirales medida electrónicamente 48 semanas: SMS **semanales** 53 % vs 40 % control con ≥ 90 % adherencia (p = 0,03); SMS **diarios** 41 % vs 40 % (n.s.). Los autores atribuyen el fallo de los diarios a habituación o intrusividad (hipótesis, no demostrada).
- **Limitaciones metodológicas:** la mayoría son conductas simples y discretas (tomar una pastilla, acudir a una cita), con un receptor externo que envía el mensaje; efecto a corto plazo; autoinforme.
- **Calidad y consistencia de la evidencia:** Moderada para conductas simples a corto plazo; Baja para tareas complejas y aversivas (que es justamente lo que se procrastina).
- **Poblaciones estudiadas:** pacientes crónicos, VIH en entornos de bajos recursos, usuarios de servicios sanitarios.
- **Riesgos / efectos adversos:** habituación con frecuencia alta; el recordatorio no sustituye a la motivación: recordar algo que uno no quiere hacer puede aumentar la aversión.
- **Frecuencia o dosis estudiada:** desde diaria hasta semanal; la única comparación directa (Pop-Eleches) favorece la semanal; el meta-análisis de Thakkar no encuentra ventaja de la diaria.
- **Aplicabilidad a una app offline sin IA:** una TUI offline sólo puede "recordar" cuando el usuario la abre (o mediante notificaciones del sistema si se integra). Esto convierte la pantalla de inicio en el recordatorio: una lista de **pendientes** breve, con la primera acción y el plan si-entonces visibles.
- **Confianza en su utilidad:** Media-Alta.
- **Decisión sugerida:** Incluir (con límites de frecuencia).

### Fatiga de notificaciones, habituación y "alarm fatigue"
- **Mecanismo propuesto:** la respuesta a un estímulo repetido decrece (habituación); cuando la mayoría de alarmas son no accionables, el receptor aprende a ignorarlas o retrasa la respuesta.
- **Objetivo conductual:** mantener la eficacia del recordatorio a lo largo del tiempo.
- **Evidencia a favor:**
  - Pielot, Church & de Oliveira (2014), estudio in situ de 1 semana, 15 usuarios: ~63,5 notificaciones/día; la mediana de visualización va de 3,5 min (mensajería) a 27,7 min (email en fin de semana); el volumen de email correlacionó con sentirse estresado (ρ = 0,36), interrumpido (0,50), molesto (0,41) y presionado a responder (0,40). Correlacional, N muy pequeño.
  - Mehrotra et al. (2016), 20 usuarios, 10 372 notificaciones: la disrupción percibida depende del momento (máxima en mitad de una tarea, mínima antes de empezar una nueva o en reposo), de la relación con el emisor y de la complejidad de la tarea.
  - Bidargaddi et al. (2018), microensayo aleatorizado, N = 1 255, 89 días: enviar una notificación aumentó la probabilidad de usar la app en 24 h un 3,9 % (RR 1,039 [1,01; 1,08]); efecto mayor los fines de semana y al mediodía (exploratorio); el efecto tendió a atenuarse con el tiempo (n.s.).
  - Klasnja et al. (2019), microensayo HeartSteps, N = 44, 6 semanas, hasta 5 sugerencias/día: las sugerencias de caminar aumentaron los pasos en los 30 min siguientes (+24 %, p = 0,02), pero el efecto fue grande al inicio (+107 %) y **se disipó a lo largo del estudio**.
  - Morrison et al. (2017), ECA exploratorio, N = 77: notificaciones "inteligentes" y diarias se vieron y accionaron más que las ocasionales (d ≈ 0,43–0,50) sin disuadir del uso de la app; el ajuste adaptativo del momento no siempre mejoró el uso.
  - Paine et al. (2016), revisión sistemática de alarmas clínicas (24 estudios observacionales + 8 de intervención): sólo <1 %–36 % de las alarmas eran accionables; dos estudios relacionan alta exposición a alarmas con mayor tiempo de respuesta; evidencia "emergente", alto riesgo de sesgo. Lewandowska et al. (2020), revisión de 7 estudios (389 enfermeras de UCI): las alarmas se perciben como carga excesiva y reducen la confianza en el sistema.
- **Limitaciones metodológicas:** HCI con N pequeños y autoinforme; los microensayos miden engagement proximal, no resultados conductuales a largo plazo; la literatura clínica de alarmas es observacional y con sesgo.
- **Calidad y consistencia de la evidencia:** Baja-Moderada; muy consistente en *dirección* (más notificaciones ⇒ más molestia; efecto que decae), poco precisa en *umbrales*.
- **Poblaciones estudiadas:** usuarios de smartphone, empleados, enfermería de UCI.
- **Riesgos / efectos adversos:** ignorar también los avisos importantes; abandono de la app; irritación.
- **Frecuencia o dosis estudiada:** 1–5 prompts/día en microensayos; la efectividad decae en semanas.
- **Aplicabilidad a una app offline sin IA:** limitar el número de "avisos" por sesión; que todo aviso sea accionable (una tecla para hacer, aplazar o descartar); evitar repetir el mismo aviso sin cambio de contenido; preferir mostrar el estado cuando el usuario abre la app a interrumpirle.
- **Confianza en su utilidad:** Alta (como restricción de diseño).
- **Decisión sugerida:** Incluir (como reglas de limitación).

### Frecuencia, momento elegido por el usuario y "snooze"
- **Mecanismo propuesto:** el recordatorio funciona cuando coincide con una ventana de oportunidad (disponibilidad, contexto) y pierde valor si llega en mitad de otra tarea; el usuario conoce sus ventanas mejor que un algoritmo simple.
- **Objetivo conductual:** maximizar la probabilidad de actuar tras el aviso y minimizar la molestia.
- **Evidencia a favor:** (a) semanal > diario en Pop-Eleches 2011 y ausencia de ventaja de lo diario en Thakkar 2016; (b) momentos de baja carga/transición en Mehrotra 2016 y mediodía/fin de semana en Bidargaddi 2018; (c) las intenciones de implementación con hora concreta superan a las de sólo fecha (Milkman 2011), lo que apoya que el usuario fije él mismo el momento; (d) Stawarz, Cox & Blandford (2015, CHI) argumentan que los recordatorios apoyan la ejecución pero pueden crear dependencia y no sustituyen a la señal contextual necesaria para formar hábitos (**sólo metadatos verificados**). Sobre el comportamiento de "snooze"/posponer no he podido verificar ningún estudio empírico específico; lo que sigue es inferencia de diseño.
- **Limitaciones metodológicas:** una sola comparación directa diario vs semanal, en un contexto (VIH, Kenia) muy distinto; HCI de muestras pequeñas.
- **Calidad y consistencia de la evidencia:** Baja.
- **Poblaciones estudiadas:** pacientes, empleados, usuarios de smartphone.
- **Riesgos / efectos adversos:** un "snooze" infinito convierte el recordatorio en ruido y la tarea en fuente crónica de culpa; recordatorios rígidos en momento inoportuno se ignoran.
- **Frecuencia o dosis estudiada:** diaria vs semanal; 1–6 prompts/día.
- **Aplicabilidad a una app offline sin IA:** el usuario elige el momento y la frecuencia; default semanal para revisión de metas, diario sólo para hábitos que el usuario marca como diarios; aplazar es una acción legítima pero con contador visible y, a partir de N aplazamientos, se ofrece la revisión (sección 13) en lugar de otro aplazamiento silencioso.
- **Confianza en su utilidad:** Media.
- **Decisión sugerida:** Incluir (frecuencia y hora configurables; contador de aplazamientos).

---

## 5. Fragmentar la tarea

### Subobjetivos próximos y "siguiente acción física"
- **Mecanismo propuesto:** metas próximas y concretas acortan la distancia temporal (TMT), dan señales de progreso que elevan la autoeficacia y reducen la aversión de la primera acción. La "next physical action" de GTD (Allen 2001) es una heurística de productividad sin evaluación empírica propia.
- **Objetivo conductual:** iniciar y persistir en tareas largas o ambiguas.
- **Evidencia a favor:** Bandura & Schunk (1981), JPSP, experimento clásico con niños: los subobjetivos próximos mejoraron autoeficacia, interés y rendimiento frente a metas distales (sólo metadatos verificados; no cito cifras). Huang, Jin & Zhang (2017), OBHDP: los subobjetivos ayudan al inicio pero pueden restar en la fase final, donde conviene enfocarse en la meta global (sólo metadatos verificados). Indirectamente, Steel (2007) muestra que el *retraso* de la recompensa es uno de los predictores más fuertes de procrastinar.
- **Limitaciones metodológicas:** evidencia directa escasa y antigua; la mayoría proviene de aprendizaje escolar y marketing (programas de fidelización).
- **Calidad y consistencia de la evidencia:** Baja-Moderada (consistente con la teoría, pocos ensayos).
- **Poblaciones estudiadas:** niños, estudiantes, consumidores.
- **Riesgos / efectos adversos:** sobre-fragmentar genera listas interminables y sensación de burocracia (sludge autoinfligido); perder de vista el porqué.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** al crear una tarea grande, pedir (opcional) "¿Cuál es la primera acción concreta que podrías hacer en menos de 15 minutos?"; mostrar sólo esa primera acción en la lista de pendientes; en el flujo de revisión, "¿es demasiado grande?" lleva a dividirla.
- **Confianza en su utilidad:** Media-Alta.
- **Decisión sugerida:** Incluir.

---

## 6. Compromisos, aplazamientos y retomar tareas abandonadas

### Dispositivos de compromiso y precompromiso
- **Mecanismo propuesto:** el yo presente restringe voluntariamente las opciones del yo futuro (penalizaciones, depósitos, compromisos públicos) para contrarrestar el sesgo al presente.
- **Objetivo conductual:** cumplir metas con beneficios diferidos.
- **Evidencia a favor:** Bryan, Karlan & Nelson (2010), revisión en *Annual Review of Economics*: distingue compromisos "duros" (coste real) y "blandos" (psicológicos) y revisa evidencia de laboratorio y campo sobre su demanda y eficacia. Rogers, Milkman & Volpp (2014), *Viewpoint* en JAMA: los dispositivos de compromiso son eficaces pero su **aceptación y mantenimiento son bajos**; proponen feedback positivo temprano y apoyo al mantenimiento (ensayo de opinión, no estudio).
- **Limitaciones metodológicas:** sesgo de autoselección (quien elige un compromiso ya está motivado); los compromisos "duros" son inviables en una app offline sin terceros.
- **Calidad y consistencia de la evidencia:** Moderada en economía del comportamiento para compromisos duros; Baja para compromisos blandos autoadministrados.
- **Poblaciones estudiadas:** ahorradores, fumadores, pacientes, consumidores.
- **Riesgos / efectos adversos:** culpa y autocastigo cuando se incumple; baja adopción; un compromiso que la app "reclama" se percibe como control externo.
- **Frecuencia o dosis estudiada:** variable.
- **Aplicabilidad a una app offline sin IA:** sólo compromisos blandos y auto-redactados ("me comprometo a X el [día] porque [razón]"), guardados y mostrados textualmente al revisar; **nunca** penalizaciones ni "rachas rotas" como castigo. Mostrar la razón escrita por el propio usuario es la forma más autónoma de "recordar el compromiso".
- **Confianza en su utilidad:** Media-Baja.
- **Decisión sugerida:** Modificar (sólo compromiso blando, textual, revisable).

### Efecto "fresh start" (nuevos comienzos)
- **Mecanismo propuesto:** los hitos temporales (lunes, inicio de mes, cumpleaños) separan períodos de "contabilidad mental" y desconectan al yo actual de los fallos pasados, aumentando la motivación aspiracional.
- **Objetivo conductual:** retomar metas abandonadas.
- **Evidencia a favor:** Dai, Milkman & Riis (2014), *Management Science*: tres estudios archivísticos de campo (búsquedas de "diet" en Google, visitas al gimnasio, compromisos en una web de metas) aumentan tras hitos temporales. Evidencia **correlacional/observacional** a gran escala.
- **Limitaciones metodológicas:** sin manipulación experimental en el artículo principal; no se mide si la motivación se mantiene; trabajos posteriores sugieren que un "fresh start" también puede interrumpir rachas de progreso en marcha (no verificado aquí; no se cita).
- **Calidad y consistencia de la evidencia:** Baja-Moderada.
- **Poblaciones estudiadas:** población general (datos agregados), estudiantes.
- **Riesgos / efectos adversos:** esperar al "lunes" como excusa para no empezar hoy.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** al detectar inactividad de varios días, ofrecer (no imponer) "Hoy es lunes / 1 de mes: ¿quieres retomar o replanificar?"; permitir "reiniciar" una meta sin borrar el historial y sin marcar los días ausentes como fallos.
- **Confianza en su utilidad:** Media.
- **Decisión sugerida:** Incluir como experimental.

### Autoperdón y autocompasión tras procrastinar
- **Mecanismo propuesto:** la culpa y la vergüenza aumentan el afecto negativo asociado a la tarea, que es precisamente lo que se evita procrastinando (círculo vicioso de Sirois & Pychyl). Perdonarse reduce ese afecto y libera recursos para actuar.
- **Objetivo conductual:** reducir la procrastinación futura y el estrés.
- **Evidencia a favor:** Wohl, Pychyl & Bennett (2010), estudio longitudinal de dos exámenes parciales con ~119 estudiantes de primer año: perdonarse por haber procrastinado antes del primer examen predijo **menos** procrastinación antes del segundo, mediado por menor afecto negativo; el efecto se observó sobre todo en quienes más habían procrastinado. Sirois (2014), cuatro muestras (N = 145, 339, 190, 94; estudiantes y adultos de comunidad): la autocompasión media la relación entre procrastinación rasgo y estrés. Estudios 2020–2026 revisados (ocho registros PubMed con "self-compassion" y "procrastination" en el título, p. ej. Dong et al. 2026, N = 7 174, tres olas): todos **correlacionales**, consistentes en que la autocompasión predice menos procrastinación (incl. procrastinación a la hora de dormir) vía menor afecto negativo; **no localicé ningún ECA** que manipule la autocompasión para reducir la procrastinación.
- **Limitaciones metodológicas:** correlacional o longitudinal con autoinforme; muestras universitarias; sin intervención controlada.
- **Calidad y consistencia de la evidencia:** Baja-Moderada (muy consistente, pero no experimental).
- **Poblaciones estudiadas:** estudiantes (Canadá, China, Pakistán), adultos de comunidad.
- **Riesgos / efectos adversos:** una autocompasión mal entendida como permisividad ("no pasa nada") podría usarse para justificar nuevos aplazamientos; la literatura, sin embargo, apunta en la dirección contraria.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** todo el lenguaje de la app tras un aplazamiento o ausencia debe ser neutro o compasivo (ver reglas); incluir en el flujo de revisión una frase breve del tipo "Aplazar es frecuente y no dice nada de ti; miremos qué lo hizo difícil".
- **Confianza en su utilidad:** Alta (bajo coste, sin riesgo plausible, coherente con el modelo).
- **Decisión sugerida:** Incluir.

---

## 7. Mensajes insistentes, culpa, miedo y autonomía

### Reactancia psicológica ante mensajes controladores
- **Mecanismo propuesto:** una amenaza percibida a la libertad genera reactancia (Brehm 1966; marco teórico), operacionalizada como mezcla de ira y contraargumentos, que reduce actitudes e intenciones hacia la conducta recomendada.
- **Objetivo conductual:** evitar que el recordatorio produzca lo contrario de lo que pretende.
- **Evidencia a favor:** Dillard & Shen (2005), dos estudios (N = 196 y 200) sobre mensajes de salud (uso de hilo dental, alcohol): la reactancia, medida como ira + cogniciones negativas, mediaba por completo el efecto de la amenaza a la libertad sobre actitud e intención. Rains (2013), meta-análisis de k = 20 estudios (N ≈ 4 942): el modelo "entrelazado" (reactancia como factor latente de ira y contraargumentos) es el que mejor ajusta.
- **Limitaciones metodológicas:** estudios de laboratorio con mensajes únicos; estudiantes; pocos estudios sobre recordatorios *repetidos* en apps.
- **Calidad y consistencia de la evidencia:** Moderada (meta-análisis consistente sobre el constructo); Baja sobre su magnitud en apps de autoayuda.
- **Poblaciones estudiadas:** estudiantes universitarios.
- **Riesgos / efectos adversos:** aquí el "riesgo" es el objeto de estudio: lenguaje imperativo ("¡Debes…!", "No lo dejes otra vez") y repetición insistente generan reactancia.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** redactar recordatorios en forma de información y elección, nunca de orden; eliminar "deberías", signos de exclamación y juicios sobre el pasado.
- **Confianza en su utilidad:** Alta (como restricción de redacción).
- **Decisión sugerida:** Incluir.

### Apelaciones al miedo y a la culpa
- **Mecanismo propuesto:** el miedo o la culpa motivarían la acción protectora; el riesgo es la evitación defensiva o el rechazo del mensaje.
- **Objetivo conductual:** persuasión hacia conductas de salud.
- **Evidencia a favor (con matices):** Tannenbaum et al. (2015), meta-análisis de 127 artículos, 248 muestras, N = 27 372: las apelaciones al miedo tienen un efecto positivo pequeño (d = 0,29) y los autores no hallan condiciones en que se vuelvan contraproducentes; funcionan mejor con mensajes de eficacia, para conductas puntuales y en audiencias mayoritariamente femeninas. Xu & Guo (2018), meta-análisis de k = 8, N = 2 061: la culpa inducida se asocia a mejores actitudes e intenciones de salud (r = 0,49), con heterogeneidad. **Matiz clave:** ambos miden actitudes/intenciones hacia conductas de salud tras *un* mensaje; no miden conducta repetida ni bienestar; y la literatura de procrastinación (Wohl 2010; Sirois 2014) muestra que el afecto negativo *alimenta* la procrastinación. Tannenbaum subraya que el efecto es pequeño y que el miedo no debe ser la única herramienta.
- **Limitaciones metodológicas:** exposición única; variables de resultado proximales; estudiantes; no hay estudios sobre recordatorios culpabilizadores repetidos en apps de productividad.
- **Calidad y consistencia de la evidencia:** Moderada para el efecto persuasivo puntual; Muy baja para su uso en recordatorios repetidos de tareas propias.
- **Poblaciones estudiadas:** adultos y estudiantes en campañas de salud pública.
- **Riesgos / efectos adversos:** afecto negativo acumulado, evitación de la app (que es la fuente de la culpa), reactancia.
- **Frecuencia o dosis estudiada:** mensaje único.
- **Aplicabilidad a una app offline sin IA:** no usar culpa ni miedo en recordatorios ni en estados ("Has fallado 5 días"). El único "miedo" legítimo es el que el propio usuario escribió como razón de su meta, mostrado textualmente.
- **Confianza en su utilidad:** Alta (para *no* hacerlo).
- **Decisión sugerida:** Descartar (culpa/miedo generados por la app).

### Mensajería que apoya la autonomía (SDT)
- **Mecanismo propuesto:** según la Self-Determination Theory, satisfacer autonomía, competencia y vinculación genera motivación autónoma, que predice mantenimiento conductual; la motivación controlada (presión, culpa) no.
- **Objetivo conductual:** adherencia sostenida y bienestar.
- **Evidencia a favor:** Ntoumanis et al. (2021), meta-análisis de 73 estudios de intervención basados en SDT en salud: efectos pequeños-moderados en constructos SDT y en conducta de salud al final y en seguimiento; el aumento de apoyo a las necesidades y de motivación autónoma se asocia a cambio conductual positivo; la motivación controlada y la amotivación, no. Teixeira et al. (2020), clasificación por consenso de 18 expertos de 21 técnicas motivacionales SDT (p. ej. ofrecer opciones, dar razones, reconocer la perspectiva, evitar lenguaje controlador, feedback no evaluativo): es un **marco/clasificación**, no un estudio de eficacia.
- **Limitaciones metodológicas:** intervenciones mayoritariamente presenciales con profesionales; heterogeneidad; poca evidencia específica de apps.
- **Calidad y consistencia de la evidencia:** Moderada.
- **Poblaciones estudiadas:** adultos en contextos de salud (ejercicio, dieta, tabaco, enfermedad crónica).
- **Riesgos / efectos adversos:** ninguno conocido.
- **Frecuencia o dosis estudiada:** variable.
- **Aplicabilidad a una app offline sin IA:** aplicar las técnicas de Teixeira que no requieren a un humano: ofrecer opciones (hacer / aplazar / dividir / descartar), mostrar la razón escrita por el usuario (racional), usar lenguaje no controlador, feedback descriptivo ("3 de 5 esta semana") en vez de evaluativo ("¡Fallaste!").
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir.

---

## 8. Reglas de diseño para el motor de recordatorios

Basadas en la evidencia anterior; donde la base es inferencia y no datos, se indica.

**Defaults**
1. Frecuencia por defecto: **semanal** para revisión de metas y tareas aplazadas; **diaria** sólo para hábitos que el usuario declara diarios (Pop-Eleches 2011; Thakkar 2016; Rozental 2018b sugiere además que la revisión periódica es lo que la autoayuda pura pierde).
2. El usuario elige hora y días; la app propone una ventana de transición (inicio de la sesión, no mitad de tarea) y lo explica en una línea (Mehrotra 2016; Bidargaddi 2018).
3. Todo default es visible y editable desde la pantalla donde actúa; cero "sludge": crear, aplazar o completar en una tecla (Jachimowicz 2019; Sunstein 2019).

**Límites de repetición**
4. Máximo **un** bloque de avisos por sesión; nunca interrumpir mientras el usuario escribe (Mehrotra 2016).
5. Un mismo aviso no se repite con el mismo texto más de **2 veces** sin cambiar de modo: a la tercera, se ofrece el flujo de revisión en lugar de otro recordatorio (Klasnja 2019 y Bidargaddi 2018 muestran decaimiento del efecto; Paine 2016 muestra que las alarmas no accionables erosionan la respuesta).
6. Cada aviso es accionable con una tecla: hacer ahora / empezar 5 min / aplazar (elige cuándo) / dividir / revisar / descartar. Ningún aviso "sólo informativo".
7. Nunca contadores negativos ("3 días sin…", "racha rota"); sólo descriptivos ("última vez: martes").

**Redacción**
8. Mostrar literalmente el texto del usuario: su primera acción, su plan si-entonces, su razón. El recordatorio genérico es el que más se habitúa (inferencia de Gollwitzer & Sheeran 2006; Milkman 2011).
9. Forma informativa y de elección, no imperativa: "Pendiente: *escribir el primer párrafo* (lo planeaste para hoy a las 9). ¿Ahora, más tarde o lo revisamos?" en lugar de "¡No lo dejes otra vez!" (Dillard & Shen 2005; Rains 2013; Ntoumanis 2021).
10. Prohibido: "deberías", "otra vez", "fallaste", "has fallado", signos de exclamación, comparación con otros, culpa o miedo generados por la app (Tannenbaum 2015 y Xu & Guo 2018 miden persuasión puntual, no bienestar ni conducta repetida; Wohl 2010 muestra que el afecto negativo alimenta la procrastinación).
11. Feedback descriptivo y no evaluativo: "3 de 5 esta semana", nunca porcentajes de "éxito/fracaso" con color rojo.

**Cuando la app ha estado cerrada varios días**
12. **Nunca marcar nada como "fallido" o "perdido"** retroactivamente. Las tareas con fecha pasada se muestran como **"pendientes"** con la fecha original; los hábitos muestran huecos sin marcar como "no hecho" (hueco ≠ fallo). Razón: evitar el ciclo culpa → evitación de la app (Sirois & Pychyl 2013; Wohl 2010).
13. Al reabrir tras ≥ 3 días: una sola pantalla de bienvenida, neutra: "Han pasado N días. Esto es lo que había pendiente. Puedes retomar, replanificar o cerrar lo que ya no aplique." Si el día es un hito (lunes, inicio de mes), se puede mencionar como oportunidad, no como reproche (Dai 2014, evidencia correlacional).
14. Ofrecer "replanificar todo" en bloque y "archivar lo que ya no importa" en bloque, para no obligar a decidir ítem por ítem (reducir sludge).
15. Permitir "reiniciar" una meta conservando el historial (no borrar: el historial es información para la revisión, no una condena).

**Snooze / aplazar**
16. Aplazar siempre pide *a cuándo* (fecha + hora si es posible; Milkman 2011) y, opcionalmente, *qué cambiará* ("¿qué será distinto entonces?"). No existe "aplazar sin fecha" salvo "mover a algún día" explícito.
17. Cada tarea lleva un contador visible y neutro de aplazamientos; al llegar a **3** se ofrece la revisión (sección 9). El umbral es inferencia de diseño, no cifra de la literatura.

Lo que **no** debe implementarse sin clínico: programas estructurados de TCC "para tratar la procrastinación", cribado de depresión o ansiedad a partir de patrones de aplazamiento (Rozental 2015 muestra un subgrupo "primariamente deprimido" entre procrastinadores severos: la app puede sugerir buscar ayuda si el usuario lo pide, no diagnosticar), penalizaciones o contratos de compromiso duros.

---

## 9. Flujo de revisión no culpabilizador: "tarea aplazada N veces"

Se dispara cuando el contador llega al umbral (default 3) o cuando el usuario lo pide. Una pantalla, tono neutro, todo opcional, salida en cualquier momento.

**Encabezado (sin juicio):**
> "*[Tarea]* se ha aplazado 3 veces. Es muy frecuente; suele indicar algo sobre la tarea, no sobre ti. ¿Miramos qué lo hace difícil? (1 minuto)"

**Preguntas (una a la vez, con opciones de una tecla; base en Steel 2007 / TMT, Sirois & Pychyl 2013 y Rozental & Carlbring 2014):**

1. **¿Sigue importando?** — "Si la completaras, ¿qué cambiaría?" → opciones: *Sí, importa* / *Ya no* / *No lo sé*.
   - *Ya no* → archivar con una línea de cierre ("Decidí no hacerla porque…"); se celebra la decisión como gestión, no como abandono (Bryan 2010: liberar compromisos sin castigo).
2. **¿Es demasiado grande o vaga?** — "¿Sabes exactamente cuál sería el primer paso de menos de 15 minutos?" → *Sí* / *No*.
   - *No* → dividir: pedir la primera acción física concreta; la tarea original pasa a "proyecto" y en pendientes sólo aparece el paso (Bandura & Schunk 1981; Huang 2017; TMT).
3. **¿Hay un obstáculo concreto?** — "¿Falta algo (información, material, otra persona, un momento libre)?" → texto libre breve o *Nada concreto*.
   - Si hay obstáculo → la nueva tarea es *resolver el obstáculo*, con plan si-entonces (Gollwitzer & Sheeran 2006).
4. **¿Es desagradable o da miedo?** — "¿La evitas porque es aburrida, incómoda o temes hacerla mal?" → *Aburrida* / *Incómoda* / *Miedo a hacerlo mal* / *No*.
   - *Aburrida* → emparejar con algo agradable, acotar a 10–15 min, o "5 minutos de prueba" (experimental).
   - *Miedo a hacerlo mal* → reformular como "versión borrador/mínima aceptable"; recordar la razón escrita por el usuario; sin promesas de resultado.
5. **¿Cuándo, exactamente?** — "Si decides mantenerla: ¿qué día y hora, y qué será distinto esa vez?" → fecha + hora + nota (Milkman 2011; Owens 2008).

**Cierre:**
> "Hecho. [Resumen de la decisión en las palabras del usuario]. Aplazar no es fallar: ahora la tarea es más clara."

Opcional, una sola vez por tarea, una frase de autoperdón redactada por el usuario o elegida de una lista corta ("Me perdono por haberla aplazado; ahora sé qué la hacía difícil"), apoyada en Wohl et al. (2010) y Sirois (2014). Nunca obligatorio, nunca repetido.

**Qué no hace el flujo:** no pregunta "¿por qué no lo hiciste?" en abstracto, no muestra el histórico de aplazamientos como gráfico de fallos, no compara con otras tareas ni con "la media", no sugiere problemas psicológicos.

---

## Referencias

[Steel, 2007] The nature of procrastination: A meta-analytic and theoretical review of quintessential self-regulatory failure. Psychological Bulletin, 133(1), 65–94. DOI: 10.1037/0033-2909.133.1.65 | URL: https://ucalgary.scholaris.ca/handle/1880/47914
Verificado: sí (leído el resumen).

[Steel & König, 2006] Integrating theories of motivation. Academy of Management Review, 31(4), 889–913. DOI: 10.5465/AMR.2006.22527462
Verificado: parcialmente (resumen vía listado de búsqueda).

[Sirois & Pychyl, 2013] Procrastination and the priority of short-term mood regulation: Consequences for future self. Social and Personality Psychology Compass, 7(2), 115–127. DOI: 10.1111/spc3.12011 | URL: https://eprints.whiterose.ac.uk/91793/
Verificado: sí (leído el resumen).

[Rozental & Carlbring, 2014] Understanding and treating procrastination: A review of a common self-regulatory failure. Psychology, 5(13), 1488–1502. DOI: 10.4236/psych.2014.513160
Verificado: parcialmente (resumen vía listado de búsqueda).

[van Eerde & Klingsieck, 2018] Overcoming procrastination? A meta-analysis of intervention studies. Educational Research Review, 25, 73–85. DOI: 10.1016/j.edurev.2018.09.002 | URL: https://dare.uva.nl/id/12627c11-4b2f-401a-b9fc-1a7ee4d7cf91
Verificado: sí (leído el resumen; sin tamaño de efecto en el resumen).

[Rozental et al., 2018a] Targeting procrastination using psychological treatments: A systematic review and meta-analysis. Frontiers in Psychology, 9, 1588. DOI: 10.3389/fpsyg.2018.01588 | PMID: 30214421
Verificado: sí (leído texto completo).

[Rozental et al., 2018b] Treating procrastination using cognitive behavior therapy: A pragmatic randomized controlled trial comparing treatment delivered via the Internet or in groups. Behavior Therapy, 49(2), 180–197. DOI: 10.1016/j.beth.2017.08.002 | PMID: 29530258
Verificado: sí (leído el resumen en PubMed).

[Rozental et al., 2015] Differentiating procrastinators from each other: A cluster analysis. Cognitive Behaviour Therapy, 44(6), 480–490. PMID: 26178164
Verificado: sí (leído el resumen en PubMed).

[Malouff & Schutte, 2019] The efficacy of interventions aimed at reducing procrastination: A meta-analysis of randomized controlled trials. Journal of Counseling & Development, 97(2), 117–127. DOI: 10.1002/jcad.12243
Verificado: sí (leído el resumen).

[Turner & Hodis, 2023] A systematic review of interventions to reduce academic procrastination and implications for instructor-based classroom interventions. Educational Psychology Review, 35(4), 118. DOI: 10.1007/s10648-023-09838-x
Verificado: parcialmente (sólo metadatos Crossref; no se citan hallazgos).

[Jachimowicz et al., 2019] When and why defaults influence decisions: A meta-analysis of default effects. Behavioural Public Policy, 3(2), 159–186. DOI: 10.1017/bpp.2018.43
Verificado: sí (leído texto completo).

[Sunstein, 2019] Sludge and ordeals. Duke Law Journal, 68, 1843–1883. URL: https://scholarship.law.duke.edu/dlj/vol68/iss8/6
Verificado: parcialmente (resumen vía listado de búsqueda; ensayo normativo).

[Thaler & Sunstein, 2008] Nudge: Improving decisions about health, wealth, and happiness. Yale University Press. (Libro de síntesis, marco teórico.)
NO verificado (no consultado en esta sesión).

[Ghibellini & Meier, 2025] Interruption, recall and resumption: A meta-analysis of the Zeigarnik and Ovsiankina effects. Humanities and Social Sciences Communications, 12. DOI: 10.1057/s41599-025-05000-w
Verificado: sí (leído el resumen).

[Brandstätter, Lengfelder & Gollwitzer, 2001] Implementation intentions and efficient action initiation. Journal of Personality and Social Psychology, 81(5), 946–960. DOI: 10.1037/0022-3514.81.5.946 | PMID: 11708569
Verificado: sí (leído el resumen en PubMed).

[Biwer et al., 2023] Understanding effort regulation: Comparing 'Pomodoro' breaks and self-regulated breaks. British Journal of Educational Psychology, 93(S2). PMID: 36859717
Verificado: parcialmente (resumen vía listado de búsqueda).

[Gollwitzer & Sheeran, 2006] Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119. DOI: 10.1016/S0065-2601(06)38002-1
Verificado: parcialmente (resumen vía listado de búsqueda y Crossref).

[Sheeran, Listrom & Gollwitzer, 2024] The when and how of planning: Meta-analysis of the scope and components of implementation intentions in 642 tests. European Review of Social Psychology, 36(1), 162–194. DOI: 10.1080/10463283.2024.2334563
Verificado: parcialmente (sólo metadatos Crossref; las cifras de d proceden de resúmenes secundarios y no se dan por confirmadas).

[Gollwitzer & Brandstätter, 1997] Implementation intentions and effective goal pursuit. Journal of Personality and Social Psychology, 73(1), 186–199. DOI: 10.1037/0022-3514.73.1.186
Verificado: parcialmente (sólo metadatos Crossref).

[Owens, Bowman & Dill, 2008] Overcoming procrastination: The effect of implementation intentions. Journal of Applied Social Psychology, 38(2), 366–384. DOI: 10.1111/j.1559-1816.2007.00309.x
Verificado: sí (leído el resumen vía Crossref).

[Milkman et al., 2011] Using implementation intentions prompts to enhance influenza vaccination rates. PNAS, 108(26), 10415–10420. DOI: 10.1073/pnas.1103170108 | PMID: 21670283
Verificado: sí (leído el resumen en PubMed).

[Thakkar et al., 2016] Mobile telephone text messaging for medication adherence in chronic disease: A meta-analysis. JAMA Internal Medicine, 176(3), 340–349. DOI: 10.1001/jamainternmed.2015.7667
Verificado: sí (leído el resumen).

[Gurol-Urganci et al., 2013] Mobile phone messaging reminders for attendance at healthcare appointments. Cochrane Database of Systematic Reviews, CD007458. DOI: 10.1002/14651858.CD007458.pub3
Verificado: sí (leído el resumen).

[Fry & Neff, 2009] Periodic prompts and reminders in health promotion and health behavior interventions: Systematic review. Journal of Medical Internet Research, 11(2), e16. DOI: 10.2196/jmir.1138 | PMID: 19632970
Verificado: sí (leído el resumen en PubMed).

[Pop-Eleches et al., 2011] Mobile phone technologies improve adherence to antiretroviral treatment in a resource-limited setting: A randomized controlled trial of text message reminders. AIDS, 25(6), 825–834. DOI: 10.1097/QAD.0b013e32834380c1 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3718389
Verificado: sí (leído texto completo).

[Pielot, Church & de Oliveira, 2014] An in-situ study of mobile phone notifications. MobileHCI '14, 233–242. DOI: 10.1145/2628363.2628364
Verificado: sí (leído texto completo en PDF).

[Mehrotra et al., 2016] My phone and me: Understanding people's receptivity to mobile notifications. CHI '16, 1021–1032. DOI: 10.1145/2858036.2858566 | URL: https://discovery.ucl.ac.uk/id/eprint/1502364/
Verificado: sí (leído el resumen).

[Bidargaddi et al., 2018] To prompt or not to prompt? A microrandomized trial of time-varying push notifications to increase proximal engagement with a mobile health app. JMIR mHealth and uHealth, 6(11), e10123. DOI: 10.2196/10123 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC6293241
Verificado: sí (leído el resumen).

[Morrison et al., 2017] The effect of timing and frequency of push notifications on usage of a smartphone-based stress management intervention: An exploratory trial. PLoS ONE, 12(1), e0169162. DOI: 10.1371/journal.pone.0169162
Verificado: sí (leído el resumen).

[Klasnja et al., 2019] Efficacy of contextually tailored suggestions for physical activity: A micro-randomized optimization trial of HeartSteps. Annals of Behavioral Medicine, 53(6), 573–582. DOI: 10.1093/abm/kay067 | PMID: 30192907
Verificado: sí (leído el resumen en PubMed).

[Paine et al., 2016] Systematic review of physiologic monitor alarm characteristics and pragmatic interventions to reduce alarm frequency. Journal of Hospital Medicine, 11(2), 136–144. DOI: 10.1002/jhm.2520
Verificado: sí (leído el resumen en PDF).

[Lewandowska et al., 2020] Impact of alarm fatigue on the work of nurses in an intensive care environment: A systematic review. International Journal of Environmental Research and Public Health, 17(22), 8409. DOI: 10.3390/ijerph17228409 | PMID: 33202907
Verificado: sí (leído el resumen en PubMed).

[Stawarz, Cox & Blandford, 2015] Beyond self-tracking and reminders: Designing smartphone apps that support habit formation. CHI '15. DOI: 10.1145/2702123.2702230
Verificado: parcialmente (sólo metadatos Crossref).

[Bandura & Schunk, 1981] Cultivating competence, self-efficacy, and intrinsic interest through proximal self-motivation. Journal of Personality and Social Psychology, 41(3), 586–598. DOI: 10.1037/0022-3514.41.3.586
Verificado: parcialmente (sólo metadatos Crossref).

[Huang, Jin & Zhang, 2017] Step by step: Sub-goals as a source of motivation. Organizational Behavior and Human Decision Processes, 141, 1–15. DOI: 10.1016/j.obhdp.2017.05.001
Verificado: parcialmente (sólo metadatos Crossref).

[Allen, 2001] Getting Things Done: The art of stress-free productivity. Viking. (Libro de productividad, sin evaluación empírica.)
NO verificado (no consultado; se cita sólo para señalar que no es evidencia).

[Bryan, Karlan & Nelson, 2010] Commitment devices. Annual Review of Economics, 2, 671–698. DOI: 10.1146/annurev.economics.102308.124324
Verificado: parcialmente (resumen vía listado de búsqueda).

[Rogers, Milkman & Volpp, 2014] Commitment devices: Using initiatives to change behavior. JAMA, 311(20), 2065–2066. DOI: 10.1001/jama.2014.3485
Verificado: parcialmente (resumen vía listado de búsqueda; ensayo de opinión).

[Dai, Milkman & Riis, 2014] The fresh start effect: Temporal landmarks motivate aspirational behavior. Management Science, 60(10), 2563–2582. DOI: 10.1287/mnsc.2014.1901 | URL: https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf
Verificado: sí (leído el resumen).

[Wohl, Pychyl & Bennett, 2010] I forgive myself, now I can study: How self-forgiveness for procrastinating can reduce future procrastination. Personality and Individual Differences, 48(7), 803–808. DOI: 10.1016/j.paid.2010.01.029
Verificado: sí (leído el resumen; N discrepante entre fuentes, 119 según el resumen).

[Sirois, 2014] Procrastination and stress: Exploring the role of self-compassion. Self and Identity, 13(2), 128–145. DOI: 10.1080/15298868.2013.763404 | URL: https://eprints.whiterose.ac.uk/91791/
Verificado: sí (leído el resumen).

[Dong et al., 2026] Self-compassion predicts reduced bedtime procrastination through affect pathway: A three-wave longitudinal study. BMC Psychology. PMID: 42947169
Verificado: sí (leído el resumen en PubMed; correlacional).

[Rehman et al., 2023] Potential correlation between self-compassion and bedtime procrastination: The mediating role of emotion regulation. Psychology Research and Behavior Management. PMID: 38024655
Verificado: sí (leído el resumen en PubMed; correlacional).

[Brehm, 1966] A theory of psychological reactance. Academic Press. (Marco teórico clásico.)
NO verificado (no consultado en esta sesión).

[Dillard & Shen, 2005] On the nature of reactance and its role in persuasive health communication. Communication Monographs, 72(2), 144–168. DOI: 10.1080/03637750500111815
Verificado: sí (leído el resumen).

[Rains, 2013] The nature of psychological reactance revisited: A meta-analytic review. Human Communication Research, 39(1), 47–73. DOI: 10.1111/j.1468-2958.2012.01443.x
Verificado: sí (leído el resumen).

[Tannenbaum et al., 2015] Appealing to fear: A meta-analysis of fear appeal effectiveness and theories. Psychological Bulletin, 141(6), 1178–1204. DOI: 10.1037/a0039729
Verificado: sí (leído el resumen).

[Xu & Guo, 2018] A meta-analysis of the effectiveness of guilt on health-related attitudes and intentions. Health Communication, 33(5), 519–525. DOI: 10.1080/10410236.2017.1278633 | PMID: 28278614
Verificado: sí (leído el resumen en PubMed).

[Ntoumanis et al., 2021] A meta-analysis of self-determination theory-informed intervention studies in the health domain: Effects on motivation, health behavior, physical, and psychological health. Health Psychology Review, 15(2), 214–244. DOI: 10.1080/17437199.2020.1718529 | PMID: 31983293
Verificado: sí (leído el resumen en PubMed).

[Teixeira et al., 2020] A classification of motivation and behavior change techniques used in self-determination theory-based interventions in health contexts. Motivation Science, 6(4), 438–455. DOI: 10.1037/mot0000172 | URL: https://discovery.ucl.ac.uk/id/eprint/10107097/
Verificado: sí (leído el resumen).
