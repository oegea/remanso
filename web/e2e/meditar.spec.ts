import { expect, test } from '@playwright/test';
import { firstUse, go } from './helpers';

// Meditando no se toca la pantalla. La sesión cuenta como uso: el bloqueo por inactividad
// (diez minutos por defecto) no puede cortarla a medias ni dejarla sin registrar (ADR-026).
test('una sesión de quince minutos llega al final sin que la aplicación se bloquee', async ({ page }) => {
  // El reloj simulado se instala antes de entrar: el temporizador del bloqueo se arma al desbloquear.
  await page.clock.install();
  await firstUse(page);
  await go(page, 'Meditar');
  await page.getByRole('button', { name: '15 min', exact: true }).click();
  // Sin voz: la prueba va del reloj y del bloqueo, no del audio.
  await page.locator('.list-item', { hasText: 'Voz que guía' }).getByRole('button').click();
  const start = page.getByRole('button', { name: /^Empezar/ });
  await start.scrollIntoViewIfNeeded();
  await start.click({ timeout: 5_000 }).catch(() => start.dispatchEvent('click'));
  await expect(page.getByText('Para empezar')).toBeVisible();

  await page.clock.runFor(9 * 60_000);
  await expect(page.locator('.med-stage')).toBeVisible();
  await page.clock.runFor(3 * 60_000);
  await expect(page.locator('.med-stage'), 'pasado el minuto diez, la sesión sigue').toBeVisible();
  await page.clock.runFor(3 * 60_000 + 5_000);
  await expect(page.getByRole('heading', { name: '¿Cómo te sientes ahora?' })).toBeVisible();
  await expect(page.getByText(/15:00 de 15:00/)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/1 sesión · 15 minutos/)).toBeVisible();
});
