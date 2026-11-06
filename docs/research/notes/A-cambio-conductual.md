# A. Cambio conductual (behaviour change)

Nota de investigación para una app TUI offline, sin IA, de diario/objetivos/hábitos para un único adulto en contexto de autoayuda. Fecha: 2026-11-05.

Convenciones: las secciones 1 (COM-B/BCW), 2 (taxonomías BCT), 10 (SDT) y 15 (teorías de mantenimiento) describen **marcos teóricos o herramientas de clasificación**, no intervenciones con eficacia experimental propia. El resto son técnicas con evidencia experimental de distinta calidad. Los tamaños de efecto citados sólo aparecen cuando se leyó el resumen o el texto que los contiene; la verificación de cada fuente se indica en Referencias.

---

### 1. Modelo COM-B y Behaviour Change Wheel (marco, no intervención)
- **Mecanismo propuesto:** la conducta (B) requiere simultáneamente capacidad (C: física y psicológica), oportunidad (O: física y social) y motivación (M: reflexiva y automática). Nueve "funciones de intervención" (educación, persuasión, incentivación, coerción, entrenamiento, restricción, reestructuración ambiental, modelado, facilitación) actúan sobre déficits en esas condiciones.
- **Objetivo conductual:** diagnosticar *por qué* una conducta no ocurre antes de elegir técnicas; cualquier conducta objetivo.
- **Evidencia a favor:** Michie, van Stralen & West (2011), *Implementation Science*: desarrollo teórico a partir de una revisión sistemática de 19 marcos; fiabilidad de codificación 88 % (tabaco) y 79 % (obesidad). No es un ensayo de eficacia.
- **Limitaciones metodológicas:** los autores reconocen que falta evidencia de que su uso produzca intervenciones más eficaces y que "puede resultar difícil de usar".
- **Calidad y consistencia de la evidencia:** no aplica como intervención; Alta como marco de consenso.
- **Poblaciones estudiadas:** guías de política pública (Inglaterra); después, innumerables poblaciones.
- **Riesgos / efectos adversos:** ninguno directo.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** usar COM-B como **estructura interna** del asistente de creación de metas: tres preguntas ("¿sé cómo hacerlo?", "¿tengo tiempo/lugar/apoyo?", "¿quiero hacerlo?") que deriven a módulos distintos (instrucción, planificación de contexto, revisión de motivos). Sin mostrar la jerga al usuario.
- **Confianza en su utilidad:** Media (como esqueleto de diseño).
- **Decisión sugerida:** Incluir (como arquitectura de diseño, no como función visible).

### 2. Taxonomía BCTTv1 y BCT Ontology; técnicas más asociadas a eficacia
- **Mecanismo propuesto:** vocabulario estandarizado de "ingredientes activos" (BCT) para describir intervenciones y asociar técnicas a resultados mediante meta-regresión.
- **Objetivo conductual:** transversal.
- **Evidencia a favor:**
  - Michie et al. (2013), *Ann Behav Med*: consenso Delphi (14 expertos; 18 en la tarea de agrupación) → 93 BCT en 16 grupos; de 26 BCT frecuentes, 23 con kappa ajustado ≥ 0,60.
  - Marques et al. (2023), *Wellcome Open Research*: BCT Ontology, 281 BCT en 20 grupos y 5 niveles; fiabilidad interjueces 0,82 (familiarizados) y 0,79 (no familiarizados).
  - Meta-regresiones: Michie et al. (2009), *Health Psychology*, k = 122, N = 44 747, efecto global 0,31 (IC 95 % 0,26–0,36; I² = 69 %); la **automonitorización** explicaba la mayor parte de la heterogeneidad y combinada con ≥ 1 técnica de la teoría del control (metas, feedback, revisión de metas) daba 0,42 frente a 0,26. Samdal et al. (2017), *IJBNPA*, 48 ECA en adultos con obesidad: ES 0,37 (IC 0,26–0,48) a corto plazo y 0,24 (IC 0,15–0,33) a ≥ 12 meses; **metas de conducta y automonitorización** predijeron el efecto en ambos plazos; a largo plazo también feedback sobre resultados, tareas graduadas, "añadir objetos al entorno" y un estilo de apoyo a la autonomía. Williams & French (2011): planificación de la acción, instrucción y refuerzo del esfuerzo asociados a mejores resultados (§10).
- **Limitaciones metodológicas:** asociaciones BCT–efecto **observacionales entre estudios** (confundidas con número de técnicas, calidad, contacto humano); codificación desde informes publicados; alta heterogeneidad.
- **Calidad y consistencia de la evidencia:** Moderada para "automonitorización + fijación de metas" (consistente en varias meta-regresiones independientes); Baja para el resto de técnicas individuales.
- **Poblaciones estudiadas:** adultos generales y con sobrepeso/obesidad; mayormente países de renta alta.
- **Riesgos / efectos adversos:** ver §8 (automonitorización) y §9 (feedback).
- **Frecuencia o dosis estudiada:** no se extrae dosis; intervenciones de semanas a 12+ meses.
- **Aplicabilidad a una app offline sin IA:** el núcleo de la app debería ser el "paquete de autorregulación": meta de conducta específica → registro → revisión de progreso → ajuste de meta. Es exactamente la combinación mejor respaldada y no requiere IA ni conectividad.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir (paquete metas + registro + revisión).

### 3. Formación de hábitos y automaticidad
- **Mecanismo propuesto:** la repetición en un contexto estable crea asociaciones señal–respuesta; con el tiempo la conducta se inicia con poco control deliberado (automaticidad), reduciendo la dependencia de la motivación momentánea.
- **Objetivo conductual:** conductas sencillas y repetibles a diario (beber agua, estiramientos, escribir en el diario, higiene dental, caminar).
- **Evidencia a favor:**
  - Lally et al. (2010), *EJSP*: cohorte de 96 voluntarios (82 analizables), 84 días; en los 39 con buen ajuste de curva, mediana hasta el 95 % de la asíntota **66 días (rango 18–254)**; **saltarse una oportunidad no afectó materialmente** al proceso. Una fuente secundaria indica medianas de 59 (beber), 65 (comer) y 91 (ejercicio) días, sin diferencia significativa.
  - Gardner et al. (2012), *IJBNPA*: SRBAI, 4 ítems ("lo hago automáticamente", "sin tener que recordarlo", "sin pensar", "empiezo antes de darme cuenta"); α ≥ 0,80 en 40 de 45 pruebas (N = 11 257).
  - Keller et al. (2021), *BJHP*, ECA N = 192, 84 días: señal por rutina o por hora igual de eficaz; **la ejecución repetida del plan** fue el predictor clave; mediana 59 días hasta el pico entre quienes formaron hábito.
  - Ma et al. (2023), *IJBNPA*: 10 ECA (N = 2 349), SMD 0,31 (IC 0,14–0,48; I² 64 %) sobre fuerza del hábito de actividad física; 0,40 a ≤ 12 semanas vs 0,17 después; "resolución de problemas" asociada positivamente.
  - Singh et al. (2024), *Healthcare*: 20 estudios (N = 2 601), SMD pre-post 0,69 (IC 0,49–0,88); medianas 59–66 días, medias 106–154, rango 4–335; práctica matutina y hábitos autoseleccionados más fuertes; 11 estudios con alto riesgo de sesgo.
  - Gardner, Rebar, de Wit & Lally (2024), *SPPC*: revisión conceptual; el hábito "puede no ser necesario ni suficiente" para mantener el cambio; las asociaciones persisten en memoria aunque la conducta cese; recomienda hábitos de *instigación* y tratar los lapsos como "contratiempos temporales y permisibles".
