//! Esquema de la base de datos, por versiones. Cada entrada se aplica dentro de
//! una transacción y actualiza `PRAGMA user_version`. Nunca se edita una
//! migración ya publicada: se añade otra.
//!
//! Convenciones:
//! - Marcas de tiempo: INTEGER, segundos Unix (UTC).
//! - Fechas de calendario (día local del usuario): TEXT 'AAAA-MM-DD'.
//! - `archived_at`/`deleted_at` NULL = vigente. Archivar nunca borra.
//! - Texto libre siempre en columnas TEXT; las FTS son tablas de contenido
//!   externo dentro de la misma base cifrada (ningún índice fuera del cifrado).

pub const MIGRATIONS: &[&str] = &[
    // v1 — núcleo: diario, cuadernos, etiquetas, ajustes.
    r#"
    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE diary_entries (
        id          INTEGER PRIMARY KEY,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        day         TEXT    NOT NULL,          -- fecha local de la entrada
        title       TEXT,
        body        TEXT    NOT NULL DEFAULT '',
        goal_id     INTEGER,                   -- vínculo opcional (FK blanda; goals llega en v3)
        deleted_at  INTEGER
    );
    CREATE INDEX diary_entries_day ON diary_entries(day DESC, created_at DESC);

    CREATE VIRTUAL TABLE diary_fts USING fts5(
        title, body,
        content='diary_entries', content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER diary_ai AFTER INSERT ON diary_entries BEGIN
        INSERT INTO diary_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;
    CREATE TRIGGER diary_ad AFTER DELETE ON diary_entries BEGIN
        INSERT INTO diary_fts(diary_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
    END;
    CREATE TRIGGER diary_au AFTER UPDATE ON diary_entries BEGIN
        INSERT INTO diary_fts(diary_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
        INSERT INTO diary_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;

    CREATE TABLE notebooks (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        description TEXT    NOT NULL DEFAULT '',
        position    INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        archived_at INTEGER
    );

    CREATE TABLE notes (
        id          INTEGER PRIMARY KEY,
        notebook_id INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
        title       TEXT    NOT NULL DEFAULT '',
        body        TEXT    NOT NULL DEFAULT '',
        pinned      INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        archived_at INTEGER
    );
    CREATE INDEX notes_notebook ON notes(notebook_id, archived_at, pinned DESC, updated_at DESC);

    CREATE VIRTUAL TABLE notes_fts USING fts5(
        title, body,
        content='notes', content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;
    CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
    END;
    CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
        INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
    END;

    CREATE TABLE tags (
        id   INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    -- Etiquetado polimórfico: entity_kind ∈ {'diary','note','task','goal'}.
    CREATE TABLE taggings (
        tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        entity_kind TEXT    NOT NULL,
        entity_id   INTEGER NOT NULL,
        PRIMARY KEY (tag_id, entity_kind, entity_id)
    );
    CREATE INDEX taggings_entity ON taggings(entity_kind, entity_id);
    "#,
    // v2 — organización personal: proyectos, tareas, recordatorios.
    r#"
    CREATE TABLE projects (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        description TEXT    NOT NULL DEFAULT '',
        goal_id     INTEGER,
        created_at  INTEGER NOT NULL,
        archived_at INTEGER
    );

    CREATE TABLE tasks (
        id            INTEGER PRIMARY KEY,
        project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        parent_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        goal_id       INTEGER,
        title         TEXT    NOT NULL,
        notes         TEXT    NOT NULL DEFAULT '',
        status        TEXT    NOT NULL DEFAULT 'open',   -- open | done | dropped
        priority      INTEGER NOT NULL DEFAULT 0,        -- 0 normal, 1 alta, -1 baja
        due_day       TEXT,                              -- fecha límite (opcional)
        scheduled_day TEXT,                              -- día en que se piensa hacer
        recurrence    TEXT,                              -- regla compacta, ver domain/recurrence.rs
        postpone_count INTEGER NOT NULL DEFAULT 0,
        last_postponed_at INTEGER,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        completed_at  INTEGER
    );
    CREATE INDEX tasks_status_day ON tasks(status, scheduled_day, due_day);
    CREATE INDEX tasks_project ON tasks(project_id);
    CREATE INDEX tasks_parent ON tasks(parent_id);

    CREATE TABLE reminders (
        id          INTEGER PRIMARY KEY,
        title       TEXT    NOT NULL,
        due_at      INTEGER NOT NULL,          -- próxima aparición
        repeat      TEXT,                      -- regla compacta o NULL
        ref_kind    TEXT,                      -- 'task' | 'goal' | 'plan' | 'review' | NULL
        ref_id      INTEGER,
        snoozed_until INTEGER,
        shown_count INTEGER NOT NULL DEFAULT 0,
        max_shows   INTEGER NOT NULL DEFAULT 2, -- insistencia máxima por aparición (el código inserta 2)
        created_at  INTEGER NOT NULL,
        done_at     INTEGER,                    -- descartado/completado
        archived_at INTEGER
    );
    CREATE INDEX reminders_due ON reminders(done_at, due_at);
    "#,
    // v3 — objetivos, métricas, mediciones, hitos, acciones (hábitos).
    r#"
    CREATE TABLE goals (
        id               INTEGER PRIMARY KEY,
        name             TEXT    NOT NULL,
        description      TEXT    NOT NULL DEFAULT '',
        why              TEXT    NOT NULL DEFAULT '',      -- motivo personal
        success_criteria TEXT    NOT NULL DEFAULT '',
        status           TEXT    NOT NULL DEFAULT 'active', -- active | paused | achieved | closed
        started_on       TEXT    NOT NULL,
        horizon_on       TEXT,                              -- horizonte opcional
        review_every_days INTEGER,                          -- NULL = sin revisión programada
        last_reviewed_at INTEGER,
        notebook_id      INTEGER REFERENCES notebooks(id) ON DELETE SET NULL,
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL,
        archived_at      INTEGER
    );

    CREATE TABLE metrics (
        id          INTEGER PRIMARY KEY,
        goal_id     INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        name        TEXT    NOT NULL,
        kind        TEXT    NOT NULL,   -- number | yes_no | scale | duration | count | time | text
        unit        TEXT    NOT NULL DEFAULT '',
        direction   TEXT    NOT NULL DEFAULT 'observe', -- up | down | maintain | range | observe
        target_low  REAL,
        target_high REAL,
        scale_min   REAL,
        scale_max   REAL,
        frequency   TEXT    NOT NULL DEFAULT 'adhoc', -- daily | weekly | adhoc (sugerencia, nunca obligación)
        sensitive   INTEGER NOT NULL DEFAULT 0,       -- peso, alimentación, etc.: avisos y opt-in
        created_at  INTEGER NOT NULL,
        archived_at INTEGER
    );
    CREATE INDEX metrics_goal ON metrics(goal_id);

    CREATE TABLE measurements (
        id          INTEGER PRIMARY KEY,
        metric_id   INTEGER NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
        measured_at INTEGER NOT NULL,
        day         TEXT    NOT NULL,
        value       REAL,
        text_value  TEXT,
        note        TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX measurements_metric_time ON measurements(metric_id, measured_at);

    CREATE TABLE milestones (
        id           INTEGER PRIMARY KEY,
        goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title        TEXT    NOT NULL,
        kind         TEXT    NOT NULL,  -- metric_value | action_count | sustain_weeks | date | manual
        metric_id    INTEGER REFERENCES metrics(id) ON DELETE SET NULL,
        action_id    INTEGER,
        target_value REAL,
        target_day   TEXT,
        position     INTEGER NOT NULL DEFAULT 0,
        status       TEXT    NOT NULL DEFAULT 'pending', -- pending | reached | dropped
        reached_at   INTEGER,
        notes        TEXT    NOT NULL DEFAULT '',
        created_at   INTEGER NOT NULL
    );
    -- Historial de cambios de un hito: reprogramar no borra nada.
    CREATE TABLE milestone_history (
        id           INTEGER PRIMARY KEY,
        milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
        changed_at   INTEGER NOT NULL,
        field        TEXT    NOT NULL,
        old_value    TEXT,
        new_value    TEXT,
        note         TEXT    NOT NULL DEFAULT ''
    );

    -- Acciones recurrentes vinculadas a un objetivo (lo que otros llaman «hábitos»).
    CREATE TABLE actions (
        id          INTEGER PRIMARY KEY,
        goal_id     INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        name        TEXT    NOT NULL,
        cue         TEXT    NOT NULL DEFAULT '',   -- «después de desayunar», «al llegar a casa»
        kind        TEXT    NOT NULL DEFAULT 'do', -- do | avoid
        schedule    TEXT    NOT NULL DEFAULT 'daily', -- daily | weekdays:LMXJVSD | per_week:N
        created_at  INTEGER NOT NULL,
        paused_at   INTEGER,
        archived_at INTEGER
    );
    CREATE TABLE action_log (
        id        INTEGER PRIMARY KEY,
        action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
        day       TEXT    NOT NULL,
        done      INTEGER NOT NULL DEFAULT 1,   -- 1 hecha, 0 registrada como no hecha
        note      TEXT    NOT NULL DEFAULT '',
        logged_at INTEGER NOT NULL,
        UNIQUE (action_id, day)
    );
    "#,
    // v4 — cambio conductual: estrategias, planes si-entonces, episodios de impulso,
    //       preguntas recurrentes, revisiones.
    r#"
    CREATE TABLE strategies (
        id              INTEGER PRIMARY KEY,
        goal_id         INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        technique       TEXT    NOT NULL,    -- clave del catálogo declarativo (interventions/builtin.json)
        name            TEXT    NOT NULL,
        instructions    TEXT    NOT NULL DEFAULT '',
        wait_seconds    INTEGER,
        alternative     TEXT    NOT NULL DEFAULT '',
        created_at      INTEGER NOT NULL,
        archived_at     INTEGER
    );

    CREATE TABLE if_then_plans (
        id          INTEGER PRIMARY KEY,
        goal_id     INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        action_id   INTEGER REFERENCES actions(id) ON DELETE SET NULL,
        situation   TEXT    NOT NULL,
        response    TEXT    NOT NULL,
        created_at  INTEGER NOT NULL,
        last_reviewed_at INTEGER,
        archived_at INTEGER
    );
    CREATE TABLE plan_reviews (
        id        INTEGER PRIMARY KEY,
        plan_id   INTEGER NOT NULL REFERENCES if_then_plans(id) ON DELETE CASCADE,
        at        INTEGER NOT NULL,
        helpful   TEXT    NOT NULL,   -- yes | partly | no | not_used
        note      TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE impulse_episodes (
        id               INTEGER PRIMARY KEY,
        started_at       INTEGER NOT NULL,
        ended_at         INTEGER,
        goal_id          INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        strategy_id      INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
        context          TEXT    NOT NULL DEFAULT '',
        trigger_text     TEXT    NOT NULL DEFAULT '',
        intensity_before INTEGER,       -- 0..10, opcional
        intensity_after  INTEGER,
        waited_seconds   INTEGER,
        outcome          TEXT,          -- changed | partly | acted | unknown | unsaid
        reflection       TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX impulse_time ON impulse_episodes(started_at);

    CREATE TABLE prompts (
        id          INTEGER PRIMARY KEY,
        text        TEXT    NOT NULL,
        kind        TEXT    NOT NULL DEFAULT 'free',  -- free | scale | choice
        options     TEXT,                              -- JSON para choice/scale
        schedule    TEXT    NOT NULL,                  -- open | close | weekly | goal_review | srbai:<action_id>
        goal_id     INTEGER REFERENCES goals(id) ON DELETE CASCADE,
        source_ref  TEXT    NOT NULL DEFAULT '',       -- referencia científica/plantilla de origen
        position    INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        archived_at INTEGER
    );
    CREATE TABLE prompt_answers (
        id          INTEGER PRIMARY KEY,
        prompt_id   INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
        answered_at INTEGER NOT NULL,
        day         TEXT    NOT NULL,
        text        TEXT    NOT NULL DEFAULT '',
        value       REAL,
        review_id   INTEGER
    );
    CREATE INDEX prompt_answers_day ON prompt_answers(prompt_id, day);

    CREATE TABLE reviews (
        id           INTEGER PRIMARY KEY,
        kind         TEXT    NOT NULL,   -- open | close | weekly | goal
        goal_id      INTEGER REFERENCES goals(id) ON DELETE SET NULL,
        day          TEXT    NOT NULL,
        started_at   INTEGER NOT NULL,
        completed_at INTEGER,
        notes        TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX reviews_kind_day ON reviews(kind, day);
    "#,
    // v5 — objetivos: tipo (proceso/resultado/aprendizaje), categoría (lista cerrada,
    //       base de las señales de derivación), contexto habitual y motivo de cierre.
    r#"
    ALTER TABLE goals ADD COLUMN kind TEXT NOT NULL DEFAULT 'process';
    ALTER TABLE goals ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
    ALTER TABLE goals ADD COLUMN context TEXT NOT NULL DEFAULT '';
    ALTER TABLE goals ADD COLUMN close_reason TEXT;
    ALTER TABLE goals ADD COLUMN safety_shown INTEGER NOT NULL DEFAULT 0;
    "#,
    // v6 — sesiones de meditación (la interfaz existe en la web; la terminal conserva el
    //       esquema idéntico para que las bases y las copias sigan siendo compatibles).
    r#"
    CREATE TABLE meditation_sessions (
        id              INTEGER PRIMARY KEY,
        started_at      INTEGER NOT NULL,
        ended_at        INTEGER,
        planned_seconds INTEGER NOT NULL,
        done_seconds    INTEGER NOT NULL DEFAULT 0,
        plan            TEXT    NOT NULL DEFAULT '',   -- fases de la sesión (JSON)
        feeling         INTEGER,                        -- -2 (más inquieto) … 2 (más en calma)
        unpleasant      INTEGER NOT NULL DEFAULT 0,     -- 1 si hubo algo desagradable (bandera)
        notes           TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX meditation_sessions_started ON meditation_sessions(started_at);
    "#,
];

pub const CURRENT_VERSION: i32 = MIGRATIONS.len() as i32;
