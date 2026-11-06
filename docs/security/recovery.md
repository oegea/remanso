# Recuperar los datos sin Remanso

Este documento explica cómo abrir una base de datos de Remanso (o una copia de
seguridad) con herramientas estándar, sin el binario de la aplicación. Existe para
que los datos nunca dependan de que este programa siga compilando dentro de diez
años. Todo lo que hace Remanso con la clave son dos operaciones públicas y
documentadas: **Argon2id** y **SQLCipher 4**.

Requisito irrenunciable: **la contraseña**. Sin ella no hay nada que hacer (§6).

---

## 1. Qué ficheros hacen falta

Del directorio de datos (`$REMANSO_DIR`, `$XDG_DATA_HOME/remanso` o
`~/.local/share/remanso`):

- `remanso.db`: la base de datos cifrada.
- `kdf.json`: sal y parámetros para rederivar la clave. **Sin él, la contraseña no
  sirve**: la sal es aleatoria y no se puede adivinar.
- Si existen `remanso.db-wal` y `remanso.db-shm`, cópialos **junto** a `remanso.db`
  con el mismo prefijo: el WAL puede contener las últimas escrituras aún no
  consolidadas. Remanso hace un *checkpoint* al cerrar y al bloquear, así que lo
  normal es que el WAL esté vacío, pero no cuesta nada llevárselo.

Trabaja siempre sobre una **copia** de estos ficheros, nunca sobre los originales.

## 2. Formato de `kdf.json`

Ejemplo real (generado por `KdfParams::generate`, `src/crypto.rs`):

```json
{
  "version": 1,
  "algorithm": "argon2id",
  "salt": "q7Xb2kLm9PzRt4Vw0YhJcN6s",
  "m_kib": 32768,
  "t": 3,
  "p": 1,
  "key_len": 32
}
```

| Campo | Significado |
|---|---|
| `version` | Versión del formato de este fichero (1). |
| `algorithm` | Siempre `argon2id`. Remanso rechaza cualquier otro valor. |
| `salt` | **Cadena imprimible** de 24 caracteres `[A-Za-z0-9]`. La sal real son sus bytes UTF-8 (= ASCII), tal cual, sin decodificar base64 ni hex. Por eso puede pasarse directamente a una herramienta de línea de órdenes. |
| `m_kib` | Memoria de Argon2 en **KiB**. 32768 = 32 MiB (valor por defecto). |
| `t` | Pasadas (iteraciones). Por defecto 3. |
| `p` | Paralelismo (hilos). Por defecto 1. |
| `key_len` | Longitud de la clave en bytes. Siempre 32. |

Argon2 versión 0x13 (1.3), que es la que usan por defecto todas las
implementaciones actuales.

## 3. Derivar la clave con la herramienta `argon2`

La herramienta de referencia (paquete `argon2` en Debian/antiX: `apt install argon2`)
acepta la sal como argumento y la contraseña por la entrada estándar. `-m` es el
**logaritmo en base 2 de la memoria en KiB**, no la memoria en sí:

| `m_kib` en `kdf.json` | MiB | `-m` |
|---|---|---|
| 32768 (por defecto) | 32 | 15 |
| 65536 | 64 | 16 |
| 16384 | 16 | 14 |

Para el `kdf.json` del ejemplo (32 MiB, t=3, p=1):

```sh
printf '%s' 'tu contraseña' | argon2 'q7Xb2kLm9PzRt4Vw0YhJcN6s' -id -t 3 -m 15 -p 1 -l 32 -r
```

- `-id`: Argon2id. `-t 3`: pasadas. `-m 15`: 2¹⁵ KiB = 32 MiB. `-p 1`: hilos.
  `-l 32`: 32 bytes. `-r`: imprime sólo el resultado en hexadecimal.
- La salida son **64 caracteres hexadecimales**: ésa es la clave.
- Usa `printf '%s'` (o `echo -n`) para no añadir un salto de línea: formaría parte de
  la contraseña y la clave saldría distinta.

**Si `m_kib` no es potencia de dos** (por ejemplo 19456, la recomendación OWASP de
19 MiB): `-m` no puede expresarlo. Las versiones recientes de la herramienta aceptan
`-k <KiB>` para indicar la memoria exacta (`-k 19456`); si la tuya no lo admite, usa
cualquier biblioteca Argon2 (ver abajo). Remanso **sólo escribe potencias de dos por
defecto** (32 MiB) precisamente para que `-m` baste, y en la versión 0.1.0 no hay
forma de cambiarlo desde la interfaz, pero comprueba siempre `m_kib` en tu `kdf.json`
en lugar de confiar en el valor por defecto.

