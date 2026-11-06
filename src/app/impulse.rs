//! Episodio de impulso: máquina de estados P1–P5 (+ desliz), preparación P0 y
//! revisión del patrón P6 (docs/research/interventions.md §c). Todo paso es
//! opcional; Esc guarda lo que haya y sale.

use std::time::{Duration, Instant};

use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::{Paragraph, Wrap},
    Frame,
};

use super::{App, Ctx, Deferred, Screen};
use crate::dates;
use crate::domain::goals::{self, Goal, RedFlag};
use crate::domain::impulses::{self as imp, ImpulseConfig, Pathway};
use crate::domain::plans;
use crate::interventions::Catalog;
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::widgets;

#[derive(Debug, Clone)]
pub enum ImpulseAction {
    Body,
    Future,
    Reframe,
    Reflection,
    LapseStep,
    LapsePlanSituation(String),
    LapseHarm,
    // Preparación (P0)
    PrepEnv(Option<i64>),
    PrepFuture(Option<i64>),
    PrepDistractions(Option<i64>),
    PrepCompeting(Option<i64>),
    PrepWait(Option<i64>),
    PrepSerious(Option<i64>),
    PrepPickGoal(Vec<Option<i64>>),
}

fn ia(a: ImpulseAction) -> Deferred {
    Deferred::Impulse(a)
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Step {
    PickGoal,
    Stop,
    Trigger,
    Context,
    Pathway,
    Wait,
    IntensityAfter,
    Outcome,
    Lapse,
    Done,
}

pub struct Impulse {
    pub step: Step,
    pub goals: Vec<Goal>,
    pub sel: usize,
    pub goal: Option<Goal>,
    pub cfg: ImpulseConfig,
    pub episode: Option<i64>,
    pub intensity_before: Option<i64>,
    pub intensity_after: Option<i64>,
    pub trigger: Option<usize>,
    pub context: Vec<bool>,
    pub pathway: Option<Pathway>,
    pub substep: usize,
    pub wait_started: Option<Instant>,
    pub notes: Vec<String>,
    pub outcome: Option<&'static str>,
    pub lapse_sel: Vec<bool>,
    pub lapse_stage: usize,
    pub forgave: bool,
    pub catalog: Catalog,
    pub distress: bool,
}

impl Impulse {
    pub fn open(db: &Db) -> Result<Self> {
        let goals = goals::list(&db.conn, false)?.into_iter().filter(|g| g.status == goals::GoalStatus::Active).collect::<Vec<_>>();
        let mut s = Self {
            step: if goals.is_empty() { Step::Stop } else { Step::PickGoal },
            goals,
            sel: 0,
            goal: None,
            cfg: imp::load_config(&db.conn, None)?,
            episode: None,
            intensity_before: None,
            intensity_after: None,
            trigger: None,
            context: vec![false; text::IMPULSE_CONTEXTS.len()],
            pathway: None,
            substep: 0,
            wait_started: None,
            notes: vec![],
            outcome: None,
            lapse_sel: vec![false; text::LAPSE_BEFORE_OPTS.len()],
            lapse_stage: 0,
            forgave: false,
            catalog: Catalog::builtin(),
            distress: false,
        };
        if s.step == Step::Stop {
            s.episode = Some(imp::start(&db.conn, None)?);
        }
        Ok(s)
    }

    /// Plazo para redibujar el tiempo transcurrido (sólo durante la espera).
    pub fn next_deadline(&self) -> Option<Instant> {
        match (self.step, self.wait_started) {
            (Step::Wait, Some(t)) => {
                let elapsed = t.elapsed().as_secs();
                let target = self.cfg.wait_seconds.max(0) as u64;
                let next = if elapsed < target { (target - elapsed).min(30) } else { 30 };
                Some(Instant::now() + Duration::from_secs(next.max(1)))
            }
            _ => None,
        }
    }

    fn waited(&self) -> Option<i64> {
        self.wait_started.map(|t| t.elapsed().as_secs() as i64)
    }

    /// Guarda lo que haya y cierra el episodio.
    fn save_and_close(&self, db: &Db) {
        if let Some(id) = self.episode {
            let c = &db.conn;
            let _ = imp::set_before(c, id, self.intensity_before, self.trigger.map(|i| text::IMPULSE_TRIGGERS[i]).unwrap_or(""));
            let ctx: Vec<&str> = self.context.iter().zip(text::IMPULSE_CONTEXTS).filter(|(on, _)| **on).map(|(_, c)| *c).collect();
            let _ = imp::set_context(c, id, &ctx.join(", "));
            let _ = imp::set_after(c, id, self.waited(), self.intensity_after);
            let _ = imp::finish(c, id, self.outcome, &self.notes.join("\n"));
        }
    }
}

fn digit(k: KeyEvent) -> Option<i64> {
    match k.code {
        KeyCode::Char(c @ '0'..='9') => Some((c as u8 - b'0') as i64),
        KeyCode::Char('+') => Some(10),
        _ => None,
    }
}

pub fn handle(app: &mut App, mut s: Impulse, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Impulse(s) };
    if k.code == KeyCode::Esc {
        s.save_and_close(db);
        app.go_home();
        return Screen::Impulse(s);
    }
    if k.code == KeyCode::Char('?') {
        let card = s.catalog.get(match s.step {
            Step::Stop | Step::Trigger => "pausa_stop",
            Step::Wait => s.pathway.map(|p| p.key()).unwrap_or("espera_activa"),
            Step::Lapse => "pantalla_desliz",
            _ => "espera_activa",
        });
        if let Some(t) = card {
            app.info(&t.nombre.clone(), t.card());
        }
        return Screen::Impulse(s);
    }
    match s.step {
        Step::PickGoal => match k.code {
            KeyCode::Up | KeyCode::Char('k') => s.sel = s.sel.saturating_sub(1),
            KeyCode::Down | KeyCode::Char('j') => s.sel = (s.sel + 1).min(s.goals.len()),
            KeyCode::Char(c @ '1'..='9') if ((c as u8 - b'1') as usize) <= s.goals.len() => {
                s.sel = (c as u8 - b'1') as usize;
                return start_episode(app, s);
            }
            KeyCode::Enter => return start_episode(app, s),
            _ => {}
        },
        Step::Stop => {
            if let Some(d) = digit(k) {
                s.intensity_before = Some(d);
                s.step = Step::Trigger;
            } else if k.code == KeyCode::Enter {
                s.step = Step::Trigger;
            }
        }
        Step::Trigger => match k.code {
            KeyCode::Char(c @ 'a'..='g') if ((c as u8 - b'a') as usize) < text::IMPULSE_TRIGGERS.len() => {
                s.trigger = Some((c as u8 - b'a') as usize);
                s.step = Step::Context;
            }
            KeyCode::Enter => s.step = Step::Context,
            _ => {}
        },
        Step::Context => match k.code {
            KeyCode::Char(c @ '1'..='6') => {
                let i = (c as u8 - b'1') as usize;
                if i < s.context.len() {
                    s.context[i] = !s.context[i];
                }
            }
            KeyCode::Enter => {
                s.step = Step::Pathway;
                s.sel = s.cfg.last_pathway.and_then(|p| Pathway::ALL.iter().position(|x| *x == p)).unwrap_or(0);
            }
            _ => {}
        },
        Step::Pathway => match k.code {
            KeyCode::Up | KeyCode::Char('k') => s.sel = s.sel.saturating_sub(1),
            KeyCode::Down | KeyCode::Char('j') => s.sel = (s.sel + 1).min(Pathway::ALL.len() - 1),
            KeyCode::Char(c @ '1'..='5') => {
                s.sel = (c as u8 - b'1') as usize;
                choose_pathway(app, &mut s);
            }
            KeyCode::Enter => choose_pathway(app, &mut s),
            _ => {}
        },
        Step::Wait => match k.code {
            KeyCode::Char('t') => s.step = Step::IntensityAfter,
            KeyCode::Char('o') => {
                // Elegir otra vía.
                s.step = Step::Pathway;
                s.substep = 0;
            }
            KeyCode::Char('a') => {
                s.distress = true;
            }
            KeyCode::Enter => {
                let steps = pathway_steps(&s);
                if s.substep + 1 < steps.len() {
                    s.substep += 1;
                    // Pasos que abren una pregunta opcional.
                    match (s.pathway, s.substep) {
                        (Some(Pathway::Surf), 1) => app.prompt(text::IMPULSE_BODY_PROMPT, "", ia(ImpulseAction::Body)),
                        (Some(Pathway::LongTerm), 1) => app.prompt(text::IMPULSE_FUTURE_PROMPT, "", ia(ImpulseAction::Future)),
                        (Some(Pathway::LongTerm), 2) => app.prompt(text::IMPULSE_REFRAME_PROMPT, "", ia(ImpulseAction::Reframe)),
                        _ => {}
                    }
                } else {
                    s.step = Step::IntensityAfter;
                }
            }
            _ => {}
        },
        Step::IntensityAfter => {
            if let Some(d) = digit(k) {
                s.intensity_after = Some(d);
                s.step = Step::Outcome;
            } else if k.code == KeyCode::Enter {
                s.step = Step::Outcome;
            }
        }
        Step::Outcome => match k.code {
            KeyCode::Char(c @ '1'..='5') => {
                let i = (c as u8 - b'1') as usize;
                s.outcome = Some(imp::OUTCOMES[i].0);
                app.prompt(text::IMPULSE_REFLECTION, "", ia(ImpulseAction::Reflection));
            }
            KeyCode::Enter => {
                app.prompt(text::IMPULSE_REFLECTION, "", ia(ImpulseAction::Reflection));
            }
            _ => {}
        },
        Step::Lapse => match (s.lapse_stage, k.code) {
            (0, KeyCode::Char(c @ '1'..='6')) => {
                let i = (c as u8 - b'1') as usize;
                if i < s.lapse_sel.len() {
                    s.lapse_sel[i] = !s.lapse_sel[i];
                }
            }
            (0, KeyCode::Enter) => {
                let seen: Vec<&str> = s.lapse_sel.iter().zip(text::LAPSE_BEFORE_OPTS).filter(|(on, _)| **on).map(|(_, o)| *o).collect();
                if !seen.is_empty() {
                    s.notes.push(format!("Antes: {}", seen.join(", ")));
                }
                s.lapse_stage = 1;
                app.prompt(text::LAPSE_NEXT_STEP, "", ia(ImpulseAction::LapseStep));
            }
            (2, KeyCode::Char('f')) if !s.forgave => {
                s.forgave = true;
                s.notes.push(text::LAPSE_FORGIVE.into());
            }
            (2, KeyCode::Enter) => {
                s.save_and_close(db);
                s.step = Step::Done;
            }
            _ => {}
        },
        Step::Done => {
            if k.code == KeyCode::Enter {
                app.go_home();
            }
        }
    }
    Screen::Impulse(s)
}

