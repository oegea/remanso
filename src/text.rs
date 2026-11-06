//! Textos visibles, en español. Un único lugar para revisar el tono y para
//! una futura internacionalización. Reglas: sin exclamaciones, sin emojis,
//! sin felicitaciones automáticas, sin reproches; hechos y preguntas.

pub const APP_NAME: &str = "Remanso";

// Bloqueo y creación
pub const LOCK_PASSWORD: &str = "Contraseña";
pub const LOCK_WRONG: &str = "Contraseña incorrecta.";
pub const LOCK_HINT: &str = "Escribe la contraseña y pulsa Intro.";
pub const LOCK_DERIVING: &str = "Comprobando…";
pub const CREATE_TITLE: &str = "Primer uso";
pub const CREATE_INTRO: &[&str] = &[
    "Remanso guarda todo lo que escribas cifrado en este ordenador.",
    "Elige una contraseña maestra. No se almacena en ningún sitio:",
    "si la olvidas, no hay forma de recuperar los datos.",
];
pub const CREATE_PASSWORD: &str = "Contraseña nueva";
pub const CREATE_REPEAT: &str = "Repite la contraseña";
pub const CREATE_MISMATCH: &str = "Las dos contraseñas no coinciden.";
pub const CREATE_TOO_SHORT: &str = "Usa al menos 8 caracteres.";
pub const CREATE_WORKING: &str = "Creando el archivo cifrado…";
pub const SETUP_TITLE: &str = "Aspecto";
pub const SETUP_THEME: &str = "Tema";
pub const SETUP_CHARSET: &str = "Caracteres";
pub const SETUP_PREVIEW: &str = "Vista previa";
pub const SETUP_DONE: &str = "Intro para empezar. Todo esto se puede cambiar en Ajustes.";

// Inicio
pub const HOME: &str = "Inicio";
pub const HOME_DIARY: &str = "Diario";
pub const HOME_NOTEBOOKS: &str = "Cuadernos";
pub const HOME_TASKS: &str = "Tareas";
pub const HOME_GOALS: &str = "Objetivos";
pub const HOME_IMPULSE: &str = "Impulso";
pub const HOME_REVIEW: &str = "Revisión";
pub const HOME_SEARCH: &str = "Buscar";
pub const HOME_SETTINGS: &str = "Ajustes";
pub const HOME_FIRST_RUN: &str = "Elige una sección con su letra o con las flechas e Intro.";
pub const HOME_LAST_ENTRY: &str = "última entrada";
pub const HOME_NO_ENTRIES: &str = "sin entradas todavía";

// Diario
pub const DIARY: &str = "Diario";
pub const DIARY_EMPTY: &[&str] = &["Todavía no hay entradas.", "Pulsa  n  para escribir la primera."];
pub const DIARY_NEW: &str = "nueva";
pub const DIARY_ENTRY: &str = "Entrada";
pub const DIARY_DELETE_CONFIRM: &str = "¿Borrar esta entrada del diario? No se puede deshacer.";
pub const DIARY_WORDS: &str = "palabras";
pub const DIARY_TITLE_PROMPT: &str = "Título (opcional)";
pub const DIARY_TAGS_PROMPT: &str = "Etiquetas (separadas por espacios)";

// Cuadernos
pub const NOTEBOOKS: &str = "Cuadernos";
pub const NOTEBOOKS_EMPTY: &[&str] = &["Todavía no hay cuadernos.", "Pulsa  n  para crear el primero."];
pub const NOTEBOOK_NAME_PROMPT: &str = "Nombre del cuaderno";
pub const NOTEBOOK_DELETE_CONFIRM: &str = "¿Borrar el cuaderno y todas sus notas? No se puede deshacer.";
pub const NOTEBOOK_ARCHIVED: &str = "archivado";
pub const NOTES_EMPTY: &[&str] = &["Este cuaderno está vacío.", "Pulsa  n  para escribir la primera nota."];
pub const NOTE_TITLE_PROMPT: &str = "Título de la nota";
pub const NOTE_DELETE_CONFIRM: &str = "¿Borrar esta nota? No se puede deshacer.";
pub const NOTE_PINNED: &str = "fijada";
pub const NOTES_COUNT: &str = "notas";
pub const NOTE_LINK_MISSING: &str = "No hay ninguna nota con ese título.";

// Búsqueda
pub const SEARCH: &str = "Buscar";
pub const SEARCH_PROMPT: &str = "Buscar";
pub const SEARCH_NONE: &str = "Sin resultados.";
pub const SEARCH_HINT: &str = "Escribe para buscar en el diario y en los cuadernos.";

