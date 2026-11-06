//! Objetivos: lista, asistente de creación, ficha con pestañas (resumen,
//! métricas, hitos, acciones) y vista de evolución de una métrica.

use std::collections::HashSet;

use chrono::NaiveDate;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::{Paragraph, Wrap},
    Frame,
};
use unicode_width::UnicodeWidthStr;

use super::{App, Ctx, Deferred, Screen};
use crate::analysis::{spark, trend};
use crate::dates;
use crate::domain::actions::{self, Action, Schedule};
use crate::domain::goals::{self, Goal, GoalKind, GoalStatus, RedFlag, CATEGORIES};
use crate::domain::metrics::{self, Direction, Frequency, Measurement, Metric, MetricKind};
use crate::domain::milestones::{self, Milestone, MilestoneKind, MilestoneStatus};
use crate::domain::plans::{self, Plan};
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::widgets::{self, Selector};

/// Acciones diferidas del módulo (resultado de diálogos).
#[derive(Debug, Clone)]
pub enum GoalAction {
    Name,
    Kind(String),
    Category(String, GoalKind),
    Why(i64),
    Context(i64),
    Criteria(i64),
    Horizon(i64),
    ReviewEvery(i64),
    Rename(i64),
    CloseReason(i64),
    Learned(i64),
    Delete(i64),
    // métricas
    MetricName(i64),
    MetricKind(i64, String),
    MetricSensitive(i64, String, MetricKind),
    MetricUnit(i64, String, MetricKind, bool),
    MetricValue(i64, NaiveDate),
    MetricDay(i64),
    MetricDirection(i64),
    MetricTarget(i64, Direction),
    MetricFreq(i64),
    MetricArchive(i64),
    MetricDelete(i64),
    MeasurementDelete(i64),
    // hitos
    MilestoneTitle(i64),
    MilestoneKind(i64, String),
    MilestonePick(i64, String, MilestoneKind, Vec<i64>),
    MilestoneTarget(i64, String, MilestoneKind, Option<i64>),
    MilestoneDay(i64, String),
    MilestoneReschedule(i64),
    MilestoneRescheduleNote(i64, Option<NaiveDate>),
    MilestoneDelete(i64),
    // acciones
    ActionName(i64),
    ActionSchedule(i64, String),
    ActionAvoid(i64, String, Schedule),
    ActionCue(i64),
    ActionRename(i64),
    ActionReschedule(i64),
    ActionNote(i64, NaiveDate),
    ActionPause(i64),
    ActionDelete(i64),
    // planes si-entonces
    PlanSituation(i64),
    PlanResponse(i64, String),
    PlanReview(i64),
    PlanReviewNote(i64, String),
    PlanArchive(i64),
    PlanDelete(i64),
    PlanEditSituation(i64),
    PlanEditResponse(i64, String),
}

fn ga(a: GoalAction) -> Deferred {
    Deferred::Goal(a)
}

// ---- lista --------------------------------------------------------------------

pub struct GoalList {
    pub goals: Vec<Goal>,
    pub sel: Selector,
    pub show_closed: bool,
}

impl GoalList {
    pub fn open(db: &Db) -> Result<Self> {
        Ok(Self { goals: goals::list(&db.conn, false)?, sel: Selector::default(), show_closed: false })
    }
    fn reload(&mut self, db: &Db) {
        if let Ok(g) = goals::list(&db.conn, self.show_closed) {
            self.goals = g;
        }
        self.sel.clamp(self.goals.len());
    }
    fn select(&mut self, id: i64) {
        if let Some(i) = self.goals.iter().position(|g| g.id == id) {
            self.sel.index = i;
        }
    }
}

pub fn handle_list(app: &mut App, mut s: GoalList, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Goals(s) };
    match k.code {
        KeyCode::Esc => {
            app.go_home();
            Screen::Goals(s)
        }
        KeyCode::Char('n') => {
            // Aviso de seguridad una sola vez (safety.md §1.3), después el nombre.
            let shown = db.setting_bool("goals_safety_shown", false);
            if !shown {
                let _ = db.set_setting("goals_safety_shown", "1");
                app.info(text::GOAL_SAFETY_TITLE, text::GOAL_SAFETY_TEXT.iter().map(|s| s.to_string()).collect());
            } else {
                app.prompt(text::GOAL_NAME_PROMPT, "", ga(GoalAction::Name));
            }
            Screen::Goals(s)
        }
        KeyCode::Enter if !s.goals.is_empty() => {
            let id = s.goals[s.sel.index].id;
            match GoalDetail::open(db, id) {
                Ok(d) => Screen::GoalDetail(d),
                Err(e) => {
                    app.error(e.to_string());
                    Screen::Goals(s)
                }
            }
        }
        KeyCode::Char('a') => {
            s.show_closed = !s.show_closed;
            s.reload(db);
            Screen::Goals(s)
        }
        KeyCode::Char('?') => {
            let mut h = vec![("n", "nuevo objetivo"), ("Intro", "abrir la ficha"), ("a", "mostrar u ocultar cerrados"), ("", "")];
            h.extend(super::global_help());
            app.help(text::GOALS, h);
            Screen::Goals(s)
        }
        _ => {
            s.sel.handle_key(k, s.goals.len(), 10);
            Screen::Goals(s)
        }
    }
}

pub fn render_list(s: &mut GoalList, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let keys = [("n", "nuevo"), ("Intro", text::OPEN), ("a", "cerrados"), ("Esc", text::BACK), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, text::GOALS, "", &keys).body;
    if s.goals.is_empty() {
        widgets::empty_state(frame, body, theme, text::GOALS_EMPTY);
        return;
    }
    s.sel.clamp(s.goals.len());
    let range = s.sel.visible(s.goals.len(), body.height as usize);
    let now = dates::now_ts();
    let mut y = body.y;
    for i in range {
        let goal = &s.goals[i];
        let selected = i == s.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let mut meta = vec![goal.status.label().to_string()];
        if goal.status == GoalStatus::Active {
            if let Some(every) = goal.review_every_days {
                let base = goal.last_reviewed_at.unwrap_or(goal.created_at);
                if base + every * 86_400 <= now {
                    meta.push(text::GOAL_REVIEW_DUE.into());
                }
            }
        }
        if let Some(r) = &goal.close_reason {
            meta.push(goals::close_reason_label(r).into());
        }
        if let Some(d) = dates::parse_iso_date(&goal.started_on) {
            meta.push(format!("{} {}", text::GOAL_SINCE, dates::fmt_date_compact(d, today)));
        }
        let meta = meta.join(g.dot_sep);
        let avail = (body.width as usize).saturating_sub(4 + meta.width());
        let style = match goal.status {
            GoalStatus::Active if selected => theme.selected,
            GoalStatus::Active => theme.text,
            _ => theme.dim,
        };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{:<avail$}", g.truncate(&goal.name, avail)), style),
            Span::raw("  "),
            Span::styled(meta, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
    }
}

// ---- ficha ----------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tab {
    Summary,
    Metrics,
    Milestones,
    Actions,
    Plans,
}
const TABS: [Tab; 5] = [Tab::Summary, Tab::Metrics, Tab::Milestones, Tab::Actions, Tab::Plans];

impl Tab {
    fn label(self) -> &'static str {
        match self {
            Tab::Summary => text::GOAL_TAB_SUMMARY,
            Tab::Metrics => text::GOAL_TAB_METRICS,
            Tab::Milestones => text::GOAL_TAB_MILESTONES,
            Tab::Actions => text::GOAL_TAB_ACTIONS,
            Tab::Plans => text::GOAL_TAB_PLANS,
        }
    }
}

pub struct GoalDetail {
    pub goal: Goal,
    pub tab: Tab,
    pub metrics: Vec<Metric>,
    pub milestones: Vec<Milestone>,
    pub actions: Vec<Action>,
    pub plans: Vec<Plan>,
    pub action_today: Vec<Option<bool>>,
    pub action_summaries: Vec<actions::Summary>,
    pub sel: Selector,
    pub summary_sel: usize,
}

impl GoalDetail {
    pub fn open(db: &Db, id: i64) -> Result<Self> {
        let goal = goals::get(&db.conn, id)?.ok_or(crate::storage::DbError::NotFound)?;
        let mut d = Self {
            goal,
            tab: Tab::Summary,
            metrics: vec![],
            milestones: vec![],
            actions: vec![],
            plans: vec![],
            action_today: vec![],
            action_summaries: vec![],
            sel: Selector::default(),
            summary_sel: 0,
        };
        d.reload(db)?;
        Ok(d)
    }