fn start_episode(app: &mut App, mut s: Impulse) -> Screen {
    let Some(db) = &app.db else { return Screen::Impulse(s) };
    let goal = if s.sel < s.goals.len() { Some(s.goals[s.sel].clone()) } else { None };
    let gid = goal.as_ref().map(|g| g.id);
    s.cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
    if s.cfg.wait_seconds == 0 {
        s.cfg.wait_seconds = imp::DEFAULT_WAIT;
    }
    s.goal = goal;
    match imp::start(&db.conn, gid) {
        Ok(id) => s.episode = Some(id),
        Err(e) => app.error(e.to_string()),
    }
    s.step = Step::Stop;
    Screen::Impulse(s)
}

fn choose_pathway(app: &mut App, s: &mut Impulse) {
    let Some(db) = &app.db else { return };
    let p = Pathway::ALL[s.sel.min(Pathway::ALL.len() - 1)];
    s.pathway = Some(p);
    s.substep = 0;
    s.wait_started.get_or_insert_with(Instant::now);
    if let Some(id) = s.episode {
        if let Err(e) = imp::set_pathway(&db.conn, id, s.goal.as_ref().map(|g| g.id), p) {
            app.error(e.to_string());
        }
    }
    s.step = Step::Wait;
}

fn pathway_steps(s: &Impulse) -> Vec<String> {
    match s.pathway {
        Some(Pathway::Surf) => s.catalog.steps("surfear_impulso"),
        Some(Pathway::Breathe) => s.catalog.steps("respiracion_lenta"),
        Some(Pathway::Distract) => {
            let mut v = vec![text::IMPULSE_DISTRACTIONS.to_string()];
            if s.cfg.distractions.is_empty() {
                v.push(text::IMPULSE_NONE_CONFIGURED.into());
            } else {
                v.extend(s.cfg.distractions.iter().map(|d| format!("· {d}")));
            }
            vec![v.join("\n")]
        }
        Some(Pathway::LongTerm) => {
            let mut first = vec![];
            if let Some(g) = &s.goal {
                if !g.why.is_empty() {
                    first.push(format!("{}: {}", text::IMPULSE_WHY, g.why));
                }
            }
            if !s.cfg.future_image.is_empty() {
                first.push(format!("{}: {}", text::IMPULSE_FUTURE_IMAGE, s.cfg.future_image));
            }
            if first.is_empty() {
                first.push(text::IMPULSE_NONE_CONFIGURED.into());
            }
            let mut v = vec![first.join("\n")];
            v.extend(s.catalog.steps("espera_activa"));
            v
        }
        Some(Pathway::Competing) => vec![if s.cfg.competing_response.is_empty() { text::IMPULSE_NONE_CONFIGURED.to_string() } else { s.cfg.competing_response.clone() }],
        None => vec![],
    }
}

