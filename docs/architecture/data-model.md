# Modelo de datos de Remanso

Estado: esquema **v5** (`storage::migrations::CURRENT_VERSION = 5`). Fuente de verdad: `src/storage/migrations.rs`. Este documento describe cada tabla tal y como la crean las migraciones y cómo la usa el código de `src/domain/`. Cuando el comentario SQL del esquema y el código discrepan en los valores admitidos, se indica explícitamente: manda el código.

## 1. Convenciones

| Convención | Detalle |
|---|---|
| Identificadores | `id INTEGER PRIMARY KEY` (alias de `rowid`). `domain::Id = i64`. |
| Marcas de tiempo | `INTEGER`, segundos Unix (UTC): `created_at`, `updated_at`, `archived_at`, `deleted_at`, `completed_at`, `due_at`, `started_at`, `measured_at`, `logged_at`, `answered_at`, `changed_at`, `at`. Se escriben con `dates::now_ts()`. |
| Días de calendario | `TEXT 'AAAA-MM-DD'` en la zona horaria local del usuario: `day`, `due_day`, `scheduled_day`, `started_on`, `horizon_on`, `target_day`. Se escriben con `dates::date_to_iso`. Permite `ORDER BY` y `BETWEEN` léxicos y que «el día» no cambie si cambia la zona horaria. |
| Vigencia | `archived_at IS NULL` = vigente. Archivar nunca borra y es reversible (`set_archived(false)` pone `NULL`). `paused_at` en `actions` funciona igual. |
| Borrado lógico | Sólo `diary_entries.deleted_at`. Todas las consultas del diario filtran `deleted_at IS NULL`, pero ninguna función actual la asigna: `diary::delete` hace un `DELETE` real (coherente con `PRAGMA secure_delete`). La columna queda reservada para una papelera futura. |
| Texto | Siempre `TEXT`; los campos de texto obligatorio llevan `NOT NULL DEFAULT ''`, los opcionales admiten `NULL` (`title` del diario). |
| Booleanos | `INTEGER` 0/1 (`pinned`, `sensitive`, `done`, `safety_shown`). |
| Enumeraciones | `TEXT` con claves en inglés en minúsculas y guiones bajos; la etiqueta en español la da el código (`label()`). Las reglas de repetición y los horarios son cadenas compactas propias (§3). |
| Claves foráneas | `PRAGMA foreign_keys = ON` en cada conexión, así que `ON DELETE CASCADE` y `ON DELETE SET NULL` se aplican. Las **«FK blandas»** son columnas `*_id` sin `REFERENCES`, porque la tabla destino no existía aún al crearlas (v1 y v2 referencian `goals`, que llega en v3) o porque el destino es polimórfico; el código las trata como opcionales y no espera integridad. |
| Búsqueda | Tablas FTS5 de contenido externo dentro del mismo fichero cifrado (§4). |
| Ajustes | Pares clave/valor en `settings` (§6). |

## 2. Diagrama entidad-relación

```
 settings (clave/valor)                        tags ──< taggings (entity_kind, entity_id) ···> diary_entries | notes | tasks | goals
                                                                                                                      (polimórfico, blando)

 notebooks ──< notes ──[notes_fts]                    diary_entries ──[diary_fts]
     ▲                                                     ┆ goal_id (blando)
     │ notebook_id (SET NULL)                              ▼
     │                                                 ┌───────┐
 projects ──< tasks ──< tasks (parent_id, CASCADE)     │ goals │◄──────────────────────────────────────┐
     ┆ goal_id (blando)   ┆ goal_id (blando)           └┬┬┬┬┬┬─┘                                      │
                                                        ││││││ goal_id                                  │
          CASCADE  ─────────────────────────────────────┘│││││                                          │
            milestones ──< milestone_history             │││││ SET NULL                                 │
                ┆ metric_id (SET NULL) ─────────────────►│││││── metrics ──< measurements (CASCADE)     │
                ┆ action_id (blando) ·······►            ││││└── actions ──< action_log (CASCADE)       │
                                                         ││││       ▲ action_id (SET NULL)              │
                                                         │││└────── if_then_plans ──< plan_reviews      │
                                                         ││└─────── strategies                          │
                                                         ││             ▲ strategy_id (SET NULL)        │
                                                         │└──────── impulse_episodes                    │
                                                         └───────── reviews ◄··· prompt_answers.review_id (blando)
          CASCADE ───────────────────────────────────────── prompts ──< prompt_answers (CASCADE)

 reminders  ┆ ref_kind/ref_id (blando) ···> if_then_plans ('plan') | tasks | goals | reviews

 Leyenda:  ──<  uno a muchos con FK real     ···>  FK blanda (sin REFERENCES)     [x_fts]  índice FTS5 externo
```

## 3. Tablas

Las tablas aparecen en el orden de las migraciones. «Escrita por» indica el módulo de `src/domain/` (o de `src/app/`) que la gestiona.

### v1 — núcleo

#### `settings`

Pares clave/valor de configuración que debe vivir **dentro del cifrado** (a diferencia de `prefs.json`). Escrita por `Db::set_setting`; leída con `setting`, `setting_bool` («1» o «true»), `setting_i64`.

| Columna | Tipo | Significado |
|---|---|---|
| `key` | TEXT PK | Nombre del ajuste |
| `value` | TEXT NOT NULL | Valor como texto |

Claves en uso: §6.

#### `diary_entries`

