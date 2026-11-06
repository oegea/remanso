# Remanso — Revisión de seguridad clínica

Documento de seguridad del producto. Fecha: 2026-11-06.

**Alcance.** Fija los límites de Remanso (aplicación TUI en Rust, offline, sin IA, sin red, un único usuario adulto, en español) desde el punto de vista del daño psicológico evitable. Sintetiza únicamente las seis notas de investigación del proyecto (`docs/research/notes/A`–`F`); no añade referencias. Cada cita aparece como [Autor, Año]; su estado de verificación, tal como lo registró la nota de origen, se resume al final. De las fuentes verificadas sólo *parcialmente* no se toman cifras.

Las secciones 1–3 definen qué hace la aplicación, qué riesgos asume y qué queda fuera; 4–5 fijan reglas vinculantes de redacción y producto; 6 es la lista de comprobación para técnicas nuevas; 7 reconoce las lagunas del documento.

---

## 1. Qué es y qué no es la aplicación

### 1.1 Qué es

Un cuaderno personal: diario de texto libre, notas, tareas, objetivos y hábitos, con un módulo opcional de "cambio conductual" que ofrece técnicas de autoayuda con cierta base empírica (planes si-entonces, registro de conducta, revisión periódica, manejo de lapsos, escritura reflexiva, protocolo de "episodio de impulso"). Todo se guarda localmente, en formatos legibles; nada sale del dispositivo.

Su núcleo es el "paquete de autorregulación": meta de conducta específica, registro de baja fricción, revisión y ajuste [Michie et al., 2009; Harkin et al., 2016; Samdal et al., 2017]. Los efectos son pequeños o moderados (d+ = 0,40 en Harkin; d = 0,34 en [Epton et al., 2017]) y se midieron casi siempre en intervenciones acompañadas, no en autoayuda pura.

### 1.2 Qué no es

- **No es un dispositivo médico ni un servicio sanitario.** No diagnostica, no trata, no criba, no mide gravedad.
- **No sustituye a profesionales.** La autoayuda no guiada es inferior a los formatos con contacto humano en depresión moderada o grave (SMD 0,34–0,59 a favor de los guiados [Cuijpers et al., 2019]; con PHQ-9 > 9 la guía aporta más [Karyotaki et al., 2021]); la TCC autoguiada para procrastinación mostró deterioro en el seguimiento [Rozental et al., 2018b]. El riesgo (nota B) es la "falsa sensación de tratamiento en quien necesita atención clínica".
- **No evalúa el contenido del usuario.** No analiza texto ni genera alertas a partir de lo escrito.
- **No es una herramienta de recuperación de adicciones ni de trastornos alimentarios** (notas A §12 y B).
- **No optimiza "engagement".** Que el uso baje es la norma, no un fallo [Eysenbach, 2005; Baumel et al., 2019; Meyerowitz-Katz et al., 2020].

### 1.3 Aviso al activar el módulo de objetivos / cambio conductual

Se muestra **una sola vez**, al activar el módulo, con una tecla para continuar; queda accesible en Ayuda. Texto exacto:

> Remanso es un cuaderno personal de notas, objetivos y hábitos. No es un servicio sanitario: no diagnostica, no trata y no sustituye a un profesional de la salud.
>
> Las técnicas de este módulo proceden de la investigación en autoayuda. Sus efectos suelen ser modestos y varían mucho de una persona a otra. Todo es opcional y se puede desactivar en cualquier momento sin perder lo escrito.
>
> Si lo que quieres cambiar afecta a tu salud, o te preocupa, un profesional puede acompañarte mejor que esta aplicación.

---

## 2. Riesgos psicológicos por funcionalidad

Cada riesgo lleva la evidencia de las notas y la mitigación que el producto implementa.

### 2.1 Registro compulsivo

**Riesgo.** Que registrar se convierta en fin en sí mismo: perfeccionismo sobre el dato, ansiedad por el hueco, abandono por sobrecarga.

**Evidencia.** Registrar demasiado y sin contexto es el error más repetido en el *quantified self* [Choe et al., 2014]; el abandono por mantenimiento inasumible es frecuente [Lazar et al., 2015]; la "orthosomnia" describe a quien persigue la puntuación del dispositivo en vez de dormir [Baron et al., 2017]. Los cuestionarios largos y frecuentes degradan los datos y el cumplimiento [Eisele et al., 2022; Vachon et al., 2019].

**Mitigación implementada.** Registro de ≤ 2 minutos; máximo 3–4 ítems subjetivos por registro; una sola sesión guiada al día; al activar la sexta métrica la app recuerda que registrar demasiado es la causa más citada de abandono; estados `pausada`/`archivada` sin pérdida de datos; ninguna puntuación agregada de sueño, ánimo ni "disciplina".

### 2.2 Exigencia de cumplimiento diario

**Riesgo.** Presuponer que la conducta debe ocurrir cada día y tratar la ausencia como incumplimiento.

