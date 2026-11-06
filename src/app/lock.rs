//! Pantalla de bloqueo, creación de la base y configuración inicial.
//! No muestra ningún dato del usuario.

use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use super::{App, Ctx, Screen};
use crate::crypto::Password;
use crate::storage::{Db, DbError};
use crate::text;
use crate::ui::widgets::LineInput;

pub struct Lock {
    pub creating: bool,
    pub input: LineInput,
    pub first: Option<Password>,
    pub error: Option<&'static str>,
    pub busy: bool,
}

impl Lock {
    pub fn new(creating: bool) -> Self {
        Self { creating, input: LineInput::secret(), first: None, error: None, busy: false }
    }
}

pub fn handle(app: &mut App, mut s: Lock, k: KeyEvent) -> Screen {
    match k.code {
        KeyCode::Esc if s.creating && s.first.is_some() => {
            s.first = None;
            s.input.clear();
            s.error = None;
            Screen::Lock(s)
        }
        KeyCode::Esc => {
            app.quit = true;
            Screen::Lock(s)
        }
        KeyCode::Enter => {
            let pw = Password(std::mem::take(&mut s.input.value));
            s.input.clear();
            if s.creating {
                create_flow(app, s, pw)
            } else {
                match Db::open(&app.dir, &pw) {
                    Ok(db) => {
                        app.db = Some(db);
                        app.last_activity = std::time::Instant::now();
                        app.after_unlock();
                        Screen::Home(super::home::Home::default())
                    }
                    Err(DbError::WrongPassword) => {
                        s.error = Some(text::LOCK_WRONG);
                        Screen::Lock(s)
                    }
                    Err(e) => {
                        app.error(e.to_string());
                        Screen::Lock(s)
                    }
                }
            }
        }
        _ => {
            s.input.handle_key(k);
            s.error = None;
            Screen::Lock(s)
        }
    }
}

fn create_flow(app: &mut App, mut s: Lock, pw: Password) -> Screen {
    match s.first.take() {
        None => {
            if pw.0.chars().count() < 8 {
                s.error = Some(text::CREATE_TOO_SHORT);
            } else {
                s.first = Some(pw);
            }
            Screen::Lock(s)
        }
        Some(first) => {
            if first.0 != pw.0 {
                s.error = Some(text::CREATE_MISMATCH);
                return Screen::Lock(s);
            }
            match Db::create(&app.dir, &pw) {
                Ok(db) => {
                    app.db = Some(db);
                    let _ = app.prefs.save(&app.dir);
                    Screen::Setup(Setup::default())
                }
                Err(e) => {
                    app.error(e.to_string());
                    Screen::Lock(s)
                }
            }
        }
    }
}

pub fn render(s: &Lock, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let today = crate::dates::fmt_date_long(crate::dates::today());
    let cx = area.x + area.width / 2;
    let w = 48u16.min(area.width.saturating_sub(4));
    let x = cx.saturating_sub(w / 2);
    let mut y = area.y + area.height / 2 - if s.creating { 6 } else { 3 };

    let title = Line::from(Span::styled(text::APP_NAME, theme.title));
    frame.render_widget(Paragraph::new(title).centered(), Rect { x: area.x, y, width: area.width, height: 1 });
    y += 1;
    frame.render_widget(
        Paragraph::new(Span::styled(today, theme.dim)).centered(),
        Rect { x: area.x, y, width: area.width, height: 1 },
    );
    y += 2;

    if s.creating {
        for l in text::CREATE_INTRO {
            frame.render_widget(Paragraph::new(Span::styled(*l, theme.text)), Rect { x, y, width: w, height: 1 });
            y += 1;
        }
        y += 1;
    }
    let label = if !s.creating {
        text::LOCK_PASSWORD
    } else if s.first.is_none() {
        text::CREATE_PASSWORD
    } else {
        text::CREATE_REPEAT
    };
    s.input.render(frame, Rect { x, y, width: w, height: 1 }, theme, &format!("{label}:"), !ctx.modal_open, ctx.prefs.password_feedback);
    y += 2;
    let hint: &str = match s.error {
        Some(e) => e,
        None if s.busy => text::LOCK_DERIVING,
        None if s.creating => "Esc para volver",
        None => text::LOCK_HINT,
    };
    let style = if s.error.is_some() { theme.alert } else { theme.dim };
    frame.render_widget(Paragraph::new(Span::styled(hint, style)), Rect { x, y, width: w, height: 1 });
}

// ---- configuración inicial ----------------------------------------------------

#[derive(Default)]
pub struct Setup {
    pub index: usize,
}

pub fn handle_setup(app: &mut App, mut s: Setup, k: KeyEvent) -> Screen {
    match k.code {
        KeyCode::Enter => {
            let _ = app.prefs.save(&app.dir);
            app.go_home();
        }
        KeyCode::Up | KeyCode::Char('k') => s.index = s.index.saturating_sub(1),
        KeyCode::Down | KeyCode::Char('j') => s.index = (s.index + 1).min(1),
        KeyCode::Left | KeyCode::Right | KeyCode::Char(' ') | KeyCode::Tab => {
            super::settings::toggle_pref(app, s.index);
        }
        _ => {}
    }
    Screen::Setup(s)
}

pub fn render_setup(s: &Setup, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let w = 56u16.min(area.width.saturating_sub(4));
    let x = area.x + (area.width - w) / 2;
    let mut y = area.y + area.height / 2 - 5;
    frame.render_widget(Paragraph::new(Span::styled(text::SETUP_TITLE, theme.title)), Rect { x, y, width: w, height: 1 });
    y += 2;
    let theme_name = match ctx.prefs.theme {
        crate::prefs::Theme::Dark => text::SETTINGS_DARK,
        crate::prefs::Theme::Light => text::SETTINGS_LIGHT,
    };
    let charset = if g.ascii { text::SETTINGS_ASCII } else { text::SETTINGS_UNICODE };
    for (i, (label, value)) in [(text::SETUP_THEME, theme_name), (text::SETUP_CHARSET, charset)].iter().enumerate() {
        let marker = if i == s.index { g.cursor } else { " " };
        let style = if i == s.index { theme.selected } else { theme.text };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{label:<12}"), style),
            Span::styled(format!("{} {} {}", "<", value, ">"), theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x, y, width: w, height: 1 });
        y += 1;
    }
    y += 1;
    let preview = format!(
        "{} {}{}{}  {}{}{}{}{}  {}",
        text::SETUP_PREVIEW,
        g.rule.repeat(3),
        g.done,
        g.todo,
        g.bar_full,
        g.bar_full,
        g.bar_empty,
        g.bar_empty,
        g.spark.iter().map(|s| s.to_string()).collect::<String>(),
        "jue 5 nov"
    );
    frame.render_widget(Paragraph::new(Span::styled(preview, theme.dim)), Rect { x, y, width: w, height: 1 });
    y += 2;
    frame.render_widget(Paragraph::new(Span::styled(text::SETUP_DONE, theme.dim)), Rect { x, y, width: w, height: 1 });
}
