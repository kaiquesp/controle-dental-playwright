import type { BrowserContext, Page, Route } from '@playwright/test';

const E2E_FEATURE_FLAGS = {
  is_nfs: true,
  is_digital_signature: true,
  is_personalization: true,
  is_vendas: false,
  pos_maquininha: true,
  pos_mercadopago: true,
  pos_stone: true,
  pos_cielo: true,
  pos_sumup: true,
};

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installFeatureMocksOnContext(context: BrowserContext): Promise<void> {
  await context.route('**/api/feature-flags', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, {
      flags: E2E_FEATURE_FLAGS,
    });
  });

  await context.route('**/api/financeiro/patient-payment-checkouts/gateways', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, {
      gateways: [{ provider: 'asaas_patient', status: 'active' }],
    });
  });
}

export async function installFeatureMocks(page: Page): Promise<void> {
  await page.route('**/api/feature-flags', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, {
      flags: E2E_FEATURE_FLAGS,
    });
  });

  await page.route('**/api/financeiro/patient-payment-checkouts/gateways', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await fulfillJson(route, {
      gateways: [{ provider: 'asaas_patient', status: 'active' }],
    });
  });
}