**Evidencia.** Saltarse una oportunidad no afectó materialmente a la formación del hábito [Lally et al., 2010, *parcialmente*]; pesarse a diario no superó a hacerlo menos (−3,6 vs −3,3 kg, p = 0,57) [Madigan et al., 2015]; los SMS semanales funcionaron y los diarios no [Pop-Eleches et al., 2011]; la frecuencia diaria no modificó el efecto de los recordatorios [Thakkar et al., 2016]. Escribir en el diario cada día no tiene base de eficacia y aumenta la carga (nota D).

**Mitigación implementada.** `frecuencia_objetivo` es "N veces por ventana" (p. ej., 4/semana) y "cada día" nunca es el valor por defecto; revisión de metas semanal; peso semanal si se activa; el diario se abre vacío y sin contador de días.

### 2.3 Rachas como castigo

**Riesgo.** Que un día sin registro borre el valor acumulado, se viva como fracaso personal y dispare el abandono.

**Evidencia.** Con conducta real idéntica, mostrar una racha rota reduce la continuación frente a una intacta (53 % vs 78 % en idiomas); si la rotura se autoatribuye continúan el 29 %, frente al 42 % con causa externa; permitir reparar recupera gran parte del efecto (85 % vs 69 %) [Silverman & Barasch, 2023]. Las rachas crearon dependencia de la app y, ante disrupciones vitales, abandono de la conducta [Renfree et al., 2016]. La culpa tras un lapso favorece la recaída completa (efecto de violación de la abstinencia) [Witkiewitz & Marlatt, 2004; Larimer et al., 1999].

**Mitigación implementada.** Métrica principal: consistencia en ventana ("22 de los últimos 30 días"); el contador de días consecutivos no se muestra por defecto. Si el usuario lo activa, es tolerante: días de descanso planificados, reparación retroactiva de 1–2 días, sin alerta de rotura, causa registrable, "mejor racha histórica" junto a la actual. "Racha rota", "vuelta a cero" y "has perdido" están prohibidas (§4).

### 2.4 Obsesión con el peso y métricas alimentarias

**Riesgo.** Que registrar peso, calorías o ejercicio alimente restricción, atracón, preocupación corporal o ánimo bajo en personas vulnerables que la app no puede detectar.

