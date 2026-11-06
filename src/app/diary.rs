//! Diario: lista cronológica y editor de entradas.

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
use crate::domain::{diary, tags};
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::editor::Editor;
use crate::ui::widgets::{self, Selector};

pub struct DiaryList {
    pub entries: Vec<diary::EntrySummary>,
    pub sel: Selector,
}

impl DiaryList {
    pub fn open(db: &Db) -> Result<Self> {
        Ok(Self { entries: diary::list(&db.conn, 0, 5000)?, sel: Selector::default() })
    }

    pub fn reload(&mut self, db: &Db) {
        if let Ok(e) = diary::list(&db.conn, 0, 5000) {
            self.entries = e;
        }
        self.sel.clamp(self.entries.len());
    }

    pub fn select_id(&mut self, id: i64) {
        if let Some(i) = self.entries.iter().position(|e| e.id == id) {
            self.sel.index = i;
        }
    }
}

pub struct DiaryEdit {
    pub id: i64,
    pub title: Option<String>,
    pub day: String,
    pub created_at: i64,
    pub editor: Editor,
    pub tags: Vec<String>,
    pub is_new: bool,
}

impl DiaryEdit {
    pub fn open(db: &Db, id: i64, is_new: bool) -> Result<Self> {
        let e = diary::get(&db.conn, id)?.ok_or(crate::storage::DbError::NotFound)?;
        let mut editor = Editor::from_text(&e.body);
        editor.move_to_end();
        Ok(Self {
            id,
            title: e.title,
            day: e.day,
            created_at: e.created_at,
            editor,
            tags: tags::tags_of(&db.conn, "diary", id).unwrap_or_default(),
            is_new,
        })
    }

    pub fn save(&mut self, db: &Db) -> Result<()> {
        if self.editor.dirty {
            diary::save_body(&db.conn, self.id, self.title.as_deref(), &self.editor.text())?;
            self.editor.mark_saved();
        }
        Ok(())
    }

    /// Guarda y, si la entrada quedó vacía, la elimina silenciosamente.
    pub fn close(&mut self, db: &Db) -> Result<Option<i64>> {
        self.save(db)?;
        if diary::is_empty(&db.conn, self.id)? {
            diary::delete(&db.conn, self.id)?;
            return Ok(None);
        }
        Ok(Some(self.id))
    }
}

pub fn handle_list(app: &mut App, mut s: DiaryList, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Diary(s) };
    match k.code {
        KeyCode::Esc => {
            app.go_home();
            Screen::Diary(s)
        }
        KeyCode::Char('n') => match diary::create(&db.conn).and_then(|id| DiaryEdit::open(db, id, true)) {
            Ok(e) => Screen::DiaryEdit(e),
            Err(e) => {
                app.error(e.to_string());
                Screen::Diary(s)
            }
        },
        KeyCode::Enter | KeyCode::Char('e') if !s.entries.is_empty() => {
            let id = s.entries[s.sel.index].id;
            match DiaryEdit::open(db, id, false) {
                Ok(e) => Screen::DiaryEdit(e),
                Err(e) => {
                    app.error(e.to_string());
                    Screen::Diary(s)
                }
            }
        }
        KeyCode::Char('D') if !s.entries.is_empty() => {
            let id = s.entries[s.sel.index].id;
            app.confirm(text::DIARY_DELETE_CONFIRM, true, Deferred::DeleteDiaryEntry(id));
            Screen::Diary(s)
        }
        KeyCode::Char('/') => Screen::Search(super::search::Search::new(super::search::Scope::Diary, Box::new(Screen::Diary(s)))),
        KeyCode::Char('?') => {
            let mut h = vec![
                ("n", "nueva entrada"),
                ("Intro / e", "abrir"),
                ("D", "borrar (pide confirmación)"),
                ("j k ↑ ↓", "moverse"),
                ("g G", "principio / fin"),
                ("", ""),
            ];
            h.extend(super::global_help());
            app.help(text::DIARY, h);
            Screen::Diary(s)
        }
        _ => {
            s.sel.handle_key(k, s.entries.len(), 10);
            Screen::Diary(s)
        }
    }
}

