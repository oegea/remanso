//! Máquina de estados de pantallas y bucle de eventos.
//!
//! El bucle es estrictamente dirigido por eventos: se bloquea en
//! `event::poll(timeout)` donde `timeout` es el tiempo hasta el próximo plazo
//! conocido (autoguardado, bloqueo por inactividad, caducidad de un mensaje).
//! Sin plazos pendientes, `read()` bloquea indefinidamente: CPU en reposo nula.

pub mod bench;
mod diary;
mod goals;
mod home;
mod impulse;
mod lock;
mod notebooks;
mod reminders;
mod review;
mod search;
mod settings;
mod tasks;

use std::io;
use std::time::{Duration, Instant};

use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    Frame,
};

use crate::paths::DataDir;
use crate::prefs::Prefs;
use crate::storage::Db;
use crate::text;
use crate::ui::widgets::{self, LineInput};
use crate::ui::{Glyphs, Theme};

pub const AUTOSAVE_IDLE: Duration = Duration::from_secs(2);
const STATUS_TTL: Duration = Duration::from_secs(4);

pub enum Screen {
    Blank,
    Lock(lock::Lock),
    Setup(lock::Setup),
    Home(home::Home),
    Diary(diary::DiaryList),
    DiaryEdit(diary::DiaryEdit),
    Notebooks(notebooks::NotebookList),
    Notes(notebooks::NoteList),
    NoteEdit(notebooks::NoteEdit),
    Search(search::Search),
    Settings(settings::Settings),
    Tasks(tasks::Tasks),
    TaskDetail(tasks::TaskDetail),
    PostponeReview(tasks::PostponeReview),
    Reminders(reminders::Reminders),
    Goals(goals::GoalList),
    GoalDetail(goals::GoalDetail),
    MetricView(goals::MetricView),
    Impulse(impulse::Impulse),
    Pattern(impulse::PatternView),
    Review(review::ReviewMenu),
    ReviewSession(review::Session),
}

/// Acción diferida que un diálogo ejecuta al confirmarse.
#[derive(Debug, Clone)]
pub enum Deferred {
    Quit,
    DeleteDiaryEntry(i64),
    DeleteNote(i64),
    DeleteNotebook(i64),
    CreateNotebook,
    RenameNotebook(i64),
    CreateNote(i64),
    SetDiaryTitle(i64),
    SetDiaryTags(i64),
    SetNoteTitle(i64),
    ExportConfirm,
    ExportTo,
    BackupTo,
    ChangePwCurrent,
    ChangePwNew(crate::crypto::Password),
    ChangePwRepeat(crate::crypto::Password, crate::crypto::Password),
    // Tareas
    CreateTask,
    CreateSubtask(i64),
    PostponeTask(i64),
    ScheduleTask(i64),
    DueTask(i64),
    RecurTask(i64),
    ProjectTask(i64),
    DropTask(i64),
    DeleteTask(i64),
    TaskTitle(i64),
    CreateProject,
    RenameProject(i64),
    DeleteProject(i64),
    ReviewText(i64, usize),
    // Recordatorios
    ReminderTitle,
    ReminderWhen(String),
    ReminderRepeat(i64),
    ReminderSnooze(i64),
    ReminderReschedule(i64),
    ReminderDelete(i64),
    // Objetivos (acciones propias del módulo)
    Goal(goals::GoalAction),
    Impulse(impulse::ImpulseAction),
    Review(review::ReviewAction),
    ShowTechnique,
    None,
}

pub enum Modal {
    Confirm { message: String, destructive: bool, then: Deferred },
    /// Elegir una opción de una lista corta; `then` recibe el índice como texto.
    Choice { title: String, options: Vec<String>, sel: usize, then: Deferred },
    Prompt { label: String, input: LineInput, then: Deferred },
    Help { title: String, entries: Vec<(&'static str, &'static str)> },
    Info { title: String, lines: Vec<String> },
}

