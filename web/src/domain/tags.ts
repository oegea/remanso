/** Etiquetas opcionales sobre cualquier entidad. */
import type { Database } from '../db/sqlite';

export type Id = number;

function normalise(t: string): string {
  return t.trim().replace(/^#+/, '').toLowerCase();
}

export function setTags(db: Database, kind: string, id: Id, tags: string[]): void {
  db.run('DELETE FROM taggings WHERE entity_kind = ?1 AND entity_id = ?2', [kind, id]);
  for (const raw of tags) {
    const t = normalise(raw);
    if (t === '') continue;
    db.run('INSERT OR IGNORE INTO tags(name) VALUES (?1)', [t]);
    const tagId = db.scalar<Id>('SELECT id FROM tags WHERE name = ?1', [t])!;
    db.run('INSERT OR IGNORE INTO taggings(tag_id, entity_kind, entity_id) VALUES (?1, ?2, ?3)', [tagId, kind, id]);
  }
  db.run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM taggings)');
}

export function tagsOf(db: Database, kind: string, id: Id): string[] {
  return db
    .all<{ name: string }>(
      'SELECT t.name FROM tags t JOIN taggings g ON g.tag_id = t.id WHERE g.entity_kind = ?1 AND g.entity_id = ?2 ORDER BY t.name',
      [kind, id],
    )
    .map((r) => r.name);
}

export function allTags(db: Database): [string, number][] {
  return db
    .all<{ name: string; n: number }>(
      'SELECT t.name, count(*) AS n FROM tags t JOIN taggings g ON g.tag_id = t.id GROUP BY t.id ORDER BY t.name',
    )
    .map((r) => [r.name, r.n]);
}

/** Divide «a, b c #d» en etiquetas. */
export function parseTags(s: string): string[] {
  return s
    .split(/[,\s]+/)
    .map(normalise)
    .filter((t) => t !== '');
}