- **Limitaciones metodológicas:** muestras pequeñas y autoseleccionadas; autoinforme; el "66 días" procede de 39 personas con extrapolaciones más allá de la ventana observada; pre-post sin control en Singh 2024; decaimiento tras 12 semanas en Ma 2023.
- **Calidad y consistencia de la evidencia:** Moderada para "la repetición consistente en contexto aumenta la automaticidad"; Baja para cualquier cifra concreta de días.
- **Poblaciones estudiadas:** adultos sanos, universitarios, adultos mayores; conductas sencillas.
- **Riesgos / efectos adversos:** expectativas erróneas ("21 días", "66 días") → desánimo; cronificación de conductas poco flexibles; para personas con vidas muy desestructuradas la formación de hábitos puede ser inviable (Gardner 2024).
- **Frecuencia o dosis estudiada:** una ejecución diaria en el mismo contexto durante 8–12 semanas.
- **Aplicabilidad a una app offline sin IA:** (a) pedir al crear un hábito una **señal de contexto** ("después de X" o una hora) y aceptar ambas; (b) medir el progreso del hábito con el SRBAI (4 ítems) cada 2–4 semanas en vez de sólo contar ejecuciones; (c) mostrar el mensaje "la mayoría tarda entre 2 y 3 meses, con un rango muy amplio; un día perdido no estropea el proceso"; (d) evitar prometer plazos fijos; (e) priorizar hábitos sencillos y matutinos como sugerencia, no imposición.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir.

### 4. Consistencia de señales, reestructuración ambiental y control de estímulos
- **Mecanismo propuesto:** los hábitos dependen de señales ambientales recurrentes; cambiar o eliminar señales rompe hábitos indeseados y crear señales estables facilita los nuevos. Las transiciones vitales (mudanza, nuevo trabajo) son ventanas de vulnerabilidad del hábito.
- **Objetivo conductual:** sustituir hábitos no deseados; anclar conductas nuevas.
- **Evidencia a favor:** Verplanken & Wood (2006), *J Public Policy & Marketing*: revisión teórica; intervenciones "upstream" (alterar señales antes de la conducta) y "downstream-plus" (informar cuando el contexto cambia). Wood & Neal (2016), *Behavioral Science & Policy*: revisión; campaña "5 A Day" subió el conocimiento del 7 % al 20 % sin mover el consumo (estable en 11 %), ilustrando que la información sola no cambia hábitos; describen el "patrón triangular de recaída" tras las intervenciones. Samdal 2017: "añadir objetos al entorno" predijo efectos a largo plazo. Keller 2021: rutina y hora funcionan igual como señal.
- **Limitaciones metodológicas:** mayor parte de la evidencia es teórica, correlacional o de políticas públicas; pocos ECA individuales de reestructuración ambiental en autoayuda.
- **Calidad y consistencia de la evidencia:** Moderada en el principio (coherente con la literatura experimental de laboratorio sobre hábitos); Baja en intervenciones de autoayuda específicas.
- **Poblaciones estudiadas:** consumidores, población general, estudiantes.
- **Riesgos / efectos adversos:** mínimos; posible rigidez si se obliga a un único contexto.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** al crear un hábito, campo "¿qué cambiarás en tu entorno para que sea más fácil / más difícil?" (dejar el libro en la almohada, sacar la app del móvil de la pantalla inicial); detectar en el diario menciones de cambios vitales y sugerir revisar hábitos ("has escrito que te mudas: buen momento para replantear rutinas"). Esto puede hacerse con etiquetas manuales, sin PNL.
- **Confianza en su utilidad:** Media.
- **Decisión sugerida:** Incluir.

### 5. Intenciones de implementación (planes "si–entonces")
- **Mecanismo propuesto:** vincular una situación concreta ("si es lunes a las 7 y he terminado el café") a una respuesta ("entonces salgo a caminar 15 min") aumenta la accesibilidad de la señal y automatiza la respuesta, cerrando la brecha intención–conducta.
- **Objetivo conductual:** iniciar conductas puntuales o recurrentes; proteger metas frente a distracciones.
- **Evidencia a favor:** Gollwitzer & Sheeran (2006), meta-análisis de 94 pruebas, d = 0,65 sobre logro de metas. Sheeran, Listrom & Gollwitzer (2025), *European Review of Social Psychology*, 642 pruebas: efectos entre 0,27 ≤ d ≤ 0,66 según resultado; mayores con formato condicional explícito si–entonces, alta motivación por la meta y **ensayo mental del plan**. Bélanger-Gravel et al. (2013), *HPR*, actividad física, 26 estudios: SMD 0,31 (IC 0,11–0,51) post y 0,24 (IC 0,13–0,35) en seguimiento; más eficaz cuando se incluye manejo de barreras. Hagger & Luszczynska (2014): revisión; eficaces, baratas y de baja carga, pero con gran heterogeneidad y pocos ECA con medidas objetivas; recomiendan planes guiados (no libres), con señales relevantes y "boosters".
- **Limitaciones metodológicas:** sesgo de publicación plausible (los autores del meta-análisis de 2025 reportan estimaciones corregidas que no he podido leer y por tanto no cito); muchos estudios con estudiantes y conductas únicas; efectos menores en comportamientos de salud reales que en tareas de laboratorio; **fallan cuando la motivación es baja** (el plan no sustituye el querer) y cuando el plan es vago.
- **Calidad y consistencia de la evidencia:** Alta en que el efecto existe y es positivo; Moderada en su magnitud (probablemente pequeña–moderada en salud).
- **Poblaciones estudiadas:** estudiantes, población general, muestras clínicas; adultos.
- **Riesgos / efectos adversos:** rigidez; frustración si el contexto planificado no ocurre; en metas múltiples los planes pueden competir.
- **Frecuencia o dosis estudiada:** típicamente una sesión de formación del plan, a veces con recordatorio/refuerzo.
- **Aplicabilidad a una app offline sin IA:** plantilla **estructurada y guiada** "Si [situación concreta: dónde/cuándo/después de qué], entonces [acción concreta]" con validación de especificidad (rechazar "cuando pueda"); pedir que el usuario lo relea/ensaye mentalmente al guardar; ofrecer un "booster" (volver a mostrar y revisar el plan a los 7–14 días); añadir un segundo plan "Si [barrera], entonces [respuesta]" (§6).
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir.

