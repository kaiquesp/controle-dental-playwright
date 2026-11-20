import type { Page, Route } from '@playwright/test';
import { test, expect } from '../../fixtures/test.fixture';
import { openConfigSection, closeDialog, expectDialogOpen } from '../../support/interaction-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

const PENDING_UPGRADE_ROUTE = '**/api/billing/pending-upgrade';
const SUBSCRIPTION_ROUTE = '**/api/billing/subscription';

/** 1x1 PNG — stands in for the Asaas PIX QR code. */
const QR_CODE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const trialSubscription = {
  status: 'trialing',
  planCode: 'premium_anual',
  planName: 'Avançado',
  billingInterval: 'year',
  trialAtivo: true,
  pagamentoEmDia: true,
  mock: true,
};

const firstContractPixPending = {
  upgradePendente: {
    id: 1,
    planoCodigoAlvo: 'basico',
    metodoPagamento: 'pix',
    valorCents: 5990,
    providerPaymentId: 'pay_e2e_first_contract',
    expiraEm: '2099-01-01T00:00:00.000Z',
    pagamento: {
      instrucoesDisponiveis: true,
      tipo: 'pix',
      paymentId: 'pay_e2e_first_contract',
      valorReais: 59.9,
      vencimento: '2099-01-01',
      checkoutUrl: null,
      pix: {
        qrCodeBase64: QR_CODE_PNG_BASE64,
        copiaECola: '00020126580014br.gov.bcb.pix0136e2e-mock-pix',
        expiraEm: '2099-01-01T23:59:59.000Z',
      },
    },
  },
};

async function fulfillGetJson(route: Route, body: unknown, status = 200): Promise<void> {
  if (route.request().method() !== 'GET') {
    await route.fallback();
    return;
  }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockTrialWithPendingFirstContract(page: Page, pendingStatus = 200): Promise<void> {
  await page.route(SUBSCRIPTION_ROUTE, (route) => fulfillGetJson(route, trialSubscription));
  await page.route(PENDING_UPGRADE_ROUTE, (route) =>
    fulfillGetJson(
      route,
      pendingStatus === 200 ? firstContractPixPending : { erro: 'Falha temporária.' },
      pendingStatus
    )
  );
}

async function unmockTrialWithPendingFirstContract(page: Page): Promise<void> {
  await page.unroute(SUBSCRIPTION_ROUTE);
  await page.unroute(PENDING_UPGRADE_ROUTE);
}

test.describe('Billing — assinatura com mock', () => {
  test.beforeEach(async ({ appShell, page }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await openConfigSection(page, 'Plano e cobrança');
  });

  test('[BILL-01] aba assinatura carrega sem erro de API', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Assinatura|Plano e cobrança|Plano/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/plano|assinatura|faturamento|cobrança/i).and(page.locator(':visible')).first()
    ).toBeVisible();
  });

  test('[BILL-02] não dispara checkout real ao explorar UI', async ({ page }) => {
    const upgradeBtn = page.getByRole('button', { name: /Alterar plano|Upgrade|Mudar plano/i }).first();
    if (!(await upgradeBtn.isVisible().catch(() => false))) {
      return;
    }
    await upgradeBtn.click();
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/asaas|stripe|mercadopago|checkout/i);
    await expectNoErrorToast(page);
    await page.keyboard.press('Escape');
  });

  test('[BILL-03] modal cadastro cartão abre e cancela sem salvar', async ({ page }) => {
    const cardBtn = page.getByRole('button', { name: /cartão|pagamento|forma de pagamento/i }).first();
    if (!(await cardBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão de cartão não visível neste plano');
    }
    await cardBtn.click();
    const dialog = await expectDialogOpen(page, /cartão|pagamento|número/i).catch(() => null);
    if (dialog) {
      await closeDialog(page);
    }
    await expect(page).not.toHaveURL(/asaas|stripe/i);
  });
});

test.describe('Billing — contratação PIX pendente durante o trial', () => {
  test.afterEach(async ({ page }) => {
    await unmockTrialWithPendingFirstContract(page);
  });

  test('[BILL-04] reabre o QR Code da contratação PIX pendente em Plano e cobrança', async ({
    appShell,
    page,
  }) => {
    await mockTrialWithPendingFirstContract(page);
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await openConfigSection(page, 'Plano e cobrança');

    const dialog = page.locator('.assinatura-pagamento-dialog');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText(/ativar o plano escolhido/i)).toBeVisible();
    await expect(dialog.getByText(/diferença proporcional/i)).toHaveCount(0);
    await expect(dialog.locator('img[src^="data:image"]')).toBeVisible();
    await expect(dialog.getByText(/QR Code expira em: \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
    const discardRequests: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && req.url().includes('/billing/pending-upgrade')) {
        discardRequests.push(req.url());
      }
    });

    // "Voltar" stays disabled while the payment is being polled; the header close button is the way out.
    await dialog.locator('.p-dialog-header button').first().click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('Contratação aguardando confirmação')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descartar' })).toHaveCount(0);
    expect(discardRequests).toHaveLength(0);

    await page.getByRole('button', { name: 'Continuar pagamento' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img[src^="data:image"]')).toBeVisible();
    await expectNoErrorToast(page);
  });

  test('[BILL-05] mantém a aba utilizável quando a contratação pendente não carrega', async ({
    appShell,
    page,
  }) => {
    await mockTrialWithPendingFirstContract(page, 500);
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await openConfigSection(page, 'Plano e cobrança');

    await expect(page.getByRole('heading', { name: 'Plano atual' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/aguardando confirmação/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Contratar plano' }).first()).toBeVisible();
  });
});