    pub fn reload(&mut self, db: &Db) -> Result<()> {
        let c = &db.conn;
        let today = dates::today();
        if let Some(g) = goals::get(c, self.goal.id)? {
            self.goal = g;
        }
        self.metrics = metrics::list_for_goal(c, self.goal.id, true)?;
        let _ = milestones::evaluate(c, self.goal.id, today)?;
        self.milestones = milestones::list_for_goal(c, self.goal.id)?;
        self.actions = actions::list_for_goal(c, self.goal.id, true)?;
        self.plans = plans::list_for_goal(c, self.goal.id, true)?;
        self.action_today = self.actions.iter().map(|a| actions::status_on(c, a.id, today).ok().flatten()).collect();
        self.action_summaries = self.actions.iter().map(|a| actions::summary(c, a, today).unwrap_or_default()).collect();
        self.sel.clamp(self.len());
        Ok(())
    }

    fn reload_quiet(&mut self, app: &App) {
        if let Some(db) = &app.db {
            if let Err(e) = self.reload(db) {
                app.error(e.to_string());
            }
        }
    }

    fn len(&self) -> usize {
        match self.tab {
            Tab::Summary => 0,
            Tab::Metrics => self.metrics.len(),
            Tab::Milestones => self.milestones.len(),
            Tab::Actions => self.actions.len(),
            Tab::Plans => self.plans.len(),
        }
    }
}

fn back_to_list(app: &mut App, goal_id: i64) -> Screen {
    let Some(db) = &app.db else { return Screen::Blank };
    match GoalList::open(db) {
        Ok(mut l) => {
            l.select(goal_id);
            Screen::Goals(l)
        }
        Err(e) => {
            app.error(e.to_string());
            app.go_home();
            Screen::Blank
        }
    }
}

pub fn handle_detail(app: &mut App, mut d: GoalDetail, k: KeyEvent) -> Screen {
    if app.db.is_none() {
        return Screen::GoalDetail(d);
    }
    let gid = d.goal.id;
    match k.code {
        KeyCode::Esc => return back_to_list(app, gid),
        KeyCode::Tab | KeyCode::BackTab => {
            let i = TABS.iter().position(|t| *t == d.tab).unwrap_or(0);
            d.tab = TABS[if k.code == KeyCode::Tab { (i + 1) % 5 } else { (i + 4) % 5 }];
            d.sel = Selector::default();
            return Screen::GoalDetail(d);
        }
        KeyCode::Char(c @ '1'..='5') => {
            d.tab = TABS[(c as u8 - b'1') as usize];
            d.sel = Selector::default();
            return Screen::GoalDetail(d);
        }
        KeyCode::Char('?') => {
            let mut h: Vec<(&str, &str)> = match d.tab {
                Tab::Summary => vec![
                    ("e", "editar el campo seleccionado (↑ ↓ para elegirlo)"),
                    ("p", "pausar / reanudar"),
                    ("c", "cerrar el objetivo (con motivo, sin borrar nada)"),
                    ("R", "marcar como revisado"),
                    ("D", "borrar definitivamente"),
                ],
                Tab::Metrics => vec![
                    ("n", "nueva métrica"),
                    ("m", "registrar un valor de hoy"),
                    ("M", "registrar un valor de otro día"),
                    ("Intro", "ver evolución"),
                    ("d", "dirección y valor de referencia"),
                    ("f", "frecuencia sugerida"),
                    ("x", "pausar / reanudar (conserva los registros)"),
                    ("D", "borrar métrica y registros"),
                ],
                Tab::Milestones => vec![
                    ("n", "nuevo hito"),
                    ("espacio", "marcar alcanzado / pendiente (hitos manuales)"),
                    ("r", "reprogramar la fecha (conserva el historial)"),
                    ("x", "descartar"),
                    ("D", "borrar"),
                ],
                Tab::Actions => vec![
                    ("n", "nueva acción"),
                    ("espacio", "hoy: hecha → no hecha → sin registro"),
                    ("N", "nota del día"),
                    ("e", "renombrar"),
                    ("s", "frecuencia"),
                    ("c", "señal o momento"),
                    ("x", "pausar / reanudar"),
                    ("D", "borrar con su historial"),
                ],
                Tab::Plans => vec![
                    ("n", "nuevo plan «si… entonces…»"),
                    ("Intro / r", "¿te sirvió este plan?"),
                    ("e", "editar"),
                    ("x", "archivar / recuperar"),
                    ("D", "borrar"),
                    ("", "Se recuerda a los 7 y 14 días; si la situación no se da, no es un incumplimiento."),
                ],
            };
            h.push(("Tab / 1-5", "cambiar de pestaña"));
            h.push(("", ""));
            h.extend(super::global_help());
            app.help(&d.goal.name.clone(), h);
            return Screen::GoalDetail(d);
        }
        _ => {}
    }
    match d.tab {
        Tab::Summary => handle_summary(app, d, k),
        Tab::Metrics => handle_metrics_tab(app, d, k),
        Tab::Milestones => handle_milestones_tab(app, d, k),
        Tab::Actions => handle_actions_tab(app, d, k),
        Tab::Plans => handle_plans_tab(app, d, k),
    }
    .unwrap_or(Screen::Blank)
}

const SUMMARY_FIELDS: usize = 6; // nombre, por qué, contexto, criterio, horizonte, revisión

fn handle_summary(app: &mut App, mut d: GoalDetail, k: KeyEvent) -> Option<Screen> {
    let gid = d.goal.id;
    match k.code {
        KeyCode::Up | KeyCode::Char('k') => d.summary_sel = d.summary_sel.saturating_sub(1),
        KeyCode::Down | KeyCode::Char('j') => d.summary_sel = (d.summary_sel + 1).min(SUMMARY_FIELDS - 1),
        KeyCode::Char('e') | KeyCode::Enter => match d.summary_sel {
            0 => app.prompt(text::GOAL_NAME_PROMPT, &d.goal.name, ga(GoalAction::Rename(gid))),
            1 => app.prompt(text::GOAL_WHY_PROMPT, &d.goal.why, ga(GoalAction::Why(gid))),
            2 => app.prompt(text::GOAL_CONTEXT_PROMPT, &d.goal.context, ga(GoalAction::Context(gid))),
            3 => app.prompt(text::GOAL_CRITERIA_PROMPT, &d.goal.success_criteria, ga(GoalAction::Criteria(gid))),
            4 => app.prompt(text::GOAL_HORIZON_PROMPT, d.goal.horizon_on.as_deref().unwrap_or(""), ga(GoalAction::Horizon(gid))),
            _ => app.prompt(text::GOAL_REVIEW_PROMPT, &d.goal.review_every_days.map(|v| v.to_string()).unwrap_or_default(), ga(GoalAction::ReviewEvery(gid))),
        },
        KeyCode::Char('p') => {
            let db = app.db.as_ref()?;
            let next = if d.goal.status == GoalStatus::Paused { GoalStatus::Active } else { GoalStatus::Paused };
            if let Err(e) = goals::set_status(&db.conn, gid, next, None) {
                app.error(e.to_string());
            }
            d.reload_quiet(app);
        }
        KeyCode::Char('c') => {
            let opts = goals::CLOSE_REASONS.iter().map(|(_, l)| l.to_string()).collect();
            app.choice(text::GOAL_CLOSE_INTRO, opts, 0, ga(GoalAction::CloseReason(gid)));
        }
        KeyCode::Char('R') => {
            let db = app.db.as_ref()?;
            if let Err(e) = goals::mark_reviewed(&db.conn, gid) {
                app.error(e.to_string());
            }
            d.reload_quiet(app);
        }
        KeyCode::Char('D') => app.confirm(text::GOAL_DELETE_CONFIRM, true, ga(GoalAction::Delete(gid))),
        _ => {}
    }
    Some(Screen::GoalDetail(d))
}

