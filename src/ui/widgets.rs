//! Widgets pequeños y reutilizables: cabecera/pie, entrada de una línea,
//! selector de lista, diálogos de confirmación y ayuda.

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    layout::{Alignment, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};
use unicode_width::UnicodeWidthStr;

use super::{Glyphs, Theme};

/// Marco común de todas las pantallas: línea de título, regla, contenido, regla, pie.
pub struct Chrome {
    pub body: Rect,
}

pub fn chrome(frame: &mut Frame, area: Rect, theme: &Theme, g: &Glyphs, title: &str, right: &str, keys: &[(&str, &str)]) -> Chrome {
    if area.height < 5 {
        return Chrome { body: area };
    }
    let w = area.width as usize;
    // Cabecera
    let t = format!(" {title}");
    let r = format!("{right} ");
    let pad = w.saturating_sub(t.width() + r.width());
    let header = Line::from(vec![
        Span::styled(t, theme.title),
        Span::raw(" ".repeat(pad)),
        Span::styled(r, theme.dim),
    ]);
    frame.render_widget(Paragraph::new(header), Rect { x: area.x, y: area.y, width: area.width, height: 1 });
    rule(frame, Rect { x: area.x, y: area.y + 1, width: area.width, height: 1 }, theme, g);
    // Pie
    rule(frame, Rect { x: area.x, y: area.y + area.height - 2, width: area.width, height: 1 }, theme, g);
    footer(frame, Rect { x: area.x, y: area.y + area.height - 1, width: area.width, height: 1 }, theme, keys);
    Chrome {
        body: Rect { x: area.x + 1, y: area.y + 2, width: area.width.saturating_sub(2), height: area.height - 4 },
    }
}

pub fn rule(frame: &mut Frame, area: Rect, theme: &Theme, g: &Glyphs) {
    let s = g.rule.repeat(area.width as usize);
    frame.render_widget(Paragraph::new(Span::styled(s, theme.rule)), area);
}

pub fn footer(frame: &mut Frame, area: Rect, theme: &Theme, keys: &[(&str, &str)]) {
    let mut spans = vec![Span::raw(" ")];
    let mut used = 1usize;
    for (i, (k, label)) in keys.iter().enumerate() {
        let piece = k.width() + 1 + label.width() + if i > 0 { 2 } else { 0 };
        if used + piece > area.width as usize {
            break;
        }
        if i > 0 {
            spans.push(Span::raw("  "));
        }
        spans.push(Span::styled(k.to_string(), theme.accent));
        spans.push(Span::raw(" "));
        spans.push(Span::styled(label.to_string(), theme.dim));
        used += piece;
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), area);
}

/// Mensaje de estado en la línea del pie (sustituye a las teclas un instante).
pub fn status(frame: &mut Frame, area: Rect, theme: &Theme, msg: &str, is_error: bool) {
    let y = area.y + area.height - 1;
    let style = if is_error { theme.alert } else { theme.dim };
    frame.render_widget(
        Paragraph::new(Span::styled(format!(" {msg}"), style)),
        Rect { x: area.x, y, width: area.width, height: 1 },
    );
}

/// Texto vacío centrado verticalmente (estados vacíos).
pub fn empty_state(frame: &mut Frame, area: Rect, theme: &Theme, lines: &[&str]) {
    let h = lines.len() as u16;
    let y = area.y + area.height.saturating_sub(h) / 3;
    let text: Vec<Line> = lines.iter().map(|l| Line::from(Span::styled(l.to_string(), theme.dim))).collect();
    frame.render_widget(
        Paragraph::new(text).alignment(Alignment::Left),
        Rect { x: area.x + 1, y, width: area.width.saturating_sub(2), height: h.min(area.height) },
    );
}

/// Filas que ocupa un texto ajustado a `width` (misma lógica que el editor).
pub fn line_count(text: &str, width: u16) -> u16 {
    let w = (width as usize).max(1);
    text.split('\n').map(|l| super::editor::wrap_line(l, w).len()).sum::<usize>().max(1) as u16
}

// ---- entrada de una línea ---------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct LineInput {
    pub value: String,
    pub cursor: usize, // índice de carácter
    pub secret: bool,
}

/// Los campos de contraseña se borran de memoria al destruirse.
impl Drop for LineInput {
    fn drop(&mut self) {
        if self.secret {
            use zeroize::Zeroize;
            self.value.zeroize();
        }
    }
}