### 6. Planificación de la acción y planificación de afrontamiento (HAPA)
- **Mecanismo propuesto:** HAPA (Schwarzer) separa una fase motivacional (formar la intención) de una volitiva (planificar, actuar, mantener, recuperarse). La planificación de la acción (cuándo/dónde/cómo) ayuda a iniciar; la de afrontamiento (anticipar barreras y respuestas) ayuda a mantener.
- **Objetivo conductual:** mantenimiento de conductas de salud tras la intención.
- **Evidencia a favor:** Schwarzer (2008), *Applied Psychology*: marco teórico con 7 estudios en 5 conductas (ejercicio, autoexploración mamaria, cinturón, dieta, hilo dental) apoyando mediadores volitivos (autoeficacia y planificación). Sniehotta, Schwarzer, Scholz & Schüz (2005), *EJSP*, longitudinal N = 352 pacientes cardíacos: la planificación de la acción pesa más al inicio y la de afrontamiento más tarde; esta última predice ejercicio a 4 meses. Sniehotta, Scholz & Schwarzer (2006), *BJHP*, ECA de 3 brazos N = 211: el grupo con **planificación combinada (acción + afrontamiento)** hizo significativamente más ejercicio a los 2 meses que planificación de acción sola y control.
- **Limitaciones metodológicas:** muestras de rehabilitación cardíaca (alta motivación inicial); efectos a corto plazo; medidas autoinformadas; un ECA de tamaño moderado.
- **Calidad y consistencia de la evidencia:** Moderada.
- **Poblaciones estudiadas:** pacientes cardíacos adultos y mayores; población general en los estudios de validación del modelo.
- **Riesgos / efectos adversos:** anticipar barreras puede inducir pesimismo si no se acompaña de la respuesta de afrontamiento.
- **Frecuencia o dosis estudiada:** una sesión de planificación (~20–30 min) tras el alta, con cumplimentación escrita.
- **Aplicabilidad a una app offline sin IA:** flujo de dos pasos al crear una meta: (1) plan de acción; (2) "¿Qué puede impedírtelo? ¿Qué harás entonces?" (2–3 pares barrera→respuesta). Reutilizar las barreras registradas en el diario para proponérselas al usuario como opciones (lista propia, sin IA).
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir.

### 7. Fijación de metas
- **Mecanismo propuesto:** una meta específica dirige la atención, moviliza esfuerzo y persistencia, y crea una referencia contra la que comparar el progreso (teoría del control / Locke & Latham).
- **Objetivo conductual:** transversal.
- **Evidencia a favor:** Epton, Currie & Armitage (2017), *J Consult Clin Psychol*: meta-análisis de 141 artículos, 384 tamaños de efecto, N = 16 523, efecto único de fijar metas d = 0,34 (IC 0,28–0,41); mayor con metas **difíciles**, **públicas** y de grupo; evidencia más débil para monitorización externa y entrega cara a cara. Samdal 2017 y Michie 2009 (ver §2).
- **Limitaciones metodológicas:** heterogeneidad alta; moderadores "público" y "grupo" no trasladables a un usuario solo; sesgo hacia muestras escolares/laborales.
- **Calidad y consistencia de la evidencia:** Alta (ECA agregados).
- **Poblaciones estudiadas:** niños, adultos, población general, trabajadores.
- **Riesgos / efectos adversos:** metas demasiado difíciles sin tareas graduadas → fracaso repetido y menor autoeficacia (Williams & French 2011 asocian "tareas graduadas" a peores resultados, pero esto es correlacional y puede reflejar poblaciones más difíciles).
- **Frecuencia o dosis estudiada:** metas fijadas al inicio y revisadas periódicamente.
- **Aplicabilidad a una app offline sin IA:** metas de **conducta** (no sólo de resultado), específicas y medibles; opción de "compartir compromiso" exportando un texto (sustituto parcial de lo público); revisión programada de metas cada 2–4 semanas con tres opciones: mantener / subir / bajar.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir.

### 8. Automonitorización y seguimiento del progreso
- **Mecanismo propuesto:** registrar la conducta hace visible la discrepancia meta–estado actual y dispara ajustes (bucle de retroalimentación de la teoría del control).
- **Objetivo conductual:** transversal; especialmente dieta, actividad física, sueño, hábitos.
- **Evidencia a favor:** Harkin et al. (2016), *Psychological Bulletin*: 138 estudios aleatorizados, N = 19 951; las intervenciones aumentan la frecuencia de monitorización (d+ = 1,98) y el logro de metas (**d+ = 0,40, IC 0,32–0,48**); el efecto es mayor cuando el progreso se **registra físicamente** y cuando se comunica o hace público; el cambio en frecuencia de monitorización media el efecto. Michie 2009 (automonitorización + otra técnica: 0,42 vs 0,26) y Samdal 2017 (predictor a corto y largo plazo).
- **Limitaciones metodológicas:** gran parte de los estudios son de corto plazo; heterogeneidad; monitorización frecuentemente combinada con otras técnicas.
- **Calidad y consistencia de la evidencia:** Alta (uno de los hallazgos más consistentes del campo).
- **Poblaciones estudiadas:** adultos de población general y clínicos; estudiantes.
- **Riesgos / efectos adversos:** Etkin (2016), *J Consumer Research*, 6 experimentos: medir una actividad placentera aumenta la cantidad pero **reduce el disfrute y la motivación intrínseca** y puede reducir la continuidad. Simpson & Mazzeo (2017), *Eating Behaviors*, transversal N = 493 universitarios: usuarios de contadores de calorías con más preocupación por la comida y restricción; el seguimiento de fitness se asoció independientemente a sintomatología de trastorno alimentario ("para algunas personas estos dispositivos pueden hacer más mal que bien"). Correlacional, pero suficiente para exigir prudencia.
- **Frecuencia o dosis estudiada:** registro diario o por episodio; semanas a meses.
- **Aplicabilidad a una app offline sin IA:** registro manual de baja fricción (un atajo de teclado = "hecho"); mostrar el progreso **en gráficos sencillos** (calendario, tendencia semanal); permitir "modo ligero" (registrar sólo sí/no) para actividades que el usuario hace por placer; **no incluir conteo de calorías ni peso diario** sin aviso; permitir desactivar métricas; recordar que la medición puede restar disfrute y ofrecer registrar "cómo me sentí" en vez de cantidades.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir (con salvaguardas para conductas alimentarias/corporales).