// Ajustes
pub const SETTINGS: &str = "Ajustes";
pub const SETTINGS_THEME: &str = "Tema";
pub const SETTINGS_CHARSET: &str = "Caracteres";
pub const SETTINGS_LOCK: &str = "Bloquear tras inactividad";
pub const SETTINGS_PW_FEEDBACK: &str = "Mostrar asteriscos al escribir la contraseña";
pub const SETTINGS_CHANGE_PW: &str = "Cambiar la contraseña";
pub const SETTINGS_BACKUP: &str = "Crear copia de seguridad cifrada";
pub const SETTINGS_EXPORT: &str = "Exportar todo en texto plano (sin cifrar)";
pub const SETTINGS_CHECK: &str = "Verificar integridad de los datos";
pub const SETTINGS_ABOUT: &str = "Acerca de";
pub const SETTINGS_NEVER: &str = "nunca";
pub const SETTINGS_MINUTES: &str = "min";
pub const SETTINGS_DARK: &str = "oscuro";
pub const SETTINGS_LIGHT: &str = "claro";
pub const SETTINGS_UNICODE: &str = "Unicode";
pub const SETTINGS_ASCII: &str = "ASCII";
pub const SETTINGS_YES: &str = "sí";
pub const SETTINGS_NO: &str = "no";
pub const EXPORT_CONFIRM: &str = "La exportación escribe TODO en texto plano, sin cifrar. ¿Continuar?";
pub const EXPORT_PATH_PROMPT: &str = "Carpeta de destino";
pub const BACKUP_PATH_PROMPT: &str = "Carpeta de la copia";
pub const BACKUP_DONE: &str = "Copia creada y verificada.";
pub const EXPORT_DONE: &str = "Exportación terminada.";
pub const CHECK_OK: &str = "Integridad correcta.";
pub const PW_CURRENT: &str = "Contraseña actual";
pub const PW_NEW: &str = "Contraseña nueva";
pub const PW_REPEAT: &str = "Repite la contraseña nueva";
pub const PW_CHANGED: &str = "Contraseña cambiada.";

// Genéricos
pub const SAVED: &str = "Guardado.";
pub const BACK: &str = "volver";
pub const OPEN: &str = "abrir";
pub const EDIT: &str = "editar";
pub const DELETE: &str = "borrar";
pub const ARCHIVE: &str = "archivar";
pub const UNARCHIVE: &str = "recuperar";
pub const HELP: &str = "ayuda";
pub const LOCK: &str = "bloquear";
pub const QUIT: &str = "salir";
pub const TITLE: &str = "título";
pub const TAGS: &str = "etiquetas";
pub const PIN: &str = "fijar";
pub const FOCUS: &str = "sólo texto";
pub const ACCEPT: &str = "aceptar";
pub const CANCEL: &str = "cancelar";
pub const YES: &str = "sí";
pub const NO: &str = "no";
pub const TERMINAL_TOO_SMALL: &str = "Terminal demasiado pequeño: se necesitan al menos 60×12 y se recomiendan 80×24.";

// Tareas
pub const TASKS: &str = "Tareas";
pub const TASKS_TODAY: &str = "Hoy";
pub const TASKS_UPCOMING: &str = "Próximas";
pub const TASKS_SOMEDAY: &str = "Sin fecha";
pub const TASKS_DONE: &str = "Hechas";
pub const TASKS_PROJECTS: &str = "Proyectos";
pub const TASKS_CALENDAR: &str = "Calendario";
pub const TASKS_EMPTY_TODAY: &[&str] = &["Nada previsto para hoy.", "Pulsa  n  para añadir una tarea, Tab para cambiar de vista."];
pub const TASKS_EMPTY_UPCOMING: &[&str] = &["Nada previsto en los próximos siete días."];
pub const TASKS_EMPTY_SOMEDAY: &[&str] = &["No hay tareas sin fecha.", "Pulsa  n  para anotar algo que harás algún día."];
pub const TASKS_EMPTY_DONE: &[&str] = &["Todavía no hay tareas hechas o cerradas."];
pub const TASKS_EMPTY_PROJECTS: &[&str] = &["No hay proyectos.", "Pulsa  n  para crear uno y agrupar tareas."];
pub const TASK_TITLE_PROMPT: &str = "Tarea";
pub const TASK_SUBTASK_PROMPT: &str = "Subtarea";
pub const TASK_DAY_PROMPT: &str = "¿Qué día? (hoy, mañana, lun, +3, 20, 15/12, ninguna)";
pub const TASK_DUE_PROMPT: &str = "Fecha límite (hoy, mañana, lun, 15/12, ninguna)";
pub const TASK_POSTPONE_PROMPT: &str = "¿A qué día lo mueves? (mañana, lun, +3, 20)";
pub const TASK_RECUR_PROMPT: &str = "Repetir (cada día, laborables, L X V, cada 2 semanas, día 15, nunca)";
pub const TASK_PROJECT_PROMPT: &str = "Proyecto (nombre; vacío para ninguno)";
pub const TASK_CLOSE_PROMPT: &str = "Cerrar sin hacer. ¿Por qué ya no aplica? (opcional)";
pub const TASK_DELETE_CONFIRM: &str = "¿Borrar esta tarea y sus subtareas? No se puede deshacer.";
pub const TASK_PENDING: &str = "pendiente";
pub const TASK_POSTPONED_TIMES: &str = "aplazada";
pub const TASK_DATE_UNKNOWN: &str = "No entiendo esa fecha. Ejemplos: mañana, lun, +3, 20, 15/12.";
pub const TASK_RECUR_UNKNOWN: &str = "No entiendo esa repetición. Ejemplos: cada día, laborables, L X V, día 15.";
pub const TASK_REVIEW_OFFER: &str = "Esta tarea se ha aplazado varias veces. Pulsa R para revisarla con calma (un minuto).";
pub const PROJECT_NAME_PROMPT: &str = "Nombre del proyecto";
pub const PROJECT_DELETE_CONFIRM: &str = "¿Borrar el proyecto? Las tareas se conservan sin proyecto.";
pub const TASK_DETAIL: &str = "Tarea";
pub const TASK_NOTES_HINT: &str = "Notas de la tarea (escribe aquí)";
pub const TASK_SUBTASKS: &str = "Subtareas";

