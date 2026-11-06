//! Revisiones: menú (apertura, cierre, semanal, objetivo, patrón de impulsos,
//! preparación) y sesión de preguntas, una por pantalla, todas omisibles
//! (docs/research/interventions.md §b.8, §b.10, §b.20, §d).

use chrono::Datelike;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::Span,
    widgets::{Paragraph, Wrap},
    Frame,
};

use super::{App, Ctx, Deferred, Screen};
use crate::dates;
use crate::domain::goals::{self, Goal, GoalStatus};
use crate::domain::prompts::{self, Prompt, PromptKind};
use crate::domain::{actions, impulses, metrics, reviews, tasks};
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::widgets;

#[derive(Debug, Clone)]
pub enum ReviewAction {
    Answer(usize),
    ForceStart(String),
    PickGoal(Vec<i64>),
    PickAction(Vec<(i64, String)>),
    SaveAsTask(String),
    DisableWeekly,
}

fn ra(a: ReviewAction) -> Deferred {
    Deferred::Review(a)
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum MenuItem {
    Open,
    Close,
    Weekly,
    Goal,
    Srbai,
    Pattern,
    Prep,
}

pub struct ReviewMenu {
    pub items: Vec<(MenuItem, String, String)>, // item, etiqueta, estado
    pub sel: usize,
}

impl ReviewMenu {
    pub fn open(db: &Db) -> Result<Self> {
        let c = &db.conn;
        let today = dates::today();
        let guided = reviews::guided_today(c, today)?;
        let weekday = db.setting_i64("weekly_review_day", 6) as u32;
        let state = |sched: &str| -> String {
            if !prompts::set_enabled(c, sched).unwrap_or(false) {
                text::REVIEW_DISABLED.into()
            } else if guided.is_some() {
                text::REVIEW_DONE_TODAY.into()
            } else {
                text::REVIEW_AVAILABLE.into()
            }
        };
        let weekly_state = if !prompts::set_enabled(c, "weekly").unwrap_or(false) {
            text::REVIEW_DISABLED.to_string()
        } else if reviews::weekly_available(c, today, weekday)? {
            text::REVIEW_AVAILABLE.to_string()
        } else if reviews::last_of_kind(c, "weekly")?.and_then(|d| dates::parse_iso_date(&d)).map(|d| d >= dates::week_start(today)).unwrap_or(false) {
            text::REVIEW_DONE_THIS_WEEK.to_string()
        } else {
            format!("sugerida el {}", dates::WEEKDAYS[weekday.min(6) as usize])
        };
        let due_goals = goals::due_for_review(c, dates::now_ts())?.len();
        let goal_state = if due_goals > 0 { format!("{due_goals} {}", text::HOME_GOAL_REVIEW_AVAILABLE) } else { String::new() };
        let episodes = impulses::pattern(c, None, dates::now_ts())?.total_30;
        Ok(Self {
            items: vec![
                (MenuItem::Open, text::REVIEW_MENU_OPEN.into(), state("open")),
                (MenuItem::Close, text::REVIEW_MENU_CLOSE.into(), state("close")),
                (MenuItem::Weekly, text::REVIEW_MENU_WEEKLY.into(), weekly_state),
                (MenuItem::Goal, text::REVIEW_MENU_GOAL.into(), goal_state),
                (MenuItem::Srbai, text::SRBAI_TITLE.into(), String::new()),
                (MenuItem::Pattern, text::REVIEW_MENU_PATTERN.into(), if episodes > 0 { format!("{episodes} episodios en 30 días") } else { String::new() }),
                (MenuItem::Prep, text::REVIEW_MENU_PREP.into(), String::new()),
            ],
            sel: 0,
        })
    }
}

pub fn handle_menu(app: &mut App, mut m: ReviewMenu, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Review(m) };
    match k.code {
        KeyCode::Esc => {
            app.go_home();
            Screen::Review(m)
        }
        KeyCode::Up | KeyCode::Char('k') => {
            m.sel = m.sel.saturating_sub(1);
            Screen::Review(m)
        }
        KeyCode::Down | KeyCode::Char('j') => {
            m.sel = (m.sel + 1).min(m.items.len() - 1);
            Screen::Review(m)
        }
        KeyCode::Char(c @ '1'..='7') => {
            m.sel = (c as u8 - b'1') as usize;
            activate(app, m)
        }
        KeyCode::Enter => activate(app, m),
        KeyCode::Char('?') => {
            let mut h = vec![
                ("Intro / 1-7", "abrir"),
                ("", "Una sesión guiada al día como máximo; responder a una sola pregunta o a ninguna es válido."),
                ("", "Las preguntas se activan y editan en Ajustes."),
                ("", ""),
            ];
            h.extend(super::global_help());
            app.help(text::REVIEWS, h);
            Screen::Review(m)
        }
        _ => {
            let _ = db;
            Screen::Review(m)
        }
    }
}