pub fn run_deferred(app: &mut App, screen: Screen, a: ImpulseAction, value: Option<String>) -> Screen {
    let v = value.unwrap_or_default().trim().to_string();
    let Some(db) = app.db.as_ref() else { return screen };
    match (a, screen) {
        (ImpulseAction::Body, Screen::Impulse(mut s)) | (ImpulseAction::Future, Screen::Impulse(mut s)) | (ImpulseAction::Reframe, Screen::Impulse(mut s)) => {
            if !v.is_empty() {
                s.notes.push(v);
            }
            Screen::Impulse(s)
        }
        (ImpulseAction::Reflection, Screen::Impulse(mut s)) => {
            if !v.is_empty() {
                s.notes.push(v);
            }
            if s.outcome == Some("acted") {
                s.step = Step::Lapse;
                s.lapse_stage = 0;
            } else {
                s.save_and_close(db);
                s.step = Step::Done;
            }
            Screen::Impulse(s)
        }
        (ImpulseAction::LapseStep, Screen::Impulse(mut s)) => {
            if v.is_empty() {
                s.lapse_stage = 2;
                app.choice(text::LAPSE_HARM, vec!["No".into(), "Sí".into()], 0, ia(ImpulseAction::LapseHarm));
            } else {
                s.notes.push(format!("Próxima vez: {v}"));
                app.prompt(text::LAPSE_SAVE_AS_PLAN, "", ia(ImpulseAction::LapsePlanSituation(v)));
            }
            Screen::Impulse(s)
        }
        (ImpulseAction::LapsePlanSituation(step), Screen::Impulse(mut s)) => {
            if !v.is_empty() {
                if let Err(e) = plans::create(&db.conn, s.goal.as_ref().map(|g| g.id), None, &v, &step, true) {
                    app.error(e.to_string());
                }
            }
            s.lapse_stage = 2;
            app.choice(text::LAPSE_HARM, vec!["No".into(), "Sí".into()], 0, ia(ImpulseAction::LapseHarm));
            Screen::Impulse(s)
        }
        (ImpulseAction::LapseHarm, Screen::Impulse(mut s)) => {
            if v == "1" && !db.setting_bool("harm_warning_shown", false) {
                let _ = db.set_setting("harm_warning_shown", "1");
                app.info(text::DERIVATION_TITLE, vec![text::DERIVATION_BASE.into(), String::new(), text::DERIVATION_SUICIDAL.into()]);
            }
            s.lapse_stage = 2;
            Screen::Impulse(s)
        }
        // ---- preparación P0: cadena de preguntas; la pantalla no cambia.
        (ImpulseAction::PrepPickGoal(ids), screen) => {
            let gid = v.parse::<usize>().ok().and_then(|i| ids.get(i).copied()).flatten();
            app.prompt(text::PREP_ENV, "", ia(ImpulseAction::PrepEnv(gid)));
            screen
        }
        (ImpulseAction::PrepEnv(gid), screen) => {
            let mut cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
            cfg.goal_id = gid;
            cfg.env_changes = split_lines(&v);
            let _ = imp::save_config(&db.conn, &cfg);
            app.prompt(text::PREP_FUTURE, &cfg.future_image, ia(ImpulseAction::PrepFuture(gid)));
            screen
        }
        (ImpulseAction::PrepFuture(gid), screen) => {
            let mut cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
            cfg.goal_id = gid;
            cfg.future_image = v;
            let _ = imp::save_config(&db.conn, &cfg);
            app.prompt(text::PREP_DISTRACTIONS, &cfg.distractions.join("; "), ia(ImpulseAction::PrepDistractions(gid)));
            screen
        }
        (ImpulseAction::PrepDistractions(gid), screen) => {
            let mut cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
            cfg.goal_id = gid;
            cfg.distractions = split_lines(&v);
            let _ = imp::save_config(&db.conn, &cfg);
            app.prompt(text::PREP_COMPETING, &cfg.competing_response, ia(ImpulseAction::PrepCompeting(gid)));
            screen
        }
        (ImpulseAction::PrepCompeting(gid), screen) => {
            let mut cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
            cfg.goal_id = gid;
            cfg.competing_response = v;
            let _ = imp::save_config(&db.conn, &cfg);
            app.prompt(text::PREP_WAIT, &(cfg.wait_seconds / 60).to_string(), ia(ImpulseAction::PrepWait(gid)));
            screen
        }
        (ImpulseAction::PrepWait(gid), screen) => {
            let mut cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
            cfg.goal_id = gid;
            if let Ok(m) = v.parse::<i64>() {
                cfg.wait_seconds = (m * 60).clamp(300, 1200);
            }
            let _ = imp::save_config(&db.conn, &cfg);
            app.choice(text::PREP_SERIOUS, text::PREP_SERIOUS_OPTS.iter().map(|s| s.to_string()).collect(), 0, ia(ImpulseAction::PrepSerious(gid)));
            screen
        }
        (ImpulseAction::PrepSerious(gid), screen) => {
            let mut cfg = imp::load_config(&db.conn, gid).unwrap_or_default();
            cfg.goal_id = gid;
            cfg.serious = match v.as_str() {
                "0" => Some(false),
                "1" => Some(true),
                _ => None,
            };
            let _ = imp::save_config(&db.conn, &cfg);
            if cfg.serious == Some(true) && !db.setting_bool("serious_warning_shown", false) {
                let _ = db.set_setting("serious_warning_shown", "1");
                let mut lines = vec![text::DERIVATION_BASE.to_string()];
                if let Some(flag) = gid.and_then(|g| goals::get(&db.conn, g).ok().flatten()).and_then(|g| goals::category(&g.category).red_flag) {
                    lines.push(String::new());
                    lines.push(
                        match flag {
                            RedFlag::Substance => text::DERIVATION_SUBSTANCE,
                            RedFlag::Eating => text::DERIVATION_EATING,
                            RedFlag::SelfHarm | RedFlag::Suicidal => text::DERIVATION_SUICIDAL,
                            RedFlag::Gambling => "",
                        }
                        .to_string(),
                    );
                }
                app.info(text::DERIVATION_TITLE, lines);
            } else {
                app.notify(text::SAVED);
            }
            screen
        }
        (_, screen) => screen,
    }
}