### 9. Feedback sobre el progreso
- **Mecanismo propuesto:** la información sobre la discrepancia meta–rendimiento permite corregir; según la Feedback Intervention Theory, el feedback que dirige la atención a la **tarea** ayuda y el que la dirige al **yo** (comparación con otros, juicios de valía) puede perjudicar.
- **Objetivo conductual:** transversal.
- **Evidencia a favor:** Kluger & DeNisi (1996), *Psychological Bulletin*: según fuentes secundarias (original no leído), 607 tamaños de efecto, d ≈ 0,41, con **más de un tercio de efectos negativos**. Harkin 2016: efecto mayor cuando el progreso se registra físicamente. Ashford 2010: feedback sobre el rendimiento pasado propio asociado a mayor autoeficacia. Samdal 2017: feedback sobre resultados predijo efectos a largo plazo.
- **Limitaciones metodológicas:** Kluger & DeNisi proviene de contextos laborales/educativos; moderadores inferidos entre estudios.
- **Calidad y consistencia de la evidencia:** Moderada (positivo en promedio, con alta probabilidad de efectos nulos o negativos según el diseño).
- **Poblaciones estudiadas:** trabajadores, estudiantes, adultos en salud.
- **Riesgos / efectos adversos:** feedback comparativo, rachas rotas con tono de fracaso y "notas" globales de la persona pueden reducir rendimiento y autoeficacia.
- **Frecuencia o dosis estudiada:** de inmediato a semanal.
- **Aplicabilidad a una app offline sin IA:** feedback **descriptivo y centrado en la tarea** ("3 de 5 días; la semana pasada 2"), nunca evaluativo; comparar sólo **con el propio pasado**; sin puntuaciones de "disciplina"; reencuadrar la racha rota ("racha anterior: 12 días; retomar hoy cuenta") sin reinicio punitivo.
- **Confianza en su utilidad:** Media-Alta.
- **Decisión sugerida:** Incluir (con reglas de redacción explícitas).

### 10. Autoeficacia
- **Mecanismo propuesto:** la creencia en la propia capacidad de ejecutar la conducta (Bandura 1977) determina iniciar, esforzarse y persistir; sus fuentes son experiencia de dominio, experiencia vicaria, persuasión verbal y estados fisiológicos.
- **Objetivo conductual:** actividad física y conductas de salud en general.
- **Evidencia a favor:** Bandura (1977), *Psychological Review*: teoría fundacional. Ashford, Edmunds & French (2010), *BJHP*: 27 estudios, N = 5 501; efecto pequeño sobre autoeficacia (d = 0,16); **feedback sobre el rendimiento pasado propio o de otros** y **experiencia vicaria** asociados a mayor autoeficacia; persuasión, dominio graduado e identificación de barreras asociados a menor. Williams & French (2011), *Health Education Research*: mismos 27 estudios; d = 0,16 (autoeficacia) y 0,21 (actividad física); **planificación de la acción, instrucción y refuerzo del esfuerzo** asociados a mejores resultados en ambos; prevención de recaídas y tareas graduadas asociados a peores; la correlación entre técnicas que mueven autoeficacia y las que mueven conducta fue r_s = 0,69.
- **Limitaciones metodológicas:** asociaciones entre estudios (no causales); las técnicas "negativas" pueden reflejar su uso en poblaciones más difíciles; efectos pequeños.
- **Calidad y consistencia de la evidencia:** Moderada para "la autoeficacia predice y media el cambio"; Baja para qué técnica concreta la aumenta.
- **Poblaciones estudiadas:** adultos sanos.
- **Riesgos / efectos adversos:** la persuasión vacía ("¡tú puedes!") no funciona y puede resultar paternalista.
- **Frecuencia o dosis estudiada:** no especificada.
- **Aplicabilidad a una app offline sin IA:** mostrar el **historial de logros propios** ("has completado esto 47 veces desde marzo"); registro de "qué hice bien hoy" (dominio); instrucciones concretas de cómo hacer la conducta cuando el usuario la define; evitar frases motivacionales genéricas. La experiencia vicaria no es posible sin comunidad, salvo con ejemplos textuales anónimos redactados por el equipo.
- **Confianza en su utilidad:** Media.
- **Decisión sugerida:** Incluir (historial de dominio y refuerzo del esfuerzo); Descartar los mensajes de persuasión genérica.

### 11. Teoría de la autodeterminación (SDT): diseño que apoya la autonomía (marco)
- **Mecanismo propuesto:** la satisfacción de las necesidades de autonomía, competencia y relación favorece la motivación autónoma (intrínseca o identificada), que predice mejor el mantenimiento que la motivación controlada (recompensas, culpa, presión).
- **Objetivo conductual:** mantenimiento de cualquier conducta; bienestar.
- **Evidencia a favor:** Ryan & Deci (2000), *American Psychologist*: formulación teórica. Ng et al. (2012), *Perspectives on Psychological Science*: meta-análisis de 184 conjuntos de datos; apoyo a la autonomía → satisfacción de necesidades → motivación autónoma → mejores resultados de salud (mayormente correlacional). Gillison et al. (2019), *HPR*: 74 estudios controlados; mejoras en apoyo a la autonomía percibido (el mayor efecto), competencia, relación y motivación; las técnicas individuales tienen efectos limitados: hace falta "la combinación de múltiples técnicas coactuantes". Teixeira et al. (2020), *Motivation Science*: consenso de 18 expertos → 21 técnicas (ofrecer elección, lenguaje no controlador, explorar fuentes de presión, dar razones). Samdal 2017: apoyo a la autonomía asociado a mantenimiento a 12 meses.
- **Limitaciones metodológicas:** evidencia correlacional o con contacto humano; difícil aislar la "autonomía" en software; motivación autoinformada.
- **Calidad y consistencia de la evidencia:** Moderada (muy consistente en dirección; menos en magnitud y en diseño digital).
- **Poblaciones estudiadas:** pacientes, adultos sanos, niños, deportistas.
- **Riesgos / efectos adversos:** recompensas externas y gamificación coercitiva pueden desplazar la motivación intrínseca (consistente con Etkin 2016 y con la asociación negativa de "recompensa social" en Ma 2023, aunque esta última es imprecisa).
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** **lenguaje no controlador** en toda la interfaz ("podrías", "si quieres" en vez de "debes"); el usuario elige y redacta metas, señales y recompensas; preguntar "¿por qué te importa esto?" al crear una meta y mostrar la razón después; sin notificaciones culpabilizadoras ni castigos por inactividad; sin puntos/insignias por defecto (opt-in si se incluyen); ofrecer siempre "pausar" o "abandonar" una meta sin fricción ni juicio.
- **Confianza en su utilidad:** Alta (como principio de diseño).
- **Decisión sugerida:** Incluir (como guía de redacción y de arquitectura de elección).