pub struct App {
    pub dir: DataDir,
    pub prefs: Prefs,
    pub theme: Theme,
    pub glyphs: Glyphs,
    pub db: Option<Db>,
    pub screen: Screen,
    pub modal: Option<Modal>,
    pub status: std::cell::RefCell<Option<(String, bool, Instant)>>,
    pub last_activity: Instant,
    pub quit: bool,
    pub zen: bool,
}

pub fn run(dir: DataDir, prefs: Prefs) -> Result<(), Box<dyn std::error::Error>> {
    let mut app = App::new(dir, prefs);
    let mut terminal = ratatui::init();
    // Nunca dejar el terminal en modo crudo aunque algo falle.
    let result = app.event_loop(&mut terminal);
    ratatui::restore();
    app.shutdown();
    result.map_err(|e| e.into())
}

impl App {
    pub fn new(dir: DataDir, prefs: Prefs) -> Self {
        let ascii = prefs.ascii || Glyphs::detect_ascii_env();
        let theme = Theme::from_prefs(prefs.theme);
        let screen = if dir.exists() { Screen::Lock(lock::Lock::new(false)) } else { Screen::Lock(lock::Lock::new(true)) };
        Self {
            dir,
            prefs,
            theme,
            glyphs: Glyphs::pick(ascii),
            db: None,
            screen,
            modal: None,
            status: std::cell::RefCell::new(None),
            last_activity: Instant::now(),
            quit: false,
            zen: false,
        }
    }

    fn event_loop(&mut self, terminal: &mut ratatui::DefaultTerminal) -> io::Result<()> {
        while !self.quit {
            terminal.draw(|f| self.render(f))?;
            let now = Instant::now();
            let ev = match self.next_deadline() {
                Some(deadline) => {
                    let timeout = deadline.saturating_duration_since(now);
                    if event::poll(timeout)? {
                        Some(event::read()?)
                    } else {
                        None
                    }
                }
                None => Some(event::read()?),
            };
            match ev {
                Some(Event::Key(k)) if k.kind != KeyEventKind::Release => {
                    self.last_activity = Instant::now();
                    self.handle_key(k);
                }
                Some(Event::Resize(..)) => {}
                Some(Event::Paste(s)) => {
                    self.last_activity = Instant::now();
                    self.handle_paste(&s);
                }
                Some(_) => {}
                None => self.tick(),
            }
        }
        Ok(())
    }

    /// Próximo instante en que hay algo que hacer sin que el usuario pulse nada.
    fn next_deadline(&self) -> Option<Instant> {
        let mut d: Option<Instant> = None;
        let mut consider = |t: Option<Instant>| {
            if let Some(t) = t {
                d = Some(d.map_or(t, |x: Instant| x.min(t)));
            }
        };
        consider(self.status.borrow().as_ref().map(|(_, _, t)| *t + STATUS_TTL));
        if self.db.is_some() && self.prefs.lock_after_minutes > 0 {
            consider(Some(self.last_activity + Duration::from_secs(self.prefs.lock_after_minutes as u64 * 60)));
        }
        match &self.screen {
            Screen::DiaryEdit(e) => consider(e.editor.autosave_deadline(AUTOSAVE_IDLE)),
            Screen::NoteEdit(e) => consider(e.editor.autosave_deadline(AUTOSAVE_IDLE)),
            Screen::TaskDetail(e) => consider(e.editor.autosave_deadline(AUTOSAVE_IDLE)),
            Screen::Impulse(i) => consider(i.next_deadline()),
            _ => {}
        }
        // Despertar cuando venza el próximo recordatorio para que Inicio lo muestre.
        if let Some(db) = &self.db {
            if let Ok(Some(ts)) = crate::domain::reminders::next_due_at(&db.conn, crate::dates::now_ts()) {
                let secs = (ts - crate::dates::now_ts()).max(1) as u64;
                consider(Some(Instant::now() + Duration::from_secs(secs)));
            }
        }
        d
    }

    fn tick(&mut self) {
        let expired = self.status.borrow().as_ref().map(|(_, _, t)| t.elapsed() >= STATUS_TTL).unwrap_or(false);
        if expired {
            *self.status.borrow_mut() = None;
        }
        if self.db.is_some()
            && self.prefs.lock_after_minutes > 0
            && self.last_activity.elapsed() >= Duration::from_secs(self.prefs.lock_after_minutes as u64 * 60)
        {
            self.lock();
            return;
        }
        self.autosave(false);
    }