**Evidencia.** De 105 pacientes con trastorno alimentario, el 74,3 % usaba una app de calorías y el 73,1 % de ellos creía que había contribuido al trastorno [Levinson, Fewell & Brosof, 2017]; el seguimiento de fitness y los contadores de calorías se asocian a sintomatología alimentaria [Simpson & Mazzeo, 2017; Linardon & Messer, 2019]. En mujeres jóvenes, más autopesaje se asoció a más preocupación por el peso, síntomas depresivos y menor autoestima a 10 años [Pacanowski et al., 2015; Quick et al., 2012; Pacanowski, Linde & Neumark-Sztainer, 2015]. Los RCT favorables reclutan adultos con sobrepeso motivados y excluyen trastornos alimentarios [Steinberg et al., 2014; Madigan et al., 2015]; el único RCT con app de calorías fue nulo, pero en mujeres **de bajo riesgo** y a un mes [Hahn et al., 2021]. Monitorizar peso y dieta tiene el efecto más pequeño de los dominios eficaces (d+ = 0,30 y 0,23) [Harkin et al., 2016]; la autoayuda para trastornos alimentarios tiene efectos pequeños y ninguna evidencia en anorexia [Linardon et al., 2025; O'Mara et al., 2023]. La nota F concluye que no se puede cribar con fiabilidad quién está en riesgo.

**Mitigación implementada.** No existe contador de calorías ni objetivos calóricos. Peso, alimentación y medidas corporales nunca aparecen en plantillas ni en el asistente inicial; se activan desde un menú tras el aviso de §5.6. Para el peso, la dirección `down` no se propone nunca; `observe` y `maintain` se ofrecen antes. Se muestra sólo la tendencia suavizada (media móvil de 7 días o EWMA), nunca el delta respecto al registro anterior, sin colores de juicio y con la línea fija "El peso varía de un día a otro por agua y digestión; la línea muestra la tendencia, no el valor real de hoy". Nunca se convierten pendientes en calorías ni en fechas de llegada. Con edad declarada < 18, el autopesaje no se ofrece.

### 2.5 Convertir toda conducta en objetivo cuantificado

**Riesgo.** Que medir lo que se hacía por placer lo convierta en trabajo, y que las metas numéricas estrechen el foco o se vuelvan techo.

**Evidencia.** Medir una actividad placentera aumenta la cantidad pero reduce el disfrute, la motivación intrínseca y la continuidad [Etkin, 2016]. Las recompensas tangibles contingentes reducen la motivación intrínseca (d = −0,28 a −0,40) [Deci, Koestner & Ryan, 1999]. Monitorizar el resultado mueve el resultado pero no la conducta, y viceversa [Harkin et al., 2016]; el foco en el resultado se asoció a más desinhibición tras los lapsos [Freund & Hennecke, 2012]; las metas demasiado específicas pueden descuidar lo no medido [Ordóñez et al., 2009, *parcialmente*].

**Mitigación implementada.** Tipo de meta `proceso` por defecto; el indicador de resultado es opcional y "se observa, no se puntúa". Dirección `observe` por defecto para toda escala subjetiva: el ánimo no se optimiza. "Modo ligero" (sólo sí/no, o "cómo me sentí") para actividades placenteras. Sin puntos, niveles ni insignias; el reconocimiento es texto descriptivo ("4 semanas con ≥ 3 sesiones"). El diario no tiene métricas salvo que el usuario las cree.

### 2.6 Refuerzo de la culpa

**Riesgo.** Que lenguaje imperativo, contadores negativos o avisos insistentes generen culpa, vergüenza y reactancia, los afectos que alimentan la evitación.

**Evidencia.** El afecto negativo alimenta la procrastinación y perdonarse por haber procrastinado predijo menos procrastinación posterior [Wohl, Pychyl & Bennett, 2010; Sirois, 2014]. Los mensajes que amenazan la libertad generan reactancia que anula su efecto [Dillard & Shen, 2005; Rains, 2013]. Las apelaciones al miedo y a la culpa persuaden tras un único mensaje [Tannenbaum et al., 2015; Xu & Guo, 2018], pero no miden conducta repetida ni bienestar, y la motivación controlada no predice mantenimiento [Ntoumanis et al., 2021]. La autocompasión tras un desliz se asocia a conductas de salud [Phillips & Hine, 2021].

**Mitigación implementada.** Las reglas de §4 son obligatorias. Al reabrir tras varios días nada se marca como "fallido"; las tareas con fecha pasada aparecen como "pendientes". Pantalla de desliz con pregunta de aprendizaje, sin reinicio punitivo. El flujo "tarea aplazada 3 veces" pregunta por la tarea, no por la persona.

### 2.7 Rumiación e introspección excesiva

**Riesgo.** Que el diario se convierta en rumiación por escrito y que la escritura expresiva se use para procesar traumas sin apoyo.

**Evidencia.** La escritura expresiva produce un aumento fiable de malestar inmediato (d = 0,84) [Smyth, 1998]; el beneficio es pequeño (r ≈ 0,075) y retardado [Frattaroli, 2006; Guo, 2023], y nulo sobre depresión en adultos sanos [Reinhold et al., 2018]. En personas poco expresivas la ansiedad **aumentó** a los 3 meses [Niles et al., 2014]; escribir sólo sobre emociones se asoció a más síntomas que escribir emociones y cogniciones [Ullrich & Lutgendorf, 2002]; analizar por escrito experiencias positivas redujo la satisfacción vital [Lyubomirsky, Sousa & Dickerhoof, 2006]. La rumiación predice el inicio de la depresión [Nolen-Hoeksema et al., 2008]; las preguntas "¿por qué?" empeoran la resolución de problemas en personas con depresión y las "¿cómo?" la mejoran [Watkins, 2008]. La exposición escrita a traumas funciona con terapeuta [Sloan et al., 2018]; según la nota D, personas con depresión, TEPT, duelo complicado o ideación suicida no deberían hacer escritura expresiva sobre trauma sin apoyo clínico. La meditación tiene eventos adversos (8,3 %), con precaución en trauma y psicosis [Farias et al., 2020].

**Mitigación implementada.** Escritura libre por defecto; toda plantilla es opt-in. Los prompts se redactan en registro concreto, temporal y orientado al proceso ("¿qué pasó?", "¿cómo?", "¿qué harás ahora?"), nunca "¿por qué me pasa esto?"; las plantillas sobre dificultades piden pensamientos **y** emociones y un paso pequeño; las positivas piden revivir, no analizar. La plantilla de "escritura difícil" lleva aviso ("Si estás en tratamiento o esto tiene que ver con un trauma grave, conviene hablar antes con un profesional"), temporizador visible de 15–20 min y límite de 3–4 sesiones. Respiración y "surfear el impulso" duran 1–5 min con salida libre. La app no detecta rumiación: ofrece herramientas que el usuario invoca ("¿Y ahora qué?", "Volver a lo concreto", "modo observador").

### 2.8 Dependencia de recordatorios y fatiga

**Riesgo.** Habituación, irritación y abandono por avisos repetidos; dependencia del aviso en lugar de la señal contextual que forma el hábito.

**Evidencia.** El efecto de las sugerencias y notificaciones se disipa en semanas [Klasnja et al., 2019; Bidargaddi et al., 2018]; las alarmas no accionables se aprenden a ignorar [Paine et al., 2016]; los recordatorios diarios no superaron al control [Pop-Eleches et al., 2011]. La dependencia del recordatorio es una hipótesis no verificada (nota A §13).

**Mitigación implementada.** Una TUI no interrumpe: la pantalla de inicio es el recordatorio. Las notificaciones del sistema son opt-in, una al día como máximo por defecto, con decaimiento (tras 7 días sin respuesta la app pregunta si pausar la métrica). Un aviso no se repite más de dos veces: a la tercera se ofrece el flujo de revisión. Todo aviso es accionable con una tecla. Al crear un hábito se pide una señal de contexto ("después de X" o una hora) para que no dependa del aviso.

### 2.9 Interpretar datos incompletos como problema

**Riesgo.** Leer un dato aislado o un hueco como señal de empeoramiento o de fallo.

**Evidencia.** El peso tiene un ciclo semanal de ~0,35 % (~0,3 kg) con máximo el lunes [Turicchi et al., 2020a]; ~84 % del cambio en dos semanas fue agua [Bhutani et al., 2017]; no se deben imputar datos faltantes [Turicchi et al., 2020b]. Lapsar y reanudar son fases normales del autoseguimiento [Epstein et al., 2015; 2016]. Los ítems únicos valen a nivel de grupo, no para diagnóstico individual [Elo et al., 2003].

**Mitigación implementada.** N mínimo antes de dibujar tendencias (peso diario ≥ 7 registros en ≥ 7 días; escala ≥ 5; hábitos ≥ 2 semanas); hasta entonces se muestran los puntos con el texto de §4. Los huecos se muestran como huecos, nunca como "no hecho". Comparaciones sólo "esta semana vs la anterior" y "últimas 4 semanas", nunca "hoy vs ayer". Sin correlaciones automáticas ni frases del tipo "vas peor".

### 2.10 Presentar técnicas no validadas como tratamientos

**Riesgo.** Vender folclore como ciencia o técnicas clínicas como autoayuda.

**Evidencia.** Ningún estudio documenta que un impulso dure 3–5 minutos; el craving tras señales sigue elevado ≥ 30 min [Lundahl & Greenwald, 2016] y la instrucción breve de *urge surfing* no redujo la urgencia [Bowen & Marlatt, 2009]. El "ego depletion" no se replica [Hagger et al., 2016; Vohs et al., 2021]; HALT, la "regla de los 5 minutos" y los "21/66 días" no tienen base propia (notas B, E y A). Las habilidades DBT se estudiaron casi siempre en TLP con terapeutas [Valentine et al., 2015]; frío y ejercicio intensos están contraindicados en algunas cardiopatías [Jungmann et al., 2018; Laborde et al., 2022]; la restricción de sueño requiere supervisión [Kyle et al., 2014].

**Mitigación implementada.** El temporizador es "espera activa" de 10 min (5–20) con contenido, y el texto nunca promete que el deseo desaparezca ("puede subir y bajar; tu tarea es mirarlo, no obedecerlo"). Sobre hábitos se muestra siempre rango e incertidumbre ("la mayoría tarda entre 2 y 3 meses, con un rango muy amplio; un día perdido no estropea el proceso"). "Empezar 5 min" y Pomodoro se etiquetan como experimentos personales; frío y ejercicio intensos llevan aviso y variantes suaves; no se implementa restricción de sueño. La interfaz dice "ejercicio", "práctica" o "experimento", nunca "tratamiento", "terapia" o "curar".

---

### 2.11 Meditación: experiencias desagradables

**Riesgo.** Meditar no es inocuo para todo el mundo. La revisión sistemática de Farias et al.
(2020; 83 estudios, N = 6.703) estima un 8,3 % de eventos adversos (3,7 % en estudios
experimentales, 33 % en observacionales), sobre todo ansiedad, ánimo bajo y «anomalías
cognitivas»; Lindahl et al. (2017) documentaron entre ellas cambios en la sensación de uno
mismo, irrealidad y despersonalización, también en personas sin historial previo y en
prácticas breves. Las guías clínicas recomiendan cautela con historial de trauma o de
psicosis.

**Regla.** (1) Sesiones cortas por defecto (5–20 min) y siempre interrumpibles. (2) Al
terminar, además de «cómo te sientes», una pregunta explícita y neutra sobre si hubo algo
desagradable (ansiedad, mareo, irrealidad, distancia de uno mismo), que actúa como bandera
en el diario. (3) Si se marca, un texto que normaliza («le pasa a bastante gente, no dice nada
malo de ti»), desaconseja obligarse y ofrece acortar, dejarlo un tiempo o dejarlo del todo;
si se repite en las últimas sesiones, recomienda parar y, para seguir, hacerlo con apoyo
profesional. (4) La explicación de la sección expone estos datos antes de la primera sesión.
(5) Nunca se puntúa ni se compara; no hay rachas ni objetivos de minutos.

**Dónde.** `web/src/screens/Meditate.tsx` (formulario final), `web/src/domain/meditation.ts`
(`unpleasantAmongLast`), textos en `web/src/text/help.ts` (`MED_*`).

## 3. Conductas y situaciones fuera del alcance

### 3.1 Qué queda fuera y por qué

| Situación | Por qué una app de autoayuda no basta | Fuente |
|---|---|---|
| **Dependencia de alcohol o sedantes** | Retirada desde ~6 h tras el cese; convulsiones a las 6–48 h; *delirium tremens* a las 48–72 h; complicaciones hasta en el 15 %; tratamiento médico de primera línea. Nunca sugerir "dejarlo de golpe". | [Jesse et al., 2017] |
| **Trastornos alimentarios** | Autoayuda con efectos pequeños (g 0,18–0,39), negativos en jóvenes (g = −0,17), sin evidencia en anorexia; el registro de peso/ingesta puede alimentar la restricción. | [Linardon et al., 2025; O'Mara et al., 2023; Levinson et al., 2017] |
| **Autolesión** | Los efectos existentes (MBT, regulación emocional grupal, TCC) son con profesional; evidencia incierta. | [Witt et al., 2021] |
| **Ideación suicida; otras drogas; violencia** | Fuera del alcance de cualquier herramienta sin clínico (nota B). | — |
| **Juego** | Hay programas específicos con efecto (g = 0,73) pero con abandono del 76 % y comorbilidad (deuda, ideación suicida); una app genérica deriva. | [Sagoe et al., 2021; Boumparis et al., 2023] |
| **Depresión moderada-grave (PHQ-9 > 9)** | La autoayuda no guiada es inferior a la guiada; con PHQ-9 ≤ 9 las diferencias son pequeñas, con > 9 la guía aporta más; NICE sitúa la autoayuda *guiada* como primera opción sólo en depresión menos grave. | [Karyotaki et al., 2021; Cuijpers et al., 2019; NICE, 2022, *parcialmente*] |
| **Trauma, TEPT, duelo complicado** | La exposición escrita funciona con terapeuta; la escritura expresiva autodirigida no es para traumas graves. | [Sloan et al., 2018; nota D] |
| **Restricción de sueño; frío o ejercicio intenso con cardiopatía** | Efectos secundarios reales que requieren supervisión. | [Kyle et al., 2014; Jungmann et al., 2018] |

Además, la app **no aconseja abandonar metas de salud prescritas** (medicación, tratamiento); el cierre de metas se limita a metas voluntarias, porque en personas con riesgo de depresión el desenganche se asoció a más síntomas depresivos [Barlow et al., 2017/2020; Wrosch et al., 2013].

### 3.2 Señales que la app puede reconocer sin diagnosticar

La app sólo reacciona a **elecciones explícitas del usuario en listas cerradas**:

1. **Categoría de objetivo** elegida de la lista al crear una meta o una conducta a reducir: "dejar de beber alcohol / dejar de consumir una sustancia", "controlar lo que como o mi peso", "dejar de hacerme daño", "dejar de apostar". (Hasta el 2026-11-06 existía también "dejar de tener pensamientos de muerte"; se retiró porque convertirlo en objetivo banaliza algo que necesita acompañamiento profesional. La ayuda para esa situación sigue en "Si necesitas ayuda" y en la línea del 024 que acompaña a la categoría de autolesión y a la pregunta sobre daño tras un desliz.)
2. **Etiquetas del checklist de episodio o de desliz** (señales rojas de la nota B): "temblor, sudor o ansiedad al dejar de consumir", "me he hecho daño", "conducta para compensar lo comido (vómito, laxantes, ayuno, ejercicio)", "pensamientos de muerte", "deudas o problemas legales/laborales por esto".
3. **Recuento simple**: episodios de impulso en aumento durante más de 4 semanas consecutivas (conteos semanales visibles para el usuario).
4. **Petición directa**: el usuario abre "Necesito ayuda" desde cualquier pantalla.

Ninguna señal bloquea nada ni sale del dispositivo.

### 3.3 Mensaje de derivación (no bloqueante)

Se muestra una vez por objetivo o señal; se cierra con una tecla; queda en Ayuda; el contacto es configurable en un fichero local. Texto exacto, bloque base:

> Lo que describes puede ir más allá de lo que una herramienta de autoayuda puede acompañar. Hablar con tu médico o médica de cabecera, o con un profesional de salud mental, suele ser un buen siguiente paso. Puedes seguir usando Remanso como cuaderno mientras tanto.

Línea adicional cuando la señal es **ideación suicida o autolesión**:

> Si tienes pensamientos de hacerte daño o de morir, en España puedes llamar al 024, línea de atención a la conducta suicida: gratuita, confidencial y disponible las 24 horas. Si tu vida corre peligro ahora mismo, llama al 112.

Línea adicional cuando la señal es **alcohol o sedantes**:

> Si bebes o tomas sedantes a diario y quieres dejarlo, conviene no hacerlo de golpe sin consultar: la retirada brusca puede requerir atención médica.

Línea adicional cuando la señal es **alimentación o peso**:

> Si notas restricción, atracones, conductas para compensar lo comido o una pérdida rápida de peso, es un buen momento para consultar con un profesional. Puedes desactivar las métricas corporales cuando quieras; tus notas se conservan.

**Forma de presentación.** El aviso ocupa una hoja o un bloque en línea con botón «Entendido»; nunca un aviso transitorio (*toast*) que pueda desaparecer o cortar el texto antes de leerlo (decisión 2026-11-06).

### 3.4 Uso con acompañamiento profesional

Las pruebas que motivan los avisos largos comparan autoayuda *sin* acompañamiento con autoayuda *guiada* [Cuijpers et al., 2019; Karyotaki et al., 2021]: el riesgo que mitigan es la "falsa sensación de tratamiento" en quien no tiene a nadie. Si la persona usa Remanso como cuaderno dentro de un tratamiento, ese riesgo es menor y el aviso completo, repetido, pierde función. Por eso Ajustes ofrece la opción «Uso con acompañamiento profesional», que:

- requiere una confirmación expresa (texto que explica por qué existen los avisos y una casilla: "Confirmo que uso Remanso con el acompañamiento de un profesional de la salud que conoce lo que registro aquí");
- sustituye el bloque base por una nota breve que remite a esa persona y **conserva siempre la indicación del 112**;
- mantiene, acortados, el matiz médico de la retirada de alcohol o sedantes y el de autocuidado de las métricas de alimentación o peso;
- se muestra en cada ocasión (es breve) tras una apuesta o un daño, en lugar de una sola vez;
- no toca el aviso de primer uso ni la hoja «Si necesitas ayuda», que siguen completos;
- se desactiva con un toque y se guarda en la base cifrada, no en las preferencias del navegador, porque indicar que se está en tratamiento es información sensible.

No hay ensayos sobre esta opción; es una decisión de producto coherente con la evidencia citada, no una recomendación clínica.

**Verificación del recurso 024.** Comprobado el 2026-11-05 en la página oficial del Ministerio de Sanidad (`https://www.sanidad.gob.es/linea024/home.htm`): la "Línea 024 de atención a la conducta suicida" existe, es gratuita, confidencial, disponible 24 horas los 365 días y remite al 112 en emergencia inminente. La página no nombra al operador actual. El número vive en el fichero de configuración con la fecha de verificación y debe reverificarse en cada versión mayor y antes de distribuir fuera de España. No se citan otros teléfonos porque no se verificaron.

---

## 4. Reglas de redacción

Principios: lenguaje no controlador y descriptivo [Teixeira et al., 2020; Ntoumanis et al., 2021]; feedback centrado en la tarea, no en el yo [Kluger & DeNisi, 1996, *parcialmente*]; comparar sólo con el propio pasado [Harkin et al., 2016]; no pedir supresión, porque produce rebote [Wegner et al., 1987; Abramowitz et al., 2001; Wang et al., 2020]; lapso, no fracaso [Gardner et al., 2024; Witkiewitz & Marlatt, 2004]. Única excepción admitida al veto de imperativos: la indicación de emergencia "llama al 112" (§3.3), por claridad.

| Regla | No | Sí |
|---|---|---|
| Sin lenguaje de fallo moral | "Has fallado 3 días." "Otra vez sin hacerlo." | "4 de 7 días esta semana." "Última vez: martes." |
| Sin "racha rota" ni reinicio | "Racha rota. Vuelves a cero." | "Racha anterior: 12 días. Retomar hoy cuenta." |
| Sin imperativos | "Escribe ahora." "No lo dejes." | "Pendiente: *escribir el primer párrafo* (lo planeaste para hoy a las 9). ¿Ahora, más tarde o lo revisamos?" |
| Sin signos de exclamación | "¡Lo conseguiste!" | "Hecho. 3 sesiones esta semana; la pasada, 2." |
| Sin feedback evaluativo ni comparación con otros | "Disciplina: 62 %." "Buen trabajo." "La mayoría lo hace mejor." | "22 de los últimos 30 días; la semana pasada, 5 de 7." |
| Sin culpa ni miedo generados por la app | "Si sigues así, no lo lograrás." | La razón que escribió el usuario, literal: "Tu razón: *llegar con energía a las tardes con mis hijas*." |
| Sin promesas de plazos ni de alivio | "En 21 días será un hábito." "En 5 minutos se pasa." | "La mayoría tarda entre 2 y 3 meses, con un rango muy amplio." "Puede subir y bajar; tu tarea es mirarlo, no obedecerlo." |
| Sin supresión | "No pienses en ello." "Ignóralo." | "Nota el deseo. Déjalo estar mientras haces X." |
| Sin metáfora de batería ni etiqueta de rasgo | "Tu fuerza de voluntad se agotó." "Eres procrastinador." | "Contexto marcado: dormiste menos de 6 h." "Aplazar suele indicar algo sobre la tarea, no sobre ti." |
| Sin lenguaje clínico | "Terapia", "tratar", "curar", "síntoma", "recaída". | "Ejercicio", "práctica", "experimento", "desliz", "lapso". |
| Sin juicio corporal o alimentario | "Has engordado." "Calorías permitidas." "Quemar." | "Subió 0,4 kg respecto a la media de la semana pasada; la variación semanal normal es de unos 0,3 kg." |
| Opciones, no normas | "Debes registrarlo cada día." | "Muchas personas lo registran una vez por semana. ¿Con qué frecuencia quieres hacerlo tú?" |
| Preguntas concretas, no abstractas | "¿Por qué te pasa esto?" "¿Qué dice esto de ti?" | "¿Qué pasó exactamente?" "¿Qué parte depende de ti?" "¿Cuál es el primer paso pequeño, y cuándo?" |

**Cómo redactar un lapso.** Tres elementos, en este orden: (1) dato neutro ("Hoy no registraste la caminata"); (2) normalización y causa externalizada si la hay ("Marcaste *viaje*. Un día perdido no cambia el proceso"); (3) paso siguiente pequeño y opcional ("Si quieres, la versión mínima mañana a la misma hora"). Sin valoración ("una pena", "ánimo") ni histórico de lapsos como gráfico de fallos.

**Cómo redactar "no hay datos".** El hueco se describe como hueco, con registros, umbral y una frase que normaliza la variación: "Todavía no hay datos suficientes para ver una tendencia (3 de 7 registros). Las variaciones de un día a otro son normales." Al reabrir tras ≥ 3 días: "Han pasado N días. Esto es lo que había pendiente. Puedes retomar, replanificar o cerrar lo que ya no aplique." Nunca "días perdidos" ni "sin actividad desde".

**Cómo redactar un logro.** Qué se hizo y en cuánto tiempo, más el encuadre del lado pequeño ("llevas 3" si < 50 %, "faltan 3" si ≥ 50 %) [Koo & Fishbach, 2012, *parcialmente*]. Sin fanfarria.

---

## 5. Reglas de producto derivadas

1. **Todo es opt-in.** Al instalar, Remanso es un cuaderno vacío: sin metas, métricas, hábitos, plantillas ni recordatorios por defecto. El módulo de cambio conductual, cada técnica, cada métrica y cada notificación se activan por separado y se desactivan igual de fácil. Ningún asistente crea metas en nombre del usuario.
2. **Derecho a parar sin perder nada.** Pausar o archivar una meta o métrica nunca borra datos ni notas; las reflexiones del diario que la mencionan siguen legibles. Cerrar una meta pide un motivo de una lista neutra (alcanzada / sustituida / inalcanzable / ya no me importa) y ofrece la pregunta opcional "¿Qué has aprendido registrando esto?", guardada como entrada de diario [Epstein et al., 2016; Wrosch et al., 2003].
3. **Sin defaults que creen compromisos.** La frecuencia de cualquier meta es "N veces por semana" elegida por el usuario; la revisión es semanal; los recordatorios no existen hasta que se piden y, al pedirse, el default es uno al día como máximo con decaimiento a los 7 días.
4. **Nada sensible en la pantalla de bloqueo ni en notificaciones.** Bloqueada o inactiva, la app muestra sólo su nombre y la petición de desbloqueo: ni la última entrada, ni nombres de metas, ni números. Las notificaciones del sistema contienen únicamente "Remanso" y, como mucho, el texto que el usuario escribió como recordatorio; nunca categorías de riesgo, peso ni contenido del diario.
5. **Sin inferencia de estados mentales.** La app no analiza texto, no detecta rumiación, no estima ánimo ni riesgo, no muestra correlaciones automáticas ni alertas derivadas del contenido. Las únicas señales de derivación son las elecciones explícitas de §3.2.
6. **Métricas sensibles tras aviso explícito.** Peso, alimentación, medidas corporales y cualquier métrica que el usuario etiquete como sensible se activan desde un menú, nunca desde plantillas, y muestran una sola vez este texto exacto:

   > Registrar el peso o la alimentación ayuda a algunas personas a mantener sus hábitos y a otras les genera preocupación o malestar. Puedes activarlo y desactivarlo cuando quieras. Si notas que pensar en el número te ocupa más de lo que te ayuda, puedes desactivarlo; tus notas y reflexiones se conservan. Esta aplicación no cuenta calorías ni propone dietas.

   Para estas métricas no existe el concepto de racha, no hay colores rojo/verde y la dirección por defecto es `observe`.
7. **Nota de edad.** Remanso está diseñada para una persona adulta y no verifica la edad. Si el usuario indica en el perfil opcional menos de 18 años, no se ofrecen autopesaje ni métricas corporales [Pacanowski et al., 2015; Quick et al., 2012] y la Ayuda indica que las técnicas se estudiaron en adultos.
8. **Transparencia del nivel de evidencia.** Cada técnica muestra en Ayuda su calidad de evidencia (Alta / Moderada / Baja / Muy baja) y si es "experimental", sin cifras que no se leyeron.
9. **Datos legibles y portables.** Markdown/SQLite locales, exportables; la única forma de "compartir" es exportar un resumen en texto plano por decisión del usuario.

---

## 6. Checklist de revisión de seguridad para cada técnica nueva

Toda técnica propuesta pasa estas comprobaciones, documentadas en su ficha, antes de implementarse. Un "no" en los puntos 1, 4, 6, 10 u 11 la descarta o la relega a "experimental" con aviso.

1. **Evidencia verificada.** ¿Hay al menos una fuente cuyo resumen o texto se haya leído (estado *sí*), con diseño, N y población anotados? Las fuentes *parcialmente* o *NO verificadas* no sostienen cifras en la interfaz.
2. **Calidad explícita.** ¿Está escrita la calidad GRADE-like y la interfaz no promete más de lo que ella sostiene?
3. **Población comparable.** ¿Se estudió en adultos de población general **sin** clínico? Si sólo hay evidencia clínica con terapeuta (DBT, CNT, exposición escrita), se marca experimental o se descarta.
4. **Efectos adversos.** ¿Están documentados y se muestran antes de activarla?
5. **Contraindicaciones.** ¿Hay poblaciones que no deben usarla sin supervisión (trauma, psicosis, cardiopatía, trastorno alimentario, menores)? ¿Existe aviso o exclusión?
6. **Interacción con §3.** ¿Podría aplicarse a dependencia de sustancias, trastornos alimentarios, autolesión, juego o ideación suicida? Si sí, ¿dispara el mensaje de derivación y evita cualquier consejo de "dejarlo de golpe"?
7. **Opt-in y reversible.** ¿Se activa desde un menú, se desactiva en un paso y no borra nada?
8. **Sin compromisos por defecto.** ¿Crea metas, métricas, rachas o recordatorios sin que el usuario los pida? (Debe ser no.)
9. **Dosis acotada.** ¿Duración y frecuencia se limitan a lo estudiado, con temporizador visible cuando aplica, y sin obligación diaria?
10. **Sin promesas.** ¿Evita prometer plazos, desaparición de impulsos o síntomas, o eficacia "demostrada"?
11. **Sin inferencia.** ¿Funciona sin analizar texto ni inferir estados mentales?
12. **Redacción.** ¿Cada cadena pasa la tabla de §4?
13. **Salida libre.** ¿Puede abandonarse en cualquier paso sin pregunta ni penalización?
14. **Privacidad de pantalla.** ¿Nada de la técnica aparece en notificaciones ni en la pantalla de bloqueo?
15. **Revisión y caducidad.** ¿La ficha lleva fecha, revisor, segunda lectura por otra persona y fecha de rerevisión (máximo 24 meses)?

---

## 7. Limitaciones del propio documento

- **Dependencia de las notas.** No se revisaron fuentes primarias; el documento hereda las lagunas de A–F. Varias notas agotaron la cuota de búsqueda y dejaron *parcialmente* verificadas fuentes relevantes (ver lista final). Las guías NICE (NG222, CG189) devolvieron 403.
- **Evidencia de daño mayoritariamente correlacional.** Las asociaciones entre autopesaje o contadores de calorías y sintomatología alimentaria son transversales o retrospectivas; la causalidad inversa es plausible; el único RCT fue nulo en bajo riesgo y a un mes [Hahn et al., 2021]. Se adopta el principio de precaución porque la app no puede cribar el riesgo, no porque el daño esté demostrado.
- **Sin estudios de la propia app.** No hay RCT de una app de diario autónoma con resultados de bienestar en adultos (nota D), ni de autoayuda ACT o DBT centrada en impulsos, ni de revisión semanal de metas personales (nota C). Umbrales como "3 aplazamientos", "N mínimo de registros", "decaimiento a 7 días" o "10 minutos de espera" son inferencias de diseño.
- **Poblaciones.** La mayoría de los estudios usan estudiantes o adultos con sobrepeso en países de renta alta; hay poca evidencia en adultos mayores o con vidas muy desestructuradas [Gardner et al., 2024] y ninguna en población hispanohablante. La evidencia sobre rachas mide la siguiente decisión, no el hábito a meses [Silverman & Barasch, 2023].
- **Procesos no observables.** La reactividad a la medición está poco cuantificada ([Korotitsch & Nelson-Gray, 1999] no pudo abrirse); la dependencia del recordatorio no está verificada; la rumiación no puede detectarse sin IA ni clínico, así que la mitigación depende sólo de la redacción.
- **Recursos de ayuda.** Sólo se verificó el 024 (España, 2026-11-05). No se verificó ningún recurso para otros países ni para menores; el operador actual no figura en la página oficial; la verificación caduca.
- **Lo que no se puede garantizar.** Que una persona con un trastorno no diagnosticado no use la app para reforzarlo. Opt-in, avisos, derivación y redacción reducen la probabilidad; una herramienta sin clínico no la elimina, y la documentación pública debe decirlo.

---

## Estado de verificación de las referencias citadas

Todas las referencias de este documento proceden de las notas A–F, donde figuran título, DOI/PMID y URL. Según esas notas, **todas se verificaron leyendo al menos el resumen** (y a texto completo, entre otras, Harkin 2016, Silverman & Barasch 2023, Renfree 2016, Frattaroli 2006, Smyth 1998, Sloan 2018, Madigan 2015, Levinson 2017, Pacanowski 2015 JNEB, Baron 2017, Turicchi 2020a, Pop-Eleches 2011, Samdal 2017, Eysenbach 2005, Gardner 2024, Jesse 2017 parcial), **salvo las siguientes, verificadas sólo parcialmente** (listado de búsqueda, metadatos o fuente secundaria; no se citan cifras de ellas en la interfaz): [Kluger & DeNisi, 1996], [Lally et al., 2010], [Ordóñez et al., 2009], [Koo & Fishbach, 2012], [Korotitsch & Nelson-Gray, 1999], [NICE, 2022 (NG222)], [Teixeira et al., 2020] (parcial en A, sí en E) y [Eisele et al., 2022] (sí en F, parcial en D). Ninguna referencia *NO verificada* de las notas se usa aquí.

Fuente no académica verificada fuera de las notas: página oficial de la Línea 024, Ministerio de Sanidad, `https://www.sanidad.gob.es/linea024/home.htm`, consultada el 2026-11-05.
