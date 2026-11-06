//! Ajustes: aspecto, bloqueo, contraseña, copias, exportación, verificación.

use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use super::{App, Ctx, Deferred, Screen};
use crate::crypto::Password;
use crate::prefs::Theme as PrefTheme;
use crate::storage::{backup, export, Db};
use crate::text;
use crate::ui::widgets::{self, Selector};
use crate::ui::{Glyphs, Theme};

#[derive(Default)]
pub struct Settings {
    pub sel: Selector,
}

const LOCK_STEPS: [u32; 6] = [0, 5, 10, 15, 30, 60];

#[derive(Clone, Copy)]
enum Row {
    Theme,
    Charset,
    Lock,
    PwFeedback,
    ChangePw,
    Backup,
    Export,
    Check,
    PromptsOpen,
    PromptsClose,
    PromptsWeekly,
    WeeklyDay,
    Techniques,
    HelpNow,
    About,
}

const ROWS: [Row; 15] = [
    Row::Theme,
    Row::Charset,
    Row::Lock,
    Row::PwFeedback,
    Row::PromptsOpen,
    Row::PromptsClose,
    Row::PromptsWeekly,
    Row::WeeklyDay,
    Row::ChangePw,
    Row::Backup,
    Row::Export,
    Row::Check,
    Row::Techniques,
    Row::HelpNow,
    Row::About,
];

/// Alterna una preferencia visual por índice (compartido con la configuración inicial).
pub fn toggle_pref(app: &mut App, index: usize) {
    match index {
        0 => {
            app.prefs.theme = match app.prefs.theme {
                PrefTheme::Dark => PrefTheme::Light,
                PrefTheme::Light => PrefTheme::Dark,
            };
            app.theme = Theme::from_prefs(app.prefs.theme);
        }
        1 => {
            app.prefs.ascii = !app.glyphs.ascii;
            app.glyphs = Glyphs::pick(app.prefs.ascii);
        }
        _ => {}
    }
    let _ = app.prefs.save(&app.dir);
}

pub fn handle(app: &mut App, mut s: Settings, k: KeyEvent) -> Screen {
    match k.code {
        KeyCode::Esc => {
            app.go_home();
            return Screen::Settings(s);
        }
        KeyCode::Enter | KeyCode::Char(' ') | KeyCode::Right | KeyCode::Left => {
            let row = ROWS[s.sel.index.min(ROWS.len() - 1)];
            let backwards = k.code == KeyCode::Left;
            activate(app, row, backwards);
        }
        KeyCode::Char('?') => {
            let mut h = vec![("Intro / espacio", "cambiar o ejecutar"), ("← →", "alternar valores"), ("", "")];
            h.extend(super::global_help());
            app.help(text::SETTINGS, h);
        }
        _ => {
            s.sel.handle_key(k, ROWS.len(), 5);
        }
    }
    Screen::Settings(s)
}