Entradas del diario. Una entrada se crea vacía al pulsar `n` y se borra sin aviso al salir si sigue vacía. Escrita por `domain::diary`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `created_at` | INTEGER NOT NULL | Creación |
| `updated_at` | INTEGER NOT NULL | Último guardado (autoguardado a 2 s) |
| `day` | TEXT NOT NULL | Día local de la entrada; ordena la lista y el calendario |
| `title` | TEXT | Título opcional (`NULL` si vacío) |
| `body` | TEXT NOT NULL DEFAULT '' | Cuerpo en Markdown ligero |
| `goal_id` | INTEGER | **FK blanda** a `goals` (vínculo opcional; `diary::set_goal`, `diary::for_goal`) |
| `deleted_at` | INTEGER | Borrado lógico, reservado (§1) |

Índice: `diary_entries_day (day DESC, created_at DESC)`. FTS: `diary_fts` (§4). Etiquetas: `taggings` con `entity_kind = 'diary'`.

#### `notebooks`

Cuadernos (colecciones de notas). Escrita por `domain::notebooks`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Nombre |
| `description` | TEXT NOT NULL DEFAULT '' | Descripción |
| `position` | INTEGER NOT NULL DEFAULT 0 | Orden manual (`max(position)+1` al crear) |
| `created_at` | INTEGER NOT NULL | |
| `archived_at` | INTEGER | Archivado reversible |

#### `notes`

Notas de un cuaderno. Admiten enlaces `[[Título]]` resueltos por `notebooks::wiki_links` y `find_note_by_title`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `notebook_id` | INTEGER NOT NULL → `notebooks(id)` **ON DELETE CASCADE** | Cuaderno |
| `title` | TEXT NOT NULL DEFAULT '' | |
| `body` | TEXT NOT NULL DEFAULT '' | |
| `pinned` | INTEGER NOT NULL DEFAULT 0 | 1 = fijada arriba |
| `created_at` | INTEGER NOT NULL | |
| `updated_at` | INTEGER NOT NULL | |
| `archived_at` | INTEGER | |

Índice: `notes_notebook (notebook_id, archived_at, pinned DESC, updated_at DESC)`: cubre exactamente la consulta del listado. FTS: `notes_fts`.

#### `tags` y `taggings`

Etiquetado polimórfico opcional. Escrita por `domain::tags`.

`tags`

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL UNIQUE COLLATE NOCASE | Nombre normalizado a minúsculas y sin `#` inicial |

`taggings`

| Columna | Tipo | Significado |
|---|---|---|
| `tag_id` | INTEGER NOT NULL → `tags(id)` **CASCADE** | |
| `entity_kind` | TEXT NOT NULL | `'diary'`, `'note'`, `'task'`, `'goal'` según el esquema; **el código actual sólo escribe `'diary'`** |
| `entity_id` | INTEGER NOT NULL | **FK blanda** polimórfica |

PK compuesta `(tag_id, entity_kind, entity_id)`; índice `taggings_entity (entity_kind, entity_id)`. `set_tags` reemplaza el conjunto de la entidad y después elimina las etiquetas que ya no usa nadie (`DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM taggings)`). Borrar una entrada del diario **no** limpia sus filas de `taggings` (quedan huérfanas hasta la siguiente `set_tags` sobre esa misma `entity_id`).

### v2 — organización personal

#### `projects`

Agrupación de tareas. Escrita por `domain::tasks` (`create_project`, `rename_project`, `set_project_archived`, `delete_project`).

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | |
| `description` | TEXT NOT NULL DEFAULT '' | |
| `goal_id` | INTEGER | **FK blanda** a `goals` |
| `created_at` | INTEGER NOT NULL | |
| `archived_at` | INTEGER | |

#### `tasks`

Tareas y subtareas. Escrita por `domain::tasks`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `project_id` | INTEGER → `projects(id)` **SET NULL** | Proyecto opcional |
| `parent_id` | INTEGER → `tasks(id)` **CASCADE** | Tarea padre (subtareas); borrar el padre borra las hijas |
| `goal_id` | INTEGER | **FK blanda** a `goals` |
| `title` | TEXT NOT NULL | |
| `notes` | TEXT NOT NULL DEFAULT '' | Ficha (editor con autoguardado). `drop_task` añade «Cerrada: …» al final |
| `status` | TEXT NOT NULL DEFAULT 'open' | `open` abierta · `done` hecha · `dropped` cerrada sin hacer («ya no importa»; decisión, no fallo) |
| `priority` | INTEGER NOT NULL DEFAULT 0 | `0` normal · `1` alta · `-1` baja |
| `due_day` | TEXT | Fecha límite opcional |
| `scheduled_day` | TEXT | Día en que se piensa hacer |
| `recurrence` | TEXT | Regla compacta (abajo) o `NULL` |
| `postpone_count` | INTEGER NOT NULL DEFAULT 0 | Veces aplazada; al llegar a `POSTPONE_REVIEW_THRESHOLD = 3` la interfaz ofrece la revisión de aplazamientos |
| `last_postponed_at` | INTEGER | Último aplazamiento |
| `created_at` | INTEGER NOT NULL | |
| `updated_at` | INTEGER NOT NULL | |
| `completed_at` | INTEGER | Se rellena tanto en `done` como en `dropped` |

Índices: `tasks_status_day (status, scheduled_day, due_day)`, `tasks_project (project_id)`, `tasks_parent (parent_id)`.

