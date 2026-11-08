#!/usr/bin/env python3
"""
Mide cuánto dura cada frase de la voz guía (el mayor de las dos voces, redondeado hacia
arriba a décimas) y lo escribe en src/audio/voice-durations.json. El plan de la sesión suma
esas duraciones para saber qué cabe en el tiempo elegido. Ejecutar tras generar frases
nuevas (gen_voice.py lo llama al terminar). Necesita ffprobe.
"""
import json, math, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINES = json.loads((ROOT / 'src/audio/voice-lines.json').read_text())
OUT = ROOT / 'src/audio/voice-durations.json'

def seconds(p: Path) -> float:
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip().replace(',', '.'))

def main() -> int:
    out = {}
    for vid in LINES:
        ds = []
        for voice in ('serena', 'ryan'):
            f = ROOT / 'public/voz' / voice / f'{vid}.mp3'
            if not f.exists():
                print(f'falta {f}', file=sys.stderr); return 1
            ds.append(seconds(f))
        out[vid] = math.ceil(max(ds) * 10) / 10
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
    print(f'{len(out)} frases medidas → {OUT.relative_to(ROOT)}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