fn handle_metrics_tab(app: &mut App, mut d: GoalDetail, k: KeyEvent) -> Option<Screen> {
    let gid = d.goal.id;
    let cur = d.metrics.get(d.sel.index).cloned();
    match (k.code, cur) {
        (KeyCode::Char('n'), _) => {
            let db = app.db.as_ref()?;
            if metrics::count_active(&db.conn).unwrap_or(0) >= 6 {
                app.notify(text::METRIC_TOO_MANY);
            }
            app.prompt(text::METRIC_NAME_PROMPT, "", ga(GoalAction::MetricName(gid)));
        }
        (KeyCode::Char('m'), Some(m)) => app.prompt(format!("{}: {}", text::METRIC_VALUE_PROMPT, value_hint(&m)), "", ga(GoalAction::MetricValue(m.id, dates::today()))),
        (KeyCode::Char('M'), Some(m)) => app.prompt(text::METRIC_DAY_PROMPT, "", ga(GoalAction::MetricDay(m.id))),
        (KeyCode::Enter, Some(m)) => {
            let db = app.db.as_ref()?;
            return Some(match MetricView::open(db, m.id, gid) {
                Ok(v) => Screen::MetricView(v),
                Err(e) => {
                    app.error(e.to_string());
                    Screen::GoalDetail(d)
                }
            });
        }
        (KeyCode::Char('d'), Some(m)) => {
            let opts = Direction::ALL.iter().map(|x| x.label().to_string()).collect();
            let cur = Direction::ALL.iter().position(|x| *x == m.direction).unwrap_or(0);
            app.choice(text::METRIC_DIRECTION_TITLE, opts, cur, ga(GoalAction::MetricDirection(m.id)));
        }
        (KeyCode::Char('f'), Some(m)) => {
            let opts = vec![Frequency::Daily.label().into(), Frequency::Weekly.label().into(), Frequency::Adhoc.label().into()];
            let cur = match m.frequency {
                Frequency::Daily => 0,
                Frequency::Weekly => 1,
                Frequency::Adhoc => 2,
            };
            app.choice(text::METRIC_FREQ_TITLE, opts, cur, ga(GoalAction::MetricFreq(m.id)));
        }
        (KeyCode::Char('x'), Some(m)) => {
            if m.archived {
                let db = app.db.as_ref()?;
                if let Err(e) = metrics::set_archived(&db.conn, m.id, false) {
                    app.error(e.to_string());
                }
                d.reload_quiet(app);
            } else {
                app.confirm(text::METRIC_ARCHIVE_CONFIRM, false, ga(GoalAction::MetricArchive(m.id)));
            }
        }
        (KeyCode::Char('D'), Some(m)) => app.confirm(format!("¿Borrar «{}» y todos sus registros? No se puede deshacer.", m.name), true, ga(GoalAction::MetricDelete(m.id))),
        _ => {
            d.sel.handle_key(k, d.metrics.len(), 8);
        }
    }
    Some(Screen::GoalDetail(d))
}

fn value_hint(m: &Metric) -> &'static str {
    match m.kind {
        MetricKind::Number => "número (72,4)",
        MetricKind::YesNo => "sí / no",
        MetricKind::Scale => "0 a 10",
        MetricKind::Duration => "minutos (45, 1:30)",
        MetricKind::Count => "entero",
        MetricKind::Time => "hora (23:15)",
        MetricKind::Text => "texto",
    }
}

fn handle_milestones_tab(app: &mut App, mut d: GoalDetail, k: KeyEvent) -> Option<Screen> {
    let gid = d.goal.id;
    let cur = d.milestones.get(d.sel.index).cloned();
    match (k.code, cur) {
        (KeyCode::Char('n'), _) => app.prompt(text::MILESTONE_TITLE_PROMPT, "", ga(GoalAction::MilestoneTitle(gid))),
        (KeyCode::Char(' ') | KeyCode::Enter, Some(m)) => {
            let db = app.db.as_ref()?;
            let r = match m.status {
                MilestoneStatus::Reached => milestones::mark_pending(&db.conn, m.id),
                _ => milestones::mark_reached(&db.conn, m.id),
            };
            if let Err(e) = r {
                app.error(e.to_string());
            }
            d.reload_quiet(app);
        }
        (KeyCode::Char('r'), Some(m)) => app.prompt(text::MILESTONE_RESCHEDULE_PROMPT, m.target_day.as_deref().unwrap_or(""), ga(GoalAction::MilestoneReschedule(m.id))),
        (KeyCode::Char('x'), Some(m)) => {
            let db = app.db.as_ref()?;
            let r = if m.status == MilestoneStatus::Dropped { milestones::mark_pending(&db.conn, m.id) } else { milestones::mark_dropped(&db.conn, m.id) };
            if let Err(e) = r {
                app.error(e.to_string());
            }
            d.reload_quiet(app);
        }
        (KeyCode::Char('D'), Some(m)) => app.confirm(text::MILESTONE_DELETE_CONFIRM, true, ga(GoalAction::MilestoneDelete(m.id))),
        _ => {
            d.sel.handle_key(k, d.milestones.len(), 8);
        }
    }
    Some(Screen::GoalDetail(d))
}

fn handle_actions_tab(app: &mut App, mut d: GoalDetail, k: KeyEvent) -> Option<Screen> {
    let gid = d.goal.id;
    let cur = d.actions.get(d.sel.index).cloned();
    let today = dates::today();
    match (k.code, cur) {
        (KeyCode::Char('n'), _) => app.prompt(text::ACTION_NAME_PROMPT, "", ga(GoalAction::ActionName(gid))),
        (KeyCode::Char(' ') | KeyCode::Enter, Some(a)) => {
            let db = app.db.as_ref()?;
            // Ciclo: sin registro → hecha → no hecha → sin registro.
            let next = match d.action_today.get(d.sel.index).copied().flatten() {
                None => Some(true),
                Some(true) => Some(false),
                Some(false) => None,
            };
            if let Err(e) = actions::log(&db.conn, a.id, today, next, "") {
                app.error(e.to_string());
            }
            if next == Some(false) {
                // Pantalla de desliz en versión breve (interventions.md §b.16): dato, no veredicto.
                let s = &d.action_summaries[d.sel.index];
                app.notify(format!("{} {}: {} de los últimos 30 días.", text::LAPSE_LINE1, a.name, s.last30));
            }
            d.reload_quiet(app);
        }
        (KeyCode::Char('N'), Some(a)) => app.prompt(text::ACTION_NOTE_PROMPT, "", ga(GoalAction::ActionNote(a.id, today))),
        (KeyCode::Char('e'), Some(a)) => app.prompt(text::ACTION_NAME_PROMPT, &a.name, ga(GoalAction::ActionRename(a.id))),
        (KeyCode::Char('s'), Some(a)) => app.prompt(text::ACTION_SCHEDULE_PROMPT, &a.schedule.describe(), ga(GoalAction::ActionReschedule(a.id))),
        (KeyCode::Char('c'), Some(a)) => app.prompt(text::ACTION_CUE_PROMPT, &a.cue, ga(GoalAction::ActionCue(a.id))),
        (KeyCode::Char('x'), Some(a)) => {
            if a.paused {
                let db = app.db.as_ref()?;
                if let Err(e) = actions::set_paused(&db.conn, a.id, false) {
                    app.error(e.to_string());
                }
                d.reload_quiet(app);
            } else {
                app.confirm(text::ACTION_PAUSE_CONFIRM, false, ga(GoalAction::ActionPause(a.id)));
            }
        }
        (KeyCode::Char('D'), Some(a)) => app.confirm(text::ACTION_DELETE_CONFIRM, true, ga(GoalAction::ActionDelete(a.id))),
        _ => {
            d.sel.handle_key(k, d.actions.len(), 8);
        }
    }
    Some(Screen::GoalDetail(d))
}

fn handle_plans_tab(app: &mut App, mut d: GoalDetail, k: KeyEvent) -> Option<Screen> {
    let gid = d.goal.id;
    let cur = d.plans.get(d.sel.index).cloned();
    match (k.code, cur) {
        (KeyCode::Char('n'), _) => app.prompt(text::PLAN_SITUATION_PROMPT, "", ga(GoalAction::PlanSituation(gid))),
        (KeyCode::Enter | KeyCode::Char('r'), Some(p)) => {
            let opts = plans::HELPFUL.iter().map(|(_, l)| l.to_string()).collect();
            app.choice(format!("{} Si {} → {}", text::PLAN_REVIEW_ASK, p.situation, p.response), opts, 0, ga(GoalAction::PlanReview(p.id)));
        }
        (KeyCode::Char('e'), Some(p)) => app.prompt(text::PLAN_SITUATION_PROMPT, &p.situation, ga(GoalAction::PlanEditSituation(p.id))),
        (KeyCode::Char('x'), Some(p)) => {
            let db = app.db.as_ref()?;
            if let Err(e) = plans::set_archived(&db.conn, p.id, !p.archived) {
                app.error(e.to_string());
            }
            d.reload_quiet(app);
        }
        (KeyCode::Char('D'), Some(p)) => app.confirm(text::PLAN_DELETE_CONFIRM, true, ga(GoalAction::PlanDelete(p.id))),
        _ => {
            d.sel.handle_key(k, d.plans.len(), 8);
        }
    }
    Some(Screen::GoalDetail(d))
}

// ---- acciones diferidas -----------------------------------------------------------

fn choice_index(v: &str) -> Option<usize> {
    v.trim().parse().ok()
}

