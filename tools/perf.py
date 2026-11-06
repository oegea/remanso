#!/usr/bin/env python3
"""Mediciones de rendimiento reproducibles.

Mide: tiempo hasta el primer fotograma (arranque hasta pantalla de bloqueo),
tiempo de desbloqueo (Argon2id + apertura), memoria residente en reposo,
y CPU consumida durante 20 s sin interacción (debe ser ~0).
Uso: tools/perf.py <binario> <dir-datos-nuevo>
"""
import os, pty, sys, time, select, struct, fcntl, termios, subprocess, re

BIN, DATA = sys.argv[1], sys.argv[2]

def spawn():
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.environ["LANG"] = "es_ES.UTF-8"
        os.execv(BIN, [BIN, "--dir", DATA])
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 80, 0, 0))
    return pid, fd

def wait_output(fd, needle, timeout=10.0):
    buf = b""
    t0 = time.time()
    while time.time() - t0 < timeout:
        r, _, _ = select.select([fd], [], [], 0.01)
        if r:
            try:
                buf += os.read(fd, 65536)
            except OSError:
                break
            if needle.encode() in buf:
                return time.time() - t0
    return None

def ps(pid, field):
    out = subprocess.run(["ps", "-o", f"{field}=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return out

results = {}
import functools; print = functools.partial(print, flush=True)
# 1) Arranque hasta la pantalla de creación/bloqueo
t = time.time()
pid, fd = spawn()
dt = wait_output(fd, "Contrase")
results["arranque_hasta_primer_fotograma_ms"] = round((dt or 0) * 1000); print("· arranque", dt)
# Crear contraseña
os.write(fd, b"clave-de-prueba\r"); wait_output(fd, "Repite")
t0 = time.time(); os.write(fd, b"clave-de-prueba\r"); dt = wait_output(fd, "Aspecto", 30)
results["crear_base_ms"] = round((dt or 0) * 1000); print("· crear", dt)
os.write(fd, b"\r"); wait_output(fd, "Diario", 5)
# 2) Bloquear y desbloquear (Argon2id 32 MiB + abrir SQLCipher + migraciones)
os.write(fd, b"\x0c"); wait_output(fd, "Contrase")
time.sleep(0.2)
t0 = time.time(); os.write(fd, b"clave-de-prueba\r"); dt = wait_output(fd, "Diario", 30)
results["desbloqueo_ms"] = round((dt or 0) * 1000); print("· desbloqueo", dt)
# 3) Reposo: RSS y CPU durante 20 s sin eventos
time.sleep(1.0)
cpu0 = ps(pid, "cputime"); rss0 = ps(pid, "rss")
time.sleep(20)
cpu1 = ps(pid, "cputime"); rss1 = ps(pid, "rss")
results["rss_reposo_kib"] = int(rss1 or 0); print("· reposo", rss1)
results["cpu_time_inicio"] = cpu0
results["cpu_time_tras_20s_reposo"] = cpu1
# 4) Escribir 300 caracteres en el diario y medir CPU
os.write(fd, b"d"); wait_output(fd, "entradas")
print("· diario"); os.write(fd, b"n"); print("· n ->", wait_output(fd, "palabras"))
cpu_a = ps(pid, "cputime")
texto = ("Hoy ha sido un dia tranquilo y he salido a caminar un rato. " * 5).encode()
t0 = time.time()
for i in range(0, len(texto), 10):
    os.write(fd, texto[i:i + 10])
    end = time.time() + 0.05
    while True:
        r, _, _ = select.select([fd], [], [], max(0.0, end - time.time()))
        if not r:
            break
        os.read(fd, 65536)
results["escritura_300_chars_s"] = round(time.time() - t0, 2); print("· escrito", results["escritura_300_chars_s"])
time.sleep(2.5)  # autoguardado
cpu_b = ps(pid, "cputime")
results["cpu_time_tras_escribir"] = cpu_b
results["rss_tras_escribir_kib"] = int(ps(pid, "rss") or 0)
print("· cpu tras escribir", cpu_b)
os.write(fd, b"\x1b"); time.sleep(0.3)
os.write(fd, b"\x11")
for _ in range(50):
    r, _, _ = select.select([fd], [], [], 0.1)
    if r:
        try:
            os.read(fd, 65536)
        except OSError:
            pass
    try:
        wpid, _ = os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        wpid = pid
    if wpid:
        break
else:
    print("· el proceso no terminó; se fuerza")
    os.kill(pid, 9)
results["tamano_binario_bytes"] = os.path.getsize(BIN)
for k, v in results.items():
    print(f"{k}: {v}")
