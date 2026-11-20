import type { BrowserContext, Page, Route } from '@playwright/test';

const E2E_FEATURE_FLAGS = {
  is_nfs: true,
  is_digital_signature: true,
  is_personalization: true,
  is_onboarding: true,
  is_vendas: false,
  pos_maquininha: true,
  pos_mercadopago: true,
  pos_stone: true,
  pos_cielo: true,
  pos_sumup: true,
  /** Assistente IA por Voz: desligado por padrão; specs de voz ligam via `setAiVoiceFeatureFlag`. */
  is_ai_voice: false,
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

/**
 * Sobrescreve `/api/feature-flags` na página com `is_ai_voice` habilitado/desabilitado
 * (rota registrada depois do fixture tem prioridade). `omit` remove a chave (flag ausente).
 */
export async function setAiVoiceFeatureFlag(
  page: Page,
  enabled: boolean | 'omit',
  options: { delayMs?: number } = {}
): Promise<void> {
  const flags: Record<string, boolean> = { ...E2E_FEATURE_FLAGS };
  if (enabled === 'omit') {
    delete flags.is_ai_voice;
  } else {
    flags.is_ai_voice = enabled;
  }
  await page.route('**/api/feature-flags', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    await fulfillJson(route, { flags }).catch(() => undefined);
  });
}