    /// Guarda el editor activo si procede. `force` ignora el tiempo de inactividad.
    pub fn autosave(&mut self, force: bool) {
        let Some(db) = &self.db else { return };
        match &mut self.screen {
            Screen::DiaryEdit(e) if force || e.editor.needs_autosave(AUTOSAVE_IDLE) => {
                if let Err(err) = e.save(db) {
                    *self.status.borrow_mut() = Some((err.to_string(), true, Instant::now()));
                }
            }
            Screen::NoteEdit(e) if force || e.editor.needs_autosave(AUTOSAVE_IDLE) => {
                if let Err(err) = e.save(db) {
                    *self.status.borrow_mut() = Some((err.to_string(), true, Instant::now()));
                }
            }
            Screen::TaskDetail(e) if force || e.editor.needs_autosave(AUTOSAVE_IDLE) => {
                if let Err(err) = e.save(db) {
                    *self.status.borrow_mut() = Some((err.to_string(), true, Instant::now()));
                }
            }
            _ => {}
        }
    }

    pub fn notify(&self, msg: impl Into<String>) {
        *self.status.borrow_mut() = Some((msg.into(), false, Instant::now()));
    }

    pub fn error(&self, msg: impl Into<String>) {
        *self.status.borrow_mut() = Some((msg.into(), true, Instant::now()));
    }

    /// Bloquea: guarda, cierra la base y borra la clave de memoria.
    pub fn lock(&mut self) {
        self.autosave(true);
        if let Some(db) = self.db.take() {
            db.close();
        }
        self.modal = None;
        self.zen = false;
        self.screen = Screen::Lock(lock::Lock::new(false));
    }

    fn shutdown(&mut self) {
        self.autosave(true);
        if let Some(db) = self.db.take() {
            db.close();
        }
    }

    pub fn go_home(&mut self) {
        self.screen = Screen::Home(home::Home::default());
    }

    /// Tras desbloquear: registra la apertura y, si han pasado ≥ 3 días, muestra
    /// un único aviso neutro con lo pendiente (nada se marca como incumplido).
    pub fn after_unlock(&mut self) {
        let Some(db) = &self.db else { return };
        let now = crate::dates::now_ts();
        let last = db.setting_i64("last_open", 0);
        let _ = db.set_setting("last_open", &now.to_string());
        if last > 0 {
            let days = crate::dates::ts_to_date(now).signed_duration_since(crate::dates::ts_to_date(last)).num_days();
            if days >= 3 {
                let t = crate::domain::tasks::count_pending(&db.conn, crate::dates::today()).unwrap_or(0);
                let r = crate::domain::reminders::due(&db.conn, now).map(|v| v.len()).unwrap_or(0);
                if t + r as i64 > 0 {
                    self.info(
                        text::WELCOME_BACK_TITLE,
                        vec![
                            text::WELCOME_BACK_LINE1.replace("{n}", &days.to_string()),
                            text::WELCOME_BACK_LINE2.replace("{t}", &t.to_string()).replace("{r}", &r.to_string()),
                            String::new(),
                            text::WELCOME_BACK_LINE3.to_string(),
                        ],
                    );
                }
            }
        }
    }

    // ---- entrada -----------------------------------------------------------

    fn handle_paste(&mut self, s: &str) {
        match &mut self.screen {
            Screen::DiaryEdit(e) => e.editor.insert_str(s),
            Screen::NoteEdit(e) => e.editor.insert_str(s),
            Screen::TaskDetail(e) => e.editor.insert_str(s),
            _ => {}
        }
    }