### 12. Prevención de recaídas y efecto de violación de la abstinencia (AVE)
- **Mecanismo propuesto:** (Marlatt) la recaída es un proceso: situación de alto riesgo → respuesta de afrontamiento (o no) → lapso → interpretación. Si el lapso se interpreta de forma dicotómica y como fallo personal (AVE: culpa, "todo o nada"), aumenta la probabilidad de abandonar la meta; si se interpreta como contratiempo situacional, se recupera ("prolapso").
- **Objetivo conductual:** mantenimiento tras un lapso; adicciones, dieta, ejercicio, hábitos.
- **Evidencia a favor:** Witkiewitz & Marlatt (2004), *American Psychologist*: modelo dinámico. Hendershot et al. (2011), *Subst Abuse Treat Prev Policy*: revisión; cita a Irvin et al. (1999; 26 estudios, N = 9 504): r = 0,14 sobre consumo y r = 0,48 sobre funcionamiento psicosocial; en datos de evaluación ecológica momentánea hubo respuestas de afrontamiento en el 91 % de las resistencias exitosas frente al 24 % de los lapsos; "escasa evidencia" de que el entrenamiento en habilidades mejore el afrontamiento. Gardner et al. (2024): "enmarcar los lapsos como contratiempos temporales y permisibles, no como fracasos irreversibles". Dai, Milkman & Riis (2014), *Management Science*, 3 estudios archivísticos: interés en dietas, visitas al gimnasio y compromisos aumentan tras hitos temporales ("efecto de nuevo comienzo").
- **Limitaciones metodológicas:** la PR suele ir integrada en TCC; evidencia sobre todo en adicciones; el efecto de nuevo comienzo es correlacional.
- **Calidad y consistencia de la evidencia:** Moderada para el modelo y el AVE; Baja–Moderada para intervenciones de PR de autoayuda en conductas no adictivas.
- **Poblaciones estudiadas:** personas con trastornos por uso de sustancias; fumadores; población general en Dai 2014.
- **Riesgos / efectos adversos:** **lo que NO debe hacerse sin clínico:** tratamiento de adicciones o trastornos alimentarios; la app no debe presentarse como herramienta de recuperación de adicciones. Williams & French 2011 encontraron asociación negativa de "prevención de recaídas" con resultados en actividad física (correlacional; puede reflejar que anticipar recaídas sin plan concreto desmoraliza).
- **Frecuencia o dosis estudiada:** sesiones clínicas; no hay dosis de autoayuda establecida.
- **Aplicabilidad a una app offline sin IA:** (a) redactar el fallo de un hábito como "lapso" con un mensaje breve y neutro; (b) pantalla opcional "¿qué pasó?" con etiquetas situacionales (cansancio, cambio de rutina, estado de ánimo) para externalizar la causa y alimentar los planes de afrontamiento (§6); (c) **nunca reiniciar rachas a cero con tono punitivo**; mostrar "mejor racha" y "tasa del último mes" junto a la racha actual; (d) ofrecer "nuevo comienzo" los lunes / primeros de mes / tras cumpleaños, usando fechas locales sin red; (e) tolerancia configurable de días libres.
- **Confianza en su utilidad:** Alta (para la redacción y el manejo de lapsos); Baja (como terapia).
- **Decisión sugerida:** Incluir (manejo de lapsos y reencuadre); Descartar cualquier función de tratamiento de adicciones.

### 13. Intervenciones adaptativas "just-in-time" (JITAI), recordatorios y señales contextuales
- **Mecanismo propuesto:** entregar el apoyo adecuado en el momento de vulnerabilidad u oportunidad, sólo cuando la persona es receptiva, y "no hacer nada" cuando no lo es, para evitar fatiga.
- **Objetivo conductual:** iniciar o mantener conductas en el momento oportuno.
- **Evidencia a favor:** Nahum-Shani et al. (2018), *Ann Behav Med*: marco conceptual (puntos de decisión, opciones, variables de ajuste, reglas de decisión, receptividad); reconocen que "muchas JITAI se han desarrollado con un uso mínimo de evidencia empírica, teoría o guías". Fry & Neff (2009), *JMIR*: 19 artículos (N = 15 655), 11 positivos; los recordatorios funcionaban mejor si eran **frecuentes y con contacto personal**; sin datos a largo plazo. Stawarz, Cox & Blandford (2015), CHI: sólo metadatos verificados; no cito hallazgos.
- **Limitaciones metodológicas:** las JITAI reales requieren sensores y algoritmos adaptativos; la evidencia sobre recordatorios es a corto plazo y confundida con contacto humano.
- **Calidad y consistencia de la evidencia:** Baja (recordatorios en autoayuda a largo plazo); el marco JITAI es conceptual.
- **Poblaciones estudiadas:** adultos en programas de peso/dieta/actividad; fumadores.
- **Riesgos / efectos adversos:** fatiga de notificaciones; posible dependencia del recordatorio en lugar de la señal contextual (hipótesis coherente con la teoría del hábito, no verificada aquí).
- **Frecuencia o dosis estudiada:** diaria a semanal; sin consenso.
- **Aplicabilidad a una app offline sin IA:** una TUI no interrumpe al usuario. Opciones responsables: (a) **reglas simples declaradas por el usuario** ("al abrir después de las 18 h, muéstrame el plan de la tarde"); (b) resumen "hoy" al abrir; (c) recordatorios locales opcionales (cron/notificación) con frecuencia elegida y **decaimiento automático** a las pocas semanas; (d) ninguna inferencia automatizada de estado de ánimo o contexto.
- **Confianza en su utilidad:** Media (como ayuda inicial), Baja (como JITAI real).
- **Decisión sugerida:** Incluir como experimental (recordatorios con decaimiento); Descartar JITAI propiamente dicha.

