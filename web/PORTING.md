# Portado del dominio Rust → TypeScript (brief común)

Objetivo: reproducir en `web/src/domain/*.ts` la lógica de `src/domain/*.rs` y
`src/analysis/*.rs` de la versión de terminal, con las mismas reglas de negocio,
el mismo esquema SQL (`web/src/db/migrations.ts`, ya portado, idéntico) y pruebas
equivalentes a las de Rust (`#[cfg(test)]`) en vitest.

## Contrato de base de datos (`web/src/db/sqlite.ts`)

```ts
class Database {
  run(sql, bind?): void                 // escritura
  insert(sql, bind?): number            // devuelve rowid
  all<T>(sql, bind?): T[]               // filas como objetos {col: valor}
  get<T>(sql, bind?): T | undefined
  scalar<T>(sql, bind?): T | undefined  // primera columna de la primera fila
  transaction<T>(f: () => T): T
}
```
`bind` es un array posicional (`?1`, `?2`… o `?`) o un objeto `{ $nombre: valor }`.
Los booleanos se guardan como 0/1 (SQLite). Las fechas: `created_at` etc. son
segundos Unix (número); `day` es la fecha local `'AAAA-MM-DD'`.
En las pruebas: `const db = await Database.create(() => {});` (esquema actual, en memoria).

## Convenciones

- Un fichero por módulo Rust: `diary.ts`, `notebooks.ts`, `tags.ts`, `search.ts`,
  `recurrence.ts`, `tasks.ts`, `reminders.ts`, `goals.ts`, `metrics.ts`,
  `milestones.ts`, `actions.ts`, `plans.ts`, `impulses.ts`, `prompts.ts`,
  `reviews.ts`, y `analysis/trend.ts`, `analysis/spark.ts`.
- Funciones puras y de repositorio con la misma firma conceptual que en Rust:
  `create(db, …)`, `get(db, id)`, `list(db, …)`, `save…`, `set…`, `delete(db, id)`.
  Tipos TS exportados (`interface Entry`, `type Status = 'open' | 'done' | 'dropped'`…).
  Mantén los nombres de campos en inglés como en Rust; los textos de usuario, en
  español, están en `web/src/text/texts.ts` (`T.NOMBRE`), no los dupliques.
- Fechas: usa `web/src/domain/dates.ts` (lo escribe el agente A primero; los demás lo
  importan). API: `nowTs()`, `today(): string` (AAAA-MM-DD local), `tsToDay(ts)`,
  `parseDay(s)`, `addDays(day, n)`, `weekStart(day)`, `daysInMonth(y, m)`,
  `fmtDateShort/Long/Compact`, `fmtRelativeDays`, `fmtTime(ts)`, `parseDayInput(s, today)`,
  `parseTimeInput(s)`, `parseDatetimeInput(s, nowDate)`, nombres en español
  (`WEEKDAYS`, `MONTHS`...). Sin librerías de fechas: `Date` nativo. Las fechas
  `day` son strings; compara lexicográficamente.
- Sin dependencias nuevas. Sin `any` salvo en los límites del binding.
- Comentarios en español, breves; conserva las notas de diseño («hueco ≠ fallo»,
  «nunca racha», etc.) que hay en el Rust.
- Pruebas: `*.test.ts` junto al módulo, con vitest; reproduce los casos de Rust
  (misma intención, mismos valores). Ejecuta `./node_modules/.bin/vitest run` en
  `web/` (no `pnpm vitest`) hasta que todo pase.
- Lee el fichero Rust completo antes de portarlo; no inventes comportamiento.
