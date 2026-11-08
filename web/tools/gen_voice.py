#!/usr/bin/env python3
"""Genera las frases de la voz guía de Meditar con Qwen3-TTS (modelo abierto, Apache 2.0) y las
deja en public/voz/<voz>/<id>.mp3 (mono, 64 kbps, -16 LUFS). Los textos salen de
src/audio/voice-lines.json; el identificador de cada frase es el nombre del archivo.

Uso: tools/gen_voice.py [--voice serena|ryan|all] [--force] [id ...]
  Sin ids genera las que falten (o todas con --force). Cada generación es distinta (el modelo
  muestrea): si una frase no convence, se repite sólo esa.

Requiere un Mac con Apple Silicon y un Python con mlx-audio y soundfile:
  python3 -m venv .venv && .venv/bin/pip install mlx-audio soundfile && .venv/bin/python tools/gen_voice.py
"""
import json, subprocess, sys, tempfile, time
from pathlib import Path

MODEL = 'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16'
INSTRUCT = 'Habla muy despacio, con calma y voz suave, como guiando una meditación.'
VOICES = {'serena': 'Serena', 'ryan': 'Ryan'}

args = sys.argv[1:]
voice_arg = 'all'
force = False
ids: list[str] = []
while args:
    a = args.pop(0)
    if a == '--voice': voice_arg = args.pop(0)
    elif a == '--force': force = True
    else: ids.append(a)

web = Path(__file__).resolve().parents[1]
lines: dict[str, str] = json.loads((web / 'src' / 'audio' / 'voice-lines.json').read_text())
if ids:
    unknown = [i for i in ids if i not in lines]
    if unknown: sys.exit(f'frases desconocidas: {unknown}')
voices = list(VOICES) if voice_arg == 'all' else [voice_arg]

import numpy as np, soundfile as sf  # noqa: E402
from mlx_audio.tts.utils import load_model  # noqa: E402

t0 = time.time()
model = load_model(MODEL)
print(f'modelo cargado en {time.time() - t0:.0f} s', flush=True)
sr = model.sample_rate
spk = {s.lower(): s for s in model.get_supported_speakers()}

for voice in voices:
    out_dir = web / 'public' / 'voz' / voice
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = ids or [i for i in lines if force or not (out_dir / f'{i}.mp3').exists()]
    for lid in todo:
        text = lines[lid]
        t0 = time.time()
        res = list(model.generate(text=text, voice=spk[voice], lang_code='spanish', instruct=INSTRUCT, speed=0.9, temperature=0.7))
        audio = np.concatenate([np.asarray(r.audio) for r in res]).astype(np.float32)
        secs = len(audio) / sr
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            sf.write(tmp.name, audio, sr)
            out = out_dir / f'{lid}.mp3'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp.name, '-map_metadata', '-1',
                            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '44100', '-b:a', '64k', '-id3v2_version', '3',
                            '-metadata', f'title={lid}', '-metadata', 'artist=Remanso', '-metadata', 'copyright=CC BY 4.0 Oriol Egea',
                            str(out)], check=True)
            Path(tmp.name).unlink()
        rate = len(text) / secs
        warn = '  ← revisar (ritmo raro)' if rate < 9 or rate > 18 else ''
        print(f'{voice}/{lid}: {secs:.1f} s de audio, {rate:.1f} car/s, generado en {time.time() - t0:.0f} s{warn}', flush=True)

# Tras generar, se vuelve a medir la tabla de duraciones que usa el plan de la sesión.
import subprocess as _sp
_sp.run([sys.executable, str(Path(__file__).with_name('voice_durations.py'))], check=False)