Alternativa con Python y `argon2-cffi` (`pip install argon2-cffi`), válida para
cualquier `m_kib`:

```python
import json, getpass
from argon2.low_level import hash_secret_raw, Type
k = json.load(open("kdf.json"))
pw = getpass.getpass("Contraseña: ").encode()
key = hash_secret_raw(pw, k["salt"].encode(), time_cost=k["t"],
                      memory_cost=k["m_kib"], parallelism=k["p"],
                      hash_len=k["key_len"], type=Type.ID)
print(key.hex())
```

Higiene al teclear la contraseña en un intérprete:

- No la escribas en la línea de órdenes directamente (quedaría en el historial).
  Léela con `read -rs PW` y usa `printf '%s' "$PW" | argon2 …`; después `unset PW`.
- Comprueba primero que todo funciona con `remanso --check` si aún tienes el
  binario: si pasa, la contraseña y el `kdf.json` son los correctos y cualquier
  discrepancia posterior está en la orden `argon2`, no en los datos.

## 4. Abrir la base con `sqlcipher`

Necesitas la herramienta `sqlcipher` **versión 4.x** (`apt install sqlcipher`;
comprueba con `sqlcipher -version`). Una 3.x no puede abrir estos ficheros porque
usan HMAC-SHA512, que 3.x no implementa. Remanso 0.1.0 crea las bases con SQLCipher
4.5.7 y **todos los parámetros por defecto de la versión 4** (página 4096,
AES-256-CBC, HMAC-SHA512), así que no hay que fijar ningún `PRAGMA cipher_*`
adicional.

```sh
sqlcipher remanso.db
```

Dentro del intérprete, la **primera** orden ha de ser la clave, en formato «raw»
(`x'…'` con los 64 hex de §3), para que SQLCipher no aplique su propio PBKDF2:

```sql
PRAGMA key = "x'0123456789abcdef…(64 hex)…'";
PRAGMA cipher_version;              -- debe responder 4.x
SELECT count(*) FROM sqlite_master; -- si la clave es incorrecta: "file is not a database"
.tables
```

Consultas útiles:

```sql
-- Diario, en orden cronológico, sin entradas borradas
SELECT day, title, body FROM diary_entries WHERE deleted_at IS NULL ORDER BY day, created_at;

-- Notas con su cuaderno
SELECT b.name, n.title, n.body FROM notes n JOIN notebooks b ON b.id = n.notebook_id ORDER BY b.position, n.id;

-- Esquema completo
.schema
```

Las marcas de tiempo (`created_at`, `updated_at`, …) son segundos Unix en UTC; las
fechas de calendario (`day`, `due_day`, …) son texto `AAAA-MM-DD` en hora local
(`src/storage/migrations.rs`).

Exportar a ficheros con los modos del intérprete:

```sql
-- CSV
.headers on
.mode csv
.output diario.csv
SELECT day, title, body FROM diary_entries WHERE deleted_at IS NULL ORDER BY day;
.output stdout

-- Markdown (tabla; requiere SQLite >= 3.33 dentro de sqlcipher)
.mode markdown
.output diario.md
SELECT day, title, body FROM diary_entries ORDER BY day;
.output stdout

-- JSON
.mode json
.output notas.json
SELECT * FROM notes;
.output stdout
```

Para obtener una **copia completa descifrada** como SQLite normal (que luego abre
cualquier herramienta, DB Browser incluido):

```sql
ATTACH DATABASE 'remanso-plano.db' AS plano KEY '';
SELECT sqlcipher_export('plano');
DETACH DATABASE plano;
```

`remanso-plano.db` queda **en claro**: trátalo como la exportación de §8.

## 5. Formato de una copia de seguridad

Una copia (`remanso --backup RUTA` o Ajustes → Copia) es un directorio con tres
ficheros (`src/storage/backup.rs`):

| Fichero | Contenido |
|---|---|
| `remanso.db` | Base SQLCipher generada con `sqlcipher_export`, **con la misma clave** que la original. Sin ficheros `-wal`/`-shm`. |
| `kdf.json` | Copia exacta del `kdf.json` del momento de la copia. Es el que hay que usar para rederivar: si después se cambió la contraseña, el `kdf.json` del directorio de datos ya no sirve para esta copia. |
| `manifest.json` | `{"format": 1, "app_version": "0.1.0", "schema_version": N, "created_at": <segundos Unix>, "db_bytes": <tamaño>}`. Informativo. |

Abrirla sin Remanso: exactamente §3 y §4 sobre los ficheros del directorio de la copia.

Restaurarla con Remanso:

```sh
remanso --restore /ruta/a/remanso-2026-11-06-0930
```