impl LineInput {
    pub fn new(initial: &str) -> Self {
        Self { value: initial.to_string(), cursor: initial.chars().count(), secret: false }
    }

    pub fn secret() -> Self {
        Self { value: String::new(), cursor: 0, secret: true }
    }

    pub fn clear(&mut self) {
        self.value.clear();
        self.cursor = 0;
    }

    fn byte(&self, col: usize) -> usize {
        self.value.char_indices().nth(col).map(|(i, _)| i).unwrap_or(self.value.len())
    }

    pub fn handle_key(&mut self, k: KeyEvent) -> bool {
        let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
        match k.code {
            KeyCode::Char('u') if ctrl => self.clear(),
            KeyCode::Char('a') if ctrl => self.cursor = 0,
            KeyCode::Char('e') if ctrl => self.cursor = self.value.chars().count(),
            KeyCode::Char('w') if ctrl => {
                let chars: Vec<char> = self.value.chars().collect();
                let mut c = self.cursor;
                while c > 0 && chars[c - 1] == ' ' {
                    c -= 1;
                }
                while c > 0 && chars[c - 1] != ' ' {
                    c -= 1;
                }
                let (b0, b1) = (self.byte(c), self.byte(self.cursor));
                self.value.replace_range(b0..b1, "");
                self.cursor = c;
            }
            KeyCode::Char(c) if !ctrl => {
                let b = self.byte(self.cursor);
                self.value.insert(b, c);
                self.cursor += 1;
            }
            KeyCode::Backspace => {
                if self.cursor > 0 {
                    let b = self.byte(self.cursor - 1);
                    self.value.remove(b);
                    self.cursor -= 1;
                }
            }
            KeyCode::Delete => {
                if self.cursor < self.value.chars().count() {
                    let b = self.byte(self.cursor);
                    self.value.remove(b);
                }
            }
            KeyCode::Left => self.cursor = self.cursor.saturating_sub(1),
            KeyCode::Right => self.cursor = (self.cursor + 1).min(self.value.chars().count()),
            KeyCode::Home => self.cursor = 0,
            KeyCode::End => self.cursor = self.value.chars().count(),
            _ => return false,
        }
        true
    }

    /// Dibuja «etiqueta: valor» y coloca el cursor.
    pub fn render(&self, frame: &mut Frame, area: Rect, theme: &Theme, label: &str, focused: bool, feedback: bool) {
        let shown: String = if self.secret {
            if feedback {
                "*".repeat(self.value.chars().count())
            } else {
                String::new()
            }
        } else {
            self.value.clone()
        };
        let label_w = label.width();
        let avail = (area.width as usize).saturating_sub(label_w + 1);
        // Desplazamiento horizontal si el valor no cabe.
        let cur = if self.secret && !feedback { 0 } else { self.cursor };
        let chars: Vec<char> = shown.chars().collect();
        let start = cur.saturating_sub(avail.saturating_sub(1));
        let visible: String = chars.iter().skip(start).take(avail).collect();
        let line = Line::from(vec![Span::styled(label.to_string(), theme.dim), Span::raw(" "), Span::styled(visible, theme.input)]);
        frame.render_widget(Paragraph::new(line), area);
        if focused {
            let cx = area.x + (label_w + 1 + (cur - start)) as u16;
            frame.set_cursor_position((cx.min(area.x + area.width.saturating_sub(1)), area.y));
        }
    }
}

// ---- selector de lista ------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct Selector {
    pub index: usize,
    pub offset: usize,
}

impl Selector {
    pub fn clamp(&mut self, len: usize) {
        if len == 0 {
            self.index = 0;
            self.offset = 0;
        } else if self.index >= len {
            self.index = len - 1;
        }
    }

    pub fn move_by(&mut self, delta: i64, len: usize) {
        if len == 0 {
            return;
        }
        let i = (self.index as i64 + delta).clamp(0, len as i64 - 1);
        self.index = i as usize;
    }

    pub fn first(&mut self) {
        self.index = 0;
    }

    pub fn last(&mut self, len: usize) {
        self.index = len.saturating_sub(1);
    }

