import type { BrowserContext, Page, Route } from '@playwright/test';
import { dismissAppModals } from './onboarding';

const BILLING_ROUTE = '**/api/billing/**';

/** Rotas externas que nunca devem ser chamadas nos testes E2E. */
const EXTERNAL_PAYMENT_HOST_PATTERNS = [
  '**/asaas.com/**',
  '**/sandbox.asaas.com/**',
  '**/api.asaas.com/**',
  '**/stripe.com/**',
  '**/mercadopago.com/**',
];

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

const mockPatientCheckout = {
  mock: true,
  id: 'e2e-patient-checkout',
  status: 'ACTIVE',
  url: 'https://example.com/e2e-mock-payment',
  link: 'https://example.com/e2e-mock-payment',
  paymentLink: 'https://example.com/e2e-mock-payment',
  checkoutUrl: 'https://example.com/e2e-mock-payment',
};

const mockPatientBoleto = {
  mock: true,
  id: 'e2e-boleto-mock',
  status: 'PENDING',
  situacao: 'aberto',
  bankSlipUrl: 'https://example.com/e2e-mock-boleto.pdf',
  invoiceUrl: 'https://example.com/e2e-mock-boleto.pdf',
  identificationField: '00000.00000 00000.000000 00000.000000 0 00000000000000',
  linhaDigitavel: '00000.00000 00000.000000 00000.000000 0 00000000000000',
};

const mockPatientPaymentResult = {
  mock: true,
  success: true,
  status: 'paid',
  pago: true,
  situacao: 'pago',
  message: 'E2E mock — baixa registrada sem Asaas',
};

export function shouldMockBilling(): boolean {
  return process.env.E2E_ALLOW_REAL_BILLING !== 'true';
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Identifica chamadas que criariam/sincronizariam cobrança externa (Asaas etc.). */
export function isPatientExternalPaymentRoute(url: string, method: string): boolean {
  let path = '';
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }

  if (!path.includes('/api/')) {
    return false;
  }

  if (path.includes('asaas')) {
    return true;
  }

  if (path.includes('patient-payment-checkout')) {
    if (path.includes('gateways') && method === 'GET') {
      return true;
    }
    return method !== 'GET';
  }

  if (path.includes('payment-link') || path.includes('payment_link')) {
    return true;
  }

  if (
    path.includes('checkout') &&
    (path.includes('financeiro') || path.includes('paciente') || path.includes('pagamento'))
  ) {
    return true;
  }

  if (path.includes('boleto') && method !== 'GET') {
    return true;
  }

  if ((path.includes('cobranca') || path.includes('cobrança')) && method !== 'GET') {
    return true;
  }

  if (/(?:\/pagar|\/baixa|\/confirmar-pagamento|\/quitar)/.test(path) && method !== 'GET') {
    return true;
  }

  if (path.includes('emitir') && method === 'POST') {
    return true;
  }

  if (path.includes('charge') && method !== 'GET') {
    return true;
  }

  return false;
}

function mockBodyForPatientPaymentRoute(url: string, method: string): unknown {
  const path = new URL(url).pathname.toLowerCase();

  if (path.includes('gateways')) {
    return { gateways: [{ provider: 'asaas_patient', status: 'active', mock: true }] };
  }

  if (path.includes('boleto')) {
    return mockPatientBoleto;
  }

  if (path.includes('pagar') || path.includes('baixa') || path.includes('quitar') || path.includes('confirmar')) {
    return mockPatientPaymentResult;
  }

  if (method === 'GET') {
    return { mock: true, items: [], data: [] };
  }

  return mockPatientCheckout;
}

