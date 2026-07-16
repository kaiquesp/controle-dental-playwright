import type { BrowserContext, Page, Route } from '@playwright/test';

const BILLING_ROUTE = '**/api/billing/**';

const E2E_PLAN_FEATURE_FLAGS: Record<string, boolean> = {
  mod_pacientes: true,
  mod_odontograma: true,
  mod_financeiro: true,
  mod_estoque: true,
  mod_controle_protese: true,
  mod_relatorios: true,
  mod_contratos: true,
  mod_assinatura_digital: true,
  mod_campanhas: true,
  mod_comissoes: true,
};

const mockSubscription = {
  status: 'active',
  planCode: 'avancado',
  planName: 'Avançado',
  planPriceCents: 16990,
  billingInterval: 'month',
  trialAtivo: false,
  pagamentoEmDia: true,
  planFeatureFlags: E2E_PLAN_FEATURE_FLAGS,
  features: E2E_PLAN_FEATURE_FLAGS,
  planFeatures: E2E_PLAN_FEATURE_FLAGS,
  mock: true,
};

function shouldMockBilling(): boolean {
  return process.env.E2E_ALLOW_REAL_BILLING !== 'true';
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Evita modal "Acesso bloqueado por pendência na assinatura" nos testes E2E. */
export async function installBillingSessionPatch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const SESSION_KEY = 'controleDentalSession';
    const patch = (): void => {
      for (const storage of [localStorage, sessionStorage]) {
        const raw = storage.getItem(SESSION_KEY);
        if (!raw) {
          continue;
        }
        try {
          const snap = JSON.parse(raw) as { plano?: { pagamentoEmDia?: boolean } };
          if (snap?.plano && snap.plano.pagamentoEmDia === false) {
            snap.plano.pagamentoEmDia = true;
            storage.setItem(SESSION_KEY, JSON.stringify(snap));
          }
        } catch {
          /* ignore malformed session */
        }
      }
    };
    patch();
    window.addEventListener('storage', patch);
  });
}

/** Bloqueia cobrança SaaS real — respostas seguras para E2E. */
async function handleBillingRoute(route: Route): Promise<void> {
  const { method } = route.request();
  const url = route.request().url();

  if (method === 'GET' && url.includes('/billing/subscription')) {
    await fulfillJson(route, mockSubscription);
    return;
  }

  if (method === 'GET' && url.includes('/billing/plans')) {
    await fulfillJson(route, [
      {
        code: 'avancado',
        name: 'Avançado',
        priceCents: 16990,
        billingInterval: 'month',
        mock: true,
      },
    ]);
    return;
  }

  if (method === 'GET' && url.includes('/billing/invoices')) {
    await fulfillJson(route, []);
    return;
  }

  if (method === 'GET' && url.includes('/billing/payment-method')) {
    await fulfillJson(route, { mock: true, last4: '4242', brand: 'visa', type: 'card' });
    return;
  }

  if (method === 'GET' && url.includes('/billing/pending-upgrade')) {
    await fulfillJson(route, null);
    return;
  }

  if (method === 'POST' && url.includes('checkout-session')) {
    await fulfillJson(route, { mock: true, checkoutUrl: null, message: 'E2E mock — sem cobrança' });
    return;
  }

  if (method === 'POST' && url.includes('activate-subscription')) {
    await fulfillJson(route, mockSubscription);
    return;
  }

  if (method === 'POST' && url.includes('retry-charge')) {
    await fulfillJson(route, { success: true, pagamentoEmDia: true, mock: true });
    return;
  }

  if (method === 'PUT' && url.includes('/billing/payment-method')) {
    await fulfillJson(route, { mock: true, last4: '4242', brand: 'visa' });
    return;
  }

  if (method === 'POST' && url.includes('/billing/cancel')) {
    await fulfillJson(route, { status: 'cancelled', mock: true });
    return;
  }

  await fulfillJson(route, { mock: true });
}

export async function installBillingMocksOnContext(context: BrowserContext): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  await context.route(BILLING_ROUTE, handleBillingRoute);
}

export async function installBillingMocks(page: Page): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  await page.route(BILLING_ROUTE, handleBillingRoute);
}

/** Mock checkout / link de pagamento ao paciente — evita Stripe/MP real. */
export async function installPatientPaymentMocks(page: Page): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }

  const patterns = ['**/api/**/checkout**', '**/api/**/payment-link**', '**/api/**/pagamento**/checkout**'];

  for (const pattern of patterns) {
    await page.route(pattern, async (route) => {
      if (route.request().method() === 'POST') {
        await fulfillJson(route, {
          mock: true,
          url: 'https://example.com/e2e-mock-checkout',
          link: 'https://example.com/e2e-mock-payment',
        });
        return;
      }
      await route.continue();
    });
  }
}

export async function installAllPaymentMocks(page: Page): Promise<void> {
  await installBillingSessionPatch(page);
  await installBillingMocks(page);
  await installPatientPaymentMocks(page);
}

export async function installBillingSessionPatchOnContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const SESSION_KEY = 'controleDentalSession';
    const patch = (): void => {
      for (const storage of [localStorage, sessionStorage]) {
        const raw = storage.getItem(SESSION_KEY);
        if (!raw) {
          continue;
        }
        try {
          const snap = JSON.parse(raw) as { plano?: { pagamentoEmDia?: boolean } };
          if (snap?.plano && snap.plano.pagamentoEmDia === false) {
            snap.plano.pagamentoEmDia = true;
            storage.setItem(SESSION_KEY, JSON.stringify(snap));
          }
        } catch {
          /* ignore malformed session */
        }
      }
    };
    patch();
    window.addEventListener('storage', patch);
  });
}

export async function installAllPaymentMocksOnContext(context: BrowserContext): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  await installBillingSessionPatchOnContext(context);
  await installBillingMocksOnContext(context);
}
