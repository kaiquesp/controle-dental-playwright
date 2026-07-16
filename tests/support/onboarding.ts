import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const ONBOARDING_KEY = 'controleDentalOnboardingV1';
const SESSION_KEY = 'controleDentalSession';

/**
 * Aceita documentos LGPD pendentes (modal pós-login).
 * Usa o overlay visível do PrimeNG — o host `<p-dialog>` também tem role=dialog e não contém os inputs.
 */
export async function acceptPendingLegalDocuments(
  page: Page,
  timeoutMs = 30_000
): Promise<boolean> {
  const modal = page.locator('.p-dialog.aceitar-documentos-modal-dialog:visible').last();
  const appeared = await modal
    .waitFor({ state: 'visible', timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    // Fallback: título visível (caso a styleClass mude).
    const title = page.getByRole('heading', { name: /Aceite de Documentos LGPD/i });
    if (!(await title.isVisible().catch(() => false))) {
      return false;
    }
  }

  const root = (await modal.isVisible().catch(() => false))
    ? modal
    : page.locator('.aceitar-documentos-modal').last();

  // Espera sair do loading.
  await page
    .getByText(/Carregando documentos pendentes/i)
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => undefined);

  const agreeLabels = root.getByText(/Li e concordo com/i);
  await agreeLabels.first().waitFor({ state: 'visible', timeout: 15_000 });

  const labelCount = await agreeLabels.count();
  for (let i = 0; i < labelCount; i++) {
    await agreeLabels.nth(i).click({ force: true });
  }

  // Garante ngModel via input nativo também.
  const checkboxes = page.locator(
    '.aceitar-documentos-modal-dialog:visible input.aceitar-documentos-modal__accept-input, .aceitar-documentos-modal input.aceitar-documentos-modal__accept-input'
  );
  const boxCount = await checkboxes.count();
  for (let i = 0; i < boxCount; i++) {
    const box = checkboxes.nth(i);
    if (!(await box.isChecked().catch(() => false))) {
      await box.check({ force: true });
    }
  }

  const acceptBtn = page.getByRole('button', { name: /Aceitar todos os documentos/i }).last();
  await expect(acceptBtn).toBeEnabled({ timeout: 10_000 });
  await acceptBtn.click();

  await page
    .locator('.p-dialog.aceitar-documentos-modal-dialog:visible')
    .waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => undefined);

  await page
    .getByRole('heading', { name: /Aceite de Documentos LGPD/i })
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => undefined);

  return true;
}

/** Aguarda sair do login, aceitando LGPD se o modal aparecer. */
export async function waitForPostLoginDestination(page: Page, timeoutMs = 120_000): Promise<void> {
  const destination = /\/(agenda|setup-inicial|aceitar-documentos|pacientes)/;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const url = page.url();
    if (destination.test(url) && !url.includes('/login')) {
      return;
    }

    const lgpdVisible =
      (await page.locator('.p-dialog.aceitar-documentos-modal-dialog:visible').isVisible().catch(() => false)) ||
      (await page.getByRole('heading', { name: /Aceite de Documentos LGPD/i }).isVisible().catch(() => false));

    if (lgpdVisible) {
      console.log('Modal LGPD detectado — aceitando documentos pendentes…');
      await acceptPendingLegalDocuments(page, 5_000);
      await page.waitForTimeout(800);
      continue;
    }

    await page.waitForTimeout(400);
  }

  throw new Error(
    `Timeout pós-login: URL atual=${page.url()} (esperado agenda/setup/aceitar-documentos; LGPD pode ter falhado)`
  );
}

/** Marca o tour guiado como concluído para evitar redirecionamentos para /agenda. */
export async function completeOnboardingStorage(page: Page): Promise<void> {
  await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    const data = JSON.parse(raw) as Record<string, { completed?: boolean; dismissed?: boolean }>;
    for (const key of Object.keys(data)) {
      data[key].completed = true;
      data[key].dismissed = true;
    }
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, ONBOARDING_KEY);
}