### 14. Atrición, adherencia y "engagement efectivo" en intervenciones digitales
- **Mecanismo propuesto:** el uso de una herramienta digital cae rápidamente ("ley de la atrición"); el objetivo no es maximizar el uso sino lograr el **uso suficiente para el resultado** (engagement efectivo).
- **Objetivo conductual:** sostener el uso de la propia app el tiempo necesario.
- **Evidencia a favor:** Eysenbach (2005), *JMIR*: artículo de opinión fundacional; distingue atrición por abandono y por **no uso**; determinantes propuestos: ventaja relativa, compatibilidad, usabilidad, beneficios observables, carga, factores de "empuje", contacto personal. Perski et al. (2017), *Transl Behav Med*: revisión de 117 artículos; engagement = dimensión conductual (cantidad, frecuencia, duración, profundidad) + experiencial (atención, interés, afecto); "dosis óptima"; las funciones más usadas no son necesariamente las ligadas a resultados. Yardley et al. (2016), *Am J Prev Med*: "engagement efectivo" = suficiente para lograr los resultados. Baumel et al. (2019), *JMIR*: 93 apps de salud mental; mediana de usuarios activos diarios 4,0 %; retención a 30 días: trackers 6,1 %, mindfulness 4,7 %, apoyo entre pares 8,9 %, respiración 0,0 %. Meyerowitz-Katz et al. (2020), *JMIR*: 17 estudios; abandono agrupado 43 % (IC 29–57); 40 % en ECA, 49 % en observacionales.
- **Limitaciones metodológicas:** datos de apps comerciales no equivalen a una TUI personal; heterogeneidad extrema; uso ≠ beneficio.
- **Calidad y consistencia de la evidencia:** Alta en que la atrición es la norma; Baja en qué la reduce.
- **Poblaciones estudiadas:** usuarios de apps comerciales; pacientes crónicos; participantes de ensayos online.
- **Riesgos / efectos adversos:** optimizar para "engagement" (gamificación, notificaciones) puede dañar la autonomía y la motivación intrínseca (§11) y confundir uso con beneficio.
- **Frecuencia o dosis estudiada:** no aplica.
- **Aplicabilidad a una app offline sin IA:** diseñar para que **un uso breve e intermitente sea suficiente**: registro en < 10 s, inicio rápido, datos locales legibles (Markdown/SQLite) para que el valor no dependa de la app; expectativa explícita de que el uso bajará y que "volver" es normal (pantalla de bienvenida de retorno sin reproches); pedir al usuario que defina su propia "dosis mínima" (p. ej., 3 entradas/semana) y medir contra ella, no contra el uso diario; instrumentación local opcional de uso para que el propio usuario vea su patrón.
- **Confianza en su utilidad:** Alta (como realismo de diseño).
- **Decisión sugerida:** Incluir (principios de diseño); Descartar métricas de engagement como objetivo en sí.

### 15. Teorías del mantenimiento del cambio (marco)
- **Mecanismo propuesto / evidencia:** Kwasnicka et al. (2016), *HPR*, revisión sistemática de teorías (117 identificadas, 100 incluidas, 25 expertos): el mantenimiento depende de (1) motivos (disfrute, identidad), (2) autorregulación, (3) recursos psicológicos y físicos, (4) hábitos y (5) entorno social/físico; iniciación y mantenimiento difieren. Teórica; no evalúa eficacia.
- **Calidad y consistencia de la evidencia:** Moderada como síntesis conceptual.
- **Aplicabilidad a una app offline sin IA:** revisión mensual guiada con cinco preguntas, una por tema: ¿sigo valorándolo?, ¿sigo registrando?, ¿tengo energía/tiempo?, ¿ya es automático? (SRBAI), ¿ha cambiado mi entorno?
- **Confianza en su utilidad:** Media. **Decisión sugerida:** Incluir (plantilla de revisión periódica).

---

### Síntesis de implicaciones de diseño para una app offline sin IA

**Incluir (Alta confianza):** metas de conducta + registro de baja fricción + revisión periódica (§2, §7, §8); planes si–entonces guiados con plan de afrontamiento (§5, §6); señal de contexto por hábito y SRBAI (§3); manejo no punitivo de lapsos (§12); lenguaje de apoyo a la autonomía (§11).

**Experimental:** recordatorios locales con decaimiento; "nuevo comienzo" en hitos temporales; sugerencias de reestructuración ambiental; revisión mensual de mantenimiento (§15).

**Evitar:** promesas de plazos; feedback comparativo o evaluativo de la persona; puntuaciones de "disciplina"; reinicio punitivo de rachas; gamificación por defecto; conteo de calorías/peso sin advertencias; cualquier función de tratamiento de adicciones o trastornos alimentarios (requiere clínico); inferencia automática de estado emocional; optimizar para tiempo de uso.

**Redacción por defecto:** "podrías / si quieres" en vez de "debes"; "lapso" en vez de "fallo"; comparar sólo con el propio pasado; mostrar rango e incertidumbre al hablar de tiempos de formación de hábitos.

---

## Referencias

[Michie et al., 2011] The behaviour change wheel: A new method for characterising and designing behaviour change interventions. Implementation Science 6:42. DOI: 10.1186/1748-5908-6-42 | PMID: 21513547 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3096582
Verificado: sí (leído el texto completo en PMC)

[Michie et al., 2013] The behavior change technique taxonomy (v1) of 93 hierarchically clustered techniques: Building an international consensus for the reporting of behavior change interventions. Annals of Behavioral Medicine 46(1):81–95. DOI: 10.1007/s12160-013-9486-6 | PMID: 23512568 | URL: https://openaccess.city.ac.uk/id/eprint/3293/
Verificado: sí (leído el resumen)

[Marques et al., 2023] The Behaviour Change Technique Ontology: Transforming the Behaviour Change Technique Taxonomy v1. Wellcome Open Research 8:308. DOI: 10.12688/wellcomeopenres.19363.1 (v1; la v2 indexada en PubMed es 10.12688/wellcomeopenres.19363.2) | PMID: 37593567 | URL: https://eprints.whiterose.ac.uk/205776/
Verificado: sí (leído el resumen)

[Michie et al., 2009] Effective techniques in healthy eating and physical activity interventions: A meta-regression. Health Psychology 28(6):690–701. DOI: 10.1037/a0016136 | PMID: 19916637 | URL: https://doi.org/10.1037/a0016136
Verificado: sí (leído el resumen vía Europe PMC)

[Samdal et al., 2017] Effective behaviour change techniques for physical activity and healthy eating in overweight and obese adults; systematic review and meta-regression analyses. International Journal of Behavioral Nutrition and Physical Activity 14:42. DOI: 10.1186/s12966-017-0494-y | PMID: 28351367 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5370453
Verificado: sí (leído el texto completo en PMC)

[Lally et al., 2010] How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology 40(6):998–1009. DOI: 10.1002/ejsp.674 | PMID: — | URL: https://doi.org/10.1002/ejsp.674
Verificado: parcialmente (resumen reproducido en listados de búsqueda y lectura de una fuente secundaria detallada; el texto completo no pudo abrirse)

[Gardner et al., 2012] Towards parsimony in habit measurement: Testing the convergent and predictive validity of an automaticity subscale of the Self-Report Habit Index. International Journal of Behavioral Nutrition and Physical Activity 9:102. DOI: 10.1186/1479-5868-9-102 | PMID: 22935297 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3552971
Verificado: sí (leído el texto completo en PMC)

[Keller et al., 2021] Habit formation following routine-based versus time-based cue planning: A randomized controlled trial. British Journal of Health Psychology 26(3):807–824. DOI: 10.1111/bjhp.12504 | PMID: 33405284 | URL: https://doi.org/10.1111/bjhp.12504
Verificado: sí (leído el resumen vía Semantic Scholar)

