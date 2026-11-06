# Guía de uso

Remanso se maneja sólo con el teclado. En cualquier pantalla, `?` muestra la ayuda
de esa pantalla (en los editores, `F1`). `Esc` vuelve atrás sin perder nada;
`Ctrl+L` bloquea; `Ctrl+Q` guarda y sale.

## Primer uso

1. Elige una contraseña (mínimo 8 caracteres) y repítela. **No se guarda en ningún
   sitio: si la olvidas, los datos no se pueden recuperar.**
2. Elige tema (oscuro/claro) y juego de caracteres (Unicode/ASCII). Todo se puede
   cambiar después en Ajustes.
3. Entras en Inicio con el diario y los cuadernos vacíos. Nada más existe hasta
   que lo crees.

## Inicio

| Tecla | Sección |
|---|---|
| `d` | Diario |
| `c` | Cuadernos |
| `t` | Tareas |
| `o` | Objetivos |
| `i` | Impulso (abre la pausa STOP en una pulsación) |
| `r` | Revisión (apertura, cierre, semanal, objetivo, patrón, preparación) |
| `p` | Recordatorios |
| `/` | Buscar en todo |
| `,` | Ajustes |

Inicio muestra, sólo si existen: recordatorios vencidos (máximo tres), las acciones
previstas para hoy con su estado (hueco ≠ fallo) y si hay una revisión disponible.
Si vuelves tras tres o más días, un único aviso neutro resume lo pendiente.

## Diario

`n` nueva entrada; `Intro` abrir; `D` borrar (pide confirmación); `/` buscar.
En el editor: `Ctrl+T` título, `Ctrl+G` etiquetas, `Ctrl+F` modo sólo texto,
`Ctrl+Z`/`Ctrl+Y` deshacer/rehacer, `Ctrl+←/→` por palabras. Se guarda solo a los
dos segundos de dejar de escribir y al salir. Una entrada vacía desaparece al salir.
Las líneas que empiezan por `#`, `-`, `*` o `>` se resaltan.

## Cuadernos

`n` crea un cuaderno; dentro, `n` crea una nota (pide título). `p` fija una nota
arriba, `x` archiva (reversible), `a` muestra archivados, `D` borra. En una nota,
`[[Título de otra nota]]` crea un enlace; `Ctrl+O` abre el primero.

## Tareas

Vistas con `Tab` o `1`–`6`: Hoy, Próximas, Sin fecha, Hechas, Proyectos, Calendario.
`n` nueva; `espacio` hecha; `z` aplazar (pide a qué día); `s` día previsto; `f`
fecha límite; `p` prioridad; `r` repetición («cada día», «laborables», «L X V»,
«cada 2 semanas», «día 15»); `P` proyecto; `S` subtarea; `c` cerrar sin hacer;
`Intro` ficha con notas y subtareas.

Las tareas con fecha pasada aparecen como **pendientes** con su fecha original.
Al aplazar una tarea por tercera vez, `R` ofrece una revisión de un minuto con
cinco preguntas (¿sigue importando?, ¿primer paso de 15 minutos?, ¿falta algo?,
¿es desagradable?, ¿qué día exactamente?). Nunca hay reproches.

Fechas aceptadas: `hoy`, `mañana`, `lun`…`dom`, `+3`, `20`, `15/12`, `2027-01-02`,
`ninguna`.

## Recordatorios

`n` nuevo (título, momento como «mañana 9:00», «lun 18:30», «+2h», y repetición
opcional). `d` cierra (si se repite, pasa a la siguiente fecha desde hoy, sin
acumular avisos atrasados); `z` pospone a un momento concreto; `e` reprograma.
Un aviso que ya se mostró dos veces invita a revisarlo en vez de insistir.

## Objetivos

`n` crea un objetivo: nombre (verbo + cantidad + contexto), tipo (proceso por
defecto, resultado o aprendizaje) y categoría de una lista cerrada. La primera vez
se muestra un aviso: Remanso no es un servicio sanitario. Algunas categorías
(alcohol u otras sustancias, alimentación/peso, juego, hacerse daño, pensamientos de
muerte) muestran, una sola vez, una nota que sugiere ayuda profesional y no bloquea
nada.

