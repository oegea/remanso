#!/usr/bin/env python3
"""Prueba de humo de la TUI mediante un pseudo-terminal.

Lanza el binario en un pty de 80x24, envía pulsaciones y comprueba que el
proceso sigue vivo y que la salida contiene los textos esperados.
Uso: tools/tui_smoke.py <binario> <dir-datos>
"""
import os, pty, sys, time, select, struct, fcntl, termios, re
import pyte  # emulador de terminal: reconstruye la pantalla a partir del redibujado diferencial

BIN, DATA = sys.argv[1], sys.argv[2]
ESC = "\x1b"
COLS, ROWS = (int(x) for x in os.environ.get("SMOKE_SIZE", "80x24").split("x"))
SCREEN = pyte.Screen(COLS, ROWS)
STREAM = pyte.ByteStream(SCREEN)

def spawn():
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.environ["LANG"] = "C" if os.environ.get("SMOKE_ASCII") else "es_ES.UTF-8"
        args = [BIN, "--dir", DATA] + (["--light"] if os.environ.get("SMOKE_LIGHT") else [])
        os.execv(BIN, args)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))
    return pid, fd

def read_all(fd, timeout=0.6):
    out = b""
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.05)
        if r:
            try:
                chunk = os.read(fd, 65536)
            except OSError:
                break
            if not chunk:
                break
            out += chunk
    return out.decode("utf-8", "replace")

def strip(s):
    STREAM.feed(s.encode("utf-8", "replace"))
    return "\n".join(SCREEN.display)

def send(fd, s, wait=0.4):
    os.write(fd, s.encode())
    return strip(read_all(fd, wait))

def alive(pid):
    try:
        wpid, status = os.waitpid(pid, os.WNOHANG)
        return wpid == 0
    except ChildProcessError:
        return False

def dump(label, screen):
    if os.environ.get("DUMP"):
        print(f"===== {label} =====")
        print(screen)

def expect(screen, *needles):
    for n in needles:
        assert n in screen, f"no se encontró «{n}» en pantalla:\n{screen}"