fn split_lines(v: &str) -> Vec<String> {
    v.split([';', '\n']).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
}

/// Inicia la preparación (P0): elegir objetivo (o general) y encadenar preguntas.
pub fn start_prep(app: &mut App) {
    let Some(db) = &app.db else { return };
    let gs = goals::list(&db.conn, false).unwrap_or_default();
    let mut names: Vec<String> = gs.iter().map(|g| g.name.clone()).collect();
    let mut ids: Vec<Option<i64>> = gs.iter().map(|g| Some(g.id)).collect();
    names.push("General (sin objetivo concreto)".into());
    ids.push(None);
    app.choice(text::IMPULSE_PICK_GOAL, names, ids.len() - 1, ia(ImpulseAction::PrepPickGoal(ids)));
}

// ---- dibujo -------------------------------------------------------------------

fn put(frame: &mut Frame, area: Rect, y: &mut u16, s: impl Into<String>, style: ratatui::style::Style) {
    let s: String = s.into();
    if *y >= area.y + area.height {
        return;
    }
    let h = widgets::line_count(&s, area.width).min(area.y + area.height - *y);
    frame.render_widget(Paragraph::new(Span::styled(s, style)).wrap(Wrap { trim: false }), Rect { x: area.x, y: *y, width: area.width, height: h });
    *y += h;
}