Al completar una tarea con `recurrence`, `tasks::complete` inserta la **siguiente aparición** como fila nueva (misma `title`, `notes`, `priority`, `project_id`, `parent_id`, `goal_id`, `recurrence`) calculada desde `max(scheduled_day o due_day, hoy)`, para no generar una cola de apariciones vencidas.

**Regla de repetición** (`domain::recurrence::Rule`, compartida por `tasks.recurrence` y `reminders.repeat`):

| Almacenado | Significado | Entrada humana aceptada |
|---|---|---|
| `daily` | cada día | «diario», «cada día» |
| `weekdays:LMXJVSD` | los días indicados (L lunes … D domingo) | «L X V», «laborables» |
| `every:N:d` / `every:N:w` / `every:N:m` | cada N días / semanas / meses | «cada 10 días», «cada 2 semanas», «semanal» |
| `monthly:D` | el día D de cada mes (recortado al último día si no existe) | «mensual», «día 15» |

#### `reminders`

Recordatorios locales. No hay proceso residente: se comprueban al desbloquear y en cada vuelta del bucle de eventos (`next_due_at` despierta el bucle). Escrita por `domain::reminders` y por `domain::plans` (refuerzos).

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `title` | TEXT NOT NULL | Texto del aviso |
| `due_at` | INTEGER NOT NULL | Próxima aparición |
| `repeat` | TEXT | Regla compacta (§ `tasks`) o `NULL` |
| `ref_kind` | TEXT | Entidad origen: `'task'`, `'goal'`, `'plan'`, `'review'` o `NULL`. **El código actual sólo escribe `'plan'`** (refuerzos de un plan si-entonces) |
| `ref_id` | INTEGER | **FK blanda** según `ref_kind` |
| `snoozed_until` | INTEGER | Posposición; el momento efectivo es `coalesce(snoozed_until, due_at)` |
| `shown_count` | INTEGER NOT NULL DEFAULT 0 | Veces mostrado desde la última aparición |
| `max_shows` | INTEGER NOT NULL DEFAULT 3 | Insistencia máxima; **el código inserta `MAX_SHOWS_DEFAULT = 2`**. Al alcanzarlo (`needs_review`) la interfaz ofrece revisar en lugar de volver a avisar |
| `created_at` | INTEGER NOT NULL | |
| `done_at` | INTEGER | Descartado/completado (sin repetición) |
| `archived_at` | INTEGER | |

Índice: `reminders_due (done_at, due_at)`. `dismiss` de un recordatorio con `repeat` no lo cierra: calcula la siguiente fecha desde `max(día de due_at, hoy)` conservando la hora, pone `snoozed_until = NULL` y `shown_count = 0`. Sin `repeat`, fija `done_at`.

### v3 — objetivos, métricas, hitos, acciones

#### `goals`

Objetivos personales. Motor genérico sin pantallas por tipo de cambio. Escrita por `domain::goals`. Las cinco últimas columnas llegaron en **v5** (`ALTER TABLE … ADD COLUMN`).

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Formulado como verbo + conducta |
| `description` | TEXT NOT NULL DEFAULT '' | |
| `why` | TEXT NOT NULL DEFAULT '' | Motivo personal; se recuerda literalmente en la revisión del objetivo |
| `success_criteria` | TEXT NOT NULL DEFAULT '' | Criterio de éxito en palabras del usuario |
| `status` | TEXT NOT NULL DEFAULT 'active' | `active` activo · `paused` pausado · `achieved` alcanzado · `closed` cerrado |
| `started_on` | TEXT NOT NULL | Día de inicio (hoy al crear) |
| `horizon_on` | TEXT | Horizonte temporal opcional |
| `review_every_days` | INTEGER | Cada cuántos días «toca» revisar; `NULL` = sin revisión programada. **`goals::create` fija 7** |
| `last_reviewed_at` | INTEGER | Última revisión completada (`mark_reviewed`) |
| `notebook_id` | INTEGER → `notebooks(id)` **SET NULL** | Cuaderno asociado opcional |
| `created_at` | INTEGER NOT NULL | |
| `updated_at` | INTEGER NOT NULL | Cualquier `set_*` lo actualiza |
| `archived_at` | INTEGER | |
| `kind` (v5) | TEXT NOT NULL DEFAULT 'process' | `process` proceso (hacer algo con regularidad) · `outcome` resultado (llegar a un valor o estado) · `learning` aprendizaje (adquirir una habilidad) |
| `category` (v5) | TEXT NOT NULL DEFAULT 'general' | Clave de la lista cerrada `goals::CATEGORIES` (abajo); desconocida → `general` |
| `context` (v5) | TEXT NOT NULL DEFAULT '' | Contexto habitual (dónde/cuándo ocurre) |
| `close_reason` (v5) | TEXT | Al cerrar: `achieved` alcanzado · `replaced` sustituido por otro objetivo · `unreachable` no es alcanzable ahora · `not_important` ya no me importa |
| `safety_shown` (v5) | INTEGER NOT NULL DEFAULT 0 | 1 cuando ya se mostró, para este objetivo, el mensaje de derivación asociado a su categoría |

Categorías (`key` → etiqueta; `sensitive` activa avisos y opt-in; `red_flag` dispara una única vez el mensaje de derivación no bloqueante):

