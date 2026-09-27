import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { createAuthenticatedE2eContext, e2eName, readAccessToken } from '../../support/crud-helpers';
import { seedPendingPagamento } from '../../support/prontuario-list-helpers';
import {
  createPosMockState,
  createPosTerminalMock,
  installPosMocks,
  type PosMockState,
} from '../../support/pos-mocks';
import {
  expectErrorToast,
  expectToast,
  expectValidationFeedback,
} from '../../support/toast-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Cobrar na maquininha', () => {
  let patientId: string | null = null;
  let lancamentoDesc = '';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Pos');
    patientId = patient.id;
    lancamentoDesc = e2eName('PosPag');

    const apiContext = await createAuthenticatedE2eContext(browser);
    const page = await apiContext.newPage();
    await page.goto('/');
    const token = await readAccessToken(page);
    if (!token) {
      await apiContext.close();
      throw new Error('Token ausente para criar lançamento E2E');
    }
    await seedPendingPagamento(apiContext.request, token, patient.id, lancamentoDesc, 150);
    await apiContext.close();
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  async function prepareCharge(
    context: Parameters<typeof installPosMocks>[0],
    appShell: { dismissBlockingModals: () => Promise<void> },
    prontuarioPage: { goToTab: (id: string, tab: 'pagamentos') => Promise<void> },
    state: PosMockState
  ): Promise<void> {
    test.skip(!patientId, 'Paciente E2E não criado');
    await installPosMocks(context, state);
    await prontuarioPage.goToTab(patientId!, 'pagamentos');
    await appShell.dismissBlockingModals();
  }

  test('[PAC-PRONT-PAG-POS-MAP] abre a modal Cobrar na maquininha', async ({
    page,
    context,
    appShell,
    prontuarioPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock()],
    });
    await prepareCharge(context, appShell, prontuarioPage, state);

    await prontuarioPage.openPagarOnRow(lancamentoDesc);
    await expect(page.getByText(/Onde será o pagamento\?/i)).toBeVisible({ timeout: 10_000 });
    await prontuarioPage.chooseCanalMaquininha();
    const charge = await prontuarioPage.confirmCobrarNaMaquininha();

    await expect(charge.getByText(/O valor aparece na maquininha/i)).toBeVisible();
    await expect(charge.getByText(/R\$/)).toBeVisible();
    await expect(charge.getByRole('button', { name: /Cobrar agora/i })).toBeVisible();
  });

  test('[PAC-PRONT-PAG-POS-01] envia cobrança e confirma pagamento', async ({
    page,
    context,
    appShell,
    prontuarioPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock({ id: 1, nome: 'Point recepção' })],
      chargeStatusOnCreate: 'paid',
    });
    await prepareCharge(context, appShell, prontuarioPage, state);

    await prontuarioPage.openPagarOnRow(lancamentoDesc);
    await prontuarioPage.chooseCanalMaquininha();
    const charge = await prontuarioPage.confirmCobrarNaMaquininha();
    await charge.getByRole('button', { name: /Cobrar agora/i }).click();

    await expectToast(page, /confirmado na maquininha|Aguardando o paciente/i, 15_000);
    await expect(prontuarioPage.posChargeDialog()).toBeHidden({ timeout: 15_000 });
    expect(state.charges[0]?.status).toBe('paid');
  });

  test('[PAC-PRONT-PAG-POS-02] cobrança sem terminal exibe validação', async ({
    page,
    context,
    appShell,
    prontuarioPage,
  }) => {
    const state = createPosMockState({
      terminals: [
        createPosTerminalMock({ id: 1, nome: 'Point 1', provider_terminal_id: 'A1' }),
        createPosTerminalMock({
          id: 2,
          nome: 'Point 2',
          provider: 'stone_pos',
          provider_terminal_id: 'B2',
        }),
      ],
    });
    await prepareCharge(context, appShell, prontuarioPage, state);

    await prontuarioPage.openPagarOnRow(lancamentoDesc);
    await prontuarioPage.chooseCanalMaquininha();
    const charge = await prontuarioPage.confirmCobrarNaMaquininha();
    await charge.getByRole('button', { name: /Cobrar agora/i }).click();
    await expectValidationFeedback(page);
    await expect(charge).toBeVisible();
    await expect(page.locator('.p-toast-message-error')).toHaveCount(0);
  });

  test('[PAC-PRONT-PAG-POS-03] falha ao enviar cobrança exibe toast de erro', async ({
    page,
    context,
    appShell,
    prontuarioPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock()],
      failCharge: true,
    });
    await prepareCharge(context, appShell, prontuarioPage, state);

    await prontuarioPage.openPagarOnRow(lancamentoDesc);
    await prontuarioPage.chooseCanalMaquininha();
    const charge = await prontuarioPage.confirmCobrarNaMaquininha();
    await charge.getByRole('button', { name: /Cobrar agora/i }).click();
    await expectErrorToast(page, /não foi possível enviar|nao foi possivel enviar|erro/i, 15_000);
    await expect(charge).toBeVisible();
  });

  test('[PAC-PRONT-PAG-POS-04] sem maquininha cadastrada orienta a configuração', async ({
    page,
    context,
    appShell,
    prontuarioPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock()],
    });
    await prepareCharge(context, appShell, prontuarioPage, state);

    await prontuarioPage.openPagarOnRow(lancamentoDesc);
    await prontuarioPage.chooseCanalMaquininha();
    state.terminals = [];
    const charge = await prontuarioPage.confirmCobrarNaMaquininha();
    await expect(
      charge.getByText(/Nenhuma maquininha cadastrada ainda/i)
    ).toBeVisible({ timeout: 10_000 });
    await expect(charge.getByRole('button', { name: /Cobrar agora/i })).toHaveCount(0);
  });

  test('[PAC-PRONT-PAG-POS-05] cancela cobrança pendente na maquininha', async ({
    page,
    context,
    appShell,
    prontuarioPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock({ nome: 'Point recepção' })],
      chargeStatusOnCreate: 'pending',
    });
    await prepareCharge(context, appShell, prontuarioPage, state);

    await prontuarioPage.openPagarOnRow(lancamentoDesc);
    await prontuarioPage.chooseCanalMaquininha();
    const charge = await prontuarioPage.confirmCobrarNaMaquininha();
    await charge.getByRole('button', { name: /Cobrar agora/i }).click();
    await expect(charge.getByText(/Aguardando na maquininha/i)).toBeVisible({ timeout: 10_000 });
    await charge.getByRole('button', { name: /Cancelar cobrança/i }).click();
    await expectToast(page, /cancelada|parcela permanece pendente/i, 15_000);
    expect(state.charges[0]?.status).toBe('cancelled');
  });
});
