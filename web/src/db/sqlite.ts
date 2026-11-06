/**
 * Base de datos SQLite en WebAssembly (build oficial), en memoria. El contenido
 * se serializa y cifra para guardarlo; al abrir se descifra y se deserializa.
 * Mismo esquema que la versión de terminal (migrations.ts).
 */
import sqlite3InitModule, { type Database as OoDatabase, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { CURRENT_VERSION, MIGRATIONS } from './migrations';

let sqlite3Promise: Promise<Sqlite3Static> | null = null;

export function sqlite(): Promise<Sqlite3Static> {
  if (!sqlite3Promise) {
    sqlite3Promise = sqlite3InitModule({ print: () => {}, printErr: () => {} });
  }
  return sqlite3Promise;
}

export type Row = Record<string, unknown>;
export type Bind = (string | number | null | Uint8Array)[] | Record<string, string | number | null>;

export class IncompatibleSchema extends Error {
  constructor(public found: number, public supported: number) {
    super(`la base de datos es de una versión más reciente (${found}) que esta aplicación (${supported})`);
  }
}

export class Database {
  private constructor(private s: Sqlite3Static, private db: OoDatabase, private onWrite: () => void) {}

  /** Crea una base vacía con el esquema actual. */
  static async create(onWrite: () => void): Promise<Database> {
    const s = await sqlite();
    const db = new s.oo1.DB(':memory:', 'c');
    const d = new Database(s, db, onWrite);
    d.pragmas();
    d.migrate();
    return d;
  }

  /** Abre una base a partir de sus bytes serializados (ya descifrados). */
  static async fromBytes(bytes: Uint8Array, onWrite: () => void): Promise<Database> {
    const s = await sqlite();
    const db = new s.oo1.DB(':memory:', 'c');
    const p = s.wasm.allocFromTypedArray(bytes);
    const rc = s.capi.sqlite3_deserialize(
      db.pointer!,
      'main',
      p,
      bytes.byteLength,
      bytes.byteLength,
      s.capi.SQLITE_DESERIALIZE_FREEONCLOSE | s.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    if (rc !== 0) {
      db.close();
      throw new Error('no se pudo cargar la base de datos');
    }
    const d = new Database(s, db, onWrite);
    d.pragmas();
    d.migrate();
    return d;
  }

  private pragmas() {
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA temp_store = MEMORY;');
  }

  private migrate() {
    const v = this.scalar<number>('PRAGMA user_version') ?? 0;
    if (v > CURRENT_VERSION) throw new IncompatibleSchema(v, CURRENT_VERSION);
    for (let i = v; i < MIGRATIONS.length; i++) {
      this.db.transaction(() => {
        this.db.exec(MIGRATIONS[i]);
        this.db.exec(`PRAGMA user_version = ${i + 1}`);
      });
    }
    if (v !== CURRENT_VERSION) this.onWrite();
  }

  version(): number {
    return this.scalar<number>('PRAGMA user_version') ?? 0;
  }

  /** Ejecuta una sentencia de escritura. */
  run(sql: string, bind: Bind = []): void {
    this.db.exec({ sql, bind: bind as never });
    this.onWrite();
  }

  /** Inserta y devuelve el rowid. */
  insert(sql: string, bind: Bind = []): number {
    this.db.exec({ sql, bind: bind as never });
    const id = this.scalar<number>('SELECT last_insert_rowid()') ?? 0;
    this.onWrite();
    return id;
  }

  all<T = Row>(sql: string, bind: Bind = []): T[] {
    return this.db.exec({ sql, bind: bind as never, rowMode: 'object', returnValue: 'resultRows' }) as unknown as T[];
  }

  get<T = Row>(sql: string, bind: Bind = []): T | undefined {
    return this.all<T>(sql, bind)[0];
  }

  scalar<T = unknown>(sql: string, bind: Bind = []): T | undefined {
    const rows = this.db.exec({ sql, bind: bind as never, rowMode: 'array', returnValue: 'resultRows' }) as unknown[][];
    return rows[0]?.[0] as T | undefined;
  }

  /** Varias escrituras en una transacción; una sola notificación de cambio. */
  transaction<T>(f: () => T): T {
    let out!: T;
    this.db.transaction(() => {
      out = f();
    });
    this.onWrite();
    return out;
  }

  /** `PRAGMA quick_check` + integridad de los índices de búsqueda. */
  check(): void {
    const r = this.scalar<string>('PRAGMA quick_check');
    if (r !== 'ok') throw new Error(`base de datos dañada: ${r}`);
    this.db.exec("INSERT INTO diary_fts(diary_fts) VALUES ('integrity-check'); INSERT INTO notes_fts(notes_fts) VALUES ('integrity-check');");
  }

  rebuildSearch(): void {
    this.db.exec("INSERT INTO diary_fts(diary_fts) VALUES ('rebuild'); INSERT INTO notes_fts(notes_fts) VALUES ('rebuild');");
  }

  /** Bytes del archivo SQLite (sin cifrar; se cifran antes de guardarse). */
  export(): Uint8Array {
    return this.s.capi.sqlite3_js_db_export(this.db.pointer!);
  }

  close(): void {
    this.db.close();
  }
}