| `category` | Etiqueta | sensible | bandera |
|---|---|---|---|
| `general` | General | no | — |
| `project` | Proyecto personal (escribir, crear, estudiar) | no | — |
| `activity` | Actividad física | no | — |
| `sleep` | Sueño y descanso | no | — |
| `learning` | Aprender una habilidad | no | — |
| `time` | Gestión del tiempo y hábitos de trabajo | no | — |
| `reduce` | Reducir una conducta (móvil, compras, picoteo…) | no | — |
| `food_weight` | Controlar lo que como o mi peso | sí | `Eating` |
| `substance` | Dejar de beber alcohol o de consumir una sustancia | sí | `Substance` |
| `gambling` | Dejar de apostar | sí | `Gambling` |
| `self_harm` | Dejar de hacerme daño | sí | `SelfHarm` |

`due_for_review` devuelve los objetivos activos con `coalesce(last_reviewed_at, created_at) + review_every_days × 86400 <= ahora`; nunca se marcan como «vencidos».

#### `metrics`

Métricas genéricas asociadas (opcionalmente) a un objetivo. Escrita por `domain::metrics`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `goal_id` | INTEGER → `goals(id)` **SET NULL** | |
| `name` | TEXT NOT NULL | |
| `kind` | TEXT NOT NULL | Tipo de dato (abajo) |
| `unit` | TEXT NOT NULL DEFAULT '' | Unidad para `number`/`count` («kg», «páginas») |
| `direction` | TEXT NOT NULL DEFAULT 'none' | Sentido deseado (abajo) |
| `target_low` | REAL | Objetivo (o límite inferior en `range`) |
| `target_high` | REAL | Límite superior en `range` |
| `scale_min` | REAL | Mínimo de la escala (`scale`) |
| `scale_max` | REAL | Máximo de la escala |
| `frequency` | TEXT NOT NULL DEFAULT 'adhoc' | `daily` diaria · `weekly` semanal · `adhoc` cuando quiera. Sugerencia, nunca obligación |
| `sensitive` | INTEGER NOT NULL DEFAULT 0 | 1 = peso, alimentación, etc.: aviso único y tendencias suavizadas |
| `created_at` | INTEGER NOT NULL | |
| `archived_at` | INTEGER | Archivar nunca borra mediciones |

Índice: `metrics_goal (goal_id)`.

`kind` (el comentario del esquema lista `event`; el código no lo produce y sí produce `time`):

| `kind` | Significado | Cómo se guarda la medición |
|---|---|---|
| `number` | número con unidad (72,4 kg; 5 km) | `value` |
| `yes_no` | sí / no | `value` 1/0 |
| `scale` | escala ordinal (0–10, 1–5) entre `scale_min` y `scale_max` | `value` |
| `duration` | duración en minutos | `value` |
| `count` | cantidad entera (páginas, sesiones) | `value` |
| `time` | hora del día (23:15), para regularidad horaria | `value` = minutos desde medianoche |
| `text` | texto breve | `text_value` |

`direction` (el esquema pone `none` por defecto; `Direction::parse` convierte cualquier valor no reconocido, incluido `none`, en `Observe`):

| `direction` | Significado |
|---|---|
| `up` | subir |
| `down` | bajar |
| `maintain` | mantener alrededor de un valor |
| `range` | mantenerse en un intervalo (`target_low`…`target_high`) |
| `observe` (`none`) | sólo observar |

#### `measurements`

Mediciones de una métrica. Escrita por `domain::metrics::record` / `delete_measurement`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `metric_id` | INTEGER NOT NULL → `metrics(id)` **CASCADE** | |
| `measured_at` | INTEGER NOT NULL | Instante del registro |
| `day` | TEXT NOT NULL | Día local al que se atribuye |
| `value` | REAL | Valor numérico (todos los `kind` salvo `text`) |
| `text_value` | TEXT | Valor textual (`kind = 'text'`) |
| `note` | TEXT NOT NULL DEFAULT '' | Nota libre |

Índice: `measurements_metric_time (metric_id, measured_at)`. `daily_series` agrega por `day` para las tendencias de `analysis::trend` (sin imputar huecos).

#### `milestones`

Hitos opcionales de un objetivo. Reprogramar no borra: se anota en `milestone_history`. Escrita por `domain::milestones`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `goal_id` | INTEGER NOT NULL → `goals(id)` **CASCADE** | |
| `title` | TEXT NOT NULL | |
| `kind` | TEXT NOT NULL | Cómo se alcanza (abajo) |
| `metric_id` | INTEGER → `metrics(id)` **SET NULL** | Para `metric_value` |
| `action_id` | INTEGER | **FK blanda** a `actions`, para `action_count` y `sustain_weeks` |
| `target_value` | REAL | Valor o recuento objetivo |
| `target_day` | TEXT | Fecha objetivo (`date`) |
| `position` | INTEGER NOT NULL DEFAULT 0 | Orden |
| `status` | TEXT NOT NULL DEFAULT 'pending' | `pending` pendiente · `reached` alcanzado · `dropped` descartado |
| `reached_at` | INTEGER | Cuándo se alcanzó |
| `notes` | TEXT NOT NULL DEFAULT '' | |
| `created_at` | INTEGER NOT NULL | |

`kind` (el comentario del esquema lista `sustain_days`, `phase` y `qualitative`; el código escribe los siguientes y al leer convierte `sustain_days` → `sustain_weeks` y cualquier otro valor → `manual`):