/** Fecha tour e modais bloqueantes sem depender de timing da sidebar. */
export async function dismissAppModals(page: Page): Promise<void> {
  const sessionPatched = await page.evaluate((sessionKey) => {
    const patchSessionSnapshot = (raw: string): string | null => {
      try {
        const snap = JSON.parse(raw) as {
          plano?: {
            pagamentoEmDia?: boolean;
            modulos?: Array<{
              id: string;
              nome?: string;
              secao?: string;
              habilitadoNoPlano?: boolean;
              leitura?: boolean;
              escrita?: boolean;
            }>;
          };
          usuario?: { permissoes?: string[] };
        };

        let changed = false;

        if (snap?.plano) {
          if (snap.plano.pagamentoEmDia !== true) {
            snap.plano.pagamentoEmDia = true;
            changed = true;
          }
          const modulos = snap.plano.modulos ?? [];
          const ensureModule = (moduleId: string): void => {
            const existing = modulos.find((item) => item.id === moduleId);
            if (existing) {
              if (!existing.habilitadoNoPlano || !existing.leitura || !existing.escrita) {
                existing.habilitadoNoPlano = true;
                existing.leitura = true;
                existing.escrita = true;
                changed = true;
              }
              return;
            }
            modulos.push({
              id: moduleId,
              nome: moduleId,
              secao: '',
              habilitadoNoPlano: true,
              leitura: true,
              escrita: true,
            });
            changed = true;
          };
          ensureModule('pacientes');
          ensureModule('contratos');
          snap.plano.modulos = modulos;
        }

        const permissoes = snap.usuario?.permissoes ?? [];
        for (const permission of ['contratos:read', 'contratos:write', 'pacientes:read', 'pacientes:write']) {
          if (!permissoes.includes(permission)) {
            permissoes.push(permission);
            changed = true;
          }
        }
        if (snap.usuario) {
          snap.usuario.permissoes = permissoes;
        }

        return changed ? JSON.stringify(snap) : null;
      } catch {
        return null;
      }
    };

    let patched = false;
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem(sessionKey);
      if (!raw) {
        continue;
      }
      const next = patchSessionSnapshot(raw);
      if (next) {
        storage.setItem(sessionKey, next);
        patched = true;
      }
    }
    return patched;
  }, SESSION_KEY);

  if (sessionPatched && !page.url().includes('/pacientes/')) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
  }

  await acceptPendingLegalDocuments(page, 2_000);

  const skipTour = page.getByText('Pular tour', { exact: true });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
    await page.waitForTimeout(400);
  }

  const subscriptionDialog = page.getByRole('dialog', { name: /pendência na assinatura|Acesso bloqueado/i });
  if (await subscriptionDialog.isVisible().catch(() => false)) {
    await page.evaluate(() => {
      for (const selector of ['.header-billing-lock-dialog', '.p-dialog-mask']) {
        document.querySelectorAll(selector).forEach((el) => el.remove());
      }
    });
    await page.waitForTimeout(200);
  }

  const subscriptionDialogAfter = page.getByRole('dialog', { name: /pendência na assinatura|Acesso bloqueado/i });
  if (await subscriptionDialogAfter.isVisible().catch(() => false)) {
    const dismissSubscription = subscriptionDialogAfter.getByRole('button', {
      name: /Fechar|Entendi|Continuar|Regularizar|Ver assinatura/i,
    });
    if (await dismissSubscription.first().isVisible().catch(() => false)) {
      await dismissSubscription.first().click({ timeout: 2_000 }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }

  const closeButtons = page.locator(
    [
      'button[aria-label="Fechar"]',
      'button:has-text("Fechar")',
      'button:has-text("Entendi")',
      'button:has-text("Continuar")',
      'button:has-text("Ok")',
      '.p-dialog-header-close',
    ].join(', ')
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    const visible = closeButtons.first();
    if (!(await visible.isVisible().catch(() => false))) {
      break;
    }
    await visible.click({ timeout: 2_000 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }

  await completeOnboardingStorage(page);
  await removeBillingLockOverlay(page);
}

/** Garante sessão E2E desbloqueada antes de salvar `storageState` (setup de auth). */
export async function prepareSessionForE2eSave(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await dismissAppModals(page);

    await page.evaluate((sessionKey) => {
      for (const storage of [localStorage, sessionStorage]) {
        const raw = storage.getItem(sessionKey);
        if (!raw) {
          continue;
        }
        try {
          const snap = JSON.parse(raw) as { plano?: { pagamentoEmDia?: boolean } };
          if (snap?.plano) {
            snap.plano.pagamentoEmDia = true;
            storage.setItem(sessionKey, JSON.stringify(snap));
          }
        } catch {
          /* ignore */
        }
      }
    }, SESSION_KEY);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await dismissAppModals(page);

    const billingLock = page.getByRole('dialog', { name: /Acesso bloqueado por pendência/i });
    if ((await billingLock.count()) === 0) {
      return;
    }
  }
}

async function removeBillingLockOverlay(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const lock = page.getByRole('dialog', { name: /Acesso bloqueado por pendência/i });
    if (!(await lock.isVisible().catch(() => false))) {
      return;
    }

    await page.evaluate(() => {
      document
        .querySelectorAll('.header-billing-lock-dialog, .p-dialog-mask, .p-overlay-mask')
        .forEach((el) => el.remove());
    });
    await page.waitForTimeout(400);
  }
}