[Ma et al., 2023] Effects of habit formation interventions on physical activity habit strength: Meta-analysis and meta-regression. International Journal of Behavioral Nutrition and Physical Activity 20:109. DOI: 10.1186/s12966-023-01493-3 | PMID: 37700303 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10498635
Verificado: sí (leído el texto completo en PMC)

[Singh et al., 2024] Time to Form a Habit: A Systematic Review and Meta-Analysis of Health Behaviour Habit Formation and Its Determinants. Healthcare 12(23):2488. DOI: 10.3390/healthcare12232488 | PMID: 39685110 | URL: https://doi.org/10.3390/healthcare12232488
Verificado: sí (leído el PDF, resumen e introducción)

[Gardner et al., 2024] What is habit and how can it be used to change real-world behaviour? Narrowing the theory-reality gap. Social and Personality Psychology Compass 18(6):e12975. DOI: 10.1111/spc3.12975 | PMID: — | URL: https://doi.org/10.1111/spc3.12975
Verificado: sí (leído el texto completo en PDF)

[Verplanken & Wood, 2006] Interventions to break and create consumer habits. Journal of Public Policy & Marketing 25(1):90–103. DOI: 10.1509/jppm.25.1.90 | PMID: — | URL: https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/Verplanken.Wood_.2006_changing_and_breaking_consumer_habits.pdf
Verificado: sí (leído el resumen y la introducción en PDF)

[Wood & Neal, 2016] Healthy through habit: Interventions for initiating & maintaining health behavior change. Behavioral Science & Policy 2(1):71–83. DOI: 10.1353/bsp.2016.0008 | PMID: — | URL: https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/Wood.Neal_.2016.pdf
Verificado: sí (leído el resumen y la introducción en PDF)

[Gollwitzer & Sheeran, 2006] Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology 38:69–119. DOI: 10.1016/S0065-2601(06)38002-1 | PMID: — | URL: https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f
Verificado: sí (leído el resumen)

[Sheeran, Listrom & Gollwitzer, 2025] The when and how of planning: Meta-analysis of the scope and components of implementation intentions in 642 tests. European Review of Social Psychology 36(1):162–194. DOI: 10.1080/10463283.2024.2334563 | PMID: — | URL: https://kops.uni-konstanz.de/handle/123456789/69905
Verificado: sí (leído el resumen; estimaciones corregidas por sesgo no leídas y no citadas)

[Bélanger-Gravel, Godin & Amireault, 2013] A meta-analytic review of the effect of implementation intentions on physical activity. Health Psychology Review 7(1):23–54. DOI: 10.1080/17437199.2011.560095 | PMID: — | URL: https://www.mcmasteroptimalaging.org/full-article/he/meta-analytic-review-effect-implementation-intentions-physical-activity-25322
Verificado: sí (leído el resumen)

[Hagger & Luszczynska, 2014] Implementation intention and action planning interventions in health contexts: State of the research and proposals for the way forward. Applied Psychology: Health and Well-Being 6(1):1–47. DOI: 10.1111/aphw.12017 | PMID: 24591064 | URL: https://doi.org/10.1111/aphw.12017
Verificado: sí (leído el resumen vía Europe PMC)

[Schwarzer, 2008] Modeling health behavior change: How to predict and modify the adoption and maintenance of health behaviors. Applied Psychology: An International Review 57(1):1–29. DOI: 10.1111/j.1464-0597.2007.00325.x | PMID: — | URL: https://doi.org/10.1111/j.1464-0597.2007.00325.x
Verificado: sí (leído el resumen vía Crossref)

[Sniehotta et al., 2005] Action planning and coping planning for long-term lifestyle change: Theory and assessment. European Journal of Social Psychology 35(4):565–576. DOI: 10.1002/ejsp.258 | PMID: — | URL: https://eprints.ncl.ac.uk/155807
Verificado: sí (leído el resumen)

[Sniehotta, Scholz & Schwarzer, 2006] Action plans and coping plans for physical exercise: A longitudinal intervention study in cardiac rehabilitation. British Journal of Health Psychology 11(1):23–37. DOI: 10.1348/135910705X43804 | PMID: 16480553 | URL: https://eprints.ncl.ac.uk/155804
Verificado: sí (leído el resumen)

[Epton, Currie & Armitage, 2017] Unique effects of setting goals on behavior change: Systematic review and meta-analysis. Journal of Consulting and Clinical Psychology 85(12):1182–1198. DOI: 10.1037/ccp0000260 | PMID: 29189034 | URL: https://dspace.stir.ac.uk/handle/1893/25978
Verificado: sí (leído el resumen en el manuscrito aceptado)

[Harkin et al., 2016] Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence. Psychological Bulletin 142(2):198–229. DOI: 10.1037/bul0000025 | PMID: 26479070 | URL: https://eprints.whiterose.ac.uk/id/eprint/91437/
Verificado: sí (leído el resumen)

[Etkin, 2016] The hidden cost of personal quantification. Journal of Consumer Research 42(6):967–984. DOI: 10.1093/jcr/ucv095 | PMID: — | URL: https://doi.org/10.1093/jcr/ucv095
Verificado: sí (leído el resumen vía Crossref)

[Simpson & Mazzeo, 2017] Calorie counting and fitness tracking technology: Associations with eating disorder symptomatology. Eating Behaviors 26:89–92. DOI: 10.1016/j.eatbeh.2017.02.002 | PMID: 28214452 | URL: https://doi.org/10.1016/j.eatbeh.2017.02.002
Verificado: sí (leído el resumen vía Europe PMC)

[Kluger & DeNisi, 1996] The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory. Psychological Bulletin 119(2):254–284. DOI: 10.1037/0033-2909.119.2.254 | PMID: — | URL: https://doi.org/10.1037/0033-2909.119.2.254
Verificado: parcialmente (sólo listado de búsqueda y resúmenes secundarios; cifras citadas con esa reserva)

[Bandura, 1977] Self-efficacy: Toward a unifying theory of behavioral change. Psychological Review 84(2):191–215. DOI: 10.1037/0033-295X.84.2.191 | PMID: 847061 | URL: https://doi.org/10.1037/0033-295X.84.2.191
Verificado: parcialmente (metadatos confirmados en Europe PMC; resumen no leído; se cita sólo como fundamento teórico)

[Ashford, Edmunds & French, 2010] What is the best way to change self-efficacy to promote lifestyle and recreational physical activity? A systematic review with meta-analysis. British Journal of Health Psychology 15(2):265–288. DOI: 10.1348/135910709X461752 | PMID: 19586583 | URL: https://researchprofiles.herts.ac.uk/en/publications/what-is-the-best-way-to-change-self-efficacy-to-promote-lifestyle/
Verificado: sí (leído el resumen)

