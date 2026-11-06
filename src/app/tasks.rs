//! Tareas: vistas Hoy / Próximas / Sin fecha / Hechas / Proyectos / Calendario,
//! ficha de tarea con notas y subtareas, y revisión no culpabilizadora de
//! tareas aplazadas (docs/research/notes/E §8–9).

use std::collections::HashMap;

use chrono::{Datelike, NaiveDate};
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};
use unicode_width::UnicodeWidthStr;

use super::{App, Ctx, Deferred, Screen};
use crate::dates;
use crate::domain::recurrence::Rule;
use crate::domain::tasks::{self as tk, NewTask, Project, Status, Task, View};
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::editor::Editor;
use crate::ui::widgets::{self, Selector};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tab {
    Today,
    Upcoming,
    Someday,
    Done,
    Projects,
    Calendar,
}

const TABS: [Tab; 6] = [Tab::Today, Tab::Upcoming, Tab::Someday, Tab::Done, Tab::Projects, Tab::Calendar];

impl Tab {
    fn label(self) -> &'static str {
        match self {
            Tab::Today => text::TASKS_TODAY,
            Tab::Upcoming => text::TASKS_UPCOMING,
            Tab::Someday => text::TASKS_SOMEDAY,
            Tab::Done => text::TASKS_DONE,
            Tab::Projects => text::TASKS_PROJECTS,
            Tab::Calendar => text::TASKS_CALENDAR,
        }
    }
}

pub struct Tasks {
    pub tab: Tab,
    pub tasks: Vec<Task>,
    pub projects: Vec<Project>,
    pub sel: Selector,
    /// Filtro por proyecto (id, nombre) al entrar desde Proyectos.
    pub project: Option<(i64, String)>,
    pub cal_day: NaiveDate,
    pub cal_marks: HashMap<String, i64>,
}

impl Tasks {
    pub fn open(db: &Db) -> Result<Self> {
        let mut s = Self {
            tab: Tab::Today,
            tasks: vec![],
            projects: vec![],
            sel: Selector::default(),
            project: None,
            cal_day: dates::today(),
            cal_marks: HashMap::new(),
        };
        s.reload(db)?;
        Ok(s)
    }

    pub fn reload(&mut self, db: &Db) -> Result<()> {
        let today = dates::today();
        let c = &db.conn;
        match (self.tab, &self.project) {
            (Tab::Projects, _) => self.projects = tk::list_projects(c, true)?,
            (Tab::Calendar, _) => {
                let first = NaiveDate::from_ymd_opt(self.cal_day.year(), self.cal_day.month(), 1).unwrap();
                let last = first + chrono::Duration::days(dates::days_in_month(first.year(), first.month()) as i64 - 1);
                self.cal_marks = tk::days_with_tasks(c, first, last)?.into_iter().collect();
                self.tasks = tk::on_day(c, self.cal_day)?;
            }
            (Tab::Today, Some((pid, _))) => self.tasks = tk::list_for_project(c, *pid)?,
            (Tab::Today, None) => self.tasks = tk::list(c, View::Today, today, None)?,
            (Tab::Upcoming, p) => self.tasks = tk::list(c, View::Upcoming, today, p.as_ref().map(|x| x.0))?,
            (Tab::Someday, p) => self.tasks = tk::list(c, View::Someday, today, p.as_ref().map(|x| x.0))?,
            (Tab::Done, p) => self.tasks = tk::list(c, View::Done, today, p.as_ref().map(|x| x.0))?,
        }
        self.sel.clamp(if self.tab == Tab::Projects { self.projects.len() } else { self.tasks.len() });
        Ok(())
    }

    fn reload_quiet(&mut self, app: &App) {
        if let Some(db) = &app.db {
            if let Err(e) = self.reload(db) {
                app.error(e.to_string());
            }
        }
    }

    fn selected_task(&self) -> Option<&Task> {
        if self.tab == Tab::Projects {
            None
        } else {
            self.tasks.get(self.sel.index)
        }
    }

    fn select_task(&mut self, id: i64) {
        if let Some(i) = self.tasks.iter().position(|t| t.id == id) {
            self.sel.index = i;
        }
    }

    fn default_day(&self) -> Option<NaiveDate> {
        match self.tab {
            Tab::Today => Some(dates::today()),
            Tab::Upcoming => Some(dates::today() + chrono::Duration::days(1)),
            Tab::Calendar => Some(self.cal_day),
            _ => None,
        }
    }
}

fn parse_day(app: &App, v: &str) -> Option<Option<NaiveDate>> {
    let r = dates::parse_day_input(v, dates::today());
    if r.is_none() {
        app.error(text::TASK_DATE_UNKNOWN);
    }
    r
}

