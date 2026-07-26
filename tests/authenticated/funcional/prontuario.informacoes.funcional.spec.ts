import { test } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { e2eName } from '../../support/crud-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Informações', () => {
  let patientId: string | null = null;
  let patientName = '';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Info');
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
    await prontuarioPage.goToTab(patientId!, 'informacoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-INFO-MAP] mapeamento da aba informações', async ({ prontuarioPage }) => {
    await prontuarioPage.expectPatientName(patientName);
    await prontuarioPage.expectInformacoesScreenMap();
  });

  test('[PAC-PRONT-INFO-01] edita paciente na aba informações', async ({ pacienteFormPage, prontuarioPage }) => {
    const novoNome = e2eName('Info-Edit');
    await pacienteFormPage.updateNome(novoNome);
    await prontuarioPage.expectPatientName(novoNome);
    await prontuarioPage.expectInformacoesScreenMap();
    patientName = novoNome;
  });
});
