//! Juego de caracteres con alternativa ASCII para consolas sin Unicode.

#[derive(Debug, Clone, Copy)]
pub struct Glyphs {
    pub ascii: bool,
    pub rule: &'static str,
    pub done: &'static str,
    pub todo: &'static str,
    pub partial: &'static str,
    pub bullet: &'static str,
    pub cursor: &'static str,
    pub ellipsis: &'static str,
    pub bar_full: &'static str,
    pub bar_empty: &'static str,
    pub arrow_up: &'static str,
    pub arrow_down: &'static str,
    pub arrow_flat: &'static str,
    pub dot_sep: &'static str,
    pub pin: &'static str,
    pub spark: &'static [&'static str],
    pub check: &'static str,
}

impl Glyphs {
    pub fn unicode() -> Self {
        Self {
            ascii: false,
            rule: "─",
            done: "●",
            todo: "○",
            partial: "◐",
            bullet: "·",
            cursor: "▍",
            ellipsis: "…",
            bar_full: "█",
            bar_empty: "░",
            arrow_up: "↑",
            arrow_down: "↓",
            arrow_flat: "→",
            dot_sep: " · ",
            pin: "▲",
            spark: &["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"],
            check: "✓",
        }
    }

    pub fn ascii() -> Self {
        Self {
            ascii: true,
            rule: "-",
            done: "*",
            todo: "o",
            partial: "+",
            bullet: "-",
            cursor: ">",
            ellipsis: "...",
            bar_full: "#",
            bar_empty: "-",
            arrow_up: "^",
            arrow_down: "v",
            arrow_flat: "=",
            dot_sep: " | ",
            pin: "^",
            spark: &[".", ":", "-", "=", "+", "*", "%", "#"],
            check: "x",
        }
    }

    pub fn pick(ascii: bool) -> Self {
        if ascii {
            Self::ascii()
        } else {
            Self::unicode()
        }
    }

    /// Detecta consolas que probablemente no dibujan Unicode (TTY Linux sin UTF-8).
    pub fn detect_ascii_env() -> bool {
        let lang = std::env::var("LANG").unwrap_or_default().to_lowercase();
        let lc = std::env::var("LC_ALL").unwrap_or_default().to_lowercase();
        let utf8 = lang.contains("utf") || lc.contains("utf");
        !utf8
    }

    /// Recorta `s` a `width` celdas añadiendo la elipsis si es necesario.
    pub fn truncate(&self, s: &str, width: usize) -> String {
        use unicode_width::UnicodeWidthChar;
        let total: usize = s.chars().map(|c| c.width().unwrap_or(0)).sum();
        if total <= width {
            return s.to_string();
        }
        let ell_w = self.ellipsis.chars().count();
        if width <= ell_w {
            return self.ellipsis.chars().take(width).collect();
        }
        let mut out = String::new();
        let mut w = 0;
        for c in s.chars() {
            let cw = c.width().unwrap_or(0);
            if w + cw > width - ell_w {
                break;
            }
            out.push(c);
            w += cw;
        }
        out.push_str(self.ellipsis);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncation_respects_width() {
        let g = Glyphs::unicode();
        assert_eq!(g.truncate("hola", 10), "hola");
        assert_eq!(g.truncate("hola mundo cruel", 8), "hola mu…");
        let a = Glyphs::ascii();
        assert_eq!(a.truncate("hola mundo cruel", 8), "hola ...");
    }
}
