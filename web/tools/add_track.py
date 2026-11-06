#!/usr/bin/env python3
"""Incorpora una pista al catálogo: recomprime a 128 kbps con sonoridad -16 LUFS, etiqueta,
copia a public/musica/ y añade la entrada a src/audio/tracks.ts.

Uso: tools/add_track.py <mp3 origen> <id> <título> <usos: write,calm,sleep> <descripción>
"""
import re, subprocess, sys
from pathlib import Path

src, tid, title, uses, desc = sys.argv[1:6]
web = Path(__file__).resolve().parents[1]
out = web / 'public' / 'musica' / f'{tid}.mp3'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-map_metadata', '-1',
                '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-b:a', '128k', '-id3v2_version', '3',
                '-metadata', f'title={title}', '-metadata', 'artist=Oriol Egea', '-metadata', 'album=Remanso',
                '-metadata', 'copyright=CC BY 4.0 Oriol Egea', str(out)], check=True)
dur = int(float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)]).decode().strip()))
cat = web / 'src' / 'audio' / 'tracks.ts'
s = cat.read_text()
uses_ts = ', '.join(f"'{u.strip()}'" for u in uses.split(','))
entry = f"  {{ id: '{tid}', title: '{title}', file: '{tid}.mp3', uses: [{uses_ts}], desc: '{desc}', seconds: {dur} }},\n"
if f"id: '{tid}'" in s:
    s = re.sub(rf"  \{{ id: '{tid}'.*\n", entry, s)
else:
    s = s.replace("\n];", "\n" + entry + "];", 1)
cat.write_text(s)
print(f'{out.name}: {dur // 60}:{dur % 60:02d}')
