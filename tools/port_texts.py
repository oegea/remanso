#!/usr/bin/env python3
"""Regenera web/src/text/texts.ts a partir de src/text.rs (fuente única de textos)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'src/text.rs').read_text(encoding='utf-8').split('#[cfg(test)]')[0]
out = ['// Generado a partir de src/text.rs de la versión de terminal (tools/port_texts.py).',
       '// Mismos textos, mismo tono. No editar a mano: edita text.rs y vuelve a generar.', '', 'export const T = {']
q = '"'
for m in re.finditer(r'pub const (\w+): &str = "((?:[^"\\]|\\.)*)";', src):
    out.append(f'  {m.group(1)}: {q}{m.group(2)}{q},')
for m in re.finditer(r'pub const (\w+): &\[&str\] = &\[(.*?)\];', src, re.S):
    items = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(2))
    out.append(f'  {m.group(1)}: [' + ', '.join(q+i+q for i in items) + '] as const,')
for m in re.finditer(r'pub const (\w+): &\[\(&str, &str\)\] = &\[(.*?)\];', src, re.S):
    pairs = re.findall(r'\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)', m.group(2))
    out.append(f'  {m.group(1)}: [' + ', '.join(f'[{q}{a}{q}, {q}{b}{q}]' for a, b in pairs) + '] as const,')
out.append('} as const;')
(root / 'web/src/text/texts.ts').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('ok')