pub fn render(s: &mut Impulse, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let right = s.goal.as_ref().map(|g| g.name.clone()).unwrap_or_default();
    let keys: Vec<(&str, &str)> = match s.step {
        Step::Wait => vec![("Intro", "siguiente"), ("t", "terminar"), ("o", "otra vía"), ("Esc", "guardar y salir"), ("?", "sobre esta técnica")],
        Step::Done => vec![("Intro", "volver")],
        _ => vec![("Intro", "continuar / omitir"), ("Esc", "guardar y salir"), ("?", "sobre esta técnica")],
    };
    let body = widgets::chrome(frame, area, theme, g, text::IMPULSE, &g.truncate(&right, 40), &keys).body;
    let w = body.width.min(72);
    let inner = Rect { x: body.x + (body.width - w) / 2, y: body.y + 1, width: w, height: body.height.saturating_sub(1) };
    let mut y = inner.y;
    match s.step {
        Step::PickGoal => {
            put(frame, inner, &mut y, text::IMPULSE_PICK_GOAL, theme.emphasis);
            y += 1;
            for (i, goal) in s.goals.iter().enumerate() {
                let marker = if i == s.sel { g.cursor } else { " " };
                put(frame, inner, &mut y, format!("{marker} {}  {}", i + 1, goal.name), if i == s.sel { theme.selected } else { theme.text });
            }
            let i = s.goals.len();
            let marker = if i == s.sel { g.cursor } else { " " };
            put(frame, inner, &mut y, format!("{marker} {}  {}", i + 1, text::IMPULSE_NO_GOAL), if i == s.sel { theme.selected } else { theme.text });
        }
        Step::Stop => {
            for (i, line) in s.catalog.steps("pausa_stop").iter().enumerate() {
                put(frame, inner, &mut y, line.clone(), if i == 0 { theme.title } else { theme.emphasis });
                y += 1;
            }
            put(frame, inner, &mut y, format!("{} — pulsa un número (0–9, + para 10) o Intro para omitir", text::IMPULSE_INTENSITY), theme.dim);
        }
        Step::Trigger => {
            put(frame, inner, &mut y, text::IMPULSE_TRIGGER, theme.emphasis);
            y += 1;
            for (i, t) in text::IMPULSE_TRIGGERS.iter().enumerate() {
                put(frame, inner, &mut y, format!("  {}  {t}", (b'a' + i as u8) as char), theme.text);
            }
            y += 1;
            put(frame, inner, &mut y, "Intro para omitir.", theme.dim);
        }
        Step::Context => {
            put(frame, inner, &mut y, text::IMPULSE_CONTEXT, theme.emphasis);
            y += 1;
            for (i, c) in text::IMPULSE_CONTEXTS.iter().enumerate() {
                let mark = if s.context[i] { g.done } else { g.todo };
                put(frame, inner, &mut y, format!("  {}  {mark} {c}", i + 1), theme.text);
            }
            y += 1;
            put(frame, inner, &mut y, text::IMPULSE_CONTEXT_HELP, theme.dim);
            put(frame, inner, &mut y, "Intro para continuar.", theme.dim);
        }
        Step::Pathway => {
            put(frame, inner, &mut y, text::IMPULSE_PATHWAY, theme.emphasis);
            y += 1;
            let labels = [
                text::IMPULSE_PATHWAY_SURF.to_string(),
                text::IMPULSE_PATHWAY_BREATHE.to_string(),
                format!("{}: {}", text::IMPULSE_PATHWAY_DISTRACT, if s.cfg.distractions.is_empty() { "(sin preparar)".to_string() } else { s.cfg.distractions.join(" · ") }),
                text::IMPULSE_PATHWAY_LONGTERM.to_string(),
                format!("{}{}", text::IMPULSE_PATHWAY_COMPETING, if s.cfg.competing_response.is_empty() { "" } else { ": " }) + &s.cfg.competing_response,
            ];
            for (i, l) in labels.iter().enumerate() {
                let marker = if i == s.sel { g.cursor } else { " " };
                put(frame, inner, &mut y, format!("{marker} {}  {l}", i + 1), if i == s.sel { theme.selected } else { theme.text });
            }
        }
        Step::Wait => {
            let steps = pathway_steps(s);
            let name = s.pathway.map(|p| s.catalog.get(p.key()).map(|t| t.nombre.clone()).unwrap_or_default()).unwrap_or_default();
            put(frame, inner, &mut y, format!("{}{}{}", text::IMPULSE_WAIT_TITLE, g.dot_sep, name), theme.title);
            y += 1;
            if let Some(step) = steps.get(s.substep) {
                put(frame, inner, &mut y, step.clone(), theme.emphasis);
            }
            y += 1;
            if s.distress {
                put(frame, inner, &mut y, text::IMPULSE_DISTRESS, theme.accent);
                y += 1;
            }
            let elapsed_min = s.wait_started.map(|t| t.elapsed().as_secs() / 60).unwrap_or(0);
            let txt = if elapsed_min == 0 { text::IMPULSE_WAIT_JUST_STARTED.to_string() } else { text::IMPULSE_WAIT_ELAPSED.replace("{m}", &elapsed_min.to_string()) };
            put(frame, inner, &mut y, txt, theme.dim);
            if s.wait_started.map(|t| t.elapsed().as_secs() as i64 >= s.cfg.wait_seconds).unwrap_or(false) {
                put(frame, inner, &mut y, text::IMPULSE_WAIT_DONE, theme.dim);
            }
            y += 1;
            put(frame, inner, &mut y, format!("Paso {} de {}{}a: esto me angustia", s.substep + 1, steps.len().max(1), g.dot_sep), theme.dim);
        }
        Step::IntensityAfter => {
            put(frame, inner, &mut y, format!("{} — pulsa un número (0–9, + para 10) o Intro para omitir", text::IMPULSE_INTENSITY), theme.emphasis);
        }
        Step::Outcome => {
            put(frame, inner, &mut y, text::IMPULSE_OUTCOME, theme.emphasis);
            y += 1;
            for (i, (_, l)) in imp::OUTCOMES.iter().enumerate() {
                put(frame, inner, &mut y, format!("  {}  {l}", i + 1), theme.text);
            }
            y += 1;
            put(frame, inner, &mut y, "Intro para no decirlo.", theme.dim);
        }
        Step::Lapse => {
            put(frame, inner, &mut y, text::LAPSE_TITLE, theme.title);
            put(frame, inner, &mut y, text::LAPSE_LINE1, theme.emphasis);
            y += 1;
            if s.lapse_stage == 0 {
                put(frame, inner, &mut y, text::LAPSE_BEFORE, theme.text);
                for (i, o) in text::LAPSE_BEFORE_OPTS.iter().enumerate() {
                    let mark = if s.lapse_sel[i] { g.done } else { g.todo };
                    put(frame, inner, &mut y, format!("  {}  {mark} {o}", i + 1), theme.text);
                }
                y += 1;
                put(frame, inner, &mut y, "Intro para continuar.", theme.dim);
            } else {
                for n in &s.notes {
                    put(frame, inner, &mut y, format!("{} {n}", g.check), theme.dim);
                }
                y += 1;
                if !s.forgave {
                    put(frame, inner, &mut y, format!("f  {}  (opcional, una sola vez)", text::LAPSE_FORGIVE), theme.text);
                }
                put(frame, inner, &mut y, "Intro para terminar.", theme.dim);
            }
        }
        Step::Done => {
            put(frame, inner, &mut y, text::IMPULSE_SAVED, theme.emphasis);
            y += 1;
            if let (Some(b), Some(a)) = (s.intensity_before, s.intensity_after) {
                put(frame, inner, &mut y, format!("Intensidad: {b} → {a}. {}", text::PATTERN_INTENSITY_NOTE), theme.dim);
            }
            if let Some(w) = s.waited() {
                put(frame, inner, &mut y, format!("Tiempo: {} min {} s.", w / 60, w % 60), theme.dim);
            }
        }
    }
    let _ = dates::today();
}