pub fn run_deferred(app: &mut App, screen: Screen, a: GoalAction, value: Option<String>) -> Screen {
    let v = value.unwrap_or_default();
    let vt = v.trim().to_string();
    let Some(db) = app.db.as_ref() else { return screen };
    let conn = &db.conn;
    match a {
        GoalAction::Name => {
            if !vt.is_empty() {
                let opts = GoalKind::ALL.iter().map(|k| k.label().to_string()).collect();
                app.choice(text::GOAL_KIND_TITLE, opts, 0, ga(GoalAction::Kind(vt)));
            }
            screen
        }
        GoalAction::Kind(name) => {
            let kind = choice_index(&vt).and_then(|i| GoalKind::ALL.get(i).copied()).unwrap_or(GoalKind::Process);
            let opts = CATEGORIES.iter().map(|c| c.label.to_string()).collect();
            app.choice(text::GOAL_CATEGORY_TITLE, opts, 0, ga(GoalAction::Category(name, kind)));
            screen
        }
        GoalAction::Category(name, kind) => {
            let cat = choice_index(&vt).and_then(|i| CATEGORIES.get(i).copied()).unwrap_or(CATEGORIES[0]);
            match goals::create(conn, &name, kind, cat.key) {
                Ok(id) => {
                    let next = GoalDetail::open(db, id);
                    // Señal de derivación no bloqueante, una vez por objetivo (safety.md §3.3).
                    if let Some(flag) = cat.red_flag {
                        let _ = goals::mark_safety_shown(conn, id);
                        let mut lines = vec![text::DERIVATION_BASE.to_string(), String::new()];
                        lines.push(
                            match flag {
                                RedFlag::Suicidal | RedFlag::SelfHarm => text::DERIVATION_SUICIDAL,
                                RedFlag::Substance => text::DERIVATION_SUBSTANCE,
                                RedFlag::Eating => text::DERIVATION_EATING,
                                RedFlag::Gambling => text::DERIVATION_BASE,
                            }
                            .to_string(),
                        );
                        if flag == RedFlag::Gambling {
                            lines.pop();
                        }
                        app.info(text::DERIVATION_TITLE, lines);
                    } else {
                        app.prompt(text::GOAL_WHY_PROMPT, "", ga(GoalAction::Why(id)));
                    }
                    match next {
                        Ok(d) => Screen::GoalDetail(d),
                        Err(e) => {
                            app.error(e.to_string());
                            screen
                        }
                    }
                }
                Err(e) => {
                    app.error(e.to_string());
                    screen
                }
            }
        }
        GoalAction::Why(id) => {
            if let Err(e) = goals::set_why(conn, id, &vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::Context(id) => {
            if let Err(e) = goals::set_context(conn, id, &vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::Criteria(id) => {
            if let Err(e) = goals::set_success_criteria(conn, id, &vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::Horizon(id) => {
            match dates::parse_day_input(&vt, dates::today()) {
                Some(d) => {
                    if let Err(e) = goals::set_horizon(conn, id, d) {
                        app.error(e.to_string());
                    }
                }
                None => app.error(text::TASK_DATE_UNKNOWN),
            }
            refresh(app, screen)
        }
        GoalAction::ReviewEvery(id) => {
            let days = if vt.is_empty() { None } else { vt.parse::<i64>().ok().filter(|d| *d > 0) };
            if !vt.is_empty() && days.is_none() {
                app.error("Escribe un número de días, o déjalo vacío.");
            } else if let Err(e) = goals::set_review_every(conn, id, days) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::Rename(id) => {
            if !vt.is_empty() {
                if let Err(e) = goals::set_name(conn, id, &vt) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        GoalAction::CloseReason(id) => {
            let (key, _) = choice_index(&vt).and_then(|i| goals::CLOSE_REASONS.get(i)).copied().unwrap_or(goals::CLOSE_REASONS[3]);
            let status = if key == "achieved" { GoalStatus::Achieved } else { GoalStatus::Closed };
            if let Err(e) = goals::set_status(conn, id, status, Some(key)) {
                app.error(e.to_string());
            }
            app.prompt(text::GOAL_LEARNED_PROMPT, "", ga(GoalAction::Learned(id)));
            refresh(app, screen)
        }
        GoalAction::Learned(id) => {
            if !vt.is_empty() {
                let name = goals::get(conn, id).ok().flatten().map(|g| g.name).unwrap_or_default();
                let r = crate::domain::diary::create(conn).and_then(|eid| {
                    crate::domain::diary::save_body(conn, eid, Some(&format!("Cierre de «{name}»")), &vt)?;
                    crate::domain::diary::set_goal(conn, eid, Some(id))
                });
                if let Err(e) = r {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        GoalAction::Delete(id) => {
            if let Err(e) = goals::delete(conn, id) {
                app.error(e.to_string());
            }
            match GoalList::open(db) {
                Ok(l) => Screen::Goals(l),
                Err(_) => {
                    app.go_home();
                    Screen::Blank
                }
            }
        }
        // ---- métricas
        GoalAction::MetricName(gid) => {
            if !vt.is_empty() {
                let opts = MetricKind::ALL.iter().map(|k| k.label().to_string()).collect();
                app.choice(text::METRIC_KIND_TITLE, opts, 0, ga(GoalAction::MetricKind(gid, vt)));
            }
            screen
        }
        GoalAction::MetricKind(gid, name) => {
            let kind = choice_index(&vt).and_then(|i| MetricKind::ALL.get(i).copied()).unwrap_or(MetricKind::Number);
            app.choice(text::METRIC_SENSITIVE_ASK, vec!["No".into(), "Sí".into()], 0, ga(GoalAction::MetricSensitive(gid, name, kind)));
            screen
        }
        GoalAction::MetricSensitive(gid, name, kind) => {
            let sensitive = choice_index(&vt) == Some(1);
            if sensitive && !db.setting_bool("sensitive_warning_shown", false) {
                let _ = db.set_setting("sensitive_warning_shown", "1");
                // Se crea la métrica y se muestra el aviso una sola vez (safety.md §5.6).
                let r = metrics::create(conn, metrics::NewMetric { goal_id: Some(gid), name: &name, kind, unit: "", sensitive });
                app.info(text::METRIC_SENSITIVE_TITLE, vec![text::METRIC_SENSITIVE_TEXT.to_string()]);
                if let Err(e) = r {
                    app.error(e.to_string());
                }
                return refresh(app, screen);
            }
            if kind == MetricKind::Number || kind == MetricKind::Count {
                app.prompt(text::METRIC_UNIT_PROMPT, "", ga(GoalAction::MetricUnit(gid, name, kind, sensitive)));
                screen
            } else {
                if let Err(e) = metrics::create(conn, metrics::NewMetric { goal_id: Some(gid), name: &name, kind, unit: "", sensitive }) {
                    app.error(e.to_string());
                }
                refresh(app, screen)
            }
        }
        GoalAction::MetricUnit(gid, name, kind, sensitive) => {
            if let Err(e) = metrics::create(conn, metrics::NewMetric { goal_id: Some(gid), name: &name, kind, unit: &vt, sensitive }) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::MetricDay(mid) => {
            match dates::parse_day_input(&vt, dates::today()) {
                Some(Some(day)) => {
                    let hint = metrics::get(conn, mid).ok().flatten().map(|m| value_hint(&m)).unwrap_or("");
                    app.prompt(format!("{} ({}): {hint}", text::METRIC_VALUE_PROMPT, dates::fmt_date_short(day)), "", ga(GoalAction::MetricValue(mid, day)));
                }
                _ => app.error(text::TASK_DATE_UNKNOWN),
            }
            screen
        }
        GoalAction::MetricValue(mid, day) => {
            if let Some(m) = metrics::get(conn, mid).ok().flatten() {
                match metrics::parse_value(m.kind, &vt, m.scale_min, m.scale_max) {
                    Some((val, txt)) => {
                        if let Err(e) = metrics::record(conn, mid, day, val, txt.as_deref(), "") {
                            app.error(e.to_string());
                        }
                        if let Some(gid) = m.goal_id {
                            if let Ok(reached) = milestones::evaluate(conn, gid, dates::today()) {
                                if let Some(r) = reached.first() {
                                    app.notify(format!("{} {}", text::MILESTONE_REACHED_MSG, r.title));
                                }
                            }
                        }
                    }
                    None => app.error(text::METRIC_VALUE_UNKNOWN),
                }
            }
            refresh(app, screen)
        }
        GoalAction::MetricDirection(mid) => {
            let dir = choice_index(&vt).and_then(|i| Direction::ALL.get(i).copied()).unwrap_or(Direction::Observe);
            if let Err(e) = metrics::set_direction(conn, mid, dir) {
                app.error(e.to_string());
            }
            match dir {
                Direction::Up | Direction::Down | Direction::Maintain => app.prompt(text::METRIC_TARGET_PROMPT, "", ga(GoalAction::MetricTarget(mid, dir))),
                Direction::Range => app.prompt(text::METRIC_RANGE_PROMPT, "", ga(GoalAction::MetricTarget(mid, dir))),
                Direction::Observe => {
                    let _ = metrics::set_targets(conn, mid, None, None);
                }
            }
            refresh(app, screen)
        }
        GoalAction::MetricTarget(mid, dir) => {
            let r = if dir == Direction::Range {
                let parts: Vec<f64> = vt.split(['-', '–']).filter_map(|p| p.trim().replace(',', ".").parse().ok()).collect();
                if parts.len() == 2 {
                    metrics::set_targets(conn, mid, Some(parts[0].min(parts[1])), Some(parts[0].max(parts[1])))
                } else {
                    app.error(text::METRIC_VALUE_UNKNOWN);
                    Ok(())
                }
            } else {
                let v: Option<f64> = vt.replace(',', ".").parse().ok();
                if v.is_none() && !vt.is_empty() {
                    app.error(text::METRIC_VALUE_UNKNOWN);
                }
                metrics::set_targets(conn, mid, v, if dir == Direction::Maintain { v } else { None })
            };
            if let Err(e) = r {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::MetricFreq(mid) => {
            let f = match choice_index(&vt) {
                Some(0) => Frequency::Daily,
                Some(1) => Frequency::Weekly,
                _ => Frequency::Adhoc,
            };
            if let Err(e) = metrics::set_frequency(conn, mid, f) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::MetricArchive(mid) => {
            if let Err(e) = metrics::set_archived(conn, mid, true) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::MetricDelete(mid) => {
            if let Err(e) = metrics::delete(conn, mid) {
                app.error(e.to_string());
            }
            match screen {
                Screen::MetricView(v) => match GoalDetail::open(db, v.goal_id) {
                    Ok(mut d) => {
                        d.tab = Tab::Metrics;
                        Screen::GoalDetail(d)
                    }
                    Err(_) => back_to_list(app, v.goal_id),
                },
                other => refresh(app, other),
            }
        }
        GoalAction::MeasurementDelete(id) => {
            if let Err(e) = metrics::delete_measurement(conn, id) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        // ---- hitos
        GoalAction::MilestoneTitle(gid) => {
            if !vt.is_empty() {
                let opts = MilestoneKind::ALL.iter().map(|k| k.label().to_string()).collect();
                app.choice(text::MILESTONE_KIND_TITLE, opts, 0, ga(GoalAction::MilestoneKind(gid, vt)));
            }
            screen
        }
        GoalAction::MilestoneKind(gid, title) => {
            let kind = choice_index(&vt).and_then(|i| MilestoneKind::ALL.get(i).copied()).unwrap_or(MilestoneKind::Manual);
            match kind {
                MilestoneKind::Manual => {
                    if let Err(e) = milestones::create(conn, milestones::NewMilestone { goal_id: gid, title: &title, kind, metric_id: None, action_id: None, target_value: None, target_day: None }) {
                        app.error(e.to_string());
                    }
                    refresh(app, screen)
                }
                MilestoneKind::Date => {
                    app.prompt(text::MILESTONE_DAY_PROMPT, "", ga(GoalAction::MilestoneDay(gid, title)));
                    screen
                }
                MilestoneKind::ActionCount | MilestoneKind::SustainWeeks => {
                    let acts = actions::list_for_goal(conn, gid, false).unwrap_or_default();
                    if acts.is_empty() {
                        app.error("Primero define una acción en la pestaña Acciones.");
                        return screen;
                    }
                    let ids: Vec<i64> = acts.iter().map(|a| a.id).collect();
                    app.choice(text::MILESTONE_PICK_ACTION, acts.iter().map(|a| a.name.clone()).collect(), 0, ga(GoalAction::MilestonePick(gid, title, kind, ids)));
                    screen
                }
                MilestoneKind::MetricValue => {
                    let mets = metrics::list_for_goal(conn, gid, false).unwrap_or_default();
                    if mets.is_empty() {
                        app.error("Primero define una métrica en la pestaña Métricas.");
                        return screen;
                    }
                    let ids: Vec<i64> = mets.iter().map(|m| m.id).collect();
                    app.choice(text::MILESTONE_PICK_METRIC, mets.iter().map(|m| m.name.clone()).collect(), 0, ga(GoalAction::MilestonePick(gid, title, kind, ids)));
                    screen
                }
            }
        }
        GoalAction::MilestonePick(gid, title, kind, ids) => {
            let picked = choice_index(&vt).and_then(|i| ids.get(i).copied());
            app.prompt(text::MILESTONE_TARGET_PROMPT, "", ga(GoalAction::MilestoneTarget(gid, title, kind, picked)));
            screen
        }
        GoalAction::MilestoneTarget(gid, title, kind, picked) => {
            match vt.replace(',', ".").parse::<f64>() {
                Ok(target) => {
                    let (metric_id, action_id) = if kind == MilestoneKind::MetricValue { (picked, None) } else { (None, picked) };
                    if let Err(e) = milestones::create(conn, milestones::NewMilestone { goal_id: gid, title: &title, kind, metric_id, action_id, target_value: Some(target), target_day: None }) {
                        app.error(e.to_string());
                    }
                }
                Err(_) => app.error(text::METRIC_VALUE_UNKNOWN),
            }
            refresh(app, screen)
        }
        GoalAction::MilestoneDay(gid, title) => {
            match dates::parse_day_input(&vt, dates::today()) {
                Some(Some(day)) => {
                    if let Err(e) = milestones::create(conn, milestones::NewMilestone { goal_id: gid, title: &title, kind: MilestoneKind::Date, metric_id: None, action_id: None, target_value: None, target_day: Some(day) }) {
                        app.error(e.to_string());
                    }
                }
                _ => app.error(text::TASK_DATE_UNKNOWN),
            }
            refresh(app, screen)
        }
        GoalAction::MilestoneReschedule(id) => {
            match dates::parse_day_input(&vt, dates::today()) {
                Some(day) => app.prompt(text::MILESTONE_RESCHEDULE_NOTE, "", ga(GoalAction::MilestoneRescheduleNote(id, day))),
                None => app.error(text::TASK_DATE_UNKNOWN),
            }
            screen
        }
        GoalAction::MilestoneRescheduleNote(id, day) => {
            if let Err(e) = milestones::reschedule(conn, id, day, &vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::MilestoneDelete(id) => {
            if let Err(e) = milestones::delete(conn, id) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        // ---- acciones
        GoalAction::ActionName(gid) => {
            if !vt.is_empty() {
                app.prompt(text::ACTION_SCHEDULE_PROMPT, "3 veces por semana", ga(GoalAction::ActionSchedule(gid, vt)));
            }
            screen
        }
        GoalAction::ActionSchedule(gid, name) => {
            match Schedule::parse_human(&vt) {
                Some(s) => app.choice(text::ACTION_AVOID_ASK, vec!["No, es algo que quiero hacer".into(), "Sí, quiero dejar de hacerlo".into()], 0, ga(GoalAction::ActionAvoid(gid, name, s))),
                None => {
                    app.error(text::ACTION_SCHEDULE_UNKNOWN);
                    app.prompt(text::ACTION_SCHEDULE_PROMPT, &vt, ga(GoalAction::ActionSchedule(gid, name)));
                }
            }
            screen
        }
        GoalAction::ActionAvoid(gid, name, schedule) => {
            let avoid = choice_index(&vt) == Some(1);
            match actions::create(conn, Some(gid), &name, &schedule, avoid) {
                Ok(id) => app.prompt(text::ACTION_CUE_PROMPT, "", ga(GoalAction::ActionCue(id))),
                Err(e) => app.error(e.to_string()),
            }
            refresh(app, screen)
        }
        GoalAction::ActionCue(id) => {
            if let Err(e) = actions::set_cue(conn, id, &vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::ActionRename(id) => {
            if !vt.is_empty() {
                if let Err(e) = actions::set_name(conn, id, &vt) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        GoalAction::ActionReschedule(id) => {
            match Schedule::parse_human(&vt) {
                Some(s) => {
                    if let Err(e) = actions::set_schedule(conn, id, &s) {
                        app.error(e.to_string());
                    }
                }
                None => app.error(text::ACTION_SCHEDULE_UNKNOWN),
            }
            refresh(app, screen)
        }
        GoalAction::ActionNote(id, day) => {
            let st = actions::status_on(conn, id, day).ok().flatten();
            if let Err(e) = actions::log(conn, id, day, Some(st.unwrap_or(true)), &vt) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::ActionPause(id) => {
            if let Err(e) = actions::set_paused(conn, id, true) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::ActionDelete(id) => {
            if let Err(e) = actions::delete(conn, id) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        // ---- planes si-entonces
        GoalAction::PlanSituation(gid) => {
            if !vt.is_empty() {
                if plans::is_vague(&vt) {
                    app.notify(text::PLAN_VAGUE);
                }
                app.prompt(text::PLAN_RESPONSE_PROMPT, "", ga(GoalAction::PlanResponse(gid, vt)));
            }
            screen
        }
        GoalAction::PlanResponse(gid, situation) => {
            if !vt.is_empty() {
                match plans::create(conn, Some(gid), None, &situation, &vt, true) {
                    Ok(_) => app.notify(format!("{} {}", text::PLAN_SAVED, text::PLAN_BOOSTERS)),
                    Err(e) => app.error(e.to_string()),
                }
            }
            refresh(app, screen)
        }
        GoalAction::PlanReview(id) => {
            let (key, _) = choice_index(&vt).and_then(|i| plans::HELPFUL.get(i)).copied().unwrap_or(plans::HELPFUL[3]);
            match plans::review(conn, id, key, "") {
                Ok(true) => app.confirm(text::PLAN_OFFER_ARCHIVE, false, ga(GoalAction::PlanArchive(id))),
                Ok(false) => {}
                Err(e) => app.error(e.to_string()),
            }
            refresh(app, screen)
        }
        GoalAction::PlanReviewNote(..) => refresh(app, screen),
        GoalAction::PlanArchive(id) => {
            if let Err(e) = plans::set_archived(conn, id, true) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::PlanDelete(id) => {
            if let Err(e) = plans::delete(conn, id) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        GoalAction::PlanEditSituation(id) => {
            if !vt.is_empty() {
                let cur = plans::get(conn, id).ok().flatten().map(|p| p.response).unwrap_or_default();
                app.prompt(text::PLAN_RESPONSE_PROMPT, &cur, ga(GoalAction::PlanEditResponse(id, vt)));
            }
            screen
        }
        GoalAction::PlanEditResponse(id, situation) => {
            if !vt.is_empty() {
                if let Err(e) = plans::update(conn, id, &situation, &vt) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
    }
}

fn refresh(app: &App, screen: Screen) -> Screen {
    match screen {
        Screen::GoalDetail(mut d) => {
            d.reload_quiet(app);
            Screen::GoalDetail(d)
        }
        Screen::MetricView(mut v) => {
            if let Some(db) = &app.db {
                if let Err(e) = v.reload(db) {
                    app.error(e.to_string());
                }
            }
            Screen::MetricView(v)
        }
        Screen::Goals(mut l) => {
            if let Some(db) = &app.db {
                l.reload(db);
            }
            Screen::Goals(l)
        }
        other => other,
    }
}

// ---- dibujo de la ficha ----------------------------------------------------------

pub fn render_detail(d: &mut GoalDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let keys: Vec<(&str, &str)> = match d.tab {
        Tab::Summary => vec![("e", "editar"), ("p", "pausar"), ("c", "cerrar"), ("Tab", "pestaña"), ("Esc", text::BACK), ("?", text::HELP)],
        Tab::Metrics => vec![("m", "registrar"), ("n", "nueva"), ("Intro", "evolución"), ("Tab", "pestaña"), ("Esc", text::BACK), ("?", text::HELP)],
        Tab::Milestones => vec![("n", "nuevo"), ("espacio", "alcanzado"), ("r", "reprogramar"), ("Tab", "pestaña"), ("Esc", text::BACK), ("?", text::HELP)],
        Tab::Actions => vec![("espacio", "hoy"), ("n", "nueva"), ("N", "nota"), ("Tab", "pestaña"), ("Esc", text::BACK), ("?", text::HELP)],
        Tab::Plans => vec![("n", "nuevo"), ("Intro", "¿sirvió?"), ("e", "editar"), ("x", text::ARCHIVE), ("Esc", text::BACK), ("?", text::HELP)],
    };
    let right = d.goal.status.label();
    let body = widgets::chrome(frame, area, theme, g, &format!("{}{}{}", text::GOALS, g.dot_sep, g.truncate(&d.goal.name, 50)), right, &keys).body;
    let mut spans = vec![];
    for (i, t) in TABS.iter().enumerate() {
        spans.push(Span::styled(format!("{} ", i + 1), theme.dim));
        spans.push(Span::styled(t.label().to_string(), if *t == d.tab { theme.selected } else { theme.dim }));
        spans.push(Span::raw("   "));
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), Rect { x: body.x, y: body.y, width: body.width, height: 1 });
    let inner = Rect { x: body.x, y: body.y + 2, width: body.width, height: body.height.saturating_sub(2) };
    match d.tab {
        Tab::Summary => render_summary(d, frame, inner, ctx),
        Tab::Metrics => render_metrics_tab(d, frame, inner, ctx),
        Tab::Milestones => render_milestones_tab(d, frame, inner, ctx),
        Tab::Actions => render_actions_tab(d, frame, inner, ctx),
        Tab::Plans => render_plans_tab(d, frame, inner, ctx),
    }
}

fn render_plans_tab(d: &mut GoalDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    if d.plans.is_empty() {
        widgets::empty_state(frame, area, theme, text::PLANS_EMPTY);
        return;
    }
    d.sel.clamp(d.plans.len());
    let visible = (area.height as usize / 2).max(1);
    let range = d.sel.visible(d.plans.len(), visible);
    let mut y = area.y;
    for i in range {
        let p = &d.plans[i];
        let selected = i == d.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let style = if p.archived { theme.dim } else if selected { theme.selected } else { theme.text };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled("Si ", theme.dim),
            Span::styled(g.truncate(&p.situation, (area.width as usize).saturating_sub(6)), style),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
        if y >= area.y + area.height {
            break;
        }
        let total = p.helpful_yes + p.helpful_partly + p.helpful_no + p.not_used;
        let mut meta = vec![];
        if total > 0 {
            meta.push(format!("{} {}: {} sí, {} en parte, {} no, {} sin darse", total, text::PLAN_REVIEWS, p.helpful_yes, p.helpful_partly, p.helpful_no, p.not_used));
        }
        if p.archived {
            meta.insert(0, "archivado".into());
        }
        let meta = meta.join(g.dot_sep);
        let avail = (area.width as usize).saturating_sub(6 + meta.width() + 2);
        let line = Line::from(vec![
            Span::raw("   "),
            Span::styled("→ ", theme.dim),
            Span::styled(format!("{:<avail$}", g.truncate(&p.response, avail)), style),
            Span::raw("  "),
            Span::styled(meta, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
    }
}

fn put_wrapped(frame: &mut Frame, area: Rect, y: &mut u16, text: String, style: ratatui::style::Style) {
    if *y >= area.y + area.height {
        return;
    }
    let h = widgets::line_count(&text, area.width).min(area.y + area.height - *y);
    frame.render_widget(Paragraph::new(Span::styled(text, style)).wrap(Wrap { trim: false }), Rect { x: area.x, y: *y, width: area.width, height: h });
    *y += h;
}

fn render_summary(d: &GoalDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let goal = &d.goal;
    let mut y = area.y;
    let empty = "—";
    let fields: [(&str, String); SUMMARY_FIELDS] = [
        ("Objetivo", goal.name.clone()),
        (text::GOAL_WHY, if goal.why.is_empty() { empty.into() } else { goal.why.clone() }),
        (text::GOAL_CONTEXT, if goal.context.is_empty() { empty.into() } else { goal.context.clone() }),
        (text::GOAL_CRITERIA, if goal.success_criteria.is_empty() { empty.into() } else { goal.success_criteria.clone() }),
        (
            text::GOAL_HORIZON,
            goal.horizon_on.as_deref().and_then(dates::parse_iso_date).map(|d| dates::fmt_date_long(d)).unwrap_or_else(|| "sin fecha límite".into()),
        ),
        (
            "Revisión",
            match goal.review_every_days {
                Some(n) => format!(
                    "cada {n} días{}{}",
                    g.dot_sep,
                    match goal.last_reviewed_at {
                        Some(t) => format!("{} {}", text::GOAL_LAST_REVIEW, dates::fmt_relative_days(dates::ts_to_date(t), today)),
                        None => text::GOAL_NO_REVIEW.into(),
                    }
                ),
                None => "sin revisión programada".into(),
            },
        ),
    ];
    for (i, (label, value)) in fields.iter().enumerate() {
        let selected = i == d.summary_sel;
        let marker = if selected { g.cursor } else { " " };
        let line = Line::from(vec![Span::styled(format!("{marker} "), theme.accent), Span::styled(label.to_string(), if selected { theme.selected } else { theme.dim })]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
        put_wrapped(frame, Rect { x: area.x + 4, width: area.width.saturating_sub(4), ..area }, &mut y, value.clone(), theme.text);
        y += 1;
    }
    // Línea descriptiva de estado: tipo, categoría, desde, elementos.
    let cat = goals::category(&goal.category).label;
    let desc = format!(
        "{}{}{}{}{} {}{}{} métricas, {} hitos, {} acciones",
        goal.kind.label().split(' ').next().unwrap_or(""),
        g.dot_sep,
        cat,
        g.dot_sep,
        text::GOAL_SINCE,
        dates::parse_iso_date(&goal.started_on).map(|d| dates::fmt_date_compact(d, today)).unwrap_or_default(),
        g.dot_sep,
        d.metrics.iter().filter(|m| !m.archived).count(),
        d.milestones.iter().filter(|m| m.status == MilestoneStatus::Pending).count(),
        d.actions.iter().filter(|a| !a.archived && !a.paused).count(),
    );
    put_wrapped(frame, area, &mut y, desc, theme.dim);
}

fn render_metrics_tab(d: &mut GoalDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    if d.metrics.is_empty() {
        widgets::empty_state(frame, area, theme, text::METRICS_EMPTY);
        return;
    }
    d.sel.clamp(d.metrics.len());
    let range = d.sel.visible(d.metrics.len(), area.height as usize);
    let mut y = area.y;
    for i in range {
        let m = &d.metrics[i];
        let selected = i == d.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let last = ctx
            .db
            .and_then(|db| metrics::measurements(&db.conn, m.id, 1).ok())
            .and_then(|v| v.into_iter().next())
            .map(|x| {
                let day = dates::parse_iso_date(&x.day).map(|d| dates::fmt_date_compact(d, today)).unwrap_or_default();
                format!("{} {}: {}", text::METRIC_LAST, day, metrics::format_value(m.kind, x.value, x.text_value.as_deref(), &m.unit))
            })
            .unwrap_or_else(|| "sin registros".into());
        let mut meta = vec![format!("{} {}", m.count, text::METRIC_RECORDS), last];
        if m.frequency != Frequency::Adhoc {
            meta.push(m.frequency.label().into());
        }
        if m.archived {
            meta.insert(0, "pausada".into());
        }
        let meta = meta.join(g.dot_sep);
        let avail = (area.width as usize).saturating_sub(4 + meta.width());
        let style = if m.archived { theme.dim } else if selected { theme.selected } else { theme.text };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{:<avail$}", g.truncate(&m.name, avail)), style),
            Span::raw("  "),
            Span::styled(meta, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
    }
}

fn render_milestones_tab(d: &mut GoalDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    if d.milestones.is_empty() {
        widgets::empty_state(frame, area, theme, text::MILESTONES_EMPTY);
        return;
    }
    d.sel.clamp(d.milestones.len());
    let range = d.sel.visible(d.milestones.len(), area.height as usize);
    let mut y = area.y;
    for i in range {
        let m = &d.milestones[i];
        let selected = i == d.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let (glyph, gstyle) = match m.status {
            MilestoneStatus::Pending => (g.todo, theme.text),
            MilestoneStatus::Reached => (g.done, theme.positive),
            MilestoneStatus::Dropped => (g.partial, theme.dim),
        };
        let mut meta = vec![];
        if let Some(day) = m.target_day.as_deref().and_then(dates::parse_iso_date) {
            meta.push(dates::fmt_date_compact(day, today));
        }
        if let Some(db) = ctx.db {
            if let Ok(Some((cur, target))) = milestones::progress(&db.conn, m, today) {
                let (bar, txt) = spark::progress_bar(cur, target, 10, "", g);
                meta.push(format!("{bar} {txt}"));
            }
        }
        match m.status {
            MilestoneStatus::Reached => meta.push(format!("{} {}", text::MILESTONE_REACHED, m.reached_at.map(|t| dates::fmt_date_compact(dates::ts_to_date(t), today)).unwrap_or_default())),
            MilestoneStatus::Dropped => meta.push(text::MILESTONE_DROPPED.into()),
            _ => {}
        }
        let meta = meta.join(g.dot_sep);
        let avail = (area.width as usize).saturating_sub(6 + meta.width());
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{glyph} "), gstyle),
            Span::styled(format!("{:<avail$}", g.truncate(&m.title, avail)), if selected { theme.selected } else if m.status == MilestoneStatus::Pending { theme.text } else { theme.dim }),
            Span::raw("  "),
            Span::styled(meta, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
    }
}

fn render_actions_tab(d: &mut GoalDetail, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    if d.actions.is_empty() {
        widgets::empty_state(frame, area, theme, text::ACTIONS_EMPTY);
        return;
    }
    d.sel.clamp(d.actions.len());
    let rows_per = 2usize;
    let visible = (area.height as usize / rows_per).max(1);
    let range = d.sel.visible(d.actions.len(), visible);
    let mut y = area.y;
    for i in range {
        let a = &d.actions[i];
        let s = &d.action_summaries[i];
        let selected = i == d.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let (glyph, gstyle, today_txt) = match d.action_today.get(i).copied().flatten() {
            Some(true) => (g.done, theme.positive, text::ACTION_TODAY_DONE),
            Some(false) => (g.todo, theme.dim, text::ACTION_TODAY_NOT),
            None => (g.bullet, theme.dim, text::ACTION_TODAY_BLANK),
        };
        let mut head = vec![a.schedule.describe()];
        if a.avoid {
            head.insert(0, "evitar".into());
        }
        if !a.cue.is_empty() {
            head.push(a.cue.clone());
        }
        if a.paused {
            head.insert(0, "pausada".into());
        }
        let head = head.join(g.dot_sep);
        let avail = (area.width as usize).saturating_sub(6 + head.width());
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{glyph} "), gstyle),
            Span::styled(format!("{:<avail$}", g.truncate(&a.name, avail)), if a.paused { theme.dim } else if selected { theme.selected } else { theme.text }),
            Span::raw("  "),
            Span::styled(head, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
        if y >= area.y + area.height {
            break;
        }
        // Descriptivo: «hecha hoy · 3 de 3 esta semana · 11 de los últimos 30 días · 2 semanas seguidas»
        let mut parts = vec![today_txt.to_string(), format!("{} de {} {}", s.this_week, s.per_week, text::ACTION_THIS_WEEK), format!("{} {}", s.last30, text::ACTION_LAST30)];
        if s.weeks_meeting_target >= 2 {
            parts.push(format!("{} {}", s.weeks_meeting_target, text::ACTION_WEEKS_OK));
        }
        // Calendario de la semana actual: L M X J V S D
        let done: HashSet<NaiveDate> = ctx.db.and_then(|db| actions::done_days(&db.conn, a.id, dates::week_start(today), today).ok()).unwrap_or_default().into_iter().collect();
        let rows = spark::activity_rows(&done, &HashSet::new(), today, 1, g);
        let week = rows.first().map(|(_, r)| r.clone()).unwrap_or_default();
        let line = Line::from(vec![Span::raw("     "), Span::styled(week, theme.accent), Span::raw("   "), Span::styled(g.truncate(&parts.join(g.dot_sep), (area.width as usize).saturating_sub(24)), theme.dim)]);
        frame.render_widget(Paragraph::new(line), Rect { x: area.x, y, width: area.width, height: 1 });
        y += 1;
    }
}

// ---- vista de una métrica -----------------------------------------------------------

pub struct MetricView {
    pub metric: Metric,
    pub goal_id: i64,
    pub series: Vec<(NaiveDate, f64)>,
    pub recent: Vec<Measurement>,
    pub sel: Selector,
}

impl MetricView {
    pub fn open(db: &Db, metric_id: i64, goal_id: i64) -> Result<Self> {
        let metric = metrics::get(&db.conn, metric_id)?.ok_or(crate::storage::DbError::NotFound)?;
        let mut v = Self { metric, goal_id, series: vec![], recent: vec![], sel: Selector::default() };
        v.reload(db)?;
        Ok(v)
    }
    pub fn reload(&mut self, db: &Db) -> Result<()> {
        if let Some(m) = metrics::get(&db.conn, self.metric.id)? {
            self.metric = m;
        }
        self.series = metrics::daily_series(&db.conn, &self.metric, 365)?;
        self.recent = metrics::measurements(&db.conn, self.metric.id, 200)?;
        self.sel.clamp(self.recent.len());
        Ok(())
    }
}

pub fn handle_metric(app: &mut App, mut v: MetricView, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::MetricView(v) };
    match k.code {
        KeyCode::Esc => match GoalDetail::open(db, v.goal_id) {
            Ok(mut d) => {
                d.tab = Tab::Metrics;
                if let Some(i) = d.metrics.iter().position(|m| m.id == v.metric.id) {
                    d.sel.index = i;
                }
                Screen::GoalDetail(d)
            }
            Err(e) => {
                app.error(e.to_string());
                Screen::MetricView(v)
            }
        },
        KeyCode::Char('m') => {
            let mid = v.metric.id;
            let hint = value_hint(&v.metric);
            app.prompt(format!("{}: {hint}", text::METRIC_VALUE_PROMPT), "", ga(GoalAction::MetricValue(mid, dates::today())));
            Screen::MetricView(v)
        }
        KeyCode::Char('M') => {
            let mid = v.metric.id;
            app.prompt(text::METRIC_DAY_PROMPT, "", ga(GoalAction::MetricDay(mid)));
            Screen::MetricView(v)
        }
        KeyCode::Char('D') if !v.recent.is_empty() => {
            let id = v.recent[v.sel.index].id;
            app.confirm(text::METRIC_DELETE_MEASUREMENT, true, ga(GoalAction::MeasurementDelete(id)));
            Screen::MetricView(v)
        }
        KeyCode::Char('?') => {
            let mut h = vec![("m", "registrar un valor de hoy"), ("M", "registrar un valor de otro día"), ("↑ ↓", "recorrer registros"), ("D", "borrar el registro seleccionado"), ("", "")];
            h.extend(super::global_help());
            app.help(&v.metric.name.clone(), h);
            Screen::MetricView(v)
        }
        _ => {
            v.sel.handle_key(k, v.recent.len(), 8);
            Screen::MetricView(v)
        }
    }
}

pub fn render_metric(v: &mut MetricView, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let m = &v.metric;
    let keys = [("m", "registrar"), ("M", "otro día"), ("D", "borrar registro"), ("Esc", text::BACK), ("?", text::HELP)];
    let right = format!("{} {}", m.count, text::METRIC_RECORDS);
    let body = widgets::chrome(frame, area, theme, g, &format!("{}{}{}", text::GOAL_TAB_METRICS, g.dot_sep, m.name), &right, &keys).body;
    let mut y = body.y;
    if v.series.is_empty() && v.recent.is_empty() {
        widgets::empty_state(frame, body, theme, &[text::METRIC_NO_DATA]);
        return;
    }
    // Cabecera descriptiva: dirección y referencia.
    let mut head = vec![m.kind.label().split(' ').next().unwrap_or("").to_string(), m.direction.label().to_string()];
    match (m.direction, m.target_low, m.target_high) {
        (Direction::Range, Some(a), Some(b)) => head.push(format!("{}–{}", metrics::format_value(m.kind, Some(a), None, &m.unit), metrics::format_value(m.kind, Some(b), None, &m.unit))),
        (Direction::Up | Direction::Down | Direction::Maintain, Some(a), _) => head.push(format!("referencia {}", metrics::format_value(m.kind, Some(a), None, &m.unit))),
        _ => {}
    }
    head.push(m.frequency.label().into());
    put_wrapped(frame, body, &mut y, head.join(g.dot_sep), theme.dim);
    y += 1;

    if m.kind.is_numeric() && !v.series.is_empty() {
        let values: Vec<f64> = v.series.iter().map(|(_, x)| *x).collect();
        let weekly = m.frequency == Frequency::Weekly;
        let width = (body.width as usize).saturating_sub(2).min(60);
        match trend::enough_for_trend(&v.series, m.kind, weekly) {
            Ok(()) => {
                // Gráfico de líneas de la tendencia (media 7 días) y puntos crudos como sparkline.
                let smooth: Vec<f64> = match m.kind {
                    MetricKind::Number | MetricKind::Scale => trend::moving_average(&v.series, 7).into_iter().map(|(_, x)| x).collect(),
                    _ => values.clone(),
                };
                let chart = spark::line_chart(&smooth, width, 6, g);
                let (min, max) = (smooth.iter().cloned().fold(f64::INFINITY, f64::min), smooth.iter().cloned().fold(f64::NEG_INFINITY, f64::max));
                for (i, row) in chart.iter().enumerate() {
                    let label = if i == 0 {
                        metrics::format_value(m.kind, Some(max), None, "")
                    } else if i == chart.len() - 1 {
                        metrics::format_value(m.kind, Some(min), None, "")
                    } else {
                        String::new()
                    };
                    let line = Line::from(vec![Span::styled(format!("{label:>7} "), theme.dim), Span::styled(row.clone(), theme.accent)]);
                    frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
                    y += 1;
                }
                let first = v.series.iter().rev().take(width).last().map(|(d, _)| dates::fmt_date_compact(*d, today)).unwrap_or_default();
                let last = v.series.last().map(|(d, _)| dates::fmt_date_compact(*d, today)).unwrap_or_default();
                let pad = width.saturating_sub(first.width() + last.width());
                frame.render_widget(Paragraph::new(Span::styled(format!("{:>8}{first}{}{last}", "", " ".repeat(pad)), theme.dim)), Rect { x: body.x, y, width: body.width, height: 1 });
                y += 1;
                if matches!(m.kind, MetricKind::Number | MetricKind::Scale) {
                    let raw = spark::sparkline(&values, width, g);
                    frame.render_widget(Paragraph::new(Line::from(vec![Span::styled(format!("{:>7} ", "crudo"), theme.dim), Span::styled(raw, theme.dim)])), Rect { x: body.x, y, width: body.width, height: 1 });
                    y += 1;
                }
                y += 1;
                // Texto: nivel actual, comparación semanal, regularidad.
                let sum = matches!(m.kind, MetricKind::Count | MetricKind::Duration);
                let (this, last_w) = trend::week_over_week(&v.series, today, sum);
                let mut lines = vec![];
                if let Some(cur) = trend::current_level(&v.series, m.kind) {
                    let lbl = if matches!(m.kind, MetricKind::Number | MetricKind::Scale) { text::METRIC_TREND_7 } else { text::METRIC_LAST };
                    lines.push(format!("{lbl}: {}", metrics::format_value(m.kind, Some(cur), None, &m.unit)));
                }
                if m.kind == MetricKind::Time {
                    if let Some(r) = trend::time_regularity_minutes(&values.iter().rev().take(14).cloned().collect::<Vec<_>>()) {
                        lines.push(format!("{}: ±{} min (últimos 14 registros)", text::METRIC_REGULARITY, r as i64));
                    }
                } else if let Some(c) = trend::describe_change(this, last_w, &m.unit, if m.kind == MetricKind::Number { 1 } else { 0 }) {
                    lines.push(c);
                }
                if m.sensitive {
                    lines.push(text::METRIC_WEIGHT_NOTE.into());
                }
                for l in lines {
                    put_wrapped(frame, body, &mut y, l, theme.text);
                }
            }
            Err(msg) => {
                let raw = spark::sparkline(&values, width, g);
                frame.render_widget(Paragraph::new(Span::styled(raw, theme.dim)), Rect { x: body.x, y, width: body.width, height: 1 });
                y += 2;
                put_wrapped(frame, body, &mut y, msg, theme.dim);
            }
        }
        y += 1;
    }
    // Registros recientes
    if y + 1 < body.y + body.height {
        frame.render_widget(Paragraph::new(Span::styled("Registros", theme.title)), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
        let list = Rect { x: body.x, y, width: body.width, height: body.y + body.height - y };
        v.sel.clamp(v.recent.len());
        let range = v.sel.visible(v.recent.len(), list.height as usize);
        for i in range {
            let r = &v.recent[i];
            let selected = i == v.sel.index;
            let marker = if selected { g.cursor } else { " " };
            let day = dates::parse_iso_date(&r.day).map(|d| dates::fmt_date_short(d)).unwrap_or_else(|| r.day.clone());
            let val = metrics::format_value(m.kind, r.value, r.text_value.as_deref(), &m.unit);
            let line = Line::from(vec![
                Span::styled(format!("{marker} "), theme.accent),
                Span::styled(format!("{day:<16}"), theme.dim),
                Span::styled(format!("{val:<14}"), if selected { theme.selected } else { theme.text }),
                Span::styled(g.truncate(&r.note, (list.width as usize).saturating_sub(34)), theme.dim),
            ]);
            frame.render_widget(Paragraph::new(line), Rect { x: list.x, y, width: list.width, height: 1 });
            y += 1;
        }
    }
}
