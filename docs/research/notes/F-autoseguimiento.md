# F. Autoseguimiento y mediciones (self-tracking)

Nota de método: se verificaron 35 fuentes mediante resúmenes (PubMed/Europe PMC, PMC, revistas,
Semantic Scholar) y un texto completo (Harkin 2016, PDF). La cuota de búsqueda web de la sesión
se agotó a mitad de trabajo; las fuentes que no pudieron abrirse se marcan así en `## Referencias`
y no se citan cifras de ellas. No se pudo acceder a NICE CG189 (403), por lo que no se afirma nada
sobre su contenido. Hoy: 2026-11-05.

---

### 1. Automonitorización (self-monitoring) como técnica de cambio conductual

- **Mecanismo propuesto:** Teoría del control / autorregulación: comparar el estado actual con un
  valor de referencia (meta) y reducir la discrepancia. Registrar hace visible la discrepancia y
  activa la corrección. Efecto añadido de *reactividad*: el mero acto de observarse cambia la
  conducta observada, incluso sin intervención adicional.
- **Objetivo conductual:** Cualquier conducta o resultado cuantificable (ingesta, actividad,
  sueño, estado de ánimo, peso).
- **Evidencia a favor:**
  - *Harkin et al., 2016* (meta-análisis de 138 estudios experimentales, N = 19.951; texto
    completo leído). Las intervenciones que promueven monitorizar el progreso aumentan la
    frecuencia de monitorización (d+ = 1,98) y la consecución de metas (d+ = 0,40; IC95 % 0,32–0,48).
    El efecto es mayor si la información se **registra físicamente** (d+ = 0,43 vs 0,29) y si se
    **comunica a alguien** (d+ = 0,47 reportado en privado; 0,55 en público; vs 0,19 sin reportar).
    Por dominio: depresión d+ = 0,66, presión arterial 0,63, actividad física 0,59; pero **peso
    d+ = 0,30 y dieta d+ = 0,23** (efectos pequeños). Comparar con el objetivo futuro o con el
    estado pasado funcionó igual (d+ = 0,41 vs 0,43).
  - *Michie et al., 2009* (meta-regresión, 101 estudios, 122 evaluaciones, n = 44.747): efecto
    global 0,31; la automonitorización explicó la mayor parte de la heterogeneidad (13 %);
    combinada con al menos otra técnica de la teoría del control (metas, feedback, revisión de
    metas) el efecto fue 0,42 frente a 0,26.
  - *Burke, Wang & Sevick, 2011* (revisión sistemática, 22 estudios): asociación consistente entre
    automonitorización (dieta, ejercicio, peso) y pérdida de peso; "más frecuente = mejor" de forma
    consistente, pero sin poder fijar una dosis.
- **Limitaciones metodológicas:** Mucha heterogeneidad; monitorización casi siempre empaquetada con
  otras técnicas; adherencia medida por autoinforme (Burke 2011 documenta "backfilling" de
  diarios). Reactividad: la revisión clásica de *Korotitsch & Nelson-Gray (1999)* no pudo abrirse
  (sólo ficha bibliográfica), así que no se citan cifras de ella.
- **Calidad y consistencia de la evidencia:** Alta para el efecto global de la automonitorización
  (meta-análisis experimental grande); Moderada para dominios concretos (peso/dieta, efectos
  pequeños y heterogéneos).
- **Poblaciones estudiadas:** Adultos, mayoritariamente clínicos o con sobrepeso; muestras
  predominantemente blancas y femeninas en el área del peso (Burke 2011).
- **Riesgos / efectos adversos:** Véanse secciones 3, 8 y 9 (poblaciones vulnerables, coste
  hedónico, apps de calorías).
- **Frecuencia o dosis estudiada:** No establecida; Burke 2011 concluye "tanto como sea posible"
  pero reconoce que la dosis óptima es desconocida.
- **Aplicabilidad a una app offline sin IA:** Directa. La app ya es un registro físico; el
  componente "comunicar a alguien" no está disponible offline, pero se puede ofrecer un resumen
  semanal exportable que el usuario decida compartir.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir (núcleo del motor de métricas).

---

### 2. Variabilidad natural del peso y lectura de tendencias

- **Mecanismo propuesto:** El peso diario está dominado por agua, contenido intestinal y glucógeno;
  la señal (grasa/masa magra) cambia lentamente. Mostrar sólo la observación cruda induce
  atribuciones erróneas ("he engordado desde ayer") y desánimo.
- **Objetivo conductual:** Interpretar correctamente el cambio; evitar reacciones a ruido.
- **Evidencia a favor:**
  - *Orsama et al., 2014* (retrospectivo, 80 adultos, 4.657 pesajes matutinos, 15–330 días):
    ciclo semanal a nivel de grupo; máximo domingo/lunes, mínimo viernes/sábado; el ciclo es más
    marcado en quienes pierden o mantienen peso. Los autores recomiendan leer las subidas de fin de
    semana como variación normal.
  - *Racette et al., 2008* (RCT, 48 adultos 50–60 años, pesaje matutino diario durante un año):
    ganancia de ~0,06 kg/día en fin de semana al inicio y ~0,08 ± 0,03 kg/día en el grupo de
    ejercicio; el grupo de restricción calórica dejaba de perder en fin de semana.
  - *Turicchi et al., 2020, PLoS ONE* (1.421 adultos en mantenimiento de peso, básculas
    inteligentes, detrending LOESS): amplitud semanal media **0,35 % del peso (~0,3 kg)**; máximo
    lunes, mínimo viernes; patrón consistente por sexo, país, IMC y edad.
  - *Turicchi et al., 2020, JMIR mHealth* (50 participantes NoHoW, simulación): para estimar
    variabilidad del peso recomiendan **no imputar** datos faltantes; los métodos lineales y no
    lineales funcionan razonablemente incluso con 80 % de datos ausentes; el suavizado estructural
    (Kalman) y la **media móvil exponencial** fueron los que mejor ajustaron los valores observados.
  - *Bhutani et al., 2017* (46 adultos, agua corporal por dilución isotópica y DXA): en dos
    semanas en libertad, el cambio medio fue 0,26 kg con DE ≈ 1,2 kg, y ~84 % de cada unidad de
    cambio de peso fue masa libre de grasa (agua), no grasa.
  - *Hacker's Diet* (John Walker; **no académico**): propone una media móvil exponencial con
    constante de suavizado 0,9 (≈ 10 % de peso al dato nuevo; equivalente aproximado a una media
    simple de 20 días) y mostrar la tendencia como única señal interpretable. Útil como heurística de
    ingeniería, no como evidencia.
- **Limitaciones metodológicas:** La cifra "DE intraindividual diaria ≈ 0,5–1 kg" que se pedía
  verificar **no pudo confirmarse** en ninguna fuente abierta; lo verificado es la amplitud del ciclo
  semanal (~0,3 kg / 0,35 %) y la deriva de fin de semana (~0,06–0,08 kg/día). Las muestras son de
  personas en programas de peso; el ciclo semanal puede ser cultural (Turicchi observa diferencias
  Portugal vs UK/Dinamarca).
- **Calidad y consistencia de la evidencia:** Moderada para la existencia y magnitud del ciclo
  semanal (varias cohortes, consistente); Baja para el método de suavizado concreto (sin
  comparación experimental de visualizaciones).
- **Poblaciones estudiadas:** Adultos 25–62 años, mayoritariamente en programas de pérdida o
  mantenimiento de peso.
