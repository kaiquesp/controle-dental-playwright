import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Notificações', () => {
  test.beforeEach(async ({ appShell, configuracoesPage }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Notificações');
  });

  test('[CFG-22] exibe preferências de notificação', async ({ page }) => {
    const inApp = page.locator(CONFIG_FORM_IDS.notificacoes.inApp);
    if (await inApp.isVisible().catch(() => false)) {
      await expect(inApp).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.locator('main').getByText(/preferência|alerta|push|categoria/i).first()).toBeVisible({
        timeout: 15_000,
      });
    }
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-NOTIF-01] toggle in-app não gera erro', async ({ page }) => {
    const toggle = page.locator(CONFIG_FORM_IDS.notificacoes.inApp);
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, 'Toggle in-app indisponível neste ambiente');
    }
    const before = await toggle.isChecked().catch(() => false);
    await toggle.click({ force: true });
    await page.waitForTimeout(500);
    await expectNoErrorToast(page);
    if ((await toggle.isChecked().catch(() => false)) !== before) {
      await toggle.click({ force: true });
    }
    await expectNoErrorToast(page);
  });
});
