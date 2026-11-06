import { test, expect, type Page } from '@playwright/test';

const PW = 'clave-de-prueba';

/** Recorre la presentación inicial paso a paso hasta llegar al aviso de salud. */
async function passWelcome(page: Page) {
  for (const title of ['Hola', 'Nace de un conocimiento compartido', 'Sin nada que venderte', 'Un regalo', 'Tuyo, y sólo tuyo', 'Código abierto', 'Quién hay detrás']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }
}

async function firstUse(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hola' })).toBeVisible();
  await passWelcome(page);
  await expect(page.getByRole('heading', { name: 'Antes de empezar' })).toBeVisible();
  await page.getByRole('button', { name: 'Entendido' }).last().click();
  await page.getByLabel('Contraseña nueva').fill(PW);
  await page.getByLabel('Repite la contraseña').fill(PW);
  await page.getByRole('button', { name: 'Crear' }).last().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('de 2026', { timeout: 20_000 });
}

async function go(page: Page, label: string) {
  // En móvil, algunos destinos están bajo «Más»; en escritorio todos están en la barra lateral.
  const nav = page.getByRole('navigation', { name: 'Secciones' });
  const direct = nav.getByRole('link', { name: label, exact: true });
  if (await direct.count()) { await direct.first().click(); return; }
  await nav.getByRole('link', { name: 'Más', exact: true }).click();
  // En «Más» cada enlace lleva una línea de descripción: se busca por el principio del nombre.
  await page.getByRole('link', { name: new RegExp('^' + label + '\\b') }).first().click();
}