- **Riesgos / efectos adversos:** Mostrar deltas diarios fomenta "pesaje reactivo" (sección 8).
- **Frecuencia o dosis estudiada:** Pesaje matutino diario en todos los estudios citados.
- **Aplicabilidad a una app offline sin IA:** Alta: EWMA o media móvil de 7 días son triviales de
  implementar; una ventana de 7 días anula por construcción el ciclo semanal.
- **Confianza en su utilidad:** Alta (como principio de visualización).
- **Decisión sugerida:** Incluir.

---

### 3. Autopesaje: frecuencia, beneficios, daños y a quién no conviene

- **Mecanismo propuesto:** Feedback frecuente del resultado permite autorregular ingesta/actividad
  (Caloric Titration). Riesgo: en personas con preocupación corporal, el número se convierte en
  juicio de valor y dispara restricción, atracón o ánimo bajo.
- **Objetivo conductual:** Mantenimiento o pérdida de peso en adultos que lo deseen.
- **Evidencia a favor:**
  - *Madigan et al., 2015* (meta-análisis de RCT, 24 ensayos descritos, 19 agrupados): añadir
    autopesaje/autorregulación a un programa conductual: **−1,7 kg** (IC95 % −2,6 a −0,8; 4 ensayos,
    I² 0 %); programas multicomponente con autopesaje vs control mínimo: −3,4 kg (−4,2 a −2,6; 15
    ensayos, I² 82 %). **Diario vs menos que diario: −3,6 vs −3,3 kg, diferencia no significativa
    (p = 0,57).** Autopesaje **solo**, sin programa: −0,5 kg (−1,3 a 0,3), sin evidencia de efecto.
    Ensayos con rendición de cuentas (accountability) mostraron más pérdida (p = 0,03). Tres ensayos
    midieron resultados psicológicos y no hallaron diferencias.
  - *Zheng et al., 2015* (revisión sistemática, 17 estudios): pesarse regularmente se asocia con
    pérdida de peso y no con depresión ni ansiedad.
  - *Shieh et al., 2016* (revisión sistemática, 22 artículos / 19 ensayos): 84 % usaron pesaje
    diario; 75 % de las intervenciones de sólo pesaje y 67 % de las combinadas mejoraron el peso; sin
    efectos psicológicos negativos detectados.
  - *Steinberg et al., 2014* (RCT, N = 91 adultos con sobrepeso, 6 meses, pesaje diario con
    e-báscula): sin diferencias en depresión, cogniciones anoréxicas, desinhibición, hambre ni
    atracón; menor insatisfacción corporal y mayor restricción dietética en el grupo intervención.
  - *Pacanowski & Levitsky, 2015* (RCT, N = 162, 2 años; pesaje diario con feedback visual de la
    tendencia): −2,6 ± 5,9 kg vs −0,5 ± 4,4 kg al año (p = 0,019), efecto mayor en hombres.
  - *Jospe et al., 2017* (RCT, N = 250, 12 meses, cinco brazos: consultas breves, pesaje diario,
    MyFitnessPal, hunger training, control): **ninguna estrategia de monitorización añadió pérdida
    de peso** sobre el consejo de dieta y ejercicio (diferencias −1,1 a 2,2 kg, IC cruzando 0); sin
    efectos adversos en conducta alimentaria. Retención 68 %.
- **Evidencia de daño o nulidad (poblaciones vulnerables):**
  - *Pacanowski, Linde & Neumark-Sztainer, 2015* (revisión narrativa, 20 artículos): en afecto,
    autoestima, evaluación corporal y conducta alimentaria, la mayoría de estudios reporta
    asociaciones negativas con el autopesaje; posible moderación por sexo (mujeres) y edad
    (adolescentes). No se cuantifica el tamaño.
  - *Pacanowski et al., 2015, JNEB* (Project EAT, cohorte longitudinal 10 años, N = 1.868): en
    mujeres jóvenes, el aumento del autopesaje se asoció a más preocupación por el peso
    (β = 0,55), más síntomas depresivos (β = 0,41), menor satisfacción corporal (β = −0,97) y menor
    autoestima (β = −0,34), todos p < 0,001; en hombres sólo preocupación por el peso. Efectos
    pequeños; correlacional.
  - *Quick et al., 2012* (transversal, N = 2.287 jóvenes adultos, 25 años): pesarse varias veces por
    semana se asoció con dieta, conductas de control de peso sanas e insanas; en mujeres, con
    atracones, síntomas depresivos y baja autoestima. Los autores recomiendan descartar riesgo de
    preocupación excesiva antes de aconsejar el autopesaje.
  - Harkin 2016: dominio "peso" con el efecto más pequeño de todos los que funcionan (d+ = 0,30).
- **Limitaciones metodológicas:** Los RCT favorables reclutan adultos con sobrepeso motivados y
  excluyen trastornos alimentarios; los estudios de daño son observacionales en adolescentes y
  jóvenes (no se puede separar si pesarse causa malestar o el malestar lleva a pesarse). La
  "accountability" en Madigan es un análisis entre ensayos, observacional.
- **Calidad y consistencia de la evidencia:** Moderada para "pesarse ayuda algo dentro de un
  programa, y diario no supera a semanal"; Baja para el autopesaje aislado (un RCT, nulo; Jospe
  nulo); Baja–Moderada para daño en jóvenes (consistente pero correlacional).
- **Poblaciones estudiadas:** Adultos con sobrepeso (beneficio); adolescentes y jóvenes adultos,
  especialmente mujeres (daño asociado).
- **Riesgos / efectos adversos:** Preocupación por el peso, ánimo bajo, restricción, atracón en
  personas vulnerables. Sin guía clínica, la app no puede cribar fiablemente el riesgo.
- **Frecuencia o dosis estudiada:** Diaria y semanal; sin diferencia detectable (Madigan). Burke
  2011 sugiere "al menos semanal". Condiciones de medición usadas en los estudios: **por la mañana,
  al despertar, en ayunas y tras orinar, misma báscula** (Orsama, Racette protocolizan pesaje
  matutino); esto reduce el ruido intradía y es lo que la app debe sugerir.
- **Aplicabilidad a una app offline sin IA:** Posible, pero **opt-in** y nunca sugerido por
  defecto. Por defecto semanal (mismo día y hora), diario sólo si el usuario lo pide, siempre con
  tendencia suavizada y sin colores de juicio.
- **Confianza en su utilidad:** Media (depende de quién lo use).
- **Decisión sugerida:** Incluir como experimental / opt-in con aviso neutro (ver sección 12).

---

### 4. Monitorizar acciones (proceso) frente a resultados

- **Mecanismo propuesto:** Las conductas están bajo control directo; los resultados (peso,
  glucosa, ánimo) dependen de muchos factores y fluctúan. Monitorizar proceso da feedback
  inmediato y controlable; monitorizar sólo resultados produce desánimo por latencia y ruido.