// ---- patrón (P6) -----------------------------------------------------------------

pub struct PatternView {
    pub pattern: imp::Pattern,
    pub cfg: ImpulseConfig,
    /// El mensaje de derivación por tendencia creciente se muestra una vez cada 4 semanas.
    pub show_derivation: bool,
}

impl PatternView {
    pub fn open(db: &Db) -> Result<Self> {
        let pattern = imp::pattern(&db.conn, None, dates::now_ts())?;
        let mut show_derivation = false;
        if pattern.rising_four_weeks() {
            let last = db.setting_i64("rising_warning_at", 0);
            if dates::now_ts() - last > 28 * 86_400 {
                show_derivation = true;
                let _ = db.set_setting("rising_warning_at", &dates::now_ts().to_string());
            }
        }
        Ok(Self { pattern, cfg: imp::load_config(&db.conn, None)?, show_derivation })
    }
}

pub fn handle_pattern(app: &mut App, s: PatternView, k: KeyEvent) -> Screen {
    if k.code == KeyCode::Esc || k.code == KeyCode::Enter {
        return match app.db.as_ref().and_then(|db| super::review::ReviewMenu::open(db).ok()) {
            Some(m) => Screen::Review(m),
            None => {
                app.go_home();
                Screen::Blank
            }
        };
    }
    Screen::Pattern(s)
}