/** Padrões específicos — evita interceptar toda a API (quebrava domcontentloaded no auth setup). */
const PATIENT_PAYMENT_API_PATTERNS = [
  '**/api/financeiro/patient-payment-checkouts/**',
  '**/api/**/asaas/**',
  '**/api/**/*boleto*/**',
  '**/api/**/*payment-link*/**',
  '**/api/pacientes/**/pagamentos/**/pagar',
  '**/api/pacientes/**/pagamentos/**/baixa',
  '**/api/pacientes/**/pagamentos/**/quitar',
  '**/api/pacientes/**/pagamentos/**/confirmar-pagamento',
  '**/api/**/*cobranca*/**',
  '**/api/financeiro/**/checkout/**',
  '**/api/pacientes/**/checkout/**',
] as const;

/** Mock de pagamentos do paciente — evita Asaas/boleto/link real. */
export async function handlePatientPaymentRoute(route: Route): Promise<void> {
  const { method } = route.request();
  const url = route.request().url();

  if (!isPatientExternalPaymentRoute(url, method)) {
    await route.continue();
    return;
  }

  await fulfillJson(route, mockBodyForPatientPaymentRoute(url, method));
}

async function registerPatientPaymentRoutes(target: BrowserContext | Page): Promise<void> {
  for (const pattern of PATIENT_PAYMENT_API_PATTERNS) {
    await target.route(pattern, handlePatientPaymentRoute);
  }
}

async function blockExternalPaymentProvider(route: Route): Promise<void> {
  await route.abort('blockedbyclient');
}

export async function installExternalPaymentBlockersOnContext(context: BrowserContext): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  for (const pattern of EXTERNAL_PAYMENT_HOST_PATTERNS) {
    await context.route(pattern, blockExternalPaymentProvider);
  }
}

export async function installExternalPaymentBlockers(page: Page): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  for (const pattern of EXTERNAL_PAYMENT_HOST_PATTERNS) {
    await page.route(pattern, blockExternalPaymentProvider);
  }
}

export async function installPatientPaymentMocksOnContext(context: BrowserContext): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  await installExternalPaymentBlockersOnContext(context);
  await registerPatientPaymentRoutes(context);
}

export async function installPatientPaymentMocks(page: Page): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  await installExternalPaymentBlockers(page);
  await registerPatientPaymentRoutes(page);
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

const SESSION_KEY = 'controleDentalSession';

/** Corrige sessão e remove overlay de bloqueio de assinatura em runtime (sem reload). */
export async function dismissBillingLockUi(page: Page): Promise<void> {
  await installAllPaymentMocks(page);
  await dismissAppModals(page).catch(() => undefined);

  await page.evaluate((key) => {
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem(key);
      if (!raw) {
        continue;
      }
      try {
        const snap = JSON.parse(raw) as { plano?: { pagamentoEmDia?: boolean } };
        if (snap?.plano) {
          snap.plano.pagamentoEmDia = true;
          storage.setItem(key, JSON.stringify(snap));
        }
      } catch {
        /* ignore */
      }
    }
    document.querySelectorAll('.header-billing-lock-dialog').forEach((el) => el.remove());
    const lockHeader = Array.from(document.querySelectorAll('.p-dialog-header, [class*="dialog-header"]')).find((el) =>
      /acesso bloqueado|pendência na assinatura/i.test(el.textContent ?? '')
    );
    lockHeader?.closest('.p-dialog-mask, .p-overlay-mask')?.remove();
  }, SESSION_KEY);

  const lock = page.getByRole('dialog', { name: /Acesso bloqueado por pendência/i });
  if (await lock.isVisible().catch(() => false)) {
    const close = lock.getByRole('button', { name: /Fechar|Entendi|Continuar|Regularizar/i });
    if (await close.first().isVisible().catch(() => false)) {
      await close.first().click().catch(() => undefined);
    }
  }
}

export async function installAllPaymentMocksOnContext(context: BrowserContext): Promise<void> {
  if (!shouldMockBilling()) {
    return;
  }
  await installBillingSessionPatchOnContext(context);
  await installBillingMocksOnContext(context);
  await installPatientPaymentMocksOnContext(context);
}
