//! Cuadernos, notas y editor de notas.

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
use crate::domain::notebooks as nb;
use crate::storage::{Db, Result};
use crate::text;
use crate::ui::editor::Editor;
use crate::ui::widgets::{self, Selector};

pub struct NotebookList {
    pub items: Vec<nb::Notebook>,
    pub sel: Selector,
    pub show_archived: bool,
}

impl NotebookList {
    pub fn open(db: &Db) -> Result<Self> {
        Ok(Self { items: nb::list_notebooks(&db.conn, false)?, sel: Selector::default(), show_archived: false })
    }
    pub fn reload(&mut self, db: &Db) {
        if let Ok(v) = nb::list_notebooks(&db.conn, self.show_archived) {
            self.items = v;
        }
        self.sel.clamp(self.items.len());
    }
    pub fn select_id(&mut self, id: i64) {
        if let Some(i) = self.items.iter().position(|n| n.id == id) {
            self.sel.index = i;
        }
    }
}

pub struct NoteList {
    pub notebook: nb::Notebook,
    pub notes: Vec<nb::NoteSummary>,
    pub sel: Selector,
    pub show_archived: bool,
}

impl NoteList {
    pub fn open(db: &Db, notebook_id: i64) -> Result<Self> {
        let notebook = nb::get_notebook(&db.conn, notebook_id)?.ok_or(crate::storage::DbError::NotFound)?;
        Ok(Self { notebook, notes: nb::list_notes(&db.conn, notebook_id, false)?, sel: Selector::default(), show_archived: false })
    }
    pub fn reload(&mut self, db: &Db) {
        if let Ok(v) = nb::list_notes(&db.conn, self.notebook.id, self.show_archived) {
            self.notes = v;
        }
        if let Ok(Some(n)) = nb::get_notebook(&db.conn, self.notebook.id) {
            self.notebook = n;
        }
        self.sel.clamp(self.notes.len());
    }
    pub fn select_id(&mut self, id: i64) {
        if let Some(i) = self.notes.iter().position(|n| n.id == id) {
            self.sel.index = i;
        }
    }
}

pub struct NoteEdit {
    pub id: i64,
    pub notebook_id: i64,
    pub notebook_name: String,
    pub title: String,
    pub editor: Editor,
    pub updated_at: i64,
}

impl NoteEdit {
    pub fn open(db: &Db, id: i64) -> Result<Self> {
        let n = nb::get_note(&db.conn, id)?.ok_or(crate::storage::DbError::NotFound)?;
        let book = nb::get_notebook(&db.conn, n.notebook_id)?.map(|b| b.name).unwrap_or_default();
        let mut editor = Editor::from_text(&n.body);
        if !n.body.is_empty() {
            editor.move_to_end();
        }
        Ok(Self { id, notebook_id: n.notebook_id, notebook_name: book, title: n.title, editor, updated_at: n.updated_at })
    }
    pub fn save(&mut self, db: &Db) -> Result<()> {
        if self.editor.dirty {
            nb::save_note(&db.conn, self.id, &self.title, &self.editor.text())?;
            self.editor.mark_saved();
            self.updated_at = dates::now_ts();
        }
        Ok(())
    }
    pub fn close(&mut self, db: &Db) -> Result<Option<i64>> {
        self.save(db)?;
        if nb::is_note_empty(&db.conn, self.id)? {
            nb::delete_note(&db.conn, self.id)?;
            return Ok(None);
        }
        Ok(Some(self.id))
    }
}

fn fail(app: &mut App, e: impl std::fmt::Display, fallback: Screen) -> Screen {
    app.error(e.to_string());
    fallback
}

