# Meditar: modelo de tiempos

Cómo se decide cuánto dura cada cosa en una sesión de meditación guiada, y cómo añadir
prácticas nuevas sin volver a decidirlo a mano. El código está en
`web/src/domain/meditation.ts` (el plan) y `web/src/domain/meditationRun.ts` (la sesión
en marcha); la decisión, en el ADR-026.

## La idea

Una sesión es una fila de dos clases de cosas:

- **Lo que dura lo que dura.** Cada frase de la voz (medida del audio:
  `web/src/audio/voice-durations.json`), el círculo de las tres respiraciones (30 s) y el
  gong (2,5 s). No se estira ni se encoge.
- **El silencio que sigue a cada frase.** Es lo único elástico, y cuánto debe durar
  depende de **lo que la frase pide a quien la escucha**. A eso lo llamamos su *papel*.

No hay tiempos escritos a mano para ninguna parte. Hay una tabla con el silencio mínimo y
máximo de cada papel, y tres reglas.

## La tabla (`SILENCE`)

| Papel | Qué pide la frase | Ejemplo | Silencio después |
|---|---|---|---|
| `announce` | Nada: avisa de lo que viene enseguida en pantalla | «Vamos a hacer tres respiraciones… aparecerá un círculo» | 1 s, fijo |
| `welcome` | Colocarse | «Empecemos. Busca una postura cómoda…» | 2 – 5 s |
| `explain` | Nada todavía: explica una parte cuya primera indicación llega a continuación | «Vamos a hacer un recorrido por el cuerpo…» | 6 – 12 s |
| `reflection` | Quedarse un momento con una idea | «Piensa en algo que agradeces hoy…» | 8 – 18 s |
| `adjust` | Un ajuste breve del cuerpo | «Los hombros. Déjalos caer…» | 8 – 30 s |
| `place` | Llevar la atención a un sitio y notarlo | «Sube ahora a las piernas…» | 12 – 60 s |
| `practice` | Practicar por cuenta propia con lo indicado | «Deja que lleguen los sonidos…» | 40 – 150 s |
| `focus` | Lo mismo en la parte principal, la más larga y callada | «Lleva la atención al aire…», y cada recordatorio | 60 – 180 s |

Por debajo del mínimo, la indicación siguiente atropella a la persona. Por encima del
máximo, se queda esperando (si no había nada que practicar) o demasiado sola (si lo había).

## Las tres reglas

1. **Ningún guion se recorta.** Un guion (una parte: su explicación y todas sus
   indicaciones) entra en una sesión sólo si cabe entero con todos los silencios al mínimo.
   Si no cabe, se elige otra variante. Por eso un recorrido del cuerpo pasa siempre por
   todas sus zonas, dure la sesión lo que dure.
2. **Una sola proporción para toda la sesión.** El tiempo que sobra sobre los mínimos se
   reparte entre todos los silencios estirándolos en la misma proporción de su margen:
   con proporción 0 todos están en su mínimo, con 1 en su máximo, con 0,5 a medio camino.
   Así un anuncio (margen cero) nunca hace esperar, una zona del cuerpo gana unos
   segundos y la práctica en silencio se lleva la mayor parte. Más duración da más
   silencio; nunca menos guion.
3. **Un recordatorio más antes que un silencio excesivo.** La parte principal lleva los
   recordatorios que dejan esa proporción lo más cerca posible de la mitad. En una
   sesión corta hay uno; al alargarla, los silencios crecen hasta que conviene otro.

El azar (la semilla) elige el **contenido**: reflexión, variante de cuerpo, apoyo,
recordatorios y despedida. Los **tiempos** salen del modelo, sin azar.

## Cómo queda (con voz)

Segundos de silencio tras cada frase. «Cuerpo» y «principal» son las dos partes de
práctica; lo demás (acogida y reflexión, las dos explicaciones del círculo, los dos
círculos) ocupa entre 3 min y 3 min 10 s en cualquier sesión.

