import { test, expect } from '../../fixtures/test.fixture';
import { expectSubmitBlocked } from '../../support/interaction-helpers';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login — validações funcionais', () => {
  test('[PUB-LOGIN-02] submit vazio permanece na tela de login', async ({ loginPage, page }) => {
    await loginPage.goto();
    const submit = loginPage.submitButton;
    if (await submit.isDisabled()) {
      await expect(submit).toBeDisabled();
    } else {
      await submit.click();
    }
    await expect(page).toHaveURL(/\/login/);
  });

  test('[PUB-LOGIN-04] e-mail malformado não autentica', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill('email-invalido');
    await loginPage.passwordInput.fill('qualquer-senha');
    await loginPage.submitButton.click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Recuperar senha — validações', () => {
  test('[PUB-REC-02] submit sem e-mail permanece na tela', async ({ page }) => {
    await page.goto('/recuperar-senha');
    const submit = page.getByRole('button', { name: /Enviar|Recuperar|Continuar/i }).first();
    if (await submit.isDisabled()) {
      await expect(submit).toBeDisabled();
    } else {
      await submit.click();
      await expect(page).toHaveURL(/\/recuperar-senha/);
    }
  });

  test('[PUB-REC-03] link voltar ao login redireciona', async ({ page }) => {
    await page.goto('/recuperar-senha');
    const back = page.getByRole('link', { name: /Voltar|login|Entrar/i }).first();
    if (await back.isVisible().catch(() => false)) {
      await back.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe('Registro trial — validações', () => {
  test('[PUB-REG-01] exibe formulário de cadastro', async ({ page }) => {
    await page.goto('/registro');
    await expect(page.locator('input[type="email"], #registro-email, input[name*="email" i]').first()).toBeVisible();
  });

  test('[PUB-REG-02] submit incompleto não avança', async ({ page }) => {
    await page.goto('/registro');
    const submit = page.getByRole('button', { name: /Criar|Cadastrar|Continuar|Começar/i }).first();
    if (await submit.isDisabled().catch(() => true)) {
      await expect(submit).toBeDisabled();
      return;
    }
    await expectSubmitBlocked(page, /Criar|Cadastrar|Continuar|Começar/i);
    await expect(page).toHaveURL(/\/registro/);
  });
});

test.describe('Portal do titular — validações', () => {
  test('[PUB-PORT-02] navega entre abas informativas', async ({ page }) => {
    await page.goto('/portal-titular');
    await expect(page.getByRole('heading', { name: /Portal do Titular/i })).toBeVisible();
    await page.getByRole('tab', { name: /Dados Coletados/i }).click();
    await expect(page.getByRole('tabpanel').first()).toBeVisible();
    await page.getByRole('tab', { name: /Contato/i }).click();
    await expect(page.getByText(/DPO|Encarregado/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