pub fn handle_list(app: &mut App, mut s: NotebookList, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Notebooks(s) };
    match k.code {
        KeyCode::Esc => {
            app.go_home();
            Screen::Notebooks(s)
        }
        KeyCode::Char('n') => {
            app.prompt(text::NOTEBOOK_NAME_PROMPT, "", Deferred::CreateNotebook);
            Screen::Notebooks(s)
        }
        KeyCode::Enter if !s.items.is_empty() => {
            let id = s.items[s.sel.index].id;
            match NoteList::open(db, id) {
                Ok(l) => Screen::Notes(l),
                Err(e) => fail(app, e, Screen::Notebooks(s)),
            }
        }
        KeyCode::Char('e') if !s.items.is_empty() => {
            let it = &s.items[s.sel.index];
            let (id, name) = (it.id, it.name.clone());
            app.prompt(text::NOTEBOOK_NAME_PROMPT, &name, Deferred::RenameNotebook(id));
            Screen::Notebooks(s)
        }
        KeyCode::Char('x') if !s.items.is_empty() => {
            let it = &s.items[s.sel.index];
            if let Err(e) = nb::set_notebook_archived(&db.conn, it.id, !it.archived) {
                app.error(e.to_string());
            }
            s.reload(db);
            Screen::Notebooks(s)
        }
        KeyCode::Char('a') => {
            s.show_archived = !s.show_archived;
            s.reload(db);
            Screen::Notebooks(s)
        }
        KeyCode::Char('D') if !s.items.is_empty() => {
            let id = s.items[s.sel.index].id;
            app.confirm(text::NOTEBOOK_DELETE_CONFIRM, true, Deferred::DeleteNotebook(id));
            Screen::Notebooks(s)
        }
        KeyCode::Char('/') => Screen::Search(super::search::Search::new(super::search::Scope::Notes, Box::new(Screen::Notebooks(s)))),
        KeyCode::Char('?') => {
            let mut h = vec![
                ("n", "nuevo cuaderno"),
                ("Intro", "abrir"),
                ("e", "renombrar"),
                ("x", "archivar / recuperar"),
                ("a", "mostrar u ocultar archivados"),
                ("D", "borrar con sus notas (pide confirmación)"),
                ("", ""),
            ];
            h.extend(super::global_help());
            app.help(text::NOTEBOOKS, h);
            Screen::Notebooks(s)
        }
        _ => {
            s.sel.handle_key(k, s.items.len(), 10);
            Screen::Notebooks(s)
        }
    }
}

pub fn handle_notes(app: &mut App, mut s: NoteList, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::Notes(s) };
    match k.code {
        KeyCode::Esc => match NotebookList::open(db) {
            Ok(mut l) => {
                l.select_id(s.notebook.id);
                Screen::Notebooks(l)
            }
            Err(e) => fail(app, e, Screen::Notes(s)),
        },
        KeyCode::Char('n') => {
            let id = s.notebook.id;
            app.prompt(text::NOTE_TITLE_PROMPT, "", Deferred::CreateNote(id));
            Screen::Notes(s)
        }
        KeyCode::Enter | KeyCode::Char('e') if !s.notes.is_empty() => {
            let id = s.notes[s.sel.index].id;
            match NoteEdit::open(db, id) {
                Ok(e) => Screen::NoteEdit(e),
                Err(e) => fail(app, e, Screen::Notes(s)),
            }
        }
        KeyCode::Char('p') if !s.notes.is_empty() => {
            let n = &s.notes[s.sel.index];
            if let Err(e) = nb::set_note_pinned(&db.conn, n.id, !n.pinned) {
                app.error(e.to_string());
            }
            s.reload(db);
            Screen::Notes(s)
        }
        KeyCode::Char('x') if !s.notes.is_empty() => {
            let n = &s.notes[s.sel.index];
            if let Err(e) = nb::set_note_archived(&db.conn, n.id, !n.archived) {
                app.error(e.to_string());
            }
            s.reload(db);
            Screen::Notes(s)
        }
        KeyCode::Char('a') => {
            s.show_archived = !s.show_archived;
            s.reload(db);
            Screen::Notes(s)
        }
        KeyCode::Char('D') if !s.notes.is_empty() => {
            let id = s.notes[s.sel.index].id;
            app.confirm(text::NOTE_DELETE_CONFIRM, true, Deferred::DeleteNote(id));
            Screen::Notes(s)
        }
        KeyCode::Char('/') => Screen::Search(super::search::Search::new(super::search::Scope::Notes, Box::new(Screen::Notes(s)))),
        KeyCode::Char('?') => {
            let mut h = vec![
                ("n", "nueva nota"),
                ("Intro / e", "abrir"),
                ("p", "fijar arriba / soltar"),
                ("x", "archivar / recuperar"),
                ("a", "mostrar u ocultar archivadas"),
                ("D", "borrar (pide confirmación)"),
                ("", ""),
            ];
            h.extend(super::global_help());
            app.help(&s.notebook.name.clone(), h);
            Screen::Notes(s)
        }
        _ => {
            s.sel.handle_key(k, s.notes.len(), 10);
            Screen::Notes(s)
        }
    }
}