pub fn handle_edit(app: &mut App, mut s: DiaryEdit, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::DiaryEdit(s) };
    let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
    match (k.code, ctrl) {
        (KeyCode::Esc, _) => {
            if app.zen {
                app.zen = false;
                return Screen::DiaryEdit(s);
            }
            let kept = match s.close(db) {
                Ok(k) => k,
                Err(e) => {
                    app.error(e.to_string());
                    return Screen::DiaryEdit(s);
                }
            };
            match DiaryList::open(db) {
                Ok(mut l) => {
                    if let Some(id) = kept {
                        l.select_id(id);
                    }
                    Screen::Diary(l)
                }
                Err(e) => {
                    app.error(e.to_string());
                    app.go_home();
                    Screen::Blank
                }
            }
        }
        (KeyCode::Char('s'), true) => {
            match s.save(db) {
                Ok(()) => app.notify(text::SAVED),
                Err(e) => app.error(e.to_string()),
            }
            Screen::DiaryEdit(s)
        }
        (KeyCode::Char('f'), true) => {
            app.zen = !app.zen;
            Screen::DiaryEdit(s)
        }
        (KeyCode::Char('t'), true) => {
            let id = s.id;
            let cur = s.title.clone().unwrap_or_default();
            app.prompt(text::DIARY_TITLE_PROMPT, &cur, Deferred::SetDiaryTitle(id));
            Screen::DiaryEdit(s)
        }
        (KeyCode::Char('g'), true) => {
            let id = s.id;
            let cur = s.tags.join(" ");
            app.prompt(text::DIARY_TAGS_PROMPT, &cur, Deferred::SetDiaryTags(id));
            Screen::DiaryEdit(s)
        }
        (KeyCode::F(1), _) => {
            app.help(
                text::DIARY_ENTRY,
                vec![
                    ("Esc", "guardar y volver"),
                    ("Ctrl+S", "guardar ahora (también automático)"),
                    ("Ctrl+T", "título"),
                    ("Ctrl+G", "etiquetas"),
                    ("Ctrl+F", "modo sólo texto"),
                    ("Ctrl+Z / Ctrl+Y", "deshacer / rehacer"),
                    ("Ctrl+← →", "palabra anterior / siguiente"),
                    ("Ctrl+Inicio/Fin", "principio / fin del texto"),
                    ("", "Las líneas que empiezan por #, - o > se resaltan."),
                ],
            );
            Screen::DiaryEdit(s)
        }
        _ => {
            s.editor.handle_key(k);
            Screen::DiaryEdit(s)
        }
    }
}

pub fn run_deferred(app: &mut App, screen: Screen, d: Deferred, value: Option<String>) -> Screen {
    let Some(db) = &app.db else { return screen };
    match (d, screen) {
        (Deferred::DeleteDiaryEntry(id), Screen::Diary(mut l)) => {
            if let Err(e) = diary::delete(&db.conn, id) {
                app.error(e.to_string());
            }
            l.reload(db);
            Screen::Diary(l)
        }
        (Deferred::SetDiaryTitle(id), Screen::DiaryEdit(mut e)) if e.id == id => {
            let v = value.unwrap_or_default();
            e.title = if v.trim().is_empty() { None } else { Some(v.trim().to_string()) };
            if let Err(err) = diary::save_body(&db.conn, id, e.title.as_deref(), &e.editor.text()) {
                app.error(err.to_string());
            }
            e.editor.mark_saved();
            Screen::DiaryEdit(e)
        }
        (Deferred::SetDiaryTags(id), Screen::DiaryEdit(mut e)) if e.id == id => {
            let parsed = tags::parse_tags(&value.unwrap_or_default());
            if let Err(err) = tags::set_tags(&db.conn, "diary", id, &parsed) {
                app.error(err.to_string());
            }
            e.tags = parsed;
            Screen::DiaryEdit(e)
        }
        (_, screen) => screen,
    }
}