fn activate(app: &mut App, m: ReviewMenu) -> Screen {
    let Some(db) = &app.db else { return Screen::Review(m) };
    let item = m.items[m.sel].0;
    match item {
        MenuItem::Open | MenuItem::Close | MenuItem::Weekly => {
            let sched = match item {
                MenuItem::Open => "open",
                MenuItem::Close => "close",
                _ => "weekly",
            };
            if !prompts::set_enabled(&db.conn, sched).unwrap_or(false) {
                app.notify(format!("{}: {}", m.items[m.sel].1, text::REVIEW_DISABLED));
                return Screen::Review(m);
            }
            // Una sesión guiada al día por defecto; una segunda requiere confirmación.
            if reviews::guided_today(&db.conn, dates::today()).ok().flatten().is_some() {
                app.confirm(text::REVIEW_SECOND_SESSION, false, ra(ReviewAction::ForceStart(sched.to_string())));
                return Screen::Review(m);
            }
            match Session::start(db, sched, None, None) {
                Ok(s) => Screen::ReviewSession(s),
                Err(e) => {
                    app.error(e.to_string());
                    Screen::Review(m)
                }
            }
        }
        MenuItem::Goal => {
            let gs: Vec<Goal> = goals::list(&db.conn, false).unwrap_or_default().into_iter().filter(|g| g.status == GoalStatus::Active).collect();
            if gs.is_empty() {
                app.notify("No hay objetivos activos que revisar.");
                return Screen::Review(m);
            }
            let ids: Vec<i64> = gs.iter().map(|g| g.id).collect();
            app.choice(text::REVIEW_GOAL_PICK, gs.iter().map(|g| g.name.clone()).collect(), 0, ra(ReviewAction::PickGoal(ids)));
            Screen::Review(m)
        }
        MenuItem::Srbai => {
            let acts = actions::list_active(&db.conn).unwrap_or_default();
            if acts.is_empty() {
                app.notify("No hay acciones activas.");
                return Screen::Review(m);
            }
            let pairs: Vec<(i64, String)> = acts.iter().map(|a| (a.id, a.name.clone())).collect();
            app.choice("¿Qué acción?", acts.iter().map(|a| a.name.clone()).collect(), 0, ra(ReviewAction::PickAction(pairs)));
            Screen::Review(m)
        }
        MenuItem::Pattern => match super::impulse::PatternView::open(db) {
            Ok(p) => Screen::Pattern(p),
            Err(e) => {
                app.error(e.to_string());
                Screen::Review(m)
            }
        },
        MenuItem::Prep => {
            super::impulse::start_prep(app);
            Screen::Review(m)
        }
    }
}