La ficha tiene cinco pestañas (`Tab` o `1`–`5`):

- **Resumen**: por qué, cuándo y dónde, cómo sabré que va bien, horizonte, revisión.
  `p` pausa, `c` cierra con un motivo neutro (alcanzado, sustituido, no alcanzable
  ahora, ya no me importa) y pregunta, opcionalmente, qué has aprendido; la
  respuesta se guarda en el diario.
- **Métricas**: `n` nueva (tipo: número, sí/no, escala, duración, cantidad, hora,
  texto). `m` registra un valor de hoy; `M` de otro día; `Intro` muestra la
  evolución: tendencia (media de 7 días), puntos crudos, comparación con la semana
  anterior y la nota de que las variaciones de un día a otro son normales. Hasta
  tener registros suficientes no se dibuja tendencia. Las métricas sensibles
  (peso, alimentación) se activan con un aviso explícito, se observan por defecto y
  nunca tienen colores rojo/verde ni rachas. `x` pausa conservando los registros.
- **Hitos**: `n` nuevo (manual, N veces de una acción, N semanas manteniendo la
  frecuencia, valor de una métrica, fecha). `r` reprograma conservando el
  historial; `espacio` marca alcanzado los manuales.
- **Acciones**: `n` nueva con frecuencia semanal («3 veces por semana») y señal
  («al terminar de cenar»). `espacio` cicla hoy: hecha → no hecha → sin registro.
  Se muestra «2 de 3 esta semana», «11 de los últimos 30 días» y la semana en
  puntos; nunca «racha rota».
- **Planes**: `n` escribe «Si [situación concreta] → [acción]». Si la situación es
  vaga («cuando pueda») se avisa, pero se puede guardar. Se recuerda a los 7 y 14
  días; `Intro` responde «¿te sirvió?».

## Impulso

`i` desde Inicio. Si hay objetivos activos, elige a cuál se refiere (o ninguno).
Después: tarjeta STOP e intensidad (0–10, opcional) → qué había antes → contexto →
vía (surfear, respirar, alternativa preparada, pensar a largo plazo, respuesta
competidora) → espera activa con pasos (`Intro` avanza; se muestra el tiempo
transcurrido, nunca una cuenta atrás; `t` termina) → intensidad → qué pasó («no lo
hice», «en parte», «lo hice», «no lo sé», «prefiero no decirlo») → nota opcional.
Si «lo hice», una pantalla breve recoge qué viste antes y un paso pequeño para la
próxima vez, sin culpa. `Esc` guarda lo que haya en cualquier momento.

En Revisión → *Preparar el módulo de impulsos* se anotan los cambios en el entorno,
la imagen futura, tres alternativas, la respuesta competidora y los minutos de
espera (5–20). En Revisión → *Patrón de impulsos* se ven recuentos descriptivos de
7 y 30 días.

## Revisión

Las preguntas de apertura, cierre y revisión semanal se activan en Ajustes (están
desactivadas al instalar). Una sesión guiada al día como máximo; cada pregunta es
omisible (`s`); `Esc` termina guardando lo respondido. La tercera pregunta del
cierre crea tareas para mañana separadas por «;». La revisión de objetivo muestra
tu «por qué» y los datos de cuatro semanas y acaba en una decisión: mantener,
ajustar, pausar o cerrar.

## Ajustes

Tema, caracteres, bloqueo por inactividad, asteriscos en la contraseña, preguntas
de apertura/cierre/semanal, día de la revisión semanal, cambiar la contraseña,
copia de seguridad cifrada, exportación en claro (con confirmación), verificación
de integridad, catálogo de técnicas con su nivel de evidencia, «Si necesitas
ayuda» y Acerca de.

## Línea de órdenes

```
remanso --dir RUTA        directorio de datos
remanso --ascii           sólo ASCII
remanso --backup RUTA     copia cifrada (pide la contraseña)
remanso --restore RUTA    restaurar (conserva la base anterior)
remanso --export DIR      exportar TODO en claro (Markdown + JSON)
remanso --check           integridad
remanso --bench           mediciones
```

La contraseña nunca se pasa por argumentos ni variables de entorno.
