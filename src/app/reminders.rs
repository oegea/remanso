//! Recordatorios: pendientes (vencidos) y próximos. Sin proceso residente.

use crossterm::event::{KeyCode, KeyEvent};
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
use crate::domain::reminders as rm;
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::widgets::{self, Selector};

pub struct Reminders {
    pub due: Vec<rm::Reminder>,
    pub upcoming: Vec<rm::Reminder>,
    pub sel: Selector,
}

impl Reminders {
    pub fn open(db: &Db) -> Result<Self> {
        let now = dates::now_ts();
        let due = rm::due(&db.conn, now)?;
        // Mostrar cuenta como «aparición» a efectos de habituación.
        for r in &due {
            rm::mark_shown(&db.conn, r.id)?;
        }
        Ok(Self { due, upcoming: rm::upcoming(&db.conn, now, 100)?, sel: Selector::default() })
    }

    fn reload(&mut self, db: &Db) {
        let now = dates::now_ts();
        if let Ok(d) = rm::due(&db.conn, now) {
            self.due = d;
        }
        if let Ok(u) = rm::upcoming(&db.conn, now, 100) {
            self.upcoming = u;
        }
        self.sel.clamp(self.len());
    }

    fn len(&self) -> usize {
        self.due.len() + self.upcoming.len()
    }

    fn selected(&self) -> Option<&rm::Reminder> {
        let i = self.sel.index;
        if i < self.due.len() {
            self.due.get(i)
        } else {
            self.upcoming.get(i - self.due.len())
        }
    }
}

pub fn handle(app: &mut App, mut s: Reminders, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Reminders(s) };
    let cur = s.selected().cloned();
    match (k.code, cur) {
        (KeyCode::Esc, _) => {
            app.go_home();
            Screen::Reminders(s)
        }
        (KeyCode::Char('n'), _) => {
            app.prompt(text::REMINDER_TITLE_PROMPT, "", Deferred::ReminderTitle);
            Screen::Reminders(s)
        }
        (KeyCode::Char('d') | KeyCode::Enter | KeyCode::Char(' '), Some(r)) => {
            if let Err(e) = rm::dismiss(&db.conn, r.id) {
                app.error(e.to_string());
            }
            s.reload(db);
            Screen::Reminders(s)
        }
        (KeyCode::Char('z'), Some(r)) => {
            app.prompt(text::REMINDER_SNOOZE_PROMPT, "", Deferred::ReminderSnooze(r.id));
            Screen::Reminders(s)
        }
        (KeyCode::Char('e'), Some(r)) => {
            app.prompt(text::REMINDER_WHEN_PROMPT, "", Deferred::ReminderReschedule(r.id));
            Screen::Reminders(s)
        }
        (KeyCode::Char('r'), Some(r)) => {
            let cur = r.repeat.as_ref().map(|x| x.describe()).unwrap_or_default();
            app.prompt(text::REMINDER_REPEAT_PROMPT, &cur, Deferred::ReminderRepeat(r.id));
            Screen::Reminders(s)
        }
        (KeyCode::Char('D'), Some(r)) => {
            app.confirm(text::REMINDER_DELETE_CONFIRM, true, Deferred::ReminderDelete(r.id));
            Screen::Reminders(s)
        }
        (KeyCode::Char('?'), _) => {
            let mut h = vec![
                ("n", "nuevo recordatorio"),
                ("d / Intro", "cerrar (si se repite, pasa a la siguiente fecha)"),
                ("z", "posponer hasta un momento concreto"),
                ("e", "reprogramar"),
                ("r", "repetición"),
                ("D", "borrar"),
                ("", "Se comprueban al abrir la aplicación y al usarla; nada suena con ella cerrada."),
                ("", ""),
            ];
            h.extend(super::global_help());
            app.help(text::REMINDERS, h);
            Screen::Reminders(s)
        }
        _ => {
            s.sel.handle_key(k, s.len(), 10);
            Screen::Reminders(s)
        }
    }
}

fn parse_when(app: &App, v: &str) -> Option<i64> {
    let r = dates::parse_datetime_input(v, dates::now_local());
    if r.is_none() {
        app.error(text::REMINDER_WHEN_UNKNOWN);
    }
    r
}