// Revisión de tarea aplazada (nota E §9)
pub const REVIEW_TITLE: &str = "Revisión";
pub const REVIEW_INTRO: &str = "se ha aplazado {n} veces. Es muy frecuente; suele indicar algo sobre la tarea, no sobre ti. ¿Miramos qué la hace difícil? (un minuto, todo opcional)";
pub const REVIEW_Q1: &str = "¿Sigue importando? Si la completaras, ¿qué cambiaría?";
pub const REVIEW_Q1_OPTS: &[(&str, &str)] = &[("s", "Sí, importa"), ("n", "Ya no"), ("d", "No lo sé")];
pub const REVIEW_Q2: &str = "¿Sabes exactamente cuál sería el primer paso de menos de 15 minutos?";
pub const REVIEW_Q2_OPTS: &[(&str, &str)] = &[("s", "Sí"), ("n", "No, la dividimos")];
pub const REVIEW_Q2_PROMPT: &str = "Primer paso concreto (menos de 15 minutos)";
pub const REVIEW_Q3: &str = "¿Falta algo: información, material, otra persona, un momento libre?";
pub const REVIEW_Q3_OPTS: &[(&str, &str)] = &[("s", "Sí, escribo qué"), ("n", "Nada concreto")];
pub const REVIEW_Q3_PROMPT: &str = "¿Qué falta? (se creará una tarea para resolverlo)";
pub const REVIEW_Q4: &str = "¿La evitas porque es aburrida, incómoda o temes hacerla mal?";
pub const REVIEW_Q4_OPTS: &[(&str, &str)] = &[("a", "Aburrida"), ("i", "Incómoda"), ("m", "Miedo a hacerlo mal"), ("n", "No")];
pub const REVIEW_Q4_BORING: &str = "Idea: acótala a 10–15 minutos o empareja con algo agradable.";
pub const REVIEW_Q4_UNCOMFORTABLE: &str = "Idea: decide sólo el primer paso pequeño; lo incómodo suele ser empezar.";
pub const REVIEW_Q4_FEAR: &str = "Idea: hazla como «versión borrador»; una versión mínima aceptable cuenta.";
pub const REVIEW_Q5: &str = "Si decides mantenerla: ¿qué día? Después, ¿qué será distinto esa vez?";
pub const REVIEW_Q5_DAY: &str = "¿Qué día? (mañana, lun, +3, 20)";
pub const REVIEW_Q5_DIFF: &str = "¿Qué será distinto esa vez? (opcional)";
pub const REVIEW_CLOSE: &str = "Hecho. Aplazar no es fallar: ahora la tarea es más clara.";
pub const REVIEW_CLOSED_TASK: &str = "Tarea cerrada. Decidir que algo ya no importa también es gestionarlo.";
pub const REVIEW_FORGIVE: &str = "Si notas culpa o malestar por haberla aplazado, puedes elegir una frase para soltarlo (opcional):";
pub const REVIEW_FORGIVE_OPTS: &[(&str, &str)] = &[
    ("1", "Aplazarla no dice nada de mí; era una tarea mal definida."),
    ("2", "Aplazar es frecuente. Ahora sé qué la hacía difícil y puedo soltar el malestar."),
    ("Esc", "Sin frase, gracias."),
];

// Recordatorios
pub const REMINDERS: &str = "Recordatorios";
pub const REMINDERS_DUE: &str = "Pendientes";
pub const REMINDERS_UPCOMING: &str = "Próximos";
pub const REMINDERS_EMPTY: &[&str] = &["No hay recordatorios.", "Pulsa  n  para crear uno. Se comprueban al abrir la aplicación; nada avisa con ella cerrada."];
pub const REMINDER_TITLE_PROMPT: &str = "Recordatorio";
pub const REMINDER_WHEN_PROMPT: &str = "¿Cuándo? (mañana 9:00, lun 18:30, 15/12 10:00, +2h)";
pub const REMINDER_REPEAT_PROMPT: &str = "Repetir (cada día, laborables, L X V, semanal, nunca)";
pub const REMINDER_SNOOZE_PROMPT: &str = "¿Hasta cuándo? (+1h, +3h, mañana 9:00, lun 18:00)";
pub const REMINDER_WHEN_UNKNOWN: &str = "No entiendo ese momento. Ejemplos: mañana 9:00, lun 18:30, +2h.";
pub const REMINDER_REVIEW_HINT: &str = "Este aviso ya se ha mostrado dos veces. ¿Sigue teniendo sentido? Puedes reprogramarlo (e), cambiar su repetición (r) o cerrarlo (d).";
pub const REMINDER_DELETE_CONFIRM: &str = "¿Borrar este recordatorio?";
pub const HOME_REMINDERS: &str = "Recordatorios";
pub const HOME_PENDING_TASKS: &str = "pendientes hoy";
pub const WELCOME_BACK_TITLE: &str = "De vuelta";
pub const WELCOME_BACK_LINE1: &str = "Han pasado {n} días desde la última vez.";
pub const WELCOME_BACK_LINE2: &str = "Esto es lo que había pendiente: {t} tareas y {r} recordatorios.";
pub const WELCOME_BACK_LINE3: &str = "Puedes retomar, replanificar o cerrar lo que ya no aplique. Nada se ha marcado como incumplido.";