pub fn render_pattern(s: &PatternView, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let body = widgets::chrome(frame, area, theme, g, text::PATTERN_TITLE, "últimos 30 días", &[("Esc", text::BACK)]).body;
    let mut y = body.y;
    let p = &s.pattern;
    if p.total_30 == 0 {
        widgets::empty_state(frame, body, theme, &[text::PATTERN_EMPTY]);
        return;
    }
    put(frame, body, &mut y, format!("Episodios: {} en 7 días, {} en 30.", p.total_7, p.total_30), theme.text);
    if p.known_30 > 0 {
        put(frame, body, &mut y, text::PATTERN_NOT_ACTED.replace("{x}", &p.not_acted_30.to_string()).replace("{y}", &p.known_30.to_string()), theme.text);
    }
    if let (Some(b), Some(a)) = (p.mean_before, p.mean_after) {
        put(frame, body, &mut y, format!("Intensidad media antes {}, después {}. {}", format!("{b:.1}").replace('.', ","), format!("{a:.1}").replace('.', ","), text::PATTERN_INTENSITY_NOTE), theme.dim);
    }
    y += 1;
    let slots: Vec<String> = text::PATTERN_SLOTS.iter().zip(p.by_slot).map(|(n, c)| format!("{n} {c}")).collect();
    put(frame, body, &mut y, format!("Por franja: {}", slots.join(g.dot_sep)), theme.text);
    if !p.triggers.is_empty() {
        put(frame, body, &mut y, format!("Antes del impulso: {}", p.triggers.iter().take(4).map(|(t, n)| format!("{t} {n}")).collect::<Vec<_>>().join(g.dot_sep)), theme.text);
    }
    if !p.contexts.is_empty() {
        put(frame, body, &mut y, format!("Contexto: {}", p.contexts.iter().take(4).map(|(t, n)| format!("{t} {n}")).collect::<Vec<_>>().join(g.dot_sep)), theme.text);
    }
    if !p.pathways.is_empty() {
        put(frame, body, &mut y, format!("Vías elegidas: {}", p.pathways.iter().map(|(pw, n)| format!("{} {n}", pw.key().replace('_', " "))).collect::<Vec<_>>().join(g.dot_sep)), theme.text);
    }
    y += 1;
    if p.rising_four_weeks() {
        let w = p.acted_weekly;
        put(frame, body, &mut y, text::PATTERN_RISING.replace("{a}", &w[0].to_string()).replace("{b}", &w[1].to_string()).replace("{c}", &w[2].to_string()).replace("{d}", &w[3].to_string()), theme.warn);
        if s.show_derivation {
            put(frame, body, &mut y, text::DERIVATION_BASE, theme.dim);
        }
        y += 1;
    }
    if !s.cfg.env_changes.is_empty() {
        put(frame, body, &mut y, "Cambios en el entorno que anotaste. ¿Siguen en pie?", theme.emphasis);
        for c in &s.cfg.env_changes {
            put(frame, body, &mut y, format!("  {} {c}", g.bullet), theme.text);
        }
    }
}
