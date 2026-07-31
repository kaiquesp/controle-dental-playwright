import { test, expect } from '../fixtures/test.fixture';

test.describe('Controle de prótese — smoke', () => {
  test.beforeEach(async ({ appShell, controleProtesePage }) => {
    await appShell.navigateTo('/controle-protese');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await expect(controleProtesePage.root).toBeVisible({ timeout: 30_000 });
  });

  test('[PRO-01] carrega quadro principal com kanban', async ({ controleProtesePage, page }) => {
    await expect(page).toHaveURL(/\/controle-protese/);
    await expect(page.getByText(/Controle de prótese|Fluxo da prótese/i).first()).toBeVisible();
    await controleProtesePage.expectKanbanColumns();
  });

  test('[PRO-02] exibe botão nova solicitação', async ({ controleProtesePage }) => {
    await expect(controleProtesePage.novaSolicitacaoButton).toBeVisible();
  });

  test('[PRO-03] exibe busca de solicitações', async ({ page }) => {
    await expect(page.getByPlaceholder(/Paciente, profissional ou tipo/i).first()).toBeVisible();
  });

  test('[PRO-06] navega para laboratórios', async ({ page, controleProtesePage }) => {
    await controleProtesePage.laboratoriosLink.click();
    await expect(page).toHaveURL(/\/controle-protese\/laboratorios/);
  });
});

test.describe('Controle de prótese — laboratórios smoke', () => {
  test.beforeEach(async ({ appShell, controleProtesePage }) => {
    await appShell.navigateTo('/controle-protese/laboratorios');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await expect(controleProtesePage.page.getByRole('heading', { name: /Laboratórios/i }).first()).toBeVisible();
  });

  test('[PRO-LAB-01] carrega listagem de laboratórios', async ({ page }) => {
    await expect(page).toHaveURL(/\/controle-protese\/laboratorios/);
    await expect(page.getByText(/Lista de laboratórios/i).first()).toBeVisible();
  });

  test('[PRO-LAB-02] exibe botão novo laboratório', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Novo laboratório/i })).toBeVisible();
  });

  test('[PRO-LAB-04] exibe busca de laboratórios', async ({ page }) => {
    await expect(page.getByPlaceholder(/Buscar por nome, telefone ou e-mail/i).first()).toBeVisible();
  });
});