pub fn handle(app: &mut App, mut s: Tasks, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Tasks(s) };
    if s.tab == Tab::Calendar && handle_calendar_nav(&mut s, k) {
        s.reload_quiet(app);
        return Screen::Tasks(s);
    }
    match k.code {
        KeyCode::Esc => {
            if s.project.is_some() {
                s.project = None;
                s.tab = Tab::Projects;
                s.reload_quiet(app);
                return Screen::Tasks(s);
            }
            app.go_home();
            Screen::Tasks(s)
        }
        KeyCode::Tab | KeyCode::BackTab => {
            let i = TABS.iter().position(|t| *t == s.tab).unwrap_or(0);
            let n = TABS.len();
            s.tab = TABS[if k.code == KeyCode::Tab { (i + 1) % n } else { (i + n - 1) % n }];
            if s.tab == Tab::Projects {
                s.project = None;
            }
            s.sel = Selector::default();
            s.reload_quiet(app);
            Screen::Tasks(s)
        }
        KeyCode::Char(c @ '1'..='6') => {
            s.tab = TABS[(c as u8 - b'1') as usize];
            if s.tab == Tab::Projects {
                s.project = None;
            }
            s.sel = Selector::default();
            s.reload_quiet(app);
            Screen::Tasks(s)
        }
        KeyCode::Char('n') => {
            if s.tab == Tab::Projects {
                app.prompt(text::PROJECT_NAME_PROMPT, "", Deferred::CreateProject);
            } else {
                app.prompt(text::TASK_TITLE_PROMPT, "", Deferred::CreateTask);
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('?') => {
            let mut h = if s.tab == Tab::Projects {
                vec![("n", "nuevo proyecto"), ("Intro", "ver sus tareas"), ("e", "renombrar"), ("x", "archivar / recuperar"), ("D", "borrar (las tareas se conservan)")]
            } else {
                vec![
                    ("n", "nueva tarea"),
                    ("Intro", "abrir la ficha (notas, subtareas)"),
                    ("espacio / x", "hecha / pendiente"),
                    ("z", "aplazar a otro día"),
                    ("s", "día previsto"),
                    ("f", "fecha límite"),
                    ("p", "prioridad (alta, normal, baja)"),
                    ("r", "repetición"),
                    ("P", "proyecto"),
                    ("S", "añadir subtarea"),
                    ("c", "cerrar sin hacer (ya no aplica)"),
                    ("R", "revisar una tarea aplazada"),
                    ("D", "borrar (pide confirmación)"),
                ]
            };
            h.push(("Tab / 1-6", "cambiar de vista"));
            if s.tab == Tab::Calendar {
                h.push(("← → ↑ ↓", "moverse por días"));
                h.push(("PgUp PgDn", "mes anterior / siguiente"));
                h.push(("t", "hoy"));
            }
            h.push(("", ""));
            h.extend(super::global_help());
            app.help(text::TASKS, h);
            Screen::Tasks(s)
        }
        _ if s.tab == Tab::Projects => handle_projects(app, s, k),
        KeyCode::Enter => {
            if let Some(t) = s.selected_task() {
                return match TaskDetail::open(db, t.id) {
                    Ok(d) => Screen::TaskDetail(d),
                    Err(e) => {
                        app.error(e.to_string());
                        Screen::Tasks(s)
                    }
                };
            }
            Screen::Tasks(s)
        }
        KeyCode::Char(' ') | KeyCode::Char('x') => {
            if let Some(t) = s.selected_task() {
                let (id, st) = (t.id, t.status);
                let r = match st {
                    Status::Open => tk::complete(&db.conn, id).map(|_| ()),
                    _ => tk::reopen(&db.conn, id),
                };
                if let Err(e) = r {
                    app.error(e.to_string());
                }
                s.reload_quiet(app);
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('z') => {
            if let Some(t) = s.selected_task() {
                let id = t.id;
                app.prompt(text::TASK_POSTPONE_PROMPT, "", Deferred::PostponeTask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('s') => {
            if let Some(t) = s.selected_task() {
                let (id, cur) = (t.id, t.scheduled_day.clone().unwrap_or_default());
                app.prompt(text::TASK_DAY_PROMPT, &cur, Deferred::ScheduleTask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('f') => {
            if let Some(t) = s.selected_task() {
                let (id, cur) = (t.id, t.due_day.clone().unwrap_or_default());
                app.prompt(text::TASK_DUE_PROMPT, &cur, Deferred::DueTask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('p') => {
            if let Some(t) = s.selected_task() {
                let (id, p) = (t.id, t.priority);
                let next = match p {
                    0 => 1,
                    1 => -1,
                    _ => 0,
                };
                if let Err(e) = tk::set_priority(&db.conn, id, next) {
                    app.error(e.to_string());
                }
                s.reload_quiet(app);
                s.select_task(id);
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('r') => {
            if let Some(t) = s.selected_task() {
                let (id, cur) = (t.id, t.recurrence.as_ref().map(|r| r.describe()).unwrap_or_default());
                app.prompt(text::TASK_RECUR_PROMPT, &cur, Deferred::RecurTask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('P') => {
            if let Some(t) = s.selected_task() {
                let id = t.id;
                let cur = t.project_id.and_then(|p| tk::project_name(&db.conn, p).ok().flatten()).unwrap_or_default();
                app.prompt(text::TASK_PROJECT_PROMPT, &cur, Deferred::ProjectTask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('S') => {
            if let Some(t) = s.selected_task() {
                let id = t.id;
                app.prompt(text::TASK_SUBTASK_PROMPT, "", Deferred::CreateSubtask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('c') => {
            if let Some(t) = s.selected_task() {
                let id = t.id;
                app.prompt(text::TASK_CLOSE_PROMPT, "", Deferred::DropTask(id));
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('R') => {
            if let Some(t) = s.selected_task() {
                return match PostponeReview::open(db, t.id) {
                    Ok(r) => Screen::PostponeReview(r),
                    Err(e) => {
                        app.error(e.to_string());
                        Screen::Tasks(s)
                    }
                };
            }
            Screen::Tasks(s)
        }
        KeyCode::Char('D') => {
            if let Some(t) = s.selected_task() {
                let id = t.id;
                app.confirm(text::TASK_DELETE_CONFIRM, true, Deferred::DeleteTask(id));
            }
            Screen::Tasks(s)
        }
        _ => {
            s.sel.handle_key(k, s.tasks.len(), 10);
            Screen::Tasks(s)
        }
    }
}

fn handle_calendar_nav(s: &mut Tasks, k: KeyEvent) -> bool {
    let d = s.cal_day;
    s.cal_day = match k.code {
        KeyCode::Left | KeyCode::Char('h') => d - chrono::Duration::days(1),
        KeyCode::Right | KeyCode::Char('l') => d + chrono::Duration::days(1),
        KeyCode::Up | KeyCode::Char('k') => d - chrono::Duration::days(7),
        KeyCode::Down | KeyCode::Char('j') => d + chrono::Duration::days(7),
        KeyCode::PageUp => crate::domain::recurrence::add_months(d, 0).checked_sub_months(chrono::Months::new(1)).unwrap_or(d),
        KeyCode::PageDown => crate::domain::recurrence::add_months(d, 1),
        KeyCode::Char('t') => dates::today(),
        _ => return false,
    };
    s.sel = Selector::default();
    true
}

fn handle_projects(app: &mut App, mut s: Tasks, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Tasks(s) };
    let cur = s.projects.get(s.sel.index).cloned();
    match (k.code, cur) {
        (KeyCode::Enter, Some(p)) => {
            s.project = Some((p.id, p.name.clone()));
            s.tab = Tab::Today;
            s.sel = Selector::default();
            s.reload_quiet(app);
        }
        (KeyCode::Char('e'), Some(p)) => app.prompt(text::PROJECT_NAME_PROMPT, &p.name, Deferred::RenameProject(p.id)),
        (KeyCode::Char('x'), Some(p)) => {
            if let Err(e) = tk::set_project_archived(&db.conn, p.id, !p.archived) {
                app.error(e.to_string());
            }
            s.reload_quiet(app);
        }
        (KeyCode::Char('D'), Some(p)) => app.confirm(text::PROJECT_DELETE_CONFIRM, true, Deferred::DeleteProject(p.id)),
        _ => {
            s.sel.handle_key(k, s.projects.len(), 10);
        }
    }
    Screen::Tasks(s)
}

pub fn run_deferred(app: &mut App, screen: Screen, d: Deferred, value: Option<String>) -> Screen {
    let Some(db) = &app.db else { return screen };
    let v = value.unwrap_or_default();
    let vt = v.trim();
    match (d, screen) {
        (Deferred::CreateTask, Screen::Tasks(mut s)) => {
            if !vt.is_empty() {
                let day = s.default_day();
                let r = tk::create(
                    &db.conn,
                    NewTask { title: vt, scheduled_day: day, project_id: s.project.as_ref().map(|p| p.0), ..Default::default() },
                );
                match r {
                    Ok(id) => {
                        s.reload_quiet(app);
                        s.select_task(id);
                    }
                    Err(e) => app.error(e.to_string()),
                }
            }
            Screen::Tasks(s)
        }
        (Deferred::CreateSubtask(parent), screen) => {
            if !vt.is_empty() {
                let project = tk::get(&db.conn, parent).ok().flatten().and_then(|t| t.project_id);
                if let Err(e) = tk::create(&db.conn, NewTask { title: vt, parent_id: Some(parent), project_id: project, ..Default::default() }) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        (Deferred::PostponeTask(id), screen) => {
            match parse_day(app, vt) {
                Some(Some(day)) => match tk::postpone(&db.conn, id, day) {
                    Ok(n) if n >= tk::POSTPONE_REVIEW_THRESHOLD => app.notify(text::TASK_REVIEW_OFFER),
                    Ok(_) => {}
                    Err(e) => app.error(e.to_string()),
                },
                Some(None) => {
                    if let Err(e) = tk::set_scheduled(&db.conn, id, None) {
                        app.error(e.to_string());
                    }
                }
                None => {}
            }
            refresh(app, screen)
        }
        (Deferred::ScheduleTask(id), screen) => {
            if let Some(day) = parse_day(app, vt) {
                if let Err(e) = tk::set_scheduled(&db.conn, id, day) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        (Deferred::DueTask(id), screen) => {
            if let Some(day) = parse_day(app, vt) {
                if let Err(e) = tk::set_due(&db.conn, id, day) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        (Deferred::RecurTask(id), screen) => {
            let rule = Rule::parse_human(vt);
            if rule.is_none() && !vt.is_empty() && !matches!(vt.to_lowercase().as_str(), "no" | "nunca" | "-") {
                app.error(text::TASK_RECUR_UNKNOWN);
            } else if let Err(e) = tk::set_recurrence(&db.conn, id, rule.as_ref()) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        (Deferred::ProjectTask(id), screen) => {
            let r = if vt.is_empty() {
                tk::set_project(&db.conn, id, None)
            } else {
                let existing = tk::list_projects(&db.conn, true).unwrap_or_default().into_iter().find(|p| p.name.eq_ignore_ascii_case(vt));
                let pid = match existing {
                    Some(p) => Ok(p.id),
                    None => tk::create_project(&db.conn, vt, None),
                };
                pid.and_then(|pid| tk::set_project(&db.conn, id, Some(pid)))
            };
            if let Err(e) = r {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        (Deferred::DropTask(id), screen) => {
            if let Err(e) = tk::drop_task(&db.conn, id, vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        (Deferred::DeleteTask(id), screen) => {
            if let Err(e) = tk::delete(&db.conn, id) {
                app.error(e.to_string());
            }
            match screen {
                Screen::TaskDetail(d) if d.task.id == id => match Tasks::open(db) {
                    Ok(t) => Screen::Tasks(t),
                    Err(e) => {
                        app.error(e.to_string());
                        app.go_home();
                        Screen::Blank
                    }
                },
                other => refresh(app, other),
            }
        }
        (Deferred::CreateProject, Screen::Tasks(mut s)) => {
            if !vt.is_empty() {
                if let Err(e) = tk::create_project(&db.conn, vt, None) {
                    app.error(e.to_string());
                }
                s.reload_quiet(app);
            }
            Screen::Tasks(s)
        }
        (Deferred::RenameProject(id), Screen::Tasks(mut s)) => {
            if !vt.is_empty() {
                if let Err(e) = tk::rename_project(&db.conn, id, vt) {
                    app.error(e.to_string());
                }
                s.reload_quiet(app);
            }
            Screen::Tasks(s)
        }
        (Deferred::DeleteProject(id), Screen::Tasks(mut s)) => {
            if let Err(e) = tk::delete_project(&db.conn, id) {
                app.error(e.to_string());
            }
            s.reload_quiet(app);
            Screen::Tasks(s)
        }
        (Deferred::ReviewText(id, step), Screen::PostponeReview(r)) if r.task.id == id => r.answer_text(app, step, vt),
        (Deferred::TaskTitle(id), Screen::TaskDetail(mut d)) if d.task.id == id => {
            if !vt.is_empty() {
                if let Err(e) = tk::set_title(&db.conn, id, vt) {
                    app.error(e.to_string());
                }
                d.task.title = vt.to_string();
            }
            Screen::TaskDetail(d)
        }
        (_, screen) => screen,
    }
}

/// Recarga la pantalla de tareas o la ficha tras una acción.
fn refresh(app: &App, screen: Screen) -> Screen {
    match screen {
        Screen::Tasks(mut s) => {
            let keep = s.selected_task().map(|t| t.id);
            s.reload_quiet(app);
            if let Some(id) = keep {
                s.select_task(id);
            }
            Screen::Tasks(s)
        }
        Screen::TaskDetail(mut d) => {
            if let Some(db) = &app.db {
                d.reload(db);
            }
            Screen::TaskDetail(d)
        }
        other => other,
    }
}

// ---- dibujo de la lista -----------------------------------------------------

pub fn render(s: &mut Tasks, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let title = match &s.project {
        Some((_, name)) => format!("{}{}{}", text::TASKS, g.dot_sep, name),
        None => text::TASKS.to_string(),
    };
    let keys: Vec<(&str, &str)> = match s.tab {
        Tab::Projects => vec![("n", "nuevo"), ("Intro", "abrir"), ("Tab", "vista"), ("Esc", text::BACK), ("?", text::HELP)],
        Tab::Calendar => vec![("← → ↑ ↓", "día"), ("n", "nueva"), ("Intro", "abrir"), ("Tab", "vista"), ("Esc", text::BACK), ("?", text::HELP)],
        _ => vec![("n", "nueva"), ("espacio", "hecha"), ("z", "aplazar"), ("Intro", "ficha"), ("Tab", "vista"), ("?", text::HELP)],
    };
    let body = widgets::chrome(frame, area, theme, g, &title, "", &keys).body;

    // Pestañas
    let mut spans = vec![];
    for (i, t) in TABS.iter().enumerate() {
        let active = *t == s.tab;
        spans.push(Span::styled(format!("{} ", i + 1), theme.dim));
        spans.push(Span::styled(t.label().to_string(), if active { theme.selected } else { theme.dim }));
        spans.push(Span::raw("   "));
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), Rect { x: body.x, y: body.y, width: body.width, height: 1 });
    let list = Rect { x: body.x, y: body.y + 2, width: body.width, height: body.height.saturating_sub(2) };

    match s.tab {
        Tab::Projects => render_projects(s, frame, list, ctx),
        Tab::Calendar => render_calendar(s, frame, list, ctx),
        _ => {
            if s.tasks.is_empty() {
                let msg = match s.tab {
                    Tab::Today => text::TASKS_EMPTY_TODAY,
                    Tab::Upcoming => text::TASKS_EMPTY_UPCOMING,
                    Tab::Someday => text::TASKS_EMPTY_SOMEDAY,
                    _ => text::TASKS_EMPTY_DONE,
                };
                widgets::empty_state(frame, list, theme, msg);
                return;
            }
            render_task_rows(&s.tasks, &mut s.sel, frame, list, ctx, today, s.tab == Tab::Today);
        }
    }
}

fn render_task_rows(tasks: &[Task], sel: &mut Selector, frame: &mut Frame, list: Rect, ctx: &Ctx, today: NaiveDate, show_overdue: bool) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    sel.clamp(tasks.len());
    let range = sel.visible(tasks.len(), list.height as usize);
    let mut y = list.y;
    for i in range {
        let t = &tasks[i];
        let selected = i == sel.index;
        let marker = if selected { g.cursor } else { " " };
        let (box_glyph, box_style) = match t.status {
            Status::Open => (g.todo, theme.text),
            Status::Done => (g.done, theme.positive),
            Status::Dropped => (g.partial, theme.dim),
        };
        let prio = match t.priority {
            1 => Span::styled(format!("{} ", g.arrow_up), theme.warn),
            -1 => Span::styled(format!("{} ", g.arrow_down), theme.dim),
            _ => Span::raw("  "),
        };
        let mut meta: Vec<String> = vec![];
        if let Some(d) = t.scheduled_day.as_deref().and_then(dates::parse_iso_date) {
            if show_overdue && d < today {
                meta.push(format!("{} ({})", text::TASK_PENDING, dates::fmt_date_compact(d, today)));
            } else if d != today {
                meta.push(dates::fmt_date_compact(d, today));
            }
        }
        if let Some(d) = t.due_day.as_deref().and_then(dates::parse_iso_date) {
            meta.push(format!("límite {}", dates::fmt_date_compact(d, today)));
        }
        if let Some(r) = &t.recurrence {
            meta.push(r.describe());
        }
        if t.subtasks_total > 0 {
            meta.push(format!("{}/{}", t.subtasks_done, t.subtasks_total));
        }
        if t.postpone_count >= tk::POSTPONE_REVIEW_THRESHOLD {
            meta.push(format!("{} {}×", text::TASK_POSTPONED_TIMES, t.postpone_count));
        }
        let meta = meta.join(g.dot_sep);
        let avail = (list.width as usize).saturating_sub(2 + 2 + 2 + meta.width() + 2);
        let title = g.truncate(&t.title, avail);
        let title_style = match t.status {
            Status::Open if selected => theme.selected,
            Status::Open => theme.text,
            _ => theme.dim,
        };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{box_glyph} "), box_style),
            prio,
            Span::styled(format!("{title:<avail$}"), title_style),
            Span::raw("  "),
            Span::styled(meta, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: list.x, y, width: list.width, height: 1 });
        y += 1;
    }
}

fn render_projects(s: &mut Tasks, frame: &mut Frame, list: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    if s.projects.is_empty() {
        widgets::empty_state(frame, list, theme, text::TASKS_EMPTY_PROJECTS);
        return;
    }
    s.sel.clamp(s.projects.len());
    let range = s.sel.visible(s.projects.len(), list.height as usize);
    let mut y = list.y;
    for i in range {
        let p = &s.projects[i];
        let selected = i == s.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let mut detail = format!("{} abiertas{}{} hechas", p.open_tasks, g.dot_sep, p.done_tasks);
        if p.archived {
            detail = format!("{}{}{}", text::NOTEBOOK_ARCHIVED, g.dot_sep, detail);
        }
        let avail = (list.width as usize).saturating_sub(4 + detail.width());
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{:<avail$}", g.truncate(&p.name, avail)), if selected { theme.selected } else if p.archived { theme.dim } else { theme.text }),
            Span::raw("  "),
            Span::styled(detail, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: list.x, y, width: list.width, height: 1 });
        y += 1;
    }
}

fn render_calendar(s: &mut Tasks, frame: &mut Frame, list: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let d = s.cal_day;
    let first = NaiveDate::from_ymd_opt(d.year(), d.month(), 1).unwrap();
    let ndays = dates::days_in_month(d.year(), d.month());
    let grid_w = 7 * 4 + 1;
    let x0 = list.x;
    // Cabecera del mes
    let title = format!("{} {}", dates::MONTHS[d.month0() as usize], d.year());
    frame.render_widget(Paragraph::new(Span::styled(title, theme.emphasis)), Rect { x: x0 + 1, y: list.y, width: grid_w as u16, height: 1 });
    let header: String = dates::WEEKDAYS_SHORT.iter().map(|w| format!("{w:>3} ")).collect();
    frame.render_widget(Paragraph::new(Span::styled(header, theme.dim)), Rect { x: x0 + 1, y: list.y + 1, width: grid_w as u16, height: 1 });
    let offset = first.weekday().num_days_from_monday() as usize;
    let mut y = list.y + 2;
    let mut col = offset;
    let mut x = x0 + 1 + (offset * 4) as u16;
    for day in 1..=ndays {
        let date = NaiveDate::from_ymd_opt(d.year(), d.month(), day).unwrap();
        let iso = dates::date_to_iso(date);
        let n = s.cal_marks.get(&iso).copied().unwrap_or(0);
        let mark = if n > 0 { g.bullet } else { " " };
        let mut style = theme.text;
        if date == today {
            style = theme.accent;
        }
        if date == d {
            style = theme.selected.patch(ratatui::style::Style::default().add_modifier(ratatui::style::Modifier::REVERSED));
        }
        let cell = format!("{day:>3}");
        frame.render_widget(
            Paragraph::new(Line::from(vec![Span::styled(cell, style), Span::styled(mark.to_string(), theme.accent)])),
            Rect { x, y, width: 4, height: 1 },
        );
        col += 1;
        x += 4;
        if col == 7 {
            col = 0;
            x = x0 + 1;
            y += 1;
        }
    }
    // Lista de tareas del día seleccionado, a la derecha
    let right_x = x0 + grid_w as u16 + 3;
    if right_x + 20 > list.x + list.width {
        return;
    }
    let right = Rect { x: right_x, y: list.y, width: list.x + list.width - right_x, height: list.height };
    let head = format!("{}", dates::fmt_date_long(d));
    frame.render_widget(Paragraph::new(Span::styled(g.truncate(&head, right.width as usize), theme.emphasis)), Rect { height: 1, ..right });
    let rows = Rect { x: right.x, y: right.y + 2, width: right.width, height: right.height.saturating_sub(2) };
    if s.tasks.is_empty() {
        frame.render_widget(Paragraph::new(Span::styled("Nada previsto. Pulsa n para añadir.", theme.dim)), Rect { height: 1, ..rows });
    } else {
        render_task_rows(&s.tasks, &mut s.sel, frame, rows, ctx, today, false);
    }
}

// ---- ficha de tarea ---------------------------------------------------------

pub struct TaskDetail {
    pub task: Task,
    pub subtasks: Vec<Task>,
    pub editor: Editor,
    pub sel: Selector,
    pub focus_subtasks: bool,
    pub project_name: Option<String>,
}

impl TaskDetail {
    pub fn open(db: &Db, id: i64) -> Result<Self> {
        let task = tk::get(&db.conn, id)?.ok_or(crate::storage::DbError::NotFound)?;
        let mut editor = Editor::from_text(&task.notes);
        editor.markdown = true;
        editor.move_to_end();
        let project_name = task.project_id.and_then(|p| tk::project_name(&db.conn, p).ok().flatten());
        Ok(Self { subtasks: tk::subtasks(&db.conn, id)?, task, editor, sel: Selector::default(), focus_subtasks: false, project_name })
    }

    pub fn reload(&mut self, db: &Db) {
        if let Ok(Some(t)) = tk::get(&db.conn, self.task.id) {
            self.task = t;
        }
        if let Ok(s) = tk::subtasks(&db.conn, self.task.id) {
            self.subtasks = s;
        }
        self.project_name = self.task.project_id.and_then(|p| tk::project_name(&db.conn, p).ok().flatten());
        self.sel.clamp(self.subtasks.len());
    }

    pub fn save(&mut self, db: &Db) -> Result<()> {
        if self.editor.dirty {
            tk::set_notes(&db.conn, self.task.id, &self.editor.text())?;
            self.editor.mark_saved();
        }
        Ok(())
    }
}

pub fn handle_detail(app: &mut App, mut d: TaskDetail, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::TaskDetail(d) };
    let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
    match (k.code, ctrl) {
        (KeyCode::Esc, _) => {
            if let Err(e) = d.save(db) {
                app.error(e.to_string());
            }
            match Tasks::open(db) {
                Ok(mut t) => {
                    t.select_task(d.task.id);
                    Screen::Tasks(t)
                }
                Err(e) => {
                    app.error(e.to_string());
                    app.go_home();
                    Screen::Blank
                }
            }
        }
        (KeyCode::Tab, _) => {
            d.focus_subtasks = !d.focus_subtasks && !d.subtasks.is_empty();
            Screen::TaskDetail(d)
        }
        (KeyCode::Char('t'), true) => {
            let (id, cur) = (d.task.id, d.task.title.clone());
            app.prompt(text::TASK_TITLE_PROMPT, &cur, Deferred::TaskTitle(id));
            Screen::TaskDetail(d)
        }
        (KeyCode::Char('n'), true) => {
            let id = d.task.id;
            app.prompt(text::TASK_SUBTASK_PROMPT, "", Deferred::CreateSubtask(id));
            Screen::TaskDetail(d)
        }
        (KeyCode::Char('s'), true) => {
            match d.save(db) {
                Ok(()) => app.notify(text::SAVED),
                Err(e) => app.error(e.to_string()),
            }
            Screen::TaskDetail(d)
        }
        (KeyCode::F(1), _) => {
            app.help(
                text::TASK_DETAIL,
                vec![
                    ("Esc", "guardar y volver"),
                    ("Ctrl+T", "cambiar el título"),
                    ("Ctrl+N", "añadir subtarea"),
                    ("Tab", "alternar entre notas y subtareas"),
                    ("espacio", "(en subtareas) hecha / pendiente"),
                    ("D", "(en subtareas) borrar"),
                    ("", "Las notas se guardan solas."),
                ],
            );
            Screen::TaskDetail(d)
        }
        _ if d.focus_subtasks => {
            match k.code {
                KeyCode::Char(' ') | KeyCode::Char('x') | KeyCode::Enter => {
                    if let Some(st) = d.subtasks.get(d.sel.index) {
                        let r = match st.status {
                            Status::Open => tk::complete(&db.conn, st.id).map(|_| ()),
                            _ => tk::reopen(&db.conn, st.id),
                        };
                        if let Err(e) = r {
                            app.error(e.to_string());
                        }
                        d.reload(db);
                    }
                }
                KeyCode::Char('D') => {
                    if let Some(st) = d.subtasks.get(d.sel.index) {
                        if let Err(e) = tk::delete(&db.conn, st.id) {
                            app.error(e.to_string());
                        }
                        d.reload(db);
                        if d.subtasks.is_empty() {
                            d.focus_subtasks = false;
                        }
                    }
                }
                _ => {
                    d.sel.handle_key(k, d.subtasks.len(), 5);
                }
            }
            Screen::TaskDetail(d)
        }
        _ => {
            d.editor.handle_key(k);
            Screen::TaskDetail(d)
        }
    }
}

pub fn render_detail(d: &mut TaskDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let t = &d.task;
    let keys = [("Esc", "guardar y volver"), ("Ctrl+T", text::TITLE), ("Ctrl+N", "subtarea"), ("Tab", "notas/subtareas"), ("F1", text::HELP)];
    let right = match t.status {
        Status::Open => "",
        Status::Done => "hecha",
        Status::Dropped => "cerrada",
    };
    let body = widgets::chrome(frame, area, theme, g, &format!("{}{}{}", text::TASK_DETAIL, g.dot_sep, g.truncate(&t.title, 50)), right, &keys).body;
    let mut y = body.y;
    let mut meta: Vec<String> = vec![];
    if let Some(dd) = t.scheduled_day.as_deref().and_then(dates::parse_iso_date) {
        meta.push(format!("previsto: {}", dates::fmt_date_compact(dd, today)));
    }
    if let Some(dd) = t.due_day.as_deref().and_then(dates::parse_iso_date) {
        meta.push(format!("límite: {}", dates::fmt_date_compact(dd, today)));
    }
    if let Some(r) = &t.recurrence {
        meta.push(r.describe());
    }
    if let Some(p) = &d.project_name {
        meta.push(format!("proyecto: {p}"));
    }
    meta.push(match t.priority {
        1 => "prioridad alta".into(),
        -1 => "prioridad baja".into(),
        _ => "prioridad normal".into(),
    });
    if t.postpone_count > 0 {
        meta.push(format!("{} {}×", text::TASK_POSTPONED_TIMES, t.postpone_count));
    }
    frame.render_widget(Paragraph::new(Span::styled(g.truncate(&meta.join(g.dot_sep), body.width as usize), theme.dim)), Rect { x: body.x, y, width: body.width, height: 1 });
    y += 2;
    let sub_h = if d.subtasks.is_empty() { 0 } else { (d.subtasks.len() as u16 + 2).min(7) };
    let notes_h = body.height.saturating_sub(2 + sub_h);
    let notes_area = Rect { x: body.x, y, width: body.width, height: notes_h };
    if d.editor.is_empty() && d.focus_subtasks {
        frame.render_widget(Paragraph::new(Span::styled(text::TASK_NOTES_HINT, theme.dim)), Rect { height: 1, ..notes_area });
    }
    d.editor.render(frame, notes_area, theme, !ctx.modal_open && !d.focus_subtasks);
    if sub_h > 0 {
        let sy = body.y + body.height - sub_h;
        frame.render_widget(
            Paragraph::new(Span::styled(format!("{} {}/{}", text::TASK_SUBTASKS, t.subtasks_done, t.subtasks_total), if d.focus_subtasks { theme.title } else { theme.dim })),
            Rect { x: body.x, y: sy, width: body.width, height: 1 },
        );
        let rows = Rect { x: body.x, y: sy + 1, width: body.width, height: sub_h - 1 };
        let mut sel = d.sel.clone();
        if !d.focus_subtasks {
            sel.index = usize::MAX; // sin selección visible
        }
        render_task_rows(&d.subtasks, &mut sel, frame, rows, ctx, today, false);
        if d.focus_subtasks {
            d.sel = sel;
        }
    }
}

// ---- revisión de tarea aplazada -------------------------------------------------

pub struct PostponeReview {
    pub task: Task,
    pub step: usize,
    pub summary: Vec<String>,
    pub tip: Option<&'static str>,
    pub finished: bool,
    pub closed: bool,
}

impl PostponeReview {
    pub fn open(db: &Db, id: i64) -> Result<Self> {
        let task = tk::get(&db.conn, id)?.ok_or(crate::storage::DbError::NotFound)?;
        Ok(Self { task, step: 0, summary: vec![], tip: None, finished: false, closed: false })
    }

    fn answer_text(mut self, app: &mut App, step: usize, v: &str) -> Screen {
        let Some(db) = &app.db else { return Screen::PostponeReview(self) };
        let id = self.task.id;
        match step {
            0 => {
                // Cerrar «ya no importa»
                if let Err(e) = tk::drop_task(&db.conn, id, v) {
                    app.error(e.to_string());
                }
                self.summary.push(text::REVIEW_CLOSED_TASK.into());
                self.closed = true;
                self.finished = true;
            }
            1 => {
                if !v.is_empty() {
                    let project = self.task.project_id;
                    if let Err(e) = tk::create(&db.conn, NewTask { title: v, parent_id: Some(id), project_id: project, scheduled_day: Some(dates::today()), ..Default::default() }) {
                        app.error(e.to_string());
                    }
                    self.summary.push(format!("Primer paso: {v}"));
                }
                self.step = 2;
            }
            2 => {
                if !v.is_empty() {
                    let project = self.task.project_id;
                    if let Err(e) = tk::create(&db.conn, NewTask { title: &format!("Resolver: {v}"), project_id: project, scheduled_day: Some(dates::today()), ..Default::default() }) {
                        app.error(e.to_string());
                    }
                    self.summary.push(format!("Obstáculo a resolver: {v}"));
                }
                self.step = 3;
            }
            4 => {
                // día
                match parse_day(app, v) {
                    Some(Some(day)) => {
                        if let Err(e) = tk::set_scheduled(&db.conn, id, Some(day)) {
                            app.error(e.to_string());
                        }
                        self.summary.push(format!("Nuevo día: {}", dates::fmt_date_short(day)));
                        app.prompt(text::REVIEW_Q5_DIFF, "", Deferred::ReviewText(id, 5));
                    }
                    Some(None) => {
                        self.step = 6;
                    }
                    None => app.prompt(text::REVIEW_Q5_DAY, "", Deferred::ReviewText(id, 4)),
                }
            }
            5 => {
                if !v.is_empty() {
                    let notes = format!("{}\n\nLa próxima vez será distinto: {v}", self.task.notes).trim().to_string();
                    if let Err(e) = tk::set_notes(&db.conn, id, &notes) {
                        app.error(e.to_string());
                    }
                    self.summary.push(format!("Será distinto: {v}"));
                }
                self.step = 6;
            }
            _ => {}
        }
        Screen::PostponeReview(self)
    }
}

pub fn handle_review(app: &mut App, mut r: PostponeReview, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::PostponeReview(r) };
    let id = r.task.id;
    if k.code == KeyCode::Esc || (r.finished && k.code == KeyCode::Enter) {
        return match Tasks::open(db) {
            Ok(mut t) => {
                t.select_task(id);
                Screen::Tasks(t)
            }
            Err(e) => {
                app.error(e.to_string());
                app.go_home();
                Screen::Blank
            }
        };
    }
    if r.finished {
        // Frase de cierre opcional: se guarda en las notas de la tarea una sola vez.
        if let KeyCode::Char(c @ ('1' | '2')) = k.code {
            let phrase = text::REVIEW_FORGIVE_OPTS[(c as u8 - b'1') as usize].1;
            let notes = format!("{}\n\n{phrase}", r.task.notes).trim().to_string();
            if let Err(e) = tk::set_notes(&db.conn, id, &notes) {
                app.error(e.to_string());
            }
            r.summary.push(phrase.into());
            r.step = 99;
        }
        return Screen::PostponeReview(r);
    }
    match (r.step, k.code) {
        (0, KeyCode::Char('s')) => {
            r.summary.push("Sigue importando.".into());
            r.step = 1;
        }
        (0, KeyCode::Char('n')) => app.prompt(text::TASK_CLOSE_PROMPT, "", Deferred::ReviewText(id, 0)),
        (0, KeyCode::Char('d')) => {
            r.summary.push("No está claro si sigue importando: lo revisaré de nuevo.".into());
            r.step = 1;
        }
        (1, KeyCode::Char('s')) => r.step = 2,
        (1, KeyCode::Char('n')) => app.prompt(text::REVIEW_Q2_PROMPT, "", Deferred::ReviewText(id, 1)),
        (2, KeyCode::Char('s')) => app.prompt(text::REVIEW_Q3_PROMPT, "", Deferred::ReviewText(id, 2)),
        (2, KeyCode::Char('n')) => r.step = 3,
        (3, KeyCode::Char('a')) => {
            r.tip = Some(text::REVIEW_Q4_BORING);
            r.step = 4;
        }
        (3, KeyCode::Char('i')) => {
            r.tip = Some(text::REVIEW_Q4_UNCOMFORTABLE);
            r.step = 4;
        }
        (3, KeyCode::Char('m')) => {
            r.tip = Some(text::REVIEW_Q4_FEAR);
            r.step = 4;
        }
        (3, KeyCode::Char('n')) => r.step = 4,
        (4, KeyCode::Enter) => app.prompt(text::REVIEW_Q5_DAY, "", Deferred::ReviewText(id, 4)),
        (6, _) => {}
        _ => {}
    }
    if r.step == 6 {
        r.finished = true;
    }
    Screen::PostponeReview(r)
}

pub fn render_review(r: &PostponeReview, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let keys: Vec<(&str, &str)> = if r.finished { vec![("Intro", "volver"), ("Esc", "volver")] } else { vec![("Esc", "salir cuando quieras")] };
    let body = widgets::chrome(frame, area, theme, g, text::REVIEW_TITLE, "", &keys).body;
    let w = body.width.min(76);
    let x = body.x + (body.width - w) / 2;
    let mut y = body.y + 1;
    let mut put = |frame: &mut Frame, s: String, style: ratatui::style::Style, y: &mut u16| {
        let h = widgets::line_count(&s, w);
        let p = Paragraph::new(Span::styled(s, style)).wrap(ratatui::widgets::Wrap { trim: true });
        frame.render_widget(p, Rect { x, y: *y, width: w, height: h.min(body.y + body.height - *y) });
        *y += h;
    };
    put(frame, r.task.title.clone(), theme.emphasis, &mut y);
    put(frame, text::REVIEW_INTRO.replace("{n}", &r.task.postpone_count.to_string()), theme.dim, &mut y);
    y += 1;
    for s in &r.summary {
        put(frame, format!("{} {s}", g.check), theme.dim, &mut y);
    }
    if !r.summary.is_empty() {
        y += 1;
    }
    if r.finished {
        put(frame, text::REVIEW_CLOSE.into(), theme.text, &mut y);
        if r.step != 99 && !r.closed {
            y += 1;
            put(frame, text::REVIEW_FORGIVE.into(), theme.dim, &mut y);
            for (k, t) in text::REVIEW_FORGIVE_OPTS {
                put(frame, format!("  {k:<4} {t}"), theme.text, &mut y);
            }
        }
        return;
    }
    let (q, opts): (&str, &[(&str, &str)]) = match r.step {
        0 => (text::REVIEW_Q1, text::REVIEW_Q1_OPTS),
        1 => (text::REVIEW_Q2, text::REVIEW_Q2_OPTS),
        2 => (text::REVIEW_Q3, text::REVIEW_Q3_OPTS),
        3 => (text::REVIEW_Q4, text::REVIEW_Q4_OPTS),
        _ => (text::REVIEW_Q5, &[("Intro", "elegir día"), ("Esc", "dejarla como está")]),
    };
    if let Some(tip) = r.tip {
        put(frame, tip.into(), theme.accent, &mut y);
        y += 1;
    }
    put(frame, format!("{}. {q}", r.step + 1), theme.text, &mut y);
    y += 1;
    for (k, t) in opts {
        put(frame, format!("  {k:<6} {t}"), theme.text, &mut y);
    }
}
