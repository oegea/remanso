import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { nowTs } from './dates';
import * as imp from './impulses';

describe('impulsos', () => {
  it('claves de las vías', () => {
    expect(imp.pathwayKey('long_term')).toBe('espera_activa');
    expect(imp.parsePathway('respiracion_lenta')).toBe('breathe');
    expect(imp.parsePathway('nada')).toBeNull();
    expect(imp.outcomeLabel('acted')).toBe('Lo hice');
    expect(imp.outcomeLabel('x')).toBe('');
  });

  it('configuración ida y vuelta', async () => {
    const db = await Database.create(() => {});
    const cfg: imp.ImpulseConfig = {
      goal_id: null,
      wait_seconds: 900,
      future_image: 'Dentro de tres meses me noto más tranquilo',
      distractions: ['Salir al balcón', 'Lavarme la cara'],
      competing_response: 'Cerrar el puño diez segundos',
      env_changes: ['Móvil en otra habitación'],
      last_pathway: 'breathe',
      serious: false,
    };
    imp.saveConfig(db, cfg);
    expect(imp.loadConfig(db, null)).toEqual(cfg);
    const cfg2 = { ...cfg, wait_seconds: 5000 }; // se recorta a 1200
    imp.saveConfig(db, cfg2);
    expect(imp.loadConfig(db, null).wait_seconds).toBe(1200);
    imp.saveConfig(db, { ...cfg, wait_seconds: 10 });
    expect(imp.loadConfig(db, null).wait_seconds).toBe(300);
    // Una fila por técnica, sin duplicados.
    expect(db.scalar<number>('SELECT count(*) FROM strategies')).toBe(6);
    expect(imp.loadConfig(db, 99)).toEqual(imp.defaultConfig(99));
    expect(imp.DEFAULT_WAIT).toBe(600);
  });

  it('ciclo del episodio y patrón', async () => {
    const db = await Database.create(() => {});
    const id = imp.start(db, null);
    imp.setBefore(db, id, 7, 'estrés');
    imp.setContext(db, id, 'cansancio, hambre');
    imp.setPathway(db, id, null, 'surf');
    imp.setAfter(db, id, 600, 6);
    imp.finish(db, id, 'changed', 'ha bajado un poco');
    const e = imp.get(db, id)!;
    expect(e.pathway).toBe('surf');
    expect(e.ended_at).not.toBeNull();
    expect([e.intensity_before, e.intensity_after, e.waited_seconds, e.outcome]).toEqual([7, 6, 600, 'changed']);
    expect(imp.loadConfig(db, null).last_pathway).toBe('surf');
    const id2 = imp.start(db, null);
    imp.finish(db, id2, 'acted', '');
    const p = imp.pattern(db, null, nowTs());
    expect(p.total_30).toBe(2);
    expect(p.total_7).toBe(2);
    expect([p.known_30, p.not_acted_30]).toEqual([2, 1]);
    expect(p.acted_weekly[3]).toBe(1);
    expect(p.contexts).toHaveLength(2);
    expect(p.triggers).toEqual([['estrés', 1]]);
    expect(p.pathways).toEqual([['surf', 1]]);
    expect(p.mean_before).toBe(7);
    expect(p.mean_after).toBe(6);
    expect(p.by_slot.reduce((a, b) => a + b, 0)).toBe(2);
    expect(imp.risingFourWeeks(p)).toBe(false);
    const r = { ...imp.emptyPattern(), acted_weekly: [1, 2, 3, 4] as [number, number, number, number] };
    expect(imp.risingFourWeeks(r)).toBe(true);
    expect(imp.risingFourWeeks({ ...imp.emptyPattern(), acted_weekly: [0, 1, 2, 3] })).toBe(false);
  });

  it('cerrar si queda abierto y recent por objetivo', async () => {
    const db = await Database.create(() => {});
    db.run("INSERT INTO goals(name, started_on, created_at, updated_at) VALUES ('g', '2026-01-01', 1, 1)");
    const a = imp.start(db, 1);
    const b = imp.start(db, null);
    imp.closeIfOpen(db, a);
    const ended = imp.get(db, a)!.ended_at;
    expect(ended).not.toBeNull();
    imp.closeIfOpen(db, a);
    expect(imp.get(db, a)!.ended_at).toBe(ended); // no se sobreescribe
    expect(imp.get(db, b)!.ended_at).toBeNull();
    // finish con outcome null conserva el existente
    imp.finish(db, b, 'partly', '');
    imp.finish(db, b, null, 'nota');
    expect(imp.get(db, b)!.outcome).toBe('partly');
    expect(imp.recent(db, 0, 1).map((e) => e.id)).toEqual([a]);
    expect(imp.recent(db, 0, null)).toHaveLength(2);
    expect(imp.pattern(db, 1, nowTs()).total_30).toBe(1);
  });
});

describe('ventana del patrón', () => {
  it('el periodo anterior no incluye episodios posteriores a su fin', async () => {
    const db = await Database.create(() => {});
    const now = Math.floor(Date.now() / 1000);
    const id = imp.start(db, null);
    imp.finish(db, id, 'changed', '');
    expect(imp.pattern(db, null, now).total_30).toBe(1);
    expect(imp.pattern(db, null, now - 30 * 86_400).total_30).toBe(0);
  });
});