// Objetivos
pub const GOALS: &str = "Objetivos";
pub const GOALS_EMPTY: &[&str] = &["Todavía no hay objetivos.", "Pulsa  n  para definir uno. Puedes empezar con algo pequeño."];
pub const GOAL_NAME_PROMPT: &str = "Objetivo (verbo + cantidad + contexto; p. ej. «leer 20 minutos después de cenar»)";
pub const GOAL_KIND_TITLE: &str = "¿Qué tipo de objetivo es?";
pub const GOAL_CATEGORY_TITLE: &str = "¿Con qué tiene que ver?";
pub const GOAL_WHY_PROMPT: &str = "¿Por qué te importa? (opcional, en tus palabras)";
pub const GOAL_CONTEXT_PROMPT: &str = "¿Cuándo y dónde sueles hacerlo? (opcional)";
pub const GOAL_CRITERIA_PROMPT: &str = "¿Cómo sabrás que va bien? (opcional)";
pub const GOAL_HORIZON_PROMPT: &str = "Horizonte temporal (fecha, o vacío si no lo hay)";
pub const GOAL_REVIEW_PROMPT: &str = "Revisar cada cuántos días (7 por defecto; vacío para no programar)";
pub const GOAL_CLOSE_TITLE: &str = "Cerrar el objetivo";
pub const GOAL_CLOSE_INTRO: &str = "Cerrar un objetivo es una decisión, no un fallo. ¿Por qué lo cierras?";
pub const GOAL_LEARNED_PROMPT: &str = "¿Qué has aprendido con este objetivo? (opcional; se guarda en el diario)";
pub const GOAL_DELETE_CONFIRM: &str = "¿Borrar el objetivo con sus métricas, hitos y acciones? No se puede deshacer. Cerrarlo conserva todo.";
pub const GOAL_TAB_SUMMARY: &str = "Resumen";
pub const GOAL_TAB_METRICS: &str = "Métricas";
pub const GOAL_TAB_MILESTONES: &str = "Hitos";
pub const GOAL_TAB_ACTIONS: &str = "Acciones";
pub const GOAL_TAB_PLANS: &str = "Planes";
pub const GOAL_WHY: &str = "Por qué";
pub const GOAL_CONTEXT: &str = "Cuándo y dónde";
pub const GOAL_CRITERIA: &str = "Cómo sabré que va bien";
pub const GOAL_SINCE: &str = "desde";
pub const GOAL_HORIZON: &str = "horizonte";
pub const GOAL_LAST_REVIEW: &str = "última revisión";
pub const GOAL_NO_REVIEW: &str = "sin revisar todavía";
pub const GOAL_REVIEW_DUE: &str = "revisión disponible";
pub const GOAL_SAFETY_TITLE: &str = "Antes de empezar";
pub const GOAL_SAFETY_TEXT: &[&str] = &[
    "Remanso es un cuaderno personal de notas, objetivos y hábitos. No es un servicio sanitario: no diagnostica, no trata y no sustituye a un profesional de la salud.",
    "",
    "Las técnicas de este módulo proceden de la investigación en autoayuda. Sus efectos suelen ser modestos y varían mucho de una persona a otra. Todo es opcional y se puede desactivar en cualquier momento sin perder lo escrito.",
    "",
    "Si lo que quieres cambiar afecta a tu salud, o te preocupa, un profesional puede acompañarte mejor que esta aplicación.",
];
pub const DERIVATION_TITLE: &str = "Una nota";
pub const DERIVATION_BASE: &str = "Lo que describes puede ir más allá de lo que una herramienta de autoayuda puede acompañar. Hablar con tu médico o médica de cabecera, o con un profesional de salud mental, suele ser un buen siguiente paso. Puedes seguir usando Remanso como cuaderno mientras tanto.";
pub const DERIVATION_SUICIDAL: &str = "Si tienes pensamientos de hacerte daño o de morir, en España puedes llamar al 024, línea de atención a la conducta suicida: gratuita, confidencial y disponible las 24 horas. Si tu vida corre peligro ahora mismo, llama al 112.";
pub const DERIVATION_SUBSTANCE: &str = "Si bebes o tomas sedantes a diario y quieres dejarlo, conviene no hacerlo de golpe sin consultar: la retirada brusca puede requerir atención médica.";
pub const DERIVATION_EATING: &str = "Si notas restricción, atracones, conductas para compensar lo comido o una pérdida rápida de peso, es un buen momento para consultar con un profesional. Puedes desactivar las métricas corporales cuando quieras; tus notas se conservan.";

