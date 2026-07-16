import { test, expect } from '../fixtures/test.fixture';

test.describe('Relatórios', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/relatorios');
    await appShell.dismissBlockingModals();
  });

  test('[REL-01] carrega hub de relatórios', async ({ page }) => {
    await expect(page).toHaveURL(/\/relatorios/);
    await expect(page.locator('app-relatorios-content, .relatorios').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: /Relatórios/i }).first()).toBeVisible();
  });

  test('[REL-02] exibe busca de relatórios', async ({ page }) => {
    await expect(page.getByPlaceholder(/Buscar relatório/i).first()).toBeVisible();
  });

  test('[REL-04] exibe exportar tudo', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Exportar tudo/i })).toBeVisible();
  });

  test('[REL-05] exibe gráfico faturamento x custos', async ({ page }) => {
    await expect(page.getByText(/Faturamento x custos/i)).toBeVisible();
  });
});

test.describe('Estoque', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/estoque');
    await appShell.dismissBlockingModals();
  });

  test('[EST-01] carrega tela de estoque', async ({ page }) => {
    await expect(page).toHaveURL(/\/estoque/);
    await expect(page.locator('app-estoque-content, .estoque').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Total de itens|Estoque baixo|Valor em estoque/i).first()).toBeVisible();
  });

  test('[EST-02] exibe botão novo material', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Novo material/i })).toBeVisible();
  });

  test('[EST-03] exibe listagem ou estado vazio do inventário', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Itens em estoque/i })).toBeVisible();
    const exportBtn = page.getByRole('button', { name: /Exportar/i });
    const emptyState = page.getByText(/Nenhum material cadastrado/i);
    await expect(exportBtn.or(emptyState).first()).toBeVisible();
  });
});

test.describe('Controle de prótese', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/controle-protese');
    await appShell.dismissBlockingModals();
  });

  test('[PRO-01] carrega quadro principal', async ({ page }) => {
    await expect(page).toHaveURL(/\/controle-protese/);
    await expect(page.locator('app-controle-protese-content').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Controle de prótese|Fluxo da prótese/i).first()).toBeVisible();
  });

  test('[PRO-02] exibe botão nova solicitação', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Nova solicitação/i })).toBeVisible();
  });

  test('[PRO-03] exibe busca de solicitações', async ({ page }) => {
    await expect(page.getByPlaceholder(/Paciente, profissional ou tipo/i).first()).toBeVisible();
  });

  test('[PRO-06] navega para laboratórios', async ({ page }) => {
    await page.getByRole('link', { name: /Laboratórios/i }).click();
    await expect(page).toHaveURL(/\/controle-protese\/laboratorios/);
  });
});

test.describe('Controle de prótese — laboratórios', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/controle-protese/laboratorios');
    await appShell.dismissBlockingModals();
  });

  test('[PRO-LAB-01] carrega listagem de laboratórios', async ({ page }) => {
    await expect(page).toHaveURL(/\/controle-protese\/laboratorios/);
    await expect(page.getByRole('heading', { name: /Laboratórios/i }).first()).toBeVisible();
  });

  test('[PRO-LAB-02] exibe botão novo laboratório', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Novo laboratório/i })).toBeVisible();
  });

  test('[PRO-LAB-04] exibe busca de laboratórios', async ({ page }) => {
    await expect(page.getByPlaceholder(/Buscar por nome, telefone ou e-mail/i).first()).toBeVisible();
  });
});