- **Objetivo conductual:** Mantener la acción cuando el resultado aún no se mueve.
- **Evidencia a favor:**
  - *Harkin 2016* (texto completo): **efecto de emparejamiento**. Monitorizar la conducta cambia la
    conducta (d+ = 0,79; IC 0,50–1,07; k = 17) pero **no** los resultados (d+ = 0,14; IC −0,18 a
    0,46). Monitorizar resultados cambia los resultados (d+ = 0,62; IC 0,26–0,98; k = 30) pero no la
    conducta (d+ = 0,17; IC −0,01 a 0,36). Es decir: si lo que se quiere es sostener un hábito, hay
    que registrar el hábito.
  - *Michie et al., 2013* (BCT Taxonomy v1, 93 técnicas): distingue formalmente "self-monitoring
    of behaviour" (2.3) y "self-monitoring of outcome(s) of behaviour" (2.4) como técnicas
    diferentes (ficha verificada; texto no leído).
  - *Helsel, Jakicic & Otto, 2007* (RCT, N = 42): la pérdida de peso correlacionó con el **número de
    diarios completados** (r = 0,53), no con su nivel de detalle.
- **Limitaciones metodológicas:** Los subgrupos de Harkin tienen k pequeño (4–30); pocos estudios
  comparan directamente proceso vs resultado en la misma muestra.
- **Calidad y consistencia de la evidencia:** Moderada (meta-análisis experimental, subgrupos
  coherentes con la teoría).
- **Poblaciones estudiadas:** Adultos, dominios de salud variados.
- **Riesgos / efectos adversos:** Sobrecarga si se registran demasiados procesos (sección 7).
- **Frecuencia o dosis estudiada:** La propia de cada conducta (por episodio o diaria).
- **Aplicabilidad a una app offline sin IA:** Alta. El motor debe permitir que cada meta de
  resultado tenga métricas de proceso asociadas y mostrar el proceso en primer plano.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir (por defecto, la app sugiere métricas de proceso; las de resultado
  son opcionales).

---

### 5. Indicadores subjetivos de un solo ítem (ánimo, energía, estrés)

- **Mecanismo propuesto:** Un ítem breve bien formulado captura la mayor parte de la varianza de
  constructos amplios y reduce la carga, lo que mantiene la adherencia.
