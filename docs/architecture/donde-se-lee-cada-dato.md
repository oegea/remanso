# Dónde se lee cada dato (web)

Regla de producto (2026-11-06): todo lo que se introduce en Remanso tiene un sitio evidente
donde volver a leerlo. Si un dato no aparece en esta tabla, o sólo se ve «escondido», es un
defecto. Las pantallas se nombran como en la barra de navegación.

| Dato que se introduce | Dónde se lee | Notas |
|---|---|---|
| Entrada de diario (texto, título, etiquetas) | Diario (lista por días) · Buscar · Hoy («última entrada») | |
| Nota de cuaderno | Cuadernos → cuaderno → nota · Buscar | |
| Tarea (título, notas, fechas, prioridad, repetición, proyecto) | Tareas → Pendientes (una lista por cercanía: días anteriores, hoy, mañana, siete días, más adelante, sin fecha) / Calendario / Proyectos · ficha de la tarea · Hoy («Tareas de hoy» y «Próximos días») | El día que manda es el más cercano entre previsto y límite; las hechas hoy se quedan al final de la lista (máx. 10); todas en «Hechas» |
| Tarea hecha o cerrada (y su motivo de cierre) | Tareas → Hechas · ficha | |
| Revisión de tarea aplazada (primer paso, qué falta) | Se convierte en subtarea / tarea nueva · ficha de la tarea | |
| Proyecto | Tareas → Proyectos (abiertas · hechas) → pantalla del proyecto: sus tareas abiertas, las hechas al final, opciones (nombre, archivo, borrar) | |
| Recordatorio (hora, repetición) | Recordatorios · Hoy (los que tocan) | |
| Objetivo (nombre, por qué, contexto, criterio, horizonte) | Objetivos → ficha, pestaña Resumen | |
| Métrica y sus mediciones | Objetivos → ficha → Métricas (tendencia, últimas mediciones) | Sin colores de fallo |
| Hito | Objetivos → ficha → Hitos | |
| Acción y su registro diario | Objetivos → ficha → Acciones (semana, últimos 30 días) · Hoy (las de hoy) | |
| Plan si–entonces y «¿te sirvió?» | Objetivos → ficha → Planes (cuenta de sí / en parte / no) | |
| Lo aprendido al cerrar un objetivo | Diario (se guarda como entrada) | |
| Revisión de objetivo (decisión) | Estado del objetivo (pausado, cerrado, frecuencia) · sesión en Revisión → Sesiones anteriores no aplica (no guarda respuestas) | |
| Automaticidad (SRBAI) de una acción | Objetivos → ficha → Acciones («automaticidad 3,5 de 5 (fecha)») · final de la sesión | |
| Apertura del día (respuestas) | Hoy («Tu apertura de hoy») · Revisión → Sesiones anteriores | |
| Cierre del día (respuestas) | Hoy («Tu cierre de hoy») · Revisión → Sesiones anteriores · los pendientes se convierten en Tareas de mañana | |
| Revisión semanal (respuestas) | Revisión → Sesiones anteriores · la tarea propuesta aparece en Tareas | |
| Episodio de impulso (intensidad, antes, contexto, vía, tiempo, resultado, notas) | Impulsos (Revisión → Episodios y patrón, Hoy → «n episodios en 7 días», final del propio episodio) | Resumen de 30 días + comparación + lista |
| Preparación del módulo de impulsos (entorno, imagen futura, alternativas, gesto, espera) | Impulsos → «Preparar» (muestra los valores actuales) · dentro del episodio, en su vía | |
| Ajustes (tema, bloqueo, acompañamiento profesional, preguntas activas) | Ajustes | El acompañamiento se guarda en la base cifrada |
| Copia de seguridad / exportación | Archivo descargado | Incluye todo lo anterior |

Pendiente de revisar en la versión de terminal (el usuario pidió centrarse en la web).
| Sonidos: volumen y uso elegido (escribir, calmarse, dormir) | Sonidos y minirreproductor (sólo en este dispositivo, `localStorage`; no son datos personales) | No entran en copias ni exportación |
| Atajo biométrico (id de la passkey, identificador fijo de usuario, sales, IV y clave del contenedor envuelta) | Pantalla de desbloqueo · Ajustes → Seguridad (sólo en este dispositivo, `IndexedDB`; sin el autenticador del sistema no abre nada) | No entra en copias ni exportación; se elimina al restaurar o borrar todo |
| Invitación a apoyar (primer uso, aplazamiento, «no mostrar más») | Hoy (tarjeta) · Ajustes → Apoyar | En la base cifrada (`settings`); no son datos personales |
| Fallos seguidos al desbloquear (contador y hasta cuándo esperar) | Pantalla de desbloqueo (sólo en este dispositivo, `localStorage`; no son datos personales) | No entran en copias ni exportación |
| Sesión de meditación (duración, cómo te sentiste, bandera de experiencia desagradable, notas) | Meditar → Tus sesiones (lista y detalle) | Las empezadas y no terminadas se descartan |
| Preferencias de meditación (duración, voz, vibración, gong, fondo) | Meditar (se recuerdan) | En la base cifrada (`settings`) |