pub fn render_menu(m: &ReviewMenu, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let body = widgets::chrome(frame, area, theme, g, text::REVIEWS, "", &[("Intro", text::OPEN), ("Esc", text::BACK), ("?", text::HELP)]).body;
    let mut y = body.y + 1;
    for (i, (_, label, state)) in m.items.iter().enumerate() {
        let selected = i == m.sel;
        let marker = if selected { g.cursor } else { " " };
        let line = ratatui::text::Line::from(vec![
            Span::styled(format!("{marker} {}  ", i + 1), theme.accent),
            Span::styled(format!("{label:<32}"), if selected { theme.selected } else { theme.text }),
            Span::styled(state.clone(), theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 });
        y += 1;
    }
}

// ---- sesión -----------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Data,
    Questions,
    Done,
}

pub struct Session {
    pub kind: String,
    pub review_id: i64,
    pub prompts: Vec<Prompt>,
    pub idx: usize,
    pub answers: Vec<(usize, String, Option<f64>)>,
    pub goal: Option<Goal>,
    pub action: Option<(i64, String)>,
    pub data: Vec<String>,
    pub stage: Stage,
    pub summary: Vec<String>,
}

impl Session {
    pub fn start(db: &Db, kind: &str, goal: Option<Goal>, action: Option<(i64, String)>) -> Result<Self> {
        let c = &db.conn;
        let today = dates::today();
        let review_kind = match kind {
            "goal_review" => "goal",
            k if k.starts_with("srbai") => "srbai",
            k => k,
        };
        let review_id = reviews::start(c, review_kind, goal.as_ref().map(|g| g.id))?;
        let mut prompts_list = match (kind, &goal, &action) {
            ("goal_review", Some(g), _) => {
                // Plantillas con sustitución de {why} y {n}; no se instalan en la tabla.
                let n: i64 = c.query_row(
                    "SELECT count(*) FROM measurements m JOIN metrics x ON x.id = m.metric_id WHERE x.goal_id = ?1 AND m.measured_at >= ?2",
                    rusqlite::params![g.id, dates::now_ts() - 28 * 86_400],
                    |r| r.get(0),
                )?;
                let logs: i64 = c.query_row(
                    "SELECT count(*) FROM action_log l JOIN actions a ON a.id = l.action_id WHERE a.goal_id = ?1 AND l.done = 1 AND l.logged_at >= ?2",
                    rusqlite::params![g.id, dates::now_ts() - 28 * 86_400],
                    |r| r.get(0),
                )?;
                prompts::templates("goal_review")
                    .iter()
                    .enumerate()
                    .map(|(i, t)| Prompt {
                        id: -(i as i64) - 1,
                        text: t.text.replace("{why}", if g.why.is_empty() { "(sin motivo escrito)" } else { &g.why }).replace("{n}", &(n + logs).to_string()),
                        kind: t.kind,
                        options: t.options.map(|s| s.to_string()),
                        schedule: "goal_review".into(),
                        goal_id: Some(g.id),
                        source_ref: t.source_ref.into(),
                        position: i as i64,
                        archived: false,
                    })
                    .collect::<Vec<_>>()
            }
            (k, _, Some((aid, name))) if k.starts_with("srbai") => prompts::ensure_srbai(c, *aid, name)?,
            _ => prompts::list(c, kind)?,
        };
        if kind == "weekly" {
            prompts_list.truncate(6);
        } else if kind == "open" {
            prompts_list.truncate(2);
        } else if kind == "close" {
            prompts_list.truncate(3);
        }
        let mut data = vec![];
        if kind == "weekly" || kind == "goal_review" {
            let gid = goal.as_ref().map(|g| g.id);
            for a in actions::list_active(c)? {
                if gid.is_some() && a.goal_id != gid {
                    continue;
                }
                let s = actions::summary(c, &a, today)?;
                data.push(format!("{}: {} de {} esta semana; la anterior {}.", a.name, s.this_week, s.per_week, s.last_week));
            }
            let mets: Vec<metrics::Metric> = match gid {
                Some(g) => metrics::list_for_goal(c, g, false)?,
                None => {
                    let mut v = vec![];
                    for g in goals::list(c, false)? {
                        v.extend(metrics::list_for_goal(c, g.id, false)?);
                    }
                    v
                }
            };
            for m in mets.iter().filter(|m| m.kind.is_numeric()) {
                let series = metrics::daily_series(c, m, 60)?;
                if series.is_empty() {
                    continue;
                }
                let sum = matches!(m.kind, metrics::MetricKind::Count | metrics::MetricKind::Duration);
                let (t, l) = crate::analysis::trend::week_over_week(&series, today, sum);
                let change = crate::analysis::trend::describe_change(t, l, &m.unit, if m.kind == metrics::MetricKind::Number { 1 } else { 0 });
                let cur = crate::analysis::trend::current_level(&series, m.kind).map(|v| metrics::format_value(m.kind, Some(v), None, &m.unit)).unwrap_or_default();
                data.push(format!("{}: {cur}{}", m.name, change.map(|c| format!(" ({c})")).unwrap_or_default()));
            }
            let p = impulses::pattern(c, gid, dates::now_ts())?;
            if p.total_30 > 0 {
                data.push(text::PATTERN_NOT_ACTED.replace("{x}", &p.not_acted_30.to_string()).replace("{y}", &p.known_30.to_string()));
            }
            if data.is_empty() {
                data.push("Sin datos de acciones ni métricas esta semana.".into());
            }
        }
        let stage = if data.is_empty() { Stage::Questions } else { Stage::Data };
        Ok(Self { kind: kind.to_string(), review_id, prompts: prompts_list, idx: 0, answers: vec![], goal, action, data, stage, summary: vec![] })
    }