// Métricas
pub const METRICS_EMPTY: &[&str] = &["Sin métricas. Pulsa  n  para añadir una.", "Registrar la conducta (sesiones, minutos) suele ayudar más que registrar el resultado."];
pub const METRIC_NAME_PROMPT: &str = "Nombre de la métrica";
pub const METRIC_KIND_TITLE: &str = "¿Qué tipo de dato es?";
pub const METRIC_UNIT_PROMPT: &str = "Unidad (kg, km, páginas…; vacío si no tiene)";
pub const METRIC_SENSITIVE_TITLE: &str = "Métrica sensible";
pub const METRIC_SENSITIVE_TEXT: &str = "Registrar el peso o la alimentación ayuda a algunas personas a mantener sus hábitos y a otras les genera preocupación o malestar. Puedes activarlo y desactivarlo cuando quieras. Si notas que pensar en el número te ocupa más de lo que te ayuda, puedes desactivarlo; tus notas y reflexiones se conservan. Esta aplicación no cuenta calorías ni propone dietas.";
pub const METRIC_SENSITIVE_ASK: &str = "¿Es una métrica sensible (peso, alimentación, medidas corporales)?";
pub const METRIC_VALUE_PROMPT: &str = "Valor";
pub const METRIC_VALUE_UNKNOWN: &str = "No entiendo ese valor para este tipo de métrica.";
pub const METRIC_DAY_PROMPT: &str = "¿De qué día es la medición? (hoy, ayer, lun, 3/11)";
pub const METRIC_NOTE_PROMPT: &str = "Nota (opcional)";
pub const METRIC_DIRECTION_TITLE: &str = "¿Qué dirección tiene?";
pub const METRIC_TARGET_PROMPT: &str = "Valor de referencia (vacío para ninguno)";
pub const METRIC_RANGE_PROMPT: &str = "Intervalo aceptable «mín–máx» (p. ej. 7–8)";
pub const METRIC_FREQ_TITLE: &str = "¿Con qué frecuencia quieres registrarla? Muchas personas lo hacen una vez por semana.";
pub const METRIC_ARCHIVE_CONFIRM: &str = "¿Pausar esta métrica? Los registros y las notas se conservan.";
pub const METRIC_TOO_MANY: &str = "Ya hay seis métricas activas. Registrar demasiadas cosas es la causa más citada de abandono; quizá convenga pausar alguna.";
pub const METRIC_WEIGHT_NOTE: &str = "El peso varía de un día a otro por agua y digestión; la línea muestra la tendencia, no el valor real de hoy.";
pub const METRIC_RECORDS: &str = "registros";
pub const METRIC_LAST: &str = "último";
pub const METRIC_TREND_7: &str = "media 7 días";
pub const METRIC_NO_DATA: &str = "Sin registros todavía. Pulsa  m  para anotar el primero.";
pub const METRIC_REGULARITY: &str = "variación típica";
pub const METRIC_DELETE_MEASUREMENT: &str = "¿Borrar este registro?";

// Hitos
pub const MILESTONES_EMPTY: &[&str] = &["Sin hitos. Son opcionales; ayudan en objetivos de más de un mes.", "Pulsa  n  para definir uno sobre lo acumulado (sesiones, páginas), no sobre días seguidos."];
pub const MILESTONE_TITLE_PROMPT: &str = "Hito (p. ej. «diez sesiones registradas»)";
pub const MILESTONE_KIND_TITLE: &str = "¿Cómo se alcanza?";
pub const MILESTONE_TARGET_PROMPT: &str = "Valor objetivo";
pub const MILESTONE_DAY_PROMPT: &str = "Fecha del hito";
pub const MILESTONE_PICK_ACTION: &str = "¿Sobre qué acción?";
pub const MILESTONE_PICK_METRIC: &str = "¿Sobre qué métrica?";
pub const MILESTONE_RESCHEDULE_PROMPT: &str = "Nueva fecha (se conserva la anterior en el historial)";
pub const MILESTONE_RESCHEDULE_NOTE: &str = "Motivo del cambio (opcional)";
pub const MILESTONE_REACHED: &str = "alcanzado";
pub const MILESTONE_REACHED_MSG: &str = "Hito alcanzado:";
pub const MILESTONE_DROPPED: &str = "descartado";
pub const MILESTONE_DELETE_CONFIRM: &str = "¿Borrar este hito y su historial?";

// Acciones
pub const ACTIONS_EMPTY: &[&str] = &["Sin acciones. Una acción es algo concreto que harás con regularidad.", "Pulsa  n  para definir una, con su frecuencia semanal y su señal («después de desayunar»)."];
pub const ACTION_NAME_PROMPT: &str = "Acción concreta (p. ej. «salir a caminar 20 minutos»)";
pub const ACTION_SCHEDULE_PROMPT: &str = "Frecuencia (3 veces por semana, laborables, L X V, cada día)";
pub const ACTION_CUE_PROMPT: &str = "Señal o momento que la dispara (p. ej. «al terminar de desayunar»; opcional)";
pub const ACTION_AVOID_ASK: &str = "¿Es algo que quieres dejar de hacer (en vez de hacer)?";
pub const ACTION_NOTE_PROMPT: &str = "Nota del día (opcional)";
pub const ACTION_THIS_WEEK: &str = "esta semana";
pub const ACTION_LAST7: &str = "últimos 7 días";
pub const ACTION_LAST30: &str = "últimos 30 días";
pub const ACTION_WEEKS_OK: &str = "semanas seguidas con la frecuencia alcanzada";
pub const ACTION_TOTAL: &str = "total";
pub const ACTION_FIRST: &str = "primera vez";
pub const ACTION_PAUSE_CONFIRM: &str = "¿Pausar esta acción? El historial se conserva.";
pub const ACTION_DELETE_CONFIRM: &str = "¿Borrar esta acción y su historial?";
pub const ACTION_SCHEDULE_UNKNOWN: &str = "No entiendo esa frecuencia. Ejemplos: 3 veces por semana, laborables, L X V, cada día.";
pub const ACTION_TODAY_DONE: &str = "hecha hoy";
pub const ACTION_TODAY_NOT: &str = "hoy no";
pub const ACTION_TODAY_BLANK: &str = "sin registro hoy";
pub const HOME_TODAY: &str = "Hoy";
pub const HOME_GOALS_ACTIVE: &str = "activos";

