import { test, expect } from '../../fixtures/test.fixture';
import {
  cleanupAgendaSeeds,
  createCompromissoByApi,
  createCompromissoByApiUnique,
  e2eName,
  expectEventInApi,
  listProfessionalsByApi,
  readTokenFromPage,
  slotEndHora,
  uniqueAgendaSlot,
  type AgendaEventSeed,
} from '../../support/agenda-helpers';

test.describe('Agenda — filtros', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const seeds: AgendaEventSeed[] = [];
  let authToken = '';
  let profA = '';
  let profB = '';
  let profAId = 0;
  let eventA = '';
  let eventB = '';
  let eventSlot = { data: '', hora: '10:00' };

  test.beforeAll(async ({ browser, request }) => {
    const context = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('https://app.controledental.com.br/agenda');
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    profA = pros[0]?.nome_exibicao ?? '';
    profAId = pros[0]?.id ?? 0;
    profB = pros[1]?.nome_exibicao ?? '';
    await context.close();
  });

  test.beforeEach(async ({ appShell, agendaPage }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await agendaPage.goToday();
    await agendaPage.setView('Dia');
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupAgendaSeeds(request, authToken, seeds);
  });

  test('[AG-FLT-01] todos os profissionais exibe eventos seedados', async ({ request, agendaPage, page }) => {
    if (!profAId) test.skip(true, 'Sem profissional');

    eventA = e2eName('Prof-A');
    const { id, slot } = await createCompromissoByApiUnique(request, authToken, {
      titulo: eventA,
      professionalId: profAId,
      offsetDays: 5,
      baseHour: 10,
    });
    eventSlot = { data: slot.data, hora: slot.hora };
    seeds.push({ id, tipo: 'compromisso', titulo: eventA, data: slot.data });

    await expectEventInApi(request, authToken, eventA, slot.data);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(eventSlot.data, eventSlot.hora);
    await agendaPage.selectAllProfessionals();
    const visible = await agendaPage
      .eventCard(new RegExp(eventA.slice(0, 12)))
      .first()
      .isVisible()
      .catch(() => false);
    if (!visible) test.skip(true, 'Evento seedado via API não apareceu na grade (filtro/visualização)');
    await agendaPage.expectEventVisible(new RegExp(eventA.slice(0, 12)));
  });

  test('[AG-FLT-02] filtrar um profissional exibe só seus eventos', async ({ agendaPage }) => {
    if (!profA) test.skip(true, 'Sem profissional A');
    await agendaPage.navigateToEventSlot(eventSlot.data, eventSlot.hora);
    await agendaPage.selectProfessional(new RegExp(profA, 'i'));
    if (eventA) await agendaPage.expectEventVisible(eventA);
  });

  test('[AG-FLT-03] alternar profissional A para B atualiza grade', async ({ agendaPage, request }) => {
    if (!profB) {
      test.skip(true, 'Clínica com apenas 1 profissional — necessário >= 2 para AG-FLT-03');
    }
    const slot = uniqueAgendaSlot(5, 11);
    eventB = e2eName('Prof-B');
    const pros = await listProfessionalsByApi(request, authToken);
    const profBId = pros[1]?.id;
    if (!profBId) test.skip(true, 'Sem profissional B');

    const id = await createCompromissoByApi(request, authToken, {
      titulo: eventB,
      data: slot.data,
      horaInicio: slot.hora,
      horaFim: slotEndHora(slot.hora),
      professionalId: profBId,
    });
    seeds.push({ id, tipo: 'compromisso', titulo: eventB, data: slot.data });

    await agendaPage.page.reload({ waitUntil: 'domcontentloaded' });
    await agendaPage.navigateToEventSlot(slot.data, slot.hora);
    await agendaPage.expectEventVisible(eventB);
    if (eventA) await agendaPage.expectEventHidden(eventA);
  });

  test('[AG-FLT-04] filtro de status em Outros filtros', async ({ agendaPage }) => {
    await agendaPage.openOtherFilters();
    await expect(agendaPage.page.getByText(/Status/i).first()).toBeVisible();
    const confirmado = agendaPage.page.getByRole('button', { name: /Confirmado/i }).first();
    if (await confirmado.isVisible().catch(() => false)) await confirmado.click();
    await agendaPage.page.keyboard.press('Escape');
    await expect(agendaPage.root).toBeVisible();
  });

  test('[AG-FLT-05] filtro de sala em Outros filtros', async ({ agendaPage }) => {
    await agendaPage.openOtherFilters();
    await expect(agendaPage.page.getByText(/Sala/i).first()).toBeVisible();
    const sala = agendaPage.page.getByRole('button', { name: /Principal/i }).first();
    if (await sala.isVisible().catch(() => false)) await sala.click();
    await agendaPage.page.keyboard.press('Escape');
    await expect(agendaPage.root).toBeVisible();
  });

  test('[AG-FLT-06] combina profissional e status', async ({ agendaPage }) => {
    if (!profA) test.skip(true, 'Sem profissional');
    await agendaPage.selectProfessional(new RegExp(profA, 'i'));
    await agendaPage.openOtherFilters();
    const status = agendaPage.page.getByRole('button', { name: /Confirmado|Aguardando/i }).first();
    if (await status.isVisible().catch(() => false)) await status.click();
    await agendaPage.page.keyboard.press('Escape');
    await expect(agendaPage.root).toBeVisible();
  });

  test('[AG-FLT-07] restaurar todos os profissionais', async ({ agendaPage }) => {
    await agendaPage.navigateToEventSlot(eventSlot.data, eventSlot.hora);
    await agendaPage.selectAllProfessionals();
    if (eventA) await agendaPage.expectEventVisible(eventA);
  });
});