    fn handle_key(&mut self, k: KeyEvent) {
        *self.status.borrow_mut() = None;
        if self.modal.is_some() {
            self.handle_modal_key(k);
            return;
        }
        let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
        // Globales (sólo con sesión abierta).
        if self.db.is_some() {
            match (k.code, ctrl) {
                (KeyCode::Char('q'), true) => {
                    self.quit = true;
                    return;
                }
                (KeyCode::Char('l'), true) => {
                    self.lock();
                    return;
                }
                _ => {}
            }
        }
        let screen = std::mem::replace(&mut self.screen, Screen::Blank);
        let screen = match screen {
            Screen::Blank => Screen::Blank,
            Screen::Lock(s) => lock::handle(self, s, k),
            Screen::Setup(s) => lock::handle_setup(self, s, k),
            Screen::Home(s) => home::handle(self, s, k),
            Screen::Diary(s) => diary::handle_list(self, s, k),
            Screen::DiaryEdit(s) => diary::handle_edit(self, s, k),
            Screen::Notebooks(s) => notebooks::handle_list(self, s, k),
            Screen::Notes(s) => notebooks::handle_notes(self, s, k),
            Screen::NoteEdit(s) => notebooks::handle_edit(self, s, k),
            Screen::Search(s) => search::handle(self, s, k),
            Screen::Settings(s) => settings::handle(self, s, k),
            Screen::Tasks(s) => tasks::handle(self, s, k),
            Screen::TaskDetail(s) => tasks::handle_detail(self, s, k),
            Screen::PostponeReview(s) => tasks::handle_review(self, s, k),
            Screen::Reminders(s) => reminders::handle(self, s, k),
            Screen::Goals(s) => goals::handle_list(self, s, k),
            Screen::GoalDetail(s) => goals::handle_detail(self, s, k),
            Screen::MetricView(s) => goals::handle_metric(self, s, k),
            Screen::Impulse(s) => impulse::handle(self, s, k),
            Screen::Pattern(s) => impulse::handle_pattern(self, s, k),
            Screen::Review(s) => review::handle_menu(self, s, k),
            Screen::ReviewSession(s) => review::handle_session(self, s, k),
        };
        if matches!(self.screen, Screen::Blank) {
            self.screen = screen;
        }
    }

    fn handle_modal_key(&mut self, k: KeyEvent) {
        let Some(modal) = self.modal.take() else { return };
        match modal {
            Modal::Confirm { message, destructive, then } => match k.code {
                KeyCode::Char('s') | KeyCode::Char('S') | KeyCode::Enter => self.run_deferred(then, None),
                KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc => {}
                _ => self.modal = Some(Modal::Confirm { message, destructive, then }),
            },
            Modal::Prompt { label, mut input, then } => match k.code {
                KeyCode::Esc => {}
                KeyCode::Enter => {
                    let v = std::mem::take(&mut input.value);
                    self.run_deferred(then, Some(v))
                }
                _ => {
                    input.handle_key(k);
                    self.modal = Some(Modal::Prompt { label, input, then });
                }
            },
            Modal::Choice { title, options, mut sel, then } => match k.code {
                KeyCode::Esc => {}
                KeyCode::Enter => self.run_deferred(then, Some(sel.to_string())),
                KeyCode::Char(c @ '1'..='9') if ((c as u8 - b'1') as usize) < options.len() => {
                    self.run_deferred(then, Some(((c as u8 - b'1') as usize).to_string()))
                }
                KeyCode::Up | KeyCode::Char('k') => {
                    sel = sel.saturating_sub(1);
                    self.modal = Some(Modal::Choice { title, options, sel, then });
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    sel = (sel + 1).min(options.len().saturating_sub(1));
                    self.modal = Some(Modal::Choice { title, options, sel, then });
                }
                _ => self.modal = Some(Modal::Choice { title, options, sel, then }),
            },
            Modal::Help { .. } | Modal::Info { .. } => {}
        }
    }

    pub fn choice(&mut self, title: impl Into<String>, options: Vec<String>, initial: usize, then: Deferred) {
        self.modal = Some(Modal::Choice { title: title.into(), options, sel: initial, then });
    }

    pub fn confirm(&mut self, message: impl Into<String>, destructive: bool, then: Deferred) {
        self.modal = Some(Modal::Confirm { message: message.into(), destructive, then });
    }