Pide confirmación si ya hay datos (los conserva como `remanso.db.anterior` y
`kdf.json.anterior`), pide la contraseña **de la copia**, la verifica con
`quick_check` antes de tocar nada, copia `remanso.db` y `kdf.json` al directorio de
datos y reconstruye los índices de búsqueda. Para restaurar sin pisar los datos
actuales: `remanso --dir /otra/carpeta --restore RUTA`.

Restaurar a mano (sin Remanso): copiar `remanso.db` **y** `kdf.json` de la copia al
directorio de datos, borrar cualquier `remanso.db-wal`/`-shm` residual, y fijar
permisos `chmod 700` al directorio y `chmod 600` a los ficheros. Los dos ficheros
tienen que ir siempre juntos: una base con el `kdf.json` de otra no abre.

## 6. Si se pierde la contraseña

**No hay nada que hacer.** No existe pregunta de seguridad, clave de recuperación,
puerta trasera ni soporte técnico que pueda ayudar; la aplicación está diseñada
deliberadamente para que ni su autor pueda abrir los datos. La única vía es la fuerza
bruta descrita en `threat-model.md` §3.3, que para una contraseña razonable es
impracticable, y que es exactamente lo que se quería impedir.

Lo que sí puede hacerse es **prevenir**: anotar la contraseña en papel y guardarla en
un lugar físico seguro, o en un gestor de contraseñas. Cambiar la contraseña
(Ajustes → Contraseña) no reduce la seguridad de los datos y es preferible a
olvidarla.

Las copias de seguridad están cifradas con la misma clave: perder la contraseña
también las inutiliza.

## 7. Verificar la integridad

Con Remanso:

```sh
remanso --check
```

Ejecuta `PRAGMA quick_check` y la comprobación de integridad de las tablas FTS5
(`diary_fts`, `notes_fts`); cualquier resultado distinto de «ok» se informa como
«base de datos dañada». También se puede verificar una copia restaurándola en un
directorio de prueba con `--dir`.

Sin Remanso, dentro de `sqlcipher` tras `PRAGMA key`:

```sql
PRAGMA cipher_integrity_check;  -- comprueba el HMAC de cada página; sin salida = correcto
PRAGMA quick_check;             -- estructura de SQLite; debe responder "ok"
PRAGMA integrity_check;         -- más lento y exhaustivo
```

Si `cipher_integrity_check` lista páginas, el fichero ha sido alterado o dañado en
disco: recupera desde la última copia de seguridad; SQLCipher no puede «reparar» una
página cuyo HMAC no coincide. Si `quick_check` falla pero `cipher_integrity_check`
pasa, puede intentarse `.recover` del intérprete de SQLite sobre la copia descifrada
de §4.

## 8. Formato de la exportación en claro

`remanso --export DIR` (o Ajustes → Exportar), tras confirmación explícita, produce
(`src/storage/export.rs`):

```
DIR/
  diario/
    2026/
      2026-03-04-17.md          una entrada por fichero: AAAA-MM-DD-<id>.md
  cuadernos/
    Ideas-_-proyectos/          nombre del cuaderno saneado
      12-Nota_-uno.md           <id>-<título saneado>.md, o <id>.md si no hay título
  datos.json                    volcado completo
```

- Cada entrada del diario: `# AAAA-MM-DD · Título` (el título sólo si existe), una
  línea `_AAAA-MM-DD HH:MM_` y el cuerpo. Sólo entradas no borradas.
- Cada nota: `# Título` y el cuerpo (o sólo el cuerpo si no tiene título). Se
  incluyen también las notas archivadas.
- `datos.json`: `{"formato": 1, "aplicacion": "remanso 0.1.0", "esquema": N,
  "exportado_en": <segundos Unix>, "tablas": {...}}`. Recorre `sqlite_master`, así que
  contiene **todas** las tablas (diario con entradas borradas incluidas, cuadernos,
  notas, etiquetas, tareas, objetivos, métricas, episodios, revisiones, ajustes), una
  lista de objetos por tabla, una clave por columna. Excluye las tablas internas de
  SQLite y las FTS (que son índices reconstruibles). Los BLOB se codifican en hex.
- El saneado de nombres sustituye todo lo que no sea alfanumérico, `-`, `_` o espacio
  por `_`, cambia espacios por `-` y corta a 60 caracteres.

Todo el contenido queda en texto plano y los ficheros se crean con los permisos de la
`umask` del usuario. Si el destino no está dentro de un directorio protegido, cualquier
otro usuario del sistema podrá leerlos. Borra la exportación cuando ya no la necesites
(y recuerda que un borrado normal no sobrescribe el disco).
