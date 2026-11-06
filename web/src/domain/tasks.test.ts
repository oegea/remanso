import { describe, it, expect } from 'vitest';
import { Database } from '../db/sqlite';
import { addDays, today } from './dates';
import { every } from './recurrence';
import * as tasks from './tasks';
import { POSTPONE_REVIEW_THRESHOLD } from './tasks';

describe('tareas', () => {
  it('vistas y aplazamiento', async () => {
    const db = await Database.create(() => {});
    const t = '2026-11-05';
    const a = tasks.create(db, { title: 'Llamar al médico', scheduled_day: '2026-11-03' });
    const b = tasks.create(db, { title: 'Comprar pan', scheduled_day: t });
    tasks.create(db, { title: 'Leer informe', scheduled_day: '2026-11-09' });
    const s = tasks.create(db, { title: 'Aprender a dibujar' });
    tasks.setPriority(db, b, 1);

    const td = tasks.list(db, 'today', t, null);
    expect(td.map((x) => x.id), 'prioridad primero; la vencida sigue siendo pendiente').toEqual([b, a]);
    expect(tasks.list(db, 'upcoming', t, null).length).toBe(1);
    expect(tasks.list(db, 'someday', t, null)[0].id).toBe(s);
    expect(tasks.countPending(db, t)).toBe(2);

    let n = 0;
    for (let i = 0; i < 3; i++) n = tasks.postpone(db, a, '2026-11-10');
    expect(n).toBe(POSTPONE_REVIEW_THRESHOLD);
    const a2 = tasks.get(db, a)!;
    expect(a2.postpone_count).toBe(3);
    expect(a2.scheduled_day).toBe('2026-11-10');
    expect(tasks.postponedOften(db, POSTPONE_REVIEW_THRESHOLD).length).toBe(1);
    expect(tasks.list(db, 'today', t, null).length).toBe(1);
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
    expect(tasks.list(db, 'done', t, null).length).toBe(1);
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

describe('hechas hoy por vista', () => {
  it('se quedan al final de su vista, nunca más de diez', async () => {
    const db = await Database.create(() => {});
    const t = today();
    const a = tasks.create(db, { title: 'Hoy hecha', scheduled_day: t });
    const b = tasks.create(db, { title: 'Hoy abierta', scheduled_day: t });
    const c = tasks.create(db, { title: 'Sin fecha hecha', scheduled_day: null });
    const d = tasks.create(db, { title: 'Próxima hecha', scheduled_day: addDays(t, 2) });
    tasks.complete(db, a); tasks.complete(db, c); tasks.complete(db, d);
    expect(tasks.doneToday(db, 'today', t).map((x) => x.id)).toEqual([a]);
    expect(tasks.doneToday(db, 'someday', t).map((x) => x.id)).toEqual([c]);
    expect(tasks.doneToday(db, 'upcoming', t).map((x) => x.id)).toEqual([d]);
    expect(tasks.doneToday(db, 'done', t)).toEqual([]);
    expect(tasks.list(db, 'today', t).map((x) => x.id)).toEqual([b]);
    for (let i = 0; i < 12; i++) tasks.complete(db, tasks.create(db, { title: `t${i}`, scheduled_day: t }));
    expect(tasks.doneToday(db, 'today', t)).toHaveLength(10);
  });
});
