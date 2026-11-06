//! Inicio: fecha, accesos y una línea de estado neutra por módulo.

use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use super::{App, Ctx, Screen};
use crate::dates;
use crate::domain::{diary, notebooks};
use crate::text;
use crate::ui::widgets::{self, Selector};

#[derive(Default)]
pub struct Home {
    pub sel: Selector,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Item {
    Diary,
    Notebooks,
    Tasks,
    Goals,
    Impulse,
    Review,
    Reminders,
    Search,
    Settings,
}

impl Item {
    pub fn key(self) -> char {
        match self {
            Item::Diary => 'd',
            Item::Notebooks => 'c',
            Item::Tasks => 't',
            Item::Goals => 'o',
            Item::Impulse => 'i',
            Item::Review => 'r',
            Item::Reminders => 'p',
            Item::Search => '/',
            Item::Settings => ',',
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Item::Diary => text::HOME_DIARY,
            Item::Notebooks => text::HOME_NOTEBOOKS,
            Item::Tasks => text::HOME_TASKS,
            Item::Goals => text::HOME_GOALS,
            Item::Impulse => text::HOME_IMPULSE,
            Item::Review => text::HOME_REVIEW,
            Item::Reminders => text::HOME_REMINDERS,
            Item::Search => text::HOME_SEARCH,
            Item::Settings => text::HOME_SETTINGS,
        }
    }
}

pub fn items() -> Vec<Item> {
    vec![Item::Diary, Item::Notebooks, Item::Tasks, Item::Goals, Item::Impulse, Item::Review, Item::Reminders, Item::Search, Item::Settings]
}

pub fn open(app: &mut App, item: Item) -> Screen {
    let Some(db) = &app.db else { return Screen::Home(Home::default()) };
    match item {
        Item::Diary => super::diary::DiaryList::open(db).map(Screen::Diary).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Notebooks => super::notebooks::NotebookList::open(db).map(Screen::Notebooks).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Tasks => super::tasks::Tasks::open(db).map(Screen::Tasks).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Goals => super::goals::GoalList::open(db).map(Screen::Goals).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Impulse => super::impulse::Impulse::open(db).map(Screen::Impulse).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Review => super::review::ReviewMenu::open(db).map(Screen::Review).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Reminders => super::reminders::Reminders::open(db).map(Screen::Reminders).unwrap_or_else(|e| {
            app.error(e.to_string());
            Screen::Home(Home::default())
        }),
        Item::Search => Screen::Search(super::search::Search::new(super::search::Scope::All, Box::new(Screen::Home(Home::default())))),
        Item::Settings => Screen::Settings(super::settings::Settings::default()),
    }
}

pub fn handle(app: &mut App, mut s: Home, k: KeyEvent) -> Screen {
    let list = items();
    if let KeyCode::Char(c) = k.code {
        if let Some(item) = list.iter().copied().find(|i| i.key() == c) {
            return open(app, item);
        }
    }
    match k.code {
        KeyCode::Enter => open(app, list[s.sel.index.min(list.len() - 1)]),
        KeyCode::Char('?') => {
            let mut h = vec![("d", text::HOME_DIARY), ("c", text::HOME_NOTEBOOKS), ("t", text::HOME_TASKS), ("o", text::HOME_GOALS), ("i", text::HOME_IMPULSE), ("r", text::HOME_REVIEW), ("p", text::HOME_REMINDERS), ("/", text::HOME_SEARCH), (",", text::HOME_SETTINGS), ("", "")];
            h.extend(super::global_help());
            app.help(text::HOME, h);
            Screen::Home(s)
        }
        KeyCode::Esc | KeyCode::Char('q') => {
            app.quit = true;
            Screen::Home(s)
        }
        _ => {
            s.sel.handle_key(k, list.len(), 4);
            Screen::Home(s)
        }
    }
}

pub fn render(s: &mut Home, frame: &mut Frame, area: Rect, ctx: &Ctx) {
    let theme = ctx.theme;
    let g = ctx.glyphs;
    let today = dates::today();
    let keys = [("d", text::HOME_DIARY), ("c", text::HOME_NOTEBOOKS), ("t", text::HOME_TASKS), ("o", text::HOME_GOALS), ("i", text::HOME_IMPULSE), ("r", text::HOME_REVIEW), ("?", text::HELP)];
    let body = widgets::chrome(frame, area, theme, g, text::APP_NAME, "", &keys).body;

    let mut y = body.y + 1;
    frame.render_widget(
        Paragraph::new(Span::styled(dates::fmt_date_long(today), theme.emphasis)),
        Rect { x: body.x + 1, y, width: body.width, height: 1 },
    );
    y += 2;

    let list = items();
    s.sel.clamp(list.len());
    let now = dates::now_ts();
    let (last_entry, nb_count, pending, due, goals_active, today_actions) = match ctx.db {
        Some(db) => (
            diary::last_entry_day(&db.conn).ok().flatten(),
            notebooks::list_notebooks(&db.conn, false).map(|v| v.len()).unwrap_or(0),
            crate::domain::tasks::count_pending(&db.conn, today).unwrap_or(0),
            crate::domain::reminders::due(&db.conn, now).unwrap_or_default(),
            crate::domain::goals::active_count(&db.conn).unwrap_or(0),
            crate::domain::actions::list_active(&db.conn)
                .unwrap_or_default()
                .into_iter()
                .filter(|a| a.schedule.planned_on(today))
                .map(|a| {
                    let st = crate::domain::actions::status_on(&db.conn, a.id, today).ok().flatten();
                    (a, st)
                })
                .collect::<Vec<_>>(),
        ),
        None => (None, 0, 0, vec![], 0, vec![]),
    };
    for (i, item) in list.iter().enumerate() {
        let selected = i == s.sel.index;
        let marker = if selected { g.cursor } else { " " };
        let style = if selected { theme.selected } else { theme.text };
        let detail: String = match item {
            Item::Diary => match &last_entry {
                Some(d) => match dates::parse_iso_date(d) {
                    Some(d) => format!("{}: {}", text::HOME_LAST_ENTRY, dates::fmt_relative_days(d, today)),
                    None => String::new(),
                },
                None => text::HOME_NO_ENTRIES.to_string(),
            },
            Item::Notebooks => {
                if nb_count == 0 {
                    String::new()
                } else {
                    format!("{nb_count}")
                }
            }
            Item::Tasks => {
                if pending == 0 {
                    String::new()
                } else {
                    format!("{pending} {}", text::HOME_PENDING_TASKS)
                }
            }
            Item::Goals => {
                if goals_active == 0 {
                    String::new()
                } else {
                    format!("{goals_active} {}", text::HOME_GOALS_ACTIVE)
                }
            }
            Item::Review => match ctx.db {
                Some(db) => {
                    let mut parts = vec![];
                    if super::review::weekly_line(db).is_some() {
                        parts.push(text::REVIEW_AVAILABLE.to_string());
                    }
                    let due_goals = crate::domain::goals::due_for_review(&db.conn, now).map(|v| v.len()).unwrap_or(0);
                    if due_goals > 0 {
                        parts.push(format!("{due_goals} {}", text::HOME_GOAL_REVIEW_AVAILABLE));
                    }
                    parts.join(g.dot_sep)
                }
                None => String::new(),
            },
            Item::Reminders => {
                if due.is_empty() {
                    String::new()
                } else {
                    format!("{} {}", due.len(), text::REMINDERS_DUE.to_lowercase())
                }
            }
            _ => String::new(),
        };
        let line = Line::from(vec![
            Span::styled(format!("{marker} "), theme.accent),
            Span::styled(format!("{}  ", item.key()), theme.accent),
            Span::styled(format!("{:<15}", item.label()), style),
            Span::styled(detail, theme.dim),
        ]);
        frame.render_widget(Paragraph::new(line), Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 });
        y += 1;
    }
    if last_entry.is_none() && nb_count == 0 && pending == 0 {
        y += 1;
        frame.render_widget(
            Paragraph::new(Span::styled(text::HOME_FIRST_RUN, theme.dim)),
            Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 },
        );
    }
    // «Hoy»: acciones previstas para hoy, con su estado (hueco ≠ fallo).
    if !today_actions.is_empty() && y + 2 < body.y + body.height {
        y += 1;
        frame.render_widget(Paragraph::new(Span::styled(text::HOME_TODAY, theme.title)), Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 });
        y += 1;
        for (a, st) in today_actions.iter().take(4) {
            if y >= body.y + body.height {
                break;
            }
            let (glyph, style) = match st {
                Some(true) => (g.done, theme.positive),
                Some(false) => (g.todo, theme.dim),
                None => (g.bullet, theme.dim),
            };
            let cue = if a.cue.is_empty() { String::new() } else { format!("{}{}", g.dot_sep, a.cue) };
            let line = Line::from(vec![
                Span::styled(format!("  {glyph} "), style),
                Span::styled(g.truncate(&format!("{}{cue}", a.name), (body.width as usize).saturating_sub(8)), theme.text),
            ]);
            frame.render_widget(Paragraph::new(line), Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 });
            y += 1;
        }
    }
    // Recordatorios vencidos: hasta tres, en texto neutro, y «y N más».
    if !due.is_empty() {
        y += 1;
        frame.render_widget(
            Paragraph::new(Span::styled(text::REMINDERS_DUE, theme.title)),
            Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 },
        );
        y += 1;
        for r in due.iter().take(3) {
            if y >= body.y + body.height {
                break;
            }
            let when = {
                let d = dates::ts_to_date(r.effective_at());
                if d == today { format!("hoy {}", dates::fmt_time(r.effective_at())) } else { dates::fmt_date_compact(d, today) }
            };
            let line = Line::from(vec![
                Span::styled(format!("  {when}  "), theme.warn),
                Span::styled(g.truncate(&r.title, (body.width as usize).saturating_sub(when.len() + 6)), theme.text),
            ]);
            frame.render_widget(Paragraph::new(line), Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 });
            y += 1;
        }
        if due.len() > 3 && y < body.y + body.height {
            frame.render_widget(
                Paragraph::new(Span::styled(format!("  y {} más (p)", due.len() - 3), theme.dim)),
                Rect { x: body.x + 1, y, width: body.width.saturating_sub(2), height: 1 },
            );
        }
    }
}
