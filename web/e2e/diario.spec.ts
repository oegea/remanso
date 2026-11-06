import { test, expect } from '@playwright/test';

test('el texto no se pierde al poner título enseguida y salir', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Saltar la presentación' }).click();
  await page.getByRole('button', { name: 'Entendido' }).click();
  await page.getByLabel('Contraseña nueva').fill('clave-de-prueba');
  await page.getByLabel('Repite la contraseña').fill('clave-de-prueba');
  await page.getByRole('button', { name: 'Crear' }).click();
  await page.getByRole('button', { name: 'Escribir' }).click();
  await page.getByLabel('Texto').fill('Hoy he salido a caminar media hora.');
  await page.getByRole('textbox', { name: 'Título' }).fill('Paseo');
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByText('7 palabras')).toBeVisible();
  await page.getByText('Paseo').first().click();
  await expect(page.getByLabel('Texto')).toHaveValue('Hoy he salido a caminar media hora.');
});