    fn current(&self) -> Option<&Prompt> {
        self.prompts.get(self.idx)
    }

    fn advance(&mut self, db: &Db, app: &App) {
        self.idx += 1;
        if self.idx >= self.prompts.len() {
            self.finish(db, app);
        }
    }

    fn record(&mut self, db: &Db, text_v: &str, value: Option<f64>) {
        if let Some(p) = self.current() {
            if p.id > 0 {
                let _ = prompts::answer(&db.conn, p.id, text_v, value, Some(self.review_id));
            }
            self.answers.push((self.idx, text_v.to_string(), value));
        }
    }

    fn finish(&mut self, db: &Db, app: &App) {
        let c = &db.conn;
        self.stage = Stage::Done;
        // Cierre del día: la tercera respuesta crea tareas para mañana (Scullin 2018).
        if self.kind == "close" {
            if let Some((_, txt, _)) = self.answers.iter().find(|(i, _, _)| *i == 2) {
                let mut n = 0;
                for line in txt.split(';').map(str::trim).filter(|s| !s.is_empty()) {
                    if tasks::create(c, tasks::NewTask { title: line, scheduled_day: Some(dates::today() + chrono::Duration::days(1)), ..Default::default() }).is_ok() {
                        n += 1;
                    }
                }
                if n > 0 {
                    self.summary.push(text::REVIEW_TASKS_CREATED.replace("{n}", &n.to_string()));
                }
            }
        }
        if self.kind.starts_with("srbai") {
            if let Some((aid, _)) = &self.action {
                let vals: Vec<f64> = self.answers.iter().filter_map(|(_, _, v)| *v).collect();
                if !vals.is_empty() {
                    let now = vals.iter().sum::<f64>() / vals.len() as f64;
                    self.summary.push(text::SRBAI_RESULT.replace("{now}", &format!("{now:.1}").replace('.', ",")));
                    let hist = prompts::srbai_history(c, *aid).unwrap_or_default();
                    match hist.get(1) {
                        Some((day, v)) => self.summary.push(text::SRBAI_PREVIOUS.replace("{day}", day).replace("{v}", &format!("{v:.1}").replace('.', ","))),
                        None => self.summary.push(text::SRBAI_FIRST.into()),
                    }
                }
            }
        }
        if self.kind == "goal_review" {
            if let Some(g) = &self.goal {
                let _ = goals::mark_reviewed(c, g.id);
                // Decisión (última pregunta): 0 mantener, 1 ajustar, 2 pausar, 3 cerrar.
                if let Some((_, _, Some(v))) = self.answers.iter().find(|(i, _, _)| *i == 4) {
                    match *v as i64 {
                        2 => {
                            let _ = goals::set_status(c, g.id, GoalStatus::Paused, None);
                            self.summary.push("Objetivo pausado. El historial se conserva.".into());
                        }
                        3 => {
                            self.summary.push("Para cerrarlo con su motivo, pulsa c en la ficha del objetivo.".into());
                        }
                        1 => self.summary.push("Ajusta la frecuencia en la pestaña Acciones de la ficha.".into()),
                        _ => {}
                    }
                }
            }
        }
        let _ = reviews::complete(c, self.review_id, "");
        if self.kind == "weekly" && self.answers.is_empty() && reviews::empty_weekly_streak(c).unwrap_or(0) >= 3 {
            self.summary.push(text::REVIEW_OFFER_DISABLE.into());
        }
        let _ = app;
    }
}

