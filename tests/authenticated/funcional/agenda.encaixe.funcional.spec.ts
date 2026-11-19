import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createConsultaByApi,
  createPatientForAgenda,
  listProfessionalsByApi,
  listRoomsByApi,
  readTokenFromPage,
  uniqueAgendaSlot,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';
import {
  dayEventCard,
  encaixeCheckbox,
  markAsEncaixe,
  patchConsultaStatusByApi,
  readConsultaEncaixeByApi,
  selectConsultaProfessional,
  submitConsultaAndCapture,
} from '../../support/agenda-encaixe-helpers';
import { expectErrorToast, expectNoErrorToast } from '../../support/toast-helpers';

/**
 * Encaixe: consulta marcada no mesmo horário de outra do mesmo dentista.
 * Uma consulta (base) é criada via API; pela UI tenta-se marcar outra no mesmo horário —
 * sem encaixe a API recusa (409), com encaixe aceita e a grade mostra as duas lado a lado.
 */
test.describe('Agenda — Encaixe', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const seeds: AgendaEventSeed[] = [];
  const patientIds: string[] = [];
  let authToken = '';
  let professionalName = '';
  let basePatientName = '';
  let encaixePatientName = '';
  let baseConsultaId = 0;
  let encaixeConsultaId = 0;
  let slot = uniqueAgendaSlot(3, 10);

  test.beforeEach(async ({ appShell, agendaPage, page }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await agendaPage.goToday();
    authToken = (await readTokenFromPage(page).catch(() => authToken)) || authToken;
  });

  test.afterAll(async ({ request }) => {
    if (authToken) {
      await cleanupAgendaSeeds(request, authToken, seeds, patientIds);
    }
  });

  test('[AG-ENC-01] recusa consulta comum no horário de outra consulta', async ({ page, agendaPage, request }) => {
    const token = await readTokenFromPage(page);
    authToken = token;
    const [professional] = await listProfessionalsByApi(request, token);
    const [room] = await listRoomsByApi(request, token);
    if (!professional || !room) test.skip(true, 'Conta E2E sem profissional ou sala cadastrados');
    professionalName = professional.nome_exibicao;

    const basePatient = await createPatientForAgenda(request, token, 'Encaixe Base');
    const encaixePatient = await createPatientForAgenda(request, token, 'Encaixe Extra');
    patientIds.push(basePatient.id, encaixePatient.id);
    basePatientName = basePatient.name;
    encaixePatientName = encaixePatient.name;

    slot = uniqueAgendaSlot(3, 10);
    baseConsultaId = await createConsultaByApi(request, token, {
      patientId: basePatient.id,
      professionalId: professional.id,
      roomChairId: room.id,
      data: slot.data,
      hora: slot.hora,
    });
    seeds.push({ id: baseConsultaId, tipo: 'consulta', titulo: basePatientName, data: slot.data });

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: encaixePatientName, data: slot.data, hora: slot.hora });
    await selectConsultaProfessional(agendaPage, professionalName);
    await expect(encaixeCheckbox(agendaPage)).not.toBeChecked();

    const response = await submitConsultaAndCapture(agendaPage);

    expect(response.status()).toBe(409);
    await expectErrorToast(page, /indispon|conflito|não foi possível/i);
    await expect(agendaPage.scheduleDialog()).toBeVisible();
    await agendaPage.cancelAppointment();
  });

  test('[AG-ENC-02] marca encaixe com prioridade alta por cima da consulta e exibe as duas na grade', async ({
    page,
    agendaPage,
    request,
  }) => {
    test.skip(!baseConsultaId, 'Depende da consulta base criada em AG-ENC-01');
    const token = await readTokenFromPage(page);

    await agendaPage.openNewAppointment();
    await agendaPage.fillConsultaBasics({ patientName: encaixePatientName, data: slot.data, hora: slot.hora });
    await selectConsultaProfessional(agendaPage, professionalName);
    await markAsEncaixe(agendaPage, 'Alta');

    const response = await submitConsultaAndCapture(agendaPage);
    expect(response.status(), (await response.text()).slice(0, 300)).toBe(201);
    const body = (await response.json()) as { consulta?: { id?: number } };
    encaixeConsultaId = Number(body.consulta?.id);
    seeds.push({ id: encaixeConsultaId, tipo: 'consulta', titulo: encaixePatientName, data: slot.data });
    await expect(agendaPage.scheduleDialog()).toBeHidden({ timeout: 20_000 });
    await expectNoErrorToast(page);

    expect(await readConsultaEncaixeByApi(request, token, encaixeConsultaId)).toEqual({
      ehEncaixe: true,
      prioridade: 'alta',
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.afterReload();
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.selectAllProfessionals();

    const baseCard = dayEventCard(page, basePatientName);
    const encaixeCard = dayEventCard(page, encaixePatientName);
    await expect(baseCard).toBeVisible({ timeout: 25_000 });
    await expect(encaixeCard).toBeVisible();
    await expect(encaixeCard).toHaveAttribute('data-encaixe', 'true');
    await expect(encaixeCard.getByTestId('agenda-event-encaixe-tag')).toHaveText(/Encaixe · alta/i);
    await expect(encaixeCard).toHaveAttribute('aria-label', /^Encaixe com prioridade alta\./);
    await expect(baseCard).not.toHaveAttribute('data-encaixe', 'true');

    // Mesmo horário: a grade divide a coluna em faixas, um cartão ao lado do outro.
    const [baseBox, encaixeBox] = await Promise.all([baseCard.boundingBox(), encaixeCard.boundingBox()]);
    expect(baseBox && encaixeBox).toBeTruthy();
    expect(Math.abs(baseBox!.y - encaixeBox!.y)).toBeLessThan(4);
    expect(Math.abs(baseBox!.x - encaixeBox!.x)).toBeGreaterThan(10);
  });

  test('[AG-ENC-03] consulta original e encaixe continuam editáveis sem conflito', async ({ page, request }) => {
    test.skip(!encaixeConsultaId, 'Depende do encaixe criado em AG-ENC-02');
    const token = await readTokenFromPage(page);

    expect(await patchConsultaStatusByApi(request, token, baseConsultaId, 'em_espera')).toBe(200);
    expect(await patchConsultaStatusByApi(request, token, encaixeConsultaId, 'em_espera')).toBe(200);
    expect(await readConsultaEncaixeByApi(request, token, baseConsultaId)).toEqual({
      ehEncaixe: false,
      prioridade: null,
    });
  });
});