    pub fn prompt(&mut self, label: impl Into<String>, initial: &str, then: Deferred) {
        self.modal = Some(Modal::Prompt { label: label.into(), input: LineInput::new(initial), then });
    }

    pub fn prompt_secret(&mut self, label: impl Into<String>, then: Deferred) {
        self.modal = Some(Modal::Prompt { label: label.into(), input: LineInput::secret(), then });
    }

    pub fn help(&mut self, title: &str, entries: Vec<(&'static str, &'static str)>) {
        self.modal = Some(Modal::Help { title: title.into(), entries });
    }

    pub fn info(&mut self, title: &str, lines: Vec<String>) {
        self.modal = Some(Modal::Info { title: title.into(), lines });
    }

    fn run_deferred(&mut self, d: Deferred, value: Option<String>) {
        let screen = std::mem::replace(&mut self.screen, Screen::Blank);
        let screen = match d {
            Deferred::Quit => {
                self.quit = true;
                screen
            }
            Deferred::None => screen,
            Deferred::DeleteDiaryEntry(_)
            | Deferred::SetDiaryTitle(_)
            | Deferred::SetDiaryTags(_) => diary::run_deferred(self, screen, d, value),
            Deferred::DeleteNote(_)
            | Deferred::DeleteNotebook(_)
            | Deferred::CreateNotebook
            | Deferred::RenameNotebook(_)
            | Deferred::CreateNote(_)
            | Deferred::SetNoteTitle(_) => notebooks::run_deferred(self, screen, d, value),
            Deferred::ExportConfirm
            | Deferred::ExportTo
            | Deferred::BackupTo
            | Deferred::ChangePwCurrent
            | Deferred::ChangePwNew(_)
            | Deferred::ChangePwRepeat(..)
            | Deferred::ShowTechnique => settings::run_deferred(self, screen, d, value),
            Deferred::CreateTask
            | Deferred::CreateSubtask(_)
            | Deferred::PostponeTask(_)
            | Deferred::ScheduleTask(_)
            | Deferred::DueTask(_)
            | Deferred::RecurTask(_)
            | Deferred::ProjectTask(_)
            | Deferred::DropTask(_)
            | Deferred::DeleteTask(_)
            | Deferred::TaskTitle(_)
            | Deferred::CreateProject
            | Deferred::RenameProject(_)
            | Deferred::DeleteProject(_)
            | Deferred::ReviewText(..) => tasks::run_deferred(self, screen, d, value),
            Deferred::ReminderTitle
            | Deferred::ReminderWhen(_)
            | Deferred::ReminderRepeat(_)
            | Deferred::ReminderSnooze(_)
            | Deferred::ReminderReschedule(_)
            | Deferred::ReminderDelete(_) => reminders::run_deferred(self, screen, d, value),
            Deferred::Goal(a) => goals::run_deferred(self, screen, a, value),
            Deferred::Impulse(a) => impulse::run_deferred(self, screen, a, value),
            Deferred::Review(a) => review::run_deferred(self, screen, a, value),
        };
        if matches!(self.screen, Screen::Blank) {
            self.screen = screen;
        }
    }

    // ---- dibujo ------------------------------------------------------------

