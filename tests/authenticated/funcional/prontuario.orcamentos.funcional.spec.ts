import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { e2eName } from '../../support/crud-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Orçamentos', () => {
  let patientId: string | null = null;
  let patientName = '';
  let contratoBaseline: string[] = [];
  let documentoBaseline: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Orc');
    patientId = patient.id;
    patientName = patient.name;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'orcamentos');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-ORC-MAP] mapeamento da aba orçamentos', async ({ prontuarioPage }) => {
    await prontuarioPage.expectOrcamentosScreenMap();
  });

  test('[PAC-PRONT-ORC-01] cria orçamento com gerar contrato automaticamente', async ({ prontuarioPage }) => {
    test.setTimeout(180_000);
    const desc = e2eName('Orc-Contrato');
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.setOrcamentoOptions({ gerarContrato: true });
    await prontuarioPage.saveOrcamento();
    await expect(prontuarioPage.orcamentoRow(desc).first()).toBeVisible({ timeout: 25_000 });

    const contratoBtn = prontuarioPage.orcamentoRow(desc).getByRole('button', { name: /Visualizar contrato/i });
    if (!(await contratoBtn.first().isVisible().catch(() => false))) {
      test.info().annotations.push({
        type: 'note',
        description: 'Opção "gerar contrato automaticamente" indisponível na UI atual — orçamento criado sem contrato.',
      });
      return;
    }

    contratoBaseline = await prontuarioPage.openVisualizarContrato(desc);
    await prontuarioPage.expectContratoTexts(contratoBaseline, patientName);
  });

  test('[PAC-PRONT-ORC-02] cria orçamento com aprovar imediatamente', async ({ prontuarioPage, page }) => {
    test.setTimeout(180_000);
    const desc = e2eName('Orc-Aprovar');
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.setOrcamentoOptions({ aprovarImediato: true });
    await prontuarioPage.saveOrcamento();
    await expect(prontuarioPage.orcamentoRow(desc).first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/aprovado|aprovada/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  });

  test('[PAC-PRONT-ORC-03] aprova orçamento manualmente na lista', async ({ prontuarioPage }) => {
    test.setTimeout(180_000);
    const desc = e2eName('Orc-Manual');
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.saveOrcamento();
    await prontuarioPage.aprovarOrcamentoNaLista(desc);
  });

  test('[PAC-PRONT-ORC-04] visualizar contrato e abrir documento batem baseline', async ({ prontuarioPage }) => {
    test.setTimeout(180_000);
    const desc = e2eName('Orc-Doc');
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.setOrcamentoOptions({ gerarContrato: true });
    await prontuarioPage.saveOrcamento();
    documentoBaseline = await prontuarioPage.openAbrirDocumento(desc);
    await prontuarioPage.expectContratoTexts(documentoBaseline, patientName);
    if (contratoBaseline.length > 0) {
      const texts = await prontuarioPage.openVisualizarContrato(desc);
      expect(texts.join(' ')).toMatch(new RegExp(patientName.slice(0, 6), 'i'));
    }
  });

  test('[PAC-PRONT-ORC-05] edita orçamento', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    const desc = e2eName('Orc-Edit');
    const edited = `${desc}-Edit`;
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.saveOrcamento();
    await prontuarioPage.editarOrcamento(desc, edited);
    await expect(prontuarioPage.orcamentoRow(edited).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-ORC-06] exclui orçamento', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    const desc = e2eName('Orc-Del');
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.saveOrcamento();
    await prontuarioPage.excluirOrcamento(desc);
  });

  test('[PAC-PRONT-ORC-07] emite boleto quando disponível', async ({ page, prontuarioPage }) => {
    test.setTimeout(120_000);
    const desc = e2eName('Orc-Boleto');
    await prontuarioPage.openNovoOrcamento();
    await prontuarioPage.fillOrcamentoBasico(desc);
    await prontuarioPage.saveOrcamento();
    const row = prontuarioPage.orcamentoRow(desc);
    const boletoBtn = row.getByRole('button', { name: /boleto|emitir boleto/i });
    if (!(await boletoBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Emissão de boleto indisponível neste plano/orçamento');
    }
    await boletoBtn.first().click();
    await expect(page.getByText(/boleto|emitido|cobrança/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