pub fn handle_session(app: &mut App, mut s: Session, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::ReviewSession(s) };
    match s.stage {
        Stage::Data => match k.code {
            KeyCode::Esc => return back_to_menu(app),
            KeyCode::Enter | KeyCode::Char(' ') => {
                if s.prompts.is_empty() {
                    s.finish(db, app);
                } else {
                    s.stage = Stage::Questions;
                }
            }
            _ => {}
        },
        Stage::Questions => {
            let Some(p) = s.current().cloned() else {
                s.finish(db, app);
                return Screen::ReviewSession(s);
            };
            match (p.kind, k.code) {
                (_, KeyCode::Esc) => {
                    // Salir guarda lo respondido hasta ahora.
                    s.finish(db, app);
                    return Screen::ReviewSession(s);
                }
                (_, KeyCode::Char('s')) | (PromptKind::Free, KeyCode::Char(' ')) => s.advance(db, app),
                (PromptKind::Free, KeyCode::Enter) => {
                    let idx = s.idx;
                    app.prompt(p.text.clone(), "", ra(ReviewAction::Answer(idx)));
                }
                (PromptKind::Choice, KeyCode::Char(c @ '1'..='9')) => {
                    let i = (c as u8 - b'1') as usize;
                    let opts = p.choices();
                    if i < opts.len() {
                        s.record(db, &opts[i], Some(i as f64));
                        s.advance(db, app);
                    }
                }
                (PromptKind::Choice, KeyCode::Enter) => s.advance(db, app),
                (PromptKind::Scale, KeyCode::Char(c @ '0'..='9')) => {
                    let v = (c as u8 - b'0') as f64;
                    let (min, max) = scale_bounds(&p);
                    if v >= min && v <= max {
                        s.record(db, "", Some(v));
                        s.advance(db, app);
                    }
                }
                (PromptKind::Scale, KeyCode::Enter) => s.advance(db, app),
                _ => {}
            }
        }
        Stage::Done => match k.code {
            KeyCode::Esc | KeyCode::Enter => {
                // Oferta de desactivar la revisión semanal tras tres vacías.
                if s.summary.iter().any(|l| l == text::REVIEW_OFFER_DISABLE) {
                    app.confirm(text::REVIEW_OFFER_DISABLE, false, ra(ReviewAction::DisableWeekly));
                    s.summary.retain(|l| l != text::REVIEW_OFFER_DISABLE);
                    return Screen::ReviewSession(s);
                }
                return back_to_menu(app);
            }
            _ => {}
        },
    }
    Screen::ReviewSession(s)
}

fn scale_bounds(p: &Prompt) -> (f64, f64) {
    let parts: Vec<f64> = p.options.as_deref().unwrap_or("0|10").split('|').filter_map(|x| x.trim().parse().ok()).collect();
    if parts.len() == 2 {
        (parts[0], parts[1])
    } else {
        (0.0, 10.0)
    }
}