| `kind` | Significado | Evaluación automática (`milestones::evaluate`) |
|---|---|---|
| `metric_value` | una métrica llega a un valor | nivel actual (`trend::current_level`, media de 7 días en métricas ruidosas) ≥ objetivo, o ≤ si la métrica es `down` |
| `action_count` | una acción acumula N veces | `actions::total_done ≥ target_value` |
| `sustain_weeks` | mantener una acción N semanas | `summary.weeks_meeting_target ≥ target_value` |
| `date` | llegar a una fecha | `target_day ≤ hoy` |
| `manual` | fase o criterio que marco yo | nunca; sólo `mark_reached` |

#### `milestone_history`

Bitácora de cambios de un hito (`reschedule`, `set_target_value`).

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `milestone_id` | INTEGER NOT NULL → `milestones(id)` **CASCADE** | |
| `changed_at` | INTEGER NOT NULL | |
| `field` | TEXT NOT NULL | Columna cambiada (`target_day`, `target_value`) |
| `old_value` | TEXT | Valor anterior como texto |
| `new_value` | TEXT | Valor nuevo como texto |
| `note` | TEXT NOT NULL DEFAULT '' | Motivo escrito por el usuario |

#### `actions`

Acciones recurrentes vinculadas a un objetivo (lo que otras aplicaciones llaman «hábitos»). La medida principal es la frecuencia en ventana, nunca la racha. Escrita por `domain::actions`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `goal_id` | INTEGER → `goals(id)` **SET NULL** | |
| `name` | TEXT NOT NULL | |
| `cue` | TEXT NOT NULL DEFAULT '' | Señal o momento («después de desayunar») |
| `kind` | TEXT NOT NULL DEFAULT 'do' | `do` hacer · `avoid` dejar de hacer |
| `schedule` | TEXT NOT NULL DEFAULT 'daily' | Frecuencia prevista (abajo) |
| `created_at` | INTEGER NOT NULL | |
| `paused_at` | INTEGER | Pausada (reversible) |
| `archived_at` | INTEGER | |

`schedule` (`actions::Schedule`):

| Almacenado | Significado | `per_week()` |
|---|---|---|
| `daily` | cada día | 7 |
| `weekdays:LMXJVSD` | los días indicados | número de letras |
| `per_week:N` | N veces por semana, cualquier día (**por defecto 3** en la interfaz) | N |

#### `action_log`

Un registro por acción y día. Un hueco es un hueco: nunca se infiere «no hecha».

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `action_id` | INTEGER NOT NULL → `actions(id)` **CASCADE** | |
| `day` | TEXT NOT NULL | Día local |
| `done` | INTEGER NOT NULL DEFAULT 1 | `1` hecha · `0` registrada expresamente como no hecha |
| `note` | TEXT NOT NULL DEFAULT '' | |
| `logged_at` | INTEGER NOT NULL | |

Restricción `UNIQUE (action_id, day)`; `actions::log` hace *upsert* y `log(…, None, …)` borra la fila (vuelve a ser hueco).

### v4 — cambio conductual

#### `strategies`

Filas que vinculan un objetivo (o la configuración general, `goal_id IS NULL`) con una técnica del catálogo `interventions/builtin.json`. Tiene dos usos: (a) **configuración P0 del episodio de impulso** (`impulses::load_config` / `save_config`), guardada como una fila por técnica; (b) **vía elegida** en un episodio, referenciada desde `impulse_episodes.strategy_id`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `goal_id` | INTEGER → `goals(id)` **SET NULL** | `NULL` = configuración general |
| `technique` | TEXT NOT NULL | Clave del catálogo o pseudo-clave de configuración (abajo) |
| `name` | TEXT NOT NULL | Igual a `technique` cuando la crea el código |
| `instructions` | TEXT NOT NULL DEFAULT '' | Texto libre según la técnica |
| `wait_seconds` | INTEGER | Duración de la espera activa |
| `alternative` | TEXT NOT NULL DEFAULT '' | Alternativa concreta; listas separadas por salto de línea |
| `created_at` | INTEGER NOT NULL | |
| `archived_at` | INTEGER | |

Cómo usa cada `technique` las columnas (`goal_id` fijo):

| `technique` | `instructions` | `wait_seconds` | `alternative` |
|---|---|---|---|
| `espera_activa` | — | segundos de espera (`clamp(300, 1200)`, por defecto 600) | clave de la **última vía elegida** |
| `imagen_futura` | imagen del futuro que el usuario escribió | — | — |
| `distraccion_concreta` | — | — | distracciones preparadas, una por línea |
| `respuesta_competidora` | — | — | gesto incompatible |
| `entorno_checklist` | — | — | cambios en el entorno, uno por línea |
| `seguridad` | `yes` / `no` / `''` («¿es algo serio?») | — | — |
| `surfear_impulso`, `respiracion_lenta` | — | — | — (fila creada sólo por `set_pathway`, para que `impulse_episodes.strategy_id` tenga destino; las otras tres vías reutilizan la fila de configuración homónima) |

#### `if_then_plans`

Planes si–entonces («Si *situación*, entonces *respuesta*»). Escrita por `domain::plans`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `goal_id` | INTEGER → `goals(id)` **SET NULL** | |
| `action_id` | INTEGER → `actions(id)` **SET NULL** | Acción a la que apoya |
| `situation` | TEXT NOT NULL | La señal; `plans::is_vague` rechaza «cuando pueda», «algún día», etc. |
| `response` | TEXT NOT NULL | La respuesta |
| `created_at` | INTEGER NOT NULL | |
| `last_reviewed_at` | INTEGER | Última pregunta «¿te sirvió?» |
| `archived_at` | INTEGER | Archivar cierra (`done_at`) sus recordatorios de refuerzo pendientes |

