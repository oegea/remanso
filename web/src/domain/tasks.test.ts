import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { addDays, today } from './dates';
import { every } from './recurrence';
import * as tasks from './tasks';
import { POSTPONE_REVIEW_THRESHOLD } from './tasks';

describe('tareas', () => {
  it('una lista por cercanía y aplazamiento', async () => {
    const db = await Database.create(() => {});
    const t = '2026-11-05';
    const a = tasks.create(db, { title: 'Llamar al médico', scheduled_day: '2026-11-03' });
    const b = tasks.create(db, { title: 'Comprar pan', scheduled_day: t });
    const c = tasks.create(db, { title: 'Leer informe', scheduled_day: '2026-11-09' });
    const s = tasks.create(db, { title: 'Aprender a dibujar' });
    const m = tasks.create(db, { title: 'Pedir cita', scheduled_day: '2026-11-06' });
    const l = tasks.create(db, { title: 'Renovar el pasaporte', due_day: '2026-12-20' });
    const d = tasks.create(db, { title: 'Entregar memoria', scheduled_day: '2026-11-20', due_day: t });
    tasks.setPriority(db, b, 1);

    const g = tasks.grouped(db, t);
    expect(g.map((x) => x.bucket)).toEqual(['overdue', 'today', 'tomorrow', 'week', 'later', 'someday']);
    const ids = Object.fromEntries(g.map((x) => [x.bucket, x.tasks.map((y) => y.id)]));
    expect(ids.overdue).toEqual([a]);
    expect(ids.today, 'prioridad primero; el límite de hoy manda sobre el día previsto').toEqual([b, d]);
    expect(ids.tomorrow).toEqual([m]);
    expect(ids.week).toEqual([c]);
    expect(ids.later, 'con sólo fecha límite lejana no se pierde').toEqual([l]);
    expect(ids.someday).toEqual([s]);
    expect(tasks.forToday(db, t).map((x) => x.id)).toEqual([b, a, d]);
    expect(tasks.forNextDays(db, t).map((x) => x.id), 'por día, no por prioridad').toEqual([m, c]);
    expect(tasks.countPending(db, t)).toBe(3);
    expect(tasks.effectiveDay({ scheduled_day: null, due_day: null })).toBeNull();
    expect(tasks.bucketOf({ scheduled_day: '2026-11-12', due_day: null }, t)).toBe('week');
    expect(tasks.bucketOf({ scheduled_day: '2026-11-13', due_day: null }, t)).toBe('later');

    let n = 0;
    for (let i = 0; i < 3; i++) n = tasks.postpone(db, a, '2026-11-10');
    expect(n).toBe(POSTPONE_REVIEW_THRESHOLD);
    const a2 = tasks.get(db, a)!;
    expect(a2.postpone_count).toBe(3);
    expect(a2.scheduled_day).toBe('2026-11-10');
    expect(tasks.postponedOften(db, POSTPONE_REVIEW_THRESHOLD).length).toBe(1);
    expect(tasks.grouped(db, t).find((x) => x.bucket === 'overdue')).toBeUndefined();
  });

  it('completar una recurrente crea la siguiente', async () => {
    const db = await Database.create(() => {});
    const t = today();
    const id = tasks.create(db, { title: 'Regar', scheduled_day: t });
    tasks.setRecurrence(db, id, every(3, 'days'));
    const next = tasks.complete(db, id);
    expect(next, 'debe crear la siguiente').not.toBeNull();
    const n = tasks.get(db, next!)!;
    expect(n.scheduled_day).toBe(addDays(t, 3));
    expect(n.due_day).toBeNull();
    expect(n.recurrence).toEqual(every(3, 'days'));
    expect(tasks.get(db, id)!.status).toBe('done');
    expect(tasks.listDone(db).length).toBe(1);
    tasks.reopen(db, id);
    expect(tasks.get(db, id)!.status).toBe('open');
  });

  it('la base en el pasado se recalcula desde hoy', async () => {
    const db = await Database.create(() => {});
    const t = today();
    const id = tasks.create(db, { title: 'Pasear', scheduled_day: addDays(t, -30), due_day: addDays(t, -30) });
    tasks.setRecurrence(db, id, every(1, 'weeks'));
    const next = tasks.complete(db, id)!;
    const n = tasks.get(db, next)!;
    expect(n.scheduled_day).toBe(addDays(t, 7));
    expect(n.due_day).toBe(addDays(t, 7));
    expect(tasks.complete(db, 9999)).toBeNull();
  });

  it('subtareas y proyectos', async () => {
    const db = await Database.create(() => {});
    const p = tasks.createProject(db, 'Libro', null);
    const t = tasks.create(db, { title: 'Capítulo 1', project_id: p });
    const s1 = tasks.create(db, { title: 'Esquema', parent_id: t, project_id: p });
    tasks.create(db, { title: 'Borrador', parent_id: t, project_id: p });
    tasks.complete(db, s1);
    const task = tasks.get(db, t)!;
    expect([task.subtasks_total, task.subtasks_done]).toEqual([2, 1]);
    expect(tasks.subtasks(db, t).length).toBe(2);
    const projects = tasks.listProjects(db, false);
    expect(projects[0].open_tasks).toBe(2); // tarea + subtarea abierta
    expect(projects[0].done_tasks).toBe(1);
    expect(tasks.projectName(db, p)).toBe('Libro');
    expect(tasks.listForProject(db, p).length, 'sólo tareas de primer nivel').toBe(1);
    tasks.dropTask(db, t, 'ya no me interesa');
    const dropped = tasks.get(db, t)!;
    expect(dropped.status).toBe('dropped');
    expect(dropped.notes).toContain('Cerrada: ya no me interesa');
    tasks.renameProject(db, p, ' Novela ');
    tasks.setProjectArchived(db, p, true);
    expect(tasks.listProjects(db, false)).toEqual([]);
    expect(tasks.listProjects(db, true)[0]).toMatchObject({ name: 'Novela', archived: true });
    tasks.deleteProject(db, p);
    expect(tasks.get(db, t)!.project_id, 'la tarea sobrevive al proyecto').toBeNull();
    tasks.delete(db, t);
    expect(tasks.get(db, t)).toBeNull();
    expect(tasks.get(db, s1), 'las subtareas caen con la tarea').toBeNull();
  });

  it('consultas de calendario', async () => {
    const db = await Database.create(() => {});
    tasks.create(db, { title: 'a', scheduled_day: '2026-11-10' });
    tasks.create(db, { title: 'b', due_day: '2026-11-10' });
    tasks.create(db, { title: 'c', scheduled_day: '2026-11-12' });
    expect(tasks.onDay(db, '2026-11-10').length).toBe(2);
    expect(tasks.daysWithTasks(db, '2026-11-01', '2026-11-30')).toEqual([['2026-11-10', 2], ['2026-11-12', 1]]);
  });

  it('campos sueltos y objetivo', async () => {
    const db = await Database.create(() => {});
    const id = tasks.create(db, { title: ' x ' });
    tasks.setTitle(db, id, ' Nuevo ');
    tasks.setNotes(db, id, 'n');
    tasks.setPriority(db, id, 5);
    tasks.setScheduled(db, id, '2026-12-01');
    tasks.setDue(db, id, '2026-12-02');
    tasks.setGoal(db, id, 3);
    const t = tasks.get(db, id)!;
    expect(t).toMatchObject({ title: 'Nuevo', notes: 'n', priority: 1, scheduled_day: '2026-12-01', due_day: '2026-12-02', goal_id: 3 });
    expect(tasks.listForGoal(db, 3).length).toBe(1);
    tasks.dropTask(db, id, '  ');
    expect(tasks.get(db, id)!.notes).toBe('n');
  });
});

describe('hechas hoy', () => {
  it('se quedan al final de la lista, nunca más de diez', async () => {
    const db = await Database.create(() => {});
    const t = today();
    const a = tasks.create(db, { title: 'Hoy hecha', scheduled_day: t });
    const b = tasks.create(db, { title: 'Hoy abierta', scheduled_day: t });
    const c = tasks.create(db, { title: 'Sin fecha hecha', scheduled_day: null });
    tasks.complete(db, a); tasks.complete(db, c);
    expect(tasks.doneOn(db, t).map((x) => x.id).sort()).toEqual([a, c].sort());
    expect(tasks.doneOn(db, addDays(t, -1))).toEqual([]);
    expect(tasks.listOpen(db).map((x) => x.id)).toEqual([b]);
    for (let i = 0; i < 12; i++) tasks.complete(db, tasks.create(db, { title: `t${i}`, scheduled_day: t }));
    expect(tasks.doneOn(db, t)).toHaveLength(10);
  });
});