pid, fd = spawn()
scr = strip(read_all(fd, 1.0))
expect(scr, "Remanso", "Contraseña nueva")
scr = send(fd, "contraseña-larga\r")
expect(scr, "Repite la contraseña")
scr = send(fd, "contraseña-larga\r", 3.0)
expect(scr, "Aspecto", "Tema")
scr = send(fd, " ")            # alternar tema
scr = send(fd, "\r")           # entrar
expect(scr, "Inicio" if "Inicio" in scr else "Diario", "Cuadernos")
dump("INICIO (vacío)", scr)
# Diario: nueva entrada, escribir, título, volver
scr = send(fd, "d")
expect(scr, "Todavía no hay entradas")
scr = send(fd, "n")
scr = send(fd, "Hoy he caminado media hora.\rMañana quiero levantarme antes.")
expect(scr, "caminado", "palabras")
scr = send(fd, "\x14")          # Ctrl+T título
expect(scr, "Título (opcional)")
scr = send(fd, "Paseo\r")
expect(scr, "Paseo")
dump("EDITOR", scr)
scr = send(fd, "\x06")          # Ctrl+F modo sólo texto
assert "Diario" not in scr.split("\n")[0], "el modo sólo texto debe ocultar la cabecera"
scr = send(fd, ESC)             # salir de sólo texto
scr = send(fd, ESC)             # guardar y volver
expect(scr, "Paseo", "9 palabras")
dump("LISTA DIARIO", scr)
# Cuadernos
scr = send(fd, ESC)             # inicio
scr = send(fd, "c")
expect(scr, "Todavía no hay cuadernos")
scr = send(fd, "n")
scr = send(fd, "Ideas\r")
expect(scr, "Ideas", "0 notas")
scr = send(fd, "\r")
expect(scr, "Este cuaderno está vacío")
scr = send(fd, "n")
scr = send(fd, "Primera nota\r")
scr = send(fd, "Cuerpo de la nota con [[Segunda]].")
scr = send(fd, ESC)
expect(scr, "Primera nota", "Cuerpo de la nota")
# Búsqueda global
scr = send(fd, ESC); scr = send(fd, ESC)
scr = send(fd, "/")
scr = send(fd, "caminado")
expect(scr, "diario", "caminado")
dump("BUSQUEDA", scr)
scr = send(fd, "\r")
expect(scr, "Hoy he caminado")
scr = send(fd, ESC)             # volver a la lista del diario
# Tareas
scr = send(fd, ESC)             # a Inicio
scr = send(fd, "t")
expect(scr, "Tareas", "Nada previsto para hoy")
dump("TAREAS (vacío)", scr)
scr = send(fd, "n")
scr = send(fd, "Llamar al dentista\r")
expect(scr, "Llamar al dentista")
scr = send(fd, "n")
scr = send(fd, "Comprar pan\r")
scr = send(fd, "p")             # prioridad alta
scr = send(fd, "z")             # aplazar
expect(scr, "A qué día")
scr = send(fd, "mañana\r")
assert "Comprar pan" not in scr, "la tarea aplazada debe salir de Hoy"
scr = send(fd, "\t")            # Próximas
expect(scr, "Comprar pan")
dump("TAREAS PROXIMAS", scr)
scr = send(fd, "1")             # Hoy
scr = send(fd, "\r")            # ficha
expect(scr, "Tarea", "Llamar al dentista")
scr = send(fd, "Pedir cita para la revisión anual.")
scr = send(fd, "\x0e")          # Ctrl+N subtarea
scr = send(fd, "Buscar el teléfono\r")
expect(scr, "Subtareas", "Buscar el teléfono")
dump("FICHA TAREA", scr)
scr = send(fd, ESC)
expect(scr, "0/1")
scr = send(fd, " ")             # hecha
scr = send(fd, "4")             # Hechas
expect(scr, "Llamar al dentista")
scr = send(fd, "5")             # Proyectos
scr = send(fd, "n")
scr = send(fd, "Casa\r")
expect(scr, "Casa", "0 abiertas")
scr = send(fd, "6")             # Calendario
expect(scr, "noviembre 2026" if "noviembre" in scr else "2026")
dump("CALENDARIO", scr)
scr = send(fd, ESC)
expect(scr, "Inicio" if "Inicio" in scr else "Cuadernos")
# Recordatorios
scr = send(fd, "p")
expect(scr, "Recordatorios", "No hay recordatorios")
scr = send(fd, "n")
scr = send(fd, "Revisar objetivos\r")
expect(scr, "Cuándo")
scr = send(fd, "mañana 9:00\r")
expect(scr, "Repetir")
scr = send(fd, "semanal\r")
expect(scr, "Próximos", "Revisar objetivos", "cada semana")
scr = send(fd, "n")
scr = send(fd, "Ahora mismo\r")
scr = send(fd, "+0m\r")
scr = send(fd, "\r")            # sin repetición
expect(scr, "Pendientes", "Ahora mismo")
dump("RECORDATORIOS", scr)
scr = send(fd, ESC)
expect(scr, "1 pendientes", "Ahora mismo")
dump("INICIO (con pendientes)", scr)
# Objetivos
scr = send(fd, "o")
expect(scr, "Objetivos", "Todavía no hay objetivos")
scr = send(fd, "n")
expect(scr, "Antes de empezar", "No es un servicio sanitario")
scr = send(fd, ESC)
scr = send(fd, "n")
expect(scr, "Objetivo (verbo")
scr = send(fd, "Leer 20 minutos\r")
expect(scr, "tipo de objetivo", "proceso")
scr = send(fd, "\r")
expect(scr, "Con qué tiene que ver", "Proyecto personal")
scr = send(fd, "2")
expect(scr, "Por qué te importa")
scr = send(fd, "Disfrutar leyendo\r")
expect(scr, "Resumen", "Disfrutar leyendo", "activo")
dump("OBJETIVO RESUMEN", scr)
scr = send(fd, "2")             # Métricas
expect(scr, "Sin métricas")
scr = send(fd, "n")
scr = send(fd, "Páginas\r")
expect(scr, "tipo de dato")
scr = send(fd, "5")             # cantidad entera
expect(scr, "sensible")
scr = send(fd, "1")             # no
expect(scr, "Unidad")
scr = send(fd, "páginas\r")
expect(scr, "Páginas", "0 registros")
scr = send(fd, "m")
expect(scr, "Valor")
scr = send(fd, "12\r")
expect(scr, "1 registros", "12 páginas")
scr = send(fd, "\r")            # evolución
expect(scr, "Registros", "12 páginas", "Todavía no hay datos suficientes")
dump("METRICA", scr)
scr = send(fd, ESC)
scr = send(fd, "3")             # Hitos
scr = send(fd, "n")
scr = send(fd, "Primer libro terminado\r")
expect(scr, "Cómo se alcanza")
scr = send(fd, "1")             # manual
expect(scr, "Primer libro terminado")
scr = send(fd, "4")             # Acciones
scr = send(fd, "n")
scr = send(fd, "Leer en el sofá\r")
expect(scr, "Frecuencia", "3 veces por semana")
scr = send(fd, "\r")
expect(scr, "dejar de hacer")
scr = send(fd, "1")
expect(scr, "Señal o momento")
scr = send(fd, "al terminar de cenar\r")
expect(scr, "Leer en el sofá", "3 veces por semana", "sin registro hoy")
scr = send(fd, " ")
expect(scr, "hecha hoy", "1 de 3 esta semana")
dump("ACCIONES", scr)
scr = send(fd, ESC)
expect(scr, "Leer 20 minutos", "activo")
scr = send(fd, ESC)
expect(scr, "1 activos", "Hoy", "Leer en el sofá")
dump("INICIO (con objetivo)", scr)
# Planes si-entonces en la ficha del objetivo
scr = send(fd, "o")
scr = send(fd, "\r")
scr = send(fd, "5")
expect(scr, "Planes", "Sin planes")
scr = send(fd, "n")
scr = send(fd, "al terminar de cenar\r")
expect(scr, "entonces")
scr = send(fd, "abro el libro en el sofá\r")
expect(scr, "Si al terminar de cenar", "abro el libro")
dump("PLANES", scr)
scr = send(fd, ESC); scr = send(fd, ESC)
# Impulso
scr = send(fd, "i")
expect(scr, "Impulso", "Con qué tiene que ver")
scr = send(fd, "1")
expect(scr, "Para.", "Intensidad ahora")
dump("IMPULSO STOP", scr)
scr = send(fd, "7")
expect(scr, "Qué había justo antes")
scr = send(fd, "b")
expect(scr, "contexto, no causa")
scr = send(fd, "1")
scr = send(fd, "\r")
expect(scr, "Elige una vía", "Surfear")
scr = send(fd, "1")
expect(scr, "Espera activa", "Nota el impulso")
dump("IMPULSO ESPERA", scr)
scr = send(fd, "\r")
expect(scr, "Dónde lo notas")
scr = send(fd, "en el pecho\r")
scr = send(fd, "t")
expect(scr, "Intensidad ahora")
scr = send(fd, "4")
expect(scr, "Qué pasó", "No lo hice")
scr = send(fd, "1")
expect(scr, "Algo que quieras anotar")
scr = send(fd, "\r")
expect(scr, "Registrado", "7 → 4")
dump("IMPULSO FIN", scr)
scr = send(fd, "\r")
# Revisiones: activar cierre del día en Ajustes
scr = send(fd, ",")
scr = send(fd, "jjjjj")        # fila «Preguntas de cierre del día»
scr = send(fd, "\r")
expect(scr, "Preguntas de cierre del día", "activas")
dump("AJUSTES (prompts)", scr)
scr = send(fd, ESC)
scr = send(fd, "r")
expect(scr, "Revisión", "Cierre del día", "disponible", "Patrón de impulsos")
dump("REVISION MENU", scr)
scr = send(fd, "2")
expect(scr, "Qué pasó hoy que quieras recordar", "1 de 3")
scr = send(fd, "\r")
scr = send(fd, "El paseo de la tarde\r")
expect(scr, "Una cosa que fue bien", "2 de 3")
scr = send(fd, "s")
expect(scr, "Qué queda pendiente", "3 de 3")
scr = send(fd, "\r")
scr = send(fd, "Comprar sellos; Llamar a Ana\r")
expect(scr, "Revisión guardada", "2 tareas creadas")
dump("REVISION FIN", scr)
scr = send(fd, "\r")
expect(scr, "ya hay una sesión guiada hoy")
scr = send(fd, "6")            # patrón de impulsos
expect(scr, "Patrón de episodios", "1 de 1 episodios sin actuar")
dump("PATRON", scr)
scr = send(fd, ESC)
scr = send(fd, ESC)
expect(scr, "Inicio" if "Inicio" in scr else "Cuadernos")
# Bloquear y desbloquear
scr = send(fd, "\x0c", 0.8)     # Ctrl+L
expect(scr, "Contraseña")
assert "Paseo" not in scr, "la pantalla de bloqueo no debe mostrar datos"
scr = send(fd, "mala\r", 1.5)
expect(scr, "Contraseña incorrecta")
dump("BLOQUEO", scr)
scr = send(fd, "contraseña-larga\r", 3.0)
expect(scr, "Cuadernos")
# Ajustes: verificar integridad
scr = send(fd, ",")
expect(scr, "Ajustes", "Bloquear tras inactividad")
dump("AJUSTES", scr)
scr = send(fd, "jjjjjjjjjjj")   # bajar hasta «Verificar integridad»
scr = send(fd, "\r", 1.0)
expect(scr, "Integridad correcta")
# Salir
assert alive(pid), "el proceso murió antes de salir"
send(fd, "\x11", 0.8)           # Ctrl+Q
time.sleep(0.5)
assert not alive(pid), "el proceso no terminó con Ctrl+Q"
print("SMOKE OK")
