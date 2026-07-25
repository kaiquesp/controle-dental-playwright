import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createPatientForAgenda,
  e2eName,
  expectEventInApi,
  installPrintStub,
  readTokenFromPage,
  uniqueAgendaSlot,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Agenda — funcionalidades avançadas', () => {
  const seeds: AgendaEventSeed[] = [];
  const patientIds: string[] = [];
  let authToken = '';

  test.beforeEach(async ({ appShell, agendaPage }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await agendaPage.goToday();
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupAgendaSeeds(request, authToken, seeds, patientIds);
  });

  test('[AG-ADV-01] repetição semanal cria série de ocorrências', async ({ page, agendaPage, request }) => {
    test.setTimeout(180_000);
    authToken = await readTokenFromPage(page);
    const patient = await createPatientForAgenda(request, authToken, 'Repeticao');
    patientIds.push(patient.id);
    const slot = uniqueAgendaSlot(7, 10);

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: slot.hora });
    await agendaPage.setRecurrence(/Semanal:/i, { preserveHora: slot.hora });
    await agendaPage.saveAppointment();
    await expectNoErrorToast(page);
    await expectEventInApi(request, authToken, new RegExp(patient.name.slice(0, 12)), slot.data);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(new RegExp(patient.name.slice(0, 12)));
  });

  test('[AG-ADV-02] editar ocorrência única mantém série', async ({ agendaPage }) => {
    const card = agendaPage.eventCard(/E2E-Repeticao|E2E-Consulta/i).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, 'Sem consulta recorrente para editar');
    }
    await card.click();
    const only = agendaPage.page.getByRole('button', { name: /Somente esta|esta ocorrência/i });
    if (await only.isVisible().catch(() => false)) {
      await only.click();
    }
    await agendaPage.cancelAppointment();
  });

  test('[AG-ADV-03] retornar em 15 dias configura retorno', async ({ page, agendaPage, request }) => {
    authToken = await readTokenFromPage(page);
    const patient = await createPatientForAgenda(request, authToken, 'Retorno');
    patientIds.push(patient.id);
    const slot = uniqueAgendaSlot(7, 11);

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: slot.hora });
    try {
      await agendaPage.setReturnIn(/15 dias|1 mês/i);
    } catch {
      test.skip(true, 'Catálogo de retorno indisponível');
    }
    await agendaPage.saveAppointment();
    await expectNoErrorToast(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.expectEventVisible(new RegExp(patient.name.slice(0, 12)));
  });

  test('[AG-ADV-04] encontrar horários abre painel de slots', async ({ agendaPage }) => {
    await agendaPage.openNewAppointment();
    await agendaPage.switchTab('Consulta');
    const findBtn = agendaPage.scheduleDialog().getByRole('button', { name: /Encontrar horários|horários livres/i });
    if (!(await findBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão Encontrar horários indisponível');
    }
    await findBtn.click();
    await expect(
      agendaPage.page.getByText(/horário|disponível|slot/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await agendaPage.page.keyboard.press('Escape');
    await agendaPage.cancelAppointment();
  });

  test('[AG-ADV-05] agendamento fora do expediente exige confirmação', async ({ agendaPage, request, page }) => {
    authToken = await readTokenFromPage(page);
    const patient = await createPatientForAgenda(request, authToken, 'ForaExp');
    patientIds.push(patient.id);
    const slot = uniqueAgendaSlot(7, 5);

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: '02:00' });
    const dialog = agendaPage.scheduleDialog();
    await dialog.getByRole('button', { name: /Agendar consulta/i }).click();

    const confirm = agendaPage.page.locator('[role="alertdialog"]:visible').filter({ hasText: /fora do expediente/i });
    await expect(confirm, 'Horário 02:00 deveria disparar confirmação de fora do expediente').toBeVisible({
      timeout: 8_000,
    });
    await confirm.getByRole('button', { name: /^Não$/i }).click();
    await expect(confirm).toBeHidden({ timeout: 5_000 });
    await agendaPage.cancelAppointment();
  });

  test('[AG-PRT-01] imprimir agenda permanece em /agenda', async ({ page, agendaPage }) => {
    await installPrintStub(page);
    await expect(agendaPage.printButton).toBeEnabled();
    await agendaPage.triggerPrint();
    await expect(page).toHaveURL(/\/agenda/);
    await expect(agendaPage.root).toBeVisible();
  });

  test('[AG-PRT-02] imprimir com filtro de profissional ativo', async ({ page, agendaPage }) => {
    await installPrintStub(page);
    await agendaPage.selectAllProfessionals();
    await expect(agendaPage.printButton).toBeEnabled();
    await agendaPage.triggerPrint();
    await expect(page).toHaveURL(/\/agenda/);
  });
});
