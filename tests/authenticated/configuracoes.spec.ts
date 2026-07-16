import { test, expect, type Page } from '../fixtures/test.fixture';
import { CONFIG_DIRECT_ROUTES, CONFIG_SECTIONS } from '../data/routes';

async function expectConfigContent(page: Page, label: string, expectPattern: RegExp): Promise<void> {
  const main = page.locator('main');
  const heading = main.getByRole('heading', { name: label, level: 1 });

  if (await heading.isVisible().catch(() => false)) {
    await expect(heading).toBeVisible();
    return;
  }

  await expect(main.getByText(expectPattern).and(page.locator(':visible')).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Configurações — hub', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-01] carrega hub de configurações', async ({ page }) => {
    await expect(page).toHaveURL(/\/configuracoes/);
    await expect(page.locator('app-configuracoes-content, .config').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Conta e sistema|Gestão da clínica/i).first()).toBeVisible();
  });

  test('[CFG-01] exibe navegação por abas internas', async ({ page }) => {
    const tabsNav = page.locator('.config__tabs, nav[aria-label="Seções"]');
    await expect(tabsNav.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Configurações — submenus', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  for (const section of CONFIG_SECTIONS) {
    test(`[${section.id}] exibe seção ${section.label}`, async ({ page, appShell }) => {
      const tab = appShell.configTab(section.label);
      await expect(tab).toBeVisible();

      if ('disabled' in section && section.disabled) {
        await expect(tab).toBeDisabled();
        return;
      }

      await tab.click();
      await appShell.dismissBlockingModals();
      await expect(tab).toHaveClass(/config__tab--active/);
      await expectConfigContent(page, section.label, section.expectPattern);
    });
  }
});

test.describe('Configurações — rotas diretas', () => {
  for (const route of CONFIG_DIRECT_ROUTES) {
    test(`[${route.id}] carrega ${route.name}`, async ({ page, appShell }) => {
      await appShell.navigateTo(route.path);
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();

      if ('moduleId' in route && route.moduleId === 'comissoes') {
        expect(page.url()).not.toContain('/login');
        return;
      }

      await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));
      await expectConfigContent(page, route.name, route.expectPattern);
    });
  }
});