fn activate(app: &mut App, row: Row, backwards: bool) {
    match row {
        Row::Theme => toggle_pref(app, 0),
        Row::Charset => toggle_pref(app, 1),
        Row::Lock => {
            let cur = LOCK_STEPS.iter().position(|&m| m == app.prefs.lock_after_minutes).unwrap_or(2);
            let next = if backwards { (cur + LOCK_STEPS.len() - 1) % LOCK_STEPS.len() } else { (cur + 1) % LOCK_STEPS.len() };
            app.prefs.lock_after_minutes = LOCK_STEPS[next];
            let _ = app.prefs.save(&app.dir);
        }
        Row::PwFeedback => {
            app.prefs.password_feedback = !app.prefs.password_feedback;
            let _ = app.prefs.save(&app.dir);
        }
        Row::ChangePw => app.prompt_secret(text::PW_CURRENT, Deferred::ChangePwCurrent),
        Row::Backup => {
            let def = app.dir.root().join("copias").join(backup::default_backup_name());
            app.prompt(text::BACKUP_PATH_PROMPT, &def.to_string_lossy(), Deferred::BackupTo);
        }
        Row::Export => app.confirm(text::EXPORT_CONFIRM, true, Deferred::ExportConfirm),
        Row::PromptsOpen | Row::PromptsClose | Row::PromptsWeekly => {
            let sched = match row {
                Row::PromptsOpen => "open",
                Row::PromptsClose => "close",
                _ => "weekly",
            };
            if let Some(db) = &app.db {
                let on = crate::domain::prompts::set_enabled(&db.conn, sched).unwrap_or(false);
                let r = if on { crate::domain::prompts::disable_set(&db.conn, sched) } else { crate::domain::prompts::install_set(&db.conn, sched).map(|_| ()) };
                if let Err(e) = r {
                    app.error(e.to_string());
                }
            }
        }
        Row::WeeklyDay => {
            if let Some(db) = &app.db {
                let cur = db.setting_i64("weekly_review_day", 6);
                let next = if backwards { (cur + 6) % 7 } else { (cur + 1) % 7 };
                let _ = db.set_setting("weekly_review_day", &next.to_string());
            }
        }
        Row::Techniques => {
            let cat = crate::interventions::Catalog::builtin();
            let names: Vec<String> = cat.tecnicas.iter().map(|t| format!("{}{}", t.nombre, if t.experimental { " (experimental)" } else { "" })).collect();
            app.choice(text::SETTINGS_TECHNIQUES, names, 0, Deferred::ShowTechnique);
        }
        Row::HelpNow => {
            app.info(text::SETTINGS_HELP_NOW, vec![text::DERIVATION_BASE.into(), String::new(), text::DERIVATION_SUICIDAL.into()]);
        }
        Row::Check => {
            if let Some(db) = &app.db {
                match db.check() {
                    Ok(()) => app.notify(text::CHECK_OK),
                    Err(e) => app.error(e.to_string()),
                }
            }
        }
        Row::About => {
            let lines = vec![
                format!("{} {}", text::APP_NAME, env!("CARGO_PKG_VERSION")),
                String::new(),
                format!("Datos: {}", app.dir.root().display()),
                format!("Esquema de datos: v{}", app.db.as_ref().and_then(|d| d.schema_version().ok()).unwrap_or(0)),
                "Cifrado: SQLCipher 4 (AES-256-CBC, HMAC-SHA512) con clave derivada por Argon2id.".into(),
                "Sin red, sin telemetría, sin IA.".into(),
            ];
            app.info(text::SETTINGS_ABOUT, lines);
        }
    }
}

pub fn run_deferred(app: &mut App, screen: Screen, d: Deferred, value: Option<String>) -> Screen {
    let v = value.unwrap_or_default();
    match d {
        Deferred::ShowTechnique => {
            let cat = crate::interventions::Catalog::builtin();
            if let Some(t) = v.trim().parse::<usize>().ok().and_then(|i| cat.tecnicas.get(i)) {
                app.info(&t.nombre.clone(), t.card());
            }
        }
        Deferred::ExportConfirm => {
            let def = app.dir.root().join("exportacion");
            app.prompt(text::EXPORT_PATH_PROMPT, &def.to_string_lossy(), Deferred::ExportTo);
        }
        Deferred::ExportTo => {
            if let Some(db) = &app.db {
                match export::export_all(db, std::path::Path::new(v.trim())) {
                    Ok(n) => app.notify(format!("{} {n} ficheros en {}", text::EXPORT_DONE, v.trim())),
                    Err(e) => app.error(e.to_string()),
                }
            }
        }
        Deferred::BackupTo => {
            if let Some(db) = &app.db {
                let dest = std::path::PathBuf::from(v.trim());
                match backup::backup_to(db, &app.dir, &dest) {
                    Ok(_) => {
                        // Rotación sólo en la carpeta de copias por defecto: conserva las 10 últimas.
                        if dest.parent() == Some(app.dir.root().join("copias").as_path()) {
                            let _ = backup::rotate(&app.dir.root().join("copias"), 10);
                        }
                        app.notify(format!("{} {}", text::BACKUP_DONE, dest.display()));
                    }
                    Err(e) => app.error(e.to_string()),
                }
            }
        }
        Deferred::ChangePwCurrent => {
            // Verificamos la actual abriendo una segunda conexión de sólo lectura.
            let pw = Password(v);
            match Db::open(&app.dir, &pw) {
                Ok(db) => {
                    db.close();
                    app.prompt_secret(text::PW_NEW, Deferred::ChangePwNew(pw));
                }
                Err(e) => app.error(e.to_string()),
            }
        }
        Deferred::ChangePwNew(current) => {
            if v.chars().count() < 8 {
                app.error(text::CREATE_TOO_SHORT);
            } else {
                app.prompt_secret(text::PW_REPEAT, Deferred::ChangePwRepeat(current, Password(v)));
            }
        }
        Deferred::ChangePwRepeat(_current, new) => {
            if new.0 != v {
                app.error(text::CREATE_MISMATCH);
            } else if let Some(db) = &mut app.db {
                match db.change_password(&app.dir, &new) {
                    Ok(()) => app.notify(text::PW_CHANGED),
                    Err(e) => app.error(e.to_string()),
                }
            }
        }
        _ => {}
    }
    screen
}