    fn render(&mut self, frame: &mut Frame) {
        let area = frame.area();
        if area.width < 60 || area.height < 12 {
            frame.render_widget(
                ratatui::widgets::Paragraph::new(text::TERMINAL_TOO_SMALL).wrap(ratatui::widgets::Wrap { trim: true }),
                area,
            );
            return;
        }
        let App { screen, theme, glyphs, db, prefs, status, modal, zen, .. } = self;
        let ctx = Ctx { theme, glyphs, db: db.as_ref(), prefs, zen: *zen, modal_open: modal.is_some() };
        match screen {
            Screen::Blank => {}
            Screen::Lock(s) => lock::render(s, frame, area, &ctx),
            Screen::Setup(s) => lock::render_setup(s, frame, area, &ctx),
            Screen::Home(s) => home::render(s, frame, area, &ctx),
            Screen::Diary(s) => diary::render_list(s, frame, area, &ctx),
            Screen::DiaryEdit(s) => diary::render_edit(s, frame, area, &ctx),
            Screen::Notebooks(s) => notebooks::render_list(s, frame, area, &ctx),
            Screen::Notes(s) => notebooks::render_notes(s, frame, area, &ctx),
            Screen::NoteEdit(s) => notebooks::render_edit(s, frame, area, &ctx),
            Screen::Search(s) => search::render(s, frame, area, &ctx),
            Screen::Settings(s) => settings::render(s, frame, area, &ctx),
            Screen::Tasks(s) => tasks::render(s, frame, area, &ctx),
            Screen::TaskDetail(s) => tasks::render_detail(s, frame, area, &ctx),
            Screen::PostponeReview(s) => tasks::render_review(s, frame, area, &ctx),
            Screen::Reminders(s) => reminders::render(s, frame, area, &ctx),
            Screen::Goals(s) => goals::render_list(s, frame, area, &ctx),
            Screen::GoalDetail(s) => goals::render_detail(s, frame, area, &ctx),
            Screen::MetricView(s) => goals::render_metric(s, frame, area, &ctx),
            Screen::Impulse(s) => impulse::render(s, frame, area, &ctx),
            Screen::Pattern(s) => impulse::render_pattern(s, frame, area, &ctx),
            Screen::Review(s) => review::render_menu(s, frame, area, &ctx),
            Screen::ReviewSession(s) => review::render_session(s, frame, area, &ctx),
        }
        if let Some((msg, is_err, _)) = status.borrow().as_ref() {
            widgets::status(frame, area, theme, msg, *is_err);
        }
        if let Some(m) = modal {
            render_modal(m, frame, area, theme, glyphs, prefs.password_feedback);
        }
    }
}

/// Contexto de sólo lectura para dibujar.
pub struct Ctx<'a> {
    pub theme: &'a Theme,
    pub glyphs: &'a Glyphs,
    pub db: Option<&'a Db>,
    pub prefs: &'a Prefs,
    pub zen: bool,
    pub modal_open: bool,
}

fn render_modal(m: &Modal, frame: &mut Frame, area: Rect, theme: &Theme, g: &Glyphs, pw_feedback: bool) {
    match m {
        Modal::Confirm { message, destructive, .. } => widgets::confirm_dialog(frame, area, theme, g, message, *destructive),
        Modal::Prompt { label, input, .. } => {
            let inner = widgets::dialog(frame, area, theme, g, label, vec![Line::raw("")], &[("Intro", text::ACCEPT), ("Esc", text::CANCEL)]);
            input.render(frame, Rect { height: 1, ..inner }, theme, ">", true, pw_feedback);
        }
        Modal::Choice { title, options, sel, .. } => {
            let lines: Vec<Line> = options
                .iter()
                .enumerate()
                .map(|(i, o)| {
                    let marker = if i == *sel { g.cursor } else { " " };
                    let style = if i == *sel { theme.selected } else { theme.text };
                    Line::from(vec![Span::styled(format!("{marker} {} ", i + 1), theme.accent), Span::styled(o.clone(), style)])
                })
                .collect();
            widgets::dialog(frame, area, theme, g, title, lines, &[("↑ ↓ / 1-9", "elegir"), ("Intro", text::ACCEPT), ("Esc", text::CANCEL)]);
        }
        Modal::Help { title, entries } => widgets::help_dialog(frame, area, theme, g, title, entries),
        Modal::Info { title, lines } => {
            let l: Vec<Line> = lines.iter().map(|s| Line::raw(s.clone())).collect();
            widgets::dialog(frame, area, theme, g, title, l, &[("Esc", "cerrar")]);
        }
    }
}

/// Teclas de ayuda comunes a todas las pantallas con sesión abierta.
pub fn global_help() -> Vec<(&'static str, &'static str)> {
    vec![
        ("Esc", "volver / cancelar"),
        ("?", "ayuda de la pantalla"),
        ("/", "buscar"),
        ("Ctrl+L", "bloquear ahora"),
        ("Ctrl+Q", "guardar y salir"),
    ]
}