// Impulso (interventions.md §c)
pub const IMPULSE: &str = "Impulso";
pub const IMPULSE_PICK_GOAL: &str = "¿Con qué tiene que ver este impulso?";
pub const IMPULSE_NO_GOAL: &str = "Nada en particular / sin objetivo";
pub const IMPULSE_INTENSITY: &str = "Intensidad ahora, de 0 a 10";
pub const IMPULSE_TRIGGER: &str = "¿Qué había justo antes?";
pub const IMPULSE_TRIGGERS: &[&str] = &["aburrimiento", "estrés", "tristeza", "enfado", "cansancio", "ganas", "nada en particular"];
pub const IMPULSE_CONTEXT: &str = "¿Algo de esto se da ahora? (contexto, no causa)";
pub const IMPULSE_CONTEXTS: &[&str] = &["hambre", "sueño < 6 h", "enfado", "soledad", "estrés", "alcohol"];
pub const IMPULSE_CONTEXT_HELP: &str = "El cansancio o el hambre acompañan a muchos impulsos pero no los explican.";
pub const IMPULSE_PATHWAY: &str = "Elige una vía";
pub const IMPULSE_PATHWAY_SURF: &str = "Surfear (2–3 min): mirar el impulso sin obedecerlo; puede no bajar.";
pub const IMPULSE_PATHWAY_BREATHE: &str = "Respirar (3–5 min): 4 segundos dentro, 6 fuera.";
pub const IMPULSE_PATHWAY_DISTRACT: &str = "Cambiar de sitio o hacer otra cosa";
pub const IMPULSE_PATHWAY_LONGTERM: &str = "Pensar a largo plazo (1 min): tu para qué y tu imagen futura.";
pub const IMPULSE_PATHWAY_COMPETING: &str = "Respuesta competidora (hábitos motores)";
pub const IMPULSE_WAIT_TITLE: &str = "Espera activa";
pub const IMPULSE_WAIT_ELAPSED: &str = "Han pasado {m} minutos.";
pub const IMPULSE_WAIT_JUST_STARTED: &str = "Acabas de empezar.";
pub const IMPULSE_WAIT_DONE: &str = "Puedes seguir o terminar.";
pub const IMPULSE_WAIT_HINT: &str = "Intro: siguiente paso · t: terminar · Esc: guardar y salir";
pub const IMPULSE_FUTURE_PROMPT: &str = "Si lo hago ahora, ¿cómo estaré dentro de una hora? ¿Y la semana que viene? (opcional)";
pub const IMPULSE_REFRAME_PROMPT: &str = "¿Qué otra lectura hay de lo que está pasando? (opcional)";
pub const IMPULSE_BODY_PROMPT: &str = "¿Dónde lo notas en el cuerpo? ¿Qué forma tiene? (opcional)";
pub const IMPULSE_OUTCOME: &str = "¿Qué pasó?";
pub const IMPULSE_REFLECTION: &str = "¿Algo que quieras anotar? (opcional)";
pub const IMPULSE_SAVED: &str = "Registrado.";
pub const IMPULSE_NO_PRESSURE: &str = "Esc guarda lo que haya y sale, en cualquier momento.";
pub const IMPULSE_DISTRESS: &str = "Está bien parar. Puedes elegir otra vía o salir.";
pub const IMPULSE_WHY: &str = "Tu para qué";
pub const IMPULSE_FUTURE_IMAGE: &str = "Tu imagen futura";
pub const IMPULSE_DISTRACTIONS: &str = "Tus alternativas";
pub const IMPULSE_NONE_CONFIGURED: &str = "Todavía no has preparado alternativas (se hace en Impulso → p, preparar).";
pub const LAPSE_TITLE: &str = "Después de un desliz";
pub const LAPSE_LINE1: &str = "Un desliz es un dato, no un veredicto.";
pub const LAPSE_BEFORE: &str = "¿Qué viste antes? (opcional)";
pub const LAPSE_BEFORE_OPTS: &[&str] = &["cansancio", "cambio de rutina", "estado de ánimo", "compañía", "lugar", "otra cosa"];
pub const LAPSE_NEXT_STEP: &str = "Un paso pequeño para la próxima vez (opcional):";
pub const LAPSE_SAVE_AS_PLAN: &str = "¿Guardarlo como plan si–entonces? Si… (situación)";
pub const LAPSE_HARM: &str = "¿Hubo daño físico, deuda o riesgo serio?";
pub const LAPSE_FORGIVE: &str = "Un impulso no me hace peor persona. Si noto culpa, puedo soltarla: ahora sé qué lo hizo difícil.";
pub const PATTERN_TITLE: &str = "Patrón de episodios";
pub const PATTERN_EMPTY: &str = "Sin episodios registrados en los últimos 30 días.";
pub const PATTERN_NOT_ACTED: &str = "{x} de {y} episodios sin actuar en los últimos 30 días";
pub const PATTERN_INTENSITY_NOTE: &str = "La intensidad puede no bajar aunque no actúes.";
pub const PATTERN_RISING: &str = "En las últimas cuatro semanas los episodios con «lo hice» han ido en aumento: {a}, {b}, {c}, {d}.";
pub const PATTERN_SLOTS: &[&str] = &["mañana", "mediodía", "tarde", "noche"];
pub const PREP_TITLE: &str = "Preparar";
pub const PREP_INTRO: &str = "Cambiar la situación antes suele funcionar mejor que resistir en el momento. Todo es opcional.";
pub const PREP_ENV: &str = "Dos o tres cambios en el entorno (uno por línea; p. ej. «el móvil se carga en la cocina»)";
pub const PREP_FUTURE: &str = "Imagen futura: ¿cómo te ves dentro de uno a seis meses si esto cambia?";
pub const PREP_DISTRACTIONS: &str = "Tres alternativas concretas para el momento (una por línea)";
pub const PREP_COMPETING: &str = "Si es un hábito motor: gesto incompatible (p. ej. «cerrar el puño diez segundos»)";
pub const PREP_WAIT: &str = "Minutos de espera activa (5 a 20; 10 por defecto)";
pub const PREP_SERIOUS: &str = "¿Esta conducta afecta de forma seria a tu salud física, tu dinero, tu trabajo o tus relaciones?";
pub const PREP_SERIOUS_OPTS: &[&str] = &["No", "Sí", "Prefiero no decirlo"];

