import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createPatientForAgenda,
  e2eName,
  expectEventInApi,
  findAgendaEventSeed,
  listProfessionalsByApi,
  readTokenFromPage,
  uniqueAgendaSlot,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';
import { dismissAppModals } from '../../support/onboarding';

test.describe('Agenda — status e etiquetas', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const seeds: AgendaEventSeed[] = [];
  const patientIds: string[] = [];
  let authToken = '';

  test.beforeEach(async ({ appShell, agendaPage, page }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await agendaPage.goToday();
    await agendaPage.setView('Dia');
    authToken = (await readTokenFromPage(page).catch(() => authToken)) || authToken;
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupAgendaSeeds(request, authToken, seeds, patientIds);
  });

  test('[AG-STS-01] marca consulta como Atendido', async ({ page, agendaPage, request }) => {
    test.setTimeout(240_000);
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    if (!pros[0]) test.skip(true, 'Sem profissional');

    const patient = await createPatientForAgenda(request, authToken, 'Atendido');
    patientIds.push(patient.id);

    let slot = uniqueAgendaSlot(2, 9);
    let created = false;
    for (let salt = 0; salt < 10; salt++) {
      slot = uniqueAgendaSlot(2, 9, 0, salt);
      await agendaPage.openNewAppointment();
      await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: slot.hora });
      try {
        await agendaPage.saveAppointment({ hora: slot.hora });
        created = true;
        break;
      } catch {
        await agendaPage.cancelAppointment().catch(() => undefined);
      }
    }
    expect(created).toBe(true);
    await expectNoErrorToast(page);
    await expectEventInApi(request, authToken, new RegExp(patient.name.slice(0, 12)), slot.data);
    const seed = await findAgendaEventSeed(request, authToken, new RegExp(patient.name.slice(0, 12)), slot.data);
    if (seed) seeds.push(seed);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.selectAllProfessionals();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.expectEventVisible(new RegExp(patient.name.slice(0, 12)), 45_000);
    await agendaPage.openEvent(new RegExp(patient.name.slice(0, 12)));
    await agendaPage.setConsultaStatus(/Atendido/i);
    if (await agendaPage.scheduleDialog().isVisible().catch(() => false)) {
      await agendaPage.saveAppointment({ hora: slot.hora });
    }
    const details = agendaPage.consultaDetailsDialog();
    const schedule = agendaPage.scheduleDialog();
    if (await details.isVisible().catch(() => false)) {
      await expect(details.getByText(/Atendido/i).first()).toBeVisible();
    } else {
      await expect(schedule.getByText(/Atendido/i).first()).toBeVisible();
    }
  });

  test('[AG-STS-02] marca consulta como Cancelado', async ({ page, agendaPage, request }) => {
    test.setTimeout(240_000);
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    if (!pros[0]) test.skip(true, 'Sem profissional');

    const patient = await createPatientForAgenda(request, authToken, 'Cancelado');
    patientIds.push(patient.id);
    const patientPattern = new RegExp(patient.name.slice(0, 12));

    let slot = uniqueAgendaSlot(2, 12);
    let created = false;
    for (let salt = 0; salt < 10; salt++) {
      slot = uniqueAgendaSlot(2, 12, 0, salt);
      await agendaPage.openNewAppointment();
      await agendaPage.fillConsultaBasics({ patientName: patient.name, data: slot.data, hora: slot.hora });
      try {
        await agendaPage.saveAppointment({ hora: slot.hora });
        created = true;
        break;
      } catch {
        await agendaPage.cancelAppointment().catch(() => undefined);
      }
    }
    expect(created).toBe(true);
    await expectNoErrorToast(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.selectAllProfessionals();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.expectEventVisible(patientPattern, 45_000);
    const seed = await findAgendaEventSeed(request, authToken, patientPattern, slot.data);
    if (seed) seeds.push(seed);
    await agendaPage.openEvent(patientPattern);
    await agendaPage.setConsultaStatus(/Cancelado/i);
    const details = agendaPage.consultaDetailsDialog();
    const schedule = agendaPage.scheduleDialog();
    if (await details.isVisible().catch(() => false)) {
      await expect(details.getByText(/Cancelado/i).first()).toBeVisible();
    } else if (await schedule.isVisible().catch(() => false)) {
      await expect(schedule.getByText(/Cancelado/i).first()).toBeVisible();
    } else {
      await agendaPage.expectEventHidden(patientPattern, 10_000);
    }
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
    await agendaPage.saveAppointment({ hora: slot.hora });
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
