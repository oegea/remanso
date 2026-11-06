//! Paleta semántica sobre los 16 colores ANSI. Funciona en la consola Linux.

use ratatui::style::{Color, Modifier, Style};

#[derive(Debug, Clone, Copy)]
pub struct Theme {
    pub text: Style,
    pub dim: Style,
    pub accent: Style,
    pub title: Style,
    pub emphasis: Style,
    pub warn: Style,
    pub alert: Style,
    pub positive: Style,
    pub selected: Style,
    pub input: Style,
    pub rule: Style,
    pub md_heading: Style,
    pub md_marker: Style,
    pub md_quote: Style,
    pub bar_fill: Style,
    pub bar_empty: Style,
}

impl Theme {
    pub fn from_prefs(t: crate::prefs::Theme) -> Self {
        match t {
            crate::prefs::Theme::Dark => Self::dark(),
            crate::prefs::Theme::Light => Self::light(),
        }
    }

    pub fn dark() -> Self {
        let accent = Color::Cyan;
        Self {
            text: Style::default(),
            dim: Style::default().fg(Color::DarkGray),
            accent: Style::default().fg(accent),
            title: Style::default().fg(accent).add_modifier(Modifier::BOLD),
            emphasis: Style::default().add_modifier(Modifier::BOLD),
            warn: Style::default().fg(Color::Yellow),
            alert: Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
            positive: Style::default().fg(Color::Green),
            selected: Style::default().fg(accent).add_modifier(Modifier::BOLD),
            input: Style::default().add_modifier(Modifier::UNDERLINED),
            rule: Style::default().fg(Color::DarkGray),
            md_heading: Style::default().fg(accent).add_modifier(Modifier::BOLD),
            md_marker: Style::default().fg(Color::DarkGray),
            md_quote: Style::default().fg(Color::DarkGray).add_modifier(Modifier::ITALIC),
            bar_fill: Style::default().fg(accent),
            bar_empty: Style::default().fg(Color::DarkGray),
        }
    }

    pub fn light() -> Self {
        let accent = Color::Blue;
        Self {
            text: Style::default(),
            dim: Style::default().fg(Color::Gray),
            accent: Style::default().fg(accent),
            title: Style::default().fg(accent).add_modifier(Modifier::BOLD),
            emphasis: Style::default().add_modifier(Modifier::BOLD),
            warn: Style::default().fg(Color::Yellow),
            alert: Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
            positive: Style::default().fg(Color::Green),
            selected: Style::default().fg(accent).add_modifier(Modifier::BOLD),
            input: Style::default().add_modifier(Modifier::UNDERLINED),
            rule: Style::default().fg(Color::Gray),
            md_heading: Style::default().fg(accent).add_modifier(Modifier::BOLD),
            md_marker: Style::default().fg(Color::Gray),
            md_quote: Style::default().fg(Color::Gray).add_modifier(Modifier::ITALIC),
            bar_fill: Style::default().fg(accent),
            bar_empty: Style::default().fg(Color::Gray),
        }
    }
}