pub fn handle_edit(app: &mut App, mut s: NoteEdit, k: KeyEvent) -> Screen {
    let Some(db) = &app.db else { return Screen::NoteEdit(s) };
    let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
    match (k.code, ctrl) {
        (KeyCode::Esc, _) => {
            if app.zen {
                app.zen = false;
                return Screen::NoteEdit(s);
            }
            let kept = match s.close(db) {
                Ok(k) => k,
                Err(e) => return fail(app, e, Screen::NoteEdit(s)),
            };
            match NoteList::open(db, s.notebook_id) {
                Ok(mut l) => {
                    if let Some(id) = kept {
                        l.select_id(id);
                    }
                    Screen::Notes(l)
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
            Screen::NoteEdit(s)
        }
        (KeyCode::Char('f'), true) => {
            app.zen = !app.zen;
            Screen::NoteEdit(s)
        }
        (KeyCode::Char('t'), true) => {
            let (id, cur) = (s.id, s.title.clone());
            app.prompt(text::NOTE_TITLE_PROMPT, &cur, Deferred::SetNoteTitle(id));
            Screen::NoteEdit(s)
        }
        (KeyCode::Char('o'), true) => {
            // Seguir el primer enlace [[Título]] de la línea del cursor, o de la nota.
            let links = nb::wiki_links(&s.editor.text());
            if let Some(t) = links.first() {
                match nb::find_note_by_title(&db.conn, t) {
                    Ok(Some(id)) => {
                        let _ = s.save(db);
                        return match NoteEdit::open(db, id) {
                            Ok(e) => Screen::NoteEdit(e),
                            Err(e) => fail(app, e, Screen::NoteEdit(s)),
                        };
                    }
                    Ok(None) => app.notify(text::NOTE_LINK_MISSING),
                    Err(e) => app.error(e.to_string()),
                }
            }
            Screen::NoteEdit(s)
        }
        (KeyCode::F(1), _) => {
            app.help(
                &s.title.clone(),
                vec![
                    ("Esc", "guardar y volver"),
                    ("Ctrl+S", "guardar ahora (también automático)"),
                    ("Ctrl+T", "cambiar el título"),
                    ("Ctrl+O", "abrir el primer enlace [[Título]] de la nota"),
                    ("Ctrl+F", "modo sólo texto"),
                    ("Ctrl+Z / Ctrl+Y", "deshacer / rehacer"),
                    ("", "Escribe [[Título de otra nota]] para enlazarla."),
                ],
            );
            Screen::NoteEdit(s)
        }
        _ => {
            s.editor.handle_key(k);
            Screen::NoteEdit(s)
        }
    }
}

pub fn run_deferred(app: &mut App, screen: Screen, d: Deferred, value: Option<String>) -> Screen {
    let Some(db) = &app.db else { return screen };
    let v = value.unwrap_or_default();
    match (d, screen) {
        (Deferred::CreateNotebook, Screen::Notebooks(mut l)) => {
            if v.trim().is_empty() {
                return Screen::Notebooks(l);
            }
            match nb::create_notebook(&db.conn, &v) {
                Ok(id) => {
                    l.reload(db);
                    l.select_id(id);
                }
                Err(e) => app.error(e.to_string()),
            }
            Screen::Notebooks(l)
        }
        (Deferred::RenameNotebook(id), Screen::Notebooks(mut l)) => {
            if !v.trim().is_empty() {
                let desc = l.items.iter().find(|n| n.id == id).map(|n| n.description.clone()).unwrap_or_default();
                if let Err(e) = nb::rename_notebook(&db.conn, id, &v, &desc) {
                    app.error(e.to_string());
                }
                l.reload(db);
            }
            Screen::Notebooks(l)
        }
        (Deferred::DeleteNotebook(id), Screen::Notebooks(mut l)) => {
            if let Err(e) = nb::delete_notebook(&db.conn, id) {
                app.error(e.to_string());
            }
            l.reload(db);
            Screen::Notebooks(l)
        }
        (Deferred::CreateNote(nbid), Screen::Notes(l)) => match nb::create_note(&db.conn, nbid, &v).and_then(|id| NoteEdit::open(db, id)) {
            Ok(e) => Screen::NoteEdit(e),
            Err(e) => fail(app, e, Screen::Notes(l)),
        },
        (Deferred::DeleteNote(id), Screen::Notes(mut l)) => {
            if let Err(e) = nb::delete_note(&db.conn, id) {
                app.error(e.to_string());
            }
            l.reload(db);
            Screen::Notes(l)
        }
        (Deferred::SetNoteTitle(id), Screen::NoteEdit(mut e)) if e.id == id => {
            e.title = v.trim().to_string();
            if let Err(err) = nb::save_note(&db.conn, id, &e.title, &e.editor.text()) {
                app.error(err.to_string());
            }
            e.editor.mark_saved();
            Screen::NoteEdit(e)
        }
        (_, screen) => screen,
    }
}

pub fn render_list(s: &mut NotebookList, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let keys = [("n", "nuevo"), ("Intro", text::OPEN), ("e", "renombrar"), ("x", text::ARCHIVE), ("Esc", text::BACK), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, text::NOTEBOOKS, "", &keys).body;
    if s.items.is_empty() {
        widgets::empty_state(frame, body, theme, text::NOTEBOOKS_EMPTY);
        return;
    }
    s.sel.clamp(s.items.len());
    let range = s.sel.visible(s.items.len(), body.height as usize);
    let mut y = body.y;
    for i in range {
        let it = &s.items[i];
        let selected = i == s.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let style = if selected { theme.selected } else { theme.text };
        let mut detail = format!("{} {}", it.note_count, text::NOTES_COUNT);
        if it.archived {
            detail = format!("{}{}{}", text::NOTEBOOK_ARCHIVED, g.dot_sep, detail);
        }
        let avail = (body.width as usize).saturating_sub(4 + detail.width());
        let name = g.truncate(&it.name, avail);
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{name:<avail$}"), if it.archived { theme.dim } else { style }),
            Span::raw("  "),
            Span::styled(detail, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
    }
}

pub fn render_notes(s: &mut NoteList, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let title = format!("{}{}{}", text::NOTEBOOKS, g.dot_sep, s.notebook.name);
    let keys = [("n", "nueva"), ("Intro", text::OPEN), ("p", text::PIN), ("x", text::ARCHIVE), ("Esc", text::BACK), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, &title, "", &keys).body;
    if s.notes.is_empty() {
        widgets::empty_state(frame, body, theme, text::NOTES_EMPTY);
        return;
    }
    s.sel.clamp(s.notes.len());
    let range = s.sel.visible(s.notes.len(), body.height as usize);
    let mut y = body.y;
    for i in range {
        let n = &s.notes[i];
        let selected = i == s.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let style = if selected { theme.selected } else { theme.text };
        let when = dates::fmt_date_compact(dates::ts_to_date(n.updated_at), today);
        let pin = if n.pinned { format!("{} ", g.pin) } else { "  ".into() };
        let title_w = ((body.width as usize) / 3).clamp(10, 32);
        let title = g.truncate(if n.title.is_empty() { "(sin título)" } else { &n.title }, title_w);
        let avail = (body.width as usize).saturating_sub(2 + 2 + title_w + 2 + when.width() + 1);
        let preview = g.truncate(&n.preview, avail);
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(pin, theme.accent),
            Span::styled(format!("{title:<title_w$}"), if n.archived { theme.dim } else { style.patch(theme.emphasis) }),
            Span::raw("  "),
            Span::styled(format!("{preview:<avail$}"), theme.dim),
            Span::raw(" "),
            Span::styled(when, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x, y, width: body.width, height: 1 });
        y += 1;
    }
}

pub fn render_edit(s: &mut NoteEdit, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let focused = !ctx.modal_open;
    if ctx.zen {
        let margin = ((area.width as usize).saturating_sub(72) / 2) as u16;
        let inner = Rect { x: area.x + margin.max(1), y: area.y + 1, width: area.width - 2 * margin.max(1), height: area.height.saturating_sub(2) };
        s.editor.render(frame, inner, theme, focused);
        return;
    }
    let title = format!("{}{}{}", s.notebook_name, g.dot_sep, if s.title.is_empty() { "(sin título)" } else { &s.title });
    let (row, total) = s.editor.scroll_info();
    let mut right = format!("{} {}", s.editor.word_count(), text::DIARY_WORDS);
    if total > 1 {
        right = format!("{row}/{total}{}{right}", g.dot_sep);
    }
    if s.editor.dirty {
        right.push_str(" *");
    }
    let keys = [("Esc", "guardar y volver"), ("Ctrl+T", text::TITLE), ("Ctrl+O", "seguir enlace"), ("Ctrl+F", text::FOCUS), ("F1", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, &title, &right, &keys).body;
    let margin = ((body.width as usize).saturating_sub(76) / 2) as u16;
    let inner = Rect { x: body.x + margin, y: body.y, width: body.width - 2 * margin, height: body.height };
    s.editor.render(frame, inner, theme, focused);
}