fn back_to_menu(app: &mut App) -> Screen {
    match app.db.as_ref().and_then(|db| ReviewMenu::open(db).ok()) {
        Some(m) => Screen::Review(m),
        None => {
            app.go_home();
            Screen::Blank
        }
    }
}

pub fn run_deferred(app: &mut App, screen: Screen, a: ReviewAction, value: Option<String>) -> Screen {
    let v = value.unwrap_or_default().trim().to_string();
    let Some(db) = app.db.as_ref() else { return screen };
    match (a, screen) {
        (ReviewAction::Answer(idx), Screen::ReviewSession(mut s)) if s.idx == idx => {
            if !v.is_empty() {
                s.record(db, &v, None);
                // Propuesta de cambio semanal (pregunta 4) → ofrecer guardarla como tarea.
                if s.kind == "weekly" && idx == 3 {
                    s.advance(db, app);
                    app.confirm(format!("¿Guardar «{}» como tarea para la semana que viene?", v), false, ra(ReviewAction::SaveAsTask(v)));
                    return Screen::ReviewSession(s);
                }
            }
            s.advance(db, app);
            Screen::ReviewSession(s)
        }
        (ReviewAction::ForceStart(sched), screen) => match Session::start(db, &sched, None, None) {
            Ok(s) => Screen::ReviewSession(s),
            Err(e) => {
                app.error(e.to_string());
                screen
            }
        },
        (ReviewAction::SaveAsTask(t), screen) => {
            let next_week = dates::week_start(dates::today()) + chrono::Duration::days(7);
            if let Err(e) = tasks::create(&db.conn, tasks::NewTask { title: &t, scheduled_day: Some(next_week), ..Default::default() }) {
                app.error(e.to_string());
            } else {
                app.notify("Tarea creada para el lunes.");
            }
            screen
        }
        (ReviewAction::PickGoal(ids), screen) => {
            let Some(gid) = v.parse::<usize>().ok().and_then(|i| ids.get(i).copied()) else { return screen };
            let goal = goals::get(&db.conn, gid).ok().flatten();
            match Session::start(db, "goal_review", goal, None) {
                Ok(s) => Screen::ReviewSession(s),
                Err(e) => {
                    app.error(e.to_string());
                    screen
                }
            }
        }
        (ReviewAction::PickAction(pairs), screen) => {
            let Some((aid, name)) = v.parse::<usize>().ok().and_then(|i| pairs.get(i).cloned()) else { return screen };
            match Session::start(db, &format!("srbai:{aid}"), None, Some((aid, name))) {
                Ok(s) => Screen::ReviewSession(s),
                Err(e) => {
                    app.error(e.to_string());
                    screen
                }
            }
        }
        (ReviewAction::DisableWeekly, screen) => {
            if let Err(e) = prompts::disable_set(&db.conn, "weekly") {
                app.error(e.to_string());
            }
            back_to_menu(app).or_keep(screen)
        }
        (_, screen) => screen,
    }
}

trait OrKeep {
    fn or_keep(self, fallback: Screen) -> Screen;
}
impl OrKeep for Screen {
    fn or_keep(self, fallback: Screen) -> Screen {
        match self {
            Screen::Blank => fallback,
            s => s,
        }
    }
}

fn put(frame: &mut Frame, area: Rect, y: &mut u16, s: impl Into<String>, style: ratatui::style::Style) {
    let s: String = s.into();
    if *y >= area.y + area.height {
        return;
    }
    let h = widgets::line_count(&s, area.width).min(area.y + area.height - *y);
    frame.render_widget(Paragraph::new(Span::styled(s, style)).wrap(Wrap { trim: false }), Rect { x: area.x, y: *y, width: area.width, height: h });
    *y += h;
}