Al crear con `boosters = true` se insertan dos `reminders` (`ref_kind = 'plan'`) a los 7 y 14 días a las 09:00 locales con el texto literal del plan. `plans::delete` borra antes esos recordatorios.

#### `plan_reviews`

Respuestas a «¿Te sirvió este plan?».

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `plan_id` | INTEGER NOT NULL → `if_then_plans(id)` **CASCADE** | |
| `at` | INTEGER NOT NULL | |
| `helpful` | TEXT NOT NULL | `yes` sí, me sirvió · `partly` en parte · `no` no · `not_used` no se dio la situación |
| `note` | TEXT NOT NULL DEFAULT '' | |

Dos `not_used` seguidos hacen que `plans::review` devuelva `true` y la interfaz ofrezca archivar el plan.

#### `impulse_episodes`

Un episodio del flujo «Impulso» (P1–P5). Todo paso es opcional; `Esc` guarda lo que haya (`close_if_open`). Escrita por `domain::impulses`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `started_at` | INTEGER NOT NULL | |
| `ended_at` | INTEGER | Fin (normal o por `Esc`) |
| `goal_id` | INTEGER → `goals(id)` **SET NULL** | Objetivo elegido, si lo hay |
| `strategy_id` | INTEGER → `strategies(id)` **SET NULL** | Fila de la vía elegida; `Episode.pathway` se obtiene con `LEFT JOIN strategies` y `Pathway::parse(technique)` |
| `context` | TEXT NOT NULL DEFAULT '' | Contextos marcados (texto) |
| `trigger_text` | TEXT NOT NULL DEFAULT '' | Qué había justo antes |
| `intensity_before` | INTEGER | 0..10, opcional |
| `intensity_after` | INTEGER | 0..10, opcional |
| `waited_seconds` | INTEGER | Segundos de espera activa |
| `outcome` | TEXT | `changed` no lo hice · `partly` en parte · `acted` lo hice · `unknown` no lo sé · `unsaid` prefiero no decirlo |
| `reflection` | TEXT NOT NULL DEFAULT '' | Nota final |

Índice: `impulse_time (started_at)`. `impulses::pattern` agrega los últimos 7 y 30 días (franjas horarias, desencadenantes, contextos, vías, intensidades medias, episodios con `acted` por semana) sin calcular ningún «porcentaje de éxito».

#### `prompts`

Preguntas de reflexión. **Nada se instala por defecto**: cada conjunto se activa desde Ajustes (`install_set`) y se desactiva archivando (`disable_set`, conservando las respuestas). Escrita por `domain::prompts`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `text` | TEXT NOT NULL | Texto de la pregunta (con `{why}`, `{n}`, `{accion}` ya sustituidos cuando procede) |
| `kind` | TEXT NOT NULL DEFAULT 'free' | `free` texto libre · `scale` escala numérica · `choice` elección |
| `options` | TEXT | Para `choice`: opciones separadas por `\|`; para `scale`: `min\|max` |
| `schedule` | TEXT NOT NULL | Conjunto al que pertenece (abajo) |
| `goal_id` | INTEGER → `goals(id)` **CASCADE** | Pregunta específica de un objetivo |
| `source_ref` | TEXT NOT NULL DEFAULT '' | Clave del catálogo de la que procede (`cierre_del_dia`, `plan_si_entonces`, `automaticidad_srbai`…) |
| `position` | INTEGER NOT NULL DEFAULT 0 | Orden dentro del conjunto |
| `created_at` | INTEGER NOT NULL | |
| `archived_at` | INTEGER | Conjunto desactivado |

`schedule` (el esquema menciona `event:<nombre>`; el código usa `srbai:<id>`):

| `schedule` | Conjunto | Plantillas instaladas |
|---|---|---|
| `open` | Apertura del día | 2 (`free`) |
| `close` | Cierre del día | 3 (`free`; la tercera crea tareas separando por «;») |
| `weekly` | Revisión semanal | 6 (4 `free`, 2 `choice`) |
| `goal_review` | Revisión de un objetivo | 5 (4 `choice`, 1 `free`), con `{why}` y `{n}` |
| `srbai:<action_id>` | Automaticidad (SRBAI) de una acción | 4 (`scale` `1\|5`), con `{accion}`; creadas por `ensure_srbai` |

Índice implícito: ninguno propio; se consulta por `schedule`.

#### `prompt_answers`

Respuestas a las preguntas.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `prompt_id` | INTEGER NOT NULL → `prompts(id)` **CASCADE** | |
| `answered_at` | INTEGER NOT NULL | |
| `day` | TEXT NOT NULL | Día local |
| `text` | TEXT NOT NULL DEFAULT '' | Respuesta libre o etiqueta elegida |
| `value` | REAL | Valor de escala (SRBAI 1–5) o índice |
| `review_id` | INTEGER | **FK blanda** a `reviews`: sesión en la que se respondió |

Índice: `prompt_answers_day (prompt_id, day)`. `reviews::empty_weekly_streak` cuenta sesiones semanales sin ninguna fila aquí para ofrecer desactivarla.

