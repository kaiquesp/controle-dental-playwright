import { test, expect } from '../../fixtures/test.fixture';
import { selectIftaByInputId } from '../../support/interaction-helpers';
import {
  createPosMockState,
  createPosTerminalMock,
  installPosMocks,
  type PosMockState,
} from '../../support/pos-mocks';
import {
  expectErrorToast,
  expectNoErrorToast,
  expectToast,
  expectValidationFeedback,
} from '../../support/toast-helpers';

test.describe('Configurações — Maquininhas (cobrança presencial)', () => {
  async function openPosPanel(
    appShell: { navigateTo: (path: string) => Promise<void>; expectAuthenticatedShell: () => Promise<void>; dismissBlockingModals: () => Promise<void> },
    configuracoesPage: {
      openSection: (label: string) => Promise<void>;
      openCobrancaPacientes: () => Promise<unknown>;
      selectCobrancaModoMaquininha: () => Promise<unknown>;
    },
    context: Parameters<typeof installPosMocks>[0],
    state: PosMockState
  ) {
    await installPosMocks(context, state);
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Integrações');
    await configuracoesPage.openCobrancaPacientes();
    await configuracoesPage.selectCobrancaModoMaquininha();
  }

  test('[CFG-POS-MAP] mapeia o painel Na maquininha', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState();
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText(/São 3 passos: escolha a marca/i)).toBeVisible();
    await expect(dialog.getByText(/Qual maquininha vocês usam\?/i)).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Maquininhas da clínica/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Atualizar lista/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Adicionar maquininha/i })).toBeVisible();
    await expectNoErrorToast(page);
  });

  test('[CFG-POS-01] cadastra Point com conta Mercado Pago ligada', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({ mercadoPagoActive: true });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText(/Conta já ligada/i)).toBeVisible();
    await configuracoesPage.fillPosDevice({ serial: 'SBX-E2E-001', nome: 'Recepção' });
    await configuracoesPage.submitPosDevice();

    await expectToast(page, /Maquininha adicionada|já cadastrada/i, 15_000);
    await expect(
      dialog.getByRole('region', { name: /Maquininhas da clínica/i }).getByText('Recepção').first()
    ).toBeVisible({ timeout: 10_000 });
    expect(state.terminals).toHaveLength(1);
    expect(state.terminals[0]?.provider_terminal_id).toBe('SBX-E2E-001');
  });

  test('[CFG-POS-02] serial vazio exibe validação no campo', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState();
    await openPosPanel(appShell, configuracoesPage, context, state);

    await configuracoesPage.submitPosDevice();
    await expectValidationFeedback(page);
    await expect(configuracoesPage.cobrancaPacientesDialog()).toBeVisible();
    await expect(page.locator('.p-toast-message-error')).toHaveCount(0);
  });

  test('[CFG-POS-03] falha ao cadastrar exibe toast de erro', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({ failRegister: true });
    await openPosPanel(appShell, configuracoesPage, context, state);

    await configuracoesPage.fillPosDevice({ serial: 'SBX-E2E-500', nome: 'Sala 1' });
    await configuracoesPage.submitPosDevice();
    await expectErrorToast(page, /não foi possível|nao foi possivel|erro/i, 15_000);
    await expect(configuracoesPage.cobrancaPacientesDialog()).toBeVisible();
  });

  test('[CFG-POS-04] Stone e Cielo usam os nomes do painel da marca', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState();
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await selectIftaByInputId(page, 'pos-brand', /^Stone$/i, dialog);
    await expect(dialog.getByText(/Secret Key/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Ligar conta/i })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Maquininhas da clínica/i })).toHaveCount(0);

    await selectIftaByInputId(page, 'pos-brand', /Cielo LIO/i, dialog);
    await expect(dialog.getByText(/Client ID/i)).toBeVisible();
    await expect(dialog.getByText(/Access Token/i)).toBeVisible();
    await expect(dialog.getByText(/Merchant ID/i)).toBeVisible();
    await expect(dialog.getByText(/Senha de acesso/i)).toHaveCount(0);
  });

  test('[CFG-POS-05] ajuda da marca abre a modal com os passos', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState();
    await openPosPanel(appShell, configuracoesPage, context, state);

    await configuracoesPage.cobrancaPacientesDialog()
      .getByRole('button', { name: /Como escolher a maquininha/i })
      .click();

    const help = page
      .getByRole('dialog', { name: /Qual maquininha vocês usam\?/i })
      .and(page.locator('div'));
    await expect(help).toBeVisible({ timeout: 10_000 });
    await expect(help.getByText(/Point é Mercado Pago/i)).toBeVisible();
    await help.getByRole('button', { name: /Entendi/i }).click();
    await expect(help).toBeHidden({ timeout: 10_000 });
  });

  test('[CFG-POS-06] remove maquininha com confirmação', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock({ id: 7, nome: 'Point recepção', provider_terminal_id: 'SBX0007' })],
    });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText('Point recepção')).toBeVisible();
    await dialog.getByRole('button', { name: /Remover Point recepção/i }).click();

    const confirm = page
      .getByRole('alertdialog', { name: /Remover maquininha/i })
      .and(page.locator('div'));
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.getByRole('button', { name: /^Remover$/i }).click();
    await expectToast(page, /removida|Maquininha/i, 15_000);
    await expect(dialog.getByText('Point recepção')).toHaveCount(0);
    expect(state.terminals).toHaveLength(0);
  });

  test('[CFG-POS-08] escolhe o Point na lista de aparelhos da conta', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({
      availableDevices: [{ provider_terminal_id: 'PAX_A910__E2E1234', nome: 'Point Sala 2', online: true }],
    });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText(/Encontramos estas maquininhas na sua conta/i)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/Point Sala 2 · final 1234/i)).toBeVisible();
    await configuracoesPage.submitPosDevice();

    await expectToast(page, /Maquininha adicionada/i, 15_000);
    expect(state.terminals[0]?.provider_terminal_id).toBe('PAX_A910__E2E1234');
  });

  test('[CFG-POS-09] ativa o modo integrado do Point cadastrado', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock({ id: 7, nome: 'Point recepção', provider_terminal_id: 'SBX0007' })],
      pointModes: { SBX0007: false },
    });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    const warning = dialog.getByText(/este Point ainda não recebe as cobranças do sistema/i);
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /Ativar modo integrado/i }).click();

    await expectToast(page, /Modo integrado ativado/i, 15_000);
    await expect(warning).toHaveCount(0);
    expect(state.pointModes['SBX0007']).toBe(true);
  });

  test('[CFG-POS-10] falha ao ativar o modo integrado mantém o aviso', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({
      terminals: [createPosTerminalMock({ id: 7, nome: 'Point recepção', provider_terminal_id: 'SBX0007' })],
      pointModes: { SBX0007: false },
      failEnableIntegratedMode: true,
    });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await dialog.getByRole('button', { name: /Ativar modo integrado/i }).click();

    await expectErrorToast(page, /modo integrado|app Mercado Pago/i, 15_000);
    await expect(dialog.getByText(/este Point ainda não recebe as cobranças do sistema/i)).toBeVisible();
  });

  test('[CFG-POS-11] pareia a SumUp pelo código da tela da Solo', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({ byokLinked: { stone_pos: false, cielo_lio: false, sumup_pos: true } });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await selectIftaByInputId(page, 'pos-brand', /SumUp/i, dialog);
    const pairingField = dialog.locator('#pos-sumup-pairing-code');
    await expect(pairingField).toBeVisible({ timeout: 10_000 });
    await pairingField.fill('ab12-cd34');
    await dialog.locator('#pos-register-nome').fill('Recepção');
    await configuracoesPage.submitPosDevice();

    await expectToast(page, /pareada/i, 15_000);
    expect(state.lastPairingBody).toEqual({ pairing_code: 'AB12CD34', nome: 'Recepção' });
    expect(state.terminals.some((item) => item.provider === 'sumup_pos')).toBe(true);
  });

  test('[CFG-POS-12] código de pareamento inválido mostra erro no campo', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({ byokLinked: { stone_pos: false, cielo_lio: false, sumup_pos: true } });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await selectIftaByInputId(page, 'pos-brand', /SumUp/i, dialog);
    await dialog.locator('#pos-sumup-pairing-code').fill('123');
    await configuracoesPage.submitPosDevice();

    await expect(dialog.getByText(/Digite o código de 8 ou 9 letras e números/i)).toBeVisible();
    await expect(page.locator('.p-toast-message-error')).toHaveCount(0);
    expect(state.lastPairingBody).toBeNull();
  });

  test('[CFG-POS-13] código de pareamento vencido exibe toast de erro', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({
      byokLinked: { stone_pos: false, cielo_lio: false, sumup_pos: true },
      sumupPairing: 'expired',
    });
    await openPosPanel(appShell, configuracoesPage, context, state);

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await selectIftaByInputId(page, 'pos-brand', /SumUp/i, dialog);
    await dialog.locator('#pos-sumup-pairing-code').fill('AB12CD34');
    await configuracoesPage.submitPosDevice();

    await expectErrorToast(page, /5 minutos|novo na maquininha/i, 15_000);
    await expect(dialog.locator('#pos-sumup-pairing-code')).toBeVisible();
  });

  test('[CFG-POS-07] falha ao carregar lista exibe toast de erro', async ({
    page,
    context,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPosMockState({ failList: true });
    await openPosPanel(appShell, configuracoesPage, context, state);
    await expectErrorToast(page, /não foi possível carregar|nao foi possivel carregar|erro/i, 15_000);
  });
});