| Sesión | Cuerpo | Silencio por indicación | Parte principal | Recordatorios | Silencio entre ellos |
|---|---|---|---|---|---|
| 10 min | Recorrido (6 zonas), ≈ 3:55 | 17 s | ≈ 3:10 | 1 | ≈ 73 s |
| 10 min | La postura (5 puntos), ≈ 2:50 | 16 s | ≈ 4:10 | 1 | ≈ 100 s |
| 10 min | Los sonidos, ≈ 3:15 | 72 s | ≈ 3:50 | 1 | ≈ 93 s |
| 15 min | Recorrido, ≈ 5:30 | 33 s | ≈ 6:30 | 2 | ≈ 112 s |
| 15 min | La postura, ≈ 3:05 | 18 s | ≈ 8:55 | 3 | ≈ 116 s |
| 15 min | Los sonidos, ≈ 3:40 | 86 s | ≈ 8:20 | 3 | ≈ 109 s |
| 20 min | Recorrido, ≈ 5:50 | 36 s | ≈ 11:15 | 4 | ≈ 119 s |
| 20 min | La postura, ≈ 3:10 | 19 s | ≈ 13:50 | 5 | ≈ 122 s |
| 20 min | Los sonidos, ≈ 3:55 | 92 s | ≈ 13:05 | 5 | ≈ 117 s |

En todas: la reflexión empieza unos 3 s después de «Empecemos», tras la reflexión quedan
de 9 a 13 s, y el círculo aparece un segundo después de su explicación.

## La sesión en marcha

El plan es una previsión hecha con las duraciones medidas. Al ejecutarlo
(`meditationRun.ts`) mandan tres reglas más, para que la realidad no rompa el plan:

- **La voz nunca corta a la voz.** Las frases van a una cola; lo que se encola espera a lo
  que suena, venga de donde venga.
- **Una parte no acaba mientras la voz habla**, y el círculo no aparece hasta que su
  explicación ha terminado. Si un audio tarda en cargar, la parte se alarga; nada se pisa.
- **La sesión cuenta como uso.** Meditando no se toca la pantalla: mientras hay sesión, el
  bloqueo por inactividad no salta.

## Añadir una práctica nueva

1. Escribir sus frases en `web/src/audio/voice-lines.json` y generar los audios
   (`web/tools/gen_voice.py`, que vuelve a medir las duraciones).
2. Declarar su guion: la lista de frases, cada una con su papel y con el texto corto que se
   ve en pantalla. Para una parte de cuerpo, una entrada más en `BODIES`; para un apoyo de
   la parte principal, una en `FOCUSES` (indicando si el apoyo es la respiración, porque
   de eso depende qué recordatorios le valen).
3. Nada más. Cuánto dura, en qué sesiones cabe y cuánto silencio lleva sale de la tabla.

La pregunta que hay que hacerse con cada frase nueva es sólo una: **¿qué le pide a quien
la escucha?** Si ninguno de los papeles lo describe (por ejemplo, una visualización larga
o caminar), se añade un papel a la tabla con su mínimo y su máximo, y todo lo demás sigue
funcionando igual.

Para cambiar el ritmo general de las sesiones se tocan los números de la tabla, y sólo
esos.

## Cómo se comprueba

- `web/src/domain/meditation.test.ts`: en todas las duraciones y cientos de semillas, cada
  silencio está entre el mínimo y el máximo de su papel; toda la sesión comparte una misma
  proporción; los recorridos van enteros; los recordatorios encajan con el apoyo.
- `web/src/domain/meditationRun.test.ts`: sesiones enteras, de «Empezar» al formulario,
  con la cola real de la voz y un audio simulado: suena todo el guion, en orden y sin
  cortes; el círculo sale tras su explicación y dura treinta segundos; el total es el
  elegido; la despedida suena entera.
- `web/e2e/meditar.spec.ts`: en el navegador, una sesión de quince minutos llega al final
  sin que la aplicación se bloquee.
- `web/tools/session_trace.mjs`: graba una sesión real en el navegador (qué suena, cuándo
  acaba, qué hay en pantalla). Con `SPEED=8`, veinte minutos se recorren en dos y medio.
