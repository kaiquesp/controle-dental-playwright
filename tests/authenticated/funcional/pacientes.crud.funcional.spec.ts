import { test, expect } from '../../fixtures/test.fixture';
import { e2eName } from '../../support/crud-helpers';
import { deleteE2ePatientWithPage } from '../../support/pacientes-helpers';

test.describe('Pacientes — CRUD funcional', () => {
  let patientId: string | null = null;
  let patientName = '';

  test.afterEach(async ({ page, request }) => {
    if (patientId) {
      await deleteE2ePatientWithPage(page, request, patientId);
      patientId = null;
    }
  });

  test('[PAC-CRUD-02] cadastra, edita e exclui paciente via UI', async ({
    appShell,
    pacienteFormPage,
    pacientesListPage,
    prontuarioPage,
    page,
  }) => {
    test.setTimeout(180_000);
    patientName = e2eName('CRUD-UI');
    await pacienteFormPage.goToNovo();
    await pacienteFormPage.expectNovoScreenMap();
    patientId = await pacienteFormPage.createPatient(patientName, { skipNavigation: true });

    await prontuarioPage.goToTab(patientId, 'informacoes');
    await prontuarioPage.dismissBlockingUi();
    await appShell.dismissBlockingModals();
    await prontuarioPage.expectInformacoesScreenMap();

    const editedName = `${patientName}-Editado`;
    await pacienteFormPage.updateNome(editedName);
    patientName = editedName;

    await pacientesListPage.goTo();
    await pacientesListPage.search(patientName);
    await expect(pacientesListPage.patientRow(patientName)).toBeVisible({ timeout: 20_000 });

    await prontuarioPage.goToTab(patientId, 'informacoes');
    await pacienteFormPage.deleteFromProntuario();
    patientId = null;

    await pacientesListPage.goTo();
    await pacientesListPage.search(patientName);
    await expect(pacientesListPage.patientRow(patientName)).toHaveCount(0, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/pacientes/);
  });
});
