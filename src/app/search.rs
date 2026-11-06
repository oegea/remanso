//! Búsqueda incremental en diario y cuadernos.

use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};
use unicode_width::UnicodeWidthStr;

use super::{App, Ctx, Screen};
use crate::dates;
use crate::domain::search::{self as s, Hit};
use crate::text;
use crate::ui::widgets::{self, LineInput, Selector};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    All,
    Diary,
    Notes,
}

pub struct Search {
    pub scope: Scope,
    pub input: LineInput,
    pub hits: Vec<Hit>,
    pub sel: Selector,
    pub back: Box<Screen>,
    pub searched: bool,
}

impl Search {
    pub fn new(scope: Scope, back: Box<Screen>) -> Self {
        Self { scope, input: LineInput::new(""), hits: vec![], sel: Selector::default(), back, searched: false }
    }

    fn refresh(&mut self, db: &crate::storage::Db) {
        let q = self.input.value.clone();
        let r = match self.scope {
            Scope::All => s::search_all(&db.conn, &q, 60),
            Scope::Diary => s::search_diary(&db.conn, &q, 60),
            Scope::Notes => s::search_notes(&db.conn, &q, 60),
        };
        self.hits = r.unwrap_or_default();
        self.searched = !q.trim().is_empty();
        self.sel.clamp(self.hits.len());
    }
}

pub fn handle(app: &mut App, mut st: Search, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Search(st) };
    match k.code {
        KeyCode::Esc => *st.back,
        KeyCode::Enter if !st.hits.is_empty() => match &st.hits[st.sel.index] {
            Hit::Diary { id, .. } => match super::diary::DiaryEdit::open(db, *id, false) {
                Ok(e) => Screen::DiaryEdit(e),
                Err(e) => {
                    app.error(e.to_string());
                    Screen::Search(st)
                }
            },
            Hit::Note { id, .. } => match super::notebooks::NoteEdit::open(db, *id) {
                Ok(e) => Screen::NoteEdit(e),
                Err(e) => {
                    app.error(e.to_string());
                    Screen::Search(st)
                }
            },
        },
        KeyCode::Down | KeyCode::Up | KeyCode::PageDown | KeyCode::PageUp => {
            st.sel.handle_key(k, st.hits.len(), 10);
            Screen::Search(st)
        }
        KeyCode::Tab => {
            st.scope = match st.scope {
                Scope::All => Scope::Diary,
                Scope::Diary => Scope::Notes,
                Scope::Notes => Scope::All,
            };
            st.refresh(db);
            Screen::Search(st)
        }
        _ => {
            if st.input.handle_key(k) {
                st.refresh(db);
            }
            Screen::Search(st)
        }
    }
}

pub fn render(st: &mut Search, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let scope = match st.scope {
        Scope::All => "todo",
        Scope::Diary => "diario",
        Scope::Notes => "cuadernos",
    };
    let keys = [("Intro", text::OPEN), ("↑ ↓", "moverse"), ("Tab", "ámbito"), ("Esc", text::BACK)];
    let body = widgets::chrome(frame, area, theme, g, text::SEARCH, scope, &keys).body;
    st.input.render(frame, Rect { x: body.x, y: body.y, width: body.width, height: 1 }, theme, &format!("{}:", text::SEARCH_PROMPT), !ctx.modal_open, true);
    let list = Rect { x: body.x, y: body.y + 2, width: body.width, height: body.height.saturating_sub(2) };
    if !st.searched {
        widgets::empty_state(frame, list, theme, &[text::SEARCH_HINT]);
        return;
    }
    if st.hits.is_empty() {
        widgets::empty_state(frame, list, theme, &[text::SEARCH_NONE]);
        return;
    }
    let range = st.sel.visible(st.hits.len(), list.height as usize);
    let mut y = list.y;
    for i in range {
        let selected = i == st.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let style = if selected { theme.selected } else { theme.text };
        let (kind, head, snippet) = match &st.hits[i] {
            Hit::Diary { day, title, snippet, .. } => {
                let d = dates::parse_iso_date(day).map(|d| dates::fmt_date_compact(d, today)).unwrap_or_else(|| day.clone());
                let head = match title {
                    Some(t) => format!("{d} · {t}"),
                    None => d,
                };
                ("diario", head, snippet.clone())
            }
            Hit::Note { notebook, title, snippet, .. } => ("nota", format!("{notebook} · {title}"), snippet.clone()),
        };
        let head_w = ((list.width as usize) / 3).clamp(12, 34);
        let head = g.truncate(&head, head_w);
        let avail = (list.width as usize).saturating_sub(2 + 7 + head_w + 2);
        let snippet = g.truncate(&snippet, avail);
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{kind:<7}"), theme.dim),
            Span::styled(format!("{head:<head_w$}"), style.patch(theme.emphasis)),
            Span::raw("  "),
            Span::styled(snippet, theme.dim),
        ]);
        let _ = head.width();
        frame.render_widget(Paragraph::new(line), Rect { x: list.x, y, width: list.width, height: 1 });
        y += 1;
    }
}