pub fn render(s: &mut Settings, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let keys = [("Intro", "cambiar"), ("← →", "alternar"), ("Esc", text::BACK), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, text::SETTINGS, "", &keys).body;
    s.sel.clamp(ROWS.len());
    let mut y = body.y;
    for (i, row) in ROWS.iter().enumerate() {
        let selected = i == s.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let style = if selected { theme.selected } else { theme.text };
        let (label, value): (&str, String) = match row {
            Row::Theme => (
                text::SETTINGS_THEME,
                match ctx.prefs.theme {
                    PrefTheme::Dark => text::SETTINGS_DARK,
                    PrefTheme::Light => text::SETTINGS_LIGHT,
                }
                .into(),
            ),
            Row::Charset => (text::SETTINGS_CHARSET, if g.ascii { text::SETTINGS_ASCII } else { text::SETTINGS_UNICODE }.into()),
            Row::Lock => (
                text::SETTINGS_LOCK,
                if ctx.prefs.lock_after_minutes == 0 {
                    text::SETTINGS_NEVER.into()
                } else {
                    format!("{} {}", ctx.prefs.lock_after_minutes, text::SETTINGS_MINUTES)
                },
            ),
            Row::PwFeedback => (text::SETTINGS_PW_FEEDBACK, if ctx.prefs.password_feedback { text::SETTINGS_YES } else { text::SETTINGS_NO }.into()),
            Row::PromptsOpen | Row::PromptsClose | Row::PromptsWeekly => {
                let (label, sched) = match row {
                    Row::PromptsOpen => (text::SETTINGS_PROMPTS_OPEN, "open"),
                    Row::PromptsClose => (text::SETTINGS_PROMPTS_CLOSE, "close"),
                    _ => (text::SETTINGS_PROMPTS_WEEKLY, "weekly"),
                };
                let on = ctx.db.map(|db| crate::domain::prompts::set_enabled(&db.conn, sched).unwrap_or(false)).unwrap_or(false);
                (label, if on { text::SETTINGS_ON } else { text::SETTINGS_OFF }.into())
            }
            Row::WeeklyDay => {
                let d = ctx.db.map(|db| db.setting_i64("weekly_review_day", 6)).unwrap_or(6).clamp(0, 6) as usize;
                (text::SETTINGS_WEEKLY_DAY, crate::dates::WEEKDAYS[d].into())
            }
            Row::Techniques => (text::SETTINGS_TECHNIQUES, String::new()),
            Row::HelpNow => (text::SETTINGS_HELP_NOW, String::new()),
            Row::ChangePw => (text::SETTINGS_CHANGE_PW, String::new()),
            Row::Backup => (text::SETTINGS_BACKUP, String::new()),
            Row::Export => (text::SETTINGS_EXPORT, String::new()),
            Row::Check => (text::SETTINGS_CHECK, String::new()),
            Row::About => (text::SETTINGS_ABOUT, String::new()),
        };
        if matches!(row, Row::PromptsOpen | Row::ChangePw | Row::Techniques) {
            y += 1; // separación entre grupos
        }
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{label:<48}"), style),
            Span::styled(if value.is_empty() { String::new() } else { format!("< {value} >") }, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
    }
}
