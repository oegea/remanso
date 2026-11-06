//! Editor de texto multilínea con ajuste de línea por palabras, deshacer/rehacer
//! y resaltado ligero de Markdown. Sin dependencias externas: el widget de
//! terceros habitual no ajusta líneas largas, imprescindible para un diario.
//!
//! El modelo es `Vec<String>` (líneas lógicas, sin '\n'); el cursor se expresa
//! en (línea, índice de carácter). El ajuste visual se calcula al dibujar y en
//! los movimientos verticales, usando el ancho de la última pasada de dibujo.

use std::time::{Duration, Instant};

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::Style,
    text::{Line, Span},
    Frame,
};
use unicode_width::UnicodeWidthChar;

use super::Theme;

const UNDO_LIMIT: usize = 200;
const UNDO_GROUP_MS: u64 = 700;

#[derive(Clone, Debug, PartialEq, Eq)]
struct Snapshot {
    lines: Vec<String>,
    row: usize,
    col: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EditKind {
    Insert,
    Delete,
    Other,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Seg {
    pub start: usize,
    pub end: usize,
}

pub struct Editor {
    lines: Vec<String>,
    row: usize,
    col: usize,
    scroll: usize,
    width: usize,
    height: usize,
    preferred_vcol: Option<usize>,
    undo: Vec<Snapshot>,
    redo: Vec<Snapshot>,
    last_kind: Option<(EditKind, Instant)>,
    pub dirty: bool,
    pub last_edit: Option<Instant>,
    pub markdown: bool,
    pub read_only: bool,
}

impl Default for Editor {
    fn default() -> Self {
        Self::new()
    }
}

impl Editor {
    pub fn new() -> Self {
        Self {
            lines: vec![String::new()],
            row: 0,
            col: 0,
            scroll: 0,
            width: 80,
            height: 20,
            preferred_vcol: None,
            undo: vec![],
            redo: vec![],
            last_kind: None,
            dirty: false,
            last_edit: None,
            markdown: true,
            read_only: false,
        }
    }

    pub fn from_text(text: &str) -> Self {
        let mut e = Self::new();
        e.set_text(text);
        e
    }

    pub fn set_text(&mut self, text: &str) {
        self.lines = text.split('\n').map(|s| s.trim_end_matches('\r').to_string()).collect();
        if self.lines.is_empty() {
            self.lines.push(String::new());
        }
        self.row = 0;
        self.col = 0;
        self.scroll = 0;
        self.undo.clear();
        self.redo.clear();
        self.dirty = false;
        self.last_edit = None;
    }

    pub fn text(&self) -> String {
        self.lines.join("\n")
    }

    pub fn is_empty(&self) -> bool {
        self.lines.iter().all(|l| l.trim().is_empty())
    }

    pub fn word_count(&self) -> usize {
        self.lines.iter().map(|l| crate::domain::diary::word_count(l)).sum()
    }

    pub fn line_count(&self) -> usize {
        self.lines.len()
    }

    pub fn cursor(&self) -> (usize, usize) {
        (self.row, self.col)
    }

    /// Lleva el cursor al final del texto (al abrir una entrada existente).
    pub fn move_to_end(&mut self) {
        self.row = self.lines.len() - 1;
        self.col = self.lines[self.row].chars().count();
        self.preferred_vcol = None;
    }

    pub fn needs_autosave(&self, idle: Duration) -> bool {
        self.dirty && self.last_edit.map(|t| t.elapsed() >= idle).unwrap_or(false)
    }

    /// Instante en el que tocaría autoguardar, si hay cambios pendientes.
    pub fn autosave_deadline(&self, idle: Duration) -> Option<Instant> {
        if self.dirty {
            self.last_edit.map(|t| t + idle)
        } else {
            None
        }
    }

    pub fn mark_saved(&mut self) {
        self.dirty = false;
    }

    // ---- edición -----------------------------------------------------------

    fn snapshot(&self) -> Snapshot {
        Snapshot { lines: self.lines.clone(), row: self.row, col: self.col }
    }

    fn before_edit(&mut self, kind: EditKind) {
        let now = Instant::now();
        let group = matches!(self.last_kind, Some((k, t)) if k == kind && kind != EditKind::Other && now.duration_since(t) < Duration::from_millis(UNDO_GROUP_MS));
        if !group {
            self.undo.push(self.snapshot());
            if self.undo.len() > UNDO_LIMIT {
                self.undo.remove(0);
            }
            self.redo.clear();
        }
        self.last_kind = Some((kind, now));
        self.dirty = true;
        self.last_edit = Some(now);
        self.preferred_vcol = None;
    }

    fn byte_idx(line: &str, col: usize) -> usize {
        line.char_indices().nth(col).map(|(i, _)| i).unwrap_or(line.len())
    }

    pub fn insert_char(&mut self, c: char) {
        if self.read_only {
            return;
        }
        self.before_edit(EditKind::Insert);
        let line = &mut self.lines[self.row];
        let b = Self::byte_idx(line, self.col);
        line.insert(b, c);
        self.col += 1;
    }

    pub fn insert_str(&mut self, s: &str) {
        for c in s.chars() {
            if c == '\n' {
                self.newline();
            } else {
                self.insert_char(c);
            }
        }
    }

    pub fn newline(&mut self) {
        if self.read_only {
            return;
        }
        self.before_edit(EditKind::Other);
        let line = &mut self.lines[self.row];
        let b = Self::byte_idx(line, self.col);
        let rest = line.split_off(b);
        // Continuar listas: «- » y «* » se repiten en la línea nueva.
        let prefix = list_prefix(&self.lines[self.row]);
        self.lines.insert(self.row + 1, format!("{prefix}{rest}"));
        self.row += 1;
        self.col = prefix.chars().count();
    }

    pub fn backspace(&mut self) {
        if self.read_only {
            return;
        }
        if self.col > 0 {
            self.before_edit(EditKind::Delete);
            let line = &mut self.lines[self.row];
            let b = Self::byte_idx(line, self.col - 1);
            line.remove(b);
            self.col -= 1;
        } else if self.row > 0 {
            self.before_edit(EditKind::Other);
            let cur = self.lines.remove(self.row);
            self.row -= 1;
            self.col = self.lines[self.row].chars().count();
            self.lines[self.row].push_str(&cur);
        }
    }

    pub fn delete_forward(&mut self) {
        if self.read_only {
            return;
        }
        let len = self.lines[self.row].chars().count();
        if self.col < len {
            self.before_edit(EditKind::Delete);
            let line = &mut self.lines[self.row];
            let b = Self::byte_idx(line, self.col);
            line.remove(b);
        } else if self.row + 1 < self.lines.len() {
            self.before_edit(EditKind::Other);
            let next = self.lines.remove(self.row + 1);
            self.lines[self.row].push_str(&next);
        }
    }

    pub fn undo(&mut self) {
        if let Some(s) = self.undo.pop() {
            self.redo.push(self.snapshot());
            self.apply(s);
        }
    }

    pub fn redo(&mut self) {
        if let Some(s) = self.redo.pop() {
            self.undo.push(self.snapshot());
            self.apply(s);
        }
    }

    fn apply(&mut self, s: Snapshot) {
        self.lines = s.lines;
        self.row = s.row.min(self.lines.len() - 1);
        self.col = s.col.min(self.lines[self.row].chars().count());
        self.dirty = true;
        self.last_edit = Some(Instant::now());
        self.last_kind = None;
    }

    // ---- movimiento --------------------------------------------------------

    pub fn move_left(&mut self) {
        self.preferred_vcol = None;
        if self.col > 0 {
            self.col -= 1;
        } else if self.row > 0 {
            self.row -= 1;
            self.col = self.lines[self.row].chars().count();
        }
    }

    pub fn move_right(&mut self) {
        self.preferred_vcol = None;
        if self.col < self.lines[self.row].chars().count() {
            self.col += 1;
        } else if self.row + 1 < self.lines.len() {
            self.row += 1;
            self.col = 0;
        }
    }

    pub fn move_word_left(&mut self) {
        self.preferred_vcol = None;
        if self.col == 0 {
            self.move_left();
            return;
        }
        let chars: Vec<char> = self.lines[self.row].chars().collect();
        let mut c = self.col;
        while c > 0 && !chars[c - 1].is_alphanumeric() {
            c -= 1;
        }
        while c > 0 && chars[c - 1].is_alphanumeric() {
            c -= 1;
        }
        self.col = c;
    }

    pub fn move_word_right(&mut self) {
        self.preferred_vcol = None;
        let chars: Vec<char> = self.lines[self.row].chars().collect();
        if self.col >= chars.len() {
            self.move_right();
            return;
        }
        let mut c = self.col;
        while c < chars.len() && chars[c].is_alphanumeric() {
            c += 1;
        }
        while c < chars.len() && !chars[c].is_alphanumeric() {
            c += 1;
        }
        self.col = c;
    }

    pub fn home(&mut self) {
        self.preferred_vcol = None;
        let segs = self.segs(self.row);
        let (i, _) = self.visual_in_line(&segs, self.col);
        self.col = segs[i].start;
    }

    pub fn end(&mut self) {
        self.preferred_vcol = None;
        let segs = self.segs(self.row);
        let (i, _) = self.visual_in_line(&segs, self.col);
        self.col = if i + 1 == segs.len() { segs[i].end } else { segs[i].end.saturating_sub(1).max(segs[i].start) };
    }

    pub fn doc_start(&mut self) {
        self.row = 0;
        self.col = 0;
        self.preferred_vcol = None;
    }

    pub fn doc_end(&mut self) {
        self.move_to_end();
    }

    pub fn move_up(&mut self) {
        self.move_vertical(-1);
    }

    pub fn move_down(&mut self) {
        self.move_vertical(1);
    }

    pub fn page_up(&mut self) {
        for _ in 0..self.height.max(1) {
            self.move_vertical(-1);
        }
    }

    pub fn page_down(&mut self) {
        for _ in 0..self.height.max(1) {
            self.move_vertical(1);
        }
    }

    fn move_vertical(&mut self, dir: i32) {
        let segs = self.segs(self.row);
        let (i, vcol) = self.visual_in_line(&segs, self.col);
        let want = self.preferred_vcol.unwrap_or(vcol);
        self.preferred_vcol = Some(want);
        let (target_row, target_seg) = if dir < 0 {
            if i > 0 {
                (self.row, i - 1)
            } else if self.row > 0 {
                let r = self.row - 1;
                let n = self.segs(r).len();
                (r, n - 1)
            } else {
                return;
            }
        } else if i + 1 < segs.len() {
            (self.row, i + 1)
        } else if self.row + 1 < self.lines.len() {
            (self.row + 1, 0)
        } else {
            return;
        };
        let tsegs = self.segs(target_row);
        let seg = tsegs[target_seg];
        let last = target_seg + 1 == tsegs.len();
        self.row = target_row;
        self.col = self.col_at_vcol(target_row, seg, want, last);
    }

    fn col_at_vcol(&self, row: usize, seg: Seg, want: usize, last_seg: bool) -> usize {
        let mut w = 0;
        let mut col = seg.start;
        for c in self.lines[row].chars().skip(seg.start).take(seg.end - seg.start) {
            let cw = c.width().unwrap_or(0);
            if w + cw > want {
                return col;
            }
            w += cw;
            col += 1;
        }
        if !last_seg && col == seg.end && col > seg.start {
            col - 1
        } else {
            col
        }
    }

    // ---- ajuste de línea ---------------------------------------------------

    pub fn segs(&self, row: usize) -> Vec<Seg> {
        wrap_line(&self.lines[row], self.width.max(1))
    }

    /// (índice de segmento, columna visual) del cursor dentro de su línea.
    fn visual_in_line(&self, segs: &[Seg], col: usize) -> (usize, usize) {
        let i = segs.iter().position(|s| col < s.end).unwrap_or(segs.len() - 1);
        let seg = segs[i];
        let vcol: usize =
            self.lines[self.row].chars().skip(seg.start).take(col.saturating_sub(seg.start)).map(|c| c.width().unwrap_or(0)).sum();
        (i, vcol)
    }

    fn visual_in_row(&self, row: usize, segs: &[Seg], col: usize) -> (usize, usize) {
        let i = segs.iter().position(|s| col < s.end).unwrap_or(segs.len() - 1);
        let seg = segs[i];
        let vcol: usize =
            self.lines[row].chars().skip(seg.start).take(col.saturating_sub(seg.start)).map(|c| c.width().unwrap_or(0)).sum();
        (i, vcol)
    }

    // ---- teclado -----------------------------------------------------------

    /// Devuelve `true` si la tecla fue consumida.
    pub fn handle_key(&mut self, k: KeyEvent) -> bool {
        let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
        match (k.code, ctrl) {
            (KeyCode::Char('z'), true) => self.undo(),
            (KeyCode::Char('y'), true) => self.redo(),
            (KeyCode::Char('Z'), true) => self.redo(),
            (KeyCode::Left, true) => self.move_word_left(),
            (KeyCode::Right, true) => self.move_word_right(),
            (KeyCode::Home, true) => self.doc_start(),
            (KeyCode::End, true) => self.doc_end(),
            (KeyCode::Char('a'), true) => self.home(),
            (KeyCode::Char('e'), true) => self.end(),
            (KeyCode::Char(c), false) => self.insert_char(c),
            (KeyCode::Char(_), true) => return false,
            (KeyCode::Enter, _) => self.newline(),
            (KeyCode::Tab, _) => self.insert_str("  "),
            (KeyCode::Backspace, _) => self.backspace(),
            (KeyCode::Delete, _) => self.delete_forward(),
            (KeyCode::Left, _) => self.move_left(),
            (KeyCode::Right, _) => self.move_right(),
            (KeyCode::Up, _) => self.move_up(),
            (KeyCode::Down, _) => self.move_down(),
            (KeyCode::Home, _) => self.home(),
            (KeyCode::End, _) => self.end(),
            (KeyCode::PageUp, _) => self.page_up(),
            (KeyCode::PageDown, _) => self.page_down(),
            _ => return false,
        }
        true
    }

    // ---- dibujo ------------------------------------------------------------

    pub fn render(&mut self, frame: &mut Frame, area: Rect, theme: &Theme, focused: bool) {
        self.width = area.width as usize;
        self.height = area.height as usize;
        if self.width == 0 || self.height == 0 {
            return;
        }
        // Fila visual del cursor y total de filas.
        let mut cursor_vrow = 0usize;
        let mut rows_before = 0usize;
        let mut cursor_vcol = 0usize;
        let mut all: Vec<(usize, Seg)> = Vec::new();
        for r in 0..self.lines.len() {
            let segs = self.segs(r);
            if r == self.row {
                let (i, vcol) = self.visual_in_row(r, &segs, self.col);
                cursor_vrow = rows_before + i;
                cursor_vcol = vcol;
            }
            rows_before += segs.len();
            for s in segs {
                all.push((r, s));
            }
        }
        if cursor_vrow < self.scroll {
            self.scroll = cursor_vrow;
        } else if cursor_vrow >= self.scroll + self.height {
            self.scroll = cursor_vrow + 1 - self.height;
        }
        if self.scroll > all.len().saturating_sub(1) {
            self.scroll = all.len().saturating_sub(1);
        }

        let buf = frame.buffer_mut();
        for (vi, (r, seg)) in all.iter().enumerate().skip(self.scroll).take(self.height) {
            let y = area.y + (vi - self.scroll) as u16;
            let line = &self.lines[*r];
            let text: String = line.chars().skip(seg.start).take(seg.end - seg.start).collect();
            let style = self.line_style(line, theme);
            let spans = if self.markdown && seg.start == 0 {
                markdown_spans(&text, style, theme)
            } else {
                vec![Span::styled(text, style)]
            };
            render_spans(buf, area.x, y, area.width, Line::from(spans));
        }
        if focused {
            let cx = area.x + cursor_vcol.min(self.width.saturating_sub(1)) as u16;
            let cy = area.y + (cursor_vrow - self.scroll) as u16;
            frame.set_cursor_position((cx, cy));
        }
    }

    fn line_style(&self, line: &str, theme: &Theme) -> Style {
        if !self.markdown {
            return theme.text;
        }
        let t = line.trim_start();
        if t.starts_with('#') {
            theme.md_heading
        } else if t.starts_with("> ") || t == ">" {
            theme.md_quote
        } else {
            theme.text
        }
    }

    pub fn scroll_info(&self) -> (usize, usize) {
        (self.row + 1, self.lines.len())
    }
}

fn render_spans(buf: &mut Buffer, x: u16, y: u16, width: u16, line: Line) {
    let mut cx = x;
    let end = x + width;
    for span in line.spans {
        for c in span.content.chars() {
            let w = c.width().unwrap_or(0) as u16;
            if w == 0 {
                continue;
            }
            if cx + w > end {
                return;
            }
            buf[(cx, y)].set_char(c).set_style(span.style);
            cx += w;
        }
    }
}

/// Resalta marcadores de lista y énfasis `*…*`/`_…_` sin alterar el texto.
fn markdown_spans(text: &str, base: Style, theme: &Theme) -> Vec<Span<'static>> {
    let trimmed = text.trim_start();
    let indent = text.len() - trimmed.len();
    for marker in ["- ", "* ", "+ ", "- [ ] ", "- [x] "] {
        if trimmed.starts_with(marker) {
            let m = &text[..indent + marker.len()];
            return vec![Span::styled(m.to_string(), theme.md_marker), Span::styled(text[indent + marker.len()..].to_string(), base)];
        }
    }
    if let Some(pos) = trimmed.find(". ") {
        if pos > 0 && pos <= 3 && trimmed[..pos].chars().all(|c| c.is_ascii_digit()) {
            let m = &text[..indent + pos + 2];
            return vec![Span::styled(m.to_string(), theme.md_marker), Span::styled(text[indent + pos + 2..].to_string(), base)];
        }
    }
    vec![Span::styled(text.to_string(), base)]
}

fn list_prefix(line: &str) -> String {
    let t = line.trim_start();
    let indent: String = line.chars().take(line.len() - t.len()).collect();
    for m in ["- [ ] ", "- [x] ", "- ", "* ", "+ "] {
        if t.starts_with(m) && t.len() > m.len() {
            let m = if m == "- [x] " { "- [ ] " } else { m };
            return format!("{indent}{m}");
        }
    }
    String::new()
}

/// Ajuste por palabras. Devuelve segmentos [start, end) en índices de carácter.
/// Un espacio en el punto de corte se consume (no se muestra ni cuenta).
pub fn wrap_line(line: &str, width: usize) -> Vec<Seg> {
    let chars: Vec<(char, usize)> = line.chars().map(|c| (c, c.width().unwrap_or(0))).collect();
    if chars.is_empty() {
        return vec![Seg { start: 0, end: 0 }];
    }
    let mut segs = vec![];
    let mut start = 0;
    let mut w = 0;
    let mut last_space: Option<usize> = None;
    let mut i = 0;
    while i < chars.len() {
        let (c, cw) = chars[i];
        if c == ' ' && w + cw > width {
            // El espacio no cabe: cerramos aquí y lo consumimos.
            segs.push(Seg { start, end: i + 1 });
            start = i + 1;
            w = 0;
            last_space = None;
            i += 1;
            continue;
        }
        if w + cw > width {
            if let Some(sp) = last_space {
                segs.push(Seg { start, end: sp + 1 });
                start = sp + 1;
                i = start;
            } else {
                segs.push(Seg { start, end: i });
                start = i;
            }
            w = 0;
            last_space = None;
            continue;
        }
        if c == ' ' {
            last_space = Some(i);
        }
        w += cw;
        i += 1;
    }
    segs.push(Seg { start, end: chars.len() });
    segs
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg_texts(line: &str, width: usize) -> Vec<String> {
        wrap_line(line, width)
            .into_iter()
            .map(|s| line.chars().skip(s.start).take(s.end - s.start).collect::<String>())
            .collect()
    }

    #[test]
    fn wraps_on_words() {
        assert_eq!(seg_texts("hola mundo cruel", 10), vec!["hola mundo ", "cruel"]);
        assert_eq!(seg_texts("hola mundos cruel", 10), vec!["hola ", "mundos ", "cruel"]);
        assert_eq!(seg_texts("hola mundo", 10), vec!["hola mundo"]);
        assert_eq!(seg_texts("hola mundo ", 10), vec!["hola mundo ", ""]);
        assert_eq!(seg_texts("", 10), vec![""]);
    }

    #[test]
    fn hard_breaks_long_words() {
        assert_eq!(seg_texts("abcdefghijkl", 5), vec!["abcde", "fghij", "kl"]);
    }

    #[test]
    fn wide_chars_count_double() {
        assert_eq!(seg_texts("日本語テキスト", 6), vec!["日本語", "テキス", "ト"]);
    }

    #[test]
    fn typing_and_undo() {
        let mut e = Editor::new();
        e.insert_str("Hola\nmundo");
        assert_eq!(e.text(), "Hola\nmundo");
        assert_eq!(e.cursor(), (1, 5));
        e.backspace();
        assert_eq!(e.text(), "Hola\nmund");
        e.undo();
        assert_eq!(e.text(), "Hola\nmundo");
        e.redo();
        assert_eq!(e.text(), "Hola\nmund");
        assert!(e.dirty);
        e.doc_start();
        e.delete_forward();
        assert_eq!(e.text(), "ola\nmund");
        e.end();
        e.delete_forward();
        assert_eq!(e.text(), "olamund");
    }

    #[test]
    fn list_continuation() {
        let mut e = Editor::new();
        e.insert_str("- uno");
        e.newline();
        assert_eq!(e.text(), "- uno\n- ");
        e.insert_str("dos");
        // Línea sólo con marcador no propaga.
        let mut e2 = Editor::new();
        e2.insert_str("- ");
        e2.newline();
        assert_eq!(e2.text(), "- \n");
    }

    #[test]
    fn vertical_movement_through_wrapped_lines() {
        let mut e = Editor::new();
        e.width = 10;
        e.insert_str("hola mundo cruel\nxy");
        // Filas visuales: «hola mundo » (0..11) y «cruel» (11..16); cursor en (1,2).
        e.move_up();
        assert_eq!(e.cursor(), (0, 13)); // «cruel», col visual 2
        e.move_up();
        assert_eq!(e.cursor(), (0, 2));
        e.move_up();
        assert_eq!(e.cursor(), (0, 2));
        e.move_down();
        assert_eq!(e.cursor(), (0, 13));
        e.move_down();
        assert_eq!(e.cursor(), (1, 2));
    }

    #[test]
    fn word_movement() {
        let mut e = Editor::from_text("uno, dos tres");
        e.move_word_right();
        assert_eq!(e.cursor(), (0, 5));
        e.move_word_right();
        assert_eq!(e.cursor(), (0, 9));
        e.move_word_left();
        assert_eq!(e.cursor(), (0, 5));
    }

    #[test]
    fn utf8_editing() {
        let mut e = Editor::new();
        e.insert_str("añ日");
        e.move_left();
        e.backspace();
        assert_eq!(e.text(), "a日");
        assert_eq!(e.word_count(), 1);
    }

    #[test]
    fn read_only_blocks_edits() {
        let mut e = Editor::from_text("x");
        e.read_only = true;
        e.insert_char('y');
        e.backspace();
        assert_eq!(e.text(), "x");
        assert!(!e.dirty);
    }
}
