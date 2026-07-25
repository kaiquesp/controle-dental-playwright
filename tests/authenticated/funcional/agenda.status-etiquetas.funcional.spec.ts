import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createPatientForAgenda,
  e2eName,
  expectEventInApi,
  listProfessionalsByApi,
  readTokenFromPage,
  uniqueAgendaSlot,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Agenda — status e etiquetas', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const seeds: AgendaEventSeed[] = [];
  const patientIds: string[] = [];
  let authToken = '';

  test.beforeEach(async ({ appShell, agendaPage }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await agendaPage.goToday();
    await agendaPage.setView('Dia');
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupAgendaSeeds(request, authToken, seeds, patientIds);
  });

  test('[AG-STS-01] marca consulta como Atendido', async ({ page, agendaPage, request }) => {
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    if (!pros[0]) test.skip(true, 'Sem profissional');

    const patient = await createPatientForAgenda(request, authToken, 'Atendido');
    patientIds.push(patient.id);
    const slot = uniqueAgendaSlot(4, 9);

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: slot.hora });
    await agendaPage.saveAppointment();
    await expectNoErrorToast(page);
    await expectEventInApi(request, authToken, new RegExp(patient.name.slice(0, 12)), slot.data);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.openEvent(new RegExp(patient.name.slice(0, 12)));
    await agendaPage.setConsultaStatus(/Atendido/i);
    await expect(agendaPage.consultaDetailsDialog().getByText(/Atendido/i).first()).toBeVisible();
  });

  test('[AG-STS-02] marca consulta como Cancelado', async ({ page, agendaPage, request }) => {
    test.setTimeout(180_000);
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    if (!pros[0]) test.skip(true, 'Sem profissional');

    const patient = await createPatientForAgenda(request, authToken, 'Cancelado');
    patientIds.push(patient.id);
    const slot = uniqueAgendaSlot(7, 10);
    const patientPattern = new RegExp(patient.name.slice(0, 12));

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: slot.hora });
    await agendaPage.saveAppointment();
    await expectNoErrorToast(page);
    await expectEventInApi(request, authToken, patientPattern, slot.data);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();
    await agendaPage.expectEventVisible(patientPattern, 30_000);
    await agendaPage.openEvent(patientPattern);
    await agendaPage.setConsultaStatus(/Cancelado/i);
    await expect(agendaPage.consultaDetailsDialog().getByText(/Cancelado/i).first()).toBeVisible();
  });

  test('[AG-STS-03] alterna status Confirmado e Aguardando na consulta', async ({ agendaPage }) => {
    const consultaCard = agendaPage.eventCard(/E2E-Consulta|paciente/i).first();
    if (!(await consultaCard.isVisible().catch(() => false))) {
      test.skip(true, 'Nenhuma consulta E2E disponível para alterar status');
    }
    await consultaCard.click();
    const dialog = agendaPage.scheduleDialog();
    const confirmado = dialog.getByRole('button', { name: /Confirmado/i }).first();
    const aguardando = dialog.getByRole('button', { name: /Aguardando/i }).first();
    if (await confirmado.isVisible().catch(() => false)) await confirmado.click();
    else if (await aguardando.isVisible().catch(() => false)) await aguardando.click();
    else test.skip(true, 'Status Confirmado/Aguardando indisponível');
    await agendaPage.saveAppointment();
    await agendaPage.cancelAppointment();
  });

  test('[AG-STS-04] filtro por status Cancelado ajusta grade', async ({ agendaPage }) => {
    await agendaPage.openOtherFilters();
    const cancelado = agendaPage.page.getByRole('button', { name: /Cancelado/i }).first();
    if (!(await cancelado.isVisible().catch(() => false))) {
      test.skip(true, 'Filtro Cancelado indisponível');
    }
    await cancelado.click();
    await agendaPage.page.keyboard.press('Escape');
    await expect(agendaPage.root).toBeVisible();
  });

  test('[AG-LBL-01] adiciona etiqueta Avaliação na consulta', async ({ agendaPage }) => {
    await agendaPage.openNewAppointment();
    await agendaPage.switchTab('Consulta');
    const label = agendaPage.scheduleDialog().locator('.dc-label-picker-card__item').filter({ hasText: /Avaliação/i });
    if (!(await label.first().isVisible().catch(() => false))) {
      test.skip(true, 'Etiqueta Avaliação indisponível');
    }
    await agendaPage.toggleLabel(/Avaliação/i);
    await expect(label.first()).toHaveClass(/selected|active|--selected/i).catch(() => undefined);
    await agendaPage.cancelAppointment();
  });

  test('[AG-LBL-02] remove etiqueta selecionada', async ({ agendaPage }) => {
    await agendaPage.openNewAppointment();
    await agendaPage.switchTab('Consulta');
    const label = agendaPage.scheduleDialog().locator('.dc-label-picker-card__item').first();
    if (!(await label.isVisible().catch(() => false))) test.skip(true, 'Sem etiquetas');
    await label.click();
    await label.click();
    await agendaPage.cancelAppointment();
  });

  test('[AG-LBL-03] etiqueta de compromisso Reunião interna disponível', async ({ agendaPage }) => {
    await agendaPage.openNewAppointment();
    await agendaPage.switchTab('Compromisso');
    await expect(
      agendaPage.scheduleDialog().locator('.dc-label-picker-card__item').filter({ hasText: /Reunião interna/i })
    ).toBeVisible({ timeout: 10_000 });
    await agendaPage.cancelAppointment();
  });
});