    /// Ajusta el desplazamiento para que el seleccionado sea visible y devuelve
    /// el rango de índices a dibujar.
    pub fn visible(&mut self, len: usize, height: usize) -> std::ops::Range<usize> {
        if height == 0 || len == 0 {
            return 0..0;
        }
        if self.index < self.offset {
            self.offset = self.index;
        } else if self.index >= self.offset + height {
            self.offset = self.index + 1 - height;
        }
        if self.offset + height > len {
            self.offset = len.saturating_sub(height);
        }
        self.offset..(self.offset + height).min(len)
    }

    /// Navegación estándar de listas. Devuelve `true` si consumió la tecla.
    pub fn handle_key(&mut self, k: KeyEvent, len: usize, page: usize) -> bool {
        match k.code {
            KeyCode::Down | KeyCode::Char('j') => self.move_by(1, len),
            KeyCode::Up | KeyCode::Char('k') => self.move_by(-1, len),
            KeyCode::PageDown => self.move_by(page as i64, len),
            KeyCode::PageUp => self.move_by(-(page as i64), len),
            KeyCode::Home | KeyCode::Char('g') => self.first(),
            KeyCode::End | KeyCode::Char('G') => self.last(len),
            _ => return false,
        }
        true
    }
}

// ---- diálogos ---------------------------------------------------------------

/// Caja centrada con borde redondeado (o ASCII) y texto.
pub fn dialog(frame: &mut Frame, area: Rect, theme: &Theme, g: &Glyphs, title: &str, lines: Vec<Line>, keys: &[(&str, &str)]) -> Rect {
    let width = (area.width.saturating_sub(4)).min(60).max(20);
    let text_h = lines.len() as u16;
    let height = (text_h + 4).min(area.height);
    let x = area.x + (area.width - width) / 2;
    let y = area.y + (area.height.saturating_sub(height)) / 2;
    let rect = Rect { x, y, width, height };
    frame.render_widget(Clear, rect);
    let border = if g.ascii { ratatui::widgets::BorderType::Plain } else { ratatui::widgets::BorderType::Rounded };
    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(border)
        .border_style(theme.rule)
        .title(Span::styled(format!(" {title} "), theme.title));
    frame.render_widget(block, rect);
    let inner = Rect { x: x + 2, y: y + 1, width: width.saturating_sub(4), height: height.saturating_sub(3) };
    frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), inner);
    footer(frame, Rect { x: x + 1, y: y + height - 2, width: width - 2, height: 1 }, theme, keys);
    inner
}

pub fn confirm_dialog(frame: &mut Frame, area: Rect, theme: &Theme, g: &Glyphs, message: &str, destructive: bool) {
    let style = if destructive { theme.alert } else { theme.text };
    dialog(
        frame,
        area,
        theme,
        g,
        if destructive { "Confirmar" } else { "Pregunta" },
        vec![Line::from(Span::styled(message.to_string(), style))],
        &[("s", "sí"), ("n", "no"), ("Esc", "cancelar")],
    );
}

pub fn help_dialog(frame: &mut Frame, area: Rect, theme: &Theme, g: &Glyphs, title: &str, entries: &[(&str, &str)]) {
    let lines: Vec<Line> = entries
        .iter()
        .map(|(k, d)| {
            if k.is_empty() {
                Line::from(Span::styled(d.to_string(), theme.dim))
            } else {
                Line::from(vec![Span::styled(format!("{k:<12}"), theme.accent), Span::raw(d.to_string())])
            }
        })
        .collect();
    dialog(frame, area, theme, g, title, lines, &[("Esc", "cerrar")]);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(c: KeyCode) -> KeyEvent {
        KeyEvent::new(c, KeyModifiers::NONE)
    }

    #[test]
    fn line_input_edits_utf8() {
        let mut i = LineInput::new("");
        for c in "añ日".chars() {
            i.handle_key(key(KeyCode::Char(c)));
        }
        i.handle_key(key(KeyCode::Left));
        i.handle_key(key(KeyCode::Backspace));
        assert_eq!(i.value, "a日");
        i.handle_key(KeyEvent::new(KeyCode::Char('w'), KeyModifiers::CONTROL));
        assert_eq!(i.value, "日");
    }

    #[test]
    fn selector_keeps_selection_visible() {
        let mut s = Selector::default();
        s.move_by(25, 30);
        assert_eq!(s.index, 25);
        let r = s.visible(30, 10);
        assert!(r.contains(&25));
        assert_eq!(r.len(), 10);
        s.move_by(-25, 30);
        assert_eq!(s.visible(30, 10), 0..10);
        s.clamp(0);
        assert_eq!(s.index, 0);
    }
}