// Revisiones
pub const REVIEWS: &str = "Revisión";
pub const REVIEW_MENU_OPEN: &str = "Apertura del día";
pub const REVIEW_MENU_CLOSE: &str = "Cierre del día";
pub const REVIEW_MENU_WEEKLY: &str = "Revisión semanal";
pub const REVIEW_MENU_GOAL: &str = "Revisión de objetivo";
pub const REVIEW_MENU_PATTERN: &str = "Patrón de impulsos";
pub const REVIEW_MENU_PREP: &str = "Preparar el módulo de impulsos";
pub const REVIEW_DISABLED: &str = "desactivada; se activa en Ajustes";
pub const REVIEW_DONE_TODAY: &str = "ya hay una sesión guiada hoy";
pub const REVIEW_SECOND_SESSION: &str = "Ya hay una sesión guiada hoy. Más preguntas no suelen ayudar; ¿abrir otra igualmente?";
pub const REVIEW_AVAILABLE: &str = "disponible";
pub const REVIEW_DONE_THIS_WEEK: &str = "hecha esta semana";
pub const REVIEW_INTRO_WEEKLY: &str = "Datos de la semana, sin preguntas. Después, hasta seis preguntas; responder a una o a ninguna es válido.";
pub const REVIEW_SKIP: &str = "omitir";
pub const REVIEW_SAVED: &str = "Revisión guardada. La próxima, cuando quieras.";
pub const REVIEW_TASKS_CREATED: &str = "{n} tareas creadas para mañana.";
pub const REVIEW_OFFER_DISABLE: &str = "Las tres últimas revisiones semanales se cerraron sin respuestas. ¿Quieres dejar de ofrecerla? (se puede reactivar en Ajustes)";
pub const REVIEW_WEEK_HEADER: &str = "Esta semana frente a la anterior";
pub const REVIEW_GOAL_PICK: &str = "¿Qué objetivo revisas?";
pub const REVIEW_GOAL_DECISION_APPLIED: &str = "Decisión registrada.";
pub const SRBAI_TITLE: &str = "Automaticidad";
pub const SRBAI_RESULT: &str = "Automaticidad: {now} sobre 5.";
pub const SRBAI_PREVIOUS: &str = "Medida anterior ({day}): {v}.";
pub const SRBAI_FIRST: &str = "Primera medida. La próxima, en unas tres semanas.";
pub const SRBAI_SCALE: &str = "1 nada de acuerdo … 5 totalmente de acuerdo";
pub const HOME_WEEKLY_AVAILABLE: &str = "Revisión semanal disponible (r)";
pub const HOME_GOAL_REVIEW_AVAILABLE: &str = "revisión de objetivo disponible";

// Planes si-entonces
pub const PLANS_EMPTY: &[&str] = &["Sin planes si–entonces.", "Pulsa  n  para escribir uno: «Si [situación concreta], entonces [acción concreta]»."];
pub const PLAN_SITUATION_PROMPT: &str = "Si… (cuándo, dónde o después de qué; p. ej. «al llegar a casa a las 19:00»)";
pub const PLAN_RESPONSE_PROMPT: &str = "…entonces (primera acción concreta)";
pub const PLAN_VAGUE: &str = "Este plan es poco concreto. ¿Puedes añadir hora, lugar o la acción que lo precede? Se puede guardar igual.";
pub const PLAN_SAVED: &str = "Guardado. Léelo dos veces imaginando la situación. Si la situación no se da, el plan simplemente no se activa; no es un incumplimiento.";
pub const PLAN_REVIEW_ASK: &str = "¿Te sirvió este plan?";
pub const PLAN_OFFER_ARCHIVE: &str = "La situación no se ha dado en las dos últimas revisiones. ¿Archivamos este plan?";
pub const PLAN_DELETE_CONFIRM: &str = "¿Borrar este plan y sus revisiones?";
pub const PLAN_REVIEWS: &str = "revisiones";
pub const PLAN_BOOSTERS: &str = "Se recordará a los 7 y 14 días.";