- **Objetivo conductual:** Registro rápido diario de estados internos para reflexión.
- **Evidencia a favor:**
  - *Elo, Leppänen & Jahkola, 2003* (4 muestras transversales, N total ≈ 4.958): un único ítem de
    síntomas de estrés mostró validez de contenido, criterio y constructo satisfactoria **para
    análisis a nivel de grupo**; correlacionó con síntomas psicológicos, trastornos del sueño y
    escalas de bienestar.
  - *Allen, Iliescu & Greiff, 2022* (editorial EJPA, "Single Item Measures in Psychological
    Science: a call to action"): ficha verificada; el texto no pudo abrirse, así que sólo se cita
    su existencia como posicionamiento favorable al uso justificado de ítems únicos.
  - *Eisele et al., 2022* (sección 6): cuestionarios largos aumentan carga y degradan la calidad;
    argumento indirecto a favor de pocos ítems.
  - Likert vs VAS: no se pudo verificar la comparación específica (*Hasson & Arnetz 2005*), por lo
    que no se afirma superioridad de ninguno. En una TUI, una escala ordinal de 5 o 7 puntos con
    anclas verbales es lo más usable.
- **Limitaciones metodológicas:** La validez de ítems únicos está demostrada a nivel grupal, no
  para diagnóstico individual; la fiabilidad test-retest es menor que la de escalas largas.
- **Calidad y consistencia de la evidencia:** Moderada.
- **Poblaciones estudiadas:** Trabajadores adultos nórdicos (Elo).
- **Riesgos / efectos adversos:** Interpretar una puntuación aislada como "diagnóstico".
- **Frecuencia o dosis estudiada:** Transversal (Elo); en EMA, varias veces al día (sección 6).
- **Aplicabilidad a una app offline sin IA:** Alta: ítems tipo "¿Cómo ha sido tu energía hoy? 1–5"
  con anclas; nunca más de 3–4 ítems subjetivos por registro.
- **Confianza en su utilidad:** Alta (para reflexión personal, no para diagnóstico).
- **Decisión sugerida:** Incluir.

---

### 6. Frecuencia de medición, carga y abandono del autoseguimiento

- **Mecanismo propuesto:** La carga percibida (longitud del cuestionario, número de avisos)
  reduce el cumplimiento y la calidad de las respuestas; el abandono es la norma, no la excepción.
- **Objetivo conductual:** Sostener el registro el tiempo necesario y permitir pausas sin culpa.
- **Evidencia a favor:**
  - *Eisele et al., 2022* (experimento, N = 163 estudiantes, 14 días; 30 vs 60 ítems × 3/6/9 veces
    al día): los **cuestionarios largos** aumentaron la carga y empeoraron cantidad y calidad de
    datos; la **frecuencia** no se asoció a peores resultados. Conclusión: evitar cuestionarios
    largos. (Reanálisis de *Ulitzsch et al., 2025* con otro modelo encontró lo contrario para
    respuestas descuidadas: la frecuencia, no la longitud, las aumentó — por lo que ambos factores
    deben mantenerse bajos.)
  - *Vachon et al., 2019* (meta-análisis, 79 estudios ESM, 8.013 personas): mayor cumplimiento con
    esquemas de muestreo fijos, intervalos más largos y **menos evaluaciones por día**; menor en
    hombres y en psicosis.
  - *Lazar et al., 2015* (cualitativo, 2 meses con dispositivos): abandono por mal ajuste con la
    autoimagen, datos percibidos como inútiles y mantenimiento inasumible; los autores cuestionan que
    el uso sostenido sea la meta correcta para todo el mundo.
  - *Epstein et al., 2015* ("lived informatics", encuestas + 22 entrevistas): el seguimiento
    **lapsa y se reanuda**; el modelo incluye explícitamente "lapsing" y "resuming" como fases
    normales.
  - *Epstein et al., 2016* (encuesta N = 193 + 12 entrevistas): seis razones para dejar de
    registrar y cinco perspectivas sobre "la vida después del tracking"; el diseño de la
    herramienta sigue afectando al usuario después del abandono; propone diseñar para esa fase.
  - *Clawson et al., 2015* (anuncios de Craigslist): ficha verificada, resumen no leído; se cita
    sólo como evidencia de que el abandono es frecuente y no siempre negativo.
- **Limitaciones metodológicas:** Eisele y Vachon son muestras de estudiantes o clínicas, con
  incentivos; los estudios HCI son cualitativos y pequeños.
- **Calidad y consistencia de la evidencia:** Moderada para "cuestionarios cortos"; Baja–Moderada
  para los patrones de abandono (cualitativo, consistente entre estudios).
- **Poblaciones estudiadas:** Estudiantes, pacientes psiquiátricos, usuarios de wearables.
- **Riesgos / efectos adversos:** Culpa por "rachas rotas"; abandono total de la app por fatiga.
- **Frecuencia o dosis estudiada:** 3–9 avisos/día en ESM (mucho más de lo razonable para un
  diario); en la práctica, una vez al día es el máximo defendible para una app de autoayuda.
- **Aplicabilidad a una app offline sin IA:** Alta: un registro diario de ≤ 2 minutos; recordatorios
  opt-in; estados "pausado" y "retomado" sin penalización.
- **Confianza en su utilidad:** Alta.
- **Decisión sugerida:** Incluir (como restricciones de diseño).

---

### 7. Selección individualizada de métricas ("personal informatics")

- **Mecanismo propuesto:** El registro útil es el que responde a una pregunta propia del usuario,
  con el contexto necesario para interpretarlo. Registrar demasiado o sin contexto bloquea la
  reflexión.
- **Objetivo conductual:** Elegir pocas métricas con sentido personal.
- **Evidencia a favor:**
  - *Li, Dey & Forlizzi, 2010* (CHI; encuestas y entrevistas): modelo de cinco etapas
    (preparación, recogida, integración, reflexión, acción); las barreras se arrastran de una etapa
    a la siguiente (p. ej., decidir mal qué registrar en "preparación" arruina la "reflexión").
  - *Choe et al., 2014* (CHI; análisis de 52 charlas Quantified Self): tres errores recurrentes:
    **registrar demasiadas cosas, no registrar disparadores ni contexto, y falta de rigor** al sacar
    conclusiones.
  - *Epstein 2015/2016* (sección 6): los objetivos de tracking son diversos (curiosidad,
    cambio, registro), no sólo cambio conductual.
- **Limitaciones metodológicas:** Marcos teóricos derivados de estudios cualitativos; no son
  intervenciones con eficacia experimental.
- **Calidad y consistencia de la evidencia:** Baja (teórico/cualitativo), pero consistente.
- **Poblaciones estudiadas:** Entusiastas del autoseguimiento (sesgo de selección evidente).
- **Riesgos / efectos adversos:** Sobrecarga; conclusiones causales espurias a partir de datos
  personales ruidosos.
- **Frecuencia o dosis estudiada:** No aplica.
- **Aplicabilidad a una app offline sin IA:** Alta: asistente de "preparación" que pregunta "¿qué
  quieres saber?", límite blando de métricas activas, campo de nota/contexto en cada registro.
- **Confianza en su utilidad:** Media–Alta.
- **Decisión sugerida:** Incluir.

---

### 8. Efectos negativos del sobre-monitoreo

- **Mecanismo propuesto:** (a) Perfeccionismo sobre el dato (orthosomnia); (b) la medición desplaza
  la atención del disfrute al rendimiento y mina la motivación intrínseca; (c) en personas con
  riesgo de trastorno alimentario, contar calorías o ejercicio alimenta la restricción.
- **Objetivo conductual:** Evitar que la herramienta cause el problema que pretende observar.
- **Evidencia:**
  - *Baron et al., 2017* (serie de 3 casos): acuña "orthosomnia": preocupación por perfeccionar los
    datos de sueño del wearable; los dispositivos sobreestiman el sueño y no distinguen fases;
    pacientes que no aceptan datos objetivos (PSG) frente al tracker; recomiendan diario de sueño en
    papel junto al dispositivo y revisar la validez del tracker con el paciente.
  - *Etkin, 2016* (6 experimentos, J Consumer Research): medir una actividad (caminar, leer) aumenta
    la cantidad hecha pero **reduce el disfrute** al convertirla en trabajo; eso reduce el
    compromiso posterior y el bienestar subjetivo, incluso sin incentivos externos.
  - *Simpson & Mazzeo, 2017* (transversal, N = 493 universitarios): usar seguimiento de fitness se
    asoció de forma única con sintomatología de trastorno alimentario; usuarios de contadores de
    calorías también puntuaron más alto en preocupación alimentaria y restricción.
  - *Levinson, Fewell & Brosof, 2017* (N = 105 con TA diagnosticado): 74,3 % usaba MyFitnessPal;
    de ellos, **73,1 % percibía que contribuyó al menos algo a su trastorno** y 30,3 % "mucho";
    correlación con restricción (r = 0,25) y preocupación por peso/forma (r = 0,34–0,36).
  - *Linardon & Messer, 2019* (transversal, N = 122 hombres): ~56 % había usado MFP; usuarios con
    más síntomas y más deterioro psicosocial (tamaños de efecto grandes); ~40 % percibía la app como
    contribuyente.
  - *Hahn et al., 2021* (RCT, N = 200 mujeres universitarias **de bajo riesgo**, 1 mes de MFP):
    sin cambios en riesgo de TA, ansiedad, depresión, satisfacción corporal ni conducta; adherencia
    89 % de los días. Los autores piden investigar en poblaciones donde podría estar contraindicado.
- **Limitaciones metodológicas:** Estudios de daño transversales/retrospectivos (causalidad
  inversa plausible: quien ya restringe busca la app); un RCT nulo en bajo riesgo y un mes.
- **Calidad y consistencia de la evidencia:** Baja–Moderada: asociación consistente en muestras
  clínicas; ausencia de daño en bajo riesgo a corto plazo (un RCT).
- **Poblaciones estudiadas:** Universitarios, pacientes con TA, hombres jóvenes, pacientes de
  clínica de sueño.
- **Riesgos / efectos adversos:** Es la sección de riesgos. Interpretación operativa: no se puede
  cribar con fiabilidad quién está en riesgo; por tanto, calorías y peso deben ser opt-in con aviso
  y fáciles de desactivar.
- **Frecuencia o dosis estudiada:** Uso habitual de apps; 1 mes en el RCT.
- **Aplicabilidad a una app offline sin IA:** Lo aplicable es la *abstención*: no gamificar
  calorías, no comparar con "ideal", no ofrecer puntuaciones de sueño.
- **Confianza en su utilidad:** Alta (como lista de cosas que no hacer).
- **Decisión sugerida:** Modificar (restricciones de diseño) / Descartar contador de calorías por
  defecto.

---

### 9. Registro de alimentación: diarios, versiones abreviadas y fotos

- **Mecanismo propuesto:** Conciencia de la ingesta y detección de patrones (contexto, horas,
  disparadores). El valor está en el *acto* de registrar, no en la precisión calórica.
- **Objetivo conductual:** Conciencia alimentaria; apoyo a metas de peso cuando el usuario lo elige.
- **Evidencia a favor:**
  - *Hollis et al., 2008* (fase intensiva del Weight Loss Maintenance trial, N = 1.685): media de
    3,7 registros diarios/semana; las medidas conductuales (registros de dieta, actividad)
    explicaron la mayor parte de la variación en pérdida (−5,8 kg de media).
  - *Burke 2011*: frecuencia de registro consistentemente asociada a pérdida (p. ej., Yon 2007:
    la frecuencia explicó el 32 % de la varianza); adherencia cae con el tiempo (en un estudio sólo
    25 % seguía registrando al final).
  - *Helsel 2007* (RCT, N = 42): el método **abreviado** devolvió más diarios (p = 0,04) con la
    misma pérdida que el detallado (−7,6 vs −7,5 kg en completadores).
  - *Krukowski et al., 2022* (Delphi, 86–103 expertos): para reducir carga manteniendo eficacia,
    consenso en: (1) sólo pesarse; (2) registrar sólo alimentos menos rutinarios y de alta densidad
    (dulces, restaurante, fritos; o sólo cenas de entre semana + fines de semana); (3) registro
    completo **3–4 días/semana incluyendo un día de fin de semana**. Es opinión experta, no ensayo.
  - *Boushey et al., 2017* (revisión de métodos basados en imagen): las imágenes redujeron el
    infrarreporte en todos los estudios revisados y se integran mejor en la rutina; faltan muestras
    grandes.
  - *Payne 2018* y *Hales 2017* ("Trading pounds for points") solicitados en el encargo: **no se
    pudieron localizar**; no se citan.
- **Limitaciones metodológicas:** Muestras homogéneas; adherencia autoinformada; el Delphi es
  consenso, no evidencia de eficacia.
- **Calidad y consistencia de la evidencia:** Moderada para "registrar algo con frecuencia
  ayuda"; Baja para el formato concreto (abreviado, fotos).
- **Poblaciones estudiadas:** Adultos con sobrepeso en programas estructurados.
- **Riesgos / efectos adversos:** Sección 8. Además: una app offline sin base de datos de alimentos
  no puede contar calorías con precisión, y no debería intentarlo.
- **Frecuencia o dosis estudiada:** 3,7 días/semana (observado); 3–4 días/semana (consenso).
- **Aplicabilidad a una app offline sin IA:** Registro **cualitativo** por defecto: qué, cuándo,
  dónde, con quién, hambre/saciedad (1–5), nota libre o referencia a foto externa. Modo "abreviado"
  (sólo comidas no rutinarias) como opción. Sin calorías por defecto.
- **Confianza en su utilidad:** Media.
- **Decisión sugerida:** Incluir como experimental (registro cualitativo opt-in); Descartar
  contador de calorías.

---

### 10. Sueño: diario, regularidad y qué parte de la TCC-I es autoayuda

- **Mecanismo propuesto:** El diario prospectivo reduce el sesgo retrospectivo; la regularidad
  horaria estabiliza el ritmo circadiano; el control de estímulos reasocia cama con sueño.
- **Objetivo conductual:** Horarios regulares, rutina previa, uso de la cama sólo para dormir.
- **Evidencia a favor:**
  - *Carney et al., 2012* (consenso de expertos): **Consensus Sleep Diary**, versión Core (hora de
    acostarse, intento de dormir, latencia, despertares, hora final, hora de levantarse, calidad)
    y versión ampliada; se presenta como documento vivo a validar.
  - *Dietch & Taylor, 2021* (N = 80, 7 noches, vs EEG monocanal, actigrafía y cuestionario): el
    diario sobreestima tiempo total de sueño (~40 min vs EEG) y eficiencia (~7 puntos), pero el
    **momento del sueño** (midpoint) es muy preciso (r = 0,92–0,99); recomiendan el diario frente a
    cuestionarios retrospectivos.
  - *Phillips et al., 2017* (N = 61 estudiantes, 30 días, Sleep Regularity Index): la
    irregularidad se asoció a melatonina más tardía y peor rendimiento académico (r = 0,37); la
    duración media no difería entre regulares e irregulares. Correlacional.
  - *Windred et al., 2024* (UK Biobank, N = 60.977, acelerometría): mayor regularidad asociada a
    20–48 % menos mortalidad total; la regularidad predijo mejor que la duración. Observacional;
    la comparación directa con duración es menos concluyente de lo que sugiere el titular.
  - *Ho et al., 2015* (meta-análisis de 20 RCT): la TCC-I **de autoayuda** mejora eficiencia del
    sueño (0,80), latencia (0,66) y despertares (0,55), con abandono del 14,5 % similar al
    tratamiento presencial; aceptable como primer escalón.
  - *Edinger et al., 2021* (guía AASM, GRADE): TCC-I multicomponente — recomendación fuerte;
    control de estímulos, restricción de sueño y relajación como componentes únicos —
    condicionales; **higiene del sueño como terapia única — condicional en contra**.
  - *Riemann et al., 2017* (guía europea): TCC-I primera línea (fuerte, alta calidad); diarios de
    sueño como parte de la evaluación.
- **Evidencia de precaución:**
  - *Kyle et al., 2014* (N = 16, PSG en laboratorio): la restricción de sueño redujo el tiempo
    total de sueño objetivo (−91, −78 y −69 min en noches 1, 8 y 22), aumentó somnolencia diurna y
    deterioró la vigilancia (PVT) en la fase aguda, normalizándose a los 3 meses. Es un tratamiento
    con efectos secundarios reales (riesgo al conducir) que **requiere supervisión clínica**.
  - *Baron 2017*: no usar puntuaciones de sueño de wearables como diagnóstico.
- **Limitaciones metodológicas:** Consenso (Carney); correlación (Phillips, Windred); los
  meta-análisis de autoayuda incluyen materiales estructurados con apoyo telefónico en algunos
  brazos.
- **Calidad y consistencia de la evidencia:** Alta para TCC-I; Moderada para autoayuda; Baja–Moderada
  (observacional, consistente) para regularidad.
- **Poblaciones estudiadas:** Adultos con insomnio crónico; estudiantes; población general británica
  de mediana edad.
- **Riesgos / efectos adversos:** Restricción de sueño sin supervisión; obsesión por la puntuación.
- **Frecuencia o dosis estudiada:** Diario cada mañana; 1–2 semanas mínimas para ver patrones.
- **Aplicabilidad a una app offline sin IA:** Diario de sueño tipo CSD Core (≤ 7 campos, 1 min);
  mostrar **regularidad** (dispersión de la hora de acostarse/levantarse) y midpoint, no "puntuación
  de sueño"; sugerencias de control de estímulos y rutina. **No implementar** restricción de sueño
  ni ventanas de tiempo en cama prescritas.
- **Confianza en su utilidad:** Alta (diario + regularidad); Baja para cualquier componente
  terapéutico activo.
- **Decisión sugerida:** Incluir diario y regularidad; Descartar restricción de sueño.

---

### 11. Ejercicio: pasos, metas y marco OMS

- **Mecanismo propuesto:** Los pasos son una métrica de proceso simple y objetiva; las metas
  incrementales desde la línea base son más alcanzables que un número fijo.
- **Objetivo conductual:** Aumentar actividad habitual de forma sostenible.
- **Evidencia a favor:**
  - *Bull et al., 2020* (OMS 2020): adultos, 150–300 min/semana de intensidad moderada o 75–150
    vigorosa, más fortalecimiento muscular; reducir sedentarismo; "algo es mejor que nada".
  - *Paluch et al., 2022* (meta-análisis de 15 cohortes): más pasos, menor mortalidad, con
    meseta dependiente de la edad (≈ 6.000–8.000 pasos/día en ≥ 60 años; ≈ 8.000–10.000 en < 60);
    HR 0,60 / 0,55 / ≈ 0,47 para cuartiles 2–4 vs 1 (medianas 5.801 / 7.842 / 10.901 vs 3.553).
    Contexto epidemiológico, **no** una meta prescriptiva.
  - *Tudor-Locke & Bassett, 2004*: los 10.000 pasos vienen de un eslogan comercial japonés;
    categorías preliminares (< 5.000 sedentario; 5.000–7.499 poco activo; 7.500–9.999 algo activo;
    ≥ 10.000 activo; > 12.500 muy activo); los enfoques de **mejora incremental desde la línea
    base** parecen prometedores; 10.000 puede ser insostenible en mayores o enfermedad crónica.
  - Metas autoimpuestas vs prescritas: no se pudo verificar literatura específica en esta sesión;
    la recomendación de línea base + incremento se apoya en Tudor-Locke 2004 y en el efecto de
    "reference value" neutro de Harkin (comparar con el pasado funciona igual que con una meta).
- **Limitaciones metodológicas:** Cohortes observacionales (Paluch); categorías de pasos
  preliminares; sin wearables, los pasos deben introducirse a mano.
- **Calidad y consistencia de la evidencia:** Alta para las guías OMS; Moderada para la relación
  dosis-respuesta pasos–mortalidad; Baja para metas óptimas de pasos.
- **Poblaciones estudiadas:** Adultos y mayores de cohortes internacionales.
- **Riesgos / efectos adversos:** Etkin 2016 (coste hedónico de medir); Simpson & Mazzeo 2017
  (fitness tracking y sintomatología alimentaria); prescripción de volúmenes "extremos".
- **Frecuencia o dosis estudiada:** Diaria (pasos); semanal (minutos OMS).
- **Aplicabilidad a una app offline sin IA:** Métricas de proceso: sesiones/semana, minutos/semana
  (comparable al marco OMS), pasos si el usuario los conoce. Meta por defecto = línea base de 1–2
  semanas + incremento modesto elegido por el usuario; nunca 10.000 por defecto.
- **Confianza en su utilidad:** Alta (métricas de proceso), Media (pasos).
- **Decisión sugerida:** Incluir.

---

## 12. Reglas de diseño para un motor genérico de métricas

Derivadas de las secciones anteriores. Cada regla cita su base.

**12.1 Tipos de métrica**
1. `check` (hecho / no hecho): hábitos y conductas discretas. Base: Harkin (monitorizar conducta
   cambia conducta).
2. `count` (entero por periodo): sesiones, vasos de agua, páginas. Proceso.
3. `duration` (minutos): ejercicio, lectura, sueño. Comparable a OMS 2020.
4. `quantity` (decimal con unidad): peso, kilómetros. Puede ser **sensible** (ver 12.5).
5. `scale` (ordinal 1–5 o 0–10 con anclas verbales): ánimo, energía, estrés, hambre/saciedad,
   calidad de sueño. Base: Elo 2003; máximo 3–4 por registro (Eisele 2022).
6. `time` (hora del día): acostarse, levantarse; sirve para calcular regularidad (Phillips 2017,
   Windred 2024).
7. `tag`/`text` (cualitativo): contexto y disparadores (Choe 2014). Toda métrica admite nota.

**12.2 Dirección**
- `up`, `down`, `maintain` (banda alrededor de un valor), `range` (mín–máx), y `observe` (sin
  dirección: sólo mirar). `observe` es el valor por defecto para métricas sensibles y para
  cualquier `scale`: el ánimo no se "optimiza".
- Para `quantity` de peso, la dirección nunca se propone; la elige el usuario, y `maintain` y
  `observe` se ofrecen antes que `down`.

**12.3 Tendencia frente a puntos crudos**
- Mostrar siempre los puntos crudos en gris y la tendencia en primer plano; nunca el delta
  respecto al registro anterior (Orsama, Racette, Turicchi: el ruido día a día y el ciclo semanal
  son mayores que la señal).
- Suavizado por tipo: para métricas diarias ruidosas (`quantity` peso) EWMA con α = 0,1 (heurística
  de Hacker's Diet, no académica; Turicchi 2020 confirma que EWMA ajusta bien) **o** media móvil de
  7 días; la ventana de 7 anula el ciclo semanal por construcción. Para `count`/`duration` de
  hábitos, agregar por semana (total o días cumplidos / 7). Para `scale`, media móvil de 7 días y
  mostrar también la dispersión (mín–máx de la semana).
- N mínimo antes de dibujar tendencia: peso diario ≥ 7 registros que cubran ≥ 7 días naturales;
  peso semanal ≥ 4 registros; `scale` ≥ 5 registros; hábitos ≥ 2 semanas completas. Antes de eso,
  mostrar los puntos y el texto: *"Todavía no hay datos suficientes para ver una tendencia
  (3 de 7 registros). Las variaciones de un día a otro son normales."*
- No imputar valores faltantes para calcular variabilidad (Turicchi 2020); mostrar huecos como
  huecos.
- Comparaciones por defecto: "esta semana vs la anterior" y "últimas 4 semanas"; nunca "hoy vs
  ayer". Comparar con el propio pasado es tan eficaz como comparar con la meta (Harkin).
- Sin colores semánticos rojo/verde en métricas sensibles; un solo color neutro. En hábitos de
  proceso sí puede marcarse "hecho".

**12.4 Frecuencia por defecto (sugerida, nunca forzada)**
| Tipo | Sugerencia por defecto | Base |
|---|---|---|
| `check`/`count` hábito | diaria, registro en el momento | Harkin, Helsel (lo que importa es registrar) |
| `scale` ánimo/energía/estrés | 1 vez/día, ≤ 3 ítems, < 2 min | Eisele, Vachon |
| sueño (`time` + `scale`) | cada mañana, 5–7 campos (CSD Core) | Carney 2012 |
| peso | **semanal**, mismo día, mañana, tras orinar, antes de desayunar, misma báscula; diaria sólo si el usuario lo elige | Madigan (diario ≈ semanal); Orsama/Racette (protocolo matutino) |
| alimentación | cualitativo; modo abreviado 3–4 días/semana con 1 de fin de semana | Krukowski 2022, Helsel 2007 |
| ejercicio | sesiones/min por semana; pasos si se conocen; meta = línea base de 1–2 semanas + incremento | OMS 2020, Tudor-Locke 2004 |
- Los recordatorios son opt-in, máximo uno al día por defecto, y se silencian solos tras 7 días sin
  respuesta preguntando si se quiere pausar la métrica.

**12.5 Métricas sensibles: opt-in con aviso neutro**
- Peso, alimentación/calorías, medidas corporales y cualquier métrica que el usuario etiquete como
  sensible: nunca aparecen en plantillas por defecto ni en el asistente inicial; se activan desde
  un menú.
- La app **no ofrece contador de calorías** ni objetivos calóricos (sin base de datos fiable
  offline; asociación con sintomatología alimentaria en muestras clínicas: Levinson 2017,
  Linardon 2019, Simpson & Mazzeo 2017).
- Texto de aviso al activar (neutro, sin alarmismo): *"Registrar el peso ayuda a algunas personas a
  mantener sus hábitos y a otras les genera preocupación o malestar. Puedes activarlo y
  desactivarlo cuando quieras. Si notas que pensar en el número te ocupa más de lo que te ayuda,
  desactívalo; tus notas y reflexiones se conservan."* Si el usuario indica edad < 18, no se ofrece
  el autopesaje (Pacanowski 2015, Quick 2012).
- Para sueño: nunca mostrar una "puntuación de sueño" ni fases; sólo horas, regularidad y la
  valoración subjetiva (Baron 2017; Dietch 2021 muestra que el diario sobreestima, pero el timing
  es fiable).

**12.6 Derecho a parar sin perder nada**
- Estados de métrica: `activa`, `pausada`, `archivada`. Pausar o archivar nunca borra datos ni
  notas; las reflexiones escritas en el diario que referencian la métrica siguen siendo legibles.
  Base: Epstein 2015/2016 (lapsar y retomar es normal; diseñar para la vida después del tracking).
- No existe el concepto de "racha rota" para métricas sensibles ni para `scale`; en hábitos de
  proceso puede mostrarse "días cumplidos esta semana" sin resetear nada.
- Al archivar, la app ofrece una pregunta opcional de cierre: *"¿Qué has aprendido registrando
  esto?"* y guarda la respuesta como entrada del diario.
- Límite blando: al activar la sexta métrica, la app recuerda que registrar demasiadas cosas es la
  causa más citada de abandono (Choe 2014, Lazar 2015) y sugiere pausar alguna.

**12.7 Redacción**
- Describir, no juzgar: "subió 0,4 kg respecto a la media de la semana pasada", no "has
  engordado"; "4 de 7 días", no "has fallado 3 días".
- Evitar: "fracaso", "fallo", "racha rota", "bueno/malo", "deberías", "ideal", "objetivo
  calórico", "quemar", "castigo", "permitido".
- Preferir: "registro", "tendencia", "esta semana", "variación normal", "pausar", "retomar".
- Toda tendencia de peso lleva una línea fija: *"El peso varía de un día a otro por agua y
  digestión; la línea muestra la tendencia, no el valor real de hoy."*
- Nunca convertir pendientes de peso en calorías ni en fechas estimadas de llegada a una meta.
- Las sugerencias de frecuencia se formulan como opción ("Muchas personas lo registran una vez por
  semana. ¿Con qué frecuencia quieres hacerlo tú?"), nunca como norma.
- Cualquier texto sobre sueño o alimentación remite a profesional cuando hay malestar persistente;
  la app no diagnostica ni prescribe restricción de sueño ni dietas.

---

## Referencias

[Harkin et al., 2016] Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence. Psychological Bulletin 142(2):198–229. DOI: 10.1037/bul0000025 | URL: https://eprints.whiterose.ac.uk/id/eprint/87431/
Verificado: sí (texto completo leído, PDF).

[Michie et al., 2009] Effective techniques in healthy eating and physical activity interventions: a meta-regression. Health Psychology 28(6):690–701. PMID: 19916637
Verificado: sí (leído el resumen).

[Michie et al., 2013] The Behavior Change Technique Taxonomy (v1) of 93 hierarchically clustered techniques. Annals of Behavioral Medicine 46(1):81–95. DOI: 10.1007/s12160-013-9486-6 | PMID: 23512568
Verificado: parcialmente (ficha bibliográfica; resumen no leído).

[Burke, Wang & Sevick, 2011] Self-monitoring in weight loss: a systematic review of the literature. J Am Diet Assoc 111(1):92–102. DOI: 10.1016/j.jada.2010.10.008 | PMID: 21185970 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3268700/
Verificado: sí (texto completo leído).

[Orsama et al., 2014] Weight rhythms: weight increases during weekends and decreases during weekdays. Obesity Facts 7(1):36–47. DOI: 10.1159/000356147 | PMID: 24504358
Verificado: sí (leído el resumen).

[Racette et al., 2008] Influence of weekend lifestyle patterns on body weight. Obesity 16(8):1826–1830. DOI: 10.1038/oby.2008.320 | PMID: 18551108
Verificado: sí (leído el resumen vía Europe PMC).

[Turicchi et al., 2020a] Weekly, seasonal and holiday body weight fluctuation patterns among individuals engaged in a European multi-centre behavioural weight loss maintenance intervention. PLoS ONE 15(4):e0232152. DOI: 10.1371/journal.pone.0232152
Verificado: sí (texto completo leído).

[Turicchi et al., 2020b] Data imputation and body weight variability calculation using linear and nonlinear methods in data collected from digital smart scales: simulation and validation study. JMIR mHealth uHealth 8(9):e17977. DOI: 10.2196/17977 | PMID: 32915155
Verificado: sí (leído el resumen).

[Bhutani et al., 2017] Composition of two-week change in body weight under unrestricted free-living conditions. Physiological Reports 5(13):e13336. DOI: 10.14814/phy2.13336 | PMID: 28676555
Verificado: sí (leído el resumen).

[Walker, s.f.] The Hacker's Diet, cap. "Signal and Noise". URL: https://www.fourmilab.ch/hackdiet/e4/signalnoise.html
Verificado: sí (texto leído). Fuente NO académica.

[Madigan et al., 2015] Is self-weighing an effective tool for weight loss: a systematic literature review and meta-analysis. Int J Behav Nutr Phys Act 12:104. DOI: 10.1186/s12966-015-0267-4 | PMID: 26293454 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC4546162/
Verificado: sí (texto completo leído; existe erratum 2016).

[Zheng et al., 2015] Self-weighing in weight management: a systematic literature review. Obesity 23(2):256–265. PMID: 25521523
Verificado: sí (leído el resumen).

[Shieh et al., 2016] Self-weighing in weight management interventions: a systematic review of literature. Obesity Research & Clinical Practice 10(5):493–519. DOI: 10.1016/j.orcp.2016.01.004 | PMID: 26896865
Verificado: sí (leído el resumen vía Europe PMC).

[Steinberg et al., 2014] Daily self-weighing and adverse psychological outcomes: a randomized controlled trial. Am J Prev Med 46(1):24–29. DOI: 10.1016/j.amepre.2013.08.006 | PMID: 24355668
Verificado: sí (leído el resumen vía Europe PMC).

[Pacanowski & Levitsky, 2015] Frequent self-weighing and visual feedback for weight loss in overweight adults. Journal of Obesity 2015:763680. DOI: 10.1155/2015/763680 | PMID: 26064677
Verificado: sí (leído el resumen).

[Jospe et al., 2017] The effect of different types of monitoring strategies on weight loss: a randomized controlled trial. Obesity 25(9):1490–1498. DOI: 10.1002/oby.21898 | PMID: 28703448
Verificado: sí (leído el resumen vía Europe PMC).

[Pacanowski, Linde & Neumark-Sztainer, 2015] Self-weighing: helpful or harmful for psychological well-being? A review of the literature. Current Obesity Reports 4(1):65–72. DOI: 10.1007/s13679-015-0142-2 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC4729441/
Verificado: sí (leído el resumen).

[Pacanowski et al., 2015] Self-weighing throughout adolescence and young adulthood: implications for well-being. J Nutr Educ Behav 47(6):506–515. DOI: 10.1016/j.jneb.2015.08.008 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC4644499/
Verificado: sí (texto completo leído).

[Quick et al., 2012] Self-weighing behaviors in young adults: tipping the scale toward unhealthy eating behaviors? J Adolesc Health 51(5):468–474. DOI: 10.1016/j.jadohealth.2012.02.008 | PMID: 23084168
Verificado: sí (leído el resumen).

[Rohde 2018] Citado en el encargo. NO verificado: no se localizó ningún estudio de Rohde 2018 sobre autopesaje; los hallazgos de Project EAT corresponden a Pacanowski 2015 y Quick 2012.

[Eisele et al., 2022] The effects of sampling frequency and questionnaire length on perceived burden, compliance, and careless responding in experience sampling data in a student population. Assessment 29(2):136–151. DOI: 10.1177/1073191120957102
Verificado: sí (leído el resumen).

[Vachon et al., 2019] Compliance and retention with the experience sampling method over the continuum of severe mental disorders: meta-analysis and recommendations. J Med Internet Res 21(12):e14475. DOI: 10.2196/14475 | PMID: 31808748
Verificado: sí (leído el resumen).

[Lazar et al., 2015] Why we use and abandon smart devices. Proc. UbiComp 2015:635–646. DOI: 10.1145/2750858.2804288 | URL: https://thatlab.umd.edu/papers/2015_p635-lazar.pdf
Verificado: sí (leído el resumen).

[Epstein et al., 2015] A lived informatics model of personal informatics. Proc. UbiComp 2015. DOI: 10.1145/2750858.2804250
Verificado: sí (leído el resumen vía Europe PMC).

[Epstein et al., 2016] Beyond abandonment to next steps: understanding and designing for life after personal informatics tool use. Proc. CHI 2016. DOI: 10.1145/2858036.2858045
Verificado: sí (leído el resumen).

[Clawson et al., 2015] No longer wearing: investigating the abandonment of personal health-tracking technologies on Craigslist. Proc. UbiComp 2015. DOI: 10.1145/2750858.2807554
Verificado: parcialmente (ficha bibliográfica; resumen no accesible).

[Li, Dey & Forlizzi, 2010] A stage-based model of personal informatics systems. Proc. CHI 2010:557–566. URL: https://ianli.owlstown.net/publications/17
Verificado: sí (leído el resumen).

[Choe et al., 2014] Understanding quantified-selfers' practices in collecting and exploring personal data. Proc. CHI 2014:1143–1152. DOI: 10.1145/2556288.2557372
Verificado: sí (leído el resumen).

[Korotitsch & Nelson-Gray, 1999] An overview of self-monitoring research in assessment and treatment. Psychological Assessment 11(4):415–425. DOI: 10.1037/1040-3590.11.4.415
Verificado: parcialmente (ficha bibliográfica; resumen no accesible). No se citan cifras.

[Elo, Leppänen & Jahkola, 2003] Validity of a single-item measure of stress symptoms. Scand J Work Environ Health 29(6):444–451. DOI: 10.5271/sjweh.752
Verificado: sí (leído el resumen).

[Allen, Iliescu & Greiff, 2022] Single item measures in psychological science: a call to action. European Journal of Psychological Assessment. DOI: 10.1027/1015-5759/a000699
Verificado: parcialmente (ficha bibliográfica; texto no accesible).

[Hasson & Arnetz, 2005] Validation and findings comparing VAS vs. Likert scales for psychosocial measurements. NO verificado (no se pudo buscar); no se citan hallazgos.

[Baron et al., 2017] Orthosomnia: are some patients taking the quantified self too far? J Clin Sleep Med 13(2):351–354. DOI: 10.5664/jcsm.6472 | PMID: 27855740 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5263088/
Verificado: sí (texto completo leído).

[Etkin, 2016] The hidden cost of personal quantification. Journal of Consumer Research 42(6):967–984. DOI: 10.1093/jcr/ucv095
Verificado: sí (leído el resumen).

[Simpson & Mazzeo, 2017] Calorie counting and fitness tracking technology: associations with eating disorder symptomatology. Eating Behaviors 26:89–92. DOI: 10.1016/j.eatbeh.2017.02.002 | PMID: 28214452
Verificado: sí (leído el resumen).

[Levinson, Fewell & Brosof, 2017] My Fitness Pal calorie tracker usage in the eating disorders. Eating Behaviors 27:14–16. PMID: 28843591 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5700836/
Verificado: sí (texto completo leído).

[Linardon & Messer, 2019] My fitness pal usage in men: associations with eating disorder symptoms and psychosocial impairment. Eating Behaviors 33:13–17. PMID: 30772765
Verificado: sí (leído el resumen).

[Hahn et al., 2021] Introducing dietary self-monitoring to undergraduate women via a calorie counting app has no effect on mental health or health behaviors: results from a randomized controlled trial. J Acad Nutr Diet 121(12):2377–2388. DOI: 10.1016/j.jand.2021.06.311 | PMID: 34427188
Verificado: sí (leído el resumen vía Europe PMC).

[Hollis et al., 2008] Weight loss during the intensive intervention phase of the weight-loss maintenance trial. Am J Prev Med 35(2):118–126. DOI: 10.1016/j.amepre.2008.04.013 | PMID: 18617080
Verificado: sí (leído el resumen).

[Helsel, Jakicic & Otto, 2007] Comparison of techniques for self-monitoring eating and exercise behaviors on weight loss in a correspondence-based intervention. J Am Diet Assoc 107(10):1807–1810. DOI: 10.1016/j.jada.2007.07.014 | PMID: 17904942
Verificado: sí (leído el resumen vía Europe PMC).

[Krukowski et al., 2022] Expert opinions on reducing dietary self-monitoring burden and maintaining efficacy in weight loss programs: a Delphi study. Obesity Science & Practice 8(4):401–410. DOI: 10.1002/osp4.586 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC9358747/
Verificado: sí (texto completo leído).

[Boushey et al., 2017] New mobile methods for dietary assessment: review of image-assisted and image-based dietary assessment methods. Proc Nutr Soc 76(3):283–294. DOI: 10.1017/S0029665116002913 | PMID: 27938425
Verificado: sí (leído el resumen).

[Payne 2018 "abbreviated dietary self-monitoring"; Hales 2017 "Trading pounds for points"] Citados en el encargo. NO verificado: no se localizaron; no se citan.

[Carney et al., 2012] The consensus sleep diary: standardizing prospective sleep self-monitoring. Sleep 35(2):287–302. DOI: 10.5665/sleep.1642 | PMID: 22294820
Verificado: sí (leído el resumen).

[Dietch & Taylor, 2021] Evaluation of the Consensus Sleep Diary in a community sample: comparison with single-channel electroencephalography, actigraphy, and retrospective questionnaire. J Clin Sleep Med 17(7):1389–1399. DOI: 10.5664/jcsm.9200 | URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC8314633/
Verificado: sí (texto completo leído).

[Phillips et al., 2017] Irregular sleep/wake patterns are associated with poorer academic performance and delayed circadian and sleep/wake timing. Scientific Reports 7:3216. DOI: 10.1038/s41598-017-03171-4
Verificado: sí (leído el resumen).

[Windred et al., 2024] Sleep regularity is a stronger predictor of mortality risk than sleep duration: a prospective cohort study. Sleep 47(1):zsad253. DOI: 10.1093/sleep/zsad253 | URL: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10782501/
Verificado: sí (leído el resumen).

[Ho et al., 2015] Self-help cognitive-behavioral therapy for insomnia: a meta-analysis of randomized controlled trials. Sleep Medicine Reviews 19:17–28. DOI: 10.1016/j.smrv.2014.06.010 | PMID: 25104471
Verificado: sí (leído el resumen vía Europe PMC).

[Edinger et al., 2021] Behavioral and psychological treatments for chronic insomnia disorder in adults: an American Academy of Sleep Medicine clinical practice guideline. J Clin Sleep Med 17(2). DOI: 10.5664/jcsm.8986 | PMID: 33164742
Verificado: sí (leído el resumen).

[Riemann et al., 2017] European guideline for the diagnosis and treatment of insomnia. J Sleep Res 26(6):675–700. DOI: 10.1111/jsr.12594 | PMID: 28875581
Verificado: sí (leído el resumen vía Europe PMC).

[Kyle et al., 2014] Sleep restriction therapy for insomnia is associated with reduced objective total sleep time, increased daytime somnolence, and objectively impaired vigilance. Sleep 37(2):229–237. DOI: 10.5665/sleep.3386
Verificado: sí (leído el resumen).

[Bootzin, 1972] Stimulus control treatment for insomnia. NO verificado en esta sesión; se cita sólo como origen histórico del componente recogido en Edinger 2021.

[Bull et al., 2020] World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med 54(24):1451–1462. DOI: 10.1136/bjsports-2020-102955 | PMID: 33239350
Verificado: sí (leído el resumen).

[Paluch et al., 2022] Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health 7(3):e219–e228. DOI: 10.1016/S2468-2667(21)00302-9
Verificado: sí (leído el resumen).

[Tudor-Locke & Bassett, 2004] How many steps/day are enough? Preliminary pedometer indices for public health. Sports Medicine 34(1):1–8. DOI: 10.2165/00007256-200434010-00001 | PMID: 14715035
Verificado: sí (leído el resumen vía Europe PMC).

[NICE CG189] Obesity: identification, assessment and management. URL: https://www.nice.org.uk/guidance/cg189
NO verificado (acceso denegado, 403); no se afirma nada sobre su contenido. Tampoco se consultó la posición de la Academy of Nutrition and Dietetics.