pub fn render_list(s: &mut DiaryList, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let right = if s.entries.is_empty() { String::new() } else { format!("{}", s.entries.len()) };
    let keys = [("n", text::DIARY_NEW), ("Intro", text::OPEN), ("D", text::DELETE), ("/", text::SEARCH), ("Esc", text::BACK), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, text::DIARY, &right, &keys).body;
    if s.entries.is_empty() {
        widgets::empty_state(frame, body, theme, text::DIARY_EMPTY);
        return;
    }
    s.sel.clamp(s.entries.len());
    let height = body.height as usize;
    let range = s.sel.visible(s.entries.len(), height);
    let date_w = 14usize;
    let mut y = body.y;
    for i in range {
        let e = &s.entries[i];
        let selected = i == s.sel.index;
        let show_date = i == 0 || s.entries[i - 1].day != e.day;
        let date = if show_date {
            dates::parse_iso_date(&e.day).map(|d| dates::fmt_date_short(d)).unwrap_or_else(|| e.day.clone())
        } else {
            String::new()
        };
        let time = dates::fmt_time(e.created_at);
        let words = if e.words > 0 { format!("{} {}", e.words, text::DIARY_WORDS) } else { String::new() };
        let main = match &e.title {
            Some(t) if !e.preview.is_empty() => format!("{t}  {}", e.preview),
            Some(t) => t.clone(),
            None => e.preview.clone(),
        };
        let avail = (body.width as usize).saturating_sub(2 + date_w + 1 + 6 + 2 + words.width() + 1);
        let main = g.truncate(&main, avail);
        let marker = if selected { g.cursor } else { " " };
        let style = if selected { theme.selected } else { theme.text };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{date:<date_w$} "), if show_date { theme.dim } else { theme.text }),
            Span::styled(format!("{time}  "), theme.dim),
            Span::styled(format!("{main:<avail$}"), if e.title.is_some() { style.patch(theme.emphasis) } else { style }),
            Span::raw("  "),
            Span::styled(words, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
    }
    let _ = today;
}

pub fn render_edit(s: &mut DiaryEdit, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let focused = !ctx.modal_open;
    if ctx.zen {
        let margin = ((area.width as usize).saturating_sub(72) / 2) as u16;
        let inner = Rect { x: area.x + margin.max(1), y: area.y + 1, width: area.width - 2 * margin.max(1), height: area.height.saturating_sub(2) };
        s.editor.render(frame, inner, theme, focused);
        return;
    }
    let day = dates::parse_iso_date(&s.day).map(dates::fmt_date_long).unwrap_or_else(|| s.day.clone());
    let title = match &s.title {
        Some(t) => format!("{}{}{}", text::DIARY, g.dot_sep, t),
        None => format!("{}{}{}", text::DIARY, g.dot_sep, day),
    };
    let (row, total) = s.editor.scroll_info();
    let mut right = format!("{} {}", s.editor.word_count(), text::DIARY_WORDS);
    if total > 1 {
        right = format!("{row}/{total}{}{right}", g.dot_sep);
    }
    if s.editor.dirty {
        right.push_str(" *");
    }
    if !s.tags.is_empty() {
        right = format!("#{}{}{}", s.tags.join(" #"), g.dot_sep, right);
    }
    let keys = [("Esc", "guardar y volver"), ("Ctrl+T", text::TITLE), ("Ctrl+G", text::TAGS), ("Ctrl+F", text::FOCUS), ("F1", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, &title, &right, &keys).body;
    // Subcabecera con hora y día si hay título.
    let mut editor_area = body;
    if s.title.is_some() {
        frame.render_widget(
            Paragraph::new(Span::styled(format!("{day}{}{}", g.dot_sep, dates::fmt_time(s.created_at)), theme.dim)),
            Rect { x: body.x, y: body.y, width: body.width, height: 1 },
        );
        editor_area = Rect { x: body.x, y: body.y + 1, width: body.width, height: body.height.saturating_sub(1) };
    }
    let margin = ((editor_area.width as usize).saturating_sub(76) / 2) as u16;
    let inner = Rect { x: editor_area.x + margin, y: editor_area.y, width: editor_area.width - 2 * margin, height: editor_area.height };
    s.editor.render(frame, inner, theme, focused);
}