test.describe.serial('recorrido completo', () => {
  test('primer uso, diario, cuadernos, tareas, recordatorios, objetivos, revisión, impulso, copia y bloqueo', async ({ page }) => {
    test.setTimeout(240_000); // recorrido largo con capturas de todas las pantallas
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await firstUse(page);
    await expect(page.getByText('Esto es tu Hoy')).toBeVisible();

    // Diario: escribir, título, volver; cuenta de palabras.
    await page.getByRole('button', { name: 'Escribir' }).click();
    await page.getByLabel('Texto').fill('Hoy he salido a caminar media hora.\nMañana quiero levantarme antes.');
    await expect(page.getByText('11 palabras')).toBeVisible();
    // El título se escribe tocándolo en la cabecera; se guarda solo.
    await page.getByRole('textbox', { name: 'Título' }).fill('Paseo');
    await page.getByRole('textbox', { name: 'Título' }).press('Enter');
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(page.getByText('Paseo')).toBeVisible();
    await expect(page.getByText('1 entrada')).toBeVisible();

    // Cuadernos: cuaderno, nota con enlace, volver.
    await go(page, 'Cuadernos');
    await page.getByRole('button', { name: 'Nuevo' }).click();
    await page.locator('.prompt-input:visible').last().fill('Ideas');
    await page.getByRole('button', { name: 'Crear' }).last().click();
    await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible();
    await page.getByRole('button', { name: 'Nota' }).click();
    await page.locator('.prompt-input:visible').last().fill('Primera nota');
    await page.getByRole('button', { name: 'Crear' }).last().click();
    await page.getByLabel('Texto').fill('Cuerpo de la nota con [[Segunda]].');
    await page.getByRole('button', { name: 'Opciones de la nota' }).click();
    await expect(page.getByRole('button', { name: /Enlaces \(1\)/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(page.getByText('Primera nota')).toBeVisible();

    // Tareas: crear, completar, aplazar.
    await go(page, 'Tareas');
    await page.getByRole('button', { name: 'Tarea', exact: true }).click();
    await page.locator('.prompt-input:visible').last().fill('Llamar al dentista');
    await page.getByRole('button', { name: 'Añadir' }).last().click();
    await expect(page.getByText('Llamar al dentista')).toBeVisible();
    await page.getByRole('button', { name: 'Tarea', exact: true }).click();
    await page.locator('.prompt-input:visible').last().fill('Comprar pan');
    await page.getByRole('button', { name: 'Añadir' }).last().click();
    await page.getByRole('button', { name: 'Abrir Comprar pan' }).click();
    // El título se edita tocándolo, sin pasar por ningún botón.
    await page.getByRole('dialog').getByRole('textbox', { name: 'Título de la tarea' }).fill('Comprar pan integral');
    await page.getByRole('dialog').getByRole('textbox', { name: 'Título de la tarea' }).press('Enter');
    await page.getByRole('dialog').getByRole('button', { name: 'Aplazar' }).click();
    await page.locator('.prompt-input:visible').last().fill('mañana');
    await page.getByRole('button', { name: 'Aceptar' }).last().click();
    await page.waitForTimeout(400);
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await expect(page.getByText('Comprar pan')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Próximas' }).click();
    await expect(page.getByText('Comprar pan')).toBeVisible();
    await page.getByRole('tab', { name: 'Hoy' }).click();
    await page.getByRole('button', { name: 'Marcar hecha', exact: true }).first().click();
    // La tarea marcada no desaparece: queda al final, bajo «Hechas hoy».
    await expect(page.getByRole('heading', { name: 'Hechas hoy' })).toBeVisible();
    await expect(page.getByText('Llamar al dentista')).toBeVisible();
    await page.getByRole('tab', { name: 'Hechas' }).click();
    await expect(page.getByText('Llamar al dentista')).toBeVisible();
    // Un proyecto es una pantalla propia, con «Atrás» que devuelve a la pestaña Proyectos.
    await page.getByRole('tab', { name: 'Proyectos' }).click();
    await page.getByRole('button', { name: 'Proyecto', exact: true }).click();
    await page.locator('.prompt-input:visible').last().fill('Mudanza');
    await page.getByRole('button', { name: 'Crear' }).last().click();
    await page.getByRole('button', { name: /^Mudanza/ }).click();
    await expect(page).toHaveURL(/\/tareas\/proyecto\/\d+$/);
    await expect(page.getByRole('heading', { name: 'Mudanza' })).toBeVisible();
    await page.getByRole('button', { name: 'Tarea', exact: true }).click();
    await page.locator('.prompt-input:visible').last().fill('Pedir presupuesto');
    await page.getByRole('button', { name: 'Añadir' }).last().click();
    await expect(page.getByText('Pedir presupuesto')).toBeVisible();
    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByRole('tab', { name: 'Proyectos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Mudanza')).toBeVisible();

    // Recordatorios: crear uno vencido (+0m no es válido: usamos una hora pasada ⇒ mañana) y uno futuro.
    await go(page, 'Recordatorios');
    await page.getByRole('button', { name: 'Nuevo' }).click();
    await page.locator('.prompt-input:visible').last().fill('Revisar objetivos');
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.locator('.prompt-input:visible').last().fill('mañana 9:00');
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.locator('.prompt-input:visible').last().fill('semanal');
    await page.getByRole('button', { name: 'Guardar' }).last().click();
    await expect(page.getByText('Revisar objetivos')).toBeVisible();
    await expect(page.getByText('cada semana')).toBeVisible();

    // Objetivos: aviso de seguridad, asistente, métrica, registro, acción.
    await go(page, 'Objetivos');
    await page.getByRole('button', { name: 'Nuevo' }).click();
    await expect(page.getByText('No es un servicio sanitario')).toBeVisible();
    await page.getByRole('button', { name: 'Entendido' }).last().click();
    await page.locator('.prompt-input:visible').last().fill('Leer 20 minutos');
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('option', { name: /proceso/ }).click();
    await page.getByRole('option', { name: /Proyecto personal/ }).click();
    await expect(page.getByRole('dialog').getByText('¿Por qué te importa?')).toBeVisible();
    await page.locator('.prompt-input:visible').last().fill('Disfrutar leyendo');
    await page.getByRole('button', { name: 'Aceptar' }).last().click();
    await expect(page.getByText('Disfrutar leyendo')).toBeVisible();
    await page.getByRole('tab', { name: 'Métricas' }).click();
    await page.getByRole('button', { name: 'Nueva métrica' }).click();
    await page.locator('.prompt-input:visible').last().fill('Páginas');
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('option', { name: /cantidad entera/ }).click();
    await page.getByRole('option', { name: 'No', exact: true }).click();
    await page.locator('.prompt-input:visible').last().fill('páginas');
    await page.getByRole('button', { name: 'Aceptar' }).last().click();
    await expect(page.getByText('Páginas', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await page.locator('.prompt-input:visible').last().fill('12');
    await page.getByRole('button', { name: 'Registrar', exact: true }).last().click();
    await expect(page.getByText('12 páginas')).toBeVisible();
    await page.getByRole('button', { name: 'Ver', exact: true }).click();
    await expect(page.getByText('Todavía no hay datos suficientes')).toBeVisible();
    await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByRole('tab', { name: 'Acciones' }).click();
    await page.getByRole('button', { name: 'Nueva acción' }).click();
    await page.locator('.prompt-input:visible').last().fill('Leer en el sofá');
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('option', { name: /quiero hacer/ }).click();
    await page.locator('.prompt-input:visible').last().fill('al terminar de cenar');
    await page.getByRole('button', { name: 'Aceptar' }).last().click();
    await expect(page.getByText('3 veces por semana')).toBeVisible();
    await page.getByRole('button', { name: /Sin registro hoy/ }).click();
    await expect(page.getByText('1 de 3 esta semana')).toBeVisible();
    await page.getByRole('tab', { name: 'Planes' }).click();
    await page.getByRole('button', { name: 'Nuevo plan' }).click();
    await page.locator('.prompt-input:visible').last().fill('al terminar de cenar');
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.locator('.prompt-input:visible').last().fill('abro el libro en el sofá');
    await page.getByRole('button', { name: 'Guardar' }).last().click();
    await expect(page.getByText('abro el libro en el sofá')).toBeVisible();

    // Hoy muestra la acción y el objetivo.
    await go(page, 'Hoy');
    await expect(page.getByText('Leer en el sofá')).toBeVisible();
    await expect(page.getByText(/1 objetivo activo/)).toBeVisible();

    // Ajustes: activar cierre del día; Revisión: sesión que crea tareas.
    await go(page, 'Ajustes');
    await page.getByRole('button', { name: 'no', exact: true }).nth(1).click(); // Cierre del día
    await go(page, 'Revisión');
    await page.getByRole('button', { name: /Cierre del día/ }).click();
    await expect(page.getByText('1 de 3')).toBeVisible();
    await page.getByRole('button', { name: 'Responder' }).click();
    await page.locator('.prompt-input:visible').last().fill('El paseo de la tarde');
    await page.getByRole('button', { name: 'Guardar' }).last().click();
    await page.getByRole('button', { name: 'omitir' }).click();
    await page.getByRole('button', { name: 'Responder' }).click();
    await page.locator('.prompt-input:visible').last().fill('Comprar sellos; Llamar a Ana');
    await page.getByRole('button', { name: 'Guardar' }).last().click();
    await expect(page.getByText('2 tareas creadas')).toBeVisible();
    await page.getByRole('button', { name: 'Volver' }).last().click();
    await expect(page.getByText('hecha hoy', { exact: true }).first()).toBeVisible();

    // Impulso: recorrido completo.
    await go(page, 'Impulso');
    await page.getByRole('button', { name: 'Leer 20 minutos' }).click();
    await expect(page.getByText('Para.')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'estrés' }).click();
    await page.getByRole('button', { name: 'hambre' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('button', { name: /Surfear/ }).click();
    await expect(page.getByText('Nota el impulso')).toBeVisible();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'No lo hice' }).click();
    await page.getByRole('button', { name: 'Guardar' }).last().click();
    await expect(page.getByText('Registrado.')).toBeVisible();
    await page.getByRole('button', { name: 'Volver' }).last().click();

    // Impulso: vía «respirar» con guía animada; desliz con daño → aviso en hoja (no en toast).
    await go(page, 'Impulso');
    await page.getByRole('button', { name: 'Leer 20 minutos' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Omitir' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('button', { name: /Respirar/ }).click();
    await expect(page.getByRole('heading', { name: 'Respirar despacio' })).toBeVisible();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.getByRole('group', { name: 'Guía de respiración' })).toBeVisible();
    await expect(page.getByText(/quedan .*Puedes terminar cuando quieras/)).toBeVisible();
    await expect(page.getByText(/^(Inspira|Espira)$/)).toBeVisible();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Lo hice', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar' }).last().click();
    await expect(page.getByText('Un desliz es un dato, no un veredicto.')).toBeVisible();
    await page.getByRole('button', { name: 'cansancio' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('button', { name: 'Aceptar' }).last().click();
    await page.getByRole('option', { name: 'Sí', exact: true }).click();
    const deriv = page.getByRole('dialog').filter({ hasText: 'Una nota' });
    await expect(deriv.getByText(/herramienta de autoayuda/)).toBeVisible();
    await expect(deriv.getByText(/024/)).toBeVisible();
    await deriv.getByRole('button', { name: 'Entendido' }).click();
    await page.getByRole('button', { name: /Un impulso no me hace peor persona/ }).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.getByRole('link', { name: 'Ver episodios anteriores' }).click();
    await expect(page.getByRole('heading', { name: 'Episodios de impulso' })).toBeVisible();
    await expect(page.locator('.list-item .episode')).toHaveCount(2);
    await page.locator('.list-item .episode').first().click();
    await expect(page.getByRole('dialog').getByText('Respiración lenta', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // Copia de seguridad: descarga un archivo .remanso.
    await go(page, 'Ajustes');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Crear copia de seguridad cifrada/ }).click();
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/^remanso-.*\.remanso$/);

    // Acompañamiento profesional: requiere marcar la casilla; acorta el aviso de métrica sensible.
    await page.getByRole('button', { name: 'no', exact: true }).last().click();
    const sup = page.getByRole('dialog').filter({ hasText: 'Acortar los avisos' });
    await expect(sup.getByRole('button', { name: 'Confirmo y activo' })).toBeDisabled();
    await sup.getByRole('checkbox').check();
    await sup.getByRole('button', { name: 'Confirmo y activo' }).click();
    await expect(page.getByText('Avisos acortados.')).toBeVisible();
    await page.getByRole('button', { name: 'Acerca de' }).click();
    await expect(page.getByText(/AGPL-3.0-or-later/)).toBeVisible();
    await page.getByRole('button', { name: 'Ver la presentación de nuevo' }).click();
    await expect(page.getByRole('heading', { name: 'Hola' })).toBeVisible();
    for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: 'Una nota de salud' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).last().click();

    // Bloquear y desbloquear; contraseña errónea no revela nada.
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByText('Paseo')).toHaveCount(0);
    await page.getByLabel('Contraseña').fill('mala');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Contraseña incorrecta.')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });
    await go(page, 'Hoy');
    await expect(page.getByText('Leer en el sofá')).toBeVisible();

    // Recarga: los datos persisten cifrados y se vuelven a pedir la contraseña.
    await page.reload();
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('de 2026', { timeout: 20_000 });
    await go(page, 'Diario');
    await expect(page.getByText('Paseo')).toBeVisible({ timeout: 15_000 });

    expect(errors, errors.join('\n')).toEqual([]);

    // Capturas de cada pantalla para la revisión de diseño (e2e/shots/<proyecto>/).
    const shot = async (name: string) => { await page.waitForTimeout(400); await page.screenshot({ path: `e2e/shots/${test.info().project.name}/${name}.png`, fullPage: false }); };
    await go(page, 'Hoy'); await shot('01-hoy');
    await go(page, 'Diario'); await shot('02-diario');
    await page.getByText('Paseo').first().click(); await shot('03-entrada');
    await page.getByRole('button', { name: 'Listo' }).click();
    await go(page, 'Cuadernos'); await shot('04-cuadernos');
    await page.getByRole('link', { name: /Ideas/ }).click(); await shot('05-notas');
    await page.getByText('Primera nota').click(); await shot('06-nota');
    await page.getByRole('button', { name: 'Listo' }).click();
    await go(page, 'Tareas'); await shot('07-tareas');
    await page.getByRole('tab', { name: 'Calendario' }).click(); await shot('08-calendario');
    await page.getByRole('tab', { name: 'Proyectos' }).click(); await page.getByRole('button', { name: /^Mudanza/ }).click(); await shot('07b-proyecto'); await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByRole('tab', { name: 'Próximas' }).click();
    await page.getByRole('button', { name: /^Abrir / }).first().click(); await shot('09-tarea');
    await page.keyboard.press('Escape');
    await go(page, 'Recordatorios'); await shot('10-recordatorios');
    await go(page, 'Objetivos'); await shot('11-objetivos');
    await page.getByRole('link', { name: /Leer 20 minutos/ }).click(); await shot('12-objetivo');
    await page.getByRole('tab', { name: 'Métricas' }).click(); await shot('13-metricas');
    await page.getByRole('button', { name: 'Ver', exact: true }).click(); await shot('14-metrica');
    await page.getByRole('button', { name: 'Atrás' }).click();
    await page.getByRole('tab', { name: 'Acciones' }).click(); await shot('15-acciones');
    await page.getByRole('tab', { name: 'Hitos' }).click(); await shot('16-hitos');
    await page.getByRole('tab', { name: 'Planes' }).click(); await shot('17-planes');
    await go(page, 'Revisión'); await shot('18-revision');
    // Un conjunto apagado se enciende desde aquí mismo, con sus preguntas a la vista.
    await page.getByRole('button', { name: /Apertura del día/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Encender estas preguntas');
    await expect(page.getByRole('dialog')).toContainText('valga la pena');
    await shot('18a-encender');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    // Las respuestas de la sesión de cierre se releen en «Sesiones anteriores».
    await page.getByRole('button', { name: /2 respuestas/ }).click();
    await expect(page.getByRole('dialog')).toContainText('El paseo de la tarde');
    await expect(page.getByRole('dialog')).toContainText('Comprar sellos; Llamar a Ana');
    await shot('18b-sesion-anterior');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await go(page, 'Impulso'); await shot('19-impulso');
    await page.getByRole('button', { name: 'Leer 20 minutos' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Omitir' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).last().click();
    await page.getByRole('button', { name: /Respirar/ }).click(); await shot('19a-respirar-intro');
    await page.getByRole('button', { name: 'Empezar' }).click(); await shot('19b-respirar');
    await page.keyboard.press('Escape');
    await go(page, 'Revisión'); await page.getByRole('button', { name: /Episodios y patrón de impulsos/ }).click(); await expect(page.getByRole('heading', { name: /Patrón de episodios/ })).toBeVisible(); await shot('19c-episodios');
    await page.getByRole('listitem').first().click(); await shot('19d-episodio');
    await page.keyboard.press('Escape');
    await go(page, 'Buscar'); await page.getByRole('searchbox').fill('caminar'); await shot('20-buscar');
    await go(page, 'Ajustes'); await shot('21-ajustes');
    await page.getByRole('button', { name: /Técnicas y su evidencia/ }).click(); await shot('22-tecnicas');
    await page.getByRole('button', { name: /Plan si–entonces/ }).click(); await shot('22a-tecnica');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Acerca de' }).click(); await shot('22b-acerca');
    await page.getByRole('button', { name: 'Ver la presentación de nuevo' }).click(); await shot('22c-presentacion');
    await page.getByRole('button', { name: 'Siguiente' }).click(); await shot('22d-presentacion-2');
    await page.getByRole('button', { name: 'Cerrar' }).last().click();
    await page.getByRole('button', { name: 'Bloquear ahora' }).click(); await shot('23-bloqueo');
  });

  test('la presentación inicial se recorre paso a paso', async ({ page }) => {
    await page.goto('/');
    const shot = async (name: string) => { await page.waitForTimeout(450); await page.screenshot({ path: `e2e/shots/${test.info().project.name}/${name}.png`, fullPage: false }); };
    await expect(page.getByRole('heading', { name: 'Hola' })).toBeVisible(); await shot('00a-bienvenida-1');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: 'Nace de un conocimiento compartido' })).toBeVisible(); await shot('00b-bienvenida-2');
    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByRole('heading', { name: 'Hola' })).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: 'Un regalo' })).toBeVisible(); await shot('00c-bienvenida-4');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: 'Tuyo, y sólo tuyo' })).toBeVisible(); await shot('00c-bienvenida-5');
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: 'Quién hay detrás' })).toBeVisible();
    await expect(page.getByText(/imoriol@duck.com/)).toBeVisible(); await shot('00c-bienvenida-6');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: 'Antes de empezar' })).toBeVisible(); await shot('00d-aviso');
  });
});
