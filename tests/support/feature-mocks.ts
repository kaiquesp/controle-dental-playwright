import type { BrowserContext, Page, Route } from '@playwright/test';

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
      flags: {
        is_nfs: true,
        is_digital_signature: true,
        is_personalization: true,
      },
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
      flags: {
        is_nfs: true,
        is_digital_signature: true,
        is_personalization: true,
      },
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