pub fn render_session(s: &Session, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let title = match s.kind.as_str() {
        "open" => text::REVIEW_MENU_OPEN.to_string(),
        "close" => text::REVIEW_MENU_CLOSE.to_string(),
        "weekly" => text::REVIEW_MENU_WEEKLY.to_string(),
        "goal_review" => format!("{}{}{}", text::REVIEW_MENU_GOAL, g.dot_sep, s.goal.as_ref().map(|g| g.name.clone()).unwrap_or_default()),
        _ => format!("{}{}{}", text::SRBAI_TITLE, g.dot_sep, s.action.as_ref().map(|a| a.1.clone()).unwrap_or_default()),
    };
    let right = if s.stage == Stage::Questions { format!("{} de {}", s.idx + 1, s.prompts.len()) } else { dates::fmt_date_short(today) };
    let keys: Vec<(&str, &str)> = match s.stage {
        Stage::Data => vec![("Intro", "continuar"), ("Esc", text::BACK)],
        Stage::Questions => vec![("Intro", "responder"), ("s", text::REVIEW_SKIP), ("Esc", "terminar aquí")],
        Stage::Done => vec![("Intro", text::BACK)],
    };
    let body = widgets::chrome(frame, area, theme, g, &title, &right, &keys).body;
    let w = body.width.min(72);
    let inner = Rect { x: body.x + (body.width - w) / 2, y: body.y + 1, width: w, height: body.height.saturating_sub(1) };
    let mut y = inner.y;
    match s.stage {
        Stage::Data => {
            put(frame, inner, &mut y, text::REVIEW_WEEK_HEADER, theme.title);
            y += 1;
            for d in &s.data {
                put(frame, inner, &mut y, format!("{} {d}", g.bullet), theme.text);
            }
            y += 1;
            put(frame, inner, &mut y, text::REVIEW_INTRO_WEEKLY, theme.dim);
        }
        Stage::Questions => {
            if let Some(p) = s.current() {
                put(frame, inner, &mut y, p.text.clone(), theme.emphasis);
                y += 1;
                match p.kind {
                    PromptKind::Free => put(frame, inner, &mut y, "Intro para escribir la respuesta; s para pasar a la siguiente.", theme.dim),
                    PromptKind::Choice => {
                        for (i, o) in p.choices().iter().enumerate() {
                            put(frame, inner, &mut y, format!("  {}  {o}", i + 1), theme.text);
                        }
                        y += 1;
                        put(frame, inner, &mut y, "Intro para omitir.", theme.dim);
                    }
                    PromptKind::Scale => {
                        let (min, max) = scale_bounds(p);
                        put(frame, inner, &mut y, format!("Pulsa un número de {} a {}. {}", min as i64, max as i64, if max == 5.0 { text::SRBAI_SCALE } else { "" }), theme.dim);
                    }
                }
                if !s.answers.is_empty() {
                    y += 1;
                    for (i, t, v) in s.answers.iter().rev().take(3).rev() {
                        let q = s.prompts.get(*i).map(|p| g.truncate(&p.text, 28)).unwrap_or_default();
                        let a = if t.is_empty() { v.map(|v| format!("{v}")).unwrap_or_default() } else { t.clone() };
                        put(frame, inner, &mut y, format!("{} {q} → {}", g.check, g.truncate(&a, (w as usize).saturating_sub(34))), theme.dim);
                    }
                }
            }
        }
        Stage::Done => {
            put(frame, inner, &mut y, text::REVIEW_SAVED, theme.emphasis);
            y += 1;
            put(frame, inner, &mut y, format!("{} respuestas guardadas.", s.answers.len()), theme.dim);
            for l in &s.summary {
                put(frame, inner, &mut y, l.clone(), theme.text);
            }
        }
    }
}

/// Línea de Inicio: «Revisión semanal disponible (r)» si procede.
pub fn weekly_line(db: &Db) -> Option<String> {
    let weekday = db.setting_i64("weekly_review_day", 6) as u32;
    let today = dates::today();
    let _ = today.weekday();
    if reviews::weekly_available(&db.conn, today, weekday).unwrap_or(false) {
        Some(text::HOME_WEEKLY_AVAILABLE.into())
    } else {
        None
    }
}
