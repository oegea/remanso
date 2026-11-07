import { expect, type Page } from '@playwright/test';

export const PW = 'clave-de-prueba';

/** Recorre la presentación inicial paso a paso hasta llegar al aviso de salud. */
export async function passWelcome(page: Page) {
  for (const title of ['Hola', 'Nace de un conocimiento compartido', 'Sin nada que venderte', 'Un regalo', 'Tuyo, y sólo tuyo', 'Código abierto', 'Quién hay detrás']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }
}

export async function firstUse(page: Page) {
  // En estas pruebas no se ofrece el atajo biométrico al entrar (la prueba dedicada lo cubre).
  await page.addInitScript(() => { try { localStorage.setItem('remanso.biometria.rechazada', '1'); } catch { /* sin almacenamiento */ } });
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

export async function go(page: Page, label: string) {
  // En móvil, algunos destinos están bajo «Más»; en escritorio todos están en la barra lateral.
  const nav = page.getByRole('navigation', { name: 'Secciones' });
  const direct = nav.getByRole('link', { name: label, exact: true });
  if (await direct.count()) { await direct.first().click(); return; }
  await nav.getByRole('link', { name: 'Más', exact: true }).click();
  // En «Más» cada enlace lleva una línea de descripción: se busca por el principio del nombre.
  await page.getByRole('link', { name: new RegExp('^' + label + '\\b') }).first().click();
}

