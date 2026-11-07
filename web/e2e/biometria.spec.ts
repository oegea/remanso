import { test, expect, type Page } from '@playwright/test';
import { PW, passWelcome } from './helpers';

/**
 * Atajo biométrico con un autenticador virtual (CDP) que verifica a la persona y admite PRF.
 * Sólo Chromium de escritorio: es donde existe el autenticador virtual.
 */
test.describe('atajo biométrico', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile, 'autenticador virtual sólo en Chromium de escritorio');

  async function virtualAuthenticator(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable', { enableUI: false });
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true },
    });
    return { cdp, authenticatorId };
  }

  async function createData(page: Page) {
    await page.goto('/');
    await passWelcome(page);
    await page.getByRole('button', { name: 'Entendido' }).last().click();
    await page.getByLabel('Contraseña nueva').fill(PW);
    await page.getByLabel('Repite la contraseña').fill(PW);
    await page.getByRole('button', { name: 'Crear' }).last().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('de 2026', { timeout: 20_000 });
  }

  test('se ofrece al entrar con contraseña, se activa, abre sin contraseña y se desactiva', async ({ page }) => {
    await virtualAuthenticator(page);
    await createData(page);
    const shot = async (name: string) => { await page.waitForTimeout(450); await page.screenshot({ path: `e2e/shots/${test.info().project.name}/${name}.png` }); };

    // Bloquear y entrar con contraseña: se ofrece el atajo una vez; «Ahora no» entra sin activarlo.
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: /la próxima vez/ })).toBeVisible({ timeout: 20_000 });
    await shot('24-biometria-oferta');
    await page.getByRole('button', { name: 'Ahora no' }).last().click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();

    // Rechazado: la próxima vez no se vuelve a ofrecer.
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /la próxima vez/ })).toHaveCount(0);

    // Activar desde Ajustes: contraseña + verificación del sistema.
    const row = page.getByText(/^Entrar con (Face ID o Touch ID|huella o cara)$/).locator('..').locator('..');
    await row.getByRole('button', { name: 'no' }).click();
    await page.getByLabel(/Escribe la contraseña para activar/).fill('mala');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Contraseña incorrecta.')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/Escribe la contraseña para activar/).fill(PW);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Contraseña comprobada.')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^Vincular con/ }).click();
    await expect(row.getByRole('button', { name: 'sí' })).toBeVisible({ timeout: 20_000 });

    // «Bloquear ahora» es a propósito: el atajo NO se dispara solo; hace falta un toque.
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await expect(page.getByRole('button', { name: /^Entrar con/ })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Entrar con/ }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });

    // Recargar: al abrir la aplicación sí entra solo, y se vuelve a la misma pantalla.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 20_000 });

    // Cambiar la contraseña re-envuelve la clave: el atajo sigue funcionando.
    await page.getByRole('button', { name: 'Cambiar la contraseña' }).click();
    await page.getByLabel('Contraseña actual').fill(PW);
    await page.getByLabel('Contraseña nueva', { exact: true }).fill('otra-clave-nueva');
    await page.getByLabel('Repite la contraseña').fill('otra-clave-nueva');
    await page.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await expect(page.getByText(/La contraseña ha cambiado/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Mantener el atajo' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
    await expect(row.getByRole('button', { name: 'sí' })).toBeVisible();
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await page.getByRole('button', { name: /^Entrar con/ }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });

    // Desactivar: vuelve a pedir contraseña (la nueva).
    await row.getByRole('button', { name: 'sí' }).click();
    await expect(row.getByRole('button', { name: 'no' })).toBeVisible();
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Entrar con/ })).toHaveCount(0);
    await page.getByLabel('Contraseña').fill('otra-clave-nueva');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 20_000 });
  });

  test('si el atajo deja de abrir los datos, se descarta y se pide la contraseña', async ({ page }) => {
    const { cdp, authenticatorId } = await virtualAuthenticator(page);
    await createData(page);
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    const row = page.getByText(/^Entrar con (Face ID o Touch ID|huella o cara)$/).locator('..').locator('..');
    await row.getByRole('button', { name: 'no' }).click();
    await page.getByLabel(/Escribe la contraseña para activar/).fill(PW);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /^Vincular con/ }).click({ timeout: 20_000 });
    await expect(row.getByRole('button', { name: 'sí' })).toBeVisible({ timeout: 20_000 });
    // Sin el autenticador (otro dispositivo, llave borrada) no hay secreto: queda el botón y la contraseña.
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await expect(page.getByRole('button', { name: /^Entrar con/ })).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await page.screenshot({ path: `e2e/shots/${test.info().project.name}/23b-bloqueo-biometria.png` });
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 20_000 });
  });

  test('cancelar la verificación en la oferta permite reintentar; el atajo entra aunque la contraseña esté frenada', async ({ page }) => {
    const { cdp, authenticatorId } = await virtualAuthenticator(page);
    await createData(page);
    await page.getByRole('link', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: /la próxima vez/ })).toBeVisible({ timeout: 20_000 });
    // La persona no supera la verificación: se explica y se puede volver a intentar sin escribir nada.
    // (El autenticador virtual de Chromium no vuelve a «verificado» una vez puesto en falso, así
    // que el reintento se hace con un autenticador nuevo; el flujo de la aplicación es el mismo.)
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });
    await page.getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByText(/No se completó la verificación/)).toBeVisible({ timeout: 15_000 });
    expect((await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials, 'no queda ninguna llave a medias').toHaveLength(0);
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await virtualAuthenticator(page);
    await page.getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 20_000 });
    const row = page.getByText(/^Entrar con (Face ID o Touch ID|huella o cara)$/).locator('..').locator('..');
    await expect(row.getByRole('button', { name: 'sí' })).toBeVisible();

    // Cuatro contraseñas malas activan el freno; el atajo no lo esquiva ni lo necesita: entra y lo limpia.
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    for (let i = 0; i < 4; i++) {
      await page.getByLabel('Contraseña').fill(`mala-${i}`);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page.getByText(/Contraseña incorrecta|Demasiados intentos/)).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByText(/Demasiados intentos/)).toBeVisible();
    await page.getByRole('button', { name: /^Entrar con/ }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Bloquear ahora' }).click();
    await page.getByLabel('Contraseña').fill(PW);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible({ timeout: 20_000 });
  });
});