#### `reviews`

Sesiones de revisión. Como máximo una sesión guiada (`open`/`close`/`weekly`) completada al día. Escrita por `domain::reviews`.

| Columna | Tipo | Significado |
|---|---|---|
| `id` | INTEGER PK | |
| `kind` | TEXT NOT NULL | `open` apertura · `close` cierre · `weekly` semanal · `goal` revisión de objetivo |
| `goal_id` | INTEGER → `goals(id)` **SET NULL** | Para `goal` |
| `day` | TEXT NOT NULL | Día local |
| `started_at` | INTEGER NOT NULL | |
| `completed_at` | INTEGER | `NULL` = abandonada |
| `notes` | TEXT NOT NULL DEFAULT '' | |

Índice: `reviews_kind_day (kind, day)`. `weekly_available` exige que el conjunto `weekly` esté activo, que no haya sesión semanal completada desde el lunes y que el día de la semana sea ≥ `settings.weekly_review_day`.

## 4. Tablas FTS y triggers

`diary_fts` y `notes_fts` son tablas virtuales FTS5 de **contenido externo**:

```sql
CREATE VIRTUAL TABLE diary_fts USING fts5(
    title, body,
    content='diary_entries', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);
```

- No almacenan el texto, sólo el índice invertido; `rowid` coincide con `diary_entries.id` / `notes.id`. Las tablas sombra (`diary_fts_data`, `diary_fts_idx`, `diary_fts_docsize`, `diary_fts_config` y las equivalentes de `notes_fts`) viven en el mismo fichero cifrado: ningún índice queda fuera del cifrado. `export::dump_json` las excluye con `name NOT LIKE '%_fts%'`.
- `remove_diacritics 2` iguala «sueño»/«sueno», «caminó»/«camino».
- Tres triggers por tabla mantienen el índice. Como FTS5 de contenido externo no puede leer la fila antigua, el borrado y la actualización usan la orden especial `'delete'` con los valores **viejos**:

| Trigger | Evento | Acción |
|---|---|---|
| `diary_ai` / `notes_ai` | `AFTER INSERT` | `INSERT INTO x_fts(rowid, title, body) VALUES (new.id, new.title, new.body)` |
| `diary_ad` / `notes_ad` | `AFTER DELETE` | `INSERT INTO x_fts(x_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body)` |
| `diary_au` / `notes_au` | `AFTER UPDATE` | el `'delete'` anterior seguido del `INSERT` con `new.*` |

- Consulta: `domain::search::fts_query` convierte cada palabra en `"palabra"*` (prefijo, sin interpretar sintaxis) y `search_all` une `diary_fts MATCH ?` (filtrando `deleted_at IS NULL`) con `notes_fts MATCH ?`, ordenadas por `rank`, con `snippet()` de 14 tokens.
- Mantenimiento: `Db::check()` ejecuta `INSERT INTO x_fts(x_fts) VALUES ('integrity-check')`; `Db::rebuild_search()` ejecuta `('rebuild')` tras una restauración, ya que `sqlcipher_export` copia las tablas sombra pero conviene regenerarlas.

## 5. Qué se borra en cascada y qué se conserva

Con `PRAGMA foreign_keys = ON`, un `DELETE` sobre una fila padre produce:

| Al borrar… | Se borra en cascada | Queda a `NULL` | Se conserva intacto (FK blanda) |
|---|---|---|---|
| `notebooks` | `notes` (y su índice `notes_fts` vía trigger) | `goals.notebook_id` | — |
| `diary_entries` | su índice `diary_fts` (trigger) | — | `taggings` con `entity_kind='diary'` (huérfanas hasta la siguiente `set_tags`) |
| `tags` | `taggings` | — | — |
| `projects` | — | `tasks.project_id` | `projects.goal_id` no afecta a `goals` |
| `tasks` | subtareas (`parent_id`) y sus subtareas | — | `reminders` con `ref_kind='task'` (si existieran) |
| `goals` | `milestones` → `milestone_history`; `prompts` con `goal_id` → `prompt_answers` | `metrics.goal_id`, `actions.goal_id`, `strategies.goal_id`, `if_then_plans.goal_id`, `impulse_episodes.goal_id`, `reviews.goal_id` | `diary_entries.goal_id`, `projects.goal_id`, `tasks.goal_id`, `reminders.ref_id` |
| `metrics` | `measurements` | `milestones.metric_id` | — |
| `actions` | `action_log` | `if_then_plans.action_id` | `milestones.action_id` (el hito deja de poder evaluarse) |
| `strategies` | — | `impulse_episodes.strategy_id` (el episodio pierde su vía) | — |
| `if_then_plans` | `plan_reviews`; además `plans::delete` borra antes los `reminders` con `ref_kind='plan'` | — | — |
| `prompts` | `prompt_answers` | — | — |
| `reviews` | — | — | `prompt_answers.review_id` |
| `reminders` | — | — | — |

Regla general del producto: **archivar, no borrar**. Las funciones `set_archived`, `archive`, `set_paused` y `disable_set` ponen una marca de tiempo y se revierten; los borrados reales (`delete`, `delete_notebook`, `delete_project`, `drop_task` no es borrado) pasan por un `Modal::Confirm` con `destructive: true` en la interfaz, salvo las entradas y notas **vacías**, que se eliminan al salir del editor sin preguntar. Con `PRAGMA secure_delete = ON`, lo borrado se sobrescribe dentro de las páginas antes de volver a cifrarlas.