pub fn run_deferred(app: &mut App, screen: Screen, d: Deferred, value: Option<String>) -> Screen {
    let Some(db) = &app.db else { return screen };
    let v = value.unwrap_or_default();
    let vt = v.trim();
    match d {
        Deferred::ReminderTitle => {
            if !vt.is_empty() {
                app.prompt(text::REMINDER_WHEN_PROMPT, "", Deferred::ReminderWhen(vt.to_string()));
            }
            screen
        }
        Deferred::ReminderWhen(title) => {
            if let Some(ts) = parse_when(app, vt) {
                match rm::create(&db.conn, &title, ts, None, None, None) {
                    Ok(id) => app.prompt(text::REMINDER_REPEAT_PROMPT, "", Deferred::ReminderRepeat(id)),
                    Err(e) => app.error(e.to_string()),
                }
            } else {
                app.prompt(text::REMINDER_WHEN_PROMPT, vt, Deferred::ReminderWhen(title));
            }
            screen
        }
        Deferred::ReminderRepeat(id) => {
            let rule = Rule::parse_human(vt);
            if rule.is_none() && !vt.is_empty() && !matches!(vt.to_lowercase().as_str(), "no" | "nunca" | "-") {
                app.error(text::TASK_RECUR_UNKNOWN);
            } else if let Err(e) = rm::set_repeat(&db.conn, id, rule.as_ref()) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        Deferred::ReminderSnooze(id) => {
            if let Some(ts) = parse_when(app, vt) {
                if let Err(e) = rm::snooze(&db.conn, id, ts) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        Deferred::ReminderReschedule(id) => {
            if let Some(ts) = parse_when(app, vt) {
                if let Err(e) = rm::reschedule(&db.conn, id, ts) {
                    app.error(e.to_string());
                }
            }
            refresh(app, screen)
        }
        Deferred::ReminderDelete(id) => {
            if let Err(e) = rm::delete(&db.conn, id) {
                app.error(e.to_string());
            }
            refresh(app, screen)
        }
        _ => screen,
    }
}

fn refresh(app: &App, screen: Screen) -> Screen {
    match screen {
        Screen::Reminders(mut s) => {
            if let Some(db) = &app.db {
                s.reload(db);
            }
            Screen::Reminders(s)
        }
        other => other,
    }
}

pub fn render(s: &mut Reminders, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let keys = [("n", "nuevo"), ("d", "cerrar"), ("z", "posponer"), ("e", "reprogramar"), ("Esc", text::BACK), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, text::REMINDERS, "", &keys).body;
    if s.len() == 0 {
        widgets::empty_state(frame, body, theme, text::REMINDERS_EMPTY);
        return;
    }
    s.sel.clamp(s.len());
    // Filas: cabecera «Pendientes», sus avisos, cabecera «Próximos», sus avisos.
    let mut rows: Vec<(Option<usize>, Line)> = vec![];
    let fmt_when = |ts: i64| -> String {
        let d = dates::ts_to_date(ts);
        if d == today {
            format!("hoy {}", dates::fmt_time(ts))
        } else {
            format!("{} {}", dates::fmt_date_compact(d, today), dates::fmt_time(ts))
        }
    };
    let mk_row = |idx: usize, r: &rm::Reminder, selected: bool| -> Line<'static> {
        let marker = if selected { g.cursor } else { " " };
        let when = fmt_when(r.effective_at());
        let mut extra = vec![];
        if let Some(rep) = &r.repeat {
            extra.push(rep.describe());
        }
        if r.needs_review() && idx < s.due.len() {
            extra.push("mostrado 2 veces".into());
        }
        let extra = extra.join(g.dot_sep);
        let avail = (body.width as usize).saturating_sub(2 + when.width() + 2 + extra.width() + 2);
        Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{when}  "), if idx < s.due.len() { theme.warn } else { theme.dim }),
            Span::styled(format!("{:<avail$}", g.truncate(&r.title, avail)), if selected { theme.selected } else { theme.text }),
            Span::raw("  "),
            Span::styled(extra, theme.dim),
        ])
    };
    if !s.due.is_empty() {
        rows.push((None, Line::from(Span::styled(text::REMINDERS_DUE, theme.title))));
        for (i, r) in s.due.iter().enumerate() {
            rows.push((Some(i), mk_row(i, r, i == s.sel.index)));
        }
        rows.push((None, Line::raw("")));
    }
    if !s.upcoming.is_empty() {
        rows.push((None, Line::from(Span::styled(text::REMINDERS_UPCOMING, theme.title))));
        for (j, r) in s.upcoming.iter().enumerate() {
            let i = s.due.len() + j;
            rows.push((Some(i), mk_row(i, r, i == s.sel.index)));
        }
    }
    // Desplazamiento para que la fila seleccionada sea visible.
    let sel_row = rows.iter().position(|(i, _)| *i == Some(s.sel.index)).unwrap_or(0);
    let h = body.height as usize;
    let start = if sel_row >= h { sel_row + 1 - h } else { 0 };
    let mut y = body.y;
    for (_, line) in rows.into_iter().skip(start).take(h) {
        frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
    }
    if let Some(r) = s.selected() {
        if r.needs_review() && s.sel.index < s.due.len() {
            let hint = Paragraph::new(Span::styled(text::REMINDER_REVIEW_HINT, theme.dim)).wrap(ratatui::widgets::Wrap { trim: true });
            let hh = widgets::line_count(text::REMINDER_REVIEW_HINT, body.width).min(3);
            if body.height > hh + 2 {
                frame.render_widget(hint, Rect { x: body.x, y: body.y + body.height - hh, width: body.width, height: hh });
            }
        }
    }
}