// Ajustes adicionales
pub const SETTINGS_PROMPTS_OPEN: &str = "Preguntas de apertura del día (experimental)";
pub const SETTINGS_PROMPTS_CLOSE: &str = "Preguntas de cierre del día";
pub const SETTINGS_PROMPTS_WEEKLY: &str = "Revisión semanal";
pub const SETTINGS_WEEKLY_DAY: &str = "Día sugerido para la revisión semanal";
pub const SETTINGS_TECHNIQUES: &str = "Técnicas y su evidencia";
pub const SETTINGS_HELP_NOW: &str = "Si necesitas ayuda";
pub const SETTINGS_ON: &str = "activas";
pub const SETTINGS_OFF: &str = "no";

// ---- Uso con acompañamiento profesional (web; safety.md §3.4) --------------------------
pub const SUPERVISED_LABEL: &str = "Uso con acompañamiento profesional";
pub const SUPERVISED_HELP: &str = "Si un profesional de la salud conoce lo que registras aquí y te acompaña, los avisos de derivación se acortan.";
pub const SUPERVISED_CONFIRM_TITLE: &str = "Acortar los avisos";
pub const SUPERVISED_CONFIRM_BODY: &str = "Los avisos de Remanso existen porque la autoayuda sin acompañamiento funciona peor que la acompañada, y porque algunas conductas necesitan atención médica. Si activas esta opción, Remanso dará por hecho que un profesional de la salud conoce lo que registras aquí y te acompaña: los avisos largos se sustituyen por una nota breve, que se mantiene tras una apuesta o un daño, y la indicación del 112 en caso de peligro no desaparece nunca. Puedes desactivarlo cuando quieras.";
pub const SUPERVISED_CONFIRM_CHECK: &str = "Confirmo que uso Remanso con el acompañamiento de un profesional de la salud que conoce lo que registro aquí.";
pub const SUPERVISED_CONFIRM_BTN: &str = "Confirmo y activo";
pub const SUPERVISED_ON_NOTE: &str = "Avisos acortados. Lo que registras aquí merece comentarse con quien te acompaña.";
pub const DERIVATION_SUPERVISED: &str = "Has indicado que cuentas con acompañamiento profesional: lo que acabas de anotar merece comentarse con esa persona. Si tu vida corre peligro ahora mismo, llama al 112.";
pub const DERIVATION_EATING_SUPERVISED: &str = "Registrar la alimentación o el peso puede ocupar más de lo que ayuda. Si lo notas, coméntalo con quien te acompaña; puedes desactivar la métrica cuando quieras y tus notas se conservan.";
pub const DERIVATION_SUBSTANCE_SUPERVISED: &str = "Los cambios en el consumo conviene acordarlos con quien te acompaña: la retirada brusca puede requerir atención médica.";
pub const METRIC_SENSITIVE_SUPERVISED: &str = "Esta métrica es sensible. Puedes activarla y desactivarla cuando quieras; si notas que el número te ocupa más de lo que te ayuda, coméntalo con quien te acompaña. Esta aplicación no cuenta calorías ni propone dietas.";

// ---- Histórico de episodios de impulso -----------------------------------------------------
pub const IMPULSE_HISTORY: &str = "Episodios de impulso";
pub const IMPULSE_HISTORY_INTRO: &str = "Lo que registraste, tal cual: fecha, vía, intensidad y resultado. Sirve para mirar qué precede a un impulso y qué te ayudó. No hay nota ni puntuación.";
pub const IMPULSE_HISTORY_EMPTY: &str = "Todavía no hay episodios. Cuando registres uno, aparecerá aquí.";
pub const IMPULSE_HISTORY_COMPARE: &str = "Últimos 30 días frente a los 30 anteriores";
pub const IMPULSE_HISTORY_LINK: &str = "Ver episodios anteriores";
pub const IMPULSE_HISTORY_INCOMPLETE: &str = "sin terminar";

// ---- Respiración guiada --------------------------------------------------------------------
pub const BREATH_IN: &str = "Inspira";
pub const BREATH_OUT: &str = "Espira";
pub const BREATH_HINT: &str = "Sigue el círculo: cuatro segundos dentro, seis fuera. Si te mareas, respira normal.";
pub const BREATH_HINT_STATIC: &str = "Sigue el texto: cuatro segundos dentro, seis fuera. Si te mareas, respira normal.";

#[cfg(test)]
mod tests {
    /// Palabras y signos vetados por las reglas de redacción (safety.md §4).
    #[test]
    fn no_forbidden_wording_in_ui_texts() {
        let src = include_str!("text.rs");
        let body = src.split("#[cfg(test)]").next().unwrap().to_lowercase();
        for bad in ["racha rota", "has fallado", "fracaso", "deberías", "¡", "otra vez", "días perdidos", "has roto", "quemar calorías", "castigo"] {
            assert!(!body.contains(bad), "expresión vetada en los textos: «{bad}»");
        }
    }
}