## 6. Claves de `settings` en uso

Todas se leen con valor por defecto si no existen; ninguna se crea al inicializar la base.

| Clave | Tipo lógico | Escrita en | Significado |
|---|---|---|---|
| `last_open` | entero (segundos Unix) | `App::after_unlock` | Última apertura. Si han pasado ≥ 3 días y hay tareas pendientes o recordatorios vencidos, se muestra un único aviso neutro de bienvenida. |
| `goals_safety_shown` | booleano («1») | `app/goals.rs`, al pulsar `n` en Objetivos por primera vez | Ya se mostró el aviso «Antes de empezar / No es un servicio sanitario» (safety.md §1.3). |
| `sensitive_warning_shown` | booleano | `app/goals.rs`, al crear la primera métrica marcada sensible | Ya se mostró el aviso sobre métricas sensibles (peso, alimentación) (safety.md §5.6). |
| `harm_warning_shown` | booleano | `app/impulse.rs`, al responder «sí» a «¿hubo daño?» tras un desliz | Ya se mostró el mensaje de derivación base. |
| `serious_warning_shown` | booleano | `app/impulse.rs`, al marcar «es algo serio» en la preparación P0 | Ya se mostró la derivación base más el texto específico de la categoría con bandera (`substance`, `food_weight`, `self_harm`/`suicidal`). |
| `weekly_review_day` | entero 0–6 (0 = lunes) | Ajustes → «Día de la revisión semanal» (`app/settings.rs`) | Día a partir del cual la revisión semanal se da por disponible; por defecto 6 (domingo). Leída en `app/review.rs`. |

Las banderas `*_shown` se guardan aquí y no en `prefs.json` porque revelan algo sobre el contenido (qué categorías de objetivo ha tocado el usuario). La preferencia de aspecto, bloqueo y eco de contraseña va, en cambio, a `prefs.json` porque se necesita **antes** de desbloquear.

## 7. Ficheros en claro

El directorio de datos contiene exactamente dos ficheros JSON legibles sin contraseña. Ninguno contiene datos del usuario ni material que debilite el cifrado.

### `kdf.json`

Escrito por `crypto::KdfParams::save` con `write_atomic` y permisos 0600; también se copia en cada copia de seguridad.

```json
{
  "version": 1,
  "algorithm": "argon2id",
  "salt": "Qm3xP9…24 caracteres…",
  "m_kib": 32768,
  "t": 3,
  "p": 1,
  "key_len": 32
}
```

| Campo | Significado |
|---|---|
| `version` | Versión del formato del fichero (1) |
| `algorithm` | Siempre `argon2id`; otro valor → `CryptoError::Unsupported` |
| `salt` | 24 caracteres alfanuméricos (~143 bits). Sus bytes UTF-8 son la sal real |
| `m_kib`, `t`, `p` | Memoria (KiB), pasadas y paralelismo de Argon2id |
| `key_len` | Longitud de la clave derivada; debe ser 32 |

**Por qué no es sensible.** Una sal es pública por definición: su función es impedir tablas precalculadas, no mantenerse secreta. Conocer la sal y los parámetros no acerca a nadie a la clave sin la contraseña; cada intento sigue costando los 32 MiB y 3 pasadas de Argon2id. Al contrario, guardarla en claro y en formato imprimible es lo que permite recuperar los datos sin Remanso con la herramienta `argon2` de línea de órdenes y `sqlcipher`. Lo que sí es crítico es **no perderla**: sin `kdf.json` la contraseña no sirve de nada, por eso `Db::open` exige su presencia (`DataDir::exists` comprueba ambos ficheros), la copia de seguridad la incluye y la restauración la deriva de la copia. Al cambiar la contraseña se genera una sal nueva y el fichero se reescribe sólo después de que `PRAGMA rekey` haya terminado.

### `prefs.json`

Escrito por `prefs::Prefs::save`. Se lee **antes** de desbloquear porque se necesita para dibujar la pantalla de bloqueo.

```json
{
  "theme": "dark",
  "ascii": false,
  "lock_after_minutes": 10,
  "password_feedback": true
}
```

| Campo | Valores | Significado |
|---|---|---|
| `theme` | `dark` / `light` | Tema de color |
| `ascii` | booleano | Juego de caracteres ASCII en lugar de Unicode |
| `lock_after_minutes` | 0, 5, 10, 15, 30, 60 | Minutos de inactividad antes de bloquear; 0 = nunca |
| `password_feedback` | booleano | Mostrar asteriscos al escribir la contraseña |

**Por qué no es sensible.** Son preferencias de presentación idénticas para cualquier usuario; no dicen nada de lo que hay dentro de la base ni de quién la usa. Se deserializan con `#[serde(default)]`: un fichero ausente o corrupto produce los valores por defecto sin error. Cualquier ajuste que pudiera revelar contenido (las banderas de avisos, el día de revisión) va a la tabla `settings`, dentro del cifrado.

### Lo que no hay en claro

No existen ficheros de caché, índices externos, registros (*logs*) ni volcados: `temp_store = MEMORY` impide temporales de SQLite en disco, el WAL (`remanso.db-wal`) va cifrado página a página y `remanso.db-shm` es sólo el índice de memoria compartida del WAL (punteros a páginas, sin contenido). La exportación en claro (`--export`) es la única excepción y exige confirmación explícita.
