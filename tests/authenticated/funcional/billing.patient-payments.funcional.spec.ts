import { test, expect } from '../../fixtures/test.fixture';
import { isPatientExternalPaymentRoute, shouldMockBilling } from '../../support/billing-mocks';

test.describe('Billing — pagamentos do paciente (mock Asaas)', () => {
  test('[BILL-PAY-01] rotas externas de cobrança são identificadas', () => {
    expect(isPatientExternalPaymentRoute('https://api.controledental.com.br/api/financeiro/patient-payment-checkouts', 'POST')).toBe(
      true
    );
    expect(
      isPatientExternalPaymentRoute('https://api.controledental.com.br/api/financeiro/patient-payment-checkouts/gateways', 'GET')
    ).toBe(true);
    expect(isPatientExternalPaymentRoute('https://api.controledental.com.br/api/pacientes/1/pagamentos/2/pagar', 'POST')).toBe(
      true
    );
    expect(isPatientExternalPaymentRoute('https://api.controledental.com.br/api/financeiro/boletos/emitir', 'POST')).toBe(true);
    expect(
      isPatientExternalPaymentRoute('https://api.controledental.com.br/api/pacientes/1/pagamentos/2/cobranca/link', 'POST')
    ).toBe(true);
    expect(isPatientExternalPaymentRoute('https://api.controledental.com.br/api/pacientes/1/pagamentos', 'GET')).toBe(false);
    expect(isPatientExternalPaymentRoute('https://api.controledental.com.br/api/pacientes/1/pagamentos', 'POST')).toBe(false);
  });

  test('[BILL-PAY-02] mock ativo por padrão', () => {
    expect(shouldMockBilling()).toBe(true);
  });

  test('[BILL-PAY-03] aba pagamentos não navega para Asaas', async ({ page, appShell, browser }) => {
    test.skip(!shouldMockBilling(), 'E2E_ALLOW_REAL_BILLING=true');

    const asaasCalls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/asaas\.com|stripe\.com|mercadopago\.com/i.test(url)) {
        asaasCalls.push(url);
      }
    });

    const { createE2ePatientByApi, deleteE2ePatient } = await import('../../support/pacientes-helpers');
    const patient = await createE2ePatientByApi(browser, 'Bill-Pay');
    try {
      await appShell.navigateTo(`/pacientes/${patient.id}/edit/pagamentos`);
      await appShell.dismissBlockingModals();
      await expect(page.getByRole('tab', { name: /^Pagamentos$/i })).toBeVisible({ timeout: 20_000 });

      const cobrancaBtn = page.getByRole('button', { name: /link de cobrança|cobrança|copiar link/i }).first();
      if (await cobrancaBtn.isVisible().catch(() => false)) {
        await cobrancaBtn.click();
        await page.waitForTimeout(800);
      }

      expect(asaasCalls).toHaveLength(0);
    } finally {
      await deleteE2ePatient(browser, patient.id);
    }
  });
});
