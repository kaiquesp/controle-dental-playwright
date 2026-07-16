import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
} from '../../support/interaction-helpers';
import { e2eName } from '../../support/crud-helpers';

test.describe('Relatórios — interações', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/relatorios');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[REL-03] busca por nome filtra sem erro', async ({ page, appShell }) => {
    await appShell.dismissBlockingModals();
    const search = page.getByRole('searchbox', { name: /Buscar relatório/i });
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill('paciente');
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/relatorios/);
    await expect(page.getByRole('heading', { name: /Relatórios/i }).first()).toBeVisible();
  });
});

test.describe('Estoque — interações e CRUD', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/estoque');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[EST-04] modal novo material exibe formulário e cancela', async ({ page }) => {
    await page.getByRole('button', { name: /Novo material/i }).click();
    const dialog = await expectDialogOpen(page, /material|nome/i);
    await expect(page.locator('#nm-nome')).toBeVisible();
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });

  test('[EST-CRUD-01] preenche modal novo material com dados E2E', async ({ page }) => {
    const name = e2eName('Material');

    await page.getByRole('button', { name: /Novo material/i }).click();
    const dialog = page.getByRole('dialog').filter({ has: page.locator('#nm-nome') });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.locator('#nm-nome').fill(name);
    await dialog.locator('#nm-qtd').fill('1');
    await dialog.locator('#nm-min').fill('1');
    await expect(dialog.getByRole('button', { name: /Salvar material/i })).toBeVisible();
    await closeDialog(page);
  });
});

test.describe('Controle de prótese — interações', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/controle-protese');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[PRO-04] modal nova solicitação exibe formulário e cancela', async ({ page }) => {
    await page.getByRole('button', { name: /Nova solicitação/i }).click();
    const dialog = await expectDialogOpen(page, /solicitação|paciente|prótese/i);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });

  test('[PRO-05] busca por termo mantém tela estável', async ({ page, appShell }) => {
    await appShell.dismissBlockingModals();
    const search = page.getByRole('searchbox', { name: /^Buscar$/i });
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill('teste');
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/controle-protese/);
    await expect(page.getByRole('heading', { name: /Controle de prótese/i }).first()).toBeVisible();
  });
});

test.describe('Controle de prótese — laboratórios CRUD', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/controle-protese/laboratorios');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[PRO-LAB-03] modal novo laboratório exibe campos e cancela', async ({ page }) => {
    await page.getByRole('button', { name: /Novo laboratório/i }).click();
    await expectDialogOpen(page, /laboratório|nome/i);
    await expect(page.locator('#controle-protese-lab-nome')).toBeVisible();
    await closeDialog(page);
  });

  test('[PRO-LAB-CRUD-01] cria laboratório E2E e aparece na busca', async ({ page, appShell }) => {
    const name = e2eName('Lab');

    await page.waitForTimeout(1_500);
    await appShell.dismissBlockingModals();

    await page.getByRole('button', { name: /Novo laboratório/i }).click();
    await expectDialogOpen(page);
    await page.locator('#controle-protese-lab-nome').fill(name);
    await page.locator('#controle-protese-lab-tel').fill('(11) 98765-4321');
    await page.getByRole('button', { name: /^Salvar$/i }).click();
    await expect(page.locator('.controle-protese-lab-modal.p-dialog:visible, .p-dialog:visible')).toBeHidden({
      timeout: 20_000,
    });

    await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible({ timeout: 15_000 });

    const search = page.locator('#controle-protese-labs-busca');
    await search.fill(name);
    await page.waitForTimeout(800);
    await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible();
  });
});