[Williams & French, 2011] What are the most effective intervention techniques for changing physical activity self-efficacy and physical activity behaviour—and are they the same? Health Education Research 26(2):308–322. DOI: 10.1093/her/cyr005 | PMID: 21321008 | URL: https://doi.org/10.1093/her/cyr005
Verificado: sí (leído el resumen vía Europe PMC)

[Ryan & Deci, 2000] Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. American Psychologist 55(1):68–78. DOI: 10.1037/0003-066X.55.1.68 | PMID: 11392867 | URL: https://doi.org/10.1037/0003-066X.55.1.68
Verificado: parcialmente (listado de búsqueda con extractos del resumen; texto no abierto)

[Ng et al., 2012] Self-determination theory applied to health contexts: A meta-analysis. Perspectives on Psychological Science 7(4):325–340. DOI: 10.1177/1745691612447309 | PMID: 26168470 | URL: https://doi.org/10.1177/1745691612447309
Verificado: sí (leído el resumen vía Semantic Scholar)

[Gillison et al., 2019] A meta-analysis of techniques to promote motivation for health behaviour change from a self-determination theory perspective. Health Psychology Review 13(1):110–130. DOI: 10.1080/17437199.2018.1534071 | PMID: 30295176 | URL: https://doi.org/10.1080/17437199.2018.1534071
Verificado: sí (leído el resumen vía Semantic Scholar)

[Teixeira et al., 2020] A classification of motivation and behavior change techniques used in self-determination theory-based interventions in health contexts. Motivation Science 6(4):438–455. DOI: 10.1037/mot0000172 | PMID: — | URL: https://discovery.ucl.ac.uk/id/eprint/10107097/
Verificado: parcialmente (sólo listado de búsqueda con extractos del resumen; PDF no accesible)

[Witkiewitz & Marlatt, 2004] Relapse prevention for alcohol and drug problems: That was Zen, this is Tao. American Psychologist 59(4):224–235. DOI: 10.1037/0003-066X.59.4.224 | PMID: 15149263 | URL: https://doi.org/10.1037/0003-066X.59.4.224
Verificado: sí (leído el resumen vía Europe PMC)

[Hendershot et al., 2011] Relapse prevention for addictive behaviors. Substance Abuse Treatment, Prevention, and Policy 6:17. DOI: 10.1186/1747-597X-6-17 | PMID: 21771314 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3163190
Verificado: sí (leído el texto completo en PMC)

[Irvin et al., 1999] Efficacy of relapse prevention: A meta-analytic review. Journal of Consulting and Clinical Psychology 67(4):563–570. DOI: 10.1037/0022-006X.67.4.563 | PMID: 10450627 | URL: https://doi.org/10.1037/0022-006X.67.4.563
Verificado: parcialmente (cifras tomadas de su cita en Hendershot et al. 2011; resumen original no abierto)

[Dai, Milkman & Riis, 2014] The fresh start effect: Temporal landmarks motivate aspirational behavior. Management Science 60(10):2563–2582. DOI: 10.1287/mnsc.2014.1901 | PMID: — | URL: https://doi.org/10.1287/mnsc.2014.1901
Verificado: sí (leído el resumen vía Crossref)

[Nahum-Shani et al., 2018] Just-in-Time Adaptive Interventions (JITAIs) in mobile health: Key components and design principles for ongoing health behavior support. Annals of Behavioral Medicine 52(6):446–462. DOI: 10.1007/s12160-016-9830-8 | PMID: 27663578 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5364076
Verificado: sí (leído el texto completo en PMC)

[Fry & Neff, 2009] Periodic prompts and reminders in health promotion and health behavior interventions: Systematic review. Journal of Medical Internet Research 11(2):e16. DOI: 10.2196/jmir.1138 | PMID: 19632970 | URL: https://www.jmir.org/2009/2/e16
Verificado: sí (leído el resumen vía Semantic Scholar)

[Stawarz, Cox & Blandford, 2015] Beyond self-tracking and reminders: Designing smartphone apps that support habit formation. Proceedings of CHI 2015, pp. 2653–2662. DOI: 10.1145/2702123.2702230 | PMID: — | URL: https://doi.org/10.1145/2702123.2702230
Verificado: parcialmente (sólo metadatos vía Crossref/Semantic Scholar; no se citan hallazgos)

[Eysenbach, 2005] The law of attrition. Journal of Medical Internet Research 7(1):e11. DOI: 10.2196/jmir.7.1.e11 | PMID: 15829473 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC1550631
Verificado: sí (leído el texto completo en PMC)

[Perski et al., 2017] Conceptualising engagement with digital behaviour change interventions: A systematic review using principles from critical interpretive synthesis. Translational Behavioral Medicine 7(2):254–267. DOI: 10.1007/s13142-016-0453-1 | PMID: 27966189 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5526809
Verificado: sí (leído el texto completo en PMC)

[Yardley et al., 2016] Understanding and promoting effective engagement with digital behavior change interventions. American Journal of Preventive Medicine 51(5):833–842. DOI: 10.1016/j.amepre.2016.06.015 | PMID: 27745683 | URL: https://doi.org/10.1016/j.amepre.2016.06.015
Verificado: sí (leído el resumen vía Europe PMC)

[Baumel et al., 2019] Objective user engagement with mental health apps: Systematic search and panel-based usage analysis. Journal of Medical Internet Research 21(9):e14567. DOI: 10.2196/14567 | PMID: 31573916 | URL: https://www.jmir.org/2019/9/e14567
Verificado: sí (leído el resumen vía Semantic Scholar; cifras por tipo de app tomadas del resumen reproducido en el listado de búsqueda)

[Meyerowitz-Katz et al., 2020] Rates of attrition and dropout in app-based interventions for chronic disease: Systematic review and meta-analysis. Journal of Medical Internet Research 22(9):e20283. DOI: 10.2196/20283 | PMID: 32990635 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC7556375
Verificado: sí (leído el resumen vía Semantic Scholar)

[Kwasnicka et al., 2016] Theoretical explanations for maintenance of behaviour change: A systematic review of behaviour theories. Health Psychology Review 10(3):277–296. DOI: 10.1080/17437199.2016.1151372 | PMID: 26854092 | URL: https://storre.stir.ac.uk/handle/1893/25036
Verificado: sí (leído el resumen)

---

Nota de método: la cuota de búsqueda web de la sesión se agotó a mitad del trabajo; las verificaciones posteriores se hicieron leyendo directamente PMC, repositorios institucionales y las API de Europe PMC, Semantic Scholar y Crossref para DOIs conocidos. Todos los PMID listados se comprobaron contra Europe PMC; los marcados "—" corresponden a revistas no indexadas en PubMed.
